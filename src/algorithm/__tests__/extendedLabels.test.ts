/**
 * 扩展标签系统完整性测试(第 6 轮:71 情绪 / 60 风格 / 77 歌曲场景 / 24 照片场景)
 *
 * 验证 71 情绪标签 / 60 音乐风格 / 77 歌曲场景 / 24 照片场景
 * 以及扩展的时段(13)/天气(14)/构图(15)/表情(20)标签
 *
 * @module algorithm/__tests__/extendedLabels.test
 */

import { describe, it, expect } from 'vitest';
import { EMOTION_VA_COORDINATES } from '../config/emotionLabels.js';
import { GENRE_AFFINITY, GENRE_KEYWORD_MAPPING } from '../config/genreTags.js';
import {
  SCENE_RELATION_MATRIX,
  SCENE_EMOTION_PRIOR,
} from '../config/sceneMatrix.js';
import {
  SCENE_VA_MAP,
  TIME_OF_DAY_VA_MAP,
  WEATHER_VA_MAP,
  COMPOSITION_VA_MAP,
  getPeopleVA,
} from '../config/featureWeights.js';
import {
  EMOTION_LABELS,
  GENRE_TAGS,
  SONG_SCENE_TAGS,
  SCENE_TYPES,
  TIME_OF_DAY,
  WEATHER_TYPES,
  COMPOSITION_TYPES,
  FACE_EMOTIONS,
} from '../types.js';

// ============================================================================
// 1. 71 情绪标签 V-A 坐标完整性 + 分布合理性
// ============================================================================

