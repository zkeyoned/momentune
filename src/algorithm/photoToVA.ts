/**
 * 照片视觉特征 → V-A 坐标映射
 *
 * 对应算法设计文档「第 1 部分:照片→V-A 坐标映射」
 *
 * 流程:
 * 1. 8 个视觉特征各自查询 V-A 贡献表
 * 2. 按 w_i 权重 + 方向调节系数 α_i 做非对称融合
 * 3. 归一化(确保 Σ w_i·α_i = 1)
 * 4. 输出 V-A 坐标 + 整体置信度
 *
 * 关键设计:
 * - V 方向对色彩/亮度更敏感(α > 1)
 * - A 方向对饱和度/人物更敏感(α > 1)
 * - 整体置信度 = 各特征置信度的加权均值
 *
 * @module algorithm/photoToVA
 */

import {
  HUE_VA_MAP,
  GRAYSCALE_VA,
  LUMINANCE_VA_MAP,
  SATURATION_VA_MAP,
  SCENE_VA_MAP,
  TIME_OF_DAY_VA_MAP,
  WEATHER_VA_MAP,
  COMPOSITION_VA_MAP,
  getPeopleVA,
  FEATURE_WEIGHTS,
  FEATURE_DIRECTION_COEFFICIENTS,
  type FeatureKey,
} from './config/featureWeights.js';
import { GRAYSCALE_SAT_THRESHOLD } from './config/thresholds.js';
import { clamp01 } from './utils.js';
import type {
  BrightnessLevel,
  Composition,
  FaceEmotion,
  PhotoFeatures,
  SaturationLevel,
  SceneType,
  TimeOfDay,
  Tone,
  VACoordinate,
  VAWithConfidence,
  Weather,
} from './types.js';

// ============================================================================
// 1. 单特征 V-A 贡献查询
// ============================================================================

/** F1:主色调 hue → V-A(支持灰阶判定) */
function queryHueVA(hue: number, tone: Tone, saturation: number): VACoordinate {
  // 灰阶判定
  if (saturation < GRAYSCALE_SAT_THRESHOLD || tone === 'neutral') {
    return { ...GRAYSCALE_VA };
  }
  // 归一化 hue 到 [0, 360)
  const h = ((hue % 360) + 360) % 360;
  // hue 区间匹配(左闭右开,避免边界重叠)
  for (const entry of HUE_VA_MAP) {
    const [lo, hi] = entry.range;
    // 对于 [330, 360] 这种跨越边界的区间,特殊处理
    if (lo > hi) {
      // 跨越 0 度的区间(如 [330, 30])
      if (h >= lo || h < hi) {
        return { ...entry.va };
      }
    } else {
      // 普通区间:左闭右开
      if (h >= lo && h < hi) {
        return { ...entry.va };
      }
    }
  }
  // 处理 hue === 360(归一化后为 0,应该匹配 [0, 30])
  // 已在循环中处理
  // 兜底:中性
  return { v: 0.50, a: 0.40 };
}

/** F2:亮度 → V-A */
function queryLuminanceVA(level: BrightnessLevel): VACoordinate {
  const entry = LUMINANCE_VA_MAP[level];
  return { v: entry.v, a: entry.a };
}

/** F3:饱和度 → V-A */
function querySaturationVA(level: SaturationLevel): VACoordinate {
  const entry = SATURATION_VA_MAP[level];
  return { v: entry.v, a: entry.a };
}

/** F4:场景 → V-A */
function querySceneVA(scene: SceneType): VACoordinate {
  const entry = SCENE_VA_MAP[scene];
  return { v: entry.v, a: entry.a };
}

/** F5:时段 → V-A */
function queryTimeOfDayVA(time: TimeOfDay): VACoordinate {
  const entry = TIME_OF_DAY_VA_MAP[time];
  return { v: entry.v, a: entry.a };
}

/** F6:天气 → V-A */
function queryWeatherVA(weather: Weather): VACoordinate {
  const entry = WEATHER_VA_MAP[weather];
  return { v: entry.v, a: entry.a };
}

/** F7:人物 → V-A */
function queryPeopleVA(count: number, emotion: FaceEmotion): VACoordinate {
  return getPeopleVA(count, emotion);
}

/** F8:构图 → V-A */
function queryCompositionVA(composition: Composition): VACoordinate {
  const entry = COMPOSITION_VA_MAP[composition];
  return { v: entry.v, a: entry.a };
}

