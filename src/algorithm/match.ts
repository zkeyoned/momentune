/**
 * 匹配算法:照片 ↔ 歌曲 多维评分
 *
 * 对应算法设计文档「第 4 部分:匹配算法」
 *
 * 评分维度:
 * 1. score_va    (0.40) V-A 加权欧氏距离
 * 2. score_scene (0.15) 场景标签匹配
 * 3. score_pref  (0.25) 用户偏好匹配(从 0.15 提升到 0.25)
 * 4. score_scene_fit (0.08) 场景适配度(先验/历史)
 * 5. score_ref_sim   (0.05) 参考歌曲相似度
 * 6. score_hot   (0.07) 热歌度(加性策略)
 *
 * 热歌乘性 boost(推荐策略):
 * final = base × (1 + 0.20 × hot_boost × recency)
 *
 * 置信度惩罚:
 * va_confidence < 0.7 → final × (0.7 + 0.3 × conf)
 *
 * @module algorithm/match
 */

import { calcSceneScore, getSceneEmotionPrior, type ExtendedSceneType } from './config/sceneMatrix.js';
import { calcGenreMatch, calcGenreSimilarity } from './config/genreTags.js';
import {
  MATCH_WEIGHTS,
  HOT_BOOST_MAX,
  HOT_RECENCY_DECAY_DAYS,
  VA_CONFIDENCE_PENALTY_THRESHOLD,
  CONFIDENCE_PENALTY,
  EXTEND_SCORE_SIM_WEIGHT,
  EXTEND_SCORE_PHOTO_WEIGHT,
  COLD_START_PREF_WEIGHT,
  COLD_START_HOT_WEIGHT_BOOST,
  BAYESIAN_SMOOTHING_M,
  CANDIDATE_POOL_VA_DISTANCE,
  CANDIDATE_POOL_VA_DISTANCE_LOOSE,
  CANDIDATE_POOL_MIN_SIZE,
} from './config/thresholds.js';
import { calcVADistance, calcVASimilarity, cosineSimilarity, clamp01, daysSince, normalizeTempo, normalizeLoudness } from './utils.js';
import type {
  EmotionLabel,
  GenreTag,
  LanguageTag,
  MatchScoreBreakdown,
  PlatformPreference,
  Song,
  UserPreference,
  VACoordinate,
  SpotifyAudioFeatures,
  SongSceneTag,
} from './types.js';

// ============================================================================
// 1. V-A 空间距离得分
// ============================================================================

/**
 * V-A 空间距离得分
 * score_va = 1 - distance(已归一化到 [0,1])
 *
 * distance = sqrt(0.6 × ΔV² + 0.4 × ΔA²)
 */
export function calcScoreVA(photoVA: VACoordinate, songVA: VACoordinate): number {
  return calcVASimilarity(photoVA, songVA);
}

// ============================================================================
// 2. 场景标签匹配得分
// ============================================================================

/**
 * 场景标签匹配得分
 * score_scene = max_{s_s ∈ S_s} rel(s_p, s_s)
 * 若歌曲无场景标签,返回 0.5(中性)
 */
export function calcScoreScene(
  photoScene: ExtendedSceneType,
  songSceneTags: readonly SongSceneTag[],
): number {
  return calcSceneScore(photoScene, songSceneTags);
}

// ============================================================================
// 3. 用户偏好匹配得分
// ============================================================================

/** 平台命中度 */
function calcPlatformMatch(
  userPlatform: PlatformPreference,
  songLayer: Song['layer'],
): number {
  // 网易云偏好 → emotion 层加分
  if (userPlatform === 'netease') {
    if (songLayer === 'emotion') return 1.0;
    if (songLayer === 'hot') return 0.6;
    return 0.3;
  }
  // 汽水音乐偏好 → hot 层加分
  if (userPlatform === 'qishui') {
    if (songLayer === 'hot') return 1.0;
    if (songLayer === 'emotion') return 0.6;
    return 0.3;
  }
  // QQ 音乐偏好 → emotion 层加分
  if (userPlatform === 'qq') {
    if (songLayer === 'emotion') return 0.9;
    if (songLayer === 'hot') return 0.7;
    return 0.3;
  }
  // other
  return 0.6;
}