describe('71 情绪标签 V-A 坐标', () => {
  it('EMOTION_LABELS = 71 个', () => {
    expect(EMOTION_LABELS.length).toBe(71);
  });

  it('EMOTION_VA_COORDINATES 覆盖全部 71 标签', () => {
    for (const label of EMOTION_LABELS) {
      expect(EMOTION_VA_COORDINATES[label]).toBeDefined();
    }
    expect(Object.keys(EMOTION_VA_COORDINATES).length).toBe(71);
  });

  it('所有 V-A 值在 [0, 1] 范围', () => {
    for (const [, va] of Object.entries(EMOTION_VA_COORDINATES)) {
      expect(va.v).toBeGreaterThanOrEqual(0);
      expect(va.v).toBeLessThanOrEqual(1);
      expect(va.a).toBeGreaterThanOrEqual(0);
      expect(va.a).toBeLessThanOrEqual(1);
    }
  });

  it('第 3 轮新增 14 标签 V-A 坐标正确', () => {
    const newLabels: Record<string, { v: number; a: number }> = {
      // 中国古典文化情绪
      Wistful: { v: 0.30, a: 0.32 },
      Zen: { v: 0.55, a: 0.08 },
      Heroic: { v: 0.77, a: 0.80 },
      PartingSorrow: { v: 0.25, a: 0.42 },
      Smitten: { v: 0.85, a: 0.60 },
      // GEMS-25 学术子项
      Awe: { v: 0.62, a: 0.68 },
      Triumphant: { v: 0.88, a: 0.82 },
      Inspired: { v: 0.70, a: 0.58 },
      // 音乐特有情绪
      Groove: { v: 0.70, a: 0.65 },
      Ethereal: { v: 0.62, a: 0.12 },
      Hype: { v: 0.72, a: 0.92 },
      // 抖音/汽水音乐平台热词
      Overwhelmed: { v: 0.28, a: 0.78 },
      Resonant: { v: 0.50, a: 0.70 },
      Masterpiece: { v: 0.78, a: 0.55 },
    };
    for (const [label, expected] of Object.entries(newLabels)) {
      expect(EMOTION_VA_COORDINATES[label as keyof typeof EMOTION_VA_COORDINATES]).toEqual(expected);
    }
  });

  it('第 4 轮新增 14 标签 V-A 坐标正确', () => {
    const newLabels: Record<string, { v: number; a: number }> = {
      // 中国古典文化情绪补充
      Wanderer: { v: 0.38, a: 0.22 },
      Ambitious: { v: 0.74, a: 0.72 },
      TragicHeroic: { v: 0.42, a: 0.88 },
      Leisurely: { v: 0.70, a: 0.18 },
      Lovesick: { v: 0.32, a: 0.52 },
      // GEMS-25 剩余子项
      Solemnity: { v: 0.48, a: 0.28 },
      Spiritual: { v: 0.58, a: 0.20 },
      Activation: { v: 0.62, a: 0.75 },
      // 音乐特有情绪补充
      Anthemic: { v: 0.78, a: 0.88 },
      Hypnotic: { v: 0.48, a: 0.38 },
      Aggressive: { v: 0.22, a: 0.92 },
      // 抖音/网络热词补充
      Addicted: { v: 0.55, a: 0.78 },
      EmoNight: { v: 0.24, a: 0.48 },
      Vibes: { v: 0.60, a: 0.35 },
    };
    for (const [label, expected] of Object.entries(newLabels)) {
      expect(EMOTION_VA_COORDINATES[label as keyof typeof EMOTION_VA_COORDINATES]).toEqual(expected);
    }
  });

  it('第 5 轮新增 7 标签 V-A 坐标正确', () => {
    const newLabels: Record<string, { v: number; a: number }> = {
      // 第 5 轮新增 7 标签(填补 V-A 空白,CRITIQUE 后调整坐标)
      AbstractBanger: { v: 0.54, a: 0.93 },
      SensualNeon: { v: 0.40, a: 0.65 },
      Cinematic: { v: 0.56, a: 0.52 },
      EtherealJoy: { v: 0.80, a: 0.22 },
      Playful: { v: 0.86, a: 0.45 },
      Brooding: { v: 0.14, a: 0.40 },
      TriumphantJoy: { v: 0.95, a: 0.55 },
    };
    for (const [label, expected] of Object.entries(newLabels)) {
      expect(EMOTION_VA_COORDINATES[label as keyof typeof EMOTION_VA_COORDINATES]).toEqual(expected);
    }
  });

  it('第 6 轮新增 8 标签 V-A 坐标正确(填补 V-A 极端区域空白)', () => {
    const newLabels: Record<string, { v: number; a: number }> = {
      // 第 6 轮新增 8 标签(填补 V-A 极端区域,与最近标签距离 > 0.08)
      Despair: { v: 0.05, a: 0.18 }, // 极低 V 低 A
      Desolate: { v: 0.15, a: 0.10 }, // 低 V 极低 A
      Rage: { v: 0.08, a: 0.97 }, // 极低 V 极高 A,全系统最高 A
      Panic: { v: 0.15, a: 0.78 }, // 低 V 中高 A
      Euphoric: { v: 0.94, a: 0.96 }, // 极高 V 极高 A
      Exhilarating: { v: 0.95, a: 0.72 }, // CRITIQUE 后调整,避开 Smitten
      Burnout: { v: 0.38, a: 0.05 }, // CRITIQUE 后调整,避开 Sentimental
      TearJerker: { v: 0.25, a: 0.65 }, // 中低 V 中高 A
    };
    for (const [label, expected] of Object.entries(newLabels)) {
      expect(EMOTION_VA_COORDINATES[label as keyof typeof EMOTION_VA_COORDINATES]).toEqual(expected);
    }
  });

  it('第 6 轮新标签 V-A 密度检查(与最近现有标签距离 > 0.08)', () => {
    // 验证 8 个新标签与所有现有标签的最近距离都 > 0.08(加权距离 sqrt(0.6*Δv² + 0.4*Δa²))
    const newLabels = ['Despair', 'Desolate', 'Rage', 'Panic', 'Euphoric', 'Exhilarating', 'Burnout', 'TearJerker'];
    const allEntries = Object.entries(EMOTION_VA_COORDINATES);
    const MIXED_EMOTION_RADIUS = 0.08;
    for (const newLabel of newLabels) {
      const newVa = EMOTION_VA_COORDINATES[newLabel as keyof typeof EMOTION_VA_COORDINATES];
      let minDist = Infinity;
      for (const [label, va] of allEntries) {
        if (label === newLabel) continue;
        const dv = newVa.v - va.v;
        const da = newVa.a - va.a;
        const dist = Math.sqrt(0.6 * dv * dv + 0.4 * da * da);
        if (dist < minDist) minDist = dist;
      }
      // 检查最近距离是否 > 0.08(CRITIQUE 后收紧,不再允许临界值 0.06-0.08)
      expect(minDist).toBeGreaterThan(MIXED_EMOTION_RADIUS);
      // 记录最近邻居(仅用于调试,不参与断言)
      // console.log(`${newLabel} nearest: ${nearestLabel} dist=${minDist.toFixed(3)}`);
    }
  });

  it('V-A 分布覆盖四个象限', () => {
    const labels = Object.entries(EMOTION_VA_COORDINATES);
    const q1 = labels.filter(([, va]) => va.v > 0.5 && va.a > 0.5); // 高V高A
    const q2 = labels.filter(([, va]) => va.v > 0.5 && va.a <= 0.5); // 高V低A
    const q3 = labels.filter(([, va]) => va.v <= 0.5 && va.a <= 0.5); // 低V低A
    const q4 = labels.filter(([, va]) => va.v <= 0.5 && va.a > 0.5); // 低V高A
    expect(q1.length).toBeGreaterThan(0);
    expect(q2.length).toBeGreaterThan(0);
    expect(q3.length).toBeGreaterThan(0);
    expect(q4.length).toBeGreaterThan(0);
  });

  it('Burnout 是最低唤醒度标签(第 6 轮 CRITIQUE 后 A=0.05,超过 Zen 0.08)', () => {
    const minA = Math.min(...Object.values(EMOTION_VA_COORDINATES).map((va) => va.a));
    expect(EMOTION_VA_COORDINATES.Burnout.a).toBe(minA);
    expect(EMOTION_VA_COORDINATES.Burnout.a).toBeLessThan(0.1);
    // Zen 仍是次低唤醒标签(A=0.08)
    expect(EMOTION_VA_COORDINATES.Zen.a).toBe(0.08);
  });

  it('Rage 是最高唤醒度标签(第 6 轮新增,A=0.97,超过 Hype 0.92)', () => {
    expect(EMOTION_VA_COORDINATES.Rage.a).toBeGreaterThanOrEqual(0.95);
    // Hype/Aggressive 仍是高唤醒标签
    expect(EMOTION_VA_COORDINATES.Hype.a).toBeGreaterThanOrEqual(0.92);
    expect(EMOTION_VA_COORDINATES.Aggressive.a).toBeGreaterThanOrEqual(0.92);
    // Euphoric 是次高唤醒(0.96)
    expect(EMOTION_VA_COORDINATES.Euphoric.a).toBeGreaterThanOrEqual(0.95);
  });

  it('TriumphantJoy 仍是最高效价标签(V=0.95,Euphoric 0.94 次之)', () => {
    const maxV = Math.max(...Object.values(EMOTION_VA_COORDINATES).map((va) => va.v));
    expect(EMOTION_VA_COORDINATES.TriumphantJoy.v).toBe(maxV);
    expect(EMOTION_VA_COORDINATES.TriumphantJoy.v).toBeGreaterThan(0.90);
    // Euphoric 是次高效价
    expect(EMOTION_VA_COORDINATES.Euphoric.v).toBeGreaterThanOrEqual(0.94);
  });

  it('Despair 是最低效价标签(第 6 轮新增,V=0.05,比 Brooding 0.14 更低)', () => {
    const minV = Math.min(...Object.values(EMOTION_VA_COORDINATES).map((va) => va.v));
    expect(EMOTION_VA_COORDINATES.Despair.v).toBe(minV);
    expect(EMOTION_VA_COORDINATES.Despair.v).toBeLessThan(0.1);
  });

  it('Exciting 仍是高唤醒高积极标签', () => {
    expect(EMOTION_VA_COORDINATES.Exciting.a).toBeGreaterThanOrEqual(0.85);
    expect(EMOTION_VA_COORDINATES.Exciting.v).toBeGreaterThanOrEqual(0.85);
  });
});

