/**
 * unify_tags.ts
 *
 * 读取三平台原始 JSON 数据，跨平台去重合并，按"主类合并 + 多关键词印证"归一标签。
 * 输出 data/unified_tags.json
 *
 * 核心改进（解决标签爆炸）：
 * - raw_tags 是"搜索关键词"而非平台官方标签，把所有命中流派的关键词都标为流派会导致
 *   一首歌 10+ 流派标签。
 * - 新逻辑：同大类的多个子流派关键词合并为 1 个主类 + 1-2 个最强子流派。
 *   例如命中 [情绪说唱, 旋律说唱, 陷阱说唱, 抑郁说唱, 痛苦说唱]
 *   → primaryGenres: ['rap'], subGenres: ['emorap', 'melodicrap']
 * - 非流派关键词精细分类：情绪/场景/年代/语种/来源/乐器。
 *
 * 用法: npx tsx scripts/build-music-library/unify_tags.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// 类型定义（与 src/algorithm/types.ts 的 GenreTag 一致）
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

/** 主类名（同时也是该大类的代表 GenreTag） */
type GenreFamily =
  | 'rap' | 'electronic' | 'rnb' | 'pop' | 'guofeng'
  | 'rock' | 'ambient' | 'world' | 'anime' | 'folk';

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
  sceneTags: string[];
  eraTags: number[];
  languageTags: string[];
  sourceTags: string[];
  instrumentTags: string[];
  unmappedTags: string[];
}

// ============================================================================
// GENRE_KEYWORD_MAPPING（与 src/algorithm/config/genreTags.ts 一致 + 补充）
// 顺序很重要：更具体的子流派在前，避免被通用标签抢匹配。
// ============================================================================

