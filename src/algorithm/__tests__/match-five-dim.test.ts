/**
 * match.ts 五维匹配打分函数单元测试
 *
 * 覆盖:calcScoreMood / calcScoreEnergy / calcScoreGenre / calcScoreLanguage / calcScoreVibe
 * 每个函数覆盖:命中、未命中、空输入 三类场景
 *
 * @module algorithm/__tests__/match-five-dim.test
 */

import { describe, it, expect } from 'vitest';
import {
  calcScoreMood,
  calcScoreEnergy,
  calcScoreGenre,
  calcScoreLanguage,
  calcScoreVibe,
} from '../match.js';
import { createSong, vaWithConf } from './testHelpers.js';

// ============================================================================
// 1. 情绪基调匹配 calcScoreMood
// ============================================================================

describe('calcScoreMood', () => {
  it('空 moodTags 返回 0.5(中性)', () => {
    const song = createSong({ emotionLabel: 'Relaxing' });
    expect(calcScoreMood([], song)).toBe(0.5);
  });

  it('emotionLabel 完全命中(大小写不敏感) → 1.0', () => {
    const song = createSong({ emotionLabel: 'Relaxing' });
    // "relaxing" 完全等于 emotionLabel
    expect(calcScoreMood(['relaxing'], song)).toBe(1.0);
  });

  it('emotionLabel 子串命中(hint includes 于 emotionLabel) → 命中保底', () => {
    const song = createSong({ emotionLabel: 'Relaxing' });
    // "relax" 是 "relaxing" 的子串 → 命中
    const score = calcScoreMood(['relax'], song);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeGreaterThanOrEqual(0.3);
    expect(score).toBe(1.0); // 1/1 = 1.0
  });

  it('neteaseTags 命中 → 1.0', () => {
    const song = createSong({
      emotionLabel: null,
      neteaseTags: ['Healing', 'Peaceful'],
    });
    expect(calcScoreMood(['healing'], song)).toBe(1.0);
  });

  it('部分命中(2 个 hint 命中 1 个) → 0.5', () => {
    const song = createSong({ emotionLabel: 'Relaxing' });
    // 'relax' 命中 'Relaxing','happy' 不命中 → 1/2 = 0.5
    expect(calcScoreMood(['relax', 'happy'], song)).toBe(0.5);
  });

  it('命中至少 1 个 → 最低保底 0.3', () => {
    // 5 个 hint,只命中 1 个:1/5 = 0.2,保底 0.3
    const song = createSong({ emotionLabel: 'Relaxing' });
    const score = calcScoreMood(['relax', 'happy', 'sad', 'angry', 'epic'], song);
    expect(score).toBe(0.3);
  });

  it('未命中 → 0', () => {
    const song = createSong({ emotionLabel: 'Relaxing' });
    expect(calcScoreMood(['慵懒'], song)).toBe(0);
  });

  it('emotionLabel 为 null 且无 neteaseTags → 0', () => {
    const song = createSong({ emotionLabel: null, neteaseTags: undefined });
    expect(calcScoreMood(['relax'], song)).toBe(0);
  });
});

// ============================================================================
// 2. 能量级别匹配 calcScoreEnergy
// ============================================================================

describe('calcScoreEnergy', () => {
  it('完全匹配 low → 1.0', () => {
    const va = vaWithConf(0.5, 0.2);
    expect(calcScoreEnergy('low', va)).toBe(1.0);
  });

  it('完全匹配 mid → 1.0', () => {
    const va = vaWithConf(0.5, 0.5);
    expect(calcScoreEnergy('mid', va)).toBe(1.0);
  });

  it('完全匹配 high → 1.0', () => {
    const va = vaWithConf(0.5, 0.8);
    expect(calcScoreEnergy('high', va)).toBe(1.0);
  });

  it('完全相反 low vs high → 0.0', () => {
    const va = vaWithConf(0.5, 0.8);
    expect(calcScoreEnergy('low', va)).toBe(0.0);
  });

  it('完全相反 high vs low → 0.0', () => {
    const va = vaWithConf(0.5, 0.2);
    expect(calcScoreEnergy('high', va)).toBe(0.0);
  });

  it('相邻档位 low vs mid → 0.5', () => {
    const va = vaWithConf(0.5, 0.5);
    expect(calcScoreEnergy('low', va)).toBe(0.5);
  });

  it('相邻档位 mid vs high → 0.5', () => {
    const va = vaWithConf(0.5, 0.8);
    expect(calcScoreEnergy('mid', va)).toBe(0.5);
  });

  it('边界值 a=0.35 → mid', () => {
    const va = vaWithConf(0.5, 0.35);
    expect(calcScoreEnergy('mid', va)).toBe(1.0);
    expect(calcScoreEnergy('low', va)).toBe(0.5);
  });

  it('边界值 a=0.65 → high', () => {
    const va = vaWithConf(0.5, 0.65);
    expect(calcScoreEnergy('high', va)).toBe(1.0);
    expect(calcScoreEnergy('mid', va)).toBe(0.5);
  });
});

