/**
 * 用户偏好建模
 *
 * 对应算法设计文档「第 5 部分:用户偏好建模」
 *
 * 包含:
 * 1. 首次问卷 → 偏好向量(中心点 + 风格/语言/平台权重)
 * 2. 参考歌曲 → 偏好中心
 * 3. EMA 持续学习(跳过降权/循环升权/保存高匹配)
 * 4. 时段偏好(无感建模)
 * 5. 冷启动判断与策略
 *
 * @module algorithm/preference
 */

import { MOOD_PREFERENCE_ANCHOR, EMOTION_VA_COORDINATES } from './config/emotionLabels.js';
import {
  PREF_CENTER_INIT_WEIGHTS,
  PREF_DEFAULT_GENRE_WEIGHT,
  PREF_SELECTED_GENRE_WEIGHT,
  PREF_ANY_GENRE_WEIGHT,
  PREF_EMA_LAMBDA,
  PREF_CENTER_DRIFT_MU,
  PREF_UPDATE_RATES,
  PREF_WEIGHT_CLAMP,
  COLD_START_INTERACTIONS,
  HOURLY_EMOTION_BIAS_THRESHOLD,
  HOURLY_EMOTION_BONUS,
  HOURLY_MIN_SAMPLES,
} from './config/thresholds.js';
import type { Song } from './types.js';
import {
  type EmotionLabel,
  type GenreTag,
  type GenreWeightVector,
  type InteractionEvent,
  type InteractionSignal,
  type LanguageTag,
  type LanguageWeightVector,
  type MoodPreference,
  type OnboardingAnswers,
  type UserPreference,
  type VACoordinate,
  GENRE_TAGS,
  LANGUAGE_TAGS,
} from './types.js';
import { calcVASimilarity, clamp, clamp01 } from './utils.js';

// ============================================================================
// 1. 风格/语言权重向量初始化
// ============================================================================

/** 全部风格默认权重 */
export function createDefaultGenreWeights(weight: number = PREF_DEFAULT_GENRE_WEIGHT): GenreWeightVector {
  const vec = {} as GenreWeightVector;
  for (const g of GENRE_TAGS) {
    vec[g] = weight;
  }
  return vec;
}

/** 全部语言默认权重 */
export function createDefaultLanguageWeights(weight: number = 0.5): LanguageWeightVector {
  const vec = {} as LanguageWeightVector;
  for (const l of LANGUAGE_TAGS) {
    vec[l] = weight;
  }
  return vec;
}

/**
 * 根据用户问卷选择初始化风格权重
 * - 选中 → 1.0
 * - 未选 → 0.3(保留探索)
 * - "不限"(空数组) → 全部 0.7
 */
export function initGenreWeights(selectedGenres: readonly GenreTag[]): GenreWeightVector {
  const vec = createDefaultGenreWeights(PREF_DEFAULT_GENRE_WEIGHT);
  if (selectedGenres.length === 0) {
    // 不限:全部 0.7
    for (const g of GENRE_TAGS) {
      vec[g] = PREF_ANY_GENRE_WEIGHT;
    }
    return vec;
  }
  for (const g of selectedGenres) {
    vec[g] = PREF_SELECTED_GENRE_WEIGHT;
  }
  return vec;
}

/** 根据用户问卷选择初始化语言权重 */
export function initLanguageWeights(selectedLanguages: readonly LanguageTag[]): LanguageWeightVector {
  const vec = createDefaultLanguageWeights(0.3);
  if (selectedLanguages.length === 0) {
    for (const l of LANGUAGE_TAGS) {
      vec[l] = PREF_ANY_GENRE_WEIGHT;
    }
    return vec;
  }
  for (const l of selectedLanguages) {
    vec[l] = 1.0;
  }
  return vec;
}

// ============================================================================
// 2. 首次问卷 → 偏好中心
// ============================================================================

/**
 * 参考歌曲 → 偏好中心点(V-A 质心)
 *
 * 若参考歌有 V-A 标注:取质心
 * 若无:只用情绪偏好锚点
 */
export function calcReferenceCenter(referenceSongs: readonly Song[]): VACoordinate | null {
  if (referenceSongs.length === 0) return null;
  let vSum = 0;
  let aSum = 0;
  let count = 0;
  for (const song of referenceSongs) {
    if (song.va.confidence > 0.3) {
      vSum += song.va.v;
      aSum += song.va.a;
      count++;
    }
  }
  if (count === 0) return null;
  return { v: vSum / count, a: aSum / count };
}

/**
 * 首次问卷答案 → 初始偏好中心
 *
 * (V_pref_0, A_pref_0) = 0.5 × (V_ref, A_ref) + 0.5 × (V_q3, A_q3)
 * 无参考歌 → 1.0 × (V_q3, A_q3)
 */
