/**
 * 音乐风格标签归一化体系
 *
 * 补完关键缺失:定义 pop/folk/electronic/rap/guofeng/rock/rnb/lofi 的边界
 * 用于 genre_match(Jaccard 相似度的标签集)和风格偏好权重
 *
 * 归一化原则:
 * - 一个歌曲可有多个风格标签(如「国风+电子」)
 * - 子流派归一到主类(如「华语流行」「 indie pop」→ pop)
 * - 「other」表示无法归一,匹配时给低分
 *
 * @module algorithm/config/genreTags
 */

import type { GenreTag } from '../types.js';

/**
 * 风格关键词 → 归一化主类(用于从原始标签归一)
 *
 * 注意:顺序很重要!更具体的标签放在前面,避免被通用标签捕获。
 * 例如 'indie pop' 应匹配 indie 而非 pop,'pop punk' 应匹配 punk 而非 pop。
 */
export const GENRE_KEYWORD_MAPPING: ReadonlyArray<{
  keywords: string[];
  genre: GenreTag;
}> = [
  // 卧室流行(在 indie 之前,因 indie 关键词含 'bedroom pop';在 pop 之前,因 'bedroompop' 含 'pop')
  {
    keywords: ['bedroom pop', 'bedroompop', '卧室流行'],
    genre: 'bedroompop',
  },
  // 独立(先匹配,避免被 pop/rock/folk 抢)
  {
    keywords: ['indie', '独立', 'independent', 'bedroom pop', 'indie pop', 'indie rock', 'indie folk', 'indie electronic', 'indie r&b'],
    genre: 'indie',
  },
  // 爵士
  {
    keywords: ['jazz', '爵士', 'swing', 'big band', 'bebop', 'smooth jazz', 'cool jazz', 'fusion', 'blue note'],
    genre: 'jazz',
  },
  // 古典
  {
    keywords: ['classical', '古典', 'symphony', '交响', 'orchestral', '管弦', 'sonata', '协奏曲', 'piano solo', '钢琴曲', 'concerto'],
    genre: 'classical',
  },
  // 灵魂乐(在 rnb 之前,因 soul 常与 rnb 重叠,但 soul 更具体)
  {
    keywords: ['soul', '灵魂', 'neo soul', 'motown', 'philly soul', 'northern soul'],
    genre: 'soul',
  },
  // 放克(在 disco 之前,因 funk 是 disco 的根源)
  {
    keywords: ['funk', '放克', 'funk rock', 'funk pop', 'parliament funk', 'p-funk'],
    genre: 'funk',
  },
  // 迪斯科
  {
    keywords: ['disco', '迪斯科', 'nu disco', 'italo disco', 'euro disco'],
    genre: 'disco',
  },
  // R&B(在 blues 之前,因 '节奏布鲁斯' 应匹配 rnb 而非 blues)
  {
    keywords: ['rnb', 'r&b', 'rhythm', 'soul', 'neo soul', 'alternative r&b', '节奏布鲁斯', 'neo r&b'],
    genre: 'rnb',
  },
  // 布鲁斯(在 rock 之前,因 rock 源自 blues)
  {
    keywords: ['blues', '布鲁斯', 'delta blues', 'chicago blues', 'rhythm and blues', 'blues rock'],
    genre: 'blues',
  },
  // 金属(在 rock 之前)
  {
    keywords: ['metal', '金属', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'symphonic metal', 'nu metal', 'power metal'],
    genre: 'metal',
  },
  // 朋克(在 rock 之前)
  {
    keywords: ['punk', '朋克', 'hardcore', 'ska punk', 'new wave punk'],
    genre: 'punk',
  },
  // —— 第 6 轮新增:摇滚子流派复兴(在 punk 之后,避免子串冲突) ——
  // Post Punk(冷峻 bassline,Interpol/Fontaines D.C.)
  { keywords: ['post-punk', 'post punk', 'postpunk'], genre: 'postpunk' },
  // Pop Punk(MCR/AVC 复兴,Z 世代怀旧)
  { keywords: ['pop-punk', 'pop punk', 'poppunk'], genre: 'poppunk' },
  // Emo(Midwest Emo twinkly 吉他,2024-2025 复兴)
  { keywords: ['midwest emo', 'emo rock', 'emo punk', 'emo'], genre: 'emo' },
  // 乡村
  {
    keywords: ['country', '乡村', 'bluegrass', '兰草', 'country folk', 'country pop', 'honky tonk'],
    genre: 'country',
  },
  // 雷鬼(reggaeton 已独立为标签,不再归到 reggae)
  {
    keywords: ['reggae', '雷鬼', 'ska', 'dub', 'dancehall'],
    genre: 'reggae',
  },
  // 氛围
  {
    keywords: ['ambient', '氛围', 'drone', 'new age', '环境音乐', 'dark ambient', 'space music'],
    genre: 'ambient',
  },
  // 梦核(在 ambient 之后,ambient 子流派)
  {
    keywords: ['dreamcore', '梦核'],
    genre: 'dreamcore',
  },
  // K-pop(在 pop 之前)
  {
    keywords: ['kpop', 'k-pop', '韩流', '韩国流行', 'korean pop'],
    genre: 'kpop',
  },
  // J-pop(在 pop 之前;anime 已独立为标签,不再归到 jpop)
  {
    keywords: ['jpop', 'j-pop', '日流', '日本流行', 'japanese pop', '动漫流行', 'anime pop'],
    genre: 'jpop',
  },
  // 自赏(在 pop 之前,无子串冲突,放在 dreampop 前)
  {
    keywords: ['shoegaze', 'shoe gaze'],
    genre: 'shoegaze',
  },
  // 梦幻流行(在 pop 之前,因 'dreampop' 含 'pop';在 shoegaze 之后)
  {
    keywords: ['dream pop', 'dreampop'],
    genre: 'dreampop',
  },
  // 超流行(在 pop 之前,因 'hyperpop' 含 'pop')
  {
    keywords: ['hyperpop', '超流行'],
    genre: 'hyperpop',
  },
  // City Pop(在 pop 之前,因 'citypop' 含 'pop')
  {
    keywords: ['city pop', 'citypop'],
    genre: 'citypop',
  },
  // 流行
  {
    keywords: ['pop', '流行', '华语流行', 'chamber pop', '流行舞曲', 'dance pop', 'teen pop', 'electropop'],
    genre: 'pop',
  },
  // 原声(在 folk 之前,因 acoustic 常与 folk 重叠)
  {
    keywords: ['acoustic', '原声', '不插电', 'unplugged', 'solo acoustic', '纯人声'],
    genre: 'acoustic',
  },
  // 合唱(在 acoustic 之后,人声团体/赞美诗/阿卡贝拉)
  {
    keywords: ['choir', '合唱', '阿卡贝拉', '赞美诗', 'gospel'],
    genre: 'choir',
  },
  // 民谣
  {
    keywords: ['folk', '民谣', '城市民谣', '校园民谣', '独立民谣', 'acoustic', 'singer-songwriter', '唱作人'],
    genre: 'folk',
  },
  // 浩室(在 electronic 之前,因 electronic 关键词含 'house',需先匹配 house)
  {
    keywords: ['house', '浩室', 'deep house', 'tech house'],
    genre: 'house',
  },
  // 电子舞曲(在 electronic 之前,因 electronic 关键词含 'edm',需先匹配 edm)
  {
    keywords: ['edm', '电子舞曲', 'festival', 'big room'],
    genre: 'edm',
  },
  // Drift Phonk(在 phonk 之前,因 'drift phonk' 含 'phonk';在 electronic 之前)
  { keywords: ['drift phonk', 'driftphonk'], genre: 'driftphonk' },
  // Phonk(在 electronic 之前)
  { keywords: ['phonk', '漂移电音'], genre: 'phonk' },
  // Future Bass(在 electronic 之前,因 electronic 关键词含 'future bass')
  { keywords: ['future bass', 'futurebass'], genre: 'futurebass' },
  // Synthwave(在 electronic 之前,因 electronic 关键词含 'synth','synthwave' 含 'synth')
  { keywords: ['synthwave', 'synth wave'], genre: 'synthwave' },
  // Vaporwave(在 electronic 之前)
  { keywords: ['vaporwave', 'vapor wave', '蒸汽波'], genre: 'vaporwave' },
  // 电子(techno/trance/drum and bass 已独立为标签,不再归到 electronic)
  {
    keywords: ['electronic', '电子', 'edm', 'house', 'dubstep', 'future bass', 'synth', '电子乐'],
    genre: 'electronic',
  },
  // 陷阱(在 rap 之前,因 rap 关键词含 'trap',需先匹配 trap)
  {
    keywords: ['trap', '陷阱', '陷阱音乐', '808'],
    genre: 'trap',
  },
  // Drill(在 rap 之前,因 rap 关键词含 'drill')
  { keywords: ['drill', 'drill music'], genre: 'drill' },
  // 说唱
  {
    keywords: ['rap', 'hiphop', 'hip-hop', 'hip hop', '说唱', 'trap', 'mumble rap', '中国说唱', 'drill', 'boom bap'],
    genre: 'rap',
  },
  // 古风(在 guofeng 之前,因 guofeng 关键词含 '古风';独立于 guofeng)
  { keywords: ['古风', 'gu feng', 'gufeng'], genre: 'gufeng' },
  // 戏腔(在 guofeng 之前,因 guofeng 关键词含 '戏腔')
  { keywords: ['戏腔', 'xi qiang', 'xiqiang'], genre: 'xiqiang' },
  // 国风摇滚(在 guofeng 之前,因 guofeng 关键词含 '国风';在 rock 之前无冲突)
  { keywords: ['guofeng rock', '国风摇滚'], genre: 'guofengrock' },
  // 国风
  {
    keywords: ['guofeng', '国风', '古风', '中国风', '戏腔', 'chinese traditional', '民乐', '五声音阶', '古筝', '琵琶'],
    genre: 'guofeng',
  },
  // 摇滚(已移除 punk/metal,它们有独立标签)
  {
    keywords: ['rock', '摇滚', 'alternative rock', 'britpop', 'garage rock', 'psychedelic rock', 'post rock', 'stadium rock'],
    genre: 'rock',
  },
  // 影视配乐
  {
    keywords: ['soundtrack', 'ost', '影视配乐', '电影原声', '配乐', 'score', 'incidental music'],
    genre: 'soundtrack',
  },
  // 世界音乐
  {
    keywords: ['world', '世界音乐', '世界民族', 'african', 'latin', 'brazilian', ' indian', 'celtic', 'flamenco', 'bossa nova', 'samba', 'tango'],
    genre: 'world',
  },
  // Lo-fi
  {
    keywords: ['lofi', 'lo-fi', 'chillhop', 'lofi hip hop', 'lofi beats', 'study music', 'relax beats', 'chill beats'],
    genre: 'lofi',
  },
  // —— 第 6 轮新增:2025 全球趋势子流派(在兜底之前) ——
  // Amapiano(南非 log drum 深层浩室,2023-2025 全球扩散)
  { keywords: ['amapiano', 'log drum', 'south african house'], genre: 'amapiano' },
  // Afrobeats(西非流行,TikTok 舞曲常客)
  { keywords: ['afrobeats', 'afrobeat', 'afro pop', 'afro-pop', 'afroswing'], genre: 'afrobeats' },
  // Drum & Bass(170 BPM breakbeat,UK 锐舞经典)
  { keywords: ['drum and bass', 'drum & bass', 'liquid dnb', 'jungle', 'dnb', 'd&b'], genre: 'drumandbass' },
  // UK Garage(2-step shuffle,90s 复兴潮)
  { keywords: ['uk garage', 'speed garage', '2-step', '2 step', 'ukg'], genre: 'ukgarage' },
  // Techno(4/4 工业底特律电子,地下俱乐部)
  { keywords: ['detroit techno', 'industrial techno', 'minimal techno', 'techno'], genre: 'techno' },
  // Reggaeton(dembow 节奏,拉丁美洲全球扩散)
  { keywords: ['reggaeton', 'regueton', 'reggaetón'], genre: 'reggaeton' },
  // Dembow(多米尼加节奏,reggaeton 前身)
  { keywords: ['dembow'], genre: 'dembow' },
  // Trance(130-150 BPM 旋律升华,anthemic 合成器)
  { keywords: ['psytrance', 'goa trance', 'uplifting trance', 'trance'], genre: 'trance' },
  // Hardwave(电影感未来主义电子,赛博朋克美学)
  { keywords: ['hardwave', 'hard wave'], genre: 'hardwave' },
  // Anime(动漫原声/OP/ED,二次元群体核心)
  { keywords: ['anime op', 'anime ed', 'anime ost', 'anime opening', 'anime ending', 'anime'], genre: 'anime' },
  // Vocaloid(虚拟人声初音未来/洛天依,亚文化)
  { keywords: ['vocaloid', 'hatsune', '初音', '洛天依'], genre: 'vocaloid' },
  // Bachata(多米尼加浪漫吉他,Aventura/Romeo Santos)
  { keywords: ['bachata'], genre: 'bachata' },
] as const;

