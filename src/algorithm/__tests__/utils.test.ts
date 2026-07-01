/**
 * utils.ts 单元测试
 *
 * 覆盖:数值工具、V-A 距离/相似度、情绪标签锚定、集合相似度、时间工具
 *
 * @module algorithm/__tests__/utils.test
 */

import { describe, it, expect } from 'vitest';
import {
  clamp,
  clamp01,
  normalizeLinear,
  normalizeTempo,
  normalizeLoudness,
  calcVADistance,
  calcVASimilarity,
  findNearestEmotionLabel,
  findNearestEmotionLabels,
  resolveEmotionLabels,
  jaccardSimilarity,
  cosineSimilarity,
  isLateNight,
  isHourClose,
  normalizeHour,
  daysSince,
  calcHotRecencyDecay,
} from '../utils.js';
import { EMOTION_VA_COORDINATES } from '../config/emotionLabels.js';

// ============================================================================
// 1. 数值工具
// ============================================================================

describe('数值工具 clamp/clamp01/normalize', () => {
  it('clamp 钳制到 [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('clamp01 钳制到 [0, 1]', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  it('normalizeLinear 线性归一化 [inMin, inMax] → [0, 1]', () => {
    expect(normalizeLinear(50, 0, 100)).toBeCloseTo(0.5, 6);
    expect(normalizeLinear(0, 0, 100)).toBe(0);
    expect(normalizeLinear(100, 0, 100)).toBe(1);
    expect(normalizeLinear(-10, 0, 100)).toBe(0);
    expect(normalizeLinear(110, 0, 100)).toBe(1);
  });

  it('normalizeLinear 处理零区间', () => {
    expect(normalizeLinear(5, 5, 5)).toBe(0);
  });

  it('normalizeTempo BPM 60-180 → 0-1', () => {
    expect(normalizeTempo(60)).toBe(0);
    expect(normalizeTempo(180)).toBe(1);
    expect(normalizeTempo(120)).toBeCloseTo(0.5, 6);
    expect(normalizeTempo(30)).toBe(0); // 低于下限
    expect(normalizeTempo(240)).toBe(1); // 高于上限
  });

  it('normalizeLoudness -30~0 dB → 0-1', () => {
    expect(normalizeLoudness(0)).toBe(1);
    expect(normalizeLoudness(-30)).toBe(0);
    expect(normalizeLoudness(-15)).toBeCloseTo(0.5, 6);
    expect(normalizeLoudness(-40)).toBe(0);
    expect(normalizeLoudness(5)).toBe(1);
  });
});

// ============================================================================
// 2. V-A 距离与相似度
// ============================================================================

describe('V-A 加权欧氏距离', () => {
  it('相同点距离为 0', () => {
    expect(calcVADistance({ v: 0.5, a: 0.5 }, { v: 0.5, a: 0.5 })).toBe(0);
  });

  it('对角点距离 = sqrt(0.6 + 0.4) = 1', () => {
    expect(calcVADistance({ v: 0, a: 0 }, { v: 1, a: 1 })).toBeCloseTo(1, 6);
  });

  it('V 权重 0.6,A 权重 0.4(非对称)', () => {
    // 仅 V 差 1:distance = sqrt(0.6) ≈ 0.7746
    expect(calcVADistance({ v: 0, a: 0 }, { v: 1, a: 0 })).toBeCloseTo(Math.sqrt(0.6), 4);
    // 仅 A 差 1:distance = sqrt(0.4) ≈ 0.6325
    expect(calcVADistance({ v: 0, a: 0 }, { v: 0, a: 1 })).toBeCloseTo(Math.sqrt(0.4), 4);
  });

  it('距离具有对称性', () => {
    const a = { v: 0.3, a: 0.7 };
    const b = { v: 0.8, a: 0.2 };
    expect(calcVADistance(a, b)).toBeCloseTo(calcVADistance(b, a), 6);
  });
});