// ============================================================================
// 2. 60 音乐风格 GENRE_AFFINITY 矩阵完整性 + 对称性
// ============================================================================

describe('60 音乐风格 GENRE_AFFINITY 矩阵', () => {
  it('GENRE_TAGS = 60 个(59 主类 + other)', () => {
    expect(GENRE_TAGS.length).toBe(60);
  });

  it('GENRE_AFFINITY 覆盖全部 60 风格', () => {
    for (const g of GENRE_TAGS) {
      expect(GENRE_AFFINITY[g]).toBeDefined();
    }
    expect(Object.keys(GENRE_AFFINITY).length).toBe(60);
  });

  it('对角线 = 1.0', () => {
    for (const g of GENRE_TAGS) {
      expect(GENRE_AFFINITY[g][g]).toBe(1.0);
    }
  });

  it('矩阵对称:affinity(a,b) = affinity(b,a)', () => {
    for (const a of GENRE_TAGS) {
      for (const b of GENRE_TAGS) {
        const ab = GENRE_AFFINITY[a][b] ?? 0.2;
        const ba = GENRE_AFFINITY[b][a] ?? 0.2;
        expect(ab).toBeCloseTo(ba, 6);
      }
    }
  });

  it('第 3 轮新增 8 风格关键词映射存在', () => {
    const newGenres = ['soul', 'funk', 'disco', 'kpop', 'jpop', 'acoustic', 'soundtrack', 'world'];
    const coveredGenres = new Set(GENRE_KEYWORD_MAPPING.map((e) => e.genre));
    for (const g of newGenres) {
      expect(coveredGenres.has(g as never)).toBe(true);
    }
  });

  it('第 4 轮新增 4 风格关键词映射存在', () => {
    const newGenres = ['trap', 'house', 'edm', 'choir'];
    const coveredGenres = new Set(GENRE_KEYWORD_MAPPING.map((e) => e.genre));
    for (const g of newGenres) {
      expect(coveredGenres.has(g as never)).toBe(true);
    }
  });

  it('第 5 轮新增 15 风格关键词映射存在', () => {
    const newGenres = ['phonk', 'driftphonk', 'hyperpop', 'bedroompop', 'citypop', 'dreamcore', 'drill', 'futurebass', 'synthwave', 'vaporwave', 'shoegaze', 'dreampop', 'gufeng', 'xiqiang', 'guofengrock'];
    const coveredGenres = new Set(GENRE_KEYWORD_MAPPING.map((e) => e.genre));
    for (const g of newGenres) {
      expect(coveredGenres.has(g as never)).toBe(true);
    }
  });

  it('第 6 轮新增 15 风格关键词映射存在', () => {
    const newGenres = ['amapiano', 'afrobeats', 'drumandbass', 'ukgarage', 'techno', 'reggaeton', 'dembow', 'trance', 'hardwave', 'anime', 'vocaloid', 'bachata', 'emo', 'poppunk', 'postpunk'];
    const coveredGenres = new Set(GENRE_KEYWORD_MAPPING.map((e) => e.genre));
    for (const g of newGenres) {
      expect(coveredGenres.has(g as never)).toBe(true);
    }
  });

  it('rock→metal 和 rock→punk 高亲和(≥0.8)', () => {
    expect(GENRE_AFFINITY.rock.metal).toBeGreaterThanOrEqual(0.8);
    expect(GENRE_AFFINITY.rock.punk).toBeGreaterThanOrEqual(0.8);
  });

  it('jazz→blues 高亲和(≥0.7)', () => {
    expect(GENRE_AFFINITY.jazz.blues).toBeGreaterThanOrEqual(0.7);
  });

  it('classical→ambient 高亲和(≥0.6)', () => {
    expect(GENRE_AFFINITY.classical.ambient).toBeGreaterThanOrEqual(0.6);
  });

  it('第 3 轮:soul→rnb 高亲和(≥0.8,同源)', () => {
    expect(GENRE_AFFINITY.soul.rnb).toBeGreaterThanOrEqual(0.8);
  });

  it('第 3 轮:funk→disco 高亲和(≥0.8,同源)', () => {
    expect(GENRE_AFFINITY.funk.disco).toBeGreaterThanOrEqual(0.8);
  });

  it('第 3 轮:kpop→pop 高亲和(≥0.8)', () => {
    expect(GENRE_AFFINITY.kpop.pop).toBeGreaterThanOrEqual(0.8);
  });

  it('第 3 轮:acoustic→folk 高亲和(≥0.8)', () => {
    expect(GENRE_AFFINITY.acoustic.folk).toBeGreaterThanOrEqual(0.8);
  });

  it('第 3 轮:soundtrack→classical 高亲和(≥0.7)', () => {
    expect(GENRE_AFFINITY.soundtrack.classical).toBeGreaterThanOrEqual(0.7);
  });

  it('第 4 轮:trap→rap 高亲和(≥0.85,子流派同源)', () => {
    expect(GENRE_AFFINITY.trap.rap).toBeGreaterThanOrEqual(0.85);
  });

  it('第 4 轮:house→electronic 高亲和(≥0.8,子流派同源)', () => {
    expect(GENRE_AFFINITY.house.electronic).toBeGreaterThanOrEqual(0.8);
  });

  it('第 4 轮:edm→electronic 高亲和(≥0.85,子流派同源)', () => {
    expect(GENRE_AFFINITY.edm.electronic).toBeGreaterThanOrEqual(0.85);
  });

  it('第 4 轮:choir→classical 高亲和(≥0.7,人声古典同源)', () => {
    expect(GENRE_AFFINITY.choir.classical).toBeGreaterThanOrEqual(0.7);
  });

  it('第 6 轮:amapiano→house 高亲和(≥0.85,log drum 深层浩室)', () => {
    expect(GENRE_AFFINITY.amapiano.house).toBeGreaterThanOrEqual(0.85);
  });

  it('第 6 轮:afrobeats→pop 高亲和(≥0.8,西非流行)', () => {
    expect(GENRE_AFFINITY.afrobeats.pop).toBeGreaterThanOrEqual(0.8);
  });

  it('第 6 轮:drumandbass→electronic 高亲和(≥0.85,UK 锐舞)', () => {
    expect(GENRE_AFFINITY.drumandbass.electronic).toBeGreaterThanOrEqual(0.85);
  });

  it('第 6 轮:techno→electronic 高亲和(≥0.85,工业电子)', () => {
    expect(GENRE_AFFINITY.techno.electronic).toBeGreaterThanOrEqual(0.85);
  });

  it('第 6 轮:reggaeton→reggae 高亲和(≥0.8,拉丁节奏同源)', () => {
    expect(GENRE_AFFINITY.reggaeton.reggae).toBeGreaterThanOrEqual(0.8);
  });

  it('第 6 轮:trance→edm 高亲和(≥0.8,旋律电子)', () => {
    expect(GENRE_AFFINITY.trance.edm).toBeGreaterThanOrEqual(0.8);
  });

  it('第 6 轮:anime→soundtrack 高亲和(≥0.85,动漫原声)', () => {
    expect(GENRE_AFFINITY.anime.soundtrack).toBeGreaterThanOrEqual(0.85);
  });

  it('第 6 轮:vocaloid→jpop 高亲和(≥0.8,虚拟人声日流)', () => {
    expect(GENRE_AFFINITY.vocaloid.jpop).toBeGreaterThanOrEqual(0.8);
  });

  it('第 6 轮:bachata→rnb 高亲和(≥0.8,浪漫吉他同源)', () => {
    expect(GENRE_AFFINITY.bachata.rnb).toBeGreaterThanOrEqual(0.8);
  });

  it('第 6 轮:emo→poppunk 高亲和(≥0.85,摇滚复兴同源)', () => {
    expect(GENRE_AFFINITY.emo.poppunk).toBeGreaterThanOrEqual(0.85);
  });

  it('第 6 轮:poppunk→punk 高亲和(≥0.85,朋克子流派)', () => {
    expect(GENRE_AFFINITY.poppunk.punk).toBeGreaterThanOrEqual(0.85);
  });

  it('第 6 轮:postpunk→rock 高亲和(≥0.8,摇滚子流派)', () => {
    expect(GENRE_AFFINITY.postpunk.rock).toBeGreaterThanOrEqual(0.8);
  });

  it('第 6 轮:hardwave→driftphonk 高亲和(≥0.8,赛博朋克电子)', () => {
    expect(GENRE_AFFINITY.hardwave.driftphonk).toBeGreaterThanOrEqual(0.8);
  });
});