// ============================================================================
// 3. 风格倾向匹配 calcScoreGenre
// ============================================================================

describe('calcScoreGenre', () => {
  it('空 genreHints → 0.5', () => {
    expect(calcScoreGenre([], ['pop', 'rock'])).toBe(0.5);
  });

  it('空 songGenres → 0.5', () => {
    expect(calcScoreGenre(['pop'], [])).toBe(0.5);
  });

  it('完全命中(单 hint) → 1.0', () => {
    expect(calcScoreGenre(['pop'], ['pop', 'rock'])).toBe(1.0);
  });

  it('完全命中(多 hint 全中) → 1.0', () => {
    expect(calcScoreGenre(['pop', 'rock'], ['pop', 'rock'])).toBe(1.0);
  });

  it('部分命中(2 个 hint 命中 1 个) → 0.5', () => {
    expect(calcScoreGenre(['pop', 'jazz'], ['pop', 'rock'])).toBe(0.5);
  });

  it('大小写不敏感命中 → 1.0', () => {
    expect(calcScoreGenre(['POP'], ['pop', 'rock'])).toBe(1.0);
  });

  it('子串匹配 hint includes 于 genre → 命中', () => {
    // "p" 是 "pop" 的子串,但 "p" 也可能是 "rock" 的子串吗?不,但 "p" includes "pop" = false, "pop" includes "p" = true → 命中
    expect(calcScoreGenre(['p'], ['pop'])).toBe(1.0);
  });

  it('命中至少 1 个 → 最低保底 0.4', () => {
    // 5 个 hint,只命中 1 个:1/5 = 0.2,保底 0.4
    const score = calcScoreGenre(['pop', 'jazz', 'classical', 'metal', 'blues'], ['pop', 'rock']);
    expect(score).toBe(0.4);
  });

  it('未命中 → 0', () => {
    expect(calcScoreGenre(['jazz'], ['pop', 'rock'])).toBe(0);
  });
});

// ============================================================================
// 4. 语种匹配 calcScoreLanguage
// ============================================================================

describe('calcScoreLanguage', () => {
  it("languageHint='any' → 0.5(不限制)", () => {
    expect(calcScoreLanguage('any', 'en')).toBe(0.5);
  });

  it("languageHint='any' + 空 songLanguage → 0.5", () => {
    expect(calcScoreLanguage('any', '')).toBe(0.5);
  });

  it('空 songLanguage → 0.5', () => {
    expect(calcScoreLanguage('mandarin', '')).toBe(0.5);
  });

  it('空白 songLanguage → 0.5', () => {
    expect(calcScoreLanguage('mandarin', '   ')).toBe(0.5);
  });

  it('mandarin 完全匹配 mandarin → 1.0', () => {
    expect(calcScoreLanguage('mandarin', 'mandarin')).toBe(1.0);
  });

  it('mandarin 匹配 zh(归一化) → 1.0', () => {
    expect(calcScoreLanguage('mandarin', 'zh')).toBe(1.0);
  });

  it('mandarin 匹配 chinese(归一化) → 1.0', () => {
    expect(calcScoreLanguage('mandarin', 'chinese')).toBe(1.0);
  });

  it('mandarin 匹配 cn(归一化) → 1.0', () => {
    expect(calcScoreLanguage('mandarin', 'cn')).toBe(1.0);
  });

  it('english 匹配 en(归一化) → 1.0', () => {
    expect(calcScoreLanguage('english', 'en')).toBe(1.0);
  });

  it('english 匹配 english → 1.0', () => {
    expect(calcScoreLanguage('english', 'english')).toBe(1.0);
  });

  it('大小写不敏感 → 1.0', () => {
    expect(calcScoreLanguage('mandarin', 'MANDARIN')).toBe(1.0);
    expect(calcScoreLanguage('english', 'EN')).toBe(1.0);
  });

  it('不匹配 mandarin vs english → 0.0', () => {
    expect(calcScoreLanguage('mandarin', 'english')).toBe(0.0);
  });

  it('不匹配 english vs zh → 0.0', () => {
    expect(calcScoreLanguage('english', 'zh')).toBe(0.0);
  });

  it('不匹配 mandarin vs japanese → 0.0', () => {
    expect(calcScoreLanguage('mandarin', 'japanese')).toBe(0.0);
  });
});

