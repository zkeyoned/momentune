/**
 * musicToVA.ts 单元测试
 *
 * 覆盖:网易云标签映射、Spotify 特征转换、启发式公式、关键词估算、回归模型、综合标注
 *
 * @module algorithm/__tests__/musicToVA.test
 */

import { describe, it, expect } from 'vitest';
import {
  neteaseTagToVA,
  neteaseMultiTagToVA,
  spotifyFeaturesToVA,
  heuristicEstimateVA,
  keywordEstimateVA,
  regressionEstimateVA,
  songToVA,
  getSongVA,
  type AudioFeaturesForHeuristic,
  type AudioRegressionFunction,
} from '../musicToVA.js';
import { NETEASE_TAG_VA, EMOTION_VA_COORDINATES } from '../config/emotionLabels.js';
import {
  METHOD_A_CONFIDENCE,
  METHOD_B_CONFIDENCE,
  METHOD_C_CONFIDENCE,
  MINOR_KEY_V_PENALTY,
  ACOUSTIC_A_PENALTY,
} from '../config/thresholds.js';
import { createSong, createSongByEmotion, vaWithConf } from './testHelpers.js';

// ============================================================================
// 1. 网易云标签 → V-A
// ============================================================================

describe('neteaseTagToVA 单标签映射', () => {
  it('已知标签返回对应 V-A,confidence=0.85', () => {
    const result = neteaseTagToVA('Healing');
    expect(result.v).toBeCloseTo(NETEASE_TAG_VA.Healing!.v, 6);
    expect(result.a).toBeCloseTo(NETEASE_TAG_VA.Healing!.a, 6);
    expect(result.confidence).toBe(0.85);
    expect(result.source).toBe('netease_tag');
  });

  it('Exciting 标签', () => {
    const result = neteaseTagToVA('Exciting');
    expect(result.v).toBeCloseTo(0.85, 6);
    expect(result.a).toBeCloseTo(0.85, 6);
  });

  it('未知标签返回 fallback_default', () => {
    // 使用类型断言绕过编译检查测试兜底
    const result = neteaseTagToVA('unknown' as never);
    expect(result.v).toBe(0.5);
    expect(result.a).toBe(0.4);
    expect(result.confidence).toBe(0.4);
    expect(result.source).toBe('fallback_default');
  });
});

describe('neteaseMultiTagToVA 多标签加权质心', () => {
  it('空标签返回 fallback', () => {
    const result = neteaseMultiTagToVA([]);
    expect(result.source).toBe('fallback_default');
  });

  it('单标签等同 neteaseTagToVA', () => {
    const single = neteaseMultiTagToVA(['Healing']);
    const direct = neteaseTagToVA('Healing');
    expect(single.v).toBeCloseTo(direct.v, 6);
    expect(single.a).toBeCloseTo(direct.a, 6);
  });

  it('多标签取质心', () => {
    const tags = ['Healing', 'Relaxing'] as const;
    const result = neteaseMultiTagToVA(tags);
    const expectedV = (NETEASE_TAG_VA.Healing!.v + NETEASE_TAG_VA.Relaxing!.v) / 2;
    const expectedA = (NETEASE_TAG_VA.Healing!.a + NETEASE_TAG_VA.Relaxing!.a) / 2;
    expect(result.v).toBeCloseTo(expectedV, 6);
    expect(result.a).toBeCloseTo(expectedA, 6);
    expect(result.confidence).toBe(0.82);
  });

  it('多标签带权重(点赞数)', () => {
    const tags = ['Healing', 'Relaxing'] as const;
    const weights = { Healing: 3, Relaxing: 1 } as const;
    const result = neteaseMultiTagToVA(tags, weights);
    // 加权质心:偏向 Healing
    const expectedV = (NETEASE_TAG_VA.Healing!.v * 3 + NETEASE_TAG_VA.Relaxing!.v * 1) / 4;
    expect(result.v).toBeCloseTo(expectedV, 6);
  });
});

