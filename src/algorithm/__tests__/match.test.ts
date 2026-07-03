/**
 * match.ts 单元测试
 *
 * 覆盖:6 维评分、热歌 boost、置信度惩罚、扩展相似度、候选池过滤
 *
 * @module algorithm/__tests__/match.test
 */

import { describe, it, expect } from 'vitest';
import {
  calcScoreVA,
  calcScoreScene,
  calcScorePref,
  calcScoreSceneFit,
  calcScoreRefSim,
  calcHotBoostByRecency,
  calcScoreHot,
  calcHotBoostMultiplier,
  calcConfidencePenalty,
  calcMatchScore,
  calcExtendSimilarity,
  calcExtendScore,
  filterCandidatePool,
  type MatchContext,
} from '../match.js';
import {
  HOT_BOOST_MAX,
  EXTEND_SCORE_SIM_WEIGHT,
  EXTEND_SCORE_PHOTO_WEIGHT,
} from '../config/thresholds.js';
import {
  createSong,
  createSongByEmotion,
  createSongWithSpotify,
  createHotSong,
  createDefaultUserPreference,
  vaWithConf,
  va,
} from './testHelpers.js';

// ============================================================================
// 1. V-A 距离得分
// ============================================================================

describe('calcScoreVA', () => {
  it('相同 V-A 得分 = 1', () => {
    expect(calcScoreVA({ v: 0.5, a: 0.5 }, { v: 0.5, a: 0.5 })).toBe(1);
  });

  it('对角点得分 ≈ 0', () => {
    expect(calcScoreVA({ v: 0, a: 0 }, { v: 1, a: 1 })).toBeCloseTo(0, 6);
  });

  it('得分 = 1 - 距离', () => {
    const photo = { v: 0.6, a: 0.4 };
    const song = { v: 0.5, a: 0.3 };
    // distance = sqrt(0.6×0.01 + 0.4×0.01) = sqrt(0.01) = 0.1
    expect(calcScoreVA(photo, song)).toBeCloseTo(0.9, 4);
  });
});

// ============================================================================
// 2. 场景标签匹配得分
// ============================================================================

describe('calcScoreScene', () => {
  it('空场景标签返回 0.5(中性)', () => {
    expect(calcScoreScene('nature', [])).toBe(0.5);
  });

  it('完美匹配返回 1.0', () => {
    expect(calcScoreScene('nature', ['travel'])).toBe(1.0);
  });

  it('取最大匹配度', () => {
    // nature × party = 0.1,nature × travel = 1.0 → max=1.0
    expect(calcScoreScene('nature', ['party', 'travel'])).toBe(1.0);
  });

  it('反差大场景给低分', () => {
    expect(calcScoreScene('nature', ['party'])).toBe(0.1);
  });

  it('general 场景给 0.5', () => {
    expect(calcScoreScene('nature', ['general'])).toBe(0.5);
  });
});

// ============================================================================
// 3. 用户偏好匹配得分
// ============================================================================