const GENRE_KEYWORD_MAPPING: ReadonlyArray<{ keywords: string[]; genre: GenreTag }> = [
  // —— 补充映射 ——
  { keywords: ['freestyle'], genre: 'rap' },
  { keywords: ['拉丁'], genre: 'world' },
  { keywords: ['动漫'], genre: 'anime' },

  // —— 以下与 genreTags.ts 完全一致 ——
  { keywords: ['bedroom pop', 'bedroompop', '卧室流行'], genre: 'bedroompop' },
  { keywords: ['indie', '独立', 'independent', 'bedroom pop', 'indie pop', 'indie rock', 'indie folk', 'indie electronic', 'indie r&b'], genre: 'indie' },
  { keywords: ['jazz', '爵士', 'swing', 'big band', 'bebop', 'smooth jazz', 'cool jazz', 'fusion', 'blue note'], genre: 'jazz' },
  { keywords: ['classical', '古典', 'symphony', '交响', 'orchestral', '管弦', 'sonata', '协奏曲', 'piano solo', '钢琴曲', 'concerto'], genre: 'classical' },
  { keywords: ['soul', '灵魂', 'neo soul', 'motown', 'philly soul', 'northern soul'], genre: 'soul' },
  { keywords: ['funk', '放克', 'funk rock', 'funk pop', 'parliament funk', 'p-funk'], genre: 'funk' },
  { keywords: ['disco', '迪斯科', 'nu disco', 'italo disco', 'euro disco'], genre: 'disco' },
  { keywords: ['rnb', 'r&b', 'rhythm', 'soul', 'neo soul', 'alternative r&b', '节奏布鲁斯', 'neo r&b'], genre: 'rnb' },
  { keywords: ['blues', '布鲁斯', 'delta blues', 'chicago blues', 'rhythm and blues', 'blues rock'], genre: 'blues' },
  { keywords: ['metal', '金属', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'symphonic metal', 'nu metal', 'power metal'], genre: 'metal' },
  { keywords: ['punk', '朋克', 'hardcore', 'ska punk', 'new wave punk'], genre: 'punk' },
  { keywords: ['post-punk', 'post punk', 'postpunk'], genre: 'postpunk' },
  { keywords: ['pop-punk', 'pop punk', 'poppunk'], genre: 'poppunk' },
  { keywords: ['midwest emo', 'emo rock', 'emo punk', 'emo'], genre: 'emo' },
  { keywords: ['country', '乡村', 'bluegrass', '兰草', 'country folk', 'country pop', 'honky tonk'], genre: 'country' },
  { keywords: ['reggae', '雷鬼', 'ska', 'dub', 'dancehall'], genre: 'reggae' },
  { keywords: ['ambient', '氛围', 'drone', 'new age', '环境音乐', 'dark ambient', 'space music'], genre: 'ambient' },
  { keywords: ['dreamcore', '梦核'], genre: 'dreamcore' },
  { keywords: ['kpop', 'k-pop', '韩流', '韩国流行', 'korean pop'], genre: 'kpop' },
  { keywords: ['jpop', 'j-pop', '日流', '日本流行', 'japanese pop', '动漫流行', 'anime pop'], genre: 'jpop' },
  { keywords: ['shoegaze', 'shoe gaze'], genre: 'shoegaze' },
  { keywords: ['dream pop', 'dreampop'], genre: 'dreampop' },
  { keywords: ['hyperpop', '超流行'], genre: 'hyperpop' },
  { keywords: ['city pop', 'citypop'], genre: 'citypop' },
  { keywords: ['pop', '流行', '华语流行', 'chamber pop', '流行舞曲', 'dance pop', 'teen pop', 'electropop'], genre: 'pop' },
  { keywords: ['acoustic', '原声', '不插电', 'unplugged', 'solo acoustic', '纯人声'], genre: 'acoustic' },
  { keywords: ['choir', '合唱', '阿卡贝拉', '赞美诗', 'gospel'], genre: 'choir' },
  { keywords: ['folk', '民谣', '城市民谣', '校园民谣', '独立民谣', 'acoustic', 'singer-songwriter', '唱作人'], genre: 'folk' },
  { keywords: ['house', '浩室', 'deep house', 'tech house'], genre: 'house' },
  { keywords: ['edm', '电子舞曲', 'festival', 'big room'], genre: 'edm' },
  { keywords: ['drift phonk', 'driftphonk'], genre: 'driftphonk' },
  { keywords: ['jersey club', 'jersey club remix', '新泽西俱乐部'], genre: 'jerseyclub' },
  { keywords: ['phonk', '漂移电音'], genre: 'phonk' },
  { keywords: ['future bass', 'futurebass'], genre: 'futurebass' },
  { keywords: ['synthwave', 'synth wave'], genre: 'synthwave' },
  { keywords: ['vaporwave', 'vapor wave', '蒸汽波'], genre: 'vaporwave' },
  { keywords: ['electronic', '电子', 'edm', 'house', 'dubstep', 'future bass', 'synth', '电子乐'], genre: 'electronic' },
  { keywords: ['trap', '陷阱', '陷阱音乐', '808'], genre: 'trap' },
  { keywords: ['drill', 'drill music'], genre: 'drill' },
  { keywords: ['emo rap', 'emotional rap', '情绪说唱', '痛苦说唱', '抑郁说唱', 'sad rap', 'lil peep', 'juice wrld'], genre: 'emorap' },
  { keywords: ['pluggnb', 'plugg n b', 'plugg&b', 'plugg and b'], genre: 'pluggnb' },
  { keywords: ['memphis rap', 'memphis horrorcore', '孟菲斯说唱', 'three 6 mafia', 'three 6', '808 cowbell'], genre: 'memphis' },
  { keywords: ['melodic rap', 'melody rap', '旋律说唱', 'singing rap', 'melodic hip hop'], genre: 'melodicrap' },
  { keywords: ['国风说唱', '古风说唱', 'guofeng rap', 'chinese rap guofeng', '戏腔说唱'], genre: 'guofengrap' },
  { keywords: ['rage rap', 'rage', 'opium', 'playboi carti', 'yeat', 'ken carson', '暗黑陷阱'], genre: 'rage' },
  { keywords: ['new wave rap', 'new wave hip hop', '新浪潮说唱', '新浪潮'], genre: 'newwave' },
  { keywords: ['rap', 'hiphop', 'hip-hop', 'hip hop', '说唱', 'trap', 'mumble rap', '中国说唱', 'drill', 'boom bap'], genre: 'rap' },
  { keywords: ['古风', 'gu feng', 'gufeng'], genre: 'gufeng' },
  { keywords: ['戏腔', 'xi qiang', 'xiqiang'], genre: 'xiqiang' },
  { keywords: ['guofeng rock', '国风摇滚'], genre: 'guofengrock' },
  { keywords: ['guofeng', '国风', '古风', '中国风', '戏腔', 'chinese traditional', '民乐', '五声音阶', '古筝', '琵琶'], genre: 'guofeng' },
  { keywords: ['post rock', 'postrock', 'post-rock', '后摇', '后摇滚', 'instrumental rock'], genre: 'postrock' },
  { keywords: ['rock', '摇滚', 'alternative rock', 'britpop', 'garage rock', 'psychedelic rock', 'post rock', 'stadium rock'], genre: 'rock' },
  { keywords: ['soundtrack', 'ost', '影视配乐', '电影原声', '配乐', 'score', 'incidental music'], genre: 'soundtrack' },
  { keywords: ['world', '世界音乐', '世界民族', 'african', 'latin', 'brazilian', ' indian', 'celtic', 'flamenco', 'bossa nova', 'samba', 'tango'], genre: 'world' },
  { keywords: ['lofi', 'lo-fi', 'chillhop', 'lofi hip hop', 'lofi beats', 'study music', 'relax beats', 'chill beats'], genre: 'lofi' },
  { keywords: ['amapiano', 'log drum', 'south african house'], genre: 'amapiano' },
  { keywords: ['afrobeats', 'afrobeat', 'afro pop', 'afro-pop', 'afroswing'], genre: 'afrobeats' },
  { keywords: ['drum and bass', 'drum & bass', 'liquid dnb', 'jungle', 'dnb', 'd&b'], genre: 'drumandbass' },
  { keywords: ['uk garage', 'speed garage', '2-step', '2 step', 'ukg'], genre: 'ukgarage' },
  { keywords: ['detroit techno', 'industrial techno', 'minimal techno', 'techno'], genre: 'techno' },
  { keywords: ['reggaeton', 'regueton', 'reggaetón'], genre: 'reggaeton' },
  { keywords: ['dembow'], genre: 'dembow' },
  { keywords: ['psytrance', 'goa trance', 'uplifting trance', 'trance'], genre: 'trance' },
  { keywords: ['hardwave', 'hard wave'], genre: 'hardwave' },
  { keywords: ['anime op', 'anime ed', 'anime ost', 'anime opening', 'anime ending', 'anime'], genre: 'anime' },
  { keywords: ['vocaloid', 'hatsune', '初音', '洛天依'], genre: 'vocaloid' },
  { keywords: ['bachata'], genre: 'bachata' },
];

