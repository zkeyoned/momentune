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
  HOT_BOOST_MAX,
  HOT_RECENCY_DECAY_DAYS,
  VA_CONFIDENCE_PENALTY_THRESHOLD,
  CONFIDENCE_PENALTY,
  EXTEND_SCORE_SIM_WEIGHT,
  EXTEND_SCORE_PHOTO_WEIGHT,
  BAYESIAN_SMOOTHING_M,
  CANDIDATE_POOL_VA_DISTANCE,
  CANDIDATE_POOL_VA_DISTANCE_LOOSE,
  CANDIDATE_POOL_MIN_SIZE,
  MATCH_WEIGHTS_FIVE_DIM,
  MATCH_WEIGHTS_VA_DEGRADED,
  VA_CONFIDENCE_DEGRADE_THRESHOLD,
} from './config/thresholds.js';
import { calcVADistance, calcVASimilarity, cosineSimilarity, clamp01, daysSince, normalizeTempo, normalizeLoudness } from './utils.js';
import type {
  EmotionLabel,
  GenreTag,
  LanguageTag,
  MatchScoreBreakdown,
  MusicIntent,
  PlatformPreference,
  Song,
  UserPreference,
  VACoordinate,
  VAWithConfidence,
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
  /** AI 产出的音乐匹配意图(五维,AI 降级时缺失 → 退化为纯 V-A 模式) */
  musicIntent?: MusicIntent;
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
  // 6 维评分(原有补充信号)
  const scoreVA = calcScoreVA(ctx.photoVA, song.va);
  const scoreScene = calcScoreScene(ctx.photoScene, song.sceneTags);
  const scorePref = calcScorePref(song, ctx.userPref);
  const scoreSceneFit = calcScoreSceneFit(ctx.photoScene, ctx.photoEmotionLabel);
  const scoreRefSim = calcScoreRefSim(song, ctx.referenceSongs);
  const scoreHot = calcScoreHot(song);

  // 五维评分(AI MusicIntent → Song)
  // musicIntent 缺失时各维度输入回退到中性默认值,五维 score 仍可计算
  // 但 resolveDynamicWeights 会返回纯 V-A 权重(五维权重为 0),自然不参与加权
  const musicIntent = ctx.musicIntent;
  const scoreMood = calcScoreMood(musicIntent?.moodTags ?? [], song);
  const scoreEnergy = calcScoreEnergy(musicIntent?.energyLevel ?? 'mid', song.va);
  const scoreGenre = calcScoreGenre(musicIntent?.genreHints ?? [], song.genres);
  const scoreLanguage = calcScoreLanguage(musicIntent?.languageHint ?? 'any', song.language);
  const scoreVibe = calcScoreVibe(musicIntent?.vibeDescription ?? '', song.sceneTags);

  // 动态权重:6 维(mood/energy/genre/language/vibe/va),总和=1.0
  // 根据 song.va.confidence 和 musicIntent 信号可用度动态调整
  const w = resolveDynamicWeights(song.va.confidence, musicIntent);

  // userPrefs.center 通道:在 va 维度融合用户偏好中心(如融合红心歌后的质心)
  // 背景:Task 6 把 suppScore 降到 0.10 后,userPref.center 仅通过 suppScore 内的
  //   scorePref.vaProximity(占 0.25)间接影响 finalScore,影响系数被三层稀释至
  //   0.10×0.06×0.25 ≈ 0.0015,无法体现"融合红心歌后推荐应偏向红心歌质心"。
  // 方案:在 mainScore 的 va 维度引入 CENTER_SHARE 比例的 vaProximityFromCenter,
  //   让 userPref.center 直接参与主分。vaScoreBlended 仍是 [0,1] 加权和,mainScore
  //   总权重不变(仍=1.0)。CENTER_SHARE=0.08 使影响系数提升至 0.90×0.08≈0.072,
  //   足以让扩展曲 expScore 排序体现 center 差异,从而移动推荐质心。
  // 兼容性:match.test.ts 的 buildCtx 中 photoVA === userPref.center,故
  //   vaProximityFromCenter === scoreVA,center 通道对该测试无影响。
  const CENTER_SHARE = 0.08;
  const vaProximityFromCenter = calcVASimilarity(ctx.userPref.center, song.va);
  const vaScoreBlended = (1 - CENTER_SHARE) * scoreVA + CENTER_SHARE * vaProximityFromCenter;

  // 主分公式:五维 + V-A 加权(权重 0.90)
  const mainScore =
    w.mood * scoreMood +
    w.energy * scoreEnergy +
    w.genre * scoreGenre +
    w.language * scoreLanguage +
    w.vibe * scoreVibe +
    w.va * vaScoreBlended;

  // 补充信号(权重 0.10):场景/偏好/场景适配/参考歌相似度/热歌度
  // 这些原有维度仍提供有价值的信号,作为五维主分的微调
  // 权重分配说明:
  //  - scorePref 提到 0.06:让 userPref.center 的差异额外在补充信号中体现
  //  - scoreRefSim 提到 0.02:referenceSongs(红心歌)变化时增强对应区域歌曲得分
  //  - scoreHot = 0:热歌度已通过乘性 hotBoost(上限 +20%)体现,补充信号中不再重复加权
  const suppScore =
    0.01 * scoreScene +
    0.06 * scorePref +
    0.01 * scoreSceneFit +
    0.02 * scoreRefSim +
    0.00 * scoreHot;

  // 加性 base_score(主分 0.90 + 补充 0.10)
  const baseScore = 0.90 * mainScore + 0.10 * suppScore;

  // 乘性 hot_boost(推荐策略)
  const hotBoost = calcHotBoostMultiplier(song);

  // 乘性 confidence_penalty
  const confidencePenalty = calcConfidencePenalty(song.va.confidence);

  // 最终分数
  const finalScore = clamp01(baseScore * hotBoost * confidencePenalty);

  return {
    scoreVA,
    scoreMood,
    scoreEnergy,
    scoreGenre,
    scoreLanguage,
    scoreVibe,
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

// ============================================================================
// 11. 五维匹配打分函数(AI MusicIntent → Song)
// ============================================================================

/**
 * 情绪基调匹配:moodTags 模糊匹配 song.emotionLabel + song.neteaseTags
 *
 * 匹配规则:大小写不敏感的双向 includes(moodTag includes 于某目标标签,或目标标签 includes 于 moodTag)
 *
 * @param moodTags AI 产出的情绪基调标签(自由文本,如 ["慵懒","释然"])
 * @param song 候选歌曲
 * @returns 0-1,越大越匹配;空输入返回 0.5(中性);命中至少 1 个保底 0.3
 */
export function calcScoreMood(moodTags: string[], song: Song): number {
  // 1. moodTags 为空 → 返回 0.5(中性,不偏不倚)
  if (!moodTags || moodTags.length === 0) return 0.5;

  // 2. 把 song.emotionLabel 和 song.neteaseTags 合并为目标标签集合
  const targetTags: string[] = [];
  if (song.emotionLabel) targetTags.push(song.emotionLabel);
  if (song.neteaseTags && song.neteaseTags.length > 0) {
    for (const t of song.neteaseTags) targetTags.push(t);
  }

  // 3. 对每个 moodTag,做大小写不敏感的 includes 匹配
  let hitCount = 0;
  for (const moodTag of moodTags) {
    const tag = (moodTag ?? '').toLowerCase().trim();
    if (!tag) continue;
    const matched = targetTags.some((target) => {
      const t = (target ?? '').toLowerCase().trim();
      if (!t) return false;
      return t.includes(tag) || tag.includes(t);
    });
    if (matched) hitCount++;
  }

  // 4. 命中数 / moodTags.length 作为得分
  if (hitCount === 0) return 0;
  // 5. 至少命中 1 个 → 最低保底 0.3
  const rawScore = hitCount / moodTags.length;
  return Math.max(0.3, rawScore);
}

/**
 * 能量级别匹配:energyLevel 映射到 song.va.a 区间
 *
 * 映射规则:
 *  - a < 0.35 → low
 *  - 0.35 ≤ a < 0.65 → mid
 *  - a ≥ 0.65 → high
 *
 * 完全匹配 → 1.0;相邻档位(low vs mid, mid vs high) → 0.5;完全相反(low vs high) → 0.0
 *
 * @param energyLevel AI 产出的能量级别
 * @param songVA 歌曲 V-A 坐标(带置信度)
 * @returns 0-1
 */
export function calcScoreEnergy(
  energyLevel: MusicIntent['energyLevel'],
  songVA: VAWithConfidence,
): number {
  // 1. 把 songVA.a 映射到 low/mid/high
  let songEnergy: 'low' | 'mid' | 'high';
  if (songVA.a < 0.35) songEnergy = 'low';
  else if (songVA.a < 0.65) songEnergy = 'mid';
  else songEnergy = 'high';

  // 2. 完全匹配 → 1.0
  if (energyLevel === songEnergy) return 1.0;

  // 3. 完全相反(low vs high) → 0.0
  if (
    (energyLevel === 'low' && songEnergy === 'high') ||
    (energyLevel === 'high' && songEnergy === 'low')
  ) {
    return 0.0;
  }

  // 4. 相邻档位(low vs mid, mid vs high) → 0.5
  return 0.5;
}

/**
 * 风格倾向匹配:genreHints 模糊匹配 song.genres
 *
 * 匹配规则:大小写不敏感的双向 includes
 *
 * @param genreHints AI 产出的风格倾向(自由文本,如 ["chill electronic","city pop"])
 * @param songGenres 歌曲风格标签数组
 * @returns 0-1;空输入返回 0.5(中性);命中至少 1 个保底 0.4
 */
export function calcScoreGenre(
  genreHints: string[],
  songGenres: GenreTag[],
): number {
  // 1. genreHints 为空 → 返回 0.5(中性)
  if (!genreHints || genreHints.length === 0) return 0.5;

  // 2. songGenres 为空 → 返回 0.5
  if (!songGenres || songGenres.length === 0) return 0.5;

  // 3. 把 songGenres 转为字符串数组(GenreTag 是字符串 union)
  const targetGenres: string[] = songGenres.map((g) => String(g));

  // 4. 对每个 genreHint,做大小写不敏感的 includes 匹配
  let hitCount = 0;
  for (const hint of genreHints) {
    const h = (hint ?? '').toLowerCase().trim();
    if (!h) continue;
    const matched = targetGenres.some((target) => {
      const t = (target ?? '').toLowerCase().trim();
      if (!t) return false;
      return t.includes(h) || h.includes(t);
    });
    if (matched) hitCount++;
  }

  // 5. 命中数 / genreHints.length 作为得分
  if (hitCount === 0) return 0;
  // 6. 至少命中 1 个 → 最低保底 0.4
  const rawScore = hitCount / genreHints.length;
  return Math.max(0.4, rawScore);
}

/** 语种归一化:把多种写法(zh/mandarin/chinese/cn/en/english)统一为 mandarin/english/原值 */
function normalizeLanguage(s: string): string {
  const t = (s ?? '').toLowerCase().trim();
  if (t === 'zh' || t === 'mandarin' || t === 'chinese' || t === 'cn') return 'mandarin';
  if (t === 'en' || t === 'english') return 'english';
  return t;
}

/**
 * 语种匹配:languageHint 精确匹配 song.language
 *
 * 归一化后精确匹配;mandarin 兼容 zh/mandarin/chinese/cn,english 兼容 en/english
 *
 * @param languageHint AI 产出的语种倾向(mandarin/english/any)
 * @param songLanguage 歌曲语种(可能是多种写法)
 * @returns 0-1;any 或空字符串返回 0.5(中性);匹配 1.0;不匹配 0.0
 */
export function calcScoreLanguage(
  languageHint: MusicIntent['languageHint'],
  songLanguage: string,
): number {
  // 1. languageHint === 'any' → 返回 0.5(不限制)
  if (languageHint === 'any') return 0.5;

  // 2. songLanguage 为空 → 返回 0.5
  if (!songLanguage || songLanguage.trim().length === 0) return 0.5;

  // 3. 归一化后完全匹配 → 1.0
  const normSong = normalizeLanguage(songLanguage);
  const normHint = normalizeLanguage(languageHint);
  if (normSong === normHint) return 1.0;

  // 4. 不匹配 → 0.0
  return 0.0;
}

/**
 * 氛围匹配:vibeDescription 关键词匹配 song.sceneTags
 *
 * 切词策略:英文按空格切词,中文按 2 字滑窗(单字片段保留为单字 token)
 * 匹配规则:token 与 sceneTag 双向 includes
 *
 * @param vibeDescription AI 产出的一句话氛围描述(如 "夏夜海边微醺的放松感")
 * @param songSceneTags 歌曲场景标签数组(可空)
 * @returns 0-1;空输入返回 0.5(中性);命中至少 1 个保底 0.3
 */
export function calcScoreVibe(
  vibeDescription: string,
  songSceneTags?: string[],
): number {
  // 1. vibeDescription 为空 → 返回 0.5(中性)
  if (!vibeDescription || vibeDescription.trim().length === 0) return 0.5;

  // 2. songSceneTags 为空或 undefined → 返回 0.5
  if (!songSceneTags || songSceneTags.length === 0) return 0.5;

  // 3. 把 vibeDescription 切词(英文按空格切词,中文按 2 字滑窗)
  const text = vibeDescription.trim();
  const tokens: string[] = [];

  // 英文按空格切词(只保留含字母的 token)
  const englishTokens = text.split(/\s+/).filter((t) => /[a-zA-Z]/.test(t));
  for (const tok of englishTokens) {
    // 去掉 token 中的标点
    const cleaned = tok.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleaned) tokens.push(cleaned);
  }

  // 中文按 2 字滑窗(提取连续中文字符片段)
  const chineseSegments = text.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const seg of chineseSegments) {
    if (seg.length === 1) {
      tokens.push(seg);
    } else {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg.substring(i, i + 2));
      }
    }
  }

  if (tokens.length === 0) return 0.5;

  // 4. 对每个词,检查是否 includes 于某 sceneTag(双向)
  let hitCount = 0;
  for (const token of tokens) {
    const t = token.toLowerCase().trim();
    if (!t) continue;
    const matched = songSceneTags.some((scene) => {
      const s = (scene ?? '').toLowerCase().trim();
      if (!s) return false;
      return s.includes(t) || t.includes(s);
    });
    if (matched) hitCount++;
  }

  // 5. 命中词数 / 切词总数 作为得分
  if (hitCount === 0) return 0;
  // 6. 至少命中 1 个 → 最低保底 0.3
  const rawScore = hitCount / tokens.length;
  return Math.max(0.3, rawScore);
}

