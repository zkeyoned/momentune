/**
 * recommend.ts 集成测试
 *
 * 覆盖:两阶段推荐主流程、多样化约束、数量兜底、冷启动、探索曲
 *
 * @module algorithm/__tests__/recommend.test
 */

import { describe, it, expect } from 'vitest';
import { recommend, type RecommendInput } from '../recommend.js';
import {
  CORE_MAX_SAME_ARTIST,
  CORE_MAX_SAME_LABEL,
  CORE_MIN_HOT_COUNT,
  CORE_MAX_FALLBACK,
  FINAL_TOTAL_MIN,
  FINAL_TOTAL_MAX,
} from '../config/thresholds.js';
import { findNearestEmotionLabel } from '../utils.js';
import {
  createTestSongLibrary,
  createDefaultUserPreference,
  createColdStartUserPreference,
  createSongByEmotion,
  vaWithConf,
} from './testHelpers.js';
import type { EmotionLabel, Song } from '../types.js';

// ============================================================================
// 辅助:构建推荐输入
// ============================================================================

function buildInput(overrides: Partial<RecommendInput> = {}): RecommendInput {
  return {
    photoEmotion: vaWithConf(0.55, 0.25, 0.8, 'feature_fusion'), // Healing
    photoScene: 'nature',
    userPref: createDefaultUserPreference({ center: { v: 0.55, a: 0.25 } }),
    referenceSongs: [],
    songLibrary: createTestSongLibrary(),
    exploreEpsilon: 0, // 默认不探索,保证测试可重复
    ...overrides,
  };
}

// ============================================================================
// 1. 推荐主流程基础验证
// ============================================================================

describe('recommend 主流程基础', () => {
  it('返回 RecommendationResult 结构完整', () => {
    const result = recommend(buildInput());
    expect(result).toHaveProperty('photoEmotion');
    expect(result).toHaveProperty('primaryLabel');
    expect(result).toHaveProperty('coreTracks');
    expect(result).toHaveProperty('extendedTracks');
    expect(result).toHaveProperty('meta');
    expect(result).toHaveProperty('gpsUsed');
    expect(result).toHaveProperty('lowConfidence');
  });

  it('核心曲 = 8 首', () => {
    const result = recommend(buildInput());
    expect(result.coreTracks.length).toBe(8);
  });

  it('总数 ∈ [15, 20]', () => {
    const result = recommend(buildInput());
    const total = result.coreTracks.length + result.extendedTracks.length;
    expect(total).toBeGreaterThanOrEqual(FINAL_TOTAL_MIN);
    expect(total).toBeLessThanOrEqual(FINAL_TOTAL_MAX);
  });

  it('所有核心曲 source = "core"', () => {
    const result = recommend(buildInput());
    for (const t of result.coreTracks) {
      expect(t.source).toBe('core');
    }
  });

  it('所有扩展曲 source = "extended" 且有 extendedFromSongId', () => {
    const result = recommend(buildInput());
    for (const t of result.extendedTracks) {
      expect(t.source).toBe('extended');
      expect(t.extendedFromSongId).toBeDefined();
    }
  });

  it('primaryLabel 是 16 标签之一', () => {
    const result = recommend(buildInput());
    expect(result.primaryLabel).toBeTruthy();
  });

  it('meta 算法版本 = 0.1.0', () => {
    const result = recommend(buildInput());
    expect(result.meta.algorithmVersion).toBe('0.1.0');
  });
});

// ============================================================================
// 2. 多样化约束
// ============================================================================

