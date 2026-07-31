/**
 * match.ts 动态权重计算单元测试(Task 5)
 *
 * 覆盖:resolveDynamicWeights
 * 场景:高/低置信度、musicIntent 缺失、genreHints/moodTags 空、边界值
 *
 * @module algorithm/__tests__/match-weights.test
 */

import { describe, it, expect } from 'vitest';
import { resolveDynamicWeights } from '../match.js';
import {
  MATCH_WEIGHTS_FIVE_DIM,
  MATCH_WEIGHTS_VA_DEGRADED,
} from '../config/thresholds.js';
import type { MusicIntent } from '../types.js';

// ============================================================================
// 测试夹具
// ============================================================================

/** 完整 musicIntent(所有信号可用) */
function fullMusicIntent(): MusicIntent {
  return {
    moodTags: ['慵懒', '释然'],
    energyLevel: 'low',
    genreHints: ['chill electronic', 'city pop'],
    languageHint: 'mandarin',
    vibeDescription: '夏夜海边微醺的放松感',
  };
}

/** 六维权重键 */
const KEYS = ['mood', 'energy', 'genre', 'language', 'vibe', 'va'] as const;

/** 计算权重总和 */
function sumWeights(w: { mood: number; energy: number; genre: number; language: number; vibe: number; va: number }): number {
  return KEYS.reduce((s, k) => s + w[k], 0);
}

// ============================================================================
// resolveDynamicWeights
// ============================================================================