// ============================================================================
// 动态权重计算(Task 5)
// ============================================================================

/** 六维权重键 */
type WeightKey = 'mood' | 'energy' | 'genre' | 'language' | 'vibe' | 'va';

/**
 * 把某维度的部分权重按比例分摊给其他 5 维(原地修改)
 *
 * 算法:假设当前权重 {a:0.2, b:0.3, c:0.5},要让 c 归零(即 newValue=0):
 * - a 和 b 的当前总和 = 0.5
 * - a 占 a+b 的比例 = 0.4 → 新 a = 0.2 + 0.5 × 0.4 = 0.4
 * - b 占 a+b 的比例 = 0.6 → 新 b = 0.3 + 0.5 × 0.6 = 0.6
 * - 新 c = 0
 *
 * @param weights 当前权重(会被原地修改)
 * @param key 待调整的维度
 * @param newValue 该维度的新值(原值与 newValue 的差额分摊给其他维度)
 */
function redistributeWeight(
  weights: Record<WeightKey, number>,
  key: WeightKey,
  newValue: number,
): void {
  const oldWeight = weights[key];
  const diff = oldWeight - newValue;
  if (diff <= 0) return;

  weights[key] = newValue;

  const otherKeys = (Object.keys(weights) as WeightKey[]).filter((k) => k !== key);
  const sumOthers = otherKeys.reduce((sum, k) => sum + weights[k], 0);
  if (sumOthers <= 0) return; // 其他维度全为 0,无法按比例分摊,保留差额

  for (const k of otherKeys) {
    weights[k] += diff * (weights[k] / sumOthers);
  }
}