/** raw_tag → GenreTag（首个 keyword 子串命中即返回） */
function normalizeGenre(raw: string): GenreTag {
  const lower = raw.toLowerCase().trim();
  for (const entry of GENRE_KEYWORD_MAPPING) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return entry.genre;
      }
    }
  }
  return 'other';
}

// ============================================================================
// 主类归属表：主类 → 子流派列表（主类自身 GenreTag 也列入，作为兜底子流派）
// 依据 src/algorithm/types.ts 的 GENRE_TAGS 分组 + 任务规格
// ============================================================================

const GENRE_FAMILY: Record<GenreFamily, GenreTag[]> = {
  rap: ['rap', 'trap', 'drill', 'melodicrap', 'guofengrap', 'emorap', 'pluggnb', 'memphis', 'rage', 'newwave'],
  electronic: ['electronic', 'house', 'techno', 'trance', 'drumandbass', 'ukgarage', 'edm', 'synthwave', 'hardwave', 'futurebass', 'vaporwave', 'phonk', 'driftphonk', 'jerseyclub'],
  rnb: ['rnb', 'soul', 'funk', 'disco'],
  pop: ['pop', 'kpop', 'jpop', 'hyperpop', 'bedroompop', 'citypop'],
  guofeng: ['guofeng', 'gufeng', 'xiqiang', 'guofengrock'],
  rock: ['rock', 'indie', 'metal', 'punk', 'poppunk', 'emo', 'postpunk', 'shoegaze', 'dreampop', 'postrock'],
  ambient: ['ambient', 'lofi', 'dreamcore', 'classical', 'jazz', 'acoustic', 'choir'],
  world: ['reggae', 'reggaeton', 'dembow', 'afrobeats', 'amapiano', 'bachata', 'world'],
  anime: ['anime', 'vocaloid', 'soundtrack'],
  folk: ['folk', 'country', 'blues'],
};

