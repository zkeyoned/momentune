/**
 * genreTags.ts 单元测试
 *
 * 覆盖:风格标签归一化、关系度矩阵、软 Jaccard 相似度、命中度
 *
 * @module algorithm/__tests__/genreTags.test
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeGenre,
  normalizeGenres,
  calcGenreSimilarity,
  calcGenreMatch,
  GENRE_AFFINITY,
  GENRE_KEYWORD_MAPPING,
} from '../config/genreTags.js';
import type { GenreTag } from '../types.js';

// ============================================================================
// 1. normalizeGenre 单标签归一化
// ============================================================================

describe('normalizeGenre 单标签归一化', () => {
  it('英文主类直接命中', () => {
    expect(normalizeGenre('pop')).toBe('pop');
    expect(normalizeGenre('rock')).toBe('rock');
    expect(normalizeGenre('folk')).toBe('folk');
    expect(normalizeGenre('electronic')).toBe('electronic');
    expect(normalizeGenre('rap')).toBe('rap');
    expect(normalizeGenre('guofeng')).toBe('guofeng');
    expect(normalizeGenre('rnb')).toBe('rnb');
    expect(normalizeGenre('lofi')).toBe('lofi');
  });

  it('中文主类命中', () => {
    expect(normalizeGenre('流行')).toBe('pop');
    expect(normalizeGenre('民谣')).toBe('folk');
    expect(normalizeGenre('电子')).toBe('electronic');
    expect(normalizeGenre('说唱')).toBe('rap');
    expect(normalizeGenre('国风')).toBe('guofeng');
    expect(normalizeGenre('古风')).toBe('gufeng'); // 第 5 轮:古风从 guofeng 独立为 gufeng
    expect(normalizeGenre('摇滚')).toBe('rock');
    expect(normalizeGenre('节奏布鲁斯')).toBe('rnb');
  });

  it('子流派归一到主类', () => {
    // indie 系列归一到 indie(独立标签,不再归到 pop/folk/rock)
    expect(normalizeGenre('indie pop')).toBe('indie');
    expect(normalizeGenre('indie folk')).toBe('indie');
    expect(normalizeGenre('chamber pop')).toBe('pop');
    expect(normalizeGenre('华语流行')).toBe('pop');
    expect(normalizeGenre('校园民谣')).toBe('folk');
    expect(normalizeGenre('edm')).toBe('edm'); // edm 现在是独立 GenreTag
    expect(normalizeGenre('house')).toBe('house'); // house 现在是独立 GenreTag
    expect(normalizeGenre('techno')).toBe('techno'); // 第 6 轮:techno 提升为独立 GenreTag
    expect(normalizeGenre('trap')).toBe('trap'); // trap 现在是独立 GenreTag
    expect(normalizeGenre('中国说唱')).toBe('rap');
    // punk/metal 现在有独立标签,不再归到 rock
    expect(normalizeGenre('punk')).toBe('punk');
    expect(normalizeGenre('朋克')).toBe('punk');
    expect(normalizeGenre('metal')).toBe('metal');
    expect(normalizeGenre('neo soul')).toBe('soul'); // soul 现在是独立 GenreTag,优先于 rnb 匹配
    expect(normalizeGenre('chillhop')).toBe('lofi');
    expect(normalizeGenre('lo-fi')).toBe('lofi');
  });

  it('第 5 轮新增 15 风格归一化', () => {
    // phonk / driftphonk
    expect(normalizeGenre('phonk')).toBe('phonk');
    expect(normalizeGenre('driftphonk')).toBe('driftphonk');
    expect(normalizeGenre('drift phonk')).toBe('driftphonk');
    // hyperpop
    expect(normalizeGenre('hyperpop')).toBe('hyperpop');
    // bedroompop(注意:bedroom pop 需从 indie 独立到 bedroompop)
    expect(normalizeGenre('bedroompop')).toBe('bedroompop');
    expect(normalizeGenre('bedroom pop')).toBe('bedroompop');
    // citypop
    expect(normalizeGenre('citypop')).toBe('citypop');
    expect(normalizeGenre('city pop')).toBe('citypop');
    // dreamcore
    expect(normalizeGenre('dreamcore')).toBe('dreamcore');
    // drill(注意:drill 需从 rap 独立到 drill)
    expect(normalizeGenre('drill')).toBe('drill');
    // futurebass
    expect(normalizeGenre('futurebass')).toBe('futurebass');
    expect(normalizeGenre('future bass')).toBe('futurebass');
    // synthwave
    expect(normalizeGenre('synthwave')).toBe('synthwave');
    // vaporwave
    expect(normalizeGenre('vaporwave')).toBe('vaporwave');
    // shoegaze
    expect(normalizeGenre('shoegaze')).toBe('shoegaze');
    // dreampop
    expect(normalizeGenre('dreampop')).toBe('dreampop');
    expect(normalizeGenre('dream pop')).toBe('dreampop');
    // gufeng(古风从 guofeng 独立)
    expect(normalizeGenre('古风')).toBe('gufeng');
    // xiqiang(戏腔从 guofeng 独立)
    expect(normalizeGenre('戏腔')).toBe('xiqiang');
    // guofengrock
    expect(normalizeGenre('国风摇滚')).toBe('guofengrock');
  });

  it('大小写不敏感', () => {
    expect(normalizeGenre('POP')).toBe('pop');
    expect(normalizeGenre('Rock')).toBe('rock');
    expect(normalizeGenre('INDIE POP')).toBe('indie');
    expect(normalizeGenre('Hip-Hop')).toBe('rap');
  });

  it('前后空格修剪', () => {
    expect(normalizeGenre('  pop  ')).toBe('pop');
    expect(normalizeGenre(' 流行 ')).toBe('pop');
  });

  it('无法归一 → other', () => {
    expect(normalizeGenre('xyz123')).toBe('other');
    expect(normalizeGenre('未知风格')).toBe('other');
    expect(normalizeGenre('')).toBe('other');
  });

  it('GENRE_KEYWORD_MAPPING 覆盖核心 17 主类 + 第 6 轮新增 15 类', () => {
    const coveredGenres = new Set(GENRE_KEYWORD_MAPPING.map((e) => e.genre));
    // 原 8 主类
    expect(coveredGenres.has('pop')).toBe(true);
    expect(coveredGenres.has('folk')).toBe(true);
    expect(coveredGenres.has('electronic')).toBe(true);
    expect(coveredGenres.has('rap')).toBe(true);
    expect(coveredGenres.has('guofeng')).toBe(true);
    expect(coveredGenres.has('rock')).toBe(true);
    expect(coveredGenres.has('rnb')).toBe(true);
    expect(coveredGenres.has('lofi')).toBe(true);
    // 新增 9 类
    expect(coveredGenres.has('jazz')).toBe(true);
    expect(coveredGenres.has('classical')).toBe(true);
    expect(coveredGenres.has('country')).toBe(true);
    expect(coveredGenres.has('blues')).toBe(true);
    expect(coveredGenres.has('reggae')).toBe(true);
    expect(coveredGenres.has('metal')).toBe(true);
    expect(coveredGenres.has('punk')).toBe(true);
    expect(coveredGenres.has('indie')).toBe(true);
    expect(coveredGenres.has('ambient')).toBe(true);
    // 第 6 轮新增 15 类
    expect(coveredGenres.has('amapiano')).toBe(true);
    expect(coveredGenres.has('afrobeats')).toBe(true);
    expect(coveredGenres.has('drumandbass')).toBe(true);
    expect(coveredGenres.has('ukgarage')).toBe(true);
    expect(coveredGenres.has('techno')).toBe(true);
    expect(coveredGenres.has('reggaeton')).toBe(true);
    expect(coveredGenres.has('dembow')).toBe(true);
    expect(coveredGenres.has('trance')).toBe(true);
    expect(coveredGenres.has('hardwave')).toBe(true);
    expect(coveredGenres.has('anime')).toBe(true);
    expect(coveredGenres.has('vocaloid')).toBe(true);
    expect(coveredGenres.has('bachata')).toBe(true);
    expect(coveredGenres.has('emo')).toBe(true);
    expect(coveredGenres.has('poppunk')).toBe(true);
    expect(coveredGenres.has('postpunk')).toBe(true);
  });
});

// ============================================================================
// 2. normalizeGenres 批量归一化(去重)
// ============================================================================

describe('normalizeGenres 批量归一化', () => {
  it('多标签归一 + 去重', () => {
    const result = normalizeGenres(['pop', 'indie pop', 'rock', 'punk']);
    // indie pop → indie, punk → punk,不再归一到 pop/rock
    // 结果:{pop, indie, rock, punk} 4 个
    expect(result).toContain('pop');
    expect(result).toContain('indie');
    expect(result).toContain('rock');
    expect(result).toContain('punk');
    expect(result.length).toBe(4);
  });

  it('空数组 → 空数组', () => {
    expect(normalizeGenres([])).toEqual([]);
  });

  it('全部无法归一 → [other]', () => {
    const result = normalizeGenres(['xyz', 'abc']);
    expect(result).toEqual(['other']);
  });

  it('保留多主类(不归一为同一个)', () => {
    const result = normalizeGenres(['pop', 'folk', 'electronic']);
    expect(result.length).toBe(3);
    expect(result).toContain('pop');
    expect(result).toContain('folk');
    expect(result).toContain('electronic');
  });
});

// ============================================================================
// 3. calcGenreSimilarity 软 Jaccard 相似度
// ============================================================================

describe('calcGenreSimilarity 软 Jaccard 相似度', () => {
  it('完全相同单元素集合 = 1', () => {
    expect(calcGenreSimilarity(['pop'], ['pop'])).toBe(1);
  });

  it('完全相同多元素集合 < 1(软 Jaccard 取均值,跨对用 affinity)', () => {
    // ['pop','rock'] vs ['pop','rock']:4 对组合取均值
    // pop-pop=1, pop-rock=0.3, rock-pop=0.3, rock-rock=1 → (1+0.3+0.3+1)/4 = 0.65
    // 设计上"取均值而非最大,避免大集合虚高",因此相同多元素集合不为 1
    const sim = calcGenreSimilarity(['pop', 'rock'], ['pop', 'rock']);
    const expected = (1 + GENRE_AFFINITY.pop.rock! + GENRE_AFFINITY.rock.pop! + 1) / 4;
    expect(sim).toBeCloseTo(expected, 6);
    expect(sim).toBeLessThan(1);
    expect(sim).toBeGreaterThan(0.5); // 但仍较高
  });

  it('空集 → 0.5(中性)', () => {
    expect(calcGenreSimilarity([], ['pop'])).toBe(0.5);
    expect(calcGenreSimilarity(['pop'], [])).toBe(0.5);
    expect(calcGenreSimilarity([], [])).toBe(0.5);
  });

  it('同标签 = 1,不同标签用 affinity', () => {
    // pop vs rnb:affinity = 0.6
    const sim = calcGenreSimilarity(['pop'], ['rnb']);
    expect(sim).toBeCloseTo(GENRE_AFFINITY.pop.rnb!, 6);
  });

  it('相似度对称性', () => {
    const a = calcGenreSimilarity(['pop', 'folk'], ['rock', 'electronic']);
    const b = calcGenreSimilarity(['rock', 'electronic'], ['pop', 'folk']);
    // 软 Jaccard 用均值,应该对称
    expect(a).toBeCloseTo(b, 6);
  });

  it('高亲和度对(pop-rnb=0.6)比低亲和度对(pop-guofeng=0.2)相似度高', () => {
    const highAffinity = calcGenreSimilarity(['pop'], ['rnb']); // 0.6
    const lowAffinity = calcGenreSimilarity(['pop'], ['guofeng']); // 0.2
    expect(highAffinity).toBeGreaterThan(lowAffinity);
  });

  it('自相似度 = 1', () => {
    for (const g of ['pop', 'folk', 'electronic', 'rap', 'guofeng', 'rock', 'rnb', 'lofi', 'other'] as GenreTag[]) {
      expect(calcGenreSimilarity([g], [g])).toBe(1);
    }
  });

  it('多对多取均值(避免大集合虚高)', () => {
    // 2×2 = 4 对组合,取均值
    // pop-pop=1, pop-rock=0.3, folk-pop=0.4, folk-rock=0.3 → (1+0.3+0.4+0.3)/4 = 0.5
    const sim = calcGenreSimilarity(['pop', 'folk'], ['pop', 'rock']);
    const expected = (1 + GENRE_AFFINITY.pop.rock! + GENRE_AFFINITY.folk.pop! + GENRE_AFFINITY.folk.rock!) / 4;
    expect(sim).toBeCloseTo(expected, 6);
  });
});

// ============================================================================
// 4. calcGenreMatch 命中度(用于 score_pref)
// ============================================================================

describe('calcGenreMatch 命中度', () => {
  it('直接命中 → 1.0', () => {
    expect(calcGenreMatch(['pop'], ['pop', 'rock'])).toBe(1.0);
    expect(calcGenreMatch(['pop', 'folk'], ['folk'])).toBe(1.0);
  });

  it('相关(affinity >= 0.5)→ 0.4', () => {
    // pop-rnb affinity=0.6 >= 0.5
    expect(calcGenreMatch(['pop'], ['rnb'])).toBe(0.4);
    // rap-rnb affinity=0.5 >= 0.5
    expect(calcGenreMatch(['rap'], ['rnb'])).toBe(0.4);
  });

  it('不命中(affinity < 0.5)→ 0.1', () => {
    // pop-guofeng affinity=0.2 < 0.5
    expect(calcGenreMatch(['pop'], ['guofeng'])).toBe(0.1);
    // pop-folk affinity=0.4 < 0.5
    expect(calcGenreMatch(['pop'], ['folk'])).toBe(0.1);
  });

  it('用户不限(空数组)→ 0.7(中性偏鼓励)', () => {
    expect(calcGenreMatch([], ['pop'])).toBe(0.7);
    expect(calcGenreMatch([], ['rock', 'folk'])).toBe(0.7);
  });

  it('歌曲多风格,任一命中即可', () => {
    expect(calcGenreMatch(['pop'], ['rock', 'pop', 'folk'])).toBe(1.0);
  });

  it('用户多偏好,任一命中即可', () => {
    expect(calcGenreMatch(['pop', 'rock', 'folk'], ['folk'])).toBe(1.0);
  });

  it('边界:affinity 恰好 0.5 → 0.4', () => {
    // rap-electronic affinity=0.5,应判为相关
    expect(calcGenreMatch(['rap'], ['electronic'])).toBe(0.4);
    // lofi-electronic affinity=0.4 < 0.5,应判为不命中
    expect(calcGenreMatch(['lofi'], ['electronic'])).toBe(0.1);
  });

  it('other 标签始终低分', () => {
    expect(calcGenreMatch(['pop'], ['other'])).toBe(0.1);
    expect(calcGenreMatch(['other'], ['pop'])).toBe(0.1);
  });
});

// ============================================================================
// 5. GENRE_AFFINITY 矩阵完整性
// ============================================================================

describe('GENRE_AFFINITY 矩阵完整性', () => {
  const allGenres: GenreTag[] = ['pop', 'folk', 'electronic', 'rap', 'guofeng', 'rock', 'rnb', 'lofi', 'other'];

  it('9×9 矩阵完整(含 other)', () => {
    for (const g of allGenres) {
      expect(GENRE_AFFINITY[g]).toBeDefined();
      for (const g2 of allGenres) {
        expect(GENRE_AFFINITY[g]?.[g2]).toBeDefined();
      }
    }
  });

  it('对角线 = 1.0(自相似)', () => {
    for (const g of allGenres) {
      expect(GENRE_AFFINITY[g]?.[g]).toBe(1.0);
    }
  });

  it('对称性:affinity(a,b) = affinity(b,a)', () => {
    for (const a of allGenres) {
      for (const b of allGenres) {
        if (a !== b) {
          expect(GENRE_AFFINITY[a]?.[b]).toBeCloseTo(GENRE_AFFINITY[b]?.[a] ?? 0, 6);
        }
      }
    }
  });

  it('所有值 ∈ [0, 1]', () => {
    for (const a of allGenres) {
      for (const b of allGenres) {
        const v = GENRE_AFFINITY[a]?.[b] ?? 0;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
