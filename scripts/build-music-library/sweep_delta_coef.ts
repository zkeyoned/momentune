/**
 * sweep_delta_coef.ts
 *
 * Delta 系数搜索脚本：在 v2 三段式融合公式下搜索最优 EMOTION_DELTA_COEF。
 *
 * v2 三段式融合公式：
 *   finalV = genreV + (coef × emotionDeltaV_clamped) + keywordDeltaV
 *   finalA = genreA + (coef × emotionDeltaA_clamped) + keywordDeltaA
 *
 * 其中 keywordDelta 限幅 ±0.05（v2 spec 微调），emotionDelta 限幅 ±0.4（与原版一致）。
 *
 * 流程：
 * 1. 读取金标准 / unified_tags / baseline 报告
 * 2. 对每个候选 coef [0.4..1.0] 用 computeVAWithCoef 生成 Song[]，写入临时文件
 * 3. 用 eval_va 的归一化匹配逻辑评测，收集 6 个指标
 * 4. 判定推荐系数（合格条件 + 优先级）
 * 5. 输出 data/sweep_delta_coef_report.md
 * 6. 清理临时目录
 *
 * 自包含：常量与辅助函数复制自 assign_va.ts / eval_va.ts，不修改主代码。
 *
 * 用法: npx tsx scripts/build-music-library/sweep_delta_coef.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// 类型定义（复制自 assign_va.ts，保持脚本自包含）
// ============================================================================

type GenreTag =
  | 'rap' | 'trap' | 'drill' | 'melodicrap' | 'guofengrap' | 'emorap' | 'pluggnb' | 'memphis' | 'rage' | 'newwave'
  | 'electronic' | 'house' | 'techno' | 'trance' | 'drumandbass' | 'ukgarage' | 'edm' | 'synthwave' | 'hardwave' | 'futurebass' | 'vaporwave' | 'phonk' | 'driftphonk' | 'jerseyclub'
  | 'rnb' | 'soul' | 'funk' | 'disco'
  | 'pop' | 'kpop' | 'jpop' | 'hyperpop' | 'bedroompop' | 'citypop'
  | 'guofeng' | 'gufeng' | 'xiqiang' | 'guofengrock'
  | 'rock' | 'indie' | 'metal' | 'punk' | 'poppunk' | 'emo' | 'postpunk' | 'shoegaze' | 'dreampop' | 'postrock'
  | 'ambient' | 'lofi' | 'dreamcore' | 'classical' | 'jazz' | 'acoustic' | 'choir'
  | 'reggae' | 'reggaeton' | 'dembow' | 'afrobeats' | 'amapiano' | 'bachata' | 'world'
  | 'anime' | 'vocaloid' | 'soundtrack'
  | 'folk' | 'country' | 'blues'
  | 'other';

type SongSceneTag = string;

type LanguageTag = 'mandarin' | 'english' | 'korean' | 'japanese' | 'cantonese' | 'instrumental' | 'other';

type MusicLayer = 'hot' | 'emotion' | 'fallback';

type HotRecency = 'this_week' | 'this_month' | 'half_year' | 'older' | 'never';

type VASource = 'feature_fusion' | 'metadata_keyword' | 'fallback_default';

interface VAWithConfidence {
  v: number;
  a: number;
  confidence: number;
  source: VASource;
}

interface Song {
  songId: string;
  title: string;
  artist: string;
  layer: MusicLayer;
  va: VAWithConfidence;
  genres: GenreTag[];
  sceneTags: SongSceneTag[];
  language: LanguageTag;
  hotRecency: HotRecency;
  decade?: number;
}

interface UnifiedSong {
  title: string;
  artist: string;
  album: string;
  duration: number;
  platforms: string[];
  appearCount: number;
  rawTags: string[];
  primaryGenres: GenreTag[];
  subGenres: GenreTag[];
  emotionTags: string[];
  emotionTagWeights?: Record<string, number>;
  sceneTags: SongSceneTag[];
  eraTags: number[];
  languageTags: string[];
  sourceTags: string[];
  instrumentTags: string[];
  unmappedTags: string[];
}

interface GoldenSong {
  title: string;
  artist: string;
  v: number;
  a: number;
}

type QuadrantKey = '高V高A' | '高V低A' | '低V高A' | '低V低A';

// ============================================================================
// 第 1 层：流派基调 V-A 映射表（复制自 assign_va.ts）
// ============================================================================

const GENRE_VA_BASELINE: Record<GenreTag, { v: number; a: number }> = {
  // 说唱类
  rap: { v: 0.45, a: 0.70 },
  trap: { v: 0.30, a: 0.80 },
  drill: { v: 0.20, a: 0.85 },
  emorap: { v: 0.20, a: 0.60 },
  melodicrap: { v: 0.50, a: 0.60 },
  guofengrap: { v: 0.55, a: 0.65 },
  pluggnb: { v: 0.55, a: 0.55 },
  memphis: { v: 0.25, a: 0.75 },
  rage: { v: 0.30, a: 0.90 },
  newwave: { v: 0.50, a: 0.65 },
  // 电子类
  electronic: { v: 0.55, a: 0.75 },
  house: { v: 0.65, a: 0.70 },
  techno: { v: 0.45, a: 0.80 },
  trance: { v: 0.65, a: 0.80 },
  drumandbass: { v: 0.55, a: 0.90 },
  ukgarage: { v: 0.60, a: 0.75 },
  edm: { v: 0.70, a: 0.85 },
  synthwave: { v: 0.55, a: 0.55 },
  hardwave: { v: 0.40, a: 0.85 },
  futurebass: { v: 0.70, a: 0.70 },
  vaporwave: { v: 0.50, a: 0.30 },
  phonk: { v: 0.35, a: 0.75 },
  driftphonk: { v: 0.35, a: 0.85 },
  jerseyclub: { v: 0.65, a: 0.80 },
  // R&B/灵魂
  rnb: { v: 0.55, a: 0.50 },
  soul: { v: 0.60, a: 0.45 },
  funk: { v: 0.70, a: 0.70 },
  disco: { v: 0.75, a: 0.70 },
  // 流行
  pop: { v: 0.65, a: 0.55 },
  kpop: { v: 0.70, a: 0.65 },
  jpop: { v: 0.65, a: 0.60 },
  hyperpop: { v: 0.65, a: 0.85 },
  bedroompop: { v: 0.60, a: 0.35 },
  citypop: { v: 0.60, a: 0.45 },
  // 国风
  guofeng: { v: 0.55, a: 0.45 },
  gufeng: { v: 0.45, a: 0.35 },
  xiqiang: { v: 0.50, a: 0.40 },
  guofengrock: { v: 0.50, a: 0.60 },
  // 摇滚/独立
  rock: { v: 0.50, a: 0.70 },
  indie: { v: 0.55, a: 0.45 },
  metal: { v: 0.30, a: 0.90 },
  punk: { v: 0.45, a: 0.85 },
  poppunk: { v: 0.60, a: 0.80 },
  emo: { v: 0.30, a: 0.55 },
  postpunk: { v: 0.35, a: 0.55 },
  shoegaze: { v: 0.45, a: 0.35 },
  dreampop: { v: 0.55, a: 0.35 },
  postrock: { v: 0.45, a: 0.50 },
  // 轻音乐/氛围/古典
  ambient: { v: 0.55, a: 0.25 },
  lofi: { v: 0.55, a: 0.30 },
  dreamcore: { v: 0.55, a: 0.25 },
  classical: { v: 0.50, a: 0.30 },
  jazz: { v: 0.55, a: 0.40 },
  acoustic: { v: 0.55, a: 0.35 },
  choir: { v: 0.55, a: 0.35 },
  // 拉丁/非洲/雷鬼
  reggae: { v: 0.65, a: 0.55 },
  reggaeton: { v: 0.70, a: 0.80 },
  dembow: { v: 0.65, a: 0.80 },
  afrobeats: { v: 0.70, a: 0.70 },
  amapiano: { v: 0.65, a: 0.60 },
  bachata: { v: 0.60, a: 0.50 },
  world: { v: 0.55, a: 0.45 },
  // 二次元/ACG/影视
  anime: { v: 0.65, a: 0.65 },
  vocaloid: { v: 0.55, a: 0.60 },
  soundtrack: { v: 0.50, a: 0.45 },
  // 民谣/乡村/根源
  folk: { v: 0.55, a: 0.40 },
  country: { v: 0.55, a: 0.45 },
  blues: { v: 0.35, a: 0.40 },
  // 其他
  other: { v: 0.50, a: 0.45 },
};

// ============================================================================
// 第 2 层：情绪标签→V-A 偏移量映射表（复制自 assign_va.ts）
// ============================================================================

const EMOTION_TAG_VA_OFFSET: Record<string, { vDelta: number; aDelta: number }> = {
  // 消极低能
  '失恋': { vDelta: -0.25, aDelta: 0.05 },
  '伤感': { vDelta: -0.20, aDelta: -0.05 },
  '深夜emo': { vDelta: -0.25, aDelta: -0.15 },
  'emo夜': { vDelta: -0.25, aDelta: -0.15 },
  '怀旧': { vDelta: -0.08, aDelta: -0.10 },
  '孤独': { vDelta: -0.15, aDelta: -0.10 },
  '孤独感': { vDelta: -0.15, aDelta: -0.10 },
  '思念': { vDelta: -0.10, aDelta: -0.05 },
  '雨天': { vDelta: -0.12, aDelta: -0.15 },
  '迷幻': { vDelta: -0.05, aDelta: 0.05 },
  '破防': { vDelta: -0.20, aDelta: 0.10 },
  // 消极高能
  '上头': { vDelta: -0.05, aDelta: 0.15 },
  // 中性
  '氛围感': { vDelta: 0.00, aDelta: -0.05 },
  '暧昧': { vDelta: 0.05, aDelta: -0.05 },
  '共鸣': { vDelta: 0.00, aDelta: 0.00 },
  // 积极低能
  '治愈': { vDelta: 0.15, aDelta: -0.15 },
  '治愈系': { vDelta: 0.15, aDelta: -0.15 },
  '释然': { vDelta: 0.20, aDelta: -0.10 },
  '倔强': { vDelta: 0.10, aDelta: 0.05 },
  // 积极高能
  '励志': { vDelta: 0.20, aDelta: 0.15 },
  '燃向': { vDelta: 0.10, aDelta: 0.25 },
};

// ============================================================================
// 第 3 层：标题关键词规则（复制自 assign_va.ts，原版单字规则）
// ============================================================================

interface KeywordRule {
  keywords: string[];
  vDelta: number;
  aDelta: number;
}

const KEYWORD_RULES: ReadonlyArray<KeywordRule> = [
  // 积极:爱/甜/晴/光/梦/笑
  { keywords: ['爱', '甜', '晴', '光', '梦', '笑', '喜', '欢', '暖', '幸'], vDelta: 0.15, aDelta: 0 },
  // 消极:泪/孤/夜/痛/离/寒/伤/雨
  { keywords: ['泪', '孤', '夜', '痛', '离', '寒', '伤', '雨', '悲', '哀', '愁', '凉'], vDelta: -0.15, aDelta: 0 },
  // 高能:燃/战/狂/炸
  { keywords: ['燃', '战', '狂', '炸', '冲', '飞', '烈'], vDelta: 0, aDelta: 0.20 },
  // 低能:静/慢/轻/柔
  { keywords: ['静', '慢', '轻', '柔', '淡', '眠', '安'], vDelta: 0, aDelta: -0.15 },
];

const HEURISTIC_DEFAULT_V = 0.5;
const HEURISTIC_DEFAULT_A = 0.45;

// ============================================================================
// 辅助函数（复制自 assign_va.ts）
// ============================================================================

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

function generateSongId(platforms: string[], title: string, artist: string): string {
  const platform = platforms[0] ?? 'unknown';
  return `${platform}_${normalizeText(title)}_${normalizeText(artist)}`;
}

function inferLayer(appearCount: number): MusicLayer {
  if (appearCount >= 10) return 'hot';
  if (appearCount >= 3) return 'emotion';
  return 'fallback';
}

function inferHotRecency(appearCount: number): HotRecency {
  if (appearCount >= 30) return 'this_week';
  if (appearCount >= 15) return 'this_month';
  if (appearCount >= 5) return 'half_year';
  if (appearCount >= 1) return 'older';
  return 'never';
}

function inferLanguage(song: UnifiedSong): LanguageTag {
  if (song.instrumentTags.includes('纯音乐')) return 'instrumental';

  for (const tag of song.languageTags) {
    if (tag.includes('粤语') || tag.includes('广东')) return 'cantonese';
    if (tag.includes('欧美') || tag.includes('英语')) return 'english';
    if (tag.includes('韩语') || tag.includes('韩流')) return 'korean';
    if (tag.includes('日语') || tag.includes('日流')) return 'japanese';
    if (tag.includes('华语') || tag.includes('中文')) return 'mandarin';
  }

  const text = `${song.title} ${song.artist}`;

  if (/粤语|广东|港/.test(text)) return 'cantonese';
  if (/[\uac00-\ud7af]/.test(text)) return 'korean';
  if (/[\u3040-\u30ff]/.test(text)) return 'japanese';

  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  const chineseRatio = chineseChars ? chineseChars.length / text.length : 0;
  if (chineseRatio > 0.3) return 'mandarin';

  const latinChars = text.match(/[a-zA-Z]/g);
  const latinRatio = latinChars ? latinChars.length / text.length : 0;
  if (latinRatio > 0.7) return 'english';

  return 'other';
}

function inferDecade(eraTags: number[]): number | undefined {
  if (eraTags.length === 0) return undefined;
  return Math.min(...eraTags);
}

// ============================================================================
// 关键词偏移估计（v2 微调版：±0.05 限幅，重写自原版 keywordEstimateVA）
// ============================================================================

/**
 * v2 spec：keyword 只做微调，幅度限幅 ±0.05。
 * 检测命中规则，命中"积极"类 → vDelta=+0.05；命中"消极"类 → vDelta=-0.05；
 * 命中"高能"类 → aDelta=+0.05；命中"低能"类 → aDelta=-0.05。
 * 同类不累加，异类可抵消，最终限幅 [-0.05, +0.05]。
 */
