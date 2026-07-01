/**
 * GPS 辅助:视觉置信度低时用 GPS 反查补充
 *
 * 对应算法设计文档「第 2 部分:GPS 辅助逻辑」
 *
 * 流程:
 * 1. 视觉置信度 > 0.8 → 直接用视觉,GPS 仅作场景记录
 * 2. 0.5 ≤ 视觉置信度 ≤ 0.8 → 标准 0.7/0.3 融合
 * 3. 视觉置信度 < 0.5 且有 GPS → GPS 主导 0.3/0.7
 * 4. 视觉置信度 < 0.5 且无 GPS → 退回纯视觉(色调/时段/天气兜底)
 *
 * 冲突处理:
 * - 时间戳深夜修正(22:00-05:00,V 减 0.08,A 减 0.10)
 * - 冲突置信度 < 0.4 → 标记 low_confidence
 *
 * @module algorithm/gpsFallback
 */

import { findPOIMapping, POI_UNKNOWN_VA } from './config/poiMapping.js';
import { findLocationMusic } from './config/locationMusicMap.js';
import {
  VISUAL_CONFIDENCE_HIGH,
  VISUAL_CONFIDENCE_LOW,
  LATE_NIGHT_ADJUSTMENT,
  CONFLICT_CONFIDENCE_LOW,
} from './config/thresholds.js';
import { isLateNight } from './utils.js';
import type {
  GPSCoordinate,
  GPSReverseResult,
  POIInfo,
  SceneType,
  VACoordinate,
  VAWithConfidence,
} from './types.js';

// ============================================================================
// 1. GPS 反查(对外接口,实际 HTTP 请求由工程层实现)
// ============================================================================

/**
 * GPS 反查函数签名(工程层注入实现)
 *
 * 工程层应实现:
 * 1. 优先调用高德 Web API(extensions=all)
 * 2. 高德超时(>800ms)或失败 → 降级腾讯
 * 3. 海外 → 降级 OSM Nominatim
 */
export type GPSReverseFunction = (coord: GPSCoordinate) => Promise<GPSReverseResult | null>;

// ============================================================================
// 2. GPS → 场景 + V-A 映射
// ============================================================================

/**
 * 根据 POI 信息生成 GPS 反查结果
 * (供工程层在拿到高德/腾讯/OSM 原始数据后调用)
 */
export function buildGPSReverseResult(
  coordinate: GPSCoordinate,
  poi: POIInfo,
  provider: 'amap' | 'tencent' | 'osm',
): GPSReverseResult {
  const mapping = findPOIMapping(poi.typeCode, poi.name, poi.category);

  // 查询全球地点音乐映射(城市/地标级 + 场所类型级)
  const locMusic = findLocationMusic(poi.name, poi.category, poi.district);
  const locationMusic = (locMusic.location || locMusic.venue)
    ? { location: locMusic.location, venue: locMusic.venue }
    : undefined;

  if (mapping) {
    return {
      coordinate,
      poi,
      provider,
      mappedScene: mapping.scene,
      mappedVA: mapping.va,
      confidence: mapping.confidence,
      locationMusic,
    };
  }
  return {
    coordinate,
    poi,
    provider,
    mappedScene: undefined,
    mappedVA: { ...POI_UNKNOWN_VA },
    confidence: 0.4,
    locationMusic,
  };
}

// ============================================================================
// 3. 自适应权重融合
// ============================================================================

/** 自适应权重结果 */
export interface AdaptiveWeightResult {
  /** 视觉权重 */
  wVisual: number;
  /** GPS 权重 */
  wGps: number;
  /** 是否使用 GPS */
  gpsUsed: boolean;
  /** 策略说明 */
  strategy: 'visual_only' | 'standard_fusion' | 'gps_dominant' | 'visual_fallback';
}

/**
 * 根据视觉置信度决定融合权重
 */
export function resolveAdaptiveWeights(
  visualConfidence: number,
  hasGps: boolean,
): AdaptiveWeightResult {
  // 视觉够准
  if (visualConfidence > VISUAL_CONFIDENCE_HIGH) {
    return { wVisual: 1.0, wGps: 0.0, gpsUsed: false, strategy: 'visual_only' };
  }
  // 视觉置信度低
  if (visualConfidence < VISUAL_CONFIDENCE_LOW) {
    if (hasGps) {
      return { wVisual: 0.3, wGps: 0.7, gpsUsed: true, strategy: 'gps_dominant' };
    }
    return { wVisual: 1.0, wGps: 0.0, gpsUsed: false, strategy: 'visual_fallback' };
  }
  // 中等置信度:标准融合
  if (hasGps) {
    return { wVisual: 0.7, wGps: 0.3, gpsUsed: true, strategy: 'standard_fusion' };
  }
  return { wVisual: 1.0, wGps: 0.0, gpsUsed: false, strategy: 'visual_only' };
}