/** 语言命中度 */
function calcLanguageMatch(
  userLanguages: readonly LanguageTag[],
  songLanguage: LanguageTag,
): number {
  if (userLanguages.length === 0) return 0.7; // 不限 → 中性偏鼓励
  if (userLanguages.includes(songLanguage)) return 1.0;
  // 相关语言(华语/粤语)
  if (songLanguage === 'cantonese' && userLanguages.includes('mandarin')) return 0.5;
  if (songLanguage === 'mandarin' && userLanguages.includes('cantonese')) return 0.5;
  return 0.2;
}

/**
 * 用户偏好匹配得分
 * score_pref = 0.40 × va_proximity + 0.30 × genre_match + 0.15 × language_match + 0.15 × platform_match
 */
export function calcScorePref(
  song: Song,
  userPref: UserPreference,
): number {
  // V-A 偏好中心接近度
  const vaProximity = calcVASimilarity(userPref.center, song.va);

  // 使用偏好权重 >= 1.0 的风格作为用户偏好集
  const userPreferredGenres = (Object.keys(userPref.genreWeights) as GenreTag[]).filter(
    (g) => userPref.genreWeights[g] >= 1.0,
  );

  const genreScore = calcGenreMatch(userPreferredGenres, song.genres);
  const languageScore = calcLanguageMatch(
    (Object.keys(userPref.languageWeights) as LanguageTag[]).filter(
      (l) => userPref.languageWeights[l] >= 1.0,
    ),
    song.language,
  );
  const platformScore = calcPlatformMatch(userPref.platform, song.layer);

  return 0.25 * vaProximity + 0.50 * genreScore + 0.15 * languageScore + 0.10 * platformScore;
}

// ============================================================================
// 4. 场景适配度(先验/历史)
// ============================================================================

/**
 * 场景适配度:衡量该场景下此歌被历史用户接受的程度
 *
 * 冷启动:用先验表 SCENE_EMOTION_PRIOR
 * 有数据:用贝叶斯平滑 P(accept | scene, label)
 *
 * @param scene 照片场景
 * @param emotionLabel 歌曲的情绪标签(或照片情绪标签)
 * @param history 历史数据(可选,有数据时用贝叶斯平滑)
 */
export function calcScoreSceneFit(
  scene: ExtendedSceneType,
  emotionLabel: EmotionLabel,
  history?: { acceptCount: number; totalCount: number },
): number {
  const prior = getSceneEmotionPrior(scene, emotionLabel);

  if (!history || history.totalCount === 0) {
    return prior; // 冷启动用先验
  }

  // 贝叶斯平滑:(n_accept + m × prior) / (n_total + m)
  const m = BAYESIAN_SMOOTHING_M;
  return (history.acceptCount + m * prior) / (history.totalCount + m);
}

// ============================================================================
// 5. 参考歌曲相似度
// ============================================================================

/** 从 Spotify 特征构建向量(统一使用 normalizeTempo / normalizeLoudness 归一化) */
function buildSpotifyVector(features: SpotifyAudioFeatures): number[] {
  return [
    features.valence,
    features.energy,
    normalizeTempo(features.tempo),
    features.danceability,
    features.acousticness,
    features.instrumentalness,
    normalizeLoudness(features.loudness),
  ];
}

/**
 * 参考歌曲相似度
 * score_ref_sim = max_{r ∈ R} audio_similarity(r, s)
 *
 * 有 Spotify 特征:用余弦相似度
 * 无 Spotify 特征:用 V-A 距离转相似度
 */
export function calcScoreRefSim(
  song: Song,
  referenceSongs: readonly Song[],
): number {
  if (referenceSongs.length === 0) return 0.5; // 无参考歌,中性

  let maxSim = 0;
  for (const ref of referenceSongs) {
    let sim: number;
    if (song.spotifyFeatures && ref.spotifyFeatures) {
      // 有 Spotify 特征:余弦相似度
      sim = cosineSimilarity(
        buildSpotifyVector(song.spotifyFeatures),
        buildSpotifyVector(ref.spotifyFeatures),
      );
    } else {
      // 无 Spotify 特征:V-A 相似度
      sim = calcVASimilarity(song.va, ref.va);
    }
    if (sim > maxSim) maxSim = sim;
  }
  return maxSim;
}

// ============================================================================
// 6. 热歌度(加性策略)+ 乘性 boost
// ============================================================================

