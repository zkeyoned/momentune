/**
 * sceneMatrix.ts 单元测试(P1-6)
 *
 * 覆盖:SCENE_RELATION_MATRIX 完整性、getSceneRelation 查询、
 *       calcSceneScore 最大匹配、SCENE_EMOTION_PRIOR 先验查询
 *
 * @module algorithm/__tests__/sceneMatrix.test
 */

import { describe, it, expect } from 'vitest';
import {
  SCENE_RELATION_MATRIX,
  SCENE_EMOTION_PRIOR,
  getSceneRelation,
  calcSceneScore,
  getSceneEmotionPrior,
  type ExtendedSceneType,
} from '../config/sceneMatrix.js';
import { SONG_SCENE_TAGS, SCENE_TYPES } from '../types.js';

// ============================================================================
// 1. 矩阵完整性
// ============================================================================

describe('SCENE_RELATION_MATRIX 矩阵完整性', () => {
  const expectedScenes: ExtendedSceneType[] = [
    ...SCENE_TYPES,
    'travel', // 衍生场景
  ];

  it('行数 = 25(24 基础场景 + 1 衍生 travel)', () => {
    const rows = Object.keys(SCENE_RELATION_MATRIX);
    expect(rows.length).toBe(25);
    for (const s of expectedScenes) {
      expect(rows).toContain(s);
    }
  });

  it('每行列数 = 77(覆盖全部 SongSceneTag)', () => {
    for (const scene of expectedScenes) {
      const cols = Object.keys(SCENE_RELATION_MATRIX[scene]);
      expect(cols.length).toBe(SONG_SCENE_TAGS.length);
      for (const tag of SONG_SCENE_TAGS) {
        expect(cols).toContain(tag);
      }
    }
  });

  it('所有值 ∈ [0, 1]', () => {
    for (const scene of expectedScenes) {
      for (const tag of SONG_SCENE_TAGS) {
        const v = SCENE_RELATION_MATRIX[scene][tag];
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('general 列对所有场景 = 0.5(中性,不奖不罚)', () => {
    for (const scene of expectedScenes) {
      expect(SCENE_RELATION_MATRIX[scene].general).toBe(0.5);
    }
  });

  it('对角线强相关:nature→travel/seaside_dusk = 1.0', () => {
    expect(SCENE_RELATION_MATRIX.nature.travel).toBe(1.0);
    expect(SCENE_RELATION_MATRIX.nature.seaside_dusk).toBe(1.0);
  });

  it('对角线强相关:city→city_night = 1.0', () => {
    expect(SCENE_RELATION_MATRIX.city.city_night).toBe(1.0);
  });

  it('对角线强相关:indoor→late_night_emo/rainy_window/cafe_afternoon = 高分', () => {
    expect(SCENE_RELATION_MATRIX.indoor.late_night_emo).toBe(1.0);
    expect(SCENE_RELATION_MATRIX.indoor.rainy_window).toBe(0.9);
    expect(SCENE_RELATION_MATRIX.indoor.cafe_afternoon).toBe(0.9);
  });

  it('对角线强相关:people→party = 1.0', () => {
    expect(SCENE_RELATION_MATRIX.people.party).toBe(1.0);
  });

  it('对角线强相关:heritage→guofeng = 1.0', () => {
    expect(SCENE_RELATION_MATRIX.heritage.guofeng).toBe(1.0);
  });

  it('对角线强相关:travel→travel/road_trip = 1.0', () => {
    expect(SCENE_RELATION_MATRIX.travel.travel).toBe(1.0);
    expect(SCENE_RELATION_MATRIX.travel.road_trip).toBe(1.0);
  });

  it('反差大的场景给低分:nature+party = 0.1', () => {
    expect(SCENE_RELATION_MATRIX.nature.party).toBeLessThanOrEqual(0.2);
  });
});

// ============================================================================
// 2. getSceneRelation 查询
// ============================================================================

describe('getSceneRelation 查询', () => {
  it('已知组合返回矩阵值', () => {
    expect(getSceneRelation('nature', 'seaside_dusk')).toBe(1.0);
    expect(getSceneRelation('city', 'party')).toBe(0.7);
  });

  it('travel 衍生场景可查询', () => {
    expect(getSceneRelation('travel', 'road_trip')).toBe(1.0);
    expect(getSceneRelation('travel', 'morning_sunrise')).toBe(0.8);
  });

  it('未知场景返回 0.5(中性兜底)', () => {
    // 用类型断言绕过编译检查测试兜底
    expect(getSceneRelation('unknown' as ExtendedSceneType, 'party')).toBe(0.5);
  });

  it('所有查询结果 ∈ [0, 1]', () => {
    const scenes: ExtendedSceneType[] = [...SCENE_TYPES, 'travel'];
    for (const s of scenes) {
      for (const t of SONG_SCENE_TAGS) {
        const v = getSceneRelation(s, t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ============================================================================
// 3. calcSceneScore 最大匹配度
// ============================================================================

describe('calcSceneScore 最大匹配度', () => {
  it('空标签集合 → 0.5(中性)', () => {
    expect(calcSceneScore('nature', [])).toBe(0.5);
  });

  it('单标签 → 该标签的关系值', () => {
    expect(calcSceneScore('nature', ['seaside_dusk'])).toBe(1.0);
    expect(calcSceneScore('nature', ['party'])).toBe(0.1);
  });

  it('多标签 → 取最大值', () => {
    // nature: travel=1.0, party=0.1, campus=0.2 → max=1.0
    expect(calcSceneScore('nature', ['party', 'campus', 'travel'])).toBe(1.0);
  });

  it('多标签取最大(非首元素)', () => {
    // city: party=0.7 最高
    expect(calcSceneScore('city', ['campus', 'party', 'guofeng'])).toBe(0.7);
  });

  it('所有标签都不匹配 → 取最大(可能很低)', () => {
    // nature + [party]=0.1 → max=0.1
    expect(calcSceneScore('nature', ['party'])).toBe(0.1);
  });

  it('包含 general → 至少 0.5(general 兜底)', () => {
    expect(calcSceneScore('nature', ['general'])).toBe(0.5);
    // general + 低分标签 → 取 max(0.5, 0.1) = 0.5
    expect(calcSceneScore('nature', ['party', 'general'])).toBe(0.5);
  });

  it('travel 衍生场景', () => {
    expect(calcSceneScore('travel', ['road_trip', 'morning_sunrise'])).toBe(1.0);
  });
});

// ============================================================================
// 4. SCENE_EMOTION_PRIOR 先验查询
// ============================================================================

describe('SCENE_EMOTION_PRIOR 场景×情绪先验', () => {
  it('已知组合返回先验值', () => {
    expect(getSceneEmotionPrior('nature', 'Healing')).toBe(0.85);
    expect(getSceneEmotionPrior('indoor', 'Lonely')).toBe(0.90);
    expect(getSceneEmotionPrior('people', 'Exciting')).toBe(0.90);
  });

  it('travel 衍生场景先验', () => {
    expect(getSceneEmotionPrior('travel', 'Epic')).toBe(0.85);
    expect(getSceneEmotionPrior('travel', 'Exciting')).toBe(0.80);
  });

  it('未知情绪标签 → 0.5(中性兜底)', () => {
    expect(getSceneEmotionPrior('nature', 'UnknownLabel')).toBe(0.5);
  });

  it('未知场景 → 0.5(中性兜底)', () => {
    expect(getSceneEmotionPrior('unknown' as ExtendedSceneType, 'Healing')).toBe(0.5);
  });

  it('所有先验值 ∈ [0, 1]', () => {
    const scenes: ExtendedSceneType[] = [...SCENE_TYPES, 'travel'];
    for (const s of scenes) {
      const priors = SCENE_EMOTION_PRIOR[s];
      if (!priors) continue;
      for (const key of Object.keys(priors)) {
        const v = priors[key as keyof typeof priors];
        if (v === undefined) continue;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('场景主导情绪合理:nature 主导 Healing/Peaceful(高分)', () => {
    const healingPrior = getSceneEmotionPrior('nature', 'Healing');
    const excitingPrior = getSceneEmotionPrior('nature', 'Exciting');
    // 自然场景更适合治愈而非兴奋(虽然 Exciting 也有 0.60)
    expect(healingPrior).toBeGreaterThan(excitingPrior);
  });

  it('场景主导情绪合理:people 主导 Exciting/Joyful(高分)', () => {
    const excitingPrior = getSceneEmotionPrior('people', 'Exciting');
    const lonelyPrior = getSceneEmotionPrior('people', 'Lonely');
    // 人物场景更适合兴奋而非孤独
    expect(excitingPrior).toBeGreaterThan(lonelyPrior);
  });
});
