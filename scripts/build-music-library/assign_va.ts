/**
 * assign_va.ts
 *
 * 读取 data/unified_tags.json，为每首歌计算 V-A 坐标（三层融合），
 * 推断其余字段，输出 data/unified_library.json（标准 Song[] 格式）。
 *
 * 核心修复：
 * - 字段映射对齐 unify_tags.ts 的实际输出（primaryGenres/subGenres/eraTags/languageTags）
 * - V-A 三层融合：流派基调（0.5）+ 情绪标签修正（0.35）+ 标题关键词修正（0.15）
 * - 置信度按信号数量递增：仅流派 0.5，+情绪 0.7，+标题 0.8，多情绪印证 0.85
 * - source 改为 'feature_fusion'
 *
 * 用法: npx tsx scripts/build-music-library/assign_va.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findNearestEmotionLabel } from '../../src/algorithm/utils.js';
import type { EmotionLabel } from '../../src/algorithm/types.js';

// ============================================================================
// 类型定义（与 src/algorithm/types.ts 一致）
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
  emotionLabel: EmotionLabel | null;
  genres: GenreTag[];
  sceneTags: SongSceneTag[];
  language: LanguageTag;
  hotRecency: HotRecency;
  decade?: number;
}

// ============================================================================
// unify_tags.ts 的实际输出格式（字段名必须对齐！）
// ============================================================================

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
  sceneTags: SongSceneTag[];
  eraTags: number[];
  languageTags: string[];
  sourceTags: string[];
  instrumentTags: string[];
  unmappedTags: string[];
}

// ============================================================================
// 第 1 层：流派基调 V-A 映射表（细化到子流派级别）
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
// 第 2 层：情绪标签→V-A 偏移量映射表（扩充覆盖所有识别到的情绪标签）
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
// 第 3 层：标题关键词修正
// ============================================================================

interface KeywordRule {
  keywords: string[];
  vDelta: number;
  aDelta: number;
}

const KEYWORD_RULES: ReadonlyArray<KeywordRule> = [
  // 中文双字词（不再用单字匹配，避免误匹配）
  { keywords: ['热爱', '心动', '欢喜', '温暖', '幸福', '快乐', '开心', '阳光', '晴天', '美梦', '笑语'], vDelta: 0.15, aDelta: 0 },
  { keywords: ['孤独', '寂寞', '伤感', '失恋', '怀旧', '悲凉', '凄凉', '离别', '痛心', '伤心', '哀愁', '雨夜', '黑夜', '深夜', '寒冷'], vDelta: -0.15, aDelta: 0 },
  { keywords: ['燃烧', '战斗', '狂热', '冲锋', '飞翔', '烈火', '燃情'], vDelta: 0, aDelta: 0.20 },
  { keywords: ['安静', '缓慢', '轻柔', '柔和', '淡然', '安眠', '宁静', '静谧'], vDelta: 0, aDelta: -0.15 },
  // 英文情绪词（\b 词边界匹配）
  { keywords: ['love', 'loved', 'loving', 'happy', 'joy', 'sweet', 'sunshine', 'dream', 'smile', 'free', 'fly'], vDelta: 0.15, aDelta: 0 },
  { keywords: ['alone', 'lonely', 'cry', 'crying', 'broken', 'lost', 'gone', 'leave', 'leaving', 'sad', 'dark', 'rain', 'tears', 'goodbye', 'miss'], vDelta: -0.15, aDelta: 0 },
  { keywords: ['fire', 'fight', 'wild', 'crazy', 'run', 'burn', 'rage', 'storm'], vDelta: 0, aDelta: 0.20 },
  { keywords: ['quiet', 'slow', 'soft', 'gentle', 'calm', 'peace', 'sleep', 'rest'], vDelta: 0, aDelta: -0.15 },
];

const HEURISTIC_DEFAULT_V = 0.5;
const HEURISTIC_DEFAULT_A = 0.45;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function keywordEstimateVA(title: string, _artist: string): { v: number; a: number; matched: boolean } {
  const text = title; // 只匹配标题，不匹配歌手名
  let v = HEURISTIC_DEFAULT_V;
  let a = HEURISTIC_DEFAULT_A;
  let matched = false;

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      const isEnglish = /^[a-z]+$/i.test(kw);
      const hit = isEnglish
        ? new RegExp(`\\b${kw}\\b`, 'i').test(text)
        : text.includes(kw);
      if (hit) {
        v += rule.vDelta;
        a += rule.aDelta;
        matched = true;
      }
    }
  }

  return { v: clamp01(v), a: clamp01(a), matched };
}

// ============================================================================
// V-A 三层融合（核心逻辑）
// ============================================================================

function computeVA(song: UnifiedSong): VAWithConfidence {
  // 合并流派标签：primaryGenres 权重 0.7，subGenres 权重 0.3
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

  // 第 2 层：情绪标签修正（累加偏移量，限制最大幅度 ±0.4）
  const hasEmotionSignal = song.emotionTags.length > 0;
  let emotionDeltaV = 0;
  let emotionDeltaA = 0;
  let matchedEmotionCount = 0;
  for (const tag of song.emotionTags) {
    const offset = EMOTION_TAG_VA_OFFSET[tag];
    if (offset) {
      emotionDeltaV += offset.vDelta;
      emotionDeltaA += offset.aDelta;
      matchedEmotionCount++;
    }
  }
  // 限制最大偏移幅度，避免极端值
  emotionDeltaV = Math.max(-0.4, Math.min(0.4, emotionDeltaV));
  emotionDeltaA = Math.max(-0.4, Math.min(0.4, emotionDeltaA));

  // 第 3 层：标题关键词修正
  const keywordResult = keywordEstimateVA(song.title, song.artist);
  const hasKeywordSignal = keywordResult.matched;
  const keywordV = keywordResult.v;
  const keywordA = keywordResult.a;

  // 融合：流派基调（0.35）+ 情绪修正（0.50）+ 标题关键词（0.15）
  // 情绪标签是最可靠信号（精确提取），流派有噪声（搜索关键词≠真实流派），故情绪权重最高
  let finalV: number;
  let finalA: number;
  let source: VASource = 'feature_fusion';

  if (hasEmotionSignal && hasGenreSignal) {
    // 有情绪 + 有流派：三层融合，情绪为主
    finalV = 0.35 * genreV + 0.50 * (genreV + emotionDeltaV) + 0.15 * keywordV;
    finalA = 0.35 * genreA + 0.50 * (genreA + emotionDeltaA) + 0.15 * keywordA;
  } else if (hasEmotionSignal) {
    // 有情绪但无流派：情绪为主 + 关键词
    finalV = 0.70 * (HEURISTIC_DEFAULT_V + emotionDeltaV) + 0.30 * keywordV;
    finalA = 0.70 * (HEURISTIC_DEFAULT_A + emotionDeltaA) + 0.30 * keywordA;
  } else if (hasGenreSignal) {
    // 无情绪但有流派：流派 0.7 + 关键词 0.3
    finalV = 0.7 * genreV + 0.3 * keywordV;
    finalA = 0.7 * genreA + 0.3 * keywordA;
  } else {
    // 只有关键词
    finalV = keywordV;
    finalA = keywordA;
    source = keywordResult.matched ? 'metadata_keyword' : 'fallback_default';
  }

  // 置信度：信号方向一致性驱动
  // 1. 计算各层信号方向（V 维度）：+1=积极，-1=消极，0=中性/无信号
  // 2. 多层方向一致 → 高置信度
  // 3. 信号矛盾 → 降低置信度
  // 4. 单一关键词信号 → 封顶 0.5
  const genreDirection = genreV > 0.55 ? 1 : genreV < 0.45 ? -1 : 0; // 流派基调方向
  const emotionDirection = emotionDeltaV > 0.05 ? 1 : emotionDeltaV < -0.05 ? -1 : 0; // 情绪偏移方向
  const keywordDirection = keywordResult.matched
    ? (keywordResult.v > HEURISTIC_DEFAULT_V ? 1 : keywordResult.v < HEURISTIC_DEFAULT_V ? -1 : 0)
    : 0; // 关键词方向（命中时看 v 偏离默认值的方向）

  let confidence: number;

  if (!hasGenreSignal && !hasEmotionSignal && hasKeywordSignal) {
    // 单一关键词信号：封顶 0.5
    confidence = 0.5;
  } else if (hasGenreSignal && hasEmotionSignal) {
    // 流派 + 情绪：检查方向一致性
    if (genreDirection !== 0 && emotionDirection !== 0 && genreDirection === emotionDirection) {
      confidence = 0.90; // 方向一致
    } else if (genreDirection !== 0 && emotionDirection !== 0 && genreDirection !== emotionDirection) {
      confidence = 0.60; // 方向矛盾
    } else {
      confidence = 0.75; // 至少一方中性
    }
    // 关键词同向再加 0.05
    if (hasKeywordSignal && keywordDirection !== 0 && keywordDirection === genreDirection && keywordDirection === emotionDirection) {
      confidence = Math.min(0.95, confidence + 0.05);
    }
    // 多情绪标签印证 +0.05
    if (matchedEmotionCount >= 2) confidence = Math.min(0.95, confidence + 0.05);
  } else if (hasGenreSignal || hasEmotionSignal) {
    // 仅流派或仅情绪 + 关键词
    const mainDirection = hasGenreSignal ? genreDirection : emotionDirection;
    if (mainDirection !== 0 && hasKeywordSignal && keywordDirection !== 0) {
      if (mainDirection === keywordDirection) confidence = 0.80;
      else confidence = 0.55;
    } else {
      confidence = 0.70;
    }
  } else {
    // 无流派无情绪（已上面处理单一关键词，这里是完全无信号）
    confidence = 0.40;
  }

  return {
    v: clamp01(finalV),
    a: clamp01(finalA),
    confidence,
    source,
  };
}

// ============================================================================
// 其余字段推断
// ============================================================================

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
  // 1. 纯音乐优先
  if (song.instrumentTags.includes('纯音乐')) return 'instrumental';

  // 2. 语种标签提示
  for (const tag of song.languageTags) {
    if (tag.includes('粤语') || tag.includes('广东')) return 'cantonese';
    if (tag.includes('欧美') || tag.includes('英语')) return 'english';
    if (tag.includes('韩语') || tag.includes('韩流')) return 'korean';
    if (tag.includes('日语') || tag.includes('日流')) return 'japanese';
    if (tag.includes('华语') || tag.includes('中文')) return 'mandarin';
  }

  // 3. 从标题+歌手文本检测
  const text = `${song.title} ${song.artist}`;

  // 粤语特征词
  if (/粤语|广东|港/.test(text)) return 'cantonese';

  // 韩文
  if (/[\uac00-\ud7af]/.test(text)) return 'korean';

  // 日文（含平假名/片假名）
  if (/[\u3040-\u30ff]/.test(text)) return 'japanese';

  // 中文字符比例
  const chineseChars = text.match(/[\u4e00-\u9fff]/g);
  const chineseRatio = chineseChars ? chineseChars.length / text.length : 0;
  if (chineseRatio > 0.3) return 'mandarin';

  // 拉丁字母占比 > 70% → english（放宽，不再要求整串 ASCII）
  const latinChars = text.match(/[a-zA-Z]/g);
  const latinRatio = latinChars ? latinChars.length / text.length : 0;
  if (latinRatio > 0.7) return 'english';

  return 'other';
}

function inferDecade(eraTags: number[]): number | undefined {
  if (eraTags.length === 0) return undefined;
  // 取最早的年代作为歌曲年代
  return Math.min(...eraTags);
}

// ============================================================================
// 主流程
// ============================================================================

function main(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const PROJECT_ROOT = path.resolve(__dirname, '../..');
  const DATA_DIR = path.join(PROJECT_ROOT, 'data');

  console.log('=== assign_va: V-A 坐标计算与字段推断（v2 修复版）===\n');

  // 1. 读取 unified_tags.json
  const inputPath = path.join(DATA_DIR, 'unified_tags.json');
  if (!fs.existsSync(inputPath)) {
    console.error(`✗ 文件不存在: ${inputPath}`);
    console.error('请先运行: npx tsx scripts/build-music-library/unify_tags.ts');
    process.exit(1);
  }

  const unifiedSongs = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as UnifiedSong[];
  console.log(`读取: ${unifiedSongs.length} 首歌\n`);

  // 2. 计算 V-A 并推断字段
  const songs: Song[] = [];
  const layerCounts = { hot: 0, emotion: 0, fallback: 0 };
  const languageCounts = new Map<LanguageTag, number>();
  const sourceCounts = new Map<VASource, number>();
  let vaSum = { v: 0, a: 0, confidence: 0 };
  let highConfidenceCount = 0;
  let lowConfidenceCount = 0;
  let vMin = 1, vMax = 0, aMin = 1, aMax = 0;

  for (const usong of unifiedSongs) {
    const va = computeVA(usong);
    const layer = inferLayer(usong.appearCount);
    const language = inferLanguage(usong);
    const hotRecency = inferHotRecency(usong.appearCount);
    const decade = inferDecade(usong.eraTags);

    // 合并 primaryGenres + subGenres 作为最终 genres
    const genres: GenreTag[] = [...usong.primaryGenres, ...usong.subGenres];

    layerCounts[layer]++;
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    sourceCounts.set(va.source, (sourceCounts.get(va.source) ?? 0) + 1);
    vaSum.v += va.v;
    vaSum.a += va.a;
    vaSum.confidence += va.confidence;
    if (va.confidence >= 0.70) highConfidenceCount++;
    else lowConfidenceCount++;
    if (va.v < vMin) vMin = va.v;
    if (va.v > vMax) vMax = va.v;
    if (va.a < aMin) aMin = va.a;
    if (va.a > aMax) aMax = va.a;

    const song: Song = {
      songId: generateSongId(usong.platforms, usong.title, usong.artist),
      title: usong.title,
      artist: usong.artist,
      layer,
      va,
      emotionLabel: findNearestEmotionLabel(va),
      genres,
      sceneTags: usong.sceneTags,
      language,
      hotRecency,
    };
    if (decade !== undefined) song.decade = decade;

    songs.push(song);
  }

  // 3. 输出统计
  console.log('=== V-A 统计 ===');
  console.log(`平均 V: ${(vaSum.v / songs.length).toFixed(3)}`);
  console.log(`平均 A: ${(vaSum.a / songs.length).toFixed(3)}`);
  console.log(`V 范围: [${vMin.toFixed(3)}, ${vMax.toFixed(3)}]`);
  console.log(`A 范围: [${aMin.toFixed(3)}, ${aMax.toFixed(3)}]`);
  console.log(`平均 confidence: ${(vaSum.confidence / songs.length).toFixed(3)}`);
  console.log(`高置信度 (≥0.70): ${highConfidenceCount} (${((highConfidenceCount / songs.length) * 100).toFixed(1)}%)`);
  console.log(`低置信度 (<0.70): ${lowConfidenceCount} (${((lowConfidenceCount / songs.length) * 100).toFixed(1)}%)`);

  console.log('\n=== Source 分布 ===');
  for (const [src, c] of sourceCounts) {
    console.log(`  ${src}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n=== Layer 分布 ===');
  console.log(`hot: ${layerCounts.hot} (${((layerCounts.hot / songs.length) * 100).toFixed(1)}%)`);
  console.log(`emotion: ${layerCounts.emotion} (${((layerCounts.emotion / songs.length) * 100).toFixed(1)}%)`);
  console.log(`fallback: ${layerCounts.fallback} (${((layerCounts.fallback / songs.length) * 100).toFixed(1)}%)`);

  console.log('\n=== 语言分布 ===');
  const langSorted = Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [lang, count] of langSorted) {
    console.log(`  ${lang}: ${count} (${((count / songs.length) * 100).toFixed(1)}%)`);
  }

  // V-A 分布象限统计
  const quadrants = { '高V高A': 0, '高V低A': 0, '低V高A': 0, '低V低A': 0 };
  for (const song of songs) {
    if (song.va.v >= 0.5 && song.va.a >= 0.5) quadrants['高V高A']++;
    else if (song.va.v >= 0.5 && song.va.a < 0.5) quadrants['高V低A']++;
    else if (song.va.v < 0.5 && song.va.a >= 0.5) quadrants['低V高A']++;
    else quadrants['低V低A']++;
  }
  console.log('\n=== V-A 象限分布 ===');
  for (const [q, c] of Object.entries(quadrants)) {
    console.log(`  ${q}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }

  // 4. 写入文件
  const outputPath = path.join(DATA_DIR, 'unified_library.json');
  fs.writeFileSync(outputPath, JSON.stringify(songs, null, 2), 'utf-8');
  console.log(`\n✓ 输出: ${outputPath}`);

  // 5. 抽检示例
  console.log('\n=== 抽检示例 ===\n');

  const findPair = (titleSub: string, artistSub: string) => {
    const u = unifiedSongs.find(s => s.title.includes(titleSub) && s.artist.includes(artistSub));
    if (!u) return null;
    const s = songs.find(s => s.songId === generateSongId(u.platforms, u.title, u.artist));
    return { u, s };
  };

  const printPair = (pair: { u: UnifiedSong; s: Song } | null, label: string) => {
    console.log(`${label}:`);
    if (!pair) { console.log('  (未找到)\n'); return; }
    const { u, s } = pair;
    console.log(`  🎵 ${s.title} - ${s.artist}`);
    console.log(`     genres: [${s.genres.join(', ')}]`);
    console.log(`     emotionTags: [${u.emotionTags.join(', ')}]`);
    console.log(`     V=${s.va.v.toFixed(3)} A=${s.va.a.toFixed(3)} conf=${s.va.confidence.toFixed(2)} source=${s.va.source}`);
    console.log(`     layer=${s.layer} lang=${s.language} decade=${s.decade ?? '-'}\n`);
  };

  printPair(findPair('偏爱', '张芸京'), '[1] 《偏爱》张芸京 (期望: 中V低A, 失恋情绪)');
  printPair(findPair('起风了', '买辣椒'), '[2] 《起风了》买辣椒也用券 (期望: 中V中A, 励志)');
  printPair(findPair('红', '罗言'), '[3] 《红》罗言 (期望: 低V中A, emorap)');
  printPair(findPair('不遗憾', '李荣浩'), '[4] 《不遗憾》李荣浩 (期望: 中V低A, 释然)');
  printPair(findPair('罗生门', '梨冻紧'), '[5] 《罗生门》梨冻紧 (期望: 低V中A, 暧昧)');

  // 失恋类歌曲抽检
  console.log('  失恋类歌曲 (期望低V):');
  const breakup = unifiedSongs.filter(u => u.emotionTags.includes('失恋')).slice(0, 3);
  for (const u of breakup) {
    const s = songs.find(s => s.songId === generateSongId(u.platforms, u.title, u.artist));
    if (s) console.log(`    ${s.title} - ${s.artist}: V=${s.va.v.toFixed(3)} A=${s.va.a.toFixed(3)}`);
  }

  // 励志类歌曲抽检
  console.log('\n  励志类歌曲 (期望高V高A):');
  const inspire = unifiedSongs.filter(u => u.emotionTags.includes('励志')).slice(0, 3);
  for (const u of inspire) {
    const s = songs.find(s => s.songId === generateSongId(u.platforms, u.title, u.artist));
    if (s) console.log(`    ${s.title} - ${s.artist}: V=${s.va.v.toFixed(3)} A=${s.va.a.toFixed(3)}`);
  }

  // 燃向类歌曲抽检
  console.log('\n  燃向类歌曲 (期望高A):');
  const hype = unifiedSongs.filter(u => u.emotionTags.includes('燃向')).slice(0, 3);
  for (const u of hype) {
    const s = songs.find(s => s.songId === generateSongId(u.platforms, u.title, u.artist));
    if (s) console.log(`    ${s.title} - ${s.artist}: V=${s.va.v.toFixed(3)} A=${s.va.a.toFixed(3)}`);
  }
}

main();