/** 子流派 → 主类 反向映射 */
const SUBGENRE_TO_FAMILY = new Map<GenreTag, GenreFamily>();
for (const family of Object.keys(GENRE_FAMILY) as GenreFamily[]) {
  for (const sub of GENRE_FAMILY[family]) {
    SUBGENRE_TO_FAMILY.set(sub, family);
  }
}

// ============================================================================
// 非流派标签分类（精确匹配，优先级：情绪 > 场景 > 年代 > 语种 > 来源 > 乐器）
// ============================================================================

/** 情绪标签：用于 V-A 修正。'emo' 单独出现已被流派捕获（→emo），不在此列。 */
const EMOTION_KEYWORDS = new Set([
  '失恋', '伤感', '治愈', '治愈系', '燃向', '深夜emo', 'emo夜', '雨天', '怀旧', '励志',
  '暧昧', '迷幻', '破防', '共鸣', '孤独', '思念', '释然', '倔强', '孤独感', '氛围感', '上头',
]);

/** 场景标签：用于场景匹配。'雨天' 同时在情绪表，按优先级归情绪。 */
const SCENE_KEYWORDS = new Set([
  '咖啡厅', '公路旅行', '旅行', '运动', '健身', '学习', '工作', '睡眠',
  '夜晚', '深夜', '公路', '驾驶', '通勤', '聚会', '独处', '散步',
]);

/** 年代标签关键词（含无数字的"经典/怀旧"，但后者不产生 era 数字）。'怀旧' 同时在情绪表，归情绪。 */
const ERA_KEYWORDS = new Set(['80年代', '90年代', '00年代', '10年代', '20年代', '经典']);

/** 从"X0年代"提取年代数字（80→1980, 00→2000, 20→2020） */
function extractEra(tag: string): number | null {
  const m = tag.match(/(\d{2})年代/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 80 && n <= 99) return 1900 + n;
  if (n >= 0 && n <= 29) return 2000 + n;
  return null;
}

/** 语种标签 */
const LANGUAGE_KEYWORDS = new Set([
  '华语经典', '粤语经典', '欧美流行', '韩语', '日语', '英语',
  '华语', '粤语', '中文', '欧美', '韩流', '日流',
]);

/** 来源标签 */
const SOURCE_KEYWORDS = new Set(['抖音热歌', '翻唱', '原唱', 'cover', '抖音', '快手']);

/** 乐器标签（注："钢琴曲"已被流派 classical 捕获，不会进入此处） */
const INSTRUMENT_KEYWORDS = new Set(['吉他', '纯音乐', '钢琴曲', '钢琴', '吉他曲', '小提琴', '电子琴']);

interface NonGenreResult {
  emotion?: string;
  scene?: string;
  era?: number;
  language?: string;
  source?: string;
  instrument?: string;
  unmapped?: string;
}