/**
 * 风格标签之间的关系度(用于 sim_genre 软匹配)
 * 30×30 对称矩阵,值域 [0,1]
 *
 * 设计依据:
 * - 同源流派高亲和(如 blues→jazz=0.7,metal→rock=0.8)
 * - 跨界融合中亲和(如 pop→country=0.4,rnb→blues=0.6)
 * - 完全不相关低亲和(如 guofeng→metal=0.2)
 * - 第 4 轮新增:trap/house/edm/choir,子流派独立后保持与父流派高亲和
 */
export const GENRE_AFFINITY: Readonly<Record<GenreTag, Readonly<Partial<Record<GenreTag, number>>>>> = {
  pop:          { pop: 1.0, folk: 0.4, electronic: 0.4, rap: 0.3, guofeng: 0.2, rock: 0.3, rnb: 0.6, lofi: 0.3, jazz: 0.3, classical: 0.2, country: 0.4, blues: 0.3, reggae: 0.4, metal: 0.1, punk: 0.3, indie: 0.5, ambient: 0.2, soul: 0.5, funk: 0.5, disco: 0.6, kpop: 0.8, jpop: 0.7, acoustic: 0.5, soundtrack: 0.3, world: 0.3, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.7, bedroompop: 0.8, citypop: 0.7, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.6, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.80, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.50, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.50, bachata: 0.45, emo: 0.20, poppunk: 0.60, postpunk: 0.20 },
  folk:         { pop: 0.4, folk: 1.0, electronic: 0.1, rap: 0.1, guofeng: 0.4, rock: 0.3, rnb: 0.3, lofi: 0.4, jazz: 0.2, classical: 0.3, country: 0.7, blues: 0.4, reggae: 0.3, metal: 0.2, punk: 0.2, indie: 0.5, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.8, soundtrack: 0.3, world: 0.5, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.5, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.5, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  electronic:   { pop: 0.4, folk: 0.1, electronic: 1.0, rap: 0.5, guofeng: 0.2, rock: 0.3, rnb: 0.3, lofi: 0.4, jazz: 0.2, classical: 0.2, country: 0.1, blues: 0.1, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.3, ambient: 0.4, soul: 0.2, funk: 0.3, disco: 0.5, kpop: 0.5, jpop: 0.4, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.8, edm: 0.85, choir: 0.2, other: 0.2, phonk: 0.7, driftphonk: 0.7, hyperpop: 0.6, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.5, drill: 0.2, futurebass: 0.8, synthwave: 0.8, vaporwave: 0.6, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.60, afrobeats: 0.20, drumandbass: 0.85, ukgarage: 0.70, techno: 0.85, reggaeton: 0.20, dembow: 0.20, trance: 0.80, hardwave: 0.70, anime: 0.20, vocaloid: 0.55, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  rap:          { pop: 0.3, folk: 0.1, electronic: 0.5, rap: 1.0, guofeng: 0.3, rock: 0.3, rnb: 0.5, lofi: 0.3, jazz: 0.1, classical: 0.1, country: 0.1, blues: 0.2, reggae: 0.3, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.1, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.4, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.85, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.6, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.7, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  guofeng:      { pop: 0.2, folk: 0.4, electronic: 0.2, rap: 0.3, guofeng: 1.0, rock: 0.3, rnb: 0.1, lofi: 0.2, jazz: 0.1, classical: 0.4, country: 0.1, blues: 0.1, reggae: 0.1, metal: 0.2, punk: 0.1, indie: 0.2, ambient: 0.3, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.1, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.9, xiqiang: 0.8, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  rock:         { pop: 0.3, folk: 0.3, electronic: 0.3, rap: 0.3, guofeng: 0.3, rock: 1.0, rnb: 0.2, lofi: 0.1, jazz: 0.2, classical: 0.2, country: 0.4, blues: 0.5, reggae: 0.2, metal: 0.8, punk: 0.8, indie: 0.4, ambient: 0.1, soul: 0.2, funk: 0.4, disco: 0.2, kpop: 0.2, jpop: 0.4, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.8, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.7, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.40, vocaloid: 0.20, bachata: 0.20, emo: 0.70, poppunk: 0.70, postpunk: 0.80 },
  rnb:          { pop: 0.6, folk: 0.3, electronic: 0.3, rap: 0.5, guofeng: 0.1, rock: 0.2, rnb: 1.0, lofi: 0.3, jazz: 0.5, classical: 0.1, country: 0.2, blues: 0.6, reggae: 0.3, metal: 0.1, punk: 0.1, indie: 0.3, ambient: 0.1, soul: 0.8, funk: 0.6, disco: 0.4, kpop: 0.4, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.5, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.55, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.80, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  lofi:         { pop: 0.3, folk: 0.4, electronic: 0.4, rap: 0.3, guofeng: 0.2, rock: 0.1, rnb: 0.3, lofi: 1.0, jazz: 0.4, classical: 0.3, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.1, punk: 0.1, indie: 0.4, ambient: 0.5, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.8, citypop: 0.2, dreamcore: 0.7, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  jazz:         { pop: 0.3, folk: 0.2, electronic: 0.2, rap: 0.1, guofeng: 0.1, rock: 0.2, rnb: 0.5, lofi: 0.4, jazz: 1.0, classical: 0.5, country: 0.2, blues: 0.7, reggae: 0.2, metal: 0.1, punk: 0.1, indie: 0.3, ambient: 0.3, soul: 0.4, funk: 0.4, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.3, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.35, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  classical:    { pop: 0.2, folk: 0.3, electronic: 0.2, rap: 0.1, guofeng: 0.4, rock: 0.2, rnb: 0.1, lofi: 0.3, jazz: 0.5, classical: 1.0, country: 0.1, blues: 0.2, reggae: 0.1, metal: 0.2, punk: 0.1, indie: 0.2, ambient: 0.6, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.7, world: 0.3, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.7, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.5, xiqiang: 0.6, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.35, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  country:      { pop: 0.4, folk: 0.7, electronic: 0.1, rap: 0.1, guofeng: 0.1, rock: 0.4, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.1, country: 1.0, blues: 0.5, reggae: 0.2, metal: 0.1, punk: 0.2, indie: 0.3, ambient: 0.1, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.5, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  blues:        { pop: 0.3, folk: 0.4, electronic: 0.1, rap: 0.2, guofeng: 0.1, rock: 0.5, rnb: 0.6, lofi: 0.2, jazz: 0.7, classical: 0.2, country: 0.5, blues: 1.0, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.3, ambient: 0.2, soul: 0.6, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.4, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  reggae:       { pop: 0.4, folk: 0.3, electronic: 0.2, rap: 0.3, guofeng: 0.1, rock: 0.2, rnb: 0.3, lofi: 0.2, jazz: 0.2, classical: 0.1, country: 0.2, blues: 0.2, reggae: 1.0, metal: 0.1, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.4, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.45, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.80, dembow: 0.70, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  metal:        { pop: 0.1, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.8, rnb: 0.1, lofi: 0.1, jazz: 0.1, classical: 0.2, country: 0.1, blues: 0.2, reggae: 0.1, metal: 1.0, punk: 0.6, indie: 0.1, ambient: 0.1, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.5, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.5, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  punk:         { pop: 0.3, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.1, rock: 0.8, rnb: 0.1, lofi: 0.1, jazz: 0.1, classical: 0.1, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.6, punk: 1.0, indie: 0.4, ambient: 0.1, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.85, postpunk: 0.60 },
  indie:        { pop: 0.5, folk: 0.5, electronic: 0.3, rap: 0.2, guofeng: 0.2, rock: 0.4, rnb: 0.3, lofi: 0.4, jazz: 0.3, classical: 0.2, country: 0.3, blues: 0.3, reggae: 0.2, metal: 0.1, punk: 0.4, indie: 1.0, ambient: 0.3, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.5, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.7, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.7, dreampop: 0.7, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.80, poppunk: 0.20, postpunk: 0.70 },
  ambient:      { pop: 0.2, folk: 0.2, electronic: 0.4, rap: 0.1, guofeng: 0.3, rock: 0.1, rnb: 0.1, lofi: 0.5, jazz: 0.3, classical: 0.6, country: 0.1, blues: 0.2, reggae: 0.2, metal: 0.1, punk: 0.1, indie: 0.3, ambient: 1.0, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.6, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.8, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.6, shoegaze: 0.5, dreampop: 0.5, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  soul:         { pop: 0.5, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.8, lofi: 0.2, jazz: 0.4, classical: 0.2, country: 0.2, blues: 0.6, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 1.0, funk: 0.7, disco: 0.6, kpop: 0.2, jpop: 0.2, acoustic: 0.5, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.45, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.60, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  funk:         { pop: 0.5, folk: 0.2, electronic: 0.3, rap: 0.2, guofeng: 0.2, rock: 0.4, rnb: 0.6, lofi: 0.2, jazz: 0.4, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.7, funk: 1.0, disco: 0.8, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.6, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  disco:        { pop: 0.6, folk: 0.2, electronic: 0.5, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.4, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.6, funk: 0.8, disco: 1.0, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.7, edm: 0.6, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.5, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  kpop:         { pop: 0.8, folk: 0.2, electronic: 0.5, rap: 0.4, guofeng: 0.2, rock: 0.2, rnb: 0.4, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 1.0, jpop: 0.5, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  jpop:         { pop: 0.7, folk: 0.2, electronic: 0.4, rap: 0.2, guofeng: 0.2, rock: 0.4, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.5, jpop: 1.0, acoustic: 0.2, soundtrack: 0.5, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.7, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.70, vocaloid: 0.80, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  acoustic:     { pop: 0.5, folk: 0.8, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.3, classical: 0.2, country: 0.5, blues: 0.4, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.5, ambient: 0.2, soul: 0.5, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 1.0, soundtrack: 0.2, world: 0.4, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.6, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.6, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  soundtrack:   { pop: 0.3, folk: 0.3, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.7, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.6, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.5, acoustic: 0.2, soundtrack: 1.0, world: 0.4, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.6, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.4, xiqiang: 0.5, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.85, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  world:        { pop: 0.3, folk: 0.5, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.3, country: 0.2, blues: 0.2, reggae: 0.4, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.4, soundtrack: 0.4, world: 1.0, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.65, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.55, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.55, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  trap:         { pop: 0.2, folk: 0.2, electronic: 0.2, rap: 0.85, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 1.0, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.8, driftphonk: 0.8, hyperpop: 0.5, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.8, futurebass: 0.5, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  house:        { pop: 0.2, folk: 0.2, electronic: 0.8, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.6, disco: 0.7, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 1.0, edm: 0.8, choir: 0.2, other: 0.2, phonk: 0.6, driftphonk: 0.7, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.7, synthwave: 0.5, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.85, afrobeats: 0.20, drumandbass: 0.45, ukgarage: 0.85, techno: 0.70, reggaeton: 0.20, dembow: 0.20, trance: 0.60, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  edm:          { pop: 0.2, folk: 0.2, electronic: 0.85, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.6, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.8, edm: 1.0, choir: 0.2, other: 0.2, phonk: 0.7, driftphonk: 0.8, hyperpop: 0.7, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.9, synthwave: 0.6, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.60, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.80, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  choir:        { pop: 0.2, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.7, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.6, soundtrack: 0.6, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 1.0, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.5, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  other:        { pop: 0.2, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.1, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 1.0, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  // —— 第 6 轮新增 15 风格行(2025 全球趋势子流派) ——
  amapiano:    { pop: 0.20, folk: 0.20, electronic: 0.60, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.35, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.45, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.85, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 1.00, afrobeats: 0.60, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  afrobeats:   { pop: 0.80, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.55, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.45, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.65, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.60, afrobeats: 1.00, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.50, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  drumandbass: { pop: 0.20, folk: 0.20, electronic: 0.85, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.45, edm: 0.60, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 1.00, ukgarage: 0.60, techno: 0.55, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  ukgarage:    { pop: 0.20, folk: 0.20, electronic: 0.70, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.85, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.60, ukgarage: 1.00, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  techno:      { pop: 0.20, folk: 0.20, electronic: 0.85, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.70, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.55, ukgarage: 0.20, techno: 1.00, reggaeton: 0.20, dembow: 0.20, trance: 0.60, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  reggaeton:   { pop: 0.50, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.80, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.55, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.50, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 1.00, dembow: 0.85, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  dembow:      { pop: 0.20, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.70, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.85, dembow: 1.00, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  trance:      { pop: 0.20, folk: 0.20, electronic: 0.80, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.60, edm: 0.80, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.60, reggaeton: 0.20, dembow: 0.20, trance: 1.00, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  hardwave:    { pop: 0.20, folk: 0.20, electronic: 0.70, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.70, driftphonk: 0.80, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.75, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 1.00, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  anime:       { pop: 0.20, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.40, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.35, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.70, acoustic: 0.20, soundtrack: 0.85, world: 0.20, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 1.00, vocaloid: 0.65, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  vocaloid:    { pop: 0.50, folk: 0.20, electronic: 0.55, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.80, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.65, vocaloid: 1.00, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  bachata:     { pop: 0.45, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.20, rnb: 0.80, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.20, ambient: 0.20, soul: 0.60, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.55, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 1.00, emo: 0.20, poppunk: 0.20, postpunk: 0.20, },
  emo:         { pop: 0.20, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.70, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.20, indie: 0.80, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.55, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 1.00, poppunk: 0.85, postpunk: 0.60, },
  poppunk:     { pop: 0.60, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.70, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.85, indie: 0.20, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.85, poppunk: 1.00, postpunk: 0.20, },
  postpunk:    { pop: 0.20, folk: 0.20, electronic: 0.20, rap: 0.20, guofeng: 0.20, rock: 0.80, rnb: 0.20, lofi: 0.20, jazz: 0.20, classical: 0.20, country: 0.20, blues: 0.20, reggae: 0.20, metal: 0.20, punk: 0.60, indie: 0.70, ambient: 0.20, soul: 0.20, funk: 0.20, disco: 0.20, kpop: 0.20, jpop: 0.20, acoustic: 0.20, soundtrack: 0.20, world: 0.20, trap: 0.20, house: 0.20, edm: 0.20, choir: 0.20, phonk: 0.20, driftphonk: 0.20, hyperpop: 0.20, bedroompop: 0.20, citypop: 0.20, dreamcore: 0.20, drill: 0.20, futurebass: 0.20, synthwave: 0.20, vaporwave: 0.20, shoegaze: 0.20, dreampop: 0.20, gufeng: 0.20, xiqiang: 0.20, guofengrock: 0.20, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.60, poppunk: 0.20, postpunk: 1.00, },

  phonk:        { pop: 0.2, folk: 0.2, electronic: 0.7, rap: 0.6, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.5, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.8, house: 0.6, edm: 0.7, choir: 0.2, other: 0.2, phonk: 1.0, driftphonk: 0.9, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.5, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.70, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  driftphonk:   { pop: 0.2, folk: 0.2, electronic: 0.7, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.8, house: 0.7, edm: 0.8, choir: 0.2, other: 0.2, phonk: 0.9, driftphonk: 1.0, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.80, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  hyperpop:     { pop: 0.7, folk: 0.2, electronic: 0.6, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.5, house: 0.2, edm: 0.7, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 1.0, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  bedroompop:   { pop: 0.8, folk: 0.5, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.8, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.7, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.6, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 1.0, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.7, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  citypop:      { pop: 0.7, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.5, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.5, kpop: 0.2, jpop: 0.7, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 1.0, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.7, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  dreamcore:    { pop: 0.2, folk: 0.2, electronic: 0.5, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.7, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.8, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 1.0, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.7, shoegaze: 0.2, dreampop: 0.7, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  drill:        { pop: 0.2, folk: 0.2, electronic: 0.2, rap: 0.7, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.8, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.5, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 1.0, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  futurebass:   { pop: 0.2, folk: 0.2, electronic: 0.8, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.5, house: 0.7, edm: 0.9, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 1.0, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  synthwave:    { pop: 0.2, folk: 0.2, electronic: 0.8, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.5, edm: 0.6, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.7, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 1.0, vaporwave: 0.7, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.75, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  vaporwave:    { pop: 0.2, folk: 0.2, electronic: 0.6, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.6, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.7, drill: 0.2, futurebass: 0.2, synthwave: 0.7, vaporwave: 1.0, shoegaze: 0.2, dreampop: 0.5, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  shoegaze:     { pop: 0.2, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.8, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.7, ambient: 0.5, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 1.0, dreampop: 0.8, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.55, poppunk: 0.20, postpunk: 0.20 },
  dreampop:     { pop: 0.6, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.7, ambient: 0.5, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.7, citypop: 0.2, dreamcore: 0.7, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.5, shoegaze: 0.8, dreampop: 1.0, gufeng: 0.2, xiqiang: 0.2, guofengrock: 0.2, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  gufeng:       { pop: 0.2, folk: 0.5, electronic: 0.2, rap: 0.2, guofeng: 0.9, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.5, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.4, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 1.0, xiqiang: 0.8, guofengrock: 0.7, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  xiqiang:      { pop: 0.2, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.8, rock: 0.2, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.6, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.2, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.5, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.5, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.8, xiqiang: 1.0, guofengrock: 0.7, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
  guofengrock:  { pop: 0.2, folk: 0.2, electronic: 0.2, rap: 0.2, guofeng: 0.2, rock: 0.7, rnb: 0.2, lofi: 0.2, jazz: 0.2, classical: 0.2, country: 0.2, blues: 0.2, reggae: 0.2, metal: 0.5, punk: 0.2, indie: 0.2, ambient: 0.2, soul: 0.2, funk: 0.2, disco: 0.2, kpop: 0.2, jpop: 0.2, acoustic: 0.2, soundtrack: 0.2, world: 0.2, trap: 0.2, house: 0.2, edm: 0.2, choir: 0.2, other: 0.2, phonk: 0.2, driftphonk: 0.2, hyperpop: 0.2, bedroompop: 0.2, citypop: 0.2, dreamcore: 0.2, drill: 0.2, futurebass: 0.2, synthwave: 0.2, vaporwave: 0.2, shoegaze: 0.2, dreampop: 0.2, gufeng: 0.7, xiqiang: 0.7, guofengrock: 1.0, amapiano: 0.20, afrobeats: 0.20, drumandbass: 0.20, ukgarage: 0.20, techno: 0.20, reggaeton: 0.20, dembow: 0.20, trance: 0.20, hardwave: 0.20, anime: 0.20, vocaloid: 0.20, bachata: 0.20, emo: 0.20, poppunk: 0.20, postpunk: 0.20 },
} as const;

/**
 * 将原始风格标签字符串归一化到 GenreTag
 * 支持中英文、子流派
 */
export function normalizeGenre(raw: string): GenreTag {
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

/** 批量归一化 */
export function normalizeGenres(raws: readonly string[]): GenreTag[] {
  const set = new Set<GenreTag>();
  for (const r of raws) {
    set.add(normalizeGenre(r));
  }
  return Array.from(set);
}

/**
 * 计算两个风格标签集合的相似度(软 Jaccard,考虑关系度)
 *
 * sim_genre = Σ_{a∈A, b∈B} affinity(a,b) / (|A| × |B|)
 * 取均值而非最大,避免大集合虚高
 */
export function calcGenreSimilarity(
  setA: readonly GenreTag[],
  setB: readonly GenreTag[],
): number {
  if (setA.length === 0 || setB.length === 0) return 0.5; // 中性
  let sum = 0;
  let count = 0;
  for (const a of setA) {
    for (const b of setB) {
      if (a === b) {
        sum += 1;
      } else {
        sum += GENRE_AFFINITY[a]?.[b] ?? 0.2;
      }
      count++;
    }
  }
  return count > 0 ? sum / count : 0.5;
}

/**
 * 计算风格命中度(用于 score_pref 的 genre_match)
 * @param userGenres 用户偏好的风格
 * @param songGenres 歌曲的风格
 * @returns 1.0 命中 / 0.4 相关 / 0.1 不命中
 */
export function calcGenreMatch(
  userGenres: readonly GenreTag[],
  songGenres: readonly GenreTag[],
): number {
  if (userGenres.length === 0) return 0.7; // 用户不限 → 中性偏鼓励

  // 直接命中
  for (const ug of userGenres) {
    if (songGenres.includes(ug)) return 1.0;
  }
  // 相关(affinity >= 0.5)
  for (const ug of userGenres) {
    for (const sg of songGenres) {
      if (GENRE_AFFINITY[ug]?.[sg] !== undefined && GENRE_AFFINITY[ug][sg]! >= 0.5) {
        return 0.4;
      }
    }
  }
  // 不命中
  return 0.1;
}
