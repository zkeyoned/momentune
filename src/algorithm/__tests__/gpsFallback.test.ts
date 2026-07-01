/**
 * gpsFallback.ts 单元测试
 *
 * 覆盖:GPS 反查结果构建、自适应权重(4 策略)、视觉+GPS 融合、深夜修正、冲突裁决
 *
 * @module algorithm/__tests__/gpsFallback.test
 */

import { describe, it, expect } from 'vitest';
import {
  buildGPSReverseResult,
  resolveAdaptiveWeights,
  fuseVisualAndGPS,
  detectSceneConflict,
  resolveConflictByConfidence,
  type GPSReverseFunction,
} from '../gpsFallback.js';
import { LATE_NIGHT_ADJUSTMENT } from '../config/thresholds.js';
import type { GPSCoordinate, POIInfo, VACoordinate, VAWithConfidence } from '../types.js';
import { vaWithConf } from './testHelpers.js';

// ============================================================================
// 辅助函数
// ============================================================================

function makeCoord(lat = 39.9, lng = 116.4): GPSCoordinate {
  return { lat, lng, accuracy: 10 };
}

function makePOI(overrides: Partial<POIInfo> = {}): POIInfo {
  return {
    name: '故宫博物院',
    typeCode: '140400',
    category: '风景名胜',
    district: '北京市东城区',
    ...overrides,
  };
}

// ============================================================================
// 1. buildGPSReverseResult 构建 GPS 反查结果
// ============================================================================

describe('buildGPSReverseResult', () => {
  it('匹配 POI(古迹) → 返回映射场景和 V-A', () => {
    const coord = makeCoord();
    const poi = makePOI({ typeCode: '140400', name: '故宫', category: '古迹' });
    const result = buildGPSReverseResult(coord, poi, 'amap');
    expect(result.mappedScene).toBe('heritage');
    expect(result.mappedVA).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.provider).toBe('amap');
  });

  it('匹配 POI(咖啡店) → indoor 场景', () => {
    const coord = makeCoord();
    const poi = makePOI({ typeCode: '050500', name: '星巴克', category: '咖啡' });
    const result = buildGPSReverseResult(coord, poi, 'tencent');
    expect(result.mappedScene).toBe('indoor');
  });

  it('未匹配 POI → 默认 V-A + 低置信度', () => {
    const coord = makeCoord();
    const poi = makePOI({ typeCode: '000000', name: '未知地点', category: '其他' });
    const result = buildGPSReverseResult(coord, poi, 'osm');
    expect(result.mappedScene).toBeUndefined();
    expect(result.confidence).toBe(0.4);
    expect(result.mappedVA).toBeDefined();
  });
});

// ============================================================================
// 2. resolveAdaptiveWeights 自适应权重(4 策略)
// ============================================================================

describe('resolveAdaptiveWeights 4 策略', () => {
  it('视觉置信度 > 0.8 → visual_only 策略', () => {
    const result = resolveAdaptiveWeights(0.85, true);
    expect(result.strategy).toBe('visual_only');
    expect(result.wVisual).toBe(1.0);
    expect(result.wGps).toBe(0.0);
    expect(result.gpsUsed).toBe(false);
  });

  it('视觉置信度 < 0.5 且有 GPS → gps_dominant 策略(0.3/0.7)', () => {
    const result = resolveAdaptiveWeights(0.4, true);
    expect(result.strategy).toBe('gps_dominant');
    expect(result.wVisual).toBe(0.3);
    expect(result.wGps).toBe(0.7);
    expect(result.gpsUsed).toBe(true);
  });

  it('视觉置信度 < 0.5 且无 GPS → visual_fallback 策略', () => {
    const result = resolveAdaptiveWeights(0.4, false);
    expect(result.strategy).toBe('visual_fallback');
    expect(result.wVisual).toBe(1.0);
    expect(result.wGps).toBe(0.0);
    expect(result.gpsUsed).toBe(false);
  });

  it('中等置信度(0.5-0.8)+ 有 GPS → standard_fusion 策略(0.7/0.3)', () => {
    const result = resolveAdaptiveWeights(0.65, true);
    expect(result.strategy).toBe('standard_fusion');
    expect(result.wVisual).toBe(0.7);
    expect(result.wGps).toBe(0.3);
    expect(result.gpsUsed).toBe(true);
  });

  it('中等置信度(0.5-0.8)+ 无 GPS → visual_only 策略', () => {
    const result = resolveAdaptiveWeights(0.65, false);
    expect(result.strategy).toBe('visual_only');
    expect(result.gpsUsed).toBe(false);
  });

  it('边界值:置信度=0.81 走 visual_only(>0.8 严格大于)', () => {
    const result = resolveAdaptiveWeights(0.81, true);
    expect(result.strategy).toBe('visual_only');
  });

  it('边界值:置信度=0.8 走 standard_fusion(不严格大于 0.8)', () => {
    const result = resolveAdaptiveWeights(0.8, true);
    expect(result.strategy).toBe('standard_fusion');
  });

  it('边界值:置信度=0.5 走 standard_fusion', () => {
    const result = resolveAdaptiveWeights(0.5, true);
    expect(result.strategy).toBe('standard_fusion');
  });
});