/** 对未命中流派的 raw_tag 做精细分类 */
function classifyNonGenre(tag: string): NonGenreResult {
  if (EMOTION_KEYWORDS.has(tag)) return { emotion: tag };
  if (SCENE_KEYWORDS.has(tag)) return { scene: tag };
  if (ERA_KEYWORDS.has(tag)) {
    const era = extractEra(tag);
    return era !== null ? { era } : {}; // "经典" 无数字：消耗但不计入任何字段
  }
  if (LANGUAGE_KEYWORDS.has(tag)) return { language: tag };
  if (SOURCE_KEYWORDS.has(tag)) return { source: tag };
  if (INSTRUMENT_KEYWORDS.has(tag)) return { instrument: tag };
  return { unmapped: tag };
}

// ============================================================================
// 主类合并 + 多关键词印证
// ============================================================================

interface MergedGenres {
  primaryGenres: GenreTag[];
  subGenres: GenreTag[];
}

/**
 * 根据 family 命中表计算 primaryGenres / subGenres。
 *
 * - primaryGenres: 取命中关键词数最多的 1-3 个主类（按总命中数降序，并列按字母序）
 * - subGenres: 每个选中主类下取命中数最多的 1-2 个子流派（排除主类自身 GenreTag，
 *   避免冗余；按命中数降序，并列按字母序），全局上限 4 个
 * - 无任何命中 → primaryGenres: ['pop']（流行兜底）
 */
function finalizeGenres(familyHits: Map<GenreFamily, Map<GenreTag, number>>): MergedGenres {
  if (familyHits.size === 0) {
    return { primaryGenres: ['pop'], subGenres: [] };
  }

  const familyTotals = Array.from(familyHits.entries()).map(([family, subMap]) => {
    let total = 0;
    for (const c of subMap.values()) total += c;
    return { family, total, subMap };
  });

  familyTotals.sort((a, b) => b.total - a.total || a.family.localeCompare(b.family));
  const selected = familyTotals.slice(0, 3);
  const primaryGenres = selected.map(s => s.family as GenreTag);

  const subGenres: GenreTag[] = [];
  for (const s of selected) {
    const subs = Array.from(s.subMap.entries())
      .filter(([g]) => g !== s.family) // 排除主类自身 GenreTag
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([g]) => g);
    for (const g of subs) {
      if (subGenres.length >= 4) break;
      subGenres.push(g);
    }
    if (subGenres.length >= 4) break;
  }

  return { primaryGenres, subGenres };
}

// ============================================================================
// 主流程
// ============================================================================

interface RawSong {
  platform_id: string;
  platform: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  raw_tags: string[];
  appear_count: number;
}

function normalizeKey(title: string, artist: string): string {
  return `${title.toLowerCase().replace(/\s+/g, '')}|${artist.toLowerCase().replace(/\s+/g, '')}`;
}