// ============================================================================
// 4. 视觉 + GPS 融合
// ============================================================================

/** 融合输入 */
export interface FusionInput {
  /** 视觉特征算出的 V-A(带置信度) */
  visualVA: VAWithConfidence;
  /** GPS 反查结果(可能为 null) */
  gpsResult: GPSReverseResult | null;
  /** 拍照时间(EXIF 小时 0-23,可选) */
  photoHour?: number;
}

/** 融合输出 */
export interface FusionOutput {
  /** 融合后的 V-A */
  va: VAWithConfidence;
  /** 衍生场景(可能从 GPS 获得) */
  derivedScene?: SceneType;
  /** 是否使用 GPS */
  gpsUsed: boolean;
  /** 是否低置信度(前端可加轻交互) */
  lowConfidence: boolean;
  /** 策略说明 */
  strategy: AdaptiveWeightResult['strategy'];
}

/**
 * 视觉 + GPS 融合主函数
 *
 * 步骤:
 * 1. 决定自适应权重
 * 2. 加权融合 V-A
 * 3. 深夜时段修正
 * 4. 低置信度标记
 */
export function fuseVisualAndGPS(input: FusionInput): FusionOutput {
  const { visualVA, gpsResult, photoHour } = input;
  const weights = resolveAdaptiveWeights(visualVA.confidence, gpsResult !== null);

  let fusedVA: VACoordinate;
  let fusedConfidence: number;

  if (weights.gpsUsed && gpsResult?.mappedVA) {
    // 加权融合
    fusedVA = {
      v: weights.wVisual * visualVA.v + weights.wGps * gpsResult.mappedVA.v,
      a: weights.wVisual * visualVA.a + weights.wGps * gpsResult.mappedVA.a,
    };
    // 置信度:加权 + GPS 加成
    fusedConfidence = weights.wVisual * visualVA.confidence + weights.wGps * gpsResult.confidence;
  } else {
    fusedVA = { v: visualVA.v, a: visualVA.a };
    fusedConfidence = visualVA.confidence;
  }

  // 深夜时段修正(22:00-05:00)
  if (photoHour !== undefined && isLateNight(photoHour)) {
    fusedVA = {
      v: Math.max(0, fusedVA.v + LATE_NIGHT_ADJUSTMENT.vDelta),
      a: Math.max(0, fusedVA.a + LATE_NIGHT_ADJUSTMENT.aDelta),
    };
  }

  // 低置信度标记
  const lowConfidence = fusedConfidence < CONFLICT_CONFIDENCE_LOW;

  return {
    va: {
      v: fusedVA.v,
      a: fusedVA.a,
      confidence: fusedConfidence,
      source: weights.gpsUsed ? 'gps_fusion' : 'feature_fusion',
    },
    derivedScene: gpsResult?.mappedScene,
    gpsUsed: weights.gpsUsed,
    lowConfidence,
    strategy: weights.strategy,
  };
}

// ============================================================================
// 5. 冲突处理
// ============================================================================

/** 视觉场景与 GPS 场景的冲突判定 */
export function detectSceneConflict(
  visualScene: SceneType,
  gpsScene?: SceneType,
): boolean {
  if (!gpsScene) return false;
  return visualScene !== gpsScene;
}

/**
 * 冲突裁决:谁置信度高听谁,A 值取平均(场景影响 A 较大,折中更稳)
 */
export function resolveConflictByConfidence(
  visualVA: VAWithConfidence,
  gpsVA: VACoordinate,
  visualConfidence: number,
  gpsConfidence: number,
): { va: VACoordinate; winner: 'visual' | 'gps' } {
  if (visualConfidence >= gpsConfidence) {
    // 视觉赢,A 值取平均
    return {
      va: {
        v: visualVA.v,
        a: (visualVA.a + gpsVA.a) / 2,
      },
      winner: 'visual',
    };
  }
  // GPS 赢,A 值取平均
  return {
    va: {
      v: gpsVA.v,
      a: (visualVA.a + gpsVA.a) / 2,
    },
    winner: 'gps',
  };
}