// ============================================================================
// 2. Spotify 音频特征 → V-A(含修正)
// ============================================================================

describe('spotifyFeaturesToVA 含修正', () => {
  const baseFeatures = {
    valence: 0.5,
    energy: 0.5,
    tempo: 120,
    loudness: -10,
    mode: 1 as 0 | 1,
    danceability: 0.5,
    acousticness: 0.3,
    instrumentalness: 0.1,
  };

  it('大调高 valence 无修正', () => {
    const f = { ...baseFeatures, valence: 0.7, mode: 1 as 0 | 1 };
    const result = spotifyFeaturesToVA(f);
    expect(result.v).toBeCloseTo(0.7, 6);
    expect(result.source).toBe('spotify_feature');
    expect(result.confidence).toBe(0.8);
  });

  it('小调高 valence 触发 V 减 0.08', () => {
    const f = { ...baseFeatures, valence: 0.7, mode: 0 as 0 | 1 };
    const result = spotifyFeaturesToVA(f);
    expect(result.v).toBeCloseTo(0.7 - MINOR_KEY_V_PENALTY, 6);
  });

  it('小调低 valence 不触发修正', () => {
    const f = { ...baseFeatures, valence: 0.4, mode: 0 as 0 | 1 };
    const result = spotifyFeaturesToVA(f);
    expect(result.v).toBeCloseTo(0.4, 6);
  });

  it('高 acousticness 触发 A 减 0.05', () => {
    const f = { ...baseFeatures, acousticness: 0.8 };
    const result = spotifyFeaturesToVA(f);
    // A = 0.6×0.5 + 0.2×tempo_norm(120→0.5) + 0.2×loudness_norm(-10→0.667) - 0.05
    const expectedA = 0.6 * 0.5 + 0.2 * 0.5 + 0.2 * (20 / 30) - ACOUSTIC_A_PENALTY;
    expect(result.a).toBeCloseTo(expectedA, 4);
  });

  it('A = 0.6×energy + 0.2×tempo_norm + 0.2×loudness_norm', () => {
    const f = { ...baseFeatures, energy: 0.8, tempo: 180, loudness: 0 };
    const result = spotifyFeaturesToVA(f);
    // A = 0.6×0.8 + 0.2×1.0 + 0.2×1.0 = 0.48 + 0.2 + 0.2 = 0.88
    expect(result.a).toBeCloseTo(0.88, 4);
  });

  it('V/A 钳制到 [0,1]', () => {
    const f = { ...baseFeatures, valence: -1, energy: -1 };
    const result = spotifyFeaturesToVA(f);
    expect(result.v).toBeGreaterThanOrEqual(0);
    expect(result.a).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// 3. 启发式公式(方法 B)
// ============================================================================

describe('heuristicEstimateVA 方法 B', () => {
  const baseAudio: AudioFeaturesForHeuristic = {
    tempo: 120,
    rms: 0.5,
    loudness: -10,
    mode: 1,
    spectralCentroid: 3000,
    lyricsSentiment: 0,
  };

  it('大调+积极歌词 → V 偏高', () => {
    const f: AudioFeaturesForHeuristic = { ...baseAudio, mode: 1, lyricsSentiment: 0.8 };
    const result = heuristicEstimateVA(f);
    expect(result.v).toBeGreaterThan(0.6);
    expect(result.source).toBe('heuristic_formula');
    expect(result.confidence).toBe(METHOD_B_CONFIDENCE);
  });

  it('小调+消极歌词 → V 偏低', () => {
    const f: AudioFeaturesForHeuristic = { ...baseAudio, mode: -1, lyricsSentiment: -0.8 };
    const result = heuristicEstimateVA(f);
    expect(result.v).toBeLessThan(0.4);
  });

  it('高 BPM + 高 RMS → A 偏高', () => {
    const f: AudioFeaturesForHeuristic = { ...baseAudio, tempo: 180, rms: 0.9, loudness: 0 };
    const result = heuristicEstimateVA(f);
    expect(result.a).toBeGreaterThan(0.7);
  });

  it('低 BPM + 低 RMS → A 偏低', () => {
    const f: AudioFeaturesForHeuristic = { ...baseAudio, tempo: 60, rms: 0.1, loudness: -30 };
    const result = heuristicEstimateVA(f);
    expect(result.a).toBeLessThan(0.3);
  });

  it('V/A 钳制到 [0,1]', () => {
    const f: AudioFeaturesForHeuristic = {
      ...baseAudio,
      mode: 1,
      lyricsSentiment: 2, // 超界
      tempo: 300,
    };
    const result = heuristicEstimateVA(f);
    expect(result.v).toBeLessThanOrEqual(1);
    expect(result.a).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// 4. 关键词估算(方法 C)
// ============================================================================

describe('keywordEstimateVA 方法 C', () => {
  it('积极关键词 → V 偏高', () => {
    const result = keywordEstimateVA('爱的光芒');
    expect(result.v).toBeGreaterThan(0.55);
    expect(result.source).toBe('metadata_keyword');
    expect(result.confidence).toBe(METHOD_C_CONFIDENCE);
  });

  it('消极关键词 → V 偏低', () => {
    const result = keywordEstimateVA('孤独的夜');
    expect(result.v).toBeLessThan(0.45);
  });

  it('高能关键词 → A 偏高', () => {
    const result = keywordEstimateVA('燃烧战歌');
    expect(result.a).toBeGreaterThan(0.55);
  });

  it('低能关键词 → A 偏低', () => {
    const result = keywordEstimateVA('静夜轻柔');
    expect(result.a).toBeLessThan(0.4);
  });

  it('无关键词命中 → 默认 V/A', () => {
    const result = keywordEstimateVA('xyz123');
    expect(result.v).toBeGreaterThanOrEqual(0.4);
    expect(result.v).toBeLessThanOrEqual(0.6);
  });

  it('歌手名也参与匹配', () => {
    const result = keywordEstimateVA('歌曲', '孤独歌手');
    expect(result.v).toBeLessThan(0.5);
  });
});

// ============================================================================
// 5. 回归模型(方法 A,带 fallback)
// ============================================================================

describe('regressionEstimateVA 方法 A', () => {
  const baseAudio: AudioFeaturesForHeuristic = {
    tempo: 120,
    rms: 0.5,
    loudness: -10,
    mode: 1,
    spectralCentroid: 3000,
    lyricsSentiment: 0,
  };

  it('注入成功回归函数 → 用方法 A', async () => {
    const mockFn: AudioRegressionFunction = async () => ({ v: 0.75, a: 0.65 });
    const result = await regressionEstimateVA(baseAudio, mockFn);
    expect(result.v).toBeCloseTo(0.75, 6);
    expect(result.a).toBeCloseTo(0.65, 6);
    expect(result.confidence).toBe(METHOD_A_CONFIDENCE);
    expect(result.source).toBe('audio_regression');
  });

  it('回归函数返回 null → 降级方法 B', async () => {
    const mockFn: AudioRegressionFunction = async () => null;
    const result = await regressionEstimateVA(baseAudio, mockFn);
    expect(result.source).toBe('heuristic_formula');
    expect(result.confidence).toBe(METHOD_B_CONFIDENCE);
  });

  it('回归函数抛异常 → 降级方法 B', async () => {
    const mockFn: AudioRegressionFunction = async () => {
      throw new Error('model error');
    };
    const result = await regressionEstimateVA(baseAudio, mockFn);
    expect(result.source).toBe('heuristic_formula');
  });

  it('未注入回归函数 → 直接用方法 B', async () => {
    const result = await regressionEstimateVA(baseAudio);
    expect(result.source).toBe('heuristic_formula');
  });

  it('方法 A 结果钳制到 [0,1]', async () => {
    const mockFn: AudioRegressionFunction = async () => ({ v: 1.5, a: -0.5 });
    const result = await regressionEstimateVA(baseAudio, mockFn);
    expect(result.v).toBe(1);
    expect(result.a).toBe(0);
  });
});

// ============================================================================
// 6. 综合标注 songToVA
// ============================================================================

describe('songToVA 综合标注', () => {
  it('全空输入 → fallback_default', async () => {
    const result = await songToVA({});
    expect(result.source).toBe('fallback_default');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('仅网易云标签 → 用 neteaseTagToVA', async () => {
    const result = await songToVA({ neteaseTags: ['Healing'] });
    expect(result.source).toBe('netease_tag');
    expect(result.v).toBeCloseTo(NETEASE_TAG_VA.Healing!.v, 6);
  });

  it('仅 Spotify 特征 → 用 spotifyFeaturesToVA', async () => {
    const result = await songToVA({
      spotifyFeatures: {
        valence: 0.7, energy: 0.5, tempo: 120, loudness: -10,
        mode: 1, danceability: 0.5, acousticness: 0.3, instrumentalness: 0.1,
      },
    });
    expect(result.source).toBe('spotify_feature');
    expect(result.v).toBeCloseTo(0.7, 6);
  });

  it('仅标题 → 用 keywordEstimateVA', async () => {
    const result = await songToVA({ title: '孤独的夜' });
    expect(result.source).toBe('metadata_keyword');
    expect(result.v).toBeLessThan(0.5);
  });

  it('多源融合 → 按置信度加权平均,置信度 +0.05', async () => {
    const result = await songToVA({
      neteaseTags: ['Healing'],
      spotifyFeatures: {
        valence: 0.7, energy: 0.5, tempo: 120, loudness: -10,
        mode: 1, danceability: 0.5, acousticness: 0.3, instrumentalness: 0.1,
      },
    });
    // netease: v=0.55 conf=0.85,spotify: v=0.7 conf=0.8
    // 加权:(0.55×0.85 + 0.7×0.8) / (0.85+0.8) = (0.4675 + 0.56) / 1.65 ≈ 0.6227
    expect(result.v).toBeCloseTo(0.6227, 3);
    // 置信度取最大值 +0.05 = 0.85 + 0.05 = 0.9
    expect(result.confidence).toBeCloseTo(0.9, 6);
  });

  it('多源融合后置信度不超过 1', async () => {
    const result = await songToVA({
      neteaseTags: ['Healing'],
      spotifyFeatures: {
        valence: 0.7, energy: 0.5, tempo: 120, loudness: -10,
        mode: 1, danceability: 0.5, acousticness: 0.3, instrumentalness: 0.1,
      },
      audioFeatures: {
        tempo: 120, rms: 0.5, loudness: -10, mode: 1,
        spectralCentroid: 3000, lyricsSentiment: 0.5,
      },
    });
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// 7. getSongVA 从 Song 对象提取
// ============================================================================

describe('getSongVA 从 Song 对象提取', () => {
  it('已有标注(confidence>0.3 且非 default)直接返回', async () => {
    const song = createSongByEmotion('Healing');
    const result = await getSongVA(song);
    expect(result.v).toBeCloseTo(EMOTION_VA_COORDINATES.Healing.v, 6);
    expect(result.source).toBe('netease_tag');
  });

  it('fallback_default 标注 → 重新估算', async () => {
    const song = createSong({
      va: vaWithConf(0.5, 0.4, 0.2, 'fallback_default'),
      title: '孤独的夜',
    });
    const result = await getSongVA(song);
    expect(result.source).not.toBe('fallback_default');
    expect(result.v).toBeLessThan(0.5);
  });

  it('低置信度标注 → 重新估算', async () => {
    const song = createSong({
      va: vaWithConf(0.5, 0.4, 0.2, 'netease_tag'),
      title: '孤独的夜',
    });
    const result = await getSongVA(song);
    // confidence=0.2 < 0.3 → 重新估算
    expect(result.confidence).toBeGreaterThan(0.2);
  });
});
