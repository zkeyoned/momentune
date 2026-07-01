/**
 * 算法通用工具函数
 *
 * 包含:数值钳制、V-A 距离/相似度、情绪标签锚定、归一化等
 * 所有核心模块共享
 *
 * @module algorithm/utils
 */

import { EMOTION_VA_COORDINATES } from './config/emotionLabels.js';
import { VA_DISTANCE_WEIGHTS, MIXED_EMOTION_RADIUS, SECONDARY_LABEL_RADIUS, EXACT_ANCHOR_EPSILON, TEMPO_NORM_RANGE, LOUDNESS_NORM_RANGE, HOT_RECENCY_DECAY_DAYS } from './config/thresholds.js';
import type { EmotionLabel, VACoordinate } from './types.js';

// ============================================================================
// 1. 数值工具
// ============================================================================

/** 钳制到 [min, max] */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** 钳制到 [0, 1] */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** 线性归一化:[inMin, inMax] → [0, 1] */
export function normalizeLinear(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) return 0;
  return clamp01((value - inMin) / (inMax - inMin));
}

/** BPM 归一化:60-180 → 0-1 */
export function normalizeTempo(bpm: number): number {
  return normalizeLinear(bpm, TEMPO_NORM_RANGE.min, TEMPO_NORM_RANGE.max);
}

/** 响度归一化:-30~0 dB → 0-1 */
export function normalizeLoudness(db: number): number {
  return normalizeLinear(db, LOUDNESS_NORM_RANGE.min, LOUDNESS_NORM_RANGE.max);
}

// ============================================================================
// 2. V-A 距离与相似度
// ============================================================================

/**
 * V-A 加权欧氏距离
 * V 不匹配比 A 不匹配更难受,故 V 权重略高
 *
 * distance = sqrt(0.6 × ΔV² + 0.4 × ΔA²)
 * 取值范围 [0, 1]
 */
export function calcVADistance(a: VACoordinate, b: VACoordinate): number {
  const dv = a.v - b.v;
  const da = a.a - b.a;
  return Math.sqrt(VA_DISTANCE_WEIGHTS.v * dv * dv + VA_DISTANCE_WEIGHTS.a * da * da);
}

/**
 * V-A 相似度(基于加权欧氏距离)
 * score_va = 1 - distance
 * 取值范围 [0, 1],越大越相似
 */
export function calcVASimilarity(a: VACoordinate, b: VACoordinate): number {
  return 1 - calcVADistance(a, b);
}

// ============================================================================
// 3. 情绪标签锚定
// ============================================================================

/** 所有 16 标签的 (label, VA) 数组(便于遍历) */
const LABEL_VA_ENTRIES = Object.entries(EMOTION_VA_COORDINATES) as Array<[EmotionLabel, VACoordinate]>;

/**
 * 找最近的情绪标签
 * label = argmin_k sqrt((V - V_k)² + (A - A_k)²)
 */
export function findNearestEmotionLabel(va: VACoordinate): EmotionLabel {
  let nearest: EmotionLabel = 'Healing';
  let minDist = Infinity;
  for (const [label, labelVA] of LABEL_VA_ENTRIES) {
    const dist = calcVADistance(va, labelVA);
    if (dist < minDist) {
      minDist = dist;
      nearest = label;
    }
  }
  return nearest;
}

/**
 * 找最近的 N 个情绪标签(按距离升序)
 */
export function findNearestEmotionLabels(va: VACoordinate, n: number): Array<{ label: EmotionLabel; distance: number }> {
  const entries = LABEL_VA_ENTRIES.map(([label, labelVA]) => ({
    label,
    distance: calcVADistance(va, labelVA),
  }));
  entries.sort((x, y) => x.distance - y.distance);
  return entries.slice(0, n);
}

/**
 * 判定混合情绪
 * 当照片 V-A 距最近两标签都 < MIXED_EMOTION_RADIUS 时,标记为混合情绪
 *
 * 例外:当 V-A 精确命中某锚点(primaryDist < EXACT_ANCHOR_EPSILON)时,
 * 即使附近有其他标签也不判为混合(避免标签密度增加后锚点本身被判混合)
 *
 * @returns { primary, secondary, isMixed }
 */
export function resolveEmotionLabels(va: VACoordinate): {
  primary: EmotionLabel;
  secondary?: EmotionLabel;
  isMixed: boolean;
} {
  const nearest2 = findNearestEmotionLabels(va, 2);
  const primary = nearest2[0]!.label;
  const primaryDist = nearest2[0]!.distance;
  const secondary = nearest2[1]?.label;
  const secondaryDist = nearest2[1]?.distance;

  // 精确命中锚点:距离极小则视为"就是该标签",不判混合
  const isExactAnchor = primaryDist < EXACT_ANCHOR_EPSILON;

  // 混合情绪:非精确命中且最近两标签距离都 < MIXED_EMOTION_RADIUS
  const isMixed = !isExactAnchor
    && primaryDist < MIXED_EMOTION_RADIUS
    && secondaryDist !== undefined
    && secondaryDist < MIXED_EMOTION_RADIUS;

  // 次要标签附加考虑:距离 < SECONDARY_LABEL_RADIUS
  const shouldConsiderSecondary = !isMixed && secondaryDist !== undefined && secondaryDist < SECONDARY_LABEL_RADIUS;

  return {
    primary,
    secondary: isMixed || shouldConsiderSecondary ? secondary : undefined,
    isMixed,
  };
}

// ============================================================================
// 4. 集合相似度
// ============================================================================

/** Jaccard 相似度 */
export function jaccardSimilarity<T>(setA: readonly T[], setB: readonly T[]): number {
  if (setA.length === 0 && setB.length === 0) return 1;
  if (setA.length === 0 || setB.length === 0) return 0;
  const a = new Set(setA);
  const b = new Set(setB);
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** 余弦相似度(数值向量) */
export function cosineSimilarity(vecA: readonly number[], vecB: readonly number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i]!;
    const b = vecB[i]!;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ============================================================================
// 5. 时间工具
// ============================================================================

/** 判断是否深夜时段(22:00-05:00) */
export function isLateNight(hour: number): boolean {
  return hour >= 22 || hour < 5;
}

/** 两个时段是否相近(相差不超过 2 小时) */
export function isHourClose(h1: number, h2: number): boolean {
  const diff = Math.abs(h1 - h2);
  return diff <= 2 || diff >= 22; // 跨午夜
}

/** 获取当前小时的归一化(0-1) */
export function normalizeHour(hour: number): number {
  return hour / 23;
}

// ============================================================================
// 6. 日期工具
// ============================================================================

/** 距今天数(date 为时间戳) */
export function daysSince(timestamp: number, now: number = Date.now()): number {
  return (now - timestamp) / (1000 * 60 * 60 * 24);
}

/** 热歌新鲜度衰减系数:exp(-Δdays / HOT_RECENCY_DECAY_DAYS) */
export function calcHotRecencyDecay(daysSinceListed: number): number {
  return Math.exp(-daysSinceListed / HOT_RECENCY_DECAY_DAYS);
}