describe('resolveDynamicWeights', () => {
  // --------------------------------------------------------------------------
  // 1. 高置信度 + 完整 musicIntent → 返回 MATCH_WEIGHTS_FIVE_DIM
  // --------------------------------------------------------------------------
  describe('高置信度 + 完整 musicIntent', () => {
    it('返回 MATCH_WEIGHTS_FIVE_DIM(总和=1.0)', () => {
      const w = resolveDynamicWeights(0.9, fullMusicIntent());
      expect(w.mood).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.mood, 10);
      expect(w.energy).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.energy, 10);
      expect(w.genre).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.genre, 10);
      expect(w.language).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.language, 10);
      expect(w.vibe).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.vibe, 10);
      expect(w.va).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.va, 10);
      expect(sumWeights(w)).toBeCloseTo(1.0, 10);
    });
  });

  // --------------------------------------------------------------------------
  // 2. 低置信度 + 完整 musicIntent → 返回 MATCH_WEIGHTS_VA_DEGRADED
  // --------------------------------------------------------------------------
  describe('低置信度(confidence=0.5)', () => {
    it('返回 MATCH_WEIGHTS_VA_DEGRADED(总和=1.0)', () => {
      const w = resolveDynamicWeights(0.5, fullMusicIntent());
      expect(w.mood).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.mood, 10);
      expect(w.energy).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.energy, 10);
      expect(w.genre).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.genre, 10);
      expect(w.language).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.language, 10);
      expect(w.vibe).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.vibe, 10);
      expect(w.va).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.va, 10);
      expect(sumWeights(w)).toBeCloseTo(1.0, 10);
    });
  });

  // --------------------------------------------------------------------------
  // 3. musicIntent undefined → 纯 V-A 模式
  // --------------------------------------------------------------------------
  describe('musicIntent undefined', () => {
    it('返回 {va:1.0, 其他全 0}', () => {
      const w = resolveDynamicWeights(0.9, undefined);
      expect(w.mood).toBe(0);
      expect(w.energy).toBe(0);
      expect(w.genre).toBe(0);
      expect(w.language).toBe(0);
      expect(w.vibe).toBe(0);
      expect(w.va).toBe(1.0);
      expect(sumWeights(w)).toBe(1.0);
    });

    it('低置信度 + musicIntent undefined → 仍为纯 V-A 模式', () => {
      // musicIntent undefined 优先级最高,不受 confidence 影响
      const w = resolveDynamicWeights(0.3, undefined);
      expect(w.va).toBe(1.0);
      expect(w.mood).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. genreHints 为空 + 高置信度 → genre=0,其他 5 维按比例分摊
  // --------------------------------------------------------------------------
  describe('genreHints 为空', () => {
    it('genre 权重归零,其他 5 维按比例分摊(总和=1.0)', () => {
      const intent = fullMusicIntent();
      intent.genreHints = [];
      const w = resolveDynamicWeights(0.9, intent);

      expect(w.genre).toBe(0);

      // 手动验证按比例分摊:
      // 基准 {mood:0.20, energy:0.15, genre:0.15, language:0.10, vibe:0.15, va:0.25}
      // genre 的 0.15 分给其他 5 维,其总和 = 0.85
      const sumOthers = 0.20 + 0.15 + 0.10 + 0.15 + 0.25; // 0.85
      expect(w.mood).toBeCloseTo(0.20 + 0.15 * (0.20 / sumOthers), 10);
      expect(w.energy).toBeCloseTo(0.15 + 0.15 * (0.15 / sumOthers), 10);
      expect(w.language).toBeCloseTo(0.10 + 0.15 * (0.10 / sumOthers), 10);
      expect(w.vibe).toBeCloseTo(0.15 + 0.15 * (0.15 / sumOthers), 10);
      expect(w.va).toBeCloseTo(0.25 + 0.15 * (0.25 / sumOthers), 10);

      expect(sumWeights(w)).toBeCloseTo(1.0, 10);
    });
  });

  // --------------------------------------------------------------------------
  // 5. moodTags 为空 + 高置信度 → mood 减半,其他按比例分摊
  // --------------------------------------------------------------------------
  describe('moodTags 为空', () => {
    it('mood 权重减半,其他 5 维按比例分摊(总和=1.0)', () => {
      const intent = fullMusicIntent();
      intent.moodTags = [];
      const w = resolveDynamicWeights(0.9, intent);

      // 手动验证:
      // 基准 mood=0.20,减半后 mood=0.10,差额 0.10 分给其他 5 维(总和=0.80)
      const sumOthers = 0.15 + 0.15 + 0.10 + 0.15 + 0.25; // 0.80
      expect(w.mood).toBeCloseTo(0.10, 10);
      expect(w.energy).toBeCloseTo(0.15 + 0.10 * (0.15 / sumOthers), 10);
      expect(w.genre).toBeCloseTo(0.15 + 0.10 * (0.15 / sumOthers), 10);
      expect(w.language).toBeCloseTo(0.10 + 0.10 * (0.10 / sumOthers), 10);
      expect(w.vibe).toBeCloseTo(0.15 + 0.10 * (0.15 / sumOthers), 10);
      expect(w.va).toBeCloseTo(0.25 + 0.10 * (0.25 / sumOthers), 10);

      expect(sumWeights(w)).toBeCloseTo(1.0, 10);
    });
  });

  // --------------------------------------------------------------------------
  // 6. genreHints 和 moodTags 都为空 + 高置信度
  // --------------------------------------------------------------------------
  describe('genreHints 和 moodTags 都为空', () => {
    it('genre=0,mood 减半,其他按比例分摊(总和=1.0)', () => {
      const intent = fullMusicIntent();
      intent.genreHints = [];
      intent.moodTags = [];
      const w = resolveDynamicWeights(0.9, intent);

      // genre 先归零,mood 再减半
      expect(w.genre).toBe(0);
      // mood 经过分摊后增加,再减半
      // 步骤 4 后 mood = 0.20 + 0.15 * (0.20/0.85) = 0.2352941176...
      const moodAfterStep4 = 0.20 + 0.15 * (0.20 / 0.85);
      expect(w.mood).toBeCloseTo(moodAfterStep4 / 2, 10);

      expect(sumWeights(w)).toBeCloseTo(1.0, 10);
    });
  });

  // --------------------------------------------------------------------------
  // 7. 边界值:confidence=0.7 不触发降权;confidence=0.699 触发降权
  // --------------------------------------------------------------------------
  describe('置信度边界值', () => {
    it('confidence=0.7 刚好不触发降权(返回 FIVE_DIM)', () => {
      const w = resolveDynamicWeights(0.7, fullMusicIntent());
      expect(w.va).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.va, 10); // 0.25
      expect(w.mood).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.mood, 10); // 0.20
      expect(w.genre).toBeCloseTo(MATCH_WEIGHTS_FIVE_DIM.genre, 10); // 0.15
    });

    it('confidence=0.699 触发降权(返回 VA_DEGRADED)', () => {
      const w = resolveDynamicWeights(0.699, fullMusicIntent());
      expect(w.va).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.va, 10); // 0.10
      expect(w.mood).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.mood, 10); // 0.25
      expect(w.genre).toBeCloseTo(MATCH_WEIGHTS_VA_DEGRADED.genre, 10); // 0.20
    });
  });

  // --------------------------------------------------------------------------
  // 8. 综合:低置信度 + 信号缺失
  // --------------------------------------------------------------------------
  describe('低置信度 + 信号缺失组合', () => {
    it('低置信度 + genreHints 空 → va 降权 + genre 归零', () => {
      const intent = fullMusicIntent();
      intent.genreHints = [];
      const w = resolveDynamicWeights(0.5, intent);

      expect(w.genre).toBe(0);
      // 基准用 VA_DEGRADED {mood:0.25, energy:0.20, genre:0.20, language:0.10, vibe:0.15, va:0.10}
      // genre 的 0.20 分给其他 5 维(总和=0.80)
      const sumOthers = 0.25 + 0.20 + 0.10 + 0.15 + 0.10; // 0.80
      expect(w.va).toBeCloseTo(0.10 + 0.20 * (0.10 / sumOthers), 10);
      expect(sumWeights(w)).toBeCloseTo(1.0, 10);
    });
  });
});