export function calcInitialPrefCenter(
  referenceCenter: VACoordinate | null,
  mood: MoodPreference,
): VACoordinate {
  const moodAnchor = MOOD_PREFERENCE_ANCHOR[mood] ?? { v: 0.5, a: 0.4 };
  if (referenceCenter) {
    return {
      v: PREF_CENTER_INIT_WEIGHTS.reference * referenceCenter.v + PREF_CENTER_INIT_WEIGHTS.mood * moodAnchor.v,
      a: PREF_CENTER_INIT_WEIGHTS.reference * referenceCenter.a + PREF_CENTER_INIT_WEIGHTS.mood * moodAnchor.a,
    };
  }
  return { ...moodAnchor };
}

// ============================================================================
// 3. 首次问卷 → 完整偏好模型
// ============================================================================

/**
 * 首次问卷答案 → 初始用户偏好模型
 *
 * @param answers 问卷答案
 * @param referenceSongs 参考歌曲完整对象(用于查 V-A)
 */
export function initUserPreference(
  answers: OnboardingAnswers,
  referenceSongs: readonly Song[],
): UserPreference {
  const referenceCenter = calcReferenceCenter(referenceSongs);
  const center = calcInitialPrefCenter(referenceCenter, answers.mood);
  const genreWeights = initGenreWeights(answers.genres);
  const languageWeights = initLanguageWeights(answers.languages);

  return {
    center,
    genreWeights,
    languageWeights,
    platform: answers.platform,
    referenceSongIds: referenceSongs.map((s) => s.songId),
    moodAnchor: MOOD_PREFERENCE_ANCHOR[answers.mood] ?? { v: 0.5, a: 0.4 },
    hourlyAcceptRate: new Array(24).fill(0.5),
    hourlyEmotionBias: new Array(24).fill(null),
    isColdStart: true,
    interactionCount: 0,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// 4. EMA 持续学习
// ============================================================================

/**
 * 风格权重更新(EMA)
 *
 * 信号 → 更新:
 * - skip    → W_c × (1 - α_skip),α_skip=0.05
 * - complete → W_c × (1 + 0.03)
 * - loop    → W_c × (1 + β_loop),β_loop=0.10
 * - save_diary → W_c × (1 + γ_save),γ_save=0.20
 *
 * 钳制:[0.1, 3.0]
 */
export function updateGenreWeights(
  current: GenreWeightVector,
  signal: InteractionSignal,
  songGenres: readonly GenreTag[],
): GenreWeightVector {
  const next = { ...current };
  const rate = PREF_UPDATE_RATES[signal];
  for (const g of songGenres) {
    const oldVal = next[g] ?? 1.0;
    let newVal: number;
    if (signal === 'skip') {
      // 降权
      newVal = oldVal * (1 - rate);
    } else {
      // 升权
      newVal = oldVal * (1 + rate);
    }
    next[g] = clamp(newVal, PREF_WEIGHT_CLAMP.min, PREF_WEIGHT_CLAMP.max);
  }
  return next;
}

/**
 * 语言权重更新(EMA,与风格同理)
 */
export function updateLanguageWeights(
  current: LanguageWeightVector,
  signal: InteractionSignal,
  songLanguage: LanguageTag,
): LanguageWeightVector {
  const next = { ...current };
  const rate = PREF_UPDATE_RATES[signal];
  const oldVal = next[songLanguage] ?? 1.0;
  let newVal: number;
  if (signal === 'skip') {
    newVal = oldVal * (1 - rate);
  } else {
    newVal = oldVal * (1 + rate);
  }
  next[songLanguage] = clamp(newVal, PREF_WEIGHT_CLAMP.min, PREF_WEIGHT_CLAMP.max);
  return next;
}

/**
 * 偏好中心漂移
 *
 * 用户接受(循环/保存)一首歌 → 中心向该歌靠拢
 * V_pref ← (1 - μ) × V_pref + μ × V_song, μ=0.05
 *
 * 仅在接受信号(loop/save_diary)时漂移
 */
export function driftPrefCenter(
  current: VACoordinate,
  songVA: VACoordinate,
  signal: InteractionSignal,
): VACoordinate {
  // 仅接受信号触发漂移
  if (signal !== 'loop' && signal !== 'save_diary') {
    return current;
  }
  return {
    v: (1 - PREF_CENTER_DRIFT_MU) * current.v + PREF_CENTER_DRIFT_MU * songVA.v,
    a: (1 - PREF_CENTER_DRIFT_MU) * current.a + PREF_CENTER_DRIFT_MU * songVA.a,
  };
}

// ============================================================================
// 5. 时段偏好
// ============================================================================

/**
 * 时段接受率直方图更新
 *
 * 简化:P(accept | hour) 的 EMA 更新
 * 接受(complete/loop/save) → 该小时接受率上调
 * 跳过(skip) → 该小时接受率下调
 */
export function updateHourlyAcceptRate(
  current: readonly number[],
  hour: number,
  signal: InteractionSignal,
): number[] {
  const next = [...current];
  if (hour < 0 || hour > 23) return next;
  const oldVal = next[hour] ?? 0.5;
  const isAccept = signal !== 'skip';
  const target = isAccept ? 1.0 : 0.0;
  // EMA: newVal = (1 - λ) × old + λ × target
  next[hour] = clamp01((1 - PREF_EMA_LAMBDA) * oldVal + PREF_EMA_LAMBDA * target);
  return next;
}

/**
 * 时段情绪偏置更新
 *
 * 统计每个小时各情绪标签的接受次数
 * 当某情绪占比 > 60% 时,标记为该时段的情绪偏置
 *
 * @param currentBias 当前偏置(24 维)
 * @param hour 小时
 * @param emotionLabel 情绪标签
 * @param hourlyEmotionCount 每小时情绪计数(外部维护)
 */
export function updateHourlyEmotionBias(
  currentBias: ReadonlyArray<EmotionLabel | null>,
  hour: number,
  _emotionLabel: EmotionLabel,
  hourlyEmotionCount: Array<Record<EmotionLabel, number>>,
): Array<EmotionLabel | null> {
  const next = [...currentBias];
  if (hour < 0 || hour > 23) return next;

  const counts = hourlyEmotionCount[hour];
  if (!counts) return next;

  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  if (total < HOURLY_MIN_SAMPLES) return next;

  // 找占比最高的情绪
  let maxLabel: EmotionLabel | null = null;
  let maxRatio = 0;
  for (const [label, count] of Object.entries(counts)) {
    const ratio = count / total;
    if (ratio > maxRatio) {
      maxRatio = ratio;
      maxLabel = label as EmotionLabel;
    }
  }

  // 占比 > 60% 才标记
  next[hour] = maxRatio >= HOURLY_EMOTION_BIAS_THRESHOLD ? maxLabel : null;
  return next;
}

/**
 * 获取某时段的情绪加成
 *
 * 若该时段有情绪偏置,且歌曲情绪标签匹配 → 加成 0.10
 */
export function getHourlyEmotionBonus(
  hourlyEmotionBias: ReadonlyArray<EmotionLabel | null>,
  hour: number,
  songEmotionLabel: EmotionLabel,
): number {
  if (hour < 0 || hour > 23) return 0;
  const bias = hourlyEmotionBias[hour];
  if (bias && bias === songEmotionLabel) {
    return HOURLY_EMOTION_BONUS;
  }
  return 0;
}

// ============================================================================
// 6. 完整偏好更新(单次交互)
// ============================================================================

/**
 * 处理一次用户交互,返回更新后的偏好模型
 *
 * 综合更新:
 * - 风格权重
 * - 语言权重
 * - 偏好中心漂移
 * - 时段接受率
 * - 交互次数(冷启动判断)
 */
export function processInteraction(
  current: UserPreference,
  event: InteractionEvent,
): UserPreference {
  const genreWeights = updateGenreWeights(current.genreWeights, event.signal, event.genres);
  const languageWeights = updateLanguageWeights(current.languageWeights, event.signal, event.language);
  const center = driftPrefCenter(current.center, event.songVA, event.signal);
  const hourlyAcceptRate = updateHourlyAcceptRate(current.hourlyAcceptRate, event.hour, event.signal);

  const interactionCount = current.interactionCount + 1;
  const isColdStart = interactionCount < COLD_START_INTERACTIONS;

  return {
    ...current,
    genreWeights,
    languageWeights,
    center,
    hourlyAcceptRate,
    interactionCount,
    isColdStart,
    updatedAt: event.timestamp,
  };
}

// ============================================================================
// 7. 冷启动辅助
// ============================================================================

/** 判断是否处于冷启动期 */
export function isColdStart(pref: UserPreference): boolean {
  return pref.interactionCount < COLD_START_INTERACTIONS;
}

/**
 * 冷启动期推荐策略
 *
 * 前 5 次:
 * - score_pref 降权到 0.08
 * - score_hot 加权 +0.07
 * - 15% 概率从"非偏好风格"随机抽 1 首作探索曲
 */
export function shouldExploreInColdStart(pref: UserPreference, epsilon: number = 0.15): boolean {
  if (!isColdStart(pref)) return Math.random() < epsilon;
  return Math.random() < epsilon;
}

// ============================================================================
// 8. 偏好导出与序列化
// ============================================================================

/** 偏好中心附近的情绪标签(用于推荐时偏好匹配) */
export function getPrefCenterEmotionLabel(pref: UserPreference): EmotionLabel {
  let nearest: EmotionLabel = 'Healing';
  let minDist = Infinity;
  for (const [label, va] of Object.entries(EMOTION_VA_COORDINATES) as Array<[EmotionLabel, VACoordinate]>) {
    const dist = Math.sqrt(
      (pref.center.v - va.v) ** 2 + (pref.center.a - va.a) ** 2,
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = label;
    }
  }
  return nearest;
}

/** 偏好中心 V-A 相似度(外部匹配用) */
export function calcPrefCenterSimilarity(pref: UserPreference, songVA: VACoordinate): number {
  return calcVASimilarity(pref.center, songVA);
}