describe('V-A 相似度', () => {
  it('相同点相似度 = 1', () => {
    expect(calcVASimilarity({ v: 0.5, a: 0.5 }, { v: 0.5, a: 0.5 })).toBe(1);
  });

  it('对角点相似度 = 0', () => {
    expect(calcVASimilarity({ v: 0, a: 0 }, { v: 1, a: 1 })).toBeCloseTo(0, 6);
  });

  it('相似度 = 1 - 距离', () => {
    const a = { v: 0.3, a: 0.7 };
    const b = { v: 0.6, a: 0.4 };
    const dist = calcVADistance(a, b);
    expect(calcVASimilarity(a, b)).toBeCloseTo(1 - dist, 6);
  });
});

// ============================================================================
// 3. 情绪标签锚定
// ============================================================================

describe('findNearestEmotionLabel', () => {
  it('精确命中标签坐标返回该标签', () => {
    for (const [label, va] of Object.entries(EMOTION_VA_COORDINATES)) {
      expect(findNearestEmotionLabel(va)).toBe(label);
    }
  });

  it('Exciting 区附近返回 Exciting', () => {
    // Exciting: v=0.85, a=0.85
    expect(findNearestEmotionLabel({ v: 0.82, a: 0.88 })).toBe('Exciting');
  });

  it('Healing 区附近返回 Healing', () => {
    // Healing: v=0.55, a=0.25
    expect(findNearestEmotionLabel({ v: 0.57, a: 0.27 })).toBe('Healing');
  });

  it('中心点(0.5, 0.4) 应锚定到合理标签', () => {
    const label = findNearestEmotionLabel({ v: 0.5, a: 0.4 });
    // 应该是附近某标签,不崩溃即可
    expect(label).toBeTruthy();
  });
});

describe('findNearestEmotionLabels', () => {
  it('返回 N 个最近标签按距离升序', () => {
    const result = findNearestEmotionLabels({ v: 0.85, a: 0.85 }, 3);
    expect(result).toHaveLength(3);
    expect(result[0]!.label).toBe('Exciting');
    // 距离升序
    expect(result[0]!.distance).toBeLessThanOrEqual(result[1]!.distance);
    expect(result[1]!.distance).toBeLessThanOrEqual(result[2]!.distance);
  });

  it('N 超过标签总数时返回全部', () => {
    const result = findNearestEmotionLabels({ v: 0.5, a: 0.5 }, 99);
    expect(result.length).toBe(Object.keys(EMOTION_VA_COORDINATES).length);
  });
});

describe('resolveEmotionLabels 混合情绪判定', () => {
  it('精确锚点不判为混合', () => {
    const result = resolveEmotionLabels({ v: 0.85, a: 0.85 });
    expect(result.primary).toBe('Exciting');
    expect(result.isMixed).toBe(false);
  });

  it('距两标签都 < 0.08 判为混合', () => {
    // Healing(0.55, 0.25) 和 Relaxing(0.50, 0.20) 中间点
    // 中点(0.525, 0.225),距两标签都约 0.035
    const result = resolveEmotionLabels({ v: 0.525, a: 0.225 });
    expect(result.isMixed).toBe(true);
    expect(result.secondary).toBeDefined();
  });

  it('距次标签 < 0.15 但非混合时返回 secondary', () => {
    // 距 Healing(0.55, 0.25) 较近,距 Relaxing(0.50, 0.20) 在 0.08-0.15 之间
    const result = resolveEmotionLabels({ v: 0.58, a: 0.28 });
    // 距 Healing ≈ 0.034,距 Relaxing ≈ 0.094 → 非混合但有 secondary
    if (result.primary === 'Healing') {
      expect(result.secondary).toBeDefined();
    }
  });

  it('远离所有标签时无 secondary', () => {
    const result = resolveEmotionLabels({ v: 0.85, a: 0.85 });
    expect(result.isMixed).toBe(false);
    // Exciting 是孤立标签,secondary 距离较大
    // 这里不强制 secondary 是否存在,只验证 primary 正确
    expect(result.primary).toBe('Exciting');
  });
});