// ============================================================================
// 2. 8 特征融合(核心公式)
// ============================================================================

/**
 * 8 特征融合 → V-A 坐标
 *
 * 公式:
 *   V_photo = Σ w_i × α_i(V) × V_i  /  Σ w_i × α_i(V)
 *   A_photo = Σ w_i × α_i(A) × A_i  /  Σ w_i × α_i(A)
 *
 * 分母做归一化,确保权重和为 1
 *
 * @param features 视觉模型输出的 8 特征
 * @returns V-A 坐标(已融合,未含 GPS)
 */
export function fuseFeaturesToVA(features: PhotoFeatures): VACoordinate {
  // 各特征的 V-A 贡献
  const contributions: Record<FeatureKey, VACoordinate> = {
    hue: queryHueVA(features.hue.hue, features.hue.tone, features.saturation.value),
    luminance: queryLuminanceVA(features.luminance.level),
    saturation: querySaturationVA(features.saturation.level),
    scene: querySceneVA(features.scene.type),
    timeOfDay: queryTimeOfDayVA(features.timeOfDay.value),
    weather: queryWeatherVA(features.weather.value),
    people: queryPeopleVA(features.people.count, features.people.dominantEmotion),
    composition: queryCompositionVA(features.composition.type),
  };

  // 加权融合(方向调节系数归一化)
  let vSum = 0;
  let aSum = 0;
  let vWeightSum = 0;
  let aWeightSum = 0;

  const featureKeys = Object.keys(FEATURE_WEIGHTS) as FeatureKey[];
  for (const key of featureKeys) {
    const w = FEATURE_WEIGHTS[key];
    const alphaV = FEATURE_DIRECTION_COEFFICIENTS[key].v;
    const alphaA = FEATURE_DIRECTION_COEFFICIENTS[key].a;
    const contrib = contributions[key];

    const wv = w * alphaV;
    const wa = w * alphaA;

    vSum += wv * contrib.v;
    aSum += wa * contrib.a;
    vWeightSum += wv;
    aWeightSum += wa;
  }

  const v = vWeightSum > 0 ? vSum / vWeightSum : 0.5;
  const a = aWeightSum > 0 ? aSum / aWeightSum : 0.4;

  return {
    v: clamp01(v),
    a: clamp01(a),
  };
}

// ============================================================================
// 3. 整体置信度计算
// ============================================================================

/**
 * 计算 8 特征的整体置信度(加权均值)
 * 若视觉模型已给出 overallConfidence,直接使用;否则按各特征置信度加权计算
 */
export function calcOverallConfidence(features: PhotoFeatures): number {
  if (features.overallConfidence > 0) {
    return clamp01(features.overallConfidence);
  }
  // 按权重计算各特征置信度的加权均值
  const items: Array<{ weight: number; confidence: number }> = [
    { weight: FEATURE_WEIGHTS.hue, confidence: features.hue.confidence },
    { weight: FEATURE_WEIGHTS.luminance, confidence: features.luminance.confidence },
    { weight: FEATURE_WEIGHTS.saturation, confidence: features.saturation.confidence },
    { weight: FEATURE_WEIGHTS.scene, confidence: features.scene.confidence },
    { weight: FEATURE_WEIGHTS.timeOfDay, confidence: features.timeOfDay.confidence },
    { weight: FEATURE_WEIGHTS.weather, confidence: features.weather.confidence },
    { weight: FEATURE_WEIGHTS.people, confidence: features.people.confidence },
    { weight: FEATURE_WEIGHTS.composition, confidence: features.composition.confidence },
  ];
  let sum = 0;
  let weightSum = 0;
  for (const item of items) {
    sum += item.weight * item.confidence;
    weightSum += item.weight;
  }
  return weightSum > 0 ? clamp01(sum / weightSum) : 0.5;
}

// ============================================================================
// 4. 主入口:照片 → V-A
// ============================================================================

/**
 * 照片视觉特征 → V-A 坐标(纯视觉,不含 GPS)
 *
 * @param features 视觉模型输出的 8 特征
 * @returns V-A 坐标 + 置信度 + 来源标记
 */
export function photoToVA(features: PhotoFeatures): VAWithConfidence {
  const va = fuseFeaturesToVA(features);
  const confidence = calcOverallConfidence(features);
  return {
    v: va.v,
    a: va.a,
    confidence,
    source: 'feature_fusion',
  };
}
