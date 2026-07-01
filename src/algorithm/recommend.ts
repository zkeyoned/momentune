/**
 * 两阶段推荐主流程
 *
 * 对应算法设计文档「两阶段推荐流程」
 *
 * 阶段 1:核心 8 首选择
 *   1. 候选池过滤(V-A 距离 < 0.45)
 *   2. 主分排序
 *   3. 多样化筛选 8 首(同歌手≤1,同标签≤2,热歌≥3)
 *
 * 阶段 2:风格扩展 7-12 首
 *   1. 每个核心曲作为扩展源
 *   2. 计算扩展相似度
 *   3. 硬过滤(相似度≥0.55, V-A距离≤0.40, 不在核心)
 *   4. 全局多样化
 *
 * 最终:8 核心 + 7-12 扩展 = 15-20 首
 *
 * @module algorithm/recommend
 */

import { calcMatchScore, filterCandidatePool, calcExtendSimilarity, calcExtendScore, type MatchContext } from './match.js';
import { calcVADistance } from './utils.js';
import { findNearestEmotionLabel, resolveEmotionLabels } from './utils.js';
import {
  CANDIDATE_POOL_VA_DISTANCE,
  CANDIDATE_POOL_VA_DISTANCE_LOOSE,
  CANDIDATE_POOL_MIN_SIZE,
  CORE_MAX_SAME_ARTIST,
  CORE_MAX_SAME_LABEL,
  CORE_MIN_HOT_COUNT,
  CORE_MAX_HOT_COUNT,
  CORE_MAX_FALLBACK,
  CORE_MIN_DISTINCT_LABELS,
  EXPLORE_TRACK_POSITION,
  EXPLORE_EPSILON,
  EXTEND_SIM_THRESHOLD,
  EXTEND_VA_DISTANCE_MAX,
  EXTEND_SIM_THRESHOLD_LOOSE,
  EXTEND_VA_DISTANCE_LOOSE,
  EXTEND_VA_CONFIDENCE_MIN,
  EXTEND_SAME_SOURCE_GENRE_JACCARD_MAX,
  GLOBAL_MAX_SAME_ARTIST,
  GLOBAL_MAX_SAME_LABEL,
  EXTEND_QUOTA_BY_RANK,
  FINAL_TOTAL_MIN,
  FINAL_TOTAL_MAX,
  CONFLICT_CONFIDENCE_LOW,
} from './config/thresholds.js';
import { jaccardSimilarity } from './utils.js';
import type {
  EmotionLabel,
  RecommendationMeta,
  RecommendationResult,
  RecommendedTrack,
  Song,
  UserPreference,
  VAWithConfidence,
} from './types.js';
import type { ExtendedSceneType } from './config/sceneMatrix.js';

// ============================================================================
// 推荐主输入
// ============================================================================

/** 推荐主流程输入 */
export interface RecommendInput {
  /** 照片情绪(融合 GPS 后) */
  photoEmotion: VAWithConfidence;
  /** 照片场景(含衍生 travel) */
  photoScene: ExtendedSceneType;
  /** 用户偏好 */
  userPref: UserPreference;
  /** 参考歌曲(完整 Song 对象) */
  referenceSongs: readonly Song[];
  /** 全库歌曲 */
  songLibrary: readonly Song[];
  /** 探索概率(默认 0.15) */
  exploreEpsilon?: number;
}

// ============================================================================
// 阶段 1:核心 8 首选择
// ============================================================================

/** 带分数的候选 */
interface ScoredCandidate {
  song: Song;
  breakdown: ReturnType<typeof calcMatchScore>;
}

/**
 * 阶段 1:候选池过滤 + 主分排序
 */
function scoreAndSortCandidates(
  input: RecommendInput,
  candidates: readonly Song[],
): ScoredCandidate[] {
  const ctx: MatchContext = {
    photoVA: input.photoEmotion,
    photoEmotionLabel: findNearestEmotionLabel(input.photoEmotion),
    photoScene: input.photoScene,
    userPref: input.userPref,
    referenceSongs: input.referenceSongs,
    isColdStart: input.userPref.isColdStart,
  };

  const scored = candidates.map((song) => ({
    song,
    breakdown: calcMatchScore(song, ctx),
  }));

  // 按 finalScore 降序
  scored.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);
  return scored;
}