/** 热歌新鲜度 → boost 系数(本周 1.0,1 月 0.85,半年 0.70,更早 0.50,从未 0.30) */
export function calcHotBoostByRecency(
  recency: Song['hotRecency'],
  listedDate?: number,
): number {
  // 基础 boost
  const baseBoost: Record<Song['hotRecency'], number> = {
    this_week: 1.0,
    this_month: 0.85,
    half_year: 0.75,
    older: 0.65, // 经典歌曲有持久流行度,不打太低
    never: 0.45, // 兜底层保底
  };
  let boost = baseBoost[recency];

  // 时间衰减
  if (listedDate !== undefined && recency !== 'never') {
    const days = daysSince(listedDate);
    const decay = Math.exp(-days / HOT_RECENCY_DECAY_DAYS);
    boost = boost * decay;
  }

  return clamp01(boost);
}

/** 热歌度得分(加性策略,0-1) */
export function calcScoreHot(song: Song): number {
  return calcHotBoostByRecency(song.hotRecency);
}

/**
 * 热歌乘性 boost 系数(推荐策略)
 * final = base × (1 + 0.20 × hot_boost × recency)
 * 上限 +20%
 */
export function calcHotBoostMultiplier(song: Song, listedDate?: number): number {
  const boost = calcHotBoostByRecency(song.hotRecency, listedDate);
  return 1 + HOT_BOOST_MAX * boost;
}

// ============================================================================
// 7. 置信度惩罚
// ============================================================================

/**
 * 置信度惩罚系数
 * va_confidence < 0.7 → penalty = (0.7 + 0.3 × conf)
 * va_confidence >= 0.7 → penalty = 1.0(不惩罚)
 */
export function calcConfidencePenalty(vaConfidence: number): number {
  if (vaConfidence >= VA_CONFIDENCE_PENALTY_THRESHOLD) return 1.0;
  return CONFIDENCE_PENALTY.base + CONFIDENCE_PENALTY.scale * vaConfidence;
}

// ============================================================================
// 8. 主匹配函数:计算单首歌的完整评分
// ============================================================================

/** 匹配上下文(包含照片与用户信息) */
export interface MatchContext {
  /** 照片情绪(融合 GPS 后) */
  photoVA: VACoordinate;
  /** 照片主导情绪标签 */
  photoEmotionLabel: EmotionLabel;
  /** 照片次要情绪标签(混合情绪时) */
  photoSecondaryLabel?: EmotionLabel;
  /** 照片场景(含衍生 travel) */
  photoScene: ExtendedSceneType;
  /** 用户偏好 */
  userPref: UserPreference;
  /** 参考歌曲(完整 Song 对象,用于相似度计算) */
  referenceSongs: readonly Song[];
  /** 是否冷启动(冷启动时 score_pref 降权,score_hot 加权) */
  isColdStart: boolean;
}

/**
 * 计算单首歌的完整匹配评分
 *
 * 策略:
 * - 加性 base_score(6 维加权)
 * - 乘性 hot_boost(上限 +20%)
 * - 乘性 confidence_penalty(低置信度打折)
 *
 * final = base × hot_boost × confidence_penalty
 */
export function calcMatchScore(song: Song, ctx: MatchContext): MatchScoreBreakdown {
  // 6 维评分
  const scoreVA = calcScoreVA(ctx.photoVA, song.va);
  const scoreScene = calcScoreScene(ctx.photoScene, song.sceneTags);
  const scorePref = calcScorePref(song, ctx.userPref);
  const scoreSceneFit = calcScoreSceneFit(ctx.photoScene, ctx.photoEmotionLabel);
  const scoreRefSim = calcScoreRefSim(song, ctx.referenceSongs);
  const scoreHot = calcScoreHot(song);

  // 权重(冷启动时调整:score_pref 降权,score_hot 加权,总和仍为 1.0)
  const weights = ctx.isColdStart
    ? {
        scoreVA: MATCH_WEIGHTS.scoreVA,
        scoreScene: MATCH_WEIGHTS.scoreScene,
        scorePref: COLD_START_PREF_WEIGHT, // 冷启动降权(0.08)
        scoreSceneFit: MATCH_WEIGHTS.scoreSceneFit,
        scoreRefSim: MATCH_WEIGHTS.scoreRefSim,
        scoreHot: MATCH_WEIGHTS.scoreHot + COLD_START_HOT_WEIGHT_BOOST, // 冷启动加权(+0.07)
      }
    : MATCH_WEIGHTS;

  // 加性 base_score
  const baseScore =
    weights.scoreVA * scoreVA +
    weights.scoreScene * scoreScene +
    weights.scorePref * scorePref +
    weights.scoreSceneFit * scoreSceneFit +
    weights.scoreRefSim * scoreRefSim +
    weights.scoreHot * scoreHot;

  // 乘性 hot_boost(推荐策略)
  const hotBoost = calcHotBoostMultiplier(song);

  // 乘性 confidence_penalty
  const confidencePenalty = calcConfidencePenalty(song.va.confidence);

  // 最终分数
  const finalScore = clamp01(baseScore * hotBoost * confidencePenalty);

  return {
    scoreVA,
    scoreScene,
    scorePref,
    scoreSceneFit,
    scoreRefSim,
    scoreHot,
    baseScore: clamp01(baseScore),
    hotBoost,
    confidencePenalty,
    finalScore,
  };
}