// ============================================================================
// 5. 氛围匹配 calcScoreVibe
// ============================================================================

describe('calcScoreVibe', () => {
  it('空 vibeDescription → 0.5', () => {
    expect(calcScoreVibe('', ['beach', 'chill'])).toBe(0.5);
  });

  it('空白 vibeDescription → 0.5', () => {
    expect(calcScoreVibe('   ', ['beach', 'chill'])).toBe(0.5);
  });

  it('空 songSceneTags → 0.5', () => {
    expect(calcScoreVibe('beach', [])).toBe(0.5);
  });

  it('undefined songSceneTags → 0.5', () => {
    expect(calcScoreVibe('beach', undefined)).toBe(0.5);
  });

  it('英文 vibe 完全命中 sceneTag → 1.0', () => {
    // tokens: ['beach', 'chill'],sceneTags: ['beach', 'chill'] → 2/2 = 1.0
    expect(calcScoreVibe('beach chill', ['beach', 'chill'])).toBe(1.0);
  });

  it('英文 vibe 部分命中 → 0.5', () => {
    // tokens: ['beach', 'vibe'],sceneTags: ['summer_beach', 'chill']
    // 'beach' 命中 'summer_beach'('summer_beach'.includes('beach') = true)
    // 'vibe' 不命中 → 1/2 = 0.5
    expect(calcScoreVibe('beach vibe', ['summer_beach', 'chill'])).toBe(0.5);
  });

  it('英文 vibe 未命中 → 0', () => {
    expect(calcScoreVibe('rainy day', ['beach', 'chill'])).toBe(0);
  });

  it('中文 2 字滑窗全部命中 → 1.0', () => {
    // vibeDescription="海边放松",sceneTags=['海边放松']
    // tokens: ['海边','边放','放松'](3 个),每个都 includes 于 '海边放松'
    // 3/3 = 1.0
    expect(calcScoreVibe('海边放松', ['海边放松'])).toBe(1.0);
  });

  it('中文 2 字滑窗部分命中', () => {
    // vibeDescription="海边放松",sceneTags=['海边']
    // tokens: ['海边','边放','放松'](3 个)
    // '海边' 命中 '海边'(完全相等),其他不命中 → 1/3 ≈ 0.333
    const score = calcScoreVibe('海边放松', ['海边']);
    expect(score).toBeCloseTo(1 / 3, 2);
    expect(score).toBeGreaterThanOrEqual(0.3);
  });

  it('中文单字片段', () => {
    // vibeDescription="海",sceneTags=['海']
    // tokens: ['海'](单字),命中 → 1/1 = 1.0
    expect(calcScoreVibe('海', ['海'])).toBe(1.0);
  });

  it('中英混合 vibe 命中', () => {
    // vibeDescription="beach 海边",sceneTags=['beach', '海边']
    // 英文 tokens: ['beach'],中文 tokens: ['海边']
    // 都命中 → 2/2 = 1.0
    expect(calcScoreVibe('beach 海边', ['beach', '海边'])).toBe(1.0);
  });

  it('命中至少 1 个 → 最低保底 0.3', () => {
    // 中文 "海边放松感" → 滑窗 4 个:海边、边放、放松、松感
    // sceneTags 只有 '海边':命中 1/4 = 0.25,保底 0.3
    const score = calcScoreVibe('海边放松感', ['海边']);
    expect(score).toBe(0.3);
  });

  it('未命中(中文 vs 英文 sceneTag) → 0', () => {
    expect(calcScoreVibe('海边放松', ['beach', 'chill'])).toBe(0);
  });
});