/**
 * 多样化约束检查(8 首核心曲)
 */
function checkCoreDiversityConstraints(
  selected: readonly ScoredCandidate[],
  newCandidate: ScoredCandidate,
): { passes: boolean; reason?: string } {
  const newSong = newCandidate.song;

  // 同歌手上限
  const sameArtistCount = selected.filter((s) => s.song.artist === newSong.artist).length;
  if (sameArtistCount >= CORE_MAX_SAME_ARTIST) {
    return { passes: false, reason: `同歌手 ${newSong.artist} 已达上限 ${CORE_MAX_SAME_ARTIST}` };
  }

  // 同情绪标签上限
  const newLabel = findNearestEmotionLabel(newSong.va);
  const sameLabelCount = selected.filter((s) => findNearestEmotionLabel(s.song.va) === newLabel).length;
  if (sameLabelCount >= CORE_MAX_SAME_LABEL) {
    return { passes: false, reason: `同情绪标签 ${newLabel} 已达上限 ${CORE_MAX_SAME_LABEL}` };
  }

  // 兜底层上限
  if (newSong.layer === 'fallback') {
    const fallbackCount = selected.filter((s) => s.song.layer === 'fallback').length;
    if (fallbackCount >= CORE_MAX_FALLBACK) {
      return { passes: false, reason: `兜底层已达上限 ${CORE_MAX_FALLBACK}` };
    }
  }

  return { passes: true };
}

/**
 * 检查 8 首核心曲的全局约束
 */