// ============================================================================
// 3. fuseVisualAndGPS 视觉+GPS 融合
// ============================================================================

describe('fuseVisualAndGPS 视觉+GPS 融合', () => {
  const visualVA: VAWithConfidence = vaWithConf(0.6, 0.5, 0.7, 'feature_fusion');
  const gpsVA: VACoordinate = { v: 0.4, a: 0.3 };

  it('高置信度视觉 → 直接用视觉,GPS 不参与', () => {
    const visualHigh = vaWithConf(0.6, 0.5, 0.85, 'feature_fusion');
    const result = fuseVisualAndGPS({
      visualVA: visualHigh,
      gpsResult: {
        coordinate: makeCoord(),
        poi: makePOI(),
        provider: 'amap',
        mappedScene: 'heritage',
        mappedVA: gpsVA,
        confidence: 0.8,
      },
    });
    expect(result.gpsUsed).toBe(false);
    expect(result.va.v).toBeCloseTo(0.6, 6);
    expect(result.va.a).toBeCloseTo(0.5, 6);
    expect(result.strategy).toBe('visual_only');
  });

  it('中等置信度 → 0.7/0.3 加权融合', () => {
    const visualMid = vaWithConf(0.6, 0.5, 0.65, 'feature_fusion');
    const result = fuseVisualAndGPS({
      visualVA: visualMid,
      gpsResult: {
        coordinate: makeCoord(),
        poi: makePOI(),
        provider: 'amap',
        mappedScene: 'heritage',
        mappedVA: gpsVA,
        confidence: 0.8,
      },
    });
    expect(result.gpsUsed).toBe(true);
    // v = 0.7×0.6 + 0.3×0.4 = 0.42 + 0.12 = 0.54
    expect(result.va.v).toBeCloseTo(0.54, 4);
    // a = 0.7×0.5 + 0.3×0.3 = 0.35 + 0.09 = 0.44
    expect(result.va.a).toBeCloseTo(0.44, 4);
  });

  it('低置信度视觉 + 有 GPS → 0.3/0.7 GPS 主导', () => {
    const visualLow = vaWithConf(0.6, 0.5, 0.4, 'feature_fusion');
    const result = fuseVisualAndGPS({
      visualVA: visualLow,
      gpsResult: {
        coordinate: makeCoord(),
        poi: makePOI(),
        provider: 'amap',
        mappedScene: 'heritage',
        mappedVA: gpsVA,
        confidence: 0.8,
      },
    });
    expect(result.gpsUsed).toBe(true);
    expect(result.strategy).toBe('gps_dominant');
    // v = 0.3×0.6 + 0.7×0.4 = 0.18 + 0.28 = 0.46
    expect(result.va.v).toBeCloseTo(0.46, 4);
  });

  it('无 GPS → 直接用视觉', () => {
    const result = fuseVisualAndGPS({
      visualVA,
      gpsResult: null,
    });
    expect(result.gpsUsed).toBe(false);
    expect(result.va.v).toBeCloseTo(0.6, 6);
    expect(result.va.a).toBeCloseTo(0.5, 6);
  });

  it('GPS 无 mappedVA → 直接用视觉', () => {
    const result = fuseVisualAndGPS({
      visualVA,
      gpsResult: {
        coordinate: makeCoord(),
        poi: makePOI({ typeCode: '000', name: '未知', category: '其他' }),
        provider: 'osm',
        confidence: 0.4,
      },
    });
    expect(result.va.v).toBeCloseTo(0.6, 6);
  });

  it('深夜时段(22:00-05:00)触发 V/A 修正', () => {
    const result = fuseVisualAndGPS({
      visualVA,
      gpsResult: null,
      photoHour: 23,
    });
    // v = 0.6 + (-0.08) = 0.52, a = 0.5 + (-0.10) = 0.40
    expect(result.va.v).toBeCloseTo(0.6 + LATE_NIGHT_ADJUSTMENT.vDelta, 4);
    expect(result.va.a).toBeCloseTo(0.5 + LATE_NIGHT_ADJUSTMENT.aDelta, 4);
  });

  it('非深夜时段不修正', () => {
    const result = fuseVisualAndGPS({
      visualVA,
      gpsResult: null,
      photoHour: 12,
    });
    expect(result.va.v).toBeCloseTo(0.6, 6);
    expect(result.va.a).toBeCloseTo(0.5, 6);
  });

  it('低置信度标记(fusedConfidence < 0.4)', () => {
    const visualVeryLow = vaWithConf(0.6, 0.5, 0.3, 'feature_fusion');
    const result = fuseVisualAndGPS({
      visualVA: visualVeryLow,
      gpsResult: null,
    });
    expect(result.lowConfidence).toBe(true);
  });

  it('高置信度不标记 lowConfidence', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.85, 'feature_fusion'),
      gpsResult: null,
    });
    expect(result.lowConfidence).toBe(false);
  });

  it('source 标记正确:GPS 融合 → gps_fusion', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.65, 'feature_fusion'),
      gpsResult: {
        coordinate: makeCoord(),
        poi: makePOI(),
        provider: 'amap',
        mappedScene: 'heritage',
        mappedVA: gpsVA,
        confidence: 0.8,
      },
    });
    expect(result.va.source).toBe('gps_fusion');
  });

  it('source 标记正确:无 GPS → feature_fusion', () => {
    const result = fuseVisualAndGPS({
      visualVA,
      gpsResult: null,
    });
    expect(result.va.source).toBe('feature_fusion');
  });
});