/**
 * 根据歌曲 V-A 置信度和 musicIntent 信号可用度，动态计算 6 维权重。
 * - V-A confidence < 0.7 → va 降权到 0.10，多出权重分给 mood/genre/energy
 * - musicIntent.genreHints 为空 → genre 权重归零，剩余按比例分摊
 * - musicIntent.moodTags 为空 → mood 权重减半，剩余按比例分摊
 * - 返回权重总和始终 = 1.0
 */
export function resolveDynamicWeights(
  songVAConfidence: number,
  musicIntent: MusicIntent | undefined,
): { mood: number; energy: number; genre: number; language: number; vibe: number; va: number } {
  // 1. musicIntent undefined → 退化为纯 V-A 模式:va=1.0,其他全 0
  if (!musicIntent) {
    return { mood: 0, energy: 0, genre: 0, language: 0, vibe: 0, va: 1.0 };
  }

  // 2. 起始用 MATCH_WEIGHTS_FIVE_DIM(V-A 高置信度基准)
  // 3. 若 songVAConfidence < 0.7 → 切换到 MATCH_WEIGHTS_VA_DEGRADED
  const weights: Record<WeightKey, number> =
    songVAConfidence < VA_CONFIDENCE_DEGRADE_THRESHOLD
      ? { ...MATCH_WEIGHTS_VA_DEGRADED }
      : { ...MATCH_WEIGHTS_FIVE_DIM };

  // 4. musicIntent.genreHints 为空 → genre 权重置 0,把 genre 权重按比例分给其他 5 维
  if (!musicIntent.genreHints || musicIntent.genreHints.length === 0) {
    redistributeWeight(weights, 'genre', 0);
  }

  // 5. musicIntent.moodTags 为空 → mood 权重减半,多出权重按比例分给其他 5 维
  if (!musicIntent.moodTags || musicIntent.moodTags.length === 0) {
    redistributeWeight(weights, 'mood', weights.mood / 2);
  }

  // 6. 最终归一化保证总和=1.0(浮点误差容忍 ±0.001)
  const sum = (Object.keys(weights) as WeightKey[]).reduce((s, k) => s + weights[k], 0);
  if (sum === 0) {
    return { mood: 0, energy: 0, genre: 0, language: 0, vibe: 0, va: 0 };
  }
  return {
    mood: weights.mood / sum,
    energy: weights.energy / sum,
    genre: weights.genre / sum,
    language: weights.language / sum,
    vibe: weights.vibe / sum,
    va: weights.va / sum,
  };
}