function validateCoreGlobalConstraints(selected: readonly ScoredCandidate[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // 热歌占比下限
  const hotCount = selected.filter((s) => s.song.layer === 'hot').length;
  if (hotCount < CORE_MIN_HOT_COUNT) {
    issues.push(`热歌数 ${hotCount} < 下限 ${CORE_MIN_HOT_COUNT}`);
  }

  // 热歌占比上限
  if (hotCount > CORE_MAX_HOT_COUNT) {
    issues.push(`热歌数 ${hotCount} > 上限 ${CORE_MAX_HOT_COUNT}`);
  }

  // 覆盖不同情绪标签数
  const labels = new Set(selected.map((s) => findNearestEmotionLabel(s.song.va)));
  if (labels.size < CORE_MIN_DISTINCT_LABELS) {
    issues.push(`情绪标签覆盖 ${labels.size} < 下限 ${CORE_MIN_DISTINCT_LABELS}`);
  }

  return { valid: issues.length === 0, issues };
}

// ============================================================================
// selectCoreTracks 子步骤(从 103 行拆分为 6 个独立函数 + 编排主函数)
// ============================================================================

const TARGET_CORE_SIZE = 8;

interface CoreSelectionCtx {
  sorted: readonly ScoredCandidate[];
  firstLabel: EmotionLabel;
}

/**
 * ① 第 1 名直取
 */
function pickTop1(sorted: readonly ScoredCandidate[]): ScoredCandidate[] {
  return [sorted[0]!];
}

/**
 * ② Top 10 内选与第 1 名情绪标签不同的 2 首(约束满足则取)
 */
function pickEmotionDiverse(core: ScoredCandidate[], ctx: CoreSelectionCtx): ScoredCandidate[] {
  const topCandidates = ctx.sorted.slice(1, Math.min(10, ctx.sorted.length));
  for (const cand of topCandidates) {
    if (core.length >= 3) break;
    const label = findNearestEmotionLabel(cand.song.va);
    if (label === ctx.firstLabel) continue;
    if (checkCoreDiversityConstraints(core, cand).passes) {
      core.push(cand);
    }
  }
  return core;
}

/**
 * ③ 补足热歌层(至少 CORE_MIN_HOT_COUNT 首)
 */
function ensureHotMinimum(core: ScoredCandidate[], ctx: CoreSelectionCtx): ScoredCandidate[] {
  while (
    core.filter((s) => s.song.layer === 'hot').length < CORE_MIN_HOT_COUNT &&
    core.length < TARGET_CORE_SIZE - 1
  ) {
    const nextHot = ctx.sorted.find(
      (c) => c.song.layer === 'hot' && !core.includes(c) && checkCoreDiversityConstraints(core, c).passes,
    );
    if (nextHot) core.push(nextHot);
    else break;
  }
  return core;
}

/**
 * ④ 探索曲(ε-贪婪):从非偏好风格池随机选 1 首
 */
function pickExplore(
  core: ScoredCandidate[],
  ctx: CoreSelectionCtx,
  input: RecommendInput,
): ScoredCandidate | undefined {
  const epsilon = input.exploreEpsilon ?? EXPLORE_EPSILON;
  if (Math.random() >= epsilon || core.length >= TARGET_CORE_SIZE) return undefined;

  const preferredGenres = new Set(
    (Object.keys(input.userPref.genreWeights) as Array<keyof typeof input.userPref.genreWeights>).filter(
      (g) => input.userPref.genreWeights[g] >= 1.0,
    ),
  );
  const nonPreferredPool = ctx.sorted.filter(
    (c) =>
      !core.includes(c) &&
      !c.song.genres.some((g) => preferredGenres.has(g as never)) &&
      checkCoreDiversityConstraints(core, c).passes,
  );
  if (nonPreferredPool.length === 0) return undefined;

  const midIdx = Math.floor(nonPreferredPool.length / 2);
  const pool = nonPreferredPool.slice(midIdx, Math.min(midIdx + 10, nonPreferredPool.length));
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * ⑤ 剩余位置按分补足(预留探索曲位置)
 */
function fillRemaining(
  core: ScoredCandidate[],
  ctx: CoreSelectionCtx,
  exploreTrack: ScoredCandidate | undefined,
): ScoredCandidate[] {
  const slotCount = TARGET_CORE_SIZE - (exploreTrack ? 1 : 0);
  while (core.length < slotCount) {
    const next = ctx.sorted.find(
      (c) => !core.includes(c) && c !== exploreTrack && checkCoreDiversityConstraints(core, c).passes,
    );
    if (next) core.push(next);
    else break;
  }
  return core;
}

/**
 * ⑥ 全局约束校验 + 修补(热歌不足则替换非热歌)
 */
function validateAndPatchCore(
  core: ScoredCandidate[],
  ctx: CoreSelectionCtx,
): ScoredCandidate[] {
  const validation = validateCoreGlobalConstraints(core);
  if (validation.valid) return core;

  while (
    core.filter((s) => s.song.layer === 'hot').length < CORE_MIN_HOT_COUNT &&
    core.length < TARGET_CORE_SIZE
  ) {
    const nextHot = ctx.sorted.find((c) => c.song.layer === 'hot' && !core.includes(c));
    if (!nextHot) break;
    const nonHotIdx = core.findIndex((c) => c.song.layer !== 'hot');
    if (nonHotIdx >= 0 && nonHotIdx > 0) {
      core[nonHotIdx] = nextHot;
    } else {
      break;
    }
  }
  return core;
}

/**
 * 贪心多样化选 8 首核心曲(编排主函数)
 *
 * 流水线:
 *   ① pickTop1 → ② pickEmotionDiverse → ③ ensureHotMinimum
 *   → ④ pickExplore → ⑤ fillRemaining → 插入探索曲 → ⑥ validateAndPatchCore
 */
function selectCoreTracks(
  sorted: readonly ScoredCandidate[],
  input: RecommendInput,
): { core: ScoredCandidate[]; exploreTrack?: ScoredCandidate } {
  if (sorted.length === 0) return { core: [] };

  const firstLabel = findNearestEmotionLabel(sorted[0]!.song.va);
  const ctx: CoreSelectionCtx = { sorted, firstLabel };

  // ①~③ 流水线
  let core = pickTop1(sorted);
  core = pickEmotionDiverse(core, ctx);
  core = ensureHotMinimum(core, ctx);

  // ④ 探索曲
  const exploreTrack = pickExplore(core, ctx, input);

  // ⑤ 补足
  core = fillRemaining(core, ctx, exploreTrack);

  // 插入探索曲到第 6 位
  if (exploreTrack) {
    const insertIdx = Math.min(EXPLORE_TRACK_POSITION - 1, core.length);
    core.splice(insertIdx, 0, exploreTrack);
  }

  // ⑥ 校验修补
  core = validateAndPatchCore(core, ctx);

  return { core, exploreTrack };
}

// ============================================================================
// 阶段 2:风格扩展
// ============================================================================

/** 扩展候选(带相似度与得分) */
interface ExtendCandidate {
  song: Song;
  sourceSongId: string;
  similarity: number;
  breakdown: ReturnType<typeof calcMatchScore>;
  expScore: number;
}

/**
 * 为单个核心曲生成扩展候选
 */
function generateExtendCandidatesForSource(
  source: Song,
  songLibrary: readonly Song[],
  input: RecommendInput,
  alreadySelectedIds: Set<string>,
  useLoose: boolean = false,
): ExtendCandidate[] {
  const simThreshold = useLoose ? EXTEND_SIM_THRESHOLD_LOOSE : EXTEND_SIM_THRESHOLD;
  const vaDistMax = useLoose ? EXTEND_VA_DISTANCE_LOOSE : EXTEND_VA_DISTANCE_MAX;

  const ctx: MatchContext = {
    photoVA: input.photoEmotion,
    photoEmotionLabel: findNearestEmotionLabel(input.photoEmotion),
    photoScene: input.photoScene,
    userPref: input.userPref,
    referenceSongs: input.referenceSongs,
    isColdStart: input.userPref.isColdStart,
  };

  const candidates: ExtendCandidate[] = [];

  for (const song of songLibrary) {
    // 排除已选
    if (alreadySelectedIds.has(song.songId)) continue;
    // 排除源曲自己
    if (song.songId === source.songId) continue;
    // 排除同歌手(除非源曲是独立音乐人寡头)
    if (song.artist === source.artist) continue;
    // 置信度下限
    if (song.va.confidence < EXTEND_VA_CONFIDENCE_MIN) continue;

    // 相似度计算
    const similarity = calcExtendSimilarity(source, song);
    if (similarity < simThreshold) continue;

    // V-A 距离上限(防跑偏,比阶段 1 严)
    const vaDist = calcVADistance(input.photoEmotion, song.va);
    if (vaDist > vaDistMax) continue;

    // 计算匹配分
    const breakdown = calcMatchScore(song, ctx);
    const expScore = calcExtendScore(similarity, breakdown.finalScore);

    candidates.push({
      song,
      sourceSongId: source.songId,
      similarity,
      breakdown,
      expScore,
    });
  }

  // 按 expScore 降序
  candidates.sort((a, b) => b.expScore - a.expScore);
  return candidates;
}

/**
 * 同源扩展内部多样化
 * 同源扩展的 k 首互相之间 genre Jaccard ≤ 0.5
 */
function filterSameSourceDiversity(
  candidates: readonly ExtendCandidate[],
  maxCount: number,
): ExtendCandidate[] {
  const selected: ExtendCandidate[] = [];
  for (const cand of candidates) {
    if (selected.length >= maxCount) break;
    // 检查与已选的 genre Jaccard
    const hasHighOverlap = selected.some(
      (s) => jaccardSimilarity(s.song.genres, cand.song.genres) > EXTEND_SAME_SOURCE_GENRE_JACCARD_MAX,
    );
    if (!hasHighOverlap) {
      selected.push(cand);
    }
  }
  return selected;
}

/**
 * 阶段 2:为 8 首核心曲生成扩展
 */
function generateExtendedTracks(
  coreTracks: readonly ScoredCandidate[],
  input: RecommendInput,
  coreIds: Set<string>,
): ExtendCandidate[] {
  const allExtended: ExtendCandidate[] = [];
  const selectedExtendIds = new Set<string>();

  // 按核心曲排名分配配额
  for (let i = 0; i < coreTracks.length; i++) {
    const source = coreTracks[i]!;
    const quota = EXTEND_QUOTA_BY_RANK[i] ?? 1;

    // 生成候选(先严格,不足则宽松)
    let candidates = generateExtendCandidatesForSource(
      source.song,
      input.songLibrary,
      input,
      new Set([...coreIds, ...selectedExtendIds]),
      false,
    );
    if (candidates.length < quota) {
      candidates = generateExtendCandidatesForSource(
        source.song,
        input.songLibrary,
        input,
        new Set([...coreIds, ...selectedExtendIds]),
        true,
      );
    }

    // 同源多样化
    const selected = filterSameSourceDiversity(candidates, quota);
    for (const ext of selected) {
      if (!selectedExtendIds.has(ext.song.songId)) {
        allExtended.push(ext);
        selectedExtendIds.add(ext.song.songId);
      }
    }
  }

  return allExtended;
}

// ============================================================================
// 全局多样化与数量兜底
// ============================================================================

/**
 * 全局多样化检查(8 核心 + 扩展)
 */
function applyGlobalDiversity(
  extended: readonly ExtendCandidate[],
  coreArtists: ReadonlySet<string>,
  coreLabels: ReadonlySet<EmotionLabel>,
): ExtendCandidate[] {
  const result: ExtendCandidate[] = [];
  const artistCounts = new Map<string, number>(Array.from(coreArtists).map((a) => [a, 1]));
  const labelCounts = new Map<EmotionLabel, number>(Array.from(coreLabels).map((l) => [l, 1]));

  for (const cand of extended) {
    const artist = cand.song.artist;
    const label = findNearestEmotionLabel(cand.song.va);

    const artistCount = artistCounts.get(artist) ?? 0;
    const labelCount = labelCounts.get(label) ?? 0;

    if (artistCount >= GLOBAL_MAX_SAME_ARTIST) continue;
    if (labelCount >= GLOBAL_MAX_SAME_LABEL) continue;

    result.push(cand);
    artistCounts.set(artist, artistCount + 1);
    labelCounts.set(label, labelCount + 1);
  }

  return result;
}

/**
 * 数量兜底:不足 15 首则从全库补足,超过 20 首则裁剪
 *
 * 补足策略:从兜底层按 V-A 距离补到 15 首
 */
function adjustTotalCount(
  core: readonly ScoredCandidate[],
  extended: readonly ExtendCandidate[],
  input: RecommendInput,
  alreadySelectedIds: Set<string>,
): { core: ScoredCandidate[]; extended: ExtendCandidate[] } {
  const total = core.length + extended.length;

  // 不足:从全库按 V-A 距离补足到 15 首
  if (total < FINAL_TOTAL_MIN) {
    const need = FINAL_TOTAL_MIN - total;
    // 从全库找 V-A 距离最近的、未选过的歌
    const candidates = input.songLibrary
      .filter((s) => !alreadySelectedIds.has(s.songId))
      .map((song) => ({
        song,
        distance: calcVADistance(input.photoEmotion, song.va),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, need);

    // 转换为 ExtendCandidate 格式
    const ctx: MatchContext = {
      photoVA: input.photoEmotion,
      photoEmotionLabel: findNearestEmotionLabel(input.photoEmotion),
      photoScene: input.photoScene,
      userPref: input.userPref,
      referenceSongs: input.referenceSongs,
      isColdStart: input.userPref.isColdStart,
    };

    const padded: ExtendCandidate[] = candidates.map((c) => {
      const breakdown = calcMatchScore(c.song, ctx);
      return {
        song: c.song,
        sourceSongId: 'fallback_pad',
        similarity: 0,
        breakdown,
        expScore: breakdown.finalScore,
      };
    });

    return { core: [...core], extended: [...extended, ...padded] };
  }

  // 超过:裁剪扩展(按 expScore 从低到高砍)
  if (total > FINAL_TOTAL_MAX) {
    const sortedExtended = [...extended].sort((a, b) => b.expScore - a.expScore);
    const keepCount = FINAL_TOTAL_MAX - core.length;
    return { core: [...core], extended: sortedExtended.slice(0, Math.max(0, keepCount)) };
  }

  return { core: [...core], extended: [...extended] };
}

// ============================================================================
// 转换为输出格式
// ============================================================================

/** ScoredCandidate → RecommendedTrack */
function toRecommendedTrack(
  scored: ScoredCandidate,
  source: 'core',
  isExplore: boolean,
): RecommendedTrack {
  return {
    song: scored.song,
    breakdown: scored.breakdown,
    source,
    isExplore,
  };
}

/** ExtendCandidate → RecommendedTrack */
function toExtendedRecommendedTrack(ext: ExtendCandidate): RecommendedTrack {
  return {
    song: ext.song,
    breakdown: ext.breakdown,
    source: 'extended',
    extendedFromSongId: ext.sourceSongId,
    similarityToSource: ext.similarity,
    isExplore: false,
  };
}

/** 构建元信息 */
function buildMeta(
  core: readonly RecommendedTrack[],
  extended: readonly RecommendedTrack[],
  candidatePoolSize: number,
  hasExplore: boolean,
): RecommendationMeta {
  const all = [...core, ...extended];
  const sourceBreakdown = {
    hot: all.filter((t) => t.song.layer === 'hot').length,
    emotion: all.filter((t) => t.song.layer === 'emotion').length,
    fallback: all.filter((t) => t.song.layer === 'fallback').length,
  };
  return {
    total: all.length,
    sourceBreakdown,
    exploreFlag: hasExplore,
    candidatePoolSize,
    algorithmVersion: '0.1.0',
  };
}

// ============================================================================
// 推荐主入口
// ============================================================================

/**
 * 两阶段推荐主流程
 *
 * @param input 推荐输入
 * @returns 推荐结果(8 核心 + 7-12 扩展)
 */
export function recommend(input: RecommendInput): RecommendationResult {
  // 阶段 1:候选池过滤
  const poolResult = filterCandidatePool(
    input.songLibrary,
    input.photoEmotion,
    CANDIDATE_POOL_VA_DISTANCE,
    CANDIDATE_POOL_VA_DISTANCE_LOOSE,
    CANDIDATE_POOL_MIN_SIZE,
  );
  const candidatePool = poolResult.candidates;

  // 阶段 1:主分排序
  const sorted = scoreAndSortCandidates(input, candidatePool);

  // 阶段 1:多样化选 8 首
  const { core: coreScored, exploreTrack } = selectCoreTracks(sorted, input);

  // 阶段 2:扩展
  const coreIds = new Set(coreScored.map((s) => s.song.songId));
  const extendedRaw = generateExtendedTracks(coreScored, input, coreIds);

  // 全局多样化
  const coreArtists = new Set(coreScored.map((s) => s.song.artist));
  const coreLabels = new Set(coreScored.map((s) => findNearestEmotionLabel(s.song.va)));
  const extendedFiltered = applyGlobalDiversity(extendedRaw, coreArtists, coreLabels);

  // 数量调整(含不足兜底补足)
  const allSelectedIds = new Set([
    ...coreScored.map((s) => s.song.songId),
    ...extendedFiltered.map((e) => e.song.songId),
  ]);
  const { core: finalCore, extended: finalExtended } = adjustTotalCount(
    coreScored,
    extendedFiltered,
    input,
    allSelectedIds,
  );

  // 最终核心(可能被调整过)
  const finalCoreTracks: RecommendedTrack[] = finalCore.map((s) => {
    const isExplore = s === exploreTrack;
    return toRecommendedTrack(s, 'core', isExplore);
  });
  const finalExtendedTracks: RecommendedTrack[] = finalExtended.map(toExtendedRecommendedTrack);

  // 情绪标签解析
  const emotionResult = resolveEmotionLabels(input.photoEmotion);

  // 元信息
  const meta = buildMeta(
    finalCoreTracks,
    finalExtendedTracks,
    candidatePool.length,
    exploreTrack !== undefined,
  );

  return {
    photoEmotion: input.photoEmotion,
    primaryLabel: emotionResult.primary,
    secondaryLabel: emotionResult.secondary,
    isMixedEmotion: emotionResult.isMixed,
    gpsUsed: input.photoEmotion.source === 'gps_fusion',
    lowConfidence: input.photoEmotion.confidence < CONFLICT_CONFIDENCE_LOW,
    coreTracks: finalCoreTracks,
    extendedTracks: finalExtendedTracks,
    meta,
  };
}