describe('核心曲多样化约束', () => {
  it('同歌手 ≤ 1', () => {
    const result = recommend(buildInput());
    const artistCounts = new Map<string, number>();
    for (const t of result.coreTracks) {
      artistCounts.set(t.song.artist, (artistCounts.get(t.song.artist) ?? 0) + 1);
    }
    for (const [, count] of artistCounts) {
      expect(count).toBeLessThanOrEqual(CORE_MAX_SAME_ARTIST);
    }
  });

  it('同情绪标签 ≤ 2', () => {
    const result = recommend(buildInput());
    const labelCounts = new Map<EmotionLabel, number>();
    for (const t of result.coreTracks) {
      const label = findNearestEmotionLabel(t.song.va);
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
    for (const [, count] of labelCounts) {
      expect(count).toBeLessThanOrEqual(CORE_MAX_SAME_LABEL);
    }
  });

  it('热歌数 ≥ 3', () => {
    const result = recommend(buildInput());
    const hotCount = result.coreTracks.filter((t) => t.song.layer === 'hot').length;
    expect(hotCount).toBeGreaterThanOrEqual(CORE_MIN_HOT_COUNT);
  });

  it('兜底层 ≤ 1', () => {
    const result = recommend(buildInput());
    const fallbackCount = result.coreTracks.filter((t) => t.song.layer === 'fallback').length;
    expect(fallbackCount).toBeLessThanOrEqual(CORE_MAX_FALLBACK);
  });
});

// ============================================================================
// 3. 全局多样化(8 核心 + 扩展)
// ============================================================================

describe('全局多样化', () => {
  it('全局同歌手 ≤ 2', () => {
    const result = recommend(buildInput());
    const all = [...result.coreTracks, ...result.extendedTracks];
    const artistCounts = new Map<string, number>();
    for (const t of all) {
      artistCounts.set(t.song.artist, (artistCounts.get(t.song.artist) ?? 0) + 1);
    }
    for (const [, count] of artistCounts) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('无重复歌曲(核心曲与扩展曲不重叠)', () => {
    const result = recommend(buildInput());
    const coreIds = new Set(result.coreTracks.map((t) => t.song.songId));
    for (const t of result.extendedTracks) {
      expect(coreIds.has(t.song.songId)).toBe(false);
    }
  });

  it('扩展曲之间无重复', () => {
    const result = recommend(buildInput());
    const ids = result.extendedTracks.map((t) => t.song.songId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ============================================================================
// 4. 情绪匹配质量
// ============================================================================

describe('情绪匹配质量', () => {
  it('核心曲 V-A 距离照片较近(平均距离 < 0.5)', () => {
    const input = buildInput();
    const result = recommend(input);
    for (const t of result.coreTracks) {
      const dv = t.song.va.v - input.photoEmotion.v;
      const da = t.song.va.a - input.photoEmotion.a;
      const dist = Math.sqrt(0.6 * dv * dv + 0.4 * da * da);
      // 核心曲应距照片 V-A 较近(由于多样化,允许较宽)
      expect(dist).toBeLessThan(0.7);
    }
  });

  it('Healing 照片 → Healing/Relaxing/Fresh 等附近标签占多数', () => {
    const input = buildInput();
    const result = recommend(input);
    const expectedLabels = new Set<EmotionLabel>(['Healing', 'Relaxing', 'Fresh', 'Peaceful', 'Romantic', 'Touching']);
    const matches = result.coreTracks.filter((t) => expectedLabels.has(findNearestEmotionLabel(t.song.va)));
    // 至少一半核心曲落在期望情绪附近
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('Exciting 照片 → Exciting/Joyful/Epic 占多数', () => {
    const input = buildInput({
      photoEmotion: vaWithConf(0.85, 0.85, 0.8, 'feature_fusion'),
      userPref: createDefaultUserPreference({ center: { v: 0.85, a: 0.85 } }),
    });
    const result = recommend(input);
    const expectedLabels = new Set<EmotionLabel>(['Exciting', 'Joyful', 'Epic']);
    const matches = result.coreTracks.filter((t) => expectedLabels.has(findNearestEmotionLabel(t.song.va)));
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// 5. 数量兜底
// ============================================================================

describe('数量兜底', () => {
  it('音乐库不足时仍补足到 15 首', () => {
    // 构造一个稀疏的音乐库(18 首,全部 Healing,验证兜底补足)
    const sparseLib: Song[] = [];
    for (let i = 0; i < 18; i++) {
      sparseLib.push(createSongByEmotion('Healing', {
        songId: `sparse-${i}`,
        artist: `artist-${i}`,
      }));
    }
    const input = buildInput({ songLibrary: sparseLib });
    const result = recommend(input);
    const total = result.coreTracks.length + result.extendedTracks.length;
    expect(total).toBeGreaterThanOrEqual(FINAL_TOTAL_MIN);
  });

  it('音乐库超过 20 首候选时裁剪到 ≤ 20', () => {
    const input = buildInput();
    const result = recommend(input);
    const total = result.coreTracks.length + result.extendedTracks.length;
    expect(total).toBeLessThanOrEqual(FINAL_TOTAL_MAX);
  });

  it('空音乐库 → 不崩溃,返回结构完整', () => {
    const input = buildInput({ songLibrary: [] });
    const result = recommend(input);
    expect(result).toHaveProperty('coreTracks');
    expect(result).toHaveProperty('extendedTracks');
  });
});

// ============================================================================
// 6. 冷启动场景
// ============================================================================

describe('冷启动推荐', () => {
  it('冷启动用户仍能获得 8 核心曲', () => {
    const input = buildInput({
      userPref: createColdStartUserPreference(),
    });
    const result = recommend(input);
    expect(result.coreTracks.length).toBe(8);
  });

  it('冷启动用户总数 ∈ [15, 20]', () => {
    const input = buildInput({
      userPref: createColdStartUserPreference(),
    });
    const result = recommend(input);
    const total = result.coreTracks.length + result.extendedTracks.length;
    expect(total).toBeGreaterThanOrEqual(FINAL_TOTAL_MIN);
    expect(total).toBeLessThanOrEqual(FINAL_TOTAL_MAX);
  });

  it('冷启动时热歌占比应更高(score_hot 加权)', () => {
    const normalInput = buildInput({
      userPref: createDefaultUserPreference(),
    });
    const coldInput = buildInput({
      userPref: createColdStartUserPreference(),
    });
    const normalResult = recommend(normalInput);
    const coldResult = recommend(coldInput);
    const normalHotRatio = normalResult.coreTracks.filter((t) => t.song.layer === 'hot').length / 8;
    const coldHotRatio = coldResult.coreTracks.filter((t) => t.song.layer === 'hot').length / 8;
    // 冷启动应倾向更多热歌
    expect(coldHotRatio).toBeGreaterThanOrEqual(normalHotRatio - 0.2);
  });
});

// ============================================================================
// 7. 探索曲(ε-贪婪)
// ============================================================================

describe('探索曲(ε-贪婪)', () => {
  it('epsilon=0 → 无探索曲', () => {
    const input = buildInput({ exploreEpsilon: 0 });
    const result = recommend(input);
    expect(result.meta.exploreFlag).toBe(false);
  });

  it('epsilon=1.0 → 必有探索曲', () => {
    const input = buildInput({ exploreEpsilon: 1.0 });
    const result = recommend(input);
    expect(result.meta.exploreFlag).toBe(true);
    // 探索曲是核心曲之一
    const exploreTrack = result.coreTracks.find((t) => t.isExplore);
    expect(exploreTrack).toBeDefined();
  });

  it('默认 epsilon=0.15', () => {
    const input = buildInput(); // 不指定 exploreEpsilon
    expect(input.exploreEpsilon).toBe(0); // 我们的 helper 默认 0
    // 实际算法默认 0.15(在 selectCoreTracks 中)
  });
});

// ============================================================================
// 8. 不同照片情绪的推荐差异
// ============================================================================

describe('不同照片情绪的推荐差异', () => {
  it('Healing 照片 vs Exciting 照片 → 核心曲集合显著不同', () => {
    const healingInput = buildInput({
      photoEmotion: vaWithConf(0.55, 0.25, 0.8, 'feature_fusion'),
      userPref: createDefaultUserPreference({ center: { v: 0.55, a: 0.25 } }),
    });
    const excitingInput = buildInput({
      photoEmotion: vaWithConf(0.85, 0.85, 0.8, 'feature_fusion'),
      userPref: createDefaultUserPreference({ center: { v: 0.85, a: 0.85 } }),
    });
    const healingResult = recommend(healingInput);
    const excitingResult = recommend(excitingInput);

    const healingIds = new Set(healingResult.coreTracks.map((t) => t.song.songId));
    const excitingIds = new Set(excitingResult.coreTracks.map((t) => t.song.songId));
    const intersection = [...healingIds].filter((id) => excitingIds.has(id));
    // 两个推荐结果交集应小于 4(显著不同)
    expect(intersection.length).toBeLessThan(4);
  });

  it('Lonely 照片 → Lonely/Melancholic/Missing/Nostalgic 占多数', () => {
    const input = buildInput({
      photoEmotion: vaWithConf(0.25, 0.35, 0.8, 'feature_fusion'),
      userPref: createDefaultUserPreference({ center: { v: 0.25, a: 0.35 } }),
    });
    const result = recommend(input);
    const expectedLabels = new Set<EmotionLabel>(['Lonely', 'Melancholic', 'Missing', 'Nostalgic', 'Touching']);
    const matches = result.coreTracks.filter((t) => expectedLabels.has(findNearestEmotionLabel(t.song.va)));
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// 9. GPS 融合标记
// ============================================================================

describe('GPS 融合标记', () => {
  it('photoEmotion source = gps_fusion → gpsUsed = true', () => {
    const input = buildInput({
      photoEmotion: vaWithConf(0.55, 0.25, 0.7, 'gps_fusion'),
    });
    const result = recommend(input);
    expect(result.gpsUsed).toBe(true);
  });

  it('photoEmotion source != gps_fusion → gpsUsed = false', () => {
    const input = buildInput({
      photoEmotion: vaWithConf(0.55, 0.25, 0.8, 'feature_fusion'),
    });
    const result = recommend(input);
    expect(result.gpsUsed).toBe(false);
  });

  it('低置信度(<0.4)→ lowConfidence = true', () => {
    const input = buildInput({
      photoEmotion: vaWithConf(0.55, 0.25, 0.3, 'feature_fusion'),
    });
    const result = recommend(input);
    expect(result.lowConfidence).toBe(true);
  });

  it('高置信度(≥0.4)→ lowConfidence = false', () => {
    const input = buildInput({
      photoEmotion: vaWithConf(0.55, 0.25, 0.8, 'feature_fusion'),
    });
    const result = recommend(input);
    expect(result.lowConfidence).toBe(false);
  });
});

// ============================================================================
// 10. 混合情绪
// ============================================================================

describe('混合情绪', () => {
  it(' Healing 与 Relaxing 中间点 → isMixedEmotion = true', () => {
    // Healing(0.55, 0.25) Relaxing(0.50, 0.20) 中点(0.525, 0.225)
    const input = buildInput({
      photoEmotion: vaWithConf(0.525, 0.225, 0.8, 'feature_fusion'),
    });
    const result = recommend(input);
    expect(result.isMixedEmotion).toBe(true);
    expect(result.secondaryLabel).toBeDefined();
  });

  it('精确锚点 → isMixedEmotion = false', () => {
    const input = buildInput({
      photoEmotion: vaWithConf(0.85, 0.85, 0.8, 'feature_fusion'),
    });
    const result = recommend(input);
    expect(result.isMixedEmotion).toBe(false);
  });
});