// ============================================================================
// 3.1 fusedConfidence 精确数值断言(P1-5)
// ============================================================================
//
// 融合置信度公式(见 gpsFallback.ts):
//   fusedConfidence = wVisual × visualConfidence + wGps × gpsConfidence  (GPS 参与时)
//   fusedConfidence = visualConfidence                                    (GPS 不参与时)
// lowConfidence 判定:fusedConfidence < CONFLICT_CONFIDENCE_LOW(0.4)

describe('fuseVisualAndGPS fusedConfidence 精确断言(P1-5)', () => {
  const gpsVA: VACoordinate = { v: 0.4, a: 0.3 };
  const gpsConfidence = 0.8;

  function buildGpsResult(overrides: Partial<{ mappedVA: VACoordinate; confidence: number; mappedScene: string }> = {}) {
    return {
      coordinate: makeCoord(),
      poi: makePOI(),
      provider: 'amap' as const,
      mappedScene: (overrides.mappedScene ?? 'heritage') as 'heritage',
      mappedVA: overrides.mappedVA ?? gpsVA,
      confidence: overrides.confidence ?? gpsConfidence,
    };
  }

  it('standard_fusion (0.7/0.3): conf = 0.7×0.65 + 0.3×0.8 = 0.695', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.65, 'feature_fusion'),
      gpsResult: buildGpsResult({ confidence: 0.8 }),
    });
    const expected = 0.7 * 0.65 + 0.3 * 0.8; // 0.455 + 0.24 = 0.695
    expect(result.va.confidence).toBeCloseTo(expected, 6);
    expect(result.lowConfidence).toBe(false); // 0.695 >= 0.4
  });

  it('gps_dominant (0.3/0.7): conf = 0.3×0.4 + 0.7×0.8 = 0.68', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.4, 'feature_fusion'),
      gpsResult: buildGpsResult({ confidence: 0.8 }),
    });
    const expected = 0.3 * 0.4 + 0.7 * 0.8; // 0.12 + 0.56 = 0.68
    expect(result.va.confidence).toBeCloseTo(expected, 6);
    expect(result.lowConfidence).toBe(false);
  });

  it('visual_only(高置信度):conf = visualConfidence(GPS 不参与)', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.85, 'feature_fusion'),
      gpsResult: buildGpsResult({ confidence: 0.8 }),
    });
    expect(result.va.confidence).toBeCloseTo(0.85, 6);
  });

  it('visual_fallback(低置信度无 GPS):conf = visualConfidence', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.35, 'feature_fusion'),
      gpsResult: null,
    });
    expect(result.va.confidence).toBeCloseTo(0.35, 6);
    expect(result.lowConfidence).toBe(true); // 0.35 < 0.4
  });

  it('低置信度边界:conf = 0.4 → lowConfidence = false(不严格小于)', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.4, 'feature_fusion'),
      gpsResult: null,
    });
    expect(result.va.confidence).toBeCloseTo(0.4, 6);
    expect(result.lowConfidence).toBe(false); // 0.4 不 < 0.4
  });

  it('GPS 加成可显著提升置信度:低视觉+高 GPS → conf 提升', () => {
    const noGps = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.35, 'feature_fusion'),
      gpsResult: null,
    });
    const withGps = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.35, 'feature_fusion'),
      gpsResult: buildGpsResult({ confidence: 0.9 }),
    });
    // 无 GPS: conf=0.35(< 0.4 → lowConfidence=true)
    // 有 GPS(0.3/0.7): conf = 0.3×0.35 + 0.7×0.9 = 0.105 + 0.63 = 0.735
    expect(withGps.va.confidence).toBeGreaterThan(noGps.va.confidence);
    expect(withGps.va.confidence).toBeCloseTo(0.3 * 0.35 + 0.7 * 0.9, 6);
    // 低置信度标记应从 true → false
    expect(noGps.lowConfidence).toBe(true);
    expect(withGps.lowConfidence).toBe(false);
  });

  it('GPS 低置信度也可能拉低整体:低视觉+低 GPS → conf 更低', () => {
    const result = fuseVisualAndGPS({
      visualVA: vaWithConf(0.6, 0.5, 0.4, 'feature_fusion'),
      gpsResult: buildGpsResult({ confidence: 0.3 }),
    });
    // 0.3×0.4 + 0.7×0.3 = 0.12 + 0.21 = 0.33
    expect(result.va.confidence).toBeCloseTo(0.33, 6);
    expect(result.lowConfidence).toBe(true);
  });
});