function keywordEstimateVA(title: string, artist: string): { vDelta: number; aDelta: number; matched: boolean } {
  const text = `${title} ${artist}`;
  let vDelta = 0;
  let aDelta = 0;
  let matched = false;

  // KEYWORD_RULES[0]: 积极 → vDelta +0.05
  if (KEYWORD_RULES[0].keywords.some((kw) => text.includes(kw))) {
    vDelta += 0.05;
    matched = true;
  }
  // KEYWORD_RULES[1]: 消极 → vDelta -0.05
  if (KEYWORD_RULES[1].keywords.some((kw) => text.includes(kw))) {
    vDelta -= 0.05;
    matched = true;
  }
  // KEYWORD_RULES[2]: 高能 → aDelta +0.05
  if (KEYWORD_RULES[2].keywords.some((kw) => text.includes(kw))) {
    aDelta += 0.05;
    matched = true;
  }
  // KEYWORD_RULES[3]: 低能 → aDelta -0.05
  if (KEYWORD_RULES[3].keywords.some((kw) => text.includes(kw))) {
    aDelta -= 0.05;
    matched = true;
  }

  // 限幅 ±0.05
  vDelta = Math.max(-0.05, Math.min(0.05, vDelta));
  aDelta = Math.max(-0.05, Math.min(0.05, aDelta));

  return { vDelta, aDelta, matched };
}