function main(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const PROJECT_ROOT = path.resolve(__dirname, '../..');
  const DATA_DIR = path.join(PROJECT_ROOT, 'data');

  console.log('=== unify_tags: 多平台音乐数据合并（主类归一版） ===\n');

  // 1. 读取三份原始数据
  const files = [
    { platform: 'soda', file: 'soda_songs.json' },
    { platform: 'netease', file: 'netease_songs.json' },
    { platform: 'qq', file: 'qq_songs.json' },
  ];

  const allSongs: RawSong[] = [];
  for (const { platform, file } of files) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ 文件不存在: ${filePath}`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawSong[];
    console.log(`读取 ${platform}: ${raw.length} 首歌`);
    allSongs.push(...raw);
  }
  console.log(`\n总共读取: ${allSongs.length} 首歌\n`);

  // 2. 跨平台去重合并（按 title+artist 归一化）
  const merged = new Map<string, {
    title: string;
    artist: string;
    album: string;
    duration: number;
    platforms: Set<string>;
    appearCount: number;
    rawTags: Set<string>;
  }>();

  for (const song of allSongs) {
    const key = normalizeKey(song.title, song.artist);
    const existing = merged.get(key);
    if (existing) {
      existing.platforms.add(song.platform);
      existing.appearCount += song.appear_count;
      for (const tag of song.raw_tags) existing.rawTags.add(tag);
      if (!existing.album && song.album) existing.album = song.album;
      if (song.duration > existing.duration) existing.duration = song.duration;
    } else {
      merged.set(key, {
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        platforms: new Set([song.platform]),
        appearCount: song.appear_count,
        rawTags: new Set(song.raw_tags),
      });
    }
  }

  console.log(`去重合并后: ${merged.size} 首歌\n`);

  // 3. 分类标签
  const unifiedSongs: UnifiedSong[] = [];
  const primaryGenreCounts = new Map<GenreTag, number>();
  const unmappedTagCounts = new Map<string, number>();
  let totalEmotions = 0;
  let totalScenes = 0;
  let totalEras = 0;
  let totalLanguages = 0;
  let totalSources = 0;
  let totalInstruments = 0;
  let totalUnmapped = 0;
  let totalPrimary = 0;
  let totalSub = 0;

  for (const song of merged.values()) {
    const rawTags = Array.from(song.rawTags);

    const familyHits = new Map<GenreFamily, Map<GenreTag, number>>();
    const emotionTags: string[] = [];
    const sceneTags: string[] = [];
    const eraTags: number[] = [];
    const languageTags: string[] = [];
    const sourceTags: string[] = [];
    const instrumentTags: string[] = [];
    const unmappedTags: string[] = [];

    for (const tag of rawTags) {
      const genre = normalizeGenre(tag);
      if (genre !== 'other') {
        const family = SUBGENRE_TO_FAMILY.get(genre);
        if (family) {
          if (!familyHits.has(family)) familyHits.set(family, new Map());
          const subMap = familyHits.get(family)!;
          subMap.set(genre, (subMap.get(genre) ?? 0) + 1);
        }
        continue;
      }
      // 非流派精细分类
      const r = classifyNonGenre(tag);
      if (r.emotion) emotionTags.push(r.emotion);
      else if (r.scene) sceneTags.push(r.scene);
      else if (r.era !== undefined) eraTags.push(r.era);
      else if (r.language) languageTags.push(r.language);
      else if (r.source) sourceTags.push(r.source);
      else if (r.instrument) instrumentTags.push(r.instrument);
      else if (r.unmapped) {
        unmappedTags.push(r.unmapped);
        unmappedTagCounts.set(r.unmapped, (unmappedTagCounts.get(r.unmapped) ?? 0) + 1);
      }
      // "经典"等无数字年代词：r 为 {}，消耗但不计入
    }

    const { primaryGenres, subGenres } = finalizeGenres(familyHits);

    for (const g of primaryGenres) primaryGenreCounts.set(g, (primaryGenreCounts.get(g) ?? 0) + 1);
    totalPrimary += primaryGenres.length;
    totalSub += subGenres.length;
    totalEmotions += emotionTags.length;
    totalScenes += sceneTags.length;
    totalEras += eraTags.length;
    totalLanguages += languageTags.length;
    totalSources += sourceTags.length;
    totalInstruments += instrumentTags.length;
    totalUnmapped += unmappedTags.length;

    unifiedSongs.push({
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      platforms: Array.from(song.platforms),
      appearCount: song.appearCount,
      rawTags,
      primaryGenres,
      subGenres,
      emotionTags,
      sceneTags,
      eraTags,
      languageTags,
      sourceTags,
      instrumentTags,
      unmappedTags,
    });
  }

  // 4. 输出统计
  console.log('=== 分类统计 ===');
  console.log(`总歌曲数: ${unifiedSongs.length}`);
  console.log(`平均主类流派数/首: ${(totalPrimary / unifiedSongs.length).toFixed(2)}`);
  console.log(`平均子流派数/首: ${(totalSub / unifiedSongs.length).toFixed(2)}`);
  console.log(`平均情绪标签数/首: ${(totalEmotions / unifiedSongs.length).toFixed(2)}`);
  console.log(`有场景标签的歌次: ${totalScenes}`);
  console.log(`有年代标签的歌次: ${totalEras}`);
  console.log(`有语种标签的歌次: ${totalLanguages}`);
  console.log(`来源标签总数: ${totalSources}`);
  console.log(`乐器标签总数: ${totalInstruments}`);
  console.log(`未映射标签总数: ${totalUnmapped}`);

  console.log('\nprimaryGenres 分布 Top 10:');
  const genreTop = Array.from(primaryGenreCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [g, c] of genreTop) {
    console.log(`  ${g}: ${c} (${(c / unifiedSongs.length * 100).toFixed(1)}%)`);
  }

  if (unmappedTagCounts.size > 0) {
    console.log('\nunmappedTags Top 20:');
    const sorted = Array.from(unmappedTagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [tag, count] of sorted) {
      console.log(`  ${tag}: ${count}`);
    }
  }

  const platformCounts = new Map<string, number>();
  for (const song of unifiedSongs) {
    for (const p of song.platforms) {
      platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);
    }
  }
  console.log('\n平台分布:');
  for (const [p, c] of platformCounts) {
    console.log(`  ${p}: ${c}`);
  }

  // 5. 写入文件
  const outputPath = path.join(DATA_DIR, 'unified_tags.json');
  fs.writeFileSync(outputPath, JSON.stringify(unifiedSongs, null, 2), 'utf-8');
  console.log(`\n✓ 输出: ${outputPath}`);

  // 6. 抽检验证
  console.log('\n=== 抽检验证（5 首） ===\n');

  const findSong = (titleSub: string, artistSub: string): UnifiedSong | undefined =>
    unifiedSongs.find(s => s.title.includes(titleSub) && s.artist.includes(artistSub));

  const printSong = (s: UnifiedSong | undefined): void => {
    if (!s) {
      console.log('  (未找到)\n');
      return;
    }
    console.log(`  🎵 ${s.title} - ${s.artist}  [appearCount=${s.appearCount}, platforms=[${s.platforms.join(',')}]`);
    console.log(`     rawTags(${s.rawTags.length}):        [${s.rawTags.join(', ')}]`);
    console.log(`     primaryGenres(${s.primaryGenres.length}):  [${s.primaryGenres.join(', ')}]`);
    console.log(`     subGenres(${s.subGenres.length}):         [${s.subGenres.join(', ')}]`);
    console.log(`     emotionTags(${s.emotionTags.length}):       [${s.emotionTags.join(', ')}]`);
    console.log(`     sceneTags:         [${s.sceneTags.join(', ')}]`);
    console.log(`     eraTags:           [${s.eraTags.join(', ')}]`);
    console.log(`     languageTags:      [${s.languageTags.join(', ')}]`);
    console.log(`     sourceTags:        [${s.sourceTags.join(', ')}]`);
    console.log(`     instrumentTags:    [${s.instrumentTags.join(', ')}]`);
    console.log(`     unmappedTags:      [${s.unmappedTags.join(', ')}]`);
    console.log('');
  };

  console.log('[1] 《偏爱》张芸京 —— 期望 pop/rock 主类，无 emorap/rap:');
  printSong(findSong('偏爱', '张芸京'));

  console.log('[2] 《起风了》买辣椒也用券 —— 期望 pop 主类:');
  printSong(findSong('起风了', '买辣椒也用券'));

  console.log('[3] 《红》罗言 —— 期望 rap/emorap 主类（确为说唱）:');
  printSong(findSong('红', '罗言'));

  console.log('[4] 《罗生门》梨冻紧 —— 期望 rap 主类:');
  printSong(findSong('罗生门', '梨冻紧'));

  console.log('[5] appearCount 最高的歌:');
  const topAppear = unifiedSongs.slice().sort((a, b) => b.appearCount - a.appearCount)[0];
  printSong(topAppear);
}

main();
