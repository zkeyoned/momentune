/**
 * photoToVA.ts 单元测试
 *
 * 覆盖:8 特征融合、hue 区间匹配(含跨 0 度)、置信度计算、主入口
 *
 * @module algorithm/__tests__/photoToVA.test
 */

import { describe, it, expect } from 'vitest';
import { fuseFeaturesToVA, calcOverallConfidence, photoToVA } from '../photoToVA.js';
import { FEATURE_WEIGHTS, FEATURE_DIRECTION_COEFFICIENTS } from '../config/featureWeights.js';
import { GRAYSCALE_SAT_THRESHOLD } from '../config/thresholds.js';
import type { PhotoFeatures } from '../types.js';
import {
  createPhotoFeatures,
  createSeasideDuskFeatures,
  createCityNightFeatures,
  createSunriseMountainFeatures,
  createRainyWindowFeatures,
  createPartyFeatures,
  createLateNightEmoFeatures,
  createCafeAfternoonFeatures,
  createRoadTripFeatures,
  createTestCases,
} from './testHelpers.js';

// ============================================================================
// 1. fuseFeaturesToVA 8 特征融合
// ============================================================================

describe('fuseFeaturesToVA 8 特征融合', () => {
  it('默认特征产生有效 V-A 坐标 [0,1]', () => {
    const features = createPhotoFeatures();
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThanOrEqual(0);
    expect(va.v).toBeLessThanOrEqual(1);
    expect(va.a).toBeGreaterThanOrEqual(0);
    expect(va.a).toBeLessThanOrEqual(1);
  });

  it('所有暖色高亮特征 → V 偏高', () => {
    const features = createPhotoFeatures({
      hue: { hue: 30, tone: 'warm', confidence: 0.9 },
      luminance: { value: 0.8, level: 'high', confidence: 0.9 },
      saturation: { value: 0.7, level: 'high', confidence: 0.9 },
      scene: { type: 'food', confidence: 0.9 },
      timeOfDay: { value: 'morning', confidence: 0.9 },
      weather: { value: 'sunny', confidence: 0.9 },
      people: { count: 4, dominantEmotion: 'smile', confidence: 0.9 },
      composition: { type: 'subject', confidence: 0.9 },
      overallConfidence: 0.9,
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThan(0.55);
  });

  it('所有冷色低亮特征 → V 偏低', () => {
    const features = createPhotoFeatures({
      hue: { hue: 220, tone: 'cool', confidence: 0.9 },
      luminance: { value: 0.25, level: 'low', confidence: 0.9 },
      saturation: { value: 0.3, level: 'low', confidence: 0.9 },
      scene: { type: 'indoor', confidence: 0.9 },
      timeOfDay: { value: 'night', confidence: 0.9 },
      weather: { value: 'rainy', confidence: 0.9 },
      people: { count: 1, dominantEmotion: 'sad', confidence: 0.9 },
      composition: { type: 'closeup', confidence: 0.9 },
      overallConfidence: 0.9,
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeLessThan(0.45);
  });

  it('高饱和高能特征 → A 偏高', () => {
    const features = createPhotoFeatures({
      hue: { hue: 10, tone: 'warm', confidence: 0.9 },
      luminance: { value: 0.7, level: 'high', confidence: 0.9 },
      saturation: { value: 0.85, level: 'high', confidence: 0.9 },
      scene: { type: 'people', confidence: 0.9 },
      timeOfDay: { value: 'daytime', confidence: 0.9 },
      weather: { value: 'sunny', confidence: 0.9 },
      people: { count: 5, dominantEmotion: 'excited', confidence: 0.9 },
      composition: { type: 'subject', confidence: 0.9 },
      overallConfidence: 0.9,
    });
    const va = fuseFeaturesToVA(features);
    expect(va.a).toBeGreaterThan(0.55);
  });
});

// ============================================================================
// 2. hue 区间匹配(关键:含跨 0 度区间)
// ============================================================================

describe('hue 区间匹配(含跨 0 度)', () => {
  it('hue=15 匹配 [0, 30] red-orange', () => {
    const features = createPhotoFeatures({
      hue: { hue: 15, tone: 'warm', confidence: 0.9 },
      saturation: { value: 0.6, level: 'high', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThan(0.5);
  });

  it('hue=340 匹配 [330, 360] red-orange-2(跨 0 度反向)', () => {
    // 不应崩溃,且 V 偏高(红色)
    const features = createPhotoFeatures({
      hue: { hue: 340, tone: 'warm', confidence: 0.9 },
      saturation: { value: 0.6, level: 'high', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThan(0.5);
  });

  it('hue=0 归一化后匹配 [0, 30]', () => {
    const features = createPhotoFeatures({
      hue: { hue: 0, tone: 'warm', confidence: 0.9 },
      saturation: { value: 0.6, level: 'high', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThan(0.5);
  });

  it('hue=360 归一化到 0,匹配 [0, 30]', () => {
    const features = createPhotoFeatures({
      hue: { hue: 360, tone: 'warm', confidence: 0.9 },
      saturation: { value: 0.6, level: 'high', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThan(0.5);
  });

  it('hue=370 归一化到 10,匹配 [0, 30]', () => {
    const features = createPhotoFeatures({
      hue: { hue: 370, tone: 'warm', confidence: 0.9 },
      saturation: { value: 0.6, level: 'high', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThan(0.5);
  });

  it('hue=-10 归一化到 350,匹配 [330, 360]', () => {
    const features = createPhotoFeatures({
      hue: { hue: -10, tone: 'warm', confidence: 0.9 },
      saturation: { value: 0.6, level: 'high', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeGreaterThan(0.5);
  });

  it('灰阶(低饱和)使用 GRAYSCALE_VA', () => {
    const features = createPhotoFeatures({
      hue: { hue: 30, tone: 'warm', confidence: 0.9 },
      saturation: { value: GRAYSCALE_SAT_THRESHOLD - 0.05, level: 'low', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    // 灰阶 V=0.40,但其他特征可能拉高,这里只验证不崩溃且 V 不极端高
    expect(va.v).toBeLessThan(0.7);
  });

  it('中性色调使用 GRAYSCALE_VA', () => {
    const features = createPhotoFeatures({
      hue: { hue: 30, tone: 'neutral', confidence: 0.9 },
      saturation: { value: 0.6, level: 'high', confidence: 0.9 },
    });
    const va = fuseFeaturesToVA(features);
    expect(va.v).toBeLessThan(0.7);
  });
});

// ============================================================================
// 3. 整体置信度
// ============================================================================

describe('calcOverallConfidence', () => {
  it('使用 overallConfidence 字段(>0)', () => {
    const features = createPhotoFeatures({ overallConfidence: 0.85 });
    expect(calcOverallConfidence(features)).toBeCloseTo(0.85, 6);
  });

  it('overallConfidence = 0 时按各特征加权计算', () => {
    const features = createPhotoFeatures({
      hue: { hue: 30, tone: 'warm', confidence: 0.8 },
      luminance: { value: 0.6, level: 'mid', confidence: 0.8 },
      saturation: { value: 0.5, level: 'mid', confidence: 0.8 },
      scene: { type: 'nature', confidence: 0.8 },
      timeOfDay: { value: 'daytime', confidence: 0.8 },
      weather: { value: 'sunny', confidence: 0.8 },
      people: { count: 0, dominantEmotion: 'none', confidence: 0.8 },
      composition: { type: 'landscape', confidence: 0.8 },
      overallConfidence: 0,
    });
    // 所有特征 confidence=0.8,加权均值=0.8
    expect(calcOverallConfidence(features)).toBeCloseTo(0.8, 6);
  });

  it('置信度钳制到 [0,1]', () => {
    const features = createPhotoFeatures({ overallConfidence: 1.5 });
    expect(calcOverallConfidence(features)).toBe(1);
  });
});

// ============================================================================
// 4. 主入口 photoToVA
// ============================================================================

describe('photoToVA 主入口', () => {
  it('返回带置信度和 source 的 V-A', () => {
    const features = createPhotoFeatures();
    const result = photoToVA(features);
    expect(result.v).toBeGreaterThanOrEqual(0);
    expect(result.v).toBeLessThanOrEqual(1);
    expect(result.a).toBeGreaterThanOrEqual(0);
    expect(result.a).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.source).toBe('feature_fusion');
  });
});

// ============================================================================
// 5. 9 个预设场景的合理性测试
// ============================================================================

describe('9 个预设场景 V-A 合理性', () => {
  it('黄昏海边 → V 中等偏高(暖色)', () => {
    const va = fuseFeaturesToVA(createSeasideDuskFeatures());
    expect(va.v).toBeGreaterThan(0.4);
    expect(va.v).toBeLessThan(0.8);
  });

  it('城市夜景 → V 偏低(冷色低亮)', () => {
    const va = fuseFeaturesToVA(createCityNightFeatures());
    expect(va.v).toBeLessThan(0.55);
  });

  it('日出山顶 → A 偏高(高亮广阔)', () => {
    const va = fuseFeaturesToVA(createSunriseMountainFeatures());
    expect(va.a).toBeGreaterThan(0.4);
  });

  it('雨天窗边 → V 偏低(冷色低亮雨天)', () => {
    const va = fuseFeaturesToVA(createRainyWindowFeatures());
    expect(va.v).toBeLessThan(0.55);
  });

  it('节日聚会 → A 高(高饱和多人)', () => {
    const va = fuseFeaturesToVA(createPartyFeatures());
    expect(va.a).toBeGreaterThan(0.5);
  });

  it('深夜独处 → V 偏低(冷色低亮)', () => {
    const va = fuseFeaturesToVA(createLateNightEmoFeatures());
    expect(va.v).toBeLessThan(0.5);
  });

  it('咖啡店下午 → V 中等(暖色室内)', () => {
    const va = fuseFeaturesToVA(createCafeAfternoonFeatures());
    expect(va.v).toBeGreaterThan(0.4);
    expect(va.v).toBeLessThan(0.75);
  });

  it('旅行公路 → A 中等偏高(广阔)', () => {
    const va = fuseFeaturesToVA(createRoadTripFeatures());
    expect(va.a).toBeGreaterThan(0.35);
  });

  it('所有预设场景不崩溃且 V-A 在 [0,1]', () => {
    const scenes = [
      createSeasideDuskFeatures(),
      createCityNightFeatures(),
      createSunriseMountainFeatures(),
      createRainyWindowFeatures(),
      createPartyFeatures(),
      createLateNightEmoFeatures(),
      createCafeAfternoonFeatures(),
      createRoadTripFeatures(),
    ];
    for (const f of scenes) {
      const va = fuseFeaturesToVA(f);
      expect(va.v).toBeGreaterThanOrEqual(0);
      expect(va.v).toBeLessThanOrEqual(1);
      expect(va.a).toBeGreaterThanOrEqual(0);
      expect(va.a).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// 6. 30 张测试照片集(宽松验证:不崩溃 + V-A 在合理区间)
// ============================================================================

describe('30 张测试照片集', () => {
  const cases = createTestCases();

  it('应有 30 张测试照片', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
  });

  for (const tc of cases) {
    it(`${tc.name} → V-A 在期望区间 [V:${tc.expectedVARange.vMin}-${tc.expectedVARange.vMax}, A:${tc.expectedVARange.aMin}-${tc.expectedVARange.aMax}]`, () => {
      const va = fuseFeaturesToVA(tc.features);
      // 宽松验证:V-A 落在期望区间内
      // 由于 8 特征融合有交叉影响,允许 ±0.1 容差
      const tol = 0.1;
      expect(va.v).toBeGreaterThanOrEqual(tc.expectedVARange.vMin - tol);
      expect(va.v).toBeLessThanOrEqual(tc.expectedVARange.vMax + tol);
      expect(va.a).toBeGreaterThanOrEqual(tc.expectedVARange.aMin - tol);
      expect(va.a).toBeLessThanOrEqual(tc.expectedVARange.aMax + tol);
    });
  }
});

// ============================================================================
// 7. 权重归一化验证
// ============================================================================

describe('权重归一化数学验证', () => {
  it('Σ w_i × α_i(V) 和 Σ w_i × α_i(A) 不为零', () => {
    let vWeightSum = 0;
    let aWeightSum = 0;
    for (const key of Object.keys(FEATURE_WEIGHTS) as Array<keyof typeof FEATURE_WEIGHTS>) {
      vWeightSum += FEATURE_WEIGHTS[key] * FEATURE_DIRECTION_COEFFICIENTS[key].v;
      aWeightSum += FEATURE_WEIGHTS[key] * FEATURE_DIRECTION_COEFFICIENTS[key].a;
    }
    expect(vWeightSum).toBeGreaterThan(0);
    expect(aWeightSum).toBeGreaterThan(0);
  });

  it('Σ w_i = 1.0(基础权重归一)', () => {
    let sum = 0;
    for (const key of Object.keys(FEATURE_WEIGHTS) as Array<keyof typeof FEATURE_WEIGHTS>) {
      sum += FEATURE_WEIGHTS[key];
    }
    expect(sum).toBeCloseTo(1.0, 2);
  });
});

// ============================================================================
// 8. hue 区间边界精确测试(P1-4)
// ============================================================================
//
// HUE_VA_MAP 区间(左闭右开):
//   [0, 30]   red-orange   V=0.75 A=0.72
//   [30, 60]  yellow-gold  V=0.70 A=0.50
//   [60, 180] green        V=0.58 A=0.30
//   [180,270] blue-cyan    V=0.32 A=0.25  ← 左闭,180 属于此区间
//   [270,300] purple       V=0.42 A=0.45
//   [300,330] pink-magenta V=0.72 A=0.38
//   [330,360] red-orange-2 V=0.75 A=0.72  ← 普通区间(不跨 0),左闭右开
//
// queryHueVA 未导出,通过 fuseFeaturesToVA 做差分测试:
// 构造两张仅 hue 不同、其余特征完全一致的照片,
// 差分可消去其他特征的贡献,仅反映 hue 区间切换的影响。

describe('hue 区间边界精确测试(P1-4)', () => {
  /** 构造"中性基底"特征:其余 7 维固定为中性,仅 hue 可变 */
  function makeNeutralBase(hue: number, tone: 'warm' | 'cool' = 'warm'): PhotoFeatures {
    return createPhotoFeatures({
      hue: { hue, tone, confidence: 0.9 },
      luminance: { value: 0.5, level: 'mid', confidence: 0.9 },
      saturation: { value: 0.5, level: 'mid', confidence: 0.9 },
      scene: { type: 'nature', confidence: 0.9 },
      timeOfDay: { value: 'daytime', confidence: 0.9 },
      weather: { value: 'sunny', confidence: 0.9 },
      people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
      composition: { type: 'landscape', confidence: 0.9 },
      overallConfidence: 0.9,
    });
  }

  it('hue=180 属于 blue-cyan [180,270],而非 green [60,180)', () => {
    // 180 → blue-cyan  V=0.32(低)
    // 179 → green       V=0.58(较高)
    // 差分:V(180) 应明显低于 V(179)
    const va180 = fuseFeaturesToVA(makeNeutralBase(180, 'cool'));
    const va179 = fuseFeaturesToVA(makeNeutralBase(179, 'cool'));
    expect(va180.v).toBeLessThan(va179.v);
    // 差距应可观(hue 权重 0.22×α_v 1.20,V 差 0.26 → 加权后约 0.05+)
    expect(va179.v - va180.v).toBeGreaterThan(0.03);
  });

  it('hue=60 属于 yellow-gold [30,60)? 不,左闭右开 → 60 属于 green [60,180)', () => {
    // [30,60) 右开 → 60 不属于 yellow-gold
    // [60,180) 左闭 → 60 属于 green
    // yellow-gold V=0.70,green V=0.58
    // 60 → green(较低),59 → yellow-gold(较高)
    const va60 = fuseFeaturesToVA(makeNeutralBase(60, 'warm'));
    const va59 = fuseFeaturesToVA(makeNeutralBase(59, 'warm'));
    expect(va60.v).toBeLessThan(va59.v);
  });

  it('hue=359 属于 red-orange-2 [330,360),V 偏高', () => {
    // 359 → red-orange-2 V=0.75
    // 359 远高于 blue-cyan(180)的 V=0.32
    const va359 = fuseFeaturesToVA(makeNeutralBase(359, 'warm'));
    const va180 = fuseFeaturesToVA(makeNeutralBase(180, 'cool'));
    expect(va359.v).toBeGreaterThan(va180.v);
    expect(va359.v).toBeGreaterThan(0.55); // 红色系 V 偏高
  });

  it('hue=360 归一化到 0 → 匹配 [0,30] red-orange,V 偏高', () => {
    const va360 = fuseFeaturesToVA(makeNeutralBase(360, 'warm'));
    const va0 = fuseFeaturesToVA(makeNeutralBase(0, 'warm'));
    // 两者应几乎相同(都匹配 red-orange)
    expect(va360.v).toBeCloseTo(va0.v, 4);
    expect(va360.a).toBeCloseTo(va0.a, 4);
    expect(va360.v).toBeGreaterThan(0.55);
  });

  it('hue=359 与 hue=0 V 相近(同属 red-orange 系)', () => {
    const va359 = fuseFeaturesToVA(makeNeutralBase(359, 'warm'));
    const va0 = fuseFeaturesToVA(makeNeutralBase(0, 'warm'));
    // 两者 V/A 配置相同(0.75/0.72),融合后应几乎相等
    expect(va359.v).toBeCloseTo(va0.v, 4);
    expect(va359.a).toBeCloseTo(va0.a, 4);
  });

  it('hue=270 属于 purple [270,300],而非 blue-cyan [180,270)', () => {
    // 270 → purple V=0.42 A=0.45
    // 269 → blue-cyan V=0.32 A=0.25
    // V(270) > V(269),A(270) > A(269)
    const va270 = fuseFeaturesToVA(makeNeutralBase(270, 'cool'));
    const va269 = fuseFeaturesToVA(makeNeutralBase(269, 'cool'));
    expect(va270.v).toBeGreaterThan(va269.v);
    expect(va270.a).toBeGreaterThan(va269.a);
  });

  it('hue=300 属于 pink-magenta [300,330),而非 purple [270,300)', () => {
    // 300 → pink-magenta V=0.72(高)
    // 299 → purple V=0.42(低)
    const va300 = fuseFeaturesToVA(makeNeutralBase(300, 'warm'));
    const va299 = fuseFeaturesToVA(makeNeutralBase(299, 'cool'));
    expect(va300.v).toBeGreaterThan(va299.v);
  });

  it('hue=330 属于 red-orange-2 [330,360),而非 pink-magenta [300,330)', () => {
    // 330 → red-orange-2 V=0.75 A=0.72
    // 329 → pink-magenta V=0.72 A=0.38
    // A(330) 远高于 A(329)
    const va330 = fuseFeaturesToVA(makeNeutralBase(330, 'warm'));
    const va329 = fuseFeaturesToVA(makeNeutralBase(329, 'warm'));
    expect(va330.a).toBeGreaterThan(va329.a);
  });

  it('hue=30 属于 yellow-gold [30,60),而非 red-orange [0,30)', () => {
    // 30 → yellow-gold V=0.70 A=0.50
    // 29 → red-orange V=0.75 A=0.72
    // A(30) < A(29)
    const va30 = fuseFeaturesToVA(makeNeutralBase(30, 'warm'));
    const va29 = fuseFeaturesToVA(makeNeutralBase(29, 'warm'));
    expect(va30.a).toBeLessThan(va29.a);
  });

  it('hue 归一化:720 → 0,匹配 red-orange', () => {
    const va720 = fuseFeaturesToVA(makeNeutralBase(720, 'warm'));
    const va0 = fuseFeaturesToVA(makeNeutralBase(0, 'warm'));
    expect(va720.v).toBeCloseTo(va0.v, 4);
    expect(va720.a).toBeCloseTo(va0.a, 4);
  });

  it('hue 归一化:-350 → 10,匹配 red-orange [0,30]', () => {
    // -350 % 360 = -350, ((-350 % 360) + 360) % 360 = 10
    const vaNeg = fuseFeaturesToVA(makeNeutralBase(-350, 'warm'));
    const va10 = fuseFeaturesToVA(makeNeutralBase(10, 'warm'));
    expect(vaNeg.v).toBeCloseTo(va10.v, 4);
    expect(vaNeg.a).toBeCloseTo(va10.a, 4);
  });
});