// ============================================================================
// V-A 三段式融合（v2 spec，带 EMOTION_DELTA_COEF）
// ============================================================================

/**
 * v2 三段式融合：
 *   finalV = genreV + (coef × emotionDeltaV_clamped) + keywordDeltaV
 *   finalA = genreA + (coef × emotionDeltaA_clamped) + keywordDeltaA
 *
 * - genreV/genreA：primaryGenres 权重 0.7 + subGenres 权重 0.3；无流派时用 HEURISTIC_DEFAULT_V/A=0.5/0.45
 * - emotionDeltaV/A：累加 EMOTION_TAG_VA_OFFSET 匹配偏移，限幅 ±0.4
 * - keywordDeltaV/A：±0.05 微调（见 keywordEstimateVA）
 * - 兜底：仅无流派无情绪时使用 HEURISTIC_DEFAULT + 关键词偏移
 * - confidence：保持原版 signalCount 逻辑
 * - source：保持原版 'feature_fusion' / 'metadata_keyword' / 'fallback_default'
 */
function computeVAWithCoef(song: UnifiedSong, coef: number): VAWithConfidence {
  // 合并流派标签
  const allGenres = [...song.primaryGenres, ...song.subGenres];
  const hasGenreSignal = allGenres.some((g) => g !== 'other');

  // 第 1 层：流派基调（primaryGenres 权重 0.7，subGenres 权重 0.3）
  let genreV = HEURISTIC_DEFAULT_V;
  let genreA = HEURISTIC_DEFAULT_A;
  if (song.primaryGenres.length > 0) {
    let vSum = 0;
    let aSum = 0;
    for (const g of song.primaryGenres) {
      const baseline = GENRE_VA_BASELINE[g] ?? GENRE_VA_BASELINE.other;
      vSum += baseline.v;
      aSum += baseline.a;
    }
    const primaryV = vSum / song.primaryGenres.length;
    const primaryA = aSum / song.primaryGenres.length;

    if (song.subGenres.length > 0) {
      let subVSum = 0;
      let subASum = 0;
      for (const g of song.subGenres) {
        const baseline = GENRE_VA_BASELINE[g] ?? GENRE_VA_BASELINE.other;
        subVSum += baseline.v;
        subASum += baseline.a;
      }
      const subV = subVSum / song.subGenres.length;
      const subA = subASum / song.subGenres.length;
      genreV = 0.7 * primaryV + 0.3 * subV;
      genreA = 0.7 * primaryA + 0.3 * subA;
    } else {
      genreV = primaryV;
      genreA = primaryA;
    }
  }

  // 第 2 层：情绪标签修正（weight-scaled delta，限制最大幅度 ±0.4）
  const hasEmotionSignal = song.emotionTags.length > 0;
  const weights = song.emotionTagWeights ?? {}; // 兜底：无字段时所有 tag weight=1
  const maxWeight = Math.max(1, ...Object.values(weights));
  let emotionDeltaV = 0;
  let emotionDeltaA = 0;
  let matchedEmotionCount = 0;
  for (const tag of song.emotionTags) {
    const offset = EMOTION_TAG_VA_OFFSET[tag];
    if (offset) {
      const w = weights[tag] ?? 1;
      const scale = w / maxWeight; // 最强 tag 全额，弱 tag 按比例
      emotionDeltaV += offset.vDelta * scale;
      emotionDeltaA += offset.aDelta * scale;
      matchedEmotionCount++;
    }
  }
  emotionDeltaV = Math.max(-0.4, Math.min(0.4, emotionDeltaV));
  emotionDeltaA = Math.max(-0.4, Math.min(0.4, emotionDeltaA));

  // 第 3 层：标题关键词修正（v2 微调版，±0.05 限幅）
  const keywordResult = keywordEstimateVA(song.title, song.artist);
  const hasKeywordSignal = keywordResult.matched;
  const keywordDeltaV = keywordResult.vDelta;
  const keywordDeltaA = keywordResult.aDelta;

  // v2 三段式融合
  let finalV: number;
  let finalA: number;
  let source: VASource = 'feature_fusion';

  if (hasGenreSignal || hasEmotionSignal) {
    // 有流派或情绪：使用三段式融合（无流派时 genreV/A 为 HEURISTIC_DEFAULT）
    finalV = genreV + (coef * emotionDeltaV) + keywordDeltaV;
    finalA = genreA + (coef * emotionDeltaA) + keywordDeltaA;
  } else {
    // 兜底：无流派无情绪，使用默认值 + 关键词偏移
    finalV = HEURISTIC_DEFAULT_V + keywordDeltaV;
    finalA = HEURISTIC_DEFAULT_A + keywordDeltaA;
    source = hasKeywordSignal ? 'metadata_keyword' : 'fallback_default';
  }

  // 置信度：按信号数量递增（保持原版逻辑，Task 5 才改信号一致性）
  let signalCount = 0;
  if (hasGenreSignal) signalCount++;
  if (hasEmotionSignal) signalCount++;
  if (hasKeywordSignal) signalCount++;

  let confidence: number;
  if (signalCount >= 3) confidence = 0.85;
  else if (signalCount === 2) confidence = 0.75;
  else if (signalCount === 1) confidence = 0.60;
  else confidence = 0.40;

  // 多情绪标签印证：+0.05
  if (matchedEmotionCount >= 2) confidence = Math.min(0.90, confidence + 0.05);

  return {
    v: clamp01(finalV),
    a: clamp01(finalA),
    confidence,
    source,
  };
}