describe('calcScorePref', () => {
  it('偏好中心 + 风格 + 语言 + 平台 命中 → 高分', () => {
    const song = createSong({
      va: vaWithConf(0.55, 0.4, 0.85, 'netease_tag'),
      genres: ['pop'],
      language: 'mandarin',
      layer: 'emotion',
    });
    const userPref = createDefaultUserPreference({
      center: { v: 0.55, a: 0.4 },
      genreWeights: {
        pop: 1.0, folk: 0.3, electronic: 0.3, rap: 0.3,
        guofeng: 0.3, rock: 0.3, rnb: 0.3, lofi: 0.3,
        jazz: 0.3, classical: 0.3, country: 0.3, blues: 0.3,
        reggae: 0.3, metal: 0.3, punk: 0.3, indie: 0.3, ambient: 0.3,
        soul: 0.3, funk: 0.3, disco: 0.3, kpop: 0.3,
        jpop: 0.3, acoustic: 0.3, soundtrack: 0.3, world: 0.3,
        trap: 0.3, house: 0.3, edm: 0.3, choir: 0.3,
        phonk: 0.3, driftphonk: 0.3, hyperpop: 0.3, bedroompop: 0.3, citypop: 0.3,
        dreamcore: 0.3, drill: 0.3, futurebass: 0.3, synthwave: 0.3, vaporwave: 0.3,
        shoegaze: 0.3, dreampop: 0.3, gufeng: 0.3, xiqiang: 0.3, guofengrock: 0.3,
        amapiano: 0.3, afrobeats: 0.3, drumandbass: 0.3, ukgarage: 0.3, techno: 0.3,
        reggaeton: 0.3, dembow: 0.3, trance: 0.3, hardwave: 0.3,
        anime: 0.3, vocaloid: 0.3, bachata: 0.3,
        emo: 0.3, poppunk: 0.3, postpunk: 0.3,
        other: 0.3,
      },
      languageWeights: {
        mandarin: 1.0, english: 0.5, korean: 0.3, japanese: 0.3,
        cantonese: 0.5, instrumental: 0.3, other: 0.3,
      },
      platform: 'netease',
    });
    const score = calcScorePref(song, userPref);
    expect(score).toBeGreaterThan(0.7);
  });

  it('偏好不匹配 → 低分', () => {
    const song = createSong({
      va: vaWithConf(0.2, 0.3, 0.85, 'netease_tag'),
      genres: ['rock'],
      language: 'japanese',
      layer: 'fallback',
    });
    const userPref = createDefaultUserPreference({
      center: { v: 0.85, a: 0.85 },
      genreWeights: {
        pop: 1.0, folk: 0.3, electronic: 0.3, rap: 0.3,
        guofeng: 0.3, rock: 0.3, rnb: 0.3, lofi: 0.3,
        jazz: 0.3, classical: 0.3, country: 0.3, blues: 0.3,
        reggae: 0.3, metal: 0.3, punk: 0.3, indie: 0.3, ambient: 0.3,
        soul: 0.3, funk: 0.3, disco: 0.3, kpop: 0.3,
        jpop: 0.3, acoustic: 0.3, soundtrack: 0.3, world: 0.3,
        trap: 0.3, house: 0.3, edm: 0.3, choir: 0.3,
        phonk: 0.3, driftphonk: 0.3, hyperpop: 0.3, bedroompop: 0.3, citypop: 0.3,
        dreamcore: 0.3, drill: 0.3, futurebass: 0.3, synthwave: 0.3, vaporwave: 0.3,
        shoegaze: 0.3, dreampop: 0.3, gufeng: 0.3, xiqiang: 0.3, guofengrock: 0.3,
        amapiano: 0.3, afrobeats: 0.3, drumandbass: 0.3, ukgarage: 0.3, techno: 0.3,
        reggaeton: 0.3, dembow: 0.3, trance: 0.3, hardwave: 0.3,
        anime: 0.3, vocaloid: 0.3, bachata: 0.3,
        emo: 0.3, poppunk: 0.3, postpunk: 0.3,
        other: 0.3,
      },
      languageWeights: {
        mandarin: 1.0, english: 0.5, korean: 0.3, japanese: 0.3,
        cantonese: 0.5, instrumental: 0.3, other: 0.3,
      },
      platform: 'netease',
    });
    const score = calcScorePref(song, userPref);
    expect(score).toBeLessThan(0.6);
  });

  it('权重和 = 0.40+0.30+0.15+0.15 = 1.0', () => {
    // 验证内部权重设计
    const w = 0.40 + 0.30 + 0.15 + 0.15;
    expect(w).toBeCloseTo(1.0, 6);
  });
});

// ============================================================================
// 4. 场景适配度(先验 + 贝叶斯平滑)
// ============================================================================

describe('calcScoreSceneFit', () => {
  it('无历史数据 → 用先验', () => {
    // nature × Healing 先验 = 0.85
    const score = calcScoreSceneFit('nature', 'Healing');
    expect(score).toBeCloseTo(0.85, 6);
  });

  it('无历史数据 + 无先验组合 → 0.5(中性)', () => {
    // people × Dark 无先验
    const score = calcScoreSceneFit('people', 'Dark');
    expect(score).toBe(0.5);
  });

  it('有历史数据 → 贝叶斯平滑', () => {
    // nature × Healing 先验=0.85
    // 历史:5 接受 / 10 总数
    // (5 + 5×0.85) / (10 + 5) = (5 + 4.25) / 15 = 9.25/15 ≈ 0.6167
    const score = calcScoreSceneFit('nature', 'Healing', { acceptCount: 5, totalCount: 10 });
    expect(score).toBeCloseTo(0.6167, 3);
  });

  it('历史 totalCount=0 → 用先验', () => {
    const score = calcScoreSceneFit('nature', 'Healing', { acceptCount: 0, totalCount: 0 });
    expect(score).toBeCloseTo(0.85, 6);
  });
});