// ============================================================================
// 9. 扩展相似度(阶段 2 用)
// ============================================================================

/**
 * 扩展相似度:核心曲 → 候选扩展曲
 *
 * sim(s_i, c) = 0.35 × sim_audio + 0.25 × sim_va + 0.25 × sim_genre + 0.15 × sim_context
 */
export function calcExtendSimilarity(source: Song, candidate: Song): number {
  // sim_audio:Spotify 特征余弦,无则用 V-A
  let simAudio: number;
  if (source.spotifyFeatures && candidate.spotifyFeatures) {
    simAudio = cosineSimilarity(
      buildSpotifyVector(source.spotifyFeatures),
      buildSpotifyVector(candidate.spotifyFeatures),
    );
  } else {
    simAudio = calcVASimilarity(source.va, candidate.va);
  }

  // sim_va
  const simVA = calcVASimilarity(source.va, candidate.va);

  // sim_genre(软 Jaccard)
  const simGenre = calcGenreSimilarity(source.genres, candidate.genres);

  // sim_context:同歌手/同年代/同语言
  const sameArtist = source.artist === candidate.artist ? 1 : 0;
  const sameDecade =
    source.decade !== undefined && candidate.decade !== undefined && Math.abs(source.decade - candidate.decade) <= 10
      ? 1
      : 0;
  const sameLanguage = source.language === candidate.language ? 1 : 0;
  const simContext = 0.5 * sameArtist + 0.3 * sameDecade + 0.2 * sameLanguage;

  return 0.35 * simAudio + 0.25 * simVA + 0.25 * simGenre + 0.15 * simContext;
}

/**
 * 扩展候选得分(用于阶段 2 排序)
 * exp_score = 0.70 × sim(source, candidate) + 0.30 × final_score(candidate, photo)
 */
export function calcExtendScore(
  similarity: number,
  candidateFinalScore: number,
): number {
  return (
    EXTEND_SCORE_SIM_WEIGHT * similarity +
    EXTEND_SCORE_PHOTO_WEIGHT * candidateFinalScore
  );
}

// ============================================================================
// 10. 候选池过滤
// ============================================================================

/**
 * 阶段 1 候选池过滤:V-A 距离 < 阈值
 *
 * @param songs 全库歌曲
 * @param photoVA 照片 V-A
 * @param strictDistance 严格阈值(默认 CANDIDATE_POOL_VA_DISTANCE = 0.45)
 * @param looseDistance 宽松阈值(冷门情绪用,默认 CANDIDATE_POOL_VA_DISTANCE_LOOSE = 0.60)
 * @param minSize 最小规模(不足则放宽,默认 CANDIDATE_POOL_MIN_SIZE = 50)
 */
export function filterCandidatePool(
  songs: readonly Song[],
  photoVA: VACoordinate,
  strictDistance: number = CANDIDATE_POOL_VA_DISTANCE,
  looseDistance: number = CANDIDATE_POOL_VA_DISTANCE_LOOSE,
  minSize: number = CANDIDATE_POOL_MIN_SIZE,
): { candidates: Song[]; usedLoose: boolean } {
  // 严格过滤
  const strict = songs.filter((s) => calcVADistance(photoVA, s.va) <= strictDistance);
  if (strict.length >= minSize) {
    return { candidates: strict, usedLoose: false };
  }
  // 放宽过滤
  const loose = songs.filter((s) => calcVADistance(photoVA, s.va) <= looseDistance);
  return { candidates: loose.length > 0 ? loose : strict, usedLoose: true };
}