// ============================================================================
// 评测辅助函数（复制自 eval_va.ts）
// ============================================================================

function normalizeSegment(s: string): string {
  let t = s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
  t = t.replace(/[^\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7afa-z0-9]/gi, '');
  t = t.toLowerCase();
  t = t.replace(/\s+/g, '');
  return t;
}

function normalizeKey(title: string, artist: string): string {
  return `${normalizeSegment(title)}|${normalizeSegment(artist)}`;
}

function quadrantOf(v: number, a: number): QuadrantKey {
  if (v >= 0.5 && a >= 0.5) return '高V高A';
  if (v >= 0.5 && a < 0.5) return '高V低A';
  if (v < 0.5 && a >= 0.5) return '低V高A';
  return '低V低A';
}

// ============================================================================
// 评测函数
// ============================================================================

interface EvalMetrics {
  vMae: number;
  aMae: number;
  quadrantAccuracy: number;
  lowVAlowA_hits: number;
  avgConfidence: number;
  matchedCount: number;
}

function evaluate(library: Song[], goldenSongs: GoldenSong[]): EvalMetrics {
  const libMap = new Map<string, Song>();
  for (const song of library) {
    const key = normalizeKey(song.title, song.artist);
    if (!libMap.has(key)) libMap.set(key, song);
  }

  let vMaeSum = 0;
  let aMaeSum = 0;
  let quadrantHitCount = 0;
  let lowVAlowA_hits = 0;
  let confidenceSum = 0;
  let matchedCount = 0;

  for (const g of goldenSongs) {
    const key = normalizeKey(g.title, g.artist);
    const matched = libMap.get(key);
    if (!matched) continue;

    matchedCount++;
    vMaeSum += Math.abs(matched.va.v - g.v);
    aMaeSum += Math.abs(matched.va.a - g.a);
    confidenceSum += matched.va.confidence;

    const predQ = quadrantOf(matched.va.v, matched.va.a);
    const goldQ = quadrantOf(g.v, g.a);
    if (predQ === goldQ) {
      quadrantHitCount++;
      if (goldQ === '低V低A') lowVAlowA_hits++;
    }
  }

  const vMae = matchedCount > 0 ? vMaeSum / matchedCount : 0;
  const aMae = matchedCount > 0 ? aMaeSum / matchedCount : 0;
  const quadrantAccuracy = matchedCount > 0 ? quadrantHitCount / matchedCount : 0;
  const avgConfidence = matchedCount > 0 ? confidenceSum / matchedCount : 0;

  return {
    vMae: Number(vMae.toFixed(4)),
    aMae: Number(aMae.toFixed(4)),
    quadrantAccuracy: Number(quadrantAccuracy.toFixed(4)),
    lowVAlowA_hits,
    avgConfidence: Number(avgConfidence.toFixed(4)),
    matchedCount,
  };
}