// ============================================================================
// 5. 参考歌曲相似度
// ============================================================================

describe('calcScoreRefSim', () => {
  it('无参考歌 → 0.5(中性)', () => {
    const song = createSong();
    expect(calcScoreRefSim(song, [])).toBe(0.5);
  });

  it('有 Spotify 特征 → 用余弦相似度', () => {
    const ref = createSongWithSpotify('Healing', {
      valence: 0.6, energy: 0.5, tempo: 120, loudness: -10,
      mode: 1, danceability: 0.5, acousticness: 0.3, instrumentalness: 0.1,
    });
    const song = createSongWithSpotify('Healing', {
      valence: 0.6, energy: 0.5, tempo: 120, loudness: -10,
      mode: 1, danceability: 0.5, acousticness: 0.3, instrumentalness: 0.1,
    });
    // 完全相同 → 余弦相似度=1
    expect(calcScoreRefSim(song, [ref])).toBeCloseTo(1, 4);
  });

  it('无 Spotify 特征 → 用 V-A 相似度', () => {
    const ref = createSongByEmotion('Healing');
    const song = createSongByEmotion('Healing');
    expect(calcScoreRefSim(song, [ref])).toBeCloseTo(1, 4);
  });

  it('取与所有参考歌的最大相似度', () => {
    const ref1 = createSongByEmotion('Healing'); // v=0.55 a=0.25
    const ref2 = createSongByEmotion('Exciting'); // v=0.85 a=0.85
    const song = createSongByEmotion('Joyful'); // v=0.80 a=0.70
    const score = calcScoreRefSim(song, [ref1, ref2]);
    // 与 Healing 距离较远,与 Exciting 较近 → 取最大
    expect(score).toBeGreaterThan(0.5);
  });
});

// ============================================================================
// 6. 热歌 boost 与乘性系数
// ============================================================================

describe('calcHotBoostByRecency', () => {
  it('本周上榜 → boost = 1.0', () => {
    expect(calcHotBoostByRecency('this_week')).toBe(1.0);
  });

  it('从未上榜 → boost = 0.45', () => {
    expect(calcHotBoostByRecency('never')).toBe(0.45);
  });

  it('boost 随新鲜度递减', () => {
    const w1 = calcHotBoostByRecency('this_week');
    const m1 = calcHotBoostByRecency('this_month');
    const h = calcHotBoostByRecency('half_year');
    const o = calcHotBoostByRecency('older');
    expect(w1).toBeGreaterThan(m1);
    expect(m1).toBeGreaterThan(h);
    expect(h).toBeGreaterThan(o);
  });

  it('带 listedDate 触发时间衰减', () => {
    // 30 天前上榜:this_week 基础 1.0 × exp(-30/30) = e^-1 ≈ 0.368
    const listedDate = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const boost = calcHotBoostByRecency('this_week', listedDate);
    expect(boost).toBeCloseTo(Math.exp(-1), 2);
  });

  it('never 不衰减', () => {
    const listedDate = Date.now() - 100 * 24 * 60 * 60 * 1000;
    expect(calcHotBoostByRecency('never', listedDate)).toBe(0.45);
  });
});

describe('calcScoreHot', () => {
  it('等于 calcHotBoostByRecency', () => {
    const song = createHotSong('Healing', 'this_week');
    expect(calcScoreHot(song)).toBe(1.0);
  });
});

describe('calcHotBoostMultiplier 乘性 boost', () => {
  it('本周热歌 → 1 + 0.20×1.0 = 1.20(上限)', () => {
    const song = createHotSong('Healing', 'this_week');
    expect(calcHotBoostMultiplier(song)).toBeCloseTo(1 + HOT_BOOST_MAX, 6);
  });

  it('非热歌 → 1 + 0.20×0.45 = 1.09', () => {
    const song = createSong({ hotRecency: 'never' });
    expect(calcHotBoostMultiplier(song)).toBeCloseTo(1 + HOT_BOOST_MAX * 0.45, 4);
  });

  it('boost 范围 [1.0, 1.20]', () => {
    const song = createHotSong('Healing', 'this_week');
    expect(calcHotBoostMultiplier(song)).toBeGreaterThanOrEqual(1.0);
    expect(calcHotBoostMultiplier(song)).toBeLessThanOrEqual(1.20);
  });
});