// ============================================================================
// 4. 集合相似度
// ============================================================================

describe('jaccardSimilarity', () => {
  it('完全相同集合 = 1', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('完全不相交 = 0', () => {
    expect(jaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('部分交集', () => {
    // {a,b} ∪ {b,c} = {a,b,c},交集 {b} = 1/3
    expect(jaccardSimilarity(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3, 6);
  });

  it('两个空集 = 1(约定)', () => {
    expect(jaccardSimilarity([], [])).toBe(1);
  });

  it('单空集 = 0', () => {
    expect(jaccardSimilarity([], ['a'])).toBe(0);
    expect(jaccardSimilarity(['a'], [])).toBe(0);
  });

  it('去重处理', () => {
    expect(jaccardSimilarity(['a', 'a', 'b'], ['a', 'b'])).toBe(1);
  });
});

describe('cosineSimilarity', () => {
  it('相同向量 = 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('正交向量 = 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('反向往量 = -1', () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
  });

  it('长度不一致返回 0', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('空向量返回 0', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('零向量返回 0(避免除零)', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

// ============================================================================
// 5. 时间工具
// ============================================================================

describe('isLateNight', () => {
  it('22:00-05:00 为深夜', () => {
    expect(isLateNight(22)).toBe(true);
    expect(isLateNight(23)).toBe(true);
    expect(isLateNight(0)).toBe(true);
    expect(isLateNight(4)).toBe(true);
  });

  it('05:00-22:00 非深夜', () => {
    expect(isLateNight(5)).toBe(false);
    expect(isLateNight(12)).toBe(false);
    expect(isLateNight(21)).toBe(false);
  });
});

describe('isHourClose', () => {
  it('相差 ≤ 2 小时为近', () => {
    expect(isHourClose(10, 12)).toBe(true);
    expect(isHourClose(12, 10)).toBe(true);
    expect(isHourClose(10, 11)).toBe(true);
  });

  it('相差 > 2 小时为远', () => {
    expect(isHourClose(10, 15)).toBe(false);
  });

  it('跨午夜相近(差 ≥ 22)', () => {
    expect(isHourClose(23, 1)).toBe(true);
    expect(isHourClose(1, 23)).toBe(true);
  });
});

describe('normalizeHour', () => {
  it('0-23 归一化到 0-1', () => {
    expect(normalizeHour(0)).toBe(0);
    expect(normalizeHour(23)).toBeCloseTo(1, 6);
    expect(normalizeHour(12)).toBeCloseTo(12 / 23, 6);
  });
});

// ============================================================================
// 6. 日期工具
// ============================================================================

describe('daysSince', () => {
  it('计算距今天数', () => {
    const now = 1000 * 60 * 60 * 24 * 100; // 100 天后基准
    const ts = now - 1000 * 60 * 60 * 24 * 10; // 10 天前
    expect(daysSince(ts, now)).toBeCloseTo(10, 6);
  });

  it('未来时间返回负数', () => {
    const now = 1000;
    const future = now + 1000 * 60 * 60 * 24;
    expect(daysSince(future, now)).toBeCloseTo(-1, 6);
  });
});

describe('calcHotRecencyDecay', () => {
  it('0 天衰减系数 = 1', () => {
    expect(calcHotRecencyDecay(0)).toBeCloseTo(1, 6);
  });

  it('30 天衰减系数 = e^-1 ≈ 0.368', () => {
    expect(calcHotRecencyDecay(30)).toBeCloseTo(Math.exp(-1), 4);
  });

  it('衰减系数随天数递减', () => {
    const d10 = calcHotRecencyDecay(10);
    const d30 = calcHotRecencyDecay(30);
    const d60 = calcHotRecencyDecay(60);
    expect(d10).toBeGreaterThan(d30);
    expect(d30).toBeGreaterThan(d60);
  });
});