// ============================================================================
// 主流程
// ============================================================================

interface SweepResult extends EvalMetrics {
  coef: number;
  vPlusA_mae: number;
  qualified: boolean;
}

function main(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const PROJECT_ROOT = path.resolve(__dirname, '../..');
  const DATA_DIR = path.join(PROJECT_ROOT, 'data');

  console.log('=== sweep_delta_coef: Delta 系数搜索（v2 三段式融合）===\n');

  // 1. 读取数据
  const goldenPath = path.join(DATA_DIR, 'va_golden_set.json');
  const tagsPath = path.join(DATA_DIR, 'unified_tags.json');
  const reportPath = path.join(DATA_DIR, 'eval_va_report.json');

  const goldenRaw = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as { songs: GoldenSong[] };
  const goldenSongs = goldenRaw.songs;
  const unifiedSongs = JSON.parse(fs.readFileSync(tagsPath, 'utf-8')) as UnifiedSong[];
  const evalReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as {
    baseline: { vMae: number; aMae: number; quadrantAccuracy: number };
  };

  const baselineVPlusA = evalReport.baseline.vMae + evalReport.baseline.aMae;
  const baselineQuadrant = evalReport.baseline.quadrantAccuracy;
  const qualifiedVPlusAThreshold = baselineVPlusA + 0.005;

  console.log(`读取金标准: ${goldenSongs.length} 首`);
  console.log(`读取待计算歌曲: ${unifiedSongs.length} 首`);
  console.log(`Baseline: V MAE=${evalReport.baseline.vMae}, A MAE=${evalReport.baseline.aMae}, V+A MAE=${baselineVPlusA.toFixed(4)}, 象限命中率=${baselineQuadrant}`);
  console.log(`合格阈值: V+A MAE ≤ ${qualifiedVPlusAThreshold.toFixed(4)} 且 象限命中率 ≥ ${baselineQuadrant}\n`);

  // 2. 准备临时目录
  const tmpDir = path.join(DATA_DIR, '.sweep_tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // 3. 候选系数
  const COEFS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

  // 4. 对每个 coef 执行 sweep
  const results: SweepResult[] = [];

  console.log('=== Sweep 进度 ===');
  for (const coef of COEFS) {
    // 生成 Song[]
    const songs: Song[] = unifiedSongs.map((usong) => {
      const va = computeVAWithCoef(usong, coef);
      const layer = inferLayer(usong.appearCount);
      const language = inferLanguage(usong);
      const hotRecency = inferHotRecency(usong.appearCount);
      const decade = inferDecade(usong.eraTags);
      const genres: GenreTag[] = [...usong.primaryGenres, ...usong.subGenres];
      const song: Song = {
        songId: generateSongId(usong.platforms, usong.title, usong.artist),
        title: usong.title,
        artist: usong.artist,
        layer,
        va,
        genres,
        sceneTags: usong.sceneTags,
        language,
        hotRecency,
      };
      if (decade !== undefined) song.decade = decade;
      return song;
    });

    // 写入临时文件
    const tmpPath = path.join(tmpDir, `library_${coef}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(songs, null, 2), 'utf-8');

    // 评测
    const metrics = evaluate(songs, goldenSongs);
    const vPlusA = metrics.vMae + metrics.aMae;
    const qualified = (vPlusA <= qualifiedVPlusAThreshold) && (metrics.quadrantAccuracy >= baselineQuadrant);

    results.push({
      coef,
      ...metrics,
      vPlusA_mae: Number(vPlusA.toFixed(4)),
      qualified,
    });

    console.log(
      `coef=${coef.toFixed(1)} | V MAE=${metrics.vMae.toFixed(4)} | A MAE=${metrics.aMae.toFixed(4)} | V+A MAE=${vPlusA.toFixed(4)} | 象限命中=${metrics.quadrantAccuracy.toFixed(4)} | 低V低A=${metrics.lowVAlowA_hits} | conf=${metrics.avgConfidence.toFixed(4)} | 匹配=${metrics.matchedCount} | 合格=${qualified ? 'Y' : 'N'}`
    );
  }

  // 5. 判定推荐系数
  const sortedByVPlusA = [...results].sort((a, b) => a.vPlusA_mae - b.vPlusA_mae);
  const sortedByQuadrant = [...results].sort((a, b) => b.quadrantAccuracy - a.quadrantAccuracy);
  const bestMAE = sortedByVPlusA[0];
  const bestQuadrant = sortedByQuadrant[0];

  const qualifiedResults = results.filter((r) => r.qualified);
  let recommended: SweepResult;
  let recommendationReason: string;

  if (qualifiedResults.length > 0) {
    // 合格系数中象限命中率最高者；若相同取 V+A MAE 最低者
    const sortedQualified = [...qualifiedResults].sort((a, b) => {
      if (b.quadrantAccuracy !== a.quadrantAccuracy) return b.quadrantAccuracy - a.quadrantAccuracy;
      return a.vPlusA_mae - b.vPlusA_mae;
    });
    recommended = sortedQualified[0];
    recommendationReason = `合格系数 ${qualifiedResults.length}/${COEFS.length} 个；推荐系数在合格集合中象限命中率最高（${recommended.quadrantAccuracy.toFixed(4)}），V+A MAE=${recommended.vPlusA_mae.toFixed(4)}。`;
  } else {
    // 无合格者：取 V+A MAE 最低者作为兜底
    recommended = bestMAE;
    recommendationReason = `无合格系数，选 V+A MAE 最低作为兜底（V+A MAE=${recommended.vPlusA_mae.toFixed(4)}，象限命中率=${recommended.quadrantAccuracy.toFixed(4)}）。`;
  }

  // 6. 清理临时目录
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // 7. 生成报告（按 V+A MAE 升序）
  const sortedForReport = [...results].sort((a, b) => a.vPlusA_mae - b.vPlusA_mae);

  const tableRows = sortedForReport.map((r) => {
    const isBestMAE = r.coef === bestMAE.coef;
    const isBestQuadrant = r.coef === bestQuadrant.coef;
    const tags: string[] = [];
    if (isBestMAE) tags.push('best MAE');
    if (isBestQuadrant) tags.push('best quadrant');
    const tagStr = tags.length > 0 ? tags.join(', ') : '-';
    return `| ${r.coef.toFixed(1)} | ${r.vMae.toFixed(4)} | ${r.aMae.toFixed(4)} | ${r.vPlusA_mae.toFixed(4)} | ${r.quadrantAccuracy.toFixed(4)} | ${r.lowVAlowA_hits} | ${r.avgConfidence.toFixed(4)} | ${r.matchedCount} | ${r.qualified ? 'Y' : 'N'} | ${tagStr} |`;
  }).join('\n');

  // 趋势分析：计算 coef 与指标的相关性（简单线性趋势）
  const coefMean = COEFS.reduce((a, b) => a + b, 0) / COEFS.length;
  const vPlusAMean = results.reduce((a, b) => a + b.vPlusA_mae, 0) / results.length;
  const quadrantMean = results.reduce((a, b) => a + b.quadrantAccuracy, 0) / results.length;
  let num = 0, denV = 0, denQ = 0;
  for (const r of results) {
    const dc = r.coef - coefMean;
    num += dc * (r.vPlusA_mae - vPlusAMean);
    denV += dc * dc;
    denQ += (r.quadrantAccuracy - quadrantMean) * (r.quadrantAccuracy - quadrantMean);
  }
  const slopeVPlusA = denV > 0 ? num / denV : 0;
  const slopeQuadrant = denV > 0
    ? results.reduce((a, b) => a + (b.coef - coefMean) * (b.quadrantAccuracy - quadrantMean), 0) / denV
    : 0;

  const vPlusATrend = slopeVPlusA > 0.001
    ? `随 coef 增大，V+A MAE **上升**（斜率 +${slopeVPlusA.toFixed(4)}），即低系数误差更小`
    : slopeVPlusA < -0.001
      ? `随 coef 增大，V+A MAE **下降**（斜率 ${slopeVPlusA.toFixed(4)}），即高系数误差更小`
      : `V+A MAE 对 coef 不敏感（斜率 ≈ 0）`;
  const quadrantTrend = slopeQuadrant > 0.001
    ? `随 coef 增大，象限命中率**上升**（斜率 +${slopeQuadrant.toFixed(4)}），即高系数命中更好`
    : slopeQuadrant < -0.001
      ? `随 coef 增大，象限命中率**下降**（斜率 ${slopeQuadrant.toFixed(4)}），即低系数命中更好`
      : `象限命中率对 coef 不敏感（斜率 ≈ 0）`;

  const lowCoef = results.find((r) => r.coef === 0.4)!;
  const highCoef = results.find((r) => r.coef === 1.0)!;
  const midCoef = results.find((r) => r.coef === 0.7)!;

  const report = `# Delta 系数搜索报告

> 搜索脚本：\`scripts/build-music-library/sweep_delta_coef.ts\`
> v2 三段式融合：\`finalV = genreV + (coef × emotionDeltaV_clamped) + keywordDeltaV\`
> **基于去噪后标签 + weight-scaled delta**（emotionDelta 按 weight/maxWeight 归一化缩放）
> 生成时间：${new Date().toISOString()}

## Baseline（来自 data/eval_va_report.json）

| 指标 | 值 |
|------|-----|
| V MAE | ${evalReport.baseline.vMae} |
| A MAE | ${evalReport.baseline.aMae} |
| V+A MAE | ${baselineVPlusA.toFixed(4)} |
| 象限命中率 | ${baselineQuadrant} |
| 合格阈值 | V+A MAE ≤ ${qualifiedVPlusAThreshold.toFixed(4)} **且** 象限命中率 ≥ ${baselineQuadrant} |

## Sweep 结果（按 V+A MAE 升序）

| coef | V MAE | A MAE | V+A MAE | 象限命中率 | 低V低A命中 | 平均confidence | 匹配歌数 | 合格? | 标记 |
|------|-------|-------|---------|-----------|-----------|---------------|---------|-------|------|
${tableRows}

## Recommendation

**推荐系数：\`${recommended.coef.toFixed(1)}\`**

判定理由：${recommendationReason}

- Best MAE：coef=${bestMAE.coef.toFixed(1)}（V+A MAE=${bestMAE.vPlusA_mae.toFixed(4)}）
- Best Quadrant：coef=${bestQuadrant.coef.toFixed(1)}（象限命中率=${bestQuadrant.quadrantAccuracy.toFixed(4)}）
- 合格集合：${qualifiedResults.length > 0 ? qualifiedResults.map((r) => r.coef.toFixed(1)).join(', ') : '（空）'}

> ⚠️ 推荐系数写入报告后，等用户审批再由 Task 2 落地到 \`assign_va.ts\`（sweep 不修改主代码）。

## 趋势分析

### MAE vs 系数

${vPlusATrend}。

- coef=0.4 时 V+A MAE=${lowCoef.vPlusA_mae.toFixed(4)}
- coef=0.7 时 V+A MAE=${midCoef.vPlusA_mae.toFixed(4)}
- coef=1.0 时 V+A MAE=${highCoef.vPlusA_mae.toFixed(4)}

### 象限命中率 vs 系数

${quadrantTrend}。

- coef=0.4 时 象限命中率=${lowCoef.quadrantAccuracy.toFixed(4)}
- coef=0.7 时 象限命中率=${midCoef.quadrantAccuracy.toFixed(4)}
- coef=1.0 时 象限命中率=${highCoef.quadrantAccuracy.toFixed(4)}

### 综合判断

V+A MAE 与象限命中率两条曲线的"最优区间" ${bestMAE.coef === bestQuadrant.coef
  ? '重合于同一系数，推荐无歧义'
  : '不重合（MAE 最优在 coef=' + bestMAE.coef.toFixed(1) + '，象限最优在 coef=' + bestQuadrant.coef.toFixed(1) + '），按合格条件优先象限命中率'}。
`;

  const sweepReportPath = path.join(DATA_DIR, 'sweep_delta_coef_report.md');
  fs.writeFileSync(sweepReportPath, report, 'utf-8');

  // 8. 打印摘要
  console.log('\n=== Sweep 摘要 ===');
  console.log(`候选系数: ${COEFS.map((c) => c.toFixed(1)).join(', ')}`);
  console.log(`Baseline V+A MAE: ${baselineVPlusA.toFixed(4)} (合格阈值 ≤ ${qualifiedVPlusAThreshold.toFixed(4)})`);
  console.log(`Baseline 象限命中率: ${baselineQuadrant}`);
  console.log(`合格系数数: ${qualifiedResults.length} / ${COEFS.length}`);
  console.log(`Best MAE: coef=${bestMAE.coef.toFixed(1)} (V+A MAE=${bestMAE.vPlusA_mae.toFixed(4)})`);
  console.log(`Best Quadrant: coef=${bestQuadrant.coef.toFixed(1)} (象限命中率=${bestQuadrant.quadrantAccuracy.toFixed(4)})`);
  console.log(`\n✓ 推荐系数: ${recommended.coef.toFixed(1)}`);
  console.log(`  理由: ${recommendationReason}`);
  console.log(`\n✓ 报告已写入: ${path.relative(PROJECT_ROOT, sweepReportPath)}`);
  console.log(`✓ 临时目录已清理: ${path.relative(PROJECT_ROOT, tmpDir)}`);
}

main();