// ============================================================================
// 4. 冲突处理
// ============================================================================

describe('detectSceneConflict', () => {
  it('视觉与 GPS 场景不同 → 冲突', () => {
    expect(detectSceneConflict('nature', 'city')).toBe(true);
  });

  it('视觉与 GPS 场景相同 → 无冲突', () => {
    expect(detectSceneConflict('nature', 'nature')).toBe(false);
  });

  it('GPS 无场景 → 无冲突', () => {
    expect(detectSceneConflict('nature', undefined)).toBe(false);
  });
});

describe('resolveConflictByConfidence 冲突裁决', () => {
  const visualVA: VAWithConfidence = vaWithConf(0.6, 0.5, 0.7, 'feature_fusion');
  const gpsVA: VACoordinate = { v: 0.4, a: 0.3 };

  it('视觉置信度高 → 视觉赢,A 取平均', () => {
    const result = resolveConflictByConfidence(visualVA, gpsVA, 0.8, 0.5);
    expect(result.winner).toBe('visual');
    expect(result.va.v).toBeCloseTo(0.6, 6);
    expect(result.va.a).toBeCloseTo((0.5 + 0.3) / 2, 6);
  });

  it('GPS 置信度高 → GPS 赢,A 取平均', () => {
    const result = resolveConflictByConfidence(visualVA, gpsVA, 0.5, 0.8);
    expect(result.winner).toBe('gps');
    expect(result.va.v).toBeCloseTo(0.4, 6);
    expect(result.va.a).toBeCloseTo((0.5 + 0.3) / 2, 6);
  });

  it('置信度相等 → 视觉赢(>=)', () => {
    const result = resolveConflictByConfidence(visualVA, gpsVA, 0.7, 0.7);
    expect(result.winner).toBe('visual');
  });
});

// ============================================================================
// 5. GPS 反查函数签名(类型兼容性)
// ============================================================================

describe('GPSReverseFunction 类型签名', () => {
  it('可定义符合签名的 mock 函数', async () => {
    const mockFn: GPSReverseFunction = async (coord) => ({
      coordinate: coord,
      poi: makePOI(),
      provider: 'amap',
      mappedScene: 'heritage',
      mappedVA: { v: 0.45, a: 0.35 },
      confidence: 0.85,
    });
    const result = await mockFn(makeCoord());
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('amap');
  });

  it('可返回 null(反查失败)', async () => {
    const mockFn: GPSReverseFunction = async () => null;
    const result = await mockFn(makeCoord());
    expect(result).toBeNull();
  });
});