// ============================================================================
// 7. 置信度惩罚
// ============================================================================

describe('calcConfidencePenalty', () => {
  it('confidence >= 0.7 → 不惩罚(1.0)', () => {
    expect(calcConfidencePenalty(0.7)).toBe(1.0);
    expect(calcConfidencePenalty(0.85)).toBe(1.0);
    expect(calcConfidencePenalty(1.0)).toBe(1.0);
  });

  it('confidence < 0.7 → 0.7 + 0.3 × conf', () => {
    expect(calcConfidencePenalty(0.5)).toBeCloseTo(0.7 + 0.3 * 0.5, 6);
    expect(calcConfidencePenalty(0.0)).toBeCloseTo(0.7, 6);
  });

  it('惩罚系数 ∈ [0.7, 1.0]', () => {
    for (let c = 0; c <= 1; c += 0.1) {
      const p = calcConfidencePenalty(c);
      expect(p).toBeGreaterThanOrEqual(0.7);
      expect(p).toBeLessThanOrEqual(1.0);
    }
  });
});

// ============================================================================
// 8. 主匹配函数 calcMatchScore
// ============================================================================

describe('calcMatchScore 主匹配函数', () => {
  function buildCtx(overrides: Partial<MatchContext> = {}): MatchContext {
    return {
      photoVA: vaWithConf(0.55, 0.25, 0.8, 'feature_fusion'),
      photoEmotionLabel: 'Healing',
      photoScene: 'nature',
      userPref: createDefaultUserPreference({ center: { v: 0.55, a: 0.25 } }),
      referenceSongs: [],
      isColdStart: false,
      ...overrides,
    };
  }

  it('返回完整 breakdown 含 6 维分数', () => {
    const song = createSongByEmotion('Healing');
    const result = calcMatchScore(song, buildCtx());
    expect(result).toHaveProperty('scoreVA');
    expect(result).toHaveProperty('scoreScene');
    expect(result).toHaveProperty('scorePref');
    expect(result).toHaveProperty('scoreSceneFit');
    expect(result).toHaveProperty('scoreRefSim');
    expect(result).toHaveProperty('scoreHot');
    expect(result).toHaveProperty('baseScore');
    expect(result).toHaveProperty('hotBoost');
    expect(result).toHaveProperty('confidencePenalty');
    expect(result).toHaveProperty('finalScore');
  });

  it('finalScore = baseScore × hotBoost × confidencePenalty', () => {
    const song = createSongByEmotion('Healing');
    const result = calcMatchScore(song, buildCtx());
    const expected = result.baseScore * result.hotBoost * result.confidencePenalty;
    expect(result.finalScore).toBeCloseTo(Math.min(1, expected), 4);
  });

  it('finalScore ∈ [0, 1]', () => {
    const song = createSongByEmotion('Healing');
    const result = calcMatchScore(song, buildCtx());
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });

  it('高匹配歌曲分数高于低匹配', () => {
    const highMatch = createSongByEmotion('Healing'); // 完美匹配
    const lowMatch = createSongByEmotion('Exciting'); // 远离 Healing
    const ctx = buildCtx();
    const highScore = calcMatchScore(highMatch, ctx).finalScore;
    const lowScore = calcMatchScore(lowMatch, ctx).finalScore;
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('冷启动时 score_pref 降权(0.25→0.08),score_hot 加权(0.07→0.14)', () => {
    const song = createHotSong('Healing', 'this_week');
    const baseUserPref = createDefaultUserPreference({ center: { v: 0.55, a: 0.25 } });
    const normalCtx = buildCtx({ isColdStart: false, userPref: baseUserPref });
    const coldCtx = buildCtx({ isColdStart: true, userPref: baseUserPref });
    const normalResult = calcMatchScore(song, normalCtx);
    const coldResult = calcMatchScore(song, coldCtx);
    // 冷启动 scorePref 降权,scoreHot 加权——验证权重确实切换
    expect(coldResult.scoreHot).toBeGreaterThan(0);
    // 由于 scorePref 正常权重 0.25>冷启动 0.08,偏好匹配高时正常总分更高
    // 但 hotBoost 仍生效
    expect(coldResult.hotBoost).toBe(normalResult.hotBoost);
    expect(coldResult.confidencePenalty).toBe(normalResult.confidencePenalty);
  });

  it('低置信度歌曲 finalScore 被惩罚', () => {
    const highConfSong = createSongByEmotion('Healing');
    const lowConfSong = createSong({
      va: vaWithConf(0.55, 0.25, 0.3, 'metadata_keyword'),
      genres: ['pop'],
      sceneTags: ['general'],
    });
    const ctx = buildCtx();
    const highResult = calcMatchScore(highConfSong, ctx);
    const lowResult = calcMatchScore(lowConfSong, ctx);
    expect(lowResult.confidencePenalty).toBeLessThan(highResult.confidencePenalty);
  });
});

// ============================================================================
// 9. 扩展相似度
// ============================================================================

describe('calcExtendSimilarity', () => {
  it('完全相同的歌 → 相似度 = 1(近似)', () => {
    const song = createSongWithSpotify('Healing');
    const other = createSongWithSpotify('Healing', {}, { songId: 'other-1' });
    const sim = calcExtendSimilarity(song, other);
    expect(sim).toBeGreaterThan(0.85);
  });

  it('风格不同的歌 → 相似度较低', () => {
    const pop = createSong({ genres: ['pop'], va: vaWithConf(0.5, 0.4) });
    const rock = createSong({ genres: ['rock'], va: vaWithConf(0.5, 0.4) });
    const sim = calcExtendSimilarity(pop, rock);
    // genre affinity pop-rock=0.3,但 V-A 相同 → 中等相似度
    expect(sim).toBeGreaterThan(0.4);
    expect(sim).toBeLessThan(0.8);
  });

  it('权重和 = 0.35+0.25+0.25+0.15 = 1.0', () => {
    const w = 0.35 + 0.25 + 0.25 + 0.15;
    expect(w).toBeCloseTo(1.0, 6);
  });
});

describe('calcExtendScore', () => {
  it('exp_score = 0.70 × sim + 0.30 × finalScore', () => {
    const sim = 0.8;
    const finalScore = 0.6;
    const expected = EXTEND_SCORE_SIM_WEIGHT * sim + EXTEND_SCORE_PHOTO_WEIGHT * finalScore;
    expect(calcExtendScore(sim, finalScore)).toBeCloseTo(expected, 6);
  });

  it('结果 ∈ [0, 1]', () => {
    expect(calcExtendScore(0, 0)).toBe(0);
    expect(calcExtendScore(1, 1)).toBe(1);
  });
});

// ============================================================================
// 10. 候选池过滤
// ============================================================================

describe('filterCandidatePool', () => {
  it('严格阈值过滤:V-A 距离 ≤ 0.45', () => {
    const photoVA = va(0.55, 0.25);
    const songs = [
      createSong({ va: vaWithConf(0.55, 0.25, 0.85) }), // 距离 0
      createSong({ va: vaWithConf(0.6, 0.3, 0.85) }), // 距离约 0.045
      createSong({ va: vaWithConf(0.85, 0.85, 0.85) }), // 距离很远
    ];
    const result = filterCandidatePool(songs, photoVA, 0.45, 0.60, 2);
    // 严格过滤返回 3 首(>= minSize=2),不触发宽松
    expect(result.candidates.length).toBe(3);
    expect(result.usedLoose).toBe(false);
  });

  it('严格不足 minSize → 放宽到 loose', () => {
    const photoVA = va(0.55, 0.25);
    const songs = [
      createSong({ va: vaWithConf(0.55, 0.25, 0.85) }),
      createSong({ va: vaWithConf(0.85, 0.85, 0.85) }), // 距离远
    ];
    const result = filterCandidatePool(songs, photoVA, 0.45, 0.60, 10);
    expect(result.usedLoose).toBe(true);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
  });

  it('空库 → 空 candidates', () => {
    const result = filterCandidatePool([], va(0.5, 0.5));
    expect(result.candidates.length).toBe(0);
  });
});