// ============================================================================
// 3. 25×77 SCENE_RELATION_MATRIX 完整性
// ============================================================================

describe('25×77 场景关系矩阵', () => {
  const allScenes = [...SCENE_TYPES, 'travel'] as const;

  it('SCENE_TYPES = 24 个', () => {
    expect(SCENE_TYPES.length).toBe(24);
  });

  it('SONG_SCENE_TAGS = 77 个', () => {
    expect(SONG_SCENE_TAGS.length).toBe(77);
  });

  it('矩阵 = 25 行 × 77 列', () => {
    expect(Object.keys(SCENE_RELATION_MATRIX).length).toBe(25);
    for (const scene of allScenes) {
      const cols = Object.keys(SCENE_RELATION_MATRIX[scene]);
      expect(cols.length).toBe(77);
    }
  });

  it('第 3 轮新增 6 照片场景 × 全部 65 歌曲场景有值', () => {
    const newScenes = ['beach', 'mountain', 'forest', 'museum', 'street', 'nightlife'] as const;
    for (const scene of newScenes) {
      for (const tag of SONG_SCENE_TAGS) {
        const v = SCENE_RELATION_MATRIX[scene][tag];
        expect(v).toBeDefined();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('第 4 轮新增 6 照片场景 × 全部 65 歌曲场景有值', () => {
    const newScenes = ['park', 'garden', 'lake', 'bridge', 'temple', 'snow'] as const;
    for (const scene of newScenes) {
      for (const tag of SONG_SCENE_TAGS) {
        const v = SCENE_RELATION_MATRIX[scene][tag];
        expect(v).toBeDefined();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('beach→summer_beach = 1.0(海滩完美匹配夏日海滩)', () => {
    expect(SCENE_RELATION_MATRIX.beach.summer_beach).toBe(1.0);
  });

  it('beach→seaside_dusk = 1.0(海滩完美匹配海边黄昏)', () => {
    expect(SCENE_RELATION_MATRIX.beach.seaside_dusk).toBe(1.0);
  });

  it('mountain→mountain_top = 1.0(山脉完美匹配山顶)', () => {
    expect(SCENE_RELATION_MATRIX.mountain.mountain_top).toBe(1.0);
  });

  it('nightlife→party = 1.0(夜生活完美匹配聚会)', () => {
    expect(SCENE_RELATION_MATRIX.nightlife.party).toBe(1.0);
  });

  it('museum→library = 0.8(博物馆高度匹配图书馆)', () => {
    expect(SCENE_RELATION_MATRIX.museum.library).toBeGreaterThanOrEqual(0.8);
  });

  it('sports→workout = 1.0(运动场景完美匹配)', () => {
    expect(SCENE_RELATION_MATRIX.sports.workout).toBe(1.0);
  });

  it('vehicle→commute = 1.0(车辆完美匹配通勤)', () => {
    expect(SCENE_RELATION_MATRIX.vehicle.commute).toBe(1.0);
  });

  it('sky→rooftop_sunset = 0.9(天空高度匹配屋顶日落)', () => {
    expect(SCENE_RELATION_MATRIX.sky.rooftop_sunset).toBeGreaterThanOrEqual(0.9);
  });

  it('sky→morning_sunrise = 0.9(天空高度匹配日出)', () => {
    expect(SCENE_RELATION_MATRIX.sky.morning_sunrise).toBeGreaterThanOrEqual(0.9);
  });

  it('art→reading = 0.8(艺术高度匹配阅读)', () => {
    expect(SCENE_RELATION_MATRIX.art.reading).toBeGreaterThanOrEqual(0.8);
  });

  it('第 4 轮:park→reading 高匹配(≥0.7,公园适合阅读)', () => {
    expect(SCENE_RELATION_MATRIX.park.reading).toBeGreaterThanOrEqual(0.7);
  });

  it('第 4 轮:garden→spring_bloom = 1.0(花园完美匹配春日花季)', () => {
    expect(SCENE_RELATION_MATRIX.garden.spring_bloom).toBe(1.0);
  });

  it('第 4 轮:lake→meditation 高匹配(≥0.8,湖泊适合冥想)', () => {
    expect(SCENE_RELATION_MATRIX.lake.meditation).toBeGreaterThanOrEqual(0.8);
  });

  it('第 4 轮:temple→meditation 极高匹配(≥0.9,寺庙完美匹配冥想)', () => {
    expect(SCENE_RELATION_MATRIX.temple.meditation).toBeGreaterThanOrEqual(0.9);
  });

  it('第 4 轮:temple→guofeng 高匹配(≥0.8,寺庙高度匹配古风)', () => {
    expect(SCENE_RELATION_MATRIX.temple.guofeng).toBeGreaterThanOrEqual(0.8);
  });

  it('第 4 轮:snow→winter_snow = 1.0(雪景完美匹配冬日雪景)', () => {
    expect(SCENE_RELATION_MATRIX.snow.winter_snow).toBe(1.0);
  });

  it('第 4 轮:snow→snowy_day 高匹配(≥0.9,雪景高度匹配雪天)', () => {
    expect(SCENE_RELATION_MATRIX.snow.snowy_day).toBeGreaterThanOrEqual(0.9);
  });

  it('第 6 轮:indoor→cooking = 1.0(室内完美匹配烹饪下厨)', () => {
    expect(SCENE_RELATION_MATRIX.indoor.cooking).toBe(1.0);
  });

  it('第 6 轮:mountain→hiking = 1.0(山脉完美匹配徒步登山)', () => {
    expect(SCENE_RELATION_MATRIX.mountain.hiking).toBe(1.0);
  });

  it('第 6 轮:people→reunion = 1.0(人物完美匹配团聚重逢)', () => {
    expect(SCENE_RELATION_MATRIX.people.reunion).toBe(1.0);
  });

  it('第 6 轮:people→confession = 1.0(人物完美匹配表白)', () => {
    expect(SCENE_RELATION_MATRIX.people.confession).toBe(1.0);
  });

  it('第 6 轮:people→anniversary = 1.0(人物完美匹配纪念日)', () => {
    expect(SCENE_RELATION_MATRIX.people.anniversary).toBe(1.0);
  });

  it('第 6 轮:indoor→exam_cramming = 1.0(室内完美匹配考研冲刺)', () => {
    expect(SCENE_RELATION_MATRIX.indoor.exam_cramming).toBe(1.0);
  });

  it('第 6 轮:food→cooking 高匹配(≥0.9,美食匹配烹饪)', () => {
    expect(SCENE_RELATION_MATRIX.food.cooking).toBeGreaterThanOrEqual(0.9);
  });

  it('第 6 轮:nature→autumn_rain 高匹配(≥0.8,自然匹配秋雨)', () => {
    expect(SCENE_RELATION_MATRIX.nature.autumn_rain).toBeGreaterThanOrEqual(0.8);
  });

  it('第 6 轮:nature→spring_morning 高匹配(≥0.9,自然匹配春日清晨)', () => {
    expect(SCENE_RELATION_MATRIX.nature.spring_morning).toBeGreaterThanOrEqual(0.9);
  });

  it('第 6 轮:park→morning_run 高匹配(≥0.9,公园匹配晨跑)', () => {
    expect(SCENE_RELATION_MATRIX.park.morning_run).toBeGreaterThanOrEqual(0.9);
  });

  it('第 6 轮:forest→hiking 高匹配(≥0.9,森林匹配徒步)', () => {
    expect(SCENE_RELATION_MATRIX.forest.hiking).toBeGreaterThanOrEqual(0.9);
  });

  it('第 6 轮:food→anniversary 高匹配(≥0.8,美食匹配纪念日庆祝)', () => {
    expect(SCENE_RELATION_MATRIX.food.anniversary).toBeGreaterThanOrEqual(0.8);
  });

  it('general 列对所有场景 = 0.5(中性兜底)', () => {
    for (const scene of allScenes) {
      expect(SCENE_RELATION_MATRIX[scene].general).toBe(0.5);
    }
  });
});

// ============================================================================
// 4. SCENE_EMOTION_PRIOR 场景覆盖
// ============================================================================

describe('SCENE_EMOTION_PRIOR 场景覆盖', () => {
  it('第 2 轮新增 5 场景有情绪先验', () => {
    const newScenes = ['sports', 'vehicle', 'pet', 'art', 'sky'] as const;
    for (const scene of newScenes) {
      const priors = SCENE_EMOTION_PRIOR[scene];
      expect(priors).toBeDefined();
      expect(Object.keys(priors).length).toBeGreaterThan(0);
    }
  });

  it('第 3 轮新增 6 场景有情绪先验', () => {
    const newScenes = ['beach', 'mountain', 'forest', 'museum', 'street', 'nightlife'] as const;
    for (const scene of newScenes) {
      const priors = SCENE_EMOTION_PRIOR[scene];
      expect(priors).toBeDefined();
      expect(Object.keys(priors).length).toBeGreaterThan(0);
    }
  });

  it('第 4 轮新增 6 场景有情绪先验', () => {
    const newScenes = ['park', 'garden', 'lake', 'bridge', 'temple', 'snow'] as const;
    for (const scene of newScenes) {
      const priors = SCENE_EMOTION_PRIOR[scene];
      expect(priors).toBeDefined();
      expect(Object.keys(priors).length).toBeGreaterThan(0);
    }
  });

  it('sports 偏好 Exciting/Epic/Power', () => {
    expect(SCENE_EMOTION_PRIOR.sports.Exciting).toBeGreaterThanOrEqual(0.9);
    expect(SCENE_EMOTION_PRIOR.sports.Power).toBeGreaterThanOrEqual(0.8);
  });

  it('pet 偏好 Healing/Cozy(治愈温馨)', () => {
    expect(SCENE_EMOTION_PRIOR.pet.Healing).toBeGreaterThanOrEqual(0.85);
    expect(SCENE_EMOTION_PRIOR.pet.Cozy).toBeGreaterThanOrEqual(0.8);
  });

  it('sky 偏好 Peaceful/Serene/Transcendence(空灵超然)', () => {
    expect(SCENE_EMOTION_PRIOR.sky.Peaceful).toBeGreaterThanOrEqual(0.8);
    expect(SCENE_EMOTION_PRIOR.sky.Transcendence).toBeGreaterThanOrEqual(0.8);
  });

  it('第 3 轮:nightlife 偏好 Exciting/Hype(高能狂欢)', () => {
    expect(SCENE_EMOTION_PRIOR.nightlife.Exciting).toBeGreaterThanOrEqual(0.9);
    expect(SCENE_EMOTION_PRIOR.nightlife.Hype).toBeGreaterThanOrEqual(0.85);
  });

  it('第 3 轮:mountain 偏好 Awe/Wonder(敬畏惊叹)', () => {
    expect(SCENE_EMOTION_PRIOR.mountain.Awe).toBeGreaterThanOrEqual(0.85);
    expect(SCENE_EMOTION_PRIOR.mountain.Wonder).toBeGreaterThanOrEqual(0.75);
  });

  it('第 3 轮:forest 偏好 Peaceful/Zen(幽静禅意)', () => {
    expect(SCENE_EMOTION_PRIOR.forest.Peaceful).toBeGreaterThanOrEqual(0.85);
    expect(SCENE_EMOTION_PRIOR.forest.Zen).toBeGreaterThanOrEqual(0.78);
  });

  it('第 3 轮:museum 偏好 Wonder/Masterpiece(审美震撼)', () => {
    expect(SCENE_EMOTION_PRIOR.museum.Wonder).toBeGreaterThanOrEqual(0.8);
    expect(SCENE_EMOTION_PRIOR.museum.Masterpiece).toBeGreaterThanOrEqual(0.75);
  });

  it('第 4 轮:temple 偏好 Zen/Spiritual/Solemnity(禅意/灵性/庄重)', () => {
    expect(SCENE_EMOTION_PRIOR.temple.Zen).toBeGreaterThanOrEqual(0.9);
    expect(SCENE_EMOTION_PRIOR.temple.Spiritual).toBeGreaterThanOrEqual(0.9);
  });

  it('第 4 轮:snow 偏好 Peaceful/Fresh(宁静/清新)', () => {
    expect(SCENE_EMOTION_PRIOR.snow.Peaceful).toBeGreaterThanOrEqual(0.7);
  });
});

// ============================================================================
// 5. 扩展时段/天气/构图/表情标签
// ============================================================================

describe('扩展时段标签(13 类)', () => {
  it('TIME_OF_DAY = 13 个', () => {
    expect(TIME_OF_DAY.length).toBe(13);
  });

  it('第 3 轮新增 noon / blue_hour 有 V-A 映射', () => {
    expect(TIME_OF_DAY_VA_MAP.noon).toBeDefined();
    expect(TIME_OF_DAY_VA_MAP.blue_hour).toBeDefined();
  });

  it('第 4 轮新增 early_morning / afternoon / evening / late_night 有 V-A 映射', () => {
    expect(TIME_OF_DAY_VA_MAP.early_morning).toBeDefined();
    expect(TIME_OF_DAY_VA_MAP.afternoon).toBeDefined();
    expect(TIME_OF_DAY_VA_MAP.evening).toBeDefined();
    expect(TIME_OF_DAY_VA_MAP.late_night).toBeDefined();
  });

  it('midnight V 值最低(深夜最消极)', () => {
    expect(TIME_OF_DAY_VA_MAP.midnight.v).toBeLessThan(0.3);
  });

  it('golden_hour V 值较高(黄金时刻温暖)', () => {
    expect(TIME_OF_DAY_VA_MAP.golden_hour.v).toBeGreaterThan(0.6);
  });

  it('第 3 轮:blue_hour V 值较低(蓝调时刻忧郁)', () => {
    expect(TIME_OF_DAY_VA_MAP.blue_hour.v).toBeLessThan(0.5);
  });

  it('第 3 轮:noon V 值较高(正午阳光)', () => {
    expect(TIME_OF_DAY_VA_MAP.noon.v).toBeGreaterThan(0.6);
  });

  it('第 4 轮:early_morning V 值较高(清晨积极)', () => {
    expect(TIME_OF_DAY_VA_MAP.early_morning.v).toBeGreaterThan(0.55);
  });

  it('第 4 轮:late_night V 值偏低(深夜偏沉思)', () => {
    expect(TIME_OF_DAY_VA_MAP.late_night.v).toBeLessThan(0.4);
  });
});

describe('扩展天气标签(14 类)', () => {
  it('WEATHER_TYPES = 14 个', () => {
    expect(WEATHER_TYPES.length).toBe(14);
  });

  it('第 3 轮新增 drizzle / breezy / starry 有 V-A 映射', () => {
    expect(WEATHER_VA_MAP.drizzle).toBeDefined();
    expect(WEATHER_VA_MAP.breezy).toBeDefined();
    expect(WEATHER_VA_MAP.starry).toBeDefined();
  });

  it('第 4 轮新增 humid / windy / sleet 有 V-A 映射', () => {
    expect(WEATHER_VA_MAP.humid).toBeDefined();
    expect(WEATHER_VA_MAP.windy).toBeDefined();
    expect(WEATHER_VA_MAP.sleet).toBeDefined();
  });

  it('thunderstorm 高唤醒(雷暴 A > 0.7)', () => {
    expect(WEATHER_VA_MAP.thunderstorm.a).toBeGreaterThan(0.7);
  });

  it('overcast V 值低于 cloudy(阴天比多云更低落)', () => {
    expect(WEATHER_VA_MAP.overcast.v).toBeLessThan(WEATHER_VA_MAP.cloudy.v);
  });

  it('第 3 轮:drizzle V 值高于 rainy(毛毛雨比大雨更柔)', () => {
    expect(WEATHER_VA_MAP.drizzle.v).toBeGreaterThan(WEATHER_VA_MAP.rainy.v);
  });

  it('第 3 轮:starry 低唤醒(星空宁静)', () => {
    expect(WEATHER_VA_MAP.starry.a).toBeLessThan(0.35);
  });

  it('第 3 轮:breezy V 值较高(微风轻快)', () => {
    expect(WEATHER_VA_MAP.breezy.v).toBeGreaterThan(0.55);
  });

  it('第 4 轮:humid V 值较低(闷热压抑)', () => {
    expect(WEATHER_VA_MAP.humid.v).toBeLessThan(0.5);
  });
});

describe('扩展构图标签(15 类)', () => {
  it('COMPOSITION_TYPES = 15 个', () => {
    expect(COMPOSITION_TYPES.length).toBe(15);
  });

  it('第 3 轮新增 rule_of_thirds / silhouette / bokeh / negative_space 有 V-A 映射', () => {
    expect(COMPOSITION_VA_MAP.rule_of_thirds).toBeDefined();
    expect(COMPOSITION_VA_MAP.silhouette).toBeDefined();
    expect(COMPOSITION_VA_MAP.bokeh).toBeDefined();
    expect(COMPOSITION_VA_MAP.negative_space).toBeDefined();
  });

  it('第 4 轮新增 leading_lines / golden_ratio / framing / centered 有 V-A 映射', () => {
    expect(COMPOSITION_VA_MAP.leading_lines).toBeDefined();
    expect(COMPOSITION_VA_MAP.golden_ratio).toBeDefined();
    expect(COMPOSITION_VA_MAP.framing).toBeDefined();
    expect(COMPOSITION_VA_MAP.centered).toBeDefined();
  });

  it('aerial V 值较高(航拍惊叹感)', () => {
    expect(COMPOSITION_VA_MAP.aerial.v).toBeGreaterThan(0.55);
  });

  it('第 3 轮:silhouette 低 V 高 A(剪影戏剧张力)', () => {
    expect(COMPOSITION_VA_MAP.silhouette.v).toBeLessThan(0.5);
    expect(COMPOSITION_VA_MAP.silhouette.a).toBeGreaterThan(0.5);
  });

  it('第 3 轮:negative_space 极低唤醒(留白空灵)', () => {
    expect(COMPOSITION_VA_MAP.negative_space.a).toBeLessThan(0.25);
  });

  it('第 3 轮:bokeh 高 V(散景梦幻)', () => {
    expect(COMPOSITION_VA_MAP.bokeh.v).toBeGreaterThan(0.55);
  });
});

describe('扩展表情标签(20 类)', () => {
  it('FACE_EMOTIONS = 20 个', () => {
    expect(FACE_EMOTIONS.length).toBe(20);
  });

  it('surprised 高唤醒(A > 0.7)', () => {
    const va = getPeopleVA(1, 'surprised');
    expect(va.a).toBeGreaterThan(0.7);
  });

  it('thoughtful 低唤醒(A < 0.4)', () => {
    const va = getPeopleVA(1, 'thoughtful');
    expect(va.a).toBeLessThan(0.4);
  });

  it('focused 中高唤醒(A > 0.5)', () => {
    const va = getPeopleVA(1, 'focused');
    expect(va.a).toBeGreaterThan(0.5);
  });

  it('第 3 轮:laughing 极高积极高能(V>0.8, A>0.7)', () => {
    const va = getPeopleVA(1, 'laughing');
    expect(va.v).toBeGreaterThan(0.8);
    expect(va.a).toBeGreaterThan(0.7);
  });

  it('第 3 轮:crying 极低效价(V<0.2)', () => {
    const va = getPeopleVA(1, 'crying');
    expect(va.v).toBeLessThan(0.2);
  });

  it('第 3 轮:angry 极低效价极高唤醒(V<0.2, A>0.85)', () => {
    const va = getPeopleVA(1, 'angry');
    expect(va.v).toBeLessThan(0.2);
    expect(va.a).toBeGreaterThan(0.85);
  });

  it('第 3 轮:in_love 高积极(V>0.75)', () => {
    const va = getPeopleVA(1, 'in_love');
    expect(va.v).toBeGreaterThan(0.75);
  });

  it('第 3 轮:proud 高积极中高唤醒(V>0.7, A>0.6)', () => {
    const va = getPeopleVA(1, 'proud');
    expect(va.v).toBeGreaterThan(0.7);
    expect(va.a).toBeGreaterThan(0.6);
  });

  it('第 3 轮:calm 极低唤醒(A<0.25)', () => {
    const va = getPeopleVA(1, 'calm');
    expect(va.a).toBeLessThan(0.25);
  });

  it('第 4 轮:bored 低唤醒轻度消极(A<0.25, V<0.5)', () => {
    const va = getPeopleVA(1, 'bored');
    expect(va.a).toBeLessThan(0.25);
    expect(va.v).toBeLessThan(0.5);
  });

  it('第 4 轮:determined 积极高唤醒(V>0.6, A>0.65)', () => {
    const va = getPeopleVA(1, 'determined');
    expect(va.v).toBeGreaterThan(0.6);
    expect(va.a).toBeGreaterThan(0.65);
  });

  it('第 4 轮:shy 中性低唤醒(V>0.5, A<0.35)', () => {
    const va = getPeopleVA(1, 'shy');
    expect(va.v).toBeGreaterThan(0.5);
    expect(va.a).toBeLessThan(0.35);
  });

  it('第 4 轮:grateful 高积极(V>0.7)', () => {
    const va = getPeopleVA(1, 'grateful');
    expect(va.v).toBeGreaterThan(0.7);
  });

  it('第 4 轮:content 积极低唤醒(V>0.6, A<0.3)', () => {
    const va = getPeopleVA(1, 'content');
    expect(va.v).toBeGreaterThan(0.6);
    expect(va.a).toBeLessThan(0.3);
  });

  it('第 4 轮:confused 消极中等唤醒(V<0.5)', () => {
    const va = getPeopleVA(1, 'confused');
    expect(va.v).toBeLessThan(0.5);
  });
});

// ============================================================================
// 6. 照片场景 V-A 映射完整性
// ============================================================================

describe('SCENE_VA_MAP 24 场景完整性', () => {
  it('覆盖全部 24 场景', () => {
    for (const scene of SCENE_TYPES) {
      expect(SCENE_VA_MAP[scene]).toBeDefined();
    }
    expect(Object.keys(SCENE_VA_MAP).length).toBe(24);
  });

  it('sports 高唤醒(A > 0.8)', () => {
    expect(SCENE_VA_MAP.sports.a).toBeGreaterThan(0.8);
  });

  it('sky 极低唤醒(A < 0.3)', () => {
    expect(SCENE_VA_MAP.sky.a).toBeLessThan(0.3);
  });

  it('pet 高效价(V > 0.6,治愈)', () => {
    expect(SCENE_VA_MAP.pet.v).toBeGreaterThan(0.6);
  });

  it('第 3 轮:beach 高效价(V>0.6,愉悦放松)', () => {
    expect(SCENE_VA_MAP.beach.v).toBeGreaterThan(0.6);
  });

  it('第 3 轮:nightlife 高唤醒(A>0.8,狂欢)', () => {
    expect(SCENE_VA_MAP.nightlife.a).toBeGreaterThan(0.8);
  });

  it('第 3 轮:forest 极低唤醒(A<0.3,幽静)', () => {
    expect(SCENE_VA_MAP.forest.a).toBeLessThan(0.3);
  });

  it('第 3 轮:museum 低唤醒(A<0.3,沉思)', () => {
    expect(SCENE_VA_MAP.museum.a).toBeLessThan(0.3);
  });

  it('第 4 轮:park 低唤醒(A<0.3,轻松)', () => {
    expect(SCENE_VA_MAP.park.a).toBeLessThan(0.3);
  });

  it('第 4 轮:garden 极低唤醒(A<0.3,美好低唤醒)', () => {
    expect(SCENE_VA_MAP.garden.a).toBeLessThan(0.3);
  });

  it('第 4 轮:lake 极低唤醒(A<0.3,水面平静)', () => {
    expect(SCENE_VA_MAP.lake.a).toBeLessThan(0.3);
  });

  it('第 4 轮:temple 极低唤醒(A<0.2,庄重低唤醒)', () => {
    expect(SCENE_VA_MAP.temple.a).toBeLessThan(0.2);
  });

  it('第 4 轮:snow 低唤醒(A<0.4,冬日安静)', () => {
    expect(SCENE_VA_MAP.snow.a).toBeLessThan(0.4);
  });
});
