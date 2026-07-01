/**
 * preference.ts 单元测试
 *
 * 覆盖:风格/语言权重初始化、偏好中心计算、EMA 持续学习、时段偏好、冷启动
 *
 * @module algorithm/__tests__/preference.test
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultGenreWeights,
  createDefaultLanguageWeights,
  initGenreWeights,
  initLanguageWeights,
  calcReferenceCenter,
  calcInitialPrefCenter,
  initUserPreference,
  updateGenreWeights,
  updateLanguageWeights,
  driftPrefCenter,
  updateHourlyAcceptRate,
  updateHourlyEmotionBias,
  getHourlyEmotionBonus,
  processInteraction,
  isColdStart,
  shouldExploreInColdStart,
  getPrefCenterEmotionLabel,
  calcPrefCenterSimilarity,
} from '../preference.js';
import {
  PREF_DEFAULT_GENRE_WEIGHT,
  PREF_SELECTED_GENRE_WEIGHT,
  PREF_ANY_GENRE_WEIGHT,
  PREF_CENTER_DRIFT_MU,
  PREF_UPDATE_RATES,
  PREF_WEIGHT_CLAMP,
  COLD_START_INTERACTIONS,
  HOURLY_EMOTION_BONUS,
} from '../config/thresholds.js';
import { MOOD_PREFERENCE_ANCHOR } from '../config/emotionLabels.js';
import type { EmotionLabel, GenreTag, InteractionEvent, LanguageTag, MoodPreference, Song } from '../types.js';
import {
  createDefaultUserPreference,
  createColdStartUserPreference,
  createOnboardingAnswers,
  createSongByEmotion,
  createSong,
  vaWithConf,
} from './testHelpers.js';

// ============================================================================
// 1. 权重向量初始化
// ============================================================================

describe('createDefaultGenreWeights', () => {
  it('所有风格默认权重', () => {
    const w = createDefaultGenreWeights(0.4);
    expect(w.pop).toBe(0.4);
    expect(w.rock).toBe(0.4);
    expect(Object.keys(w).length).toBe(60); // 59 主类 + other
  });

  it('默认值 = 0.3', () => {
    const w = createDefaultGenreWeights();
    expect(w.pop).toBe(PREF_DEFAULT_GENRE_WEIGHT);
  });
});

describe('createDefaultLanguageWeights', () => {
  it('所有语言默认权重', () => {
    const w = createDefaultLanguageWeights(0.5);
    expect(w.mandarin).toBe(0.5);
    expect(Object.keys(w).length).toBe(7);
  });
});

describe('initGenreWeights 问卷初始化', () => {
  it('选中风格 → 1.0,未选 → 0.3', () => {
    const w = initGenreWeights(['pop', 'rock'] as GenreTag[]);
    expect(w.pop).toBe(PREF_SELECTED_GENRE_WEIGHT);
    expect(w.rock).toBe(PREF_SELECTED_GENRE_WEIGHT);
    expect(w.folk).toBe(PREF_DEFAULT_GENRE_WEIGHT);
  });

  it('空数组("不限")→ 全部 0.7', () => {
    const w = initGenreWeights([]);
    expect(w.pop).toBe(PREF_ANY_GENRE_WEIGHT);
    expect(w.rock).toBe(PREF_ANY_GENRE_WEIGHT);
  });
});

describe('initLanguageWeights', () => {
  it('选中语言 → 1.0,未选 → 0.3', () => {
    const w = initLanguageWeights(['mandarin'] as LanguageTag[]);
    expect(w.mandarin).toBe(1.0);
    expect(w.english).toBe(0.3);
  });

  it('空数组 → 全部 0.7', () => {
    const w = initLanguageWeights([]);
    expect(w.mandarin).toBe(PREF_ANY_GENRE_WEIGHT);
  });
});

// ============================================================================
// 2. 偏好中心
// ============================================================================

describe('calcReferenceCenter 参考歌质心', () => {
  it('空数组 → null', () => {
    expect(calcReferenceCenter([])).toBeNull();
  });

  it('有 V-A 标注的参考歌 → 质心', () => {
    const songs = [
      createSongByEmotion('Healing'), // v=0.55 a=0.25
      createSongByEmotion('Relaxing'), // v=0.50 a=0.20
    ];
    const center = calcReferenceCenter(songs);
    expect(center).not.toBeNull();
    expect(center!.v).toBeCloseTo(0.525, 4);
    expect(center!.a).toBeCloseTo(0.225, 4);
  });

  it('低置信度参考歌(conf≤0.3)被过滤', () => {
    const songs = [
      createSongByEmotion('Healing'),
      createSong({ va: vaWithConf(0.2, 0.2, 0.2, 'fallback_default') }),
    ];
    const center = calcReferenceCenter(songs);
    // 只算 Healing
    expect(center).not.toBeNull();
    expect(center!.v).toBeCloseTo(0.55, 4);
  });

  it('全部低置信度 → null', () => {
    const songs = [
      createSong({ va: vaWithConf(0.2, 0.2, 0.2, 'fallback_default') }),
    ];
    expect(calcReferenceCenter(songs)).toBeNull();
  });
});

describe('calcInitialPrefCenter', () => {
  it('有参考中心 → 0.5×ref + 0.5×mood', () => {
    const refCenter = { v: 0.6, a: 0.4 };
    const mood: MoodPreference = 'healing'; // anchor v=0.55 a=0.25
    const result = calcInitialPrefCenter(refCenter, mood);
    expect(result.v).toBeCloseTo(0.5 * 0.6 + 0.5 * 0.55, 4);
    expect(result.a).toBeCloseTo(0.5 * 0.4 + 0.5 * 0.25, 4);
  });

  it('无参考中心 → 用 mood anchor', () => {
    const mood: MoodPreference = 'healing';
    const result = calcInitialPrefCenter(null, mood);
    expect(result.v).toBeCloseTo(MOOD_PREFERENCE_ANCHOR.healing!.v, 4);
    expect(result.a).toBeCloseTo(MOOD_PREFERENCE_ANCHOR.healing!.a, 4);
  });

  it('未知 mood → 用 neutral anchor', () => {
    const result = calcInitialPrefCenter(null, 'unknown' as MoodPreference);
    expect(result.v).toBeCloseTo(0.5, 4);
    expect(result.a).toBeCloseTo(0.4, 4);
  });
});

describe('initUserPreference 完整初始化', () => {
  it('问卷答案 + 参考歌 → 完整偏好模型', () => {
    const answers = createOnboardingAnswers({
      platform: 'netease',
      mood: 'healing',
      genres: ['pop'] as GenreTag[],
      languages: ['mandarin'] as LanguageTag[],
      referenceSongs: [],
    });
    const refSongs: Song[] = [createSongByEmotion('Healing')];
    const pref = initUserPreference(answers, refSongs);

    expect(pref.center).toBeDefined();
    expect(pref.genreWeights.pop).toBe(PREF_SELECTED_GENRE_WEIGHT);
    expect(pref.languageWeights.mandarin).toBe(1.0);
    expect(pref.platform).toBe('netease');
    expect(pref.moodAnchor).toBeDefined();
    expect(pref.hourlyAcceptRate.length).toBe(24);
    expect(pref.hourlyEmotionBias.length).toBe(24);
    expect(pref.isColdStart).toBe(true);
    expect(pref.interactionCount).toBe(0);
    expect(pref.referenceSongIds.length).toBe(1);
  });
});

// ============================================================================
// 3. EMA 持续学习
// ============================================================================

describe('updateGenreWeights EMA 更新', () => {
  it('skip 信号 → 降权(×(1-0.05))', () => {
    const current = createDefaultGenreWeights(1.0);
    const result = updateGenreWeights(current, 'skip', ['pop'] as GenreTag[]);
    expect(result.pop).toBeCloseTo(1.0 * (1 - PREF_UPDATE_RATES.skip), 6);
  });

  it('complete 信号 → 升权(×(1+0.03))', () => {
    const current = createDefaultGenreWeights(1.0);
    const result = updateGenreWeights(current, 'complete', ['pop'] as GenreTag[]);
    expect(result.pop).toBeCloseTo(1.0 * (1 + PREF_UPDATE_RATES.complete), 6);
  });

  it('loop 信号 → 升权(×(1+0.10))', () => {
    const current = createDefaultGenreWeights(1.0);
    const result = updateGenreWeights(current, 'loop', ['pop'] as GenreTag[]);
    expect(result.pop).toBeCloseTo(1.0 * (1 + PREF_UPDATE_RATES.loop), 6);
  });

  it('save_diary 信号 → 升权(×(1+0.20))', () => {
    const current = createDefaultGenreWeights(1.0);
    const result = updateGenreWeights(current, 'save_diary', ['pop'] as GenreTag[]);
    expect(result.pop).toBeCloseTo(1.0 * (1 + PREF_UPDATE_RATES.save_diary), 6);
  });

  it('未交互的风格权重不变', () => {
    const current = createDefaultGenreWeights(1.0);
    const result = updateGenreWeights(current, 'loop', ['pop'] as GenreTag[]);
    expect(result.rock).toBe(current.rock);
  });

  it('权重钳制到 [0.1, 3.0]', () => {
    // 极低权重
    const low = { ...createDefaultGenreWeights(1.0), pop: 0.05 };
    const resultLow = updateGenreWeights(low, 'skip', ['pop'] as GenreTag[]);
    expect(resultLow.pop).toBeGreaterThanOrEqual(PREF_WEIGHT_CLAMP.min);

    // 极高权重
    const high = { ...createDefaultGenreWeights(1.0), pop: 3.5 };
    const resultHigh = updateGenreWeights(high, 'save_diary', ['pop'] as GenreTag[]);
    expect(resultHigh.pop).toBeLessThanOrEqual(PREF_WEIGHT_CLAMP.max);
  });
});

describe('updateLanguageWeights', () => {
  it('skip → 降权', () => {
    const current = createDefaultUserPreference().languageWeights;
    const result = updateLanguageWeights(current, 'skip', 'mandarin');
    expect(result.mandarin).toBeLessThan(current.mandarin);
  });

  it('loop → 升权', () => {
    const current = createDefaultUserPreference().languageWeights;
    const result = updateLanguageWeights(current, 'loop', 'mandarin');
    expect(result.mandarin).toBeGreaterThan(current.mandarin);
  });
});

describe('driftPrefCenter 偏好中心漂移', () => {
  it('接受信号(loop/save_diary)→ 中心向歌曲漂移', () => {
    const current = { v: 0.5, a: 0.4 };
    const songVA = { v: 0.7, a: 0.6 };
    const result = driftPrefCenter(current, songVA, 'loop');
    // v = (1-0.05)×0.5 + 0.05×0.7 = 0.475 + 0.035 = 0.51
    expect(result.v).toBeCloseTo((1 - PREF_CENTER_DRIFT_MU) * 0.5 + PREF_CENTER_DRIFT_MU * 0.7, 6);
    expect(result.a).toBeCloseTo((1 - PREF_CENTER_DRIFT_MU) * 0.4 + PREF_CENTER_DRIFT_MU * 0.6, 6);
  });

  it('save_diary 信号也触发漂移', () => {
    const current = { v: 0.5, a: 0.4 };
    const songVA = { v: 0.7, a: 0.6 };
    const result = driftPrefCenter(current, songVA, 'save_diary');
    expect(result.v).not.toBeCloseTo(0.5, 4);
  });

  it('skip/complete 信号不触发漂移', () => {
    const current = { v: 0.5, a: 0.4 };
    const songVA = { v: 0.7, a: 0.6 };
    const skipResult = driftPrefCenter(current, songVA, 'skip');
    const completeResult = driftPrefCenter(current, songVA, 'complete');
    expect(skipResult.v).toBe(0.5);
    expect(completeResult.v).toBe(0.5);
  });
});

// ============================================================================
// 4. 时段偏好
// ============================================================================

describe('updateHourlyAcceptRate', () => {
  it('接受信号(loop)→ 该小时接受率上调', () => {
    const current = new Array(24).fill(0.5);
    const result = updateHourlyAcceptRate(current, 12, 'loop');
    // newVal = (1-0.1)×0.5 + 0.1×1.0 = 0.45 + 0.1 = 0.55
    expect(result[12]).toBeCloseTo(0.55, 4);
    expect(result[0]).toBe(0.5); // 其他不变
  });

  it('skip 信号 → 该小时接受率下调', () => {
    const current = new Array(24).fill(0.5);
    const result = updateHourlyAcceptRate(current, 12, 'skip');
    // newVal = (1-0.1)×0.5 + 0.1×0.0 = 0.45
    expect(result[12]).toBeCloseTo(0.45, 4);
  });

  it('非法小时(>23 或 <0)→ 不修改', () => {
    const current = new Array(24).fill(0.5);
    expect(updateHourlyAcceptRate(current, -1, 'loop')).toEqual(current);
    expect(updateHourlyAcceptRate(current, 24, 'loop')).toEqual(current);
  });

  it('不修改原数组(返回新数组)', () => {
    const current = new Array(24).fill(0.5);
    const result = updateHourlyAcceptRate(current, 12, 'loop');
    expect(current[12]).toBe(0.5); // 原数组未变
    expect(result).not.toBe(current);
  });
});

describe('updateHourlyEmotionBias', () => {
  it('样本不足 → 不更新偏置', () => {
    const currentBias = new Array(24).fill(null);
    const counts: Array<Record<EmotionLabel, number>> = [];
    for (let i = 0; i < 24; i++) {
      counts.push({} as Record<EmotionLabel, number>);
    }
    // 只有 2 个样本(< HOURLY_MIN_SAMPLES=3)
    counts[12]!['Healing' as EmotionLabel] = 2;
    const result = updateHourlyEmotionBias(currentBias, 12, 'Healing', counts);
    expect(result[12]).toBeNull();
  });

  it('某情绪占比 > 60% → 标记偏置', () => {
    const currentBias = new Array(24).fill(null);
    const counts: Array<Record<EmotionLabel, number>> = [];
    for (let i = 0; i < 24; i++) {
      counts.push({} as Record<EmotionLabel, number>);
    }
    counts[12]!['Healing' as EmotionLabel] = 5;
    counts[12]!['Relaxing' as EmotionLabel] = 1;
    const result = updateHourlyEmotionBias(currentBias, 12, 'Healing', counts);
    expect(result[12]).toBe('Healing');
  });

  it('占比 < 60% → 不标记', () => {
    const currentBias = new Array(24).fill(null);
    const counts: Array<Record<EmotionLabel, number>> = [];
    for (let i = 0; i < 24; i++) {
      counts.push({} as Record<EmotionLabel, number>);
    }
    counts[12]!['Healing' as EmotionLabel] = 3;
    counts[12]!['Relaxing' as EmotionLabel] = 3;
    const result = updateHourlyEmotionBias(currentBias, 12, 'Healing', counts);
    expect(result[12]).toBeNull();
  });
});

describe('getHourlyEmotionBonus', () => {
  it('时段有偏置且匹配 → 加成', () => {
    const bias: Array<EmotionLabel | null> = new Array(24).fill(null);
    bias[12] = 'Healing';
    expect(getHourlyEmotionBonus(bias, 12, 'Healing')).toBe(HOURLY_EMOTION_BONUS);
  });

  it('时段有偏置但不匹配 → 0', () => {
    const bias: Array<EmotionLabel | null> = new Array(24).fill(null);
    bias[12] = 'Healing';
    expect(getHourlyEmotionBonus(bias, 12, 'Exciting')).toBe(0);
  });

  it('时段无偏置 → 0', () => {
    const bias: Array<EmotionLabel | null> = new Array(24).fill(null);
    expect(getHourlyEmotionBonus(bias, 12, 'Healing')).toBe(0);
  });
});

// ============================================================================
// 5. 完整偏好更新 processInteraction
// ============================================================================

describe('processInteraction 完整偏好更新', () => {
  function makeEvent(overrides: Partial<InteractionEvent> = {}): InteractionEvent {
    return {
      songId: 'song-1',
      songVA: { v: 0.7, a: 0.6 },
      genres: ['pop'] as GenreTag[],
      language: 'mandarin',
      signal: 'loop',
      hour: 12,
      emotionLabel: 'Joyful',
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it('loop 信号 → 风格升权 + 语言升权 + 中心漂移', () => {
    const pref = createDefaultUserPreference();
    const event = makeEvent({ signal: 'loop' });
    const result = processInteraction(pref, event);

    expect(result.genreWeights.pop).toBeGreaterThan(pref.genreWeights.pop);
    expect(result.languageWeights.mandarin).toBeGreaterThan(pref.languageWeights.mandarin);
    expect(result.center.v).not.toBe(pref.center.v); // 漂移
  });

  it('skip 信号 → 风格降权 + 中心不漂移', () => {
    const pref = createDefaultUserPreference();
    const event = makeEvent({ signal: 'skip' });
    const result = processInteraction(pref, event);

    expect(result.genreWeights.pop).toBeLessThan(pref.genreWeights.pop);
    expect(result.center.v).toBe(pref.center.v); // skip 不漂移
  });

  it('interactionCount + 1', () => {
    const pref = createDefaultUserPreference({ interactionCount: 5 });
    const event = makeEvent();
    const result = processInteraction(pref, event);
    expect(result.interactionCount).toBe(6);
  });

  it('达到 COLD_START_INTERACTIONS 后 isColdStart = false', () => {
    const pref = createDefaultUserPreference({
      interactionCount: COLD_START_INTERACTIONS - 1,
      isColdStart: true,
    });
    const event = makeEvent();
    const result = processInteraction(pref, event);
    expect(result.isColdStart).toBe(false);
  });

  it('updatedAt 更新为事件时间戳', () => {
    const pref = createDefaultUserPreference();
    const ts = 1234567890;
    const event = makeEvent({ timestamp: ts });
    const result = processInteraction(pref, event);
    expect(result.updatedAt).toBe(ts);
  });
});

// ============================================================================
// 6. 冷启动辅助
// ============================================================================

describe('isColdStart', () => {
  it('interactionCount < 5 → 冷启动', () => {
    const pref = createDefaultUserPreference({ interactionCount: 3 });
    expect(isColdStart(pref)).toBe(true);
  });

  it('interactionCount >= 5 → 非冷启动', () => {
    const pref = createDefaultUserPreference({ interactionCount: 5 });
    expect(isColdStart(pref)).toBe(false);
  });
});

describe('shouldExploreInColdStart', () => {
  it('冷启动 + epsilon=1.0 → 必探索', () => {
    const pref = createColdStartUserPreference();
    expect(shouldExploreInColdStart(pref, 1.0)).toBe(true);
  });

  it('冷启动 + epsilon=0.0 → 不探索', () => {
    const pref = createColdStartUserPreference();
    expect(shouldExploreInColdStart(pref, 0.0)).toBe(false);
  });

  it('非冷启动也按 epsilon 概率探索', () => {
    const pref = createDefaultUserPreference({ isColdStart: false });
    expect(shouldExploreInColdStart(pref, 1.0)).toBe(true);
    expect(shouldExploreInColdStart(pref, 0.0)).toBe(false);
  });
});

// ============================================================================
// 7. 偏好导出
// ============================================================================

describe('getPrefCenterEmotionLabel', () => {
  it('Healing 中心 → 返回 Healing', () => {
    const pref = createDefaultUserPreference({
      center: { v: 0.55, a: 0.25 },
    });
    expect(getPrefCenterEmotionLabel(pref)).toBe('Healing');
  });

  it('Exciting 中心 → 返回 Exciting', () => {
    const pref = createDefaultUserPreference({
      center: { v: 0.85, a: 0.85 },
    });
    expect(getPrefCenterEmotionLabel(pref)).toBe('Exciting');
  });
});

describe('calcPrefCenterSimilarity', () => {
  it('中心点 = 歌曲 V-A → 相似度 = 1', () => {
    const pref = createDefaultUserPreference({ center: { v: 0.55, a: 0.25 } });
    expect(calcPrefCenterSimilarity(pref, { v: 0.55, a: 0.25 })).toBe(1);
  });

  it('中心点远离 → 相似度低', () => {
    const pref = createDefaultUserPreference({ center: { v: 0.55, a: 0.25 } });
    const sim = calcPrefCenterSimilarity(pref, { v: 0.85, a: 0.85 });
    expect(sim).toBeLessThan(0.6);
  });
});
