/**
 * 全球地点 → 音乐映射表
 *
 * 三层信息(满足"地点细致完善"需求):
 * 1. 每个地点的代表歌曲(本地热门 / 主题契合)
 * 2. 歌词中提到该地点的歌曲(lyric_mentions)
 * 3. 大部分人去该地点常听的音乐风格偏好(genrePreferences)
 *
 * 覆盖范围:亚洲 / 欧洲 / 北美 / 南美 / 大洋洲 / 非洲 / 中东
 * 数据来源:抖音/网易云/Spotify 地区热歌 + 经典地标主题曲 + 旅游音乐文化
 *
 * 用途:
 * - GPS 反查命中具体城市/地标时,boost 该地点的代表歌曲与风格
 * - 歌词地点关键词索引:歌曲歌词提到用户所在地 → 额外加分
 * - 场所类型细化:咖啡馆/书店/健身房等具体风格偏好
 *
 * @module algorithm/config/locationMusicMap
 */

import type { EmotionLabel, GenreTag, SongSceneTag, VACoordinate } from '../types.js';

// ============================================================================
// 数据结构
// ============================================================================

/** 代表歌曲来源类型 */
export type SignatureReason = 'lyric_mentions' | 'local_hit' | 'theme_match';

/** 地点代表歌曲 */
export interface SignatureSong {
  /** 歌曲标题 */
  title: string;
  /** 歌手 */
  artist: string;
  /** 关联原因 */
  reason: SignatureReason;
  /** 若 lyric_mentions,给出歌词片段 */
  lyricSnippet?: string;
}

/** 地点类型 */
export type LocationType =
  | 'city' // 城市
  | 'landmark' // 地标(埃菲尔铁塔/故宫/时代广场)
  | 'scenic' // 自然景区(海边/山区/国家公园)
  | 'venue' // 具体场所(咖啡馆/书店/健身房/酒吧)
  | 'region' // 区域(普罗旺斯/北海道/巴厘岛)
  | 'country'; // 国家级

/** 所在大洲 */
export type Region =
  | 'asia'
  | 'europe'
  | 'north_america'
  | 'south_america'
  | 'africa'
  | 'oceania'
  | 'middle_east';

/**
 * 全球地点音乐映射条目
 *
 * 每个条目描述"到了这个地点,人们会想听什么歌":
 * - va: 该地点的氛围 V-A 倾向(用于 GPS 融合)
 * - genrePreferences: 大众风格偏好(权重 0-1,用于 score_pref 加成)
 * - signatureSongs: 代表歌曲(用于 score_ref_sim / hot_boost)
 * - sceneTag: 对应歌曲场景标签(用于 score_scene)
 * - emotionLabels: 该地点情绪倾向(用于 score_scene_fit 先验调整)
 */
export interface LocationMusicEntry {
  /** 唯一 ID */
  locationId: string;
  /** 名称变体(中英文/别名,用于匹配) */
  names: string[];
  /** 地点类型 */
  type: LocationType;
  /** 所在大洲 */
  region: Region;
  /** 国家(可选) */
  country?: string;
  /** 氛围 V-A 倾向 */
  va: VACoordinate;
  /** 大众风格偏好(权重 0-1,未列出的风格默认 0.3)
   *  支持扩展风格:jazz/classical/latin/country/blues/cantonese_pop/samba/tango
   *  匹配时会通过 EXTENDED_GENRE_TO_BASE 映射回 9 个基础 GenreTag
   */
  genrePreferences: Record<string, number>;
  /** 代表歌曲 */
  signatureSongs: SignatureSong[];
  /** 对应歌曲场景标签 */
  sceneTag: SongSceneTag;
  /** 情绪标签倾向 */
  emotionLabels: EmotionLabel[];
  /** 说明 */
  description: string;
}

// ============================================================================
// 第 1 部分:亚洲地点
// ============================================================================

const ASIA_LOCATIONS: ReadonlyArray<LocationMusicEntry> = [
  // ─── 中国大陆 ───
  {
    locationId: 'cn_beijing',
    names: ['北京', 'Beijing', 'Peking', '帝都', '北平'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.55, a: 0.50 },
    genrePreferences: { pop: 0.9, rock: 0.6, folk: 0.5, guofeng: 0.7 },
    signatureSongs: [
      { title: '北京北京', artist: '汪峰', reason: 'lyric_mentions', lyricSnippet: '我在这里欢笑,我在这里哭泣' },
      { title: 'ONE NIGHT IN 北京', artist: '信乐团', reason: 'lyric_mentions', lyricSnippet: 'ONE NIGHT IN 北京 我留下许多情' },
      { title: '钟鼓楼', artist: '何勇', reason: 'lyric_mentions', lyricSnippet: '我的家就在二环路的里边' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Nostalgic', 'Epic'],
    description: '帝都,皇城根下,摇滚与民谣的根',
  },
  {
    locationId: 'cn_shanghai',
    names: ['上海', 'Shanghai', '魔都', '沪'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.60, a: 0.58 },
    genrePreferences: { pop: 0.9, electronic: 0.7, jazz: 0.5, rnb: 0.6 },
    signatureSongs: [
      { title: '夜上海', artist: '周璇', reason: 'lyric_mentions', lyricSnippet: '夜上海 夜上海 你是个不夜城' },
      { title: '上海滩', artist: '叶丽仪', reason: 'lyric_mentions', lyricSnippet: '浪奔 浪流 万里涛涛江水永不休' },
      { title: '喜欢的城市', artist: '李健', reason: 'theme_match' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Romantic', 'Nostalgic'],
    description: '魔都,摩登与复古交织',
  },
  {
    locationId: 'cn_chengdu',
    names: ['成都', 'Chengdu', '蓉城', '锦官城'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.60, a: 0.38 },
    genrePreferences: { folk: 0.9, pop: 0.8, rnb: 0.5 },
    signatureSongs: [
      { title: '成都', artist: '赵雷', reason: 'lyric_mentions', lyricSnippet: '和我在成都的街头走一走' },
      { title: '走在玉林路的尽头', artist: '赵雷', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Healing'],
    description: '慢节奏民谣之城',
  },
  {
    locationId: 'cn_xian',
    names: ['西安', "Xi'an", '长安', '镐京'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.50, a: 0.45 },
    genrePreferences: { guofeng: 0.9, rock: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: '长安长安', artist: '郑钧', reason: 'lyric_mentions', lyricSnippet: '长安长安 仰天大笑出门去' },
      { title: '西安人的歌', artist: '程渤智', reason: 'lyric_mentions', lyricSnippet: '西安人的城墙下是西安人的火车' },
    ],
    sceneTag: 'guofeng',
    emotionLabels: ['Epic', 'Nostalgic'],
    description: '十三朝古都,国风摇滚之城',
  },
  {
    locationId: 'cn_hangzhou',
    names: ['杭州', 'Hangzhou', '临安', '钱塘'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.62, a: 0.32 },
    genrePreferences: { pop: 0.8, folk: 0.7, guofeng: 0.6 },
    signatureSongs: [
      { title: '江南', artist: '林俊杰', reason: 'theme_match', lyricSnippet: '风到了这里就是黏' },
      { title: '断桥残雪', artist: 'Vae', reason: 'lyric_mentions', lyricSnippet: '断桥是否下过雪' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Romantic', 'Fresh'],
    description: '西湖烟雨,江南水乡',
  },
  {
    locationId: 'cn_lhasa',
    names: ['拉萨', 'Lhasa', '日光城'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.55, a: 0.25 },
    genrePreferences: { folk: 0.9, guofeng: 0.7, pop: 0.5 },
    signatureSongs: [
      { title: '回到拉萨', artist: '郑钧', reason: 'lyric_mentions', lyricSnippet: '回到拉萨 回到了布达拉' },
      { title: '青藏高原', artist: '韩红', reason: 'lyric_mentions', lyricSnippet: '呀啦索 青藏高原' },
    ],
    sceneTag: 'morning_sunrise',
    emotionLabels: ['Peaceful', 'Epic'],
    description: '雪域高原,心灵净土',
  },
  {
    locationId: 'cn_lijiang',
    names: ['丽江', 'Lijiang', '艳遇之城'],
    type: 'scenic',
    region: 'asia',
    country: '中国',
    va: { v: 0.55, a: 0.30 },
    genrePreferences: { folk: 0.9, pop: 0.7, guofeng: 0.5 },
    signatureSongs: [
      { title: '丽江的春天', artist: '颜人中', reason: 'lyric_mentions' },
      { title: '一瞬间', artist: '丽江小倩', reason: 'local_hit', lyricSnippet: '就在这一瞬间 才发现' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Romantic'],
    description: '古城民谣,艳遇与流浪',
  },
  {
    locationId: 'cn_chongqing',
    names: ['重庆', 'Chongqing', '山城', '雾都'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.58, a: 0.55 },
    genrePreferences: { rap: 0.8, pop: 0.8, electronic: 0.6 },
    signatureSongs: [
      { title: '重庆魂', artist: 'GAI', reason: 'lyric_mentions', lyricSnippet: '重庆魂 朝天门' },
      { title: '火锅底料', artist: 'GAI', reason: 'local_hit' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Epic'],
    description: '山城雾都,中国说唱重镇',
  },
  {
    locationId: 'cn_guangzhou',
    names: ['广州', 'Guangzhou', '羊城', '穗'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.60, a: 0.50 },
    genrePreferences: { pop: 0.9, cantonese_pop: 0.8, electronic: 0.6 },
    signatureSongs: [
      { title: '海阔天空', artist: 'Beyond', reason: 'theme_match' },
      { title: '广州大道北', artist: '五条人', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Epic', 'Nostalgic'],
    description: '粤语文化中心,流行音乐重镇',
  },
  {
    locationId: 'cn_yunnan',
    names: ['云南', 'Yunnan', '大理', '洱海', '昆明'],
    type: 'region',
    region: 'asia',
    country: '中国',
    va: { v: 0.60, a: 0.28 },
    genrePreferences: { folk: 0.9, pop: 0.7, guofeng: 0.5 },
    signatureSongs: [
      { title: '去大理', artist: '郝云', reason: 'lyric_mentions', lyricSnippet: '既然不快乐又不喜欢这里 不如一路向西去大理' },
      { title: '彩云之南', artist: '徐千雅', reason: 'lyric_mentions', lyricSnippet: '彩云之南 我心的方向' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Healing', 'Fresh'],
    description: '彩云之南,民谣与远方',
  },
  // ─── 港澳台 ───
  {
    locationId: 'hk_hongkong',
    names: ['香港', 'Hong Kong', 'HK', '东方之珠'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.62, a: 0.60 },
    genrePreferences: { pop: 0.9, cantonese_pop: 0.9, rock: 0.5, electronic: 0.6 },
    signatureSongs: [
      { title: '海阔天空', artist: 'Beyond', reason: 'local_hit', lyricSnippet: '原谅我这一生不羁放纵爱自由' },
      { title: '东方之珠', artist: '罗大佑', reason: 'lyric_mentions', lyricSnippet: '东方之珠 我的爱人' },
      { title: '香港地', artist: '陈冠希', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Nostalgic', 'Epic'],
    description: '东方之珠,粤语流行发源地',
  },
  {
    locationId: 'tw_taipei',
    names: ['台北', 'Taipei', '台湾', 'Taiwan', '垦丁', '九份'],
    type: 'city',
    region: 'asia',
    country: '中国',
    va: { v: 0.58, a: 0.45 },
    genrePreferences: { pop: 0.9, folk: 0.8, rock: 0.6, rnb: 0.5 },
    signatureSongs: [
      { title: '台北的冬天', artist: '陈升', reason: 'lyric_mentions' },
      { title: '九份的咖啡店', artist: '陈绮贞', reason: 'lyric_mentions', lyricSnippet: '九份的咖啡店 这里的景色像你变幻莫测' },
      { title: '倔强', artist: '五月天', reason: 'local_hit' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Nostalgic', 'Romantic'],
    description: '华语流行音乐重镇,独立音乐摇篮',
  },
  // ─── 日本 ───
  {
    locationId: 'jp_tokyo',
    names: ['东京', 'Tokyo', '渋谷', 'Shibuya', '新宿', 'Shinjuku'],
    type: 'city',
    region: 'asia',
    country: '日本',
    va: { v: 0.65, a: 0.65 },
    genrePreferences: { pop: 0.9, electronic: 0.7, rock: 0.6, lofi: 0.5 },
    signatureSongs: [
      { title: '东京不太热', artist: 'SawanoScore', reason: 'lyric_mentions' },
      { title: 'Tokyo Flash', artist: 'Vaundy', reason: 'lyric_mentions' },
      { title: 'Lemon', artist: '米津玄師', reason: 'local_hit' },
      { title: 'Pretender', artist: 'Official髭男dism', reason: 'local_hit' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Nostalgic'],
    description: '东京,J-Pop 与 City Pop 之都',
  },
  {
    locationId: 'jp_kyoto',
    names: ['京都', 'Kyoto', '古都'],
    type: 'city',
    region: 'asia',
    country: '日本',
    va: { v: 0.50, a: 0.25 },
    genrePreferences: { lofi: 0.8, folk: 0.7, pop: 0.6, guofeng: 0.5 },
    signatureSongs: [
      { title: '京都', artist: 'Sakamoto', reason: 'theme_match' },
      { title: '川のながれに', artist: '一青窈', reason: 'theme_match' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Peaceful', 'Nostalgic'],
    description: '千年古都,禅意与 Lo-fi',
  },
  {
    locationId: 'jp_osaka',
    names: ['大阪', 'Osaka'],
    type: 'city',
    region: 'asia',
    country: '日本',
    va: { v: 0.65, a: 0.62 },
    genrePreferences: { pop: 0.8, rock: 0.7, electronic: 0.6 },
    signatureSongs: [
      { title: '大阪LOVER', artist: 'DREAMS COME TRUE', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Romantic'],
    description: '关西热情之城',
  },
  {
    locationId: 'jp_hokkaido',
    names: ['北海道', 'Hokkaido', '札幌', 'Sapporo', '小樽', 'Otaru'],
    type: 'region',
    region: 'asia',
    country: '日本',
    va: { v: 0.55, a: 0.30 },
    genrePreferences: { pop: 0.8, lofi: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'First Love', artist: '宇多田光', reason: 'theme_match' },
      { title: '雪の華', artist: '中島美嘉', reason: 'theme_match', lyricSnippet: 'のびた人影を 舗道に並べ' },
    ],
    sceneTag: 'rainy_window',
    emotionLabels: ['Romantic', 'Nostalgic'],
    description: '北国雪景,纯爱物语',
  },
  {
    locationId: 'jp_okinawa',
    names: ['冲绳', 'Okinawa', '琉球'],
    type: 'region',
    region: 'asia',
    country: '日本',
    va: { v: 0.68, a: 0.45 },
    genrePreferences: { pop: 0.8, folk: 0.7, lofi: 0.5 },
    signatureSongs: [
      { title: '島唄', artist: 'THE BOOM', reason: 'lyric_mentions', lyricSnippet: 'でいごの花が咲き 風を呼び 嵐が来た' },
      { title: 'ハイサイおじさん', artist: '喜納昌吉', reason: 'local_hit' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Joyful', 'Nostalgic'],
    description: '琉球海岛,三味线与岛呗',
  },
  // ─── 韩国 ───
  {
    locationId: 'kr_seoul',
    names: ['首尔', 'Seoul', '汉城', '江南', 'Gangnam', '弘大', 'Hongdae'],
    type: 'city',
    region: 'asia',
    country: '韩国',
    va: { v: 0.70, a: 0.70 },
    genrePreferences: { pop: 0.95, electronic: 0.8, rap: 0.7, rnb: 0.6 },
    signatureSongs: [
      { title: 'Gangnam Style', artist: 'PSY', reason: 'lyric_mentions', lyricSnippet: 'Oppa Gangnam style' },
      { title: 'SEOUL', artist: 'RM', reason: 'lyric_mentions' },
      { title: 'Spring Day', artist: 'BTS', reason: 'local_hit' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Joyful'],
    description: 'K-Pop 之都,江南与弘大',
  },
  {
    locationId: 'kr_busan',
    names: ['釜山', 'Busan', '海云台', 'Haeundae'],
    type: 'city',
    region: 'asia',
    country: '韩国',
    va: { v: 0.62, a: 0.50 },
    genrePreferences: { pop: 0.8, folk: 0.6, electronic: 0.5 },
    signatureSongs: [
      { title: '海云台', artist: 'Busker Busker', reason: 'lyric_mentions' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Romantic', 'Fresh'],
    description: '韩国海滨城市',
  },
  {
    locationId: 'kr_jeju',
    names: ['济州岛', 'Jeju', 'Jeju Island'],
    type: 'scenic',
    region: 'asia',
    country: '韩国',
    va: { v: 0.65, a: 0.35 },
    genrePreferences: { pop: 0.8, folk: 0.7, lofi: 0.6 },
    signatureSongs: [
      { title: '제주도의 푸른 밤', artist: '최백호', reason: 'lyric_mentions', lyricSnippet: '제주도 푸른 밤' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Romantic', 'Peaceful'],
    description: '韩国度假胜地',
  },
  // ─── 东南亚 ───
  {
    locationId: 'th_bangkok',
    names: ['曼谷', 'Bangkok', 'กรุงเทพ'],
    type: 'city',
    region: 'asia',
    country: '泰国',
    va: { v: 0.60, a: 0.55 },
    genrePreferences: { pop: 0.85, electronic: 0.7, rap: 0.5 },
    signatureSongs: [
      { title: 'Bangkok', artist: 'Various', reason: 'theme_match' },
      { title: 'คืนนี้ขอหอม', artist: 'Three Man Down', reason: 'local_hit' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Romantic'],
    description: '泰语流行与电子乐',
  },
  {
    locationId: 'th_chiangmai',
    names: ['清迈', 'Chiang Mai', 'เชียงใหม่'],
    type: 'city',
    region: 'asia',
    country: '泰国',
    va: { v: 0.58, a: 0.30 },
    genrePreferences: { folk: 0.8, pop: 0.7, lofi: 0.6 },
    signatureSongs: [
      { title: 'Chiang Mai', artist: 'Polycat', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Relaxing', 'Healing'],
    description: '泰北玫瑰,慢生活',
  },
  {
    locationId: 'sg_singapore',
    names: ['新加坡', 'Singapore', '狮城'],
    type: 'city',
    region: 'asia',
    country: '新加坡',
    va: { v: 0.62, a: 0.55 },
    genrePreferences: { pop: 0.9, electronic: 0.7, rnb: 0.5 },
    signatureSongs: [
      { title: '新加坡', artist: '林俊杰', reason: 'theme_match' },
      { title: 'Thrift Shop', artist: 'Macklemore', reason: 'theme_match' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Fresh'],
    description: '花园城市,多元文化',
  },
  {
    locationId: 'id_bali',
    names: ['巴厘岛', 'Bali', 'Ubud', '乌布', 'Kuta', '库塔'],
    type: 'region',
    region: 'asia',
    country: '印尼',
    va: { v: 0.65, a: 0.35 },
    genrePreferences: { electronic: 0.8, lofi: 0.7, pop: 0.6, folk: 0.5 },
    signatureSongs: [
      { title: 'Bali', artist: 'Jhay Cortez', reason: 'lyric_mentions' },
      { title: 'Bali Beach', artist: 'Chillhop', reason: 'theme_match' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Relaxing', 'Dreamy'],
    description: '海岛度假,Chillout 与 House',
  },
  {
    locationId: 'vn_hanoi',
    names: ['河内', 'Hanoi', 'Hà Nội'],
    type: 'city',
    region: 'asia',
    country: '越南',
    va: { v: 0.52, a: 0.45 },
    genrePreferences: { pop: 0.8, folk: 0.7, lofi: 0.5 },
    signatureSongs: [
      { title: 'Hà Nội', artist: 'JustaTee', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Romantic'],
    description: '越南古都,法式风情',
  },
  {
    locationId: 'vn_danang',
    names: ['岘港', 'Da Nang', 'Đà Nẵng', '会安', 'Hoi An'],
    type: 'scenic',
    region: 'asia',
    country: '越南',
    va: { v: 0.62, a: 0.38 },
    genrePreferences: { pop: 0.8, folk: 0.6, lofi: 0.5 },
    signatureSongs: [
      { title: 'Đà Nẵng', artist: 'Vũ.', reason: 'lyric_mentions' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Romantic', 'Fresh'],
    description: '越南海滨度假',
  },
  {
    locationId: 'my_kl',
    names: ['吉隆坡', 'Kuala Lumpur', 'KL'],
    type: 'city',
    region: 'asia',
    country: '马来西亚',
    va: { v: 0.60, a: 0.52 },
    genrePreferences: { pop: 0.85, electronic: 0.6, rap: 0.5 },
    signatureSongs: [
      { title: 'Kuala Lumpur', artist: 'Sashi', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Joyful'],
    description: '多元文化都市',
  },
];

// ============================================================================
// 第 2 部分:欧洲地点
// ============================================================================

const EUROPE_LOCATIONS: ReadonlyArray<LocationMusicEntry> = [
  // ─── 英国 ───
  {
    locationId: 'uk_london',
    names: ['伦敦', 'London', '雾都'],
    type: 'city',
    region: 'europe',
    country: '英国',
    va: { v: 0.58, a: 0.55 },
    genrePreferences: { pop: 0.9, rock: 0.7, electronic: 0.7, rnb: 0.6 },
    signatureSongs: [
      { title: 'London Calling', artist: 'The Clash', reason: 'lyric_mentions', lyricSnippet: 'London calling to the faraway towns' },
      { title: 'A Foggy Day', artist: 'Fred Astaire', reason: 'lyric_mentions', lyricSnippet: 'A foggy day in London town' },
      { title: 'London', artist: 'Lil Dicky', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Nostalgic', 'Epic'],
    description: '英伦摇滚与电子乐之都',
  },
  {
    locationId: 'uk_liverpool',
    names: ['利物浦', 'Liverpool'],
    type: 'city',
    region: 'europe',
    country: '英国',
    va: { v: 0.62, a: 0.55 },
    genrePreferences: { rock: 0.95, pop: 0.8, folk: 0.6 },
    signatureSongs: [
      { title: 'Penny Lane', artist: 'The Beatles', reason: 'lyric_mentions', lyricSnippet: 'In Penny Lane there is a barber showing photographs' },
      { title: 'Ferry Cross the Mersey', artist: 'Gerry and the Pacemakers', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Nostalgic'],
    description: '披头士的故乡',
  },
  {
    locationId: 'uk_edinburgh',
    names: ['爱丁堡', 'Edinburgh'],
    type: 'city',
    region: 'europe',
    country: '英国',
    va: { v: 0.50, a: 0.40 },
    genrePreferences: { folk: 0.9, rock: 0.6, pop: 0.7 },
    signatureSongs: [
      { title: 'Edinburgh', artist: 'Belly', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Romantic'],
    description: '苏格兰古城,风笛与高地',
  },
  // ─── 法国 ───
  {
    locationId: 'fr_paris',
    names: ['巴黎', 'Paris', '花都'],
    type: 'city',
    region: 'europe',
    country: '法国',
    va: { v: 0.62, a: 0.45 },
    genrePreferences: { pop: 0.85, electronic: 0.7, jazz: 0.6, rnb: 0.5 },
    signatureSongs: [
      { title: 'La Vie en Rose', artist: 'Édith Piaf', reason: 'theme_match', lyricSnippet: 'Je vois la vie en rose' },
      { title: 'Paris', artist: 'The Chainsmokers', reason: 'lyric_mentions' },
      { title: 'Aux Champs-Élysées', artist: 'Joe Dassin', reason: 'lyric_mentions', lyricSnippet: 'Aux Champs-Élysées' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Romantic', 'Fresh'],
    description: '花都,香颂与电子乐',
  },
  {
    locationId: 'fr_nice',
    names: ['尼斯', 'Nice', '蔚蓝海岸', 'Côte d\'Azur', '戛纳', 'Cannes'],
    type: 'scenic',
    region: 'europe',
    country: '法国',
    va: { v: 0.68, a: 0.40 },
    genrePreferences: { electronic: 0.8, pop: 0.7, jazz: 0.5 },
    signatureSongs: [
      { title: 'Nice', artist: 'Troye Sivan', reason: 'lyric_mentions' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Joyful', 'Romantic'],
    description: '蔚蓝海岸度假',
  },
  {
    locationId: 'fr_provence',
    names: ['普罗旺斯', 'Provence', 'Avignon', '阿维尼翁'],
    type: 'region',
    region: 'europe',
    country: '法国',
    va: { v: 0.62, a: 0.30 },
    genrePreferences: { folk: 0.8, jazz: 0.6, pop: 0.6 },
    signatureSongs: [
      { title: 'A la claire fontaine', artist: 'Traditionnel', reason: 'theme_match' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Peaceful', 'Romantic'],
    description: '薰衣草之乡,田园牧歌',
  },
  // ─── 意大利 ───
  {
    locationId: 'it_rome',
    names: ['罗马', 'Rome', 'Roma', '永恒之城'],
    type: 'city',
    region: 'europe',
    country: '意大利',
    va: { v: 0.58, a: 0.48 },
    genrePreferences: { pop: 0.85, folk: 0.7, classical: 0.6 },
    signatureSongs: [
      { title: 'Arrivederci Roma', artist: 'Renato Rascel', reason: 'lyric_mentions' },
      { title: 'Roma', artist: 'Lazza', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Epic'],
    description: '永恒之城,古典与流行',
  },
  {
    locationId: 'it_venice',
    names: ['威尼斯', 'Venice', 'Venezia', '水城'],
    type: 'city',
    region: 'europe',
    country: '意大利',
    va: { v: 0.55, a: 0.30 },
    genrePreferences: { classical: 0.7, folk: 0.7, pop: 0.6 },
    signatureSongs: [
      { title: 'O sole mio', artist: 'Traditionnel', reason: 'theme_match' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Romantic', 'Dreamy'],
    description: '水城,贡多拉与小夜曲',
  },
  {
    locationId: 'it_florence',
    names: ['佛罗伦萨', 'Florence', 'Firenze', '翡冷翠'],
    type: 'city',
    region: 'europe',
    country: '意大利',
    va: { v: 0.58, a: 0.35 },
    genrePreferences: { classical: 0.7, folk: 0.7, pop: 0.6 },
    signatureSongs: [
      { title: 'Firenze', artist: 'Pino Daniele', reason: 'lyric_mentions' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Nostalgic', 'Romantic'],
    description: '文艺复兴之都',
  },
  {
    locationId: 'it_milan',
    names: ['米兰', 'Milan', 'Milano'],
    type: 'city',
    region: 'europe',
    country: '意大利',
    va: { v: 0.62, a: 0.55 },
    genrePreferences: { electronic: 0.8, pop: 0.8, classical: 0.5 },
    signatureSongs: [
      { title: 'Milano', artist: 'Fedez', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Fresh'],
    description: '时尚之都,电子乐夜店',
  },
  // ─── 西班牙 ───
  {
    locationId: 'es_barcelona',
    names: ['巴塞罗那', 'Barcelona', '巴萨'],
    type: 'city',
    region: 'europe',
    country: '西班牙',
    va: { v: 0.68, a: 0.58 },
    genrePreferences: { pop: 0.85, electronic: 0.8, latin: 0.7, rnb: 0.5 },
    signatureSongs: [
      { title: 'Barcelona', artist: 'Ed Sheeran', reason: 'lyric_mentions', lyricSnippet: 'Oh Barcelona, we were young' },
      { title: 'Barcelona', artist: 'Julio Iglesias', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Romantic'],
    description: '地中海风情,弗拉门戈与电子',
  },
  {
    locationId: 'es_madrid',
    names: ['马德里', 'Madrid'],
    type: 'city',
    region: 'europe',
    country: '西班牙',
    va: { v: 0.62, a: 0.55 },
    genrePreferences: { pop: 0.85, latin: 0.7, electronic: 0.6 },
    signatureSongs: [
      { title: 'Madrid', artist: 'El Chojin', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Joyful'],
    description: '西班牙首都,拉丁流行',
  },
  {
    locationId: 'es_sevilla',
    names: ['塞维利亚', 'Sevilla', 'Seville', '安达卢西亚', 'Andalucía'],
    type: 'city',
    region: 'europe',
    country: '西班牙',
    va: { v: 0.60, a: 0.55 },
    genrePreferences: { latin: 0.8, folk: 0.7, pop: 0.6 },
    signatureSongs: [
      { title: 'Sevilla', artist: 'Green Go', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Joyful', 'Romantic'],
    description: '弗拉门戈发源地',
  },
  // ─── 德国 ───
  {
    locationId: 'de_berlin',
    names: ['柏林', 'Berlin'],
    type: 'city',
    region: 'europe',
    country: '德国',
    va: { v: 0.55, a: 0.65 },
    genrePreferences: { electronic: 0.95, rock: 0.7, pop: 0.7 },
    signatureSongs: [
      { title: 'Berlin', artist: 'Lou Reed', reason: 'lyric_mentions' },
      { title: 'Ich bin ein Berliner', artist: 'Peter Fox', reason: 'theme_match' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Dark', 'Epic'],
    description: '电子乐之都,Techno 与工业',
  },
  {
    locationId: 'de_munich',
    names: ['慕尼黑', 'Munich', 'München'],
    type: 'city',
    region: 'europe',
    country: '德国',
    va: { v: 0.60, a: 0.50 },
    genrePreferences: { pop: 0.8, electronic: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'München', artist: 'Mark Forster', reason: 'lyric_mentions' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Joyful', 'Fresh'],
    description: '巴伐利亚风情,啤酒节',
  },
  // ─── 北欧 ───
  {
    locationId: 'is_reykjavik',
    names: ['雷克雅未克', 'Reykjavik', '冰岛', 'Iceland'],
    type: 'city',
    region: 'europe',
    country: '冰岛',
    va: { v: 0.45, a: 0.35 },
    genrePreferences: { electronic: 0.8, folk: 0.7, pop: 0.6, classical: 0.5 },
    signatureSongs: [
      { title: 'Jóga', artist: 'Björk', reason: 'theme_match' },
      { title: 'Reykjavik', artist: 'Monsters and Men', reason: 'lyric_mentions' },
    ],
    sceneTag: 'morning_sunrise',
    emotionLabels: ['Dreamy', 'Epic'],
    description: '冰岛,空灵与极光',
  },
  {
    locationId: 'se_stockholm',
    names: ['斯德哥尔摩', 'Stockholm'],
    type: 'city',
    region: 'europe',
    country: '瑞典',
    va: { v: 0.55, a: 0.48 },
    genrePreferences: { pop: 0.9, electronic: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'Stockholm', artist: 'Lennon Stella', reason: 'lyric_mentions' },
      { title: 'Waterloo', artist: 'ABBA', reason: 'local_hit' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Nostalgic', 'Fresh'],
    description: 'ABBA 故乡,北欧流行',
  },
  {
    locationId: 'no_oslo',
    names: ['奥斯陆', 'Oslo', '挪威', 'Norway'],
    type: 'city',
    region: 'europe',
    country: '挪威',
    va: { v: 0.48, a: 0.45 },
    genrePreferences: { electronic: 0.8, folk: 0.7, rock: 0.6, classical: 0.5 },
    signatureSongs: [
      { title: 'Oslo', artist: 'Frida Öhrn', reason: 'lyric_mentions' },
    ],
    sceneTag: 'rainy_window',
    emotionLabels: ['Melancholic', 'Peaceful'],
    description: '北欧黑金属与民谣',
  },
  // ─── 其他欧洲 ───
  {
    locationId: 'at_vienna',
    names: ['维也纳', 'Vienna', 'Wien'],
    type: 'city',
    region: 'europe',
    country: '奥地利',
    va: { v: 0.55, a: 0.38 },
    genrePreferences: { classical: 0.9, pop: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'Vienna', artist: 'Billy Joel', reason: 'lyric_mentions', lyricSnippet: 'Slow down you crazy child' },
      { title: 'The Blue Danube', artist: 'Strauss', reason: 'theme_match' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Romantic', 'Nostalgic'],
    description: '音乐之都,华尔兹与古典',
  },
  {
    locationId: 'cz_prague',
    names: ['布拉格', 'Prague', 'Praha'],
    type: 'city',
    region: 'europe',
    country: '捷克',
    va: { v: 0.50, a: 0.42 },
    genrePreferences: { classical: 0.8, folk: 0.7, rock: 0.6, pop: 0.6 },
    signatureSongs: [
      { title: 'Prague', artist: 'Juce', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Romantic'],
    description: '百塔之城,波西米亚',
  },
  {
    locationId: 'nl_amsterdam',
    names: ['阿姆斯特丹', 'Amsterdam'],
    type: 'city',
    region: 'europe',
    country: '荷兰',
    va: { v: 0.60, a: 0.52 },
    genrePreferences: { electronic: 0.85, pop: 0.8, rap: 0.6 },
    signatureSongs: [
      { title: 'Amsterdam', artist: 'Imagine Dragons', reason: 'lyric_mentions' },
      { title: 'Amsterdam', artist: 'Maggie Rogers', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Exciting'],
    description: '运河之城,电子乐与舞曲',
  },
  {
    locationId: 'gr_santorini',
    names: ['圣托里尼', 'Santorini', 'Santorin', '希腊', 'Greece', '雅典', 'Athens'],
    type: 'scenic',
    region: 'europe',
    country: '希腊',
    va: { v: 0.65, a: 0.35 },
    genrePreferences: { folk: 0.8, pop: 0.7, electronic: 0.6 },
    signatureSongs: [
      { title: 'Santorini', artist: 'Yanni', reason: 'lyric_mentions' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Romantic', 'Dreamy'],
    description: '爱琴海蓝顶教堂',
  },
  {
    locationId: 'tr_istanbul',
    names: ['伊斯坦布尔', 'Istanbul', '土耳其', 'Turkey', '卡帕多奇亚', 'Cappadocia'],
    type: 'city',
    region: 'middle_east',
    country: '土耳其',
    va: { v: 0.55, a: 0.52 },
    genrePreferences: { pop: 0.85, folk: 0.7, electronic: 0.6 },
    signatureSongs: [
      { title: 'Istanbul', artist: 'They Might Be Giants', reason: 'lyric_mentions', lyricSnippet: 'Istanbul was Constantinople' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Epic'],
    description: '横跨欧亚,拜占庭风情',
  },
];

// ============================================================================
// 第 3 部分:美洲地点
// ============================================================================

const AMERICA_LOCATIONS: ReadonlyArray<LocationMusicEntry> = [
  // ─── 美国 ───
  {
    locationId: 'us_newyork',
    names: ['纽约', 'New York', 'NYC', '曼哈顿', 'Manhattan', '时代广场', 'Times Square', '布鲁克林', 'Brooklyn'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.60, a: 0.68 },
    genrePreferences: { pop: 0.9, rap: 0.8, rnb: 0.7, electronic: 0.7, jazz: 0.6 },
    signatureSongs: [
      { title: 'Empire State of Mind', artist: 'Jay-Z', reason: 'lyric_mentions', lyricSnippet: 'Concrete jungle where dreams are made of' },
      { title: 'New York, New York', artist: 'Frank Sinatra', reason: 'lyric_mentions', lyricSnippet: 'I want to wake up in a city that never sleeps' },
      { title: 'Welcome to New York', artist: 'Taylor Swift', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Epic'],
    description: '不夜城,嘻哈与流行之都',
  },
  {
    locationId: 'us_losangeles',
    names: ['洛杉矶', 'Los Angeles', 'LA', '好莱坞', 'Hollywood'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.68, a: 0.60 },
    genrePreferences: { pop: 0.95, rap: 0.7, electronic: 0.7, rnb: 0.6 },
    signatureSongs: [
      { title: 'California Dreamin\'', artist: 'The Mamas & the Papas', reason: 'lyric_mentions' },
      { title: 'City of Stars', artist: 'Ryan Gosling', reason: 'theme_match', lyricSnippet: 'City of stars, are you shining just for me?' },
      { title: 'Malibu', artist: 'Miley Cyrus', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Romantic', 'Joyful'],
    description: '天使之城,好莱坞梦工厂',
  },
  {
    locationId: 'us_nashville',
    names: ['纳什维尔', 'Nashville', '乡村音乐之都'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.62, a: 0.48 },
    genrePreferences: { country: 0.95, folk: 0.8, pop: 0.7, rock: 0.5 },
    signatureSongs: [
      { title: 'Nashville', artist: 'David Mead', reason: 'lyric_mentions' },
      { title: 'Tennessee Whiskey', artist: 'Chris Stapleton', reason: 'local_hit' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Healing', 'Nostalgic'],
    description: '乡村音乐之都',
  },
  {
    locationId: 'us_neworleans',
    names: ['新奥尔良', 'New Orleans', 'NOLA', '爵士之城'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.58, a: 0.55 },
    genrePreferences: { jazz: 0.9, rnb: 0.8, pop: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'Do You Know What It Means', artist: 'Louis Armstrong', reason: 'lyric_mentions', lyricSnippet: 'to miss New Orleans' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Nostalgic', 'Romantic'],
    description: '爵士乐发源地',
  },
  {
    locationId: 'us_sanfrancisco',
    names: ['旧金山', 'San Francisco', 'SF', '硅谷', 'Silicon Valley'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.60, a: 0.50 },
    genrePreferences: { pop: 0.85, electronic: 0.7, rock: 0.6, folk: 0.6 },
    signatureSongs: [
      { title: 'San Francisco', artist: 'The Mowgli\'s', reason: 'lyric_mentions', lyricSnippet: 'I left my heart in San Francisco' },
      { title: 'Sittin\' on the Dock of the Bay', artist: 'Otis Redding', reason: 'theme_match' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Fresh', 'Nostalgic'],
    description: '海湾之城,嬉皮士文化',
  },
  {
    locationId: 'us_lasvegas',
    names: ['拉斯维加斯', 'Las Vegas', 'Vegas', '赌城'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.75, a: 0.80 },
    genrePreferences: { electronic: 0.9, pop: 0.85, rap: 0.6, rnb: 0.6 },
    signatureSongs: [
      { title: 'Viva Las Vegas', artist: 'Elvis Presley', reason: 'lyric_mentions' },
      { title: 'Waking Up in Vegas', artist: 'Katy Perry', reason: 'lyric_mentions' },
    ],
    sceneTag: 'party',
    emotionLabels: ['Exciting', 'Joyful'],
    description: '赌城,夜店与电音',
  },
  {
    locationId: 'us_seattle',
    names: ['西雅图', 'Seattle'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.45, a: 0.48 },
    genrePreferences: { rock: 0.9, pop: 0.7, folk: 0.6, electronic: 0.5 },
    signatureSongs: [
      { title: 'Seattle', artist: 'Perry Como', reason: 'lyric_mentions' },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', reason: 'local_hit' },
    ],
    sceneTag: 'rainy_window',
    emotionLabels: ['Melancholic', 'Nostalgic'],
    description: 'Grunge 摇滚与雨城',
  },
  {
    locationId: 'us_hawaii',
    names: ['夏威夷', 'Hawaii', 'Honolulu', '檀香山', '毛伊岛', 'Maui'],
    type: 'region',
    region: 'north_america',
    country: '美国',
    va: { v: 0.72, a: 0.45 },
    genrePreferences: { folk: 0.8, pop: 0.8, rnb: 0.6, lofi: 0.5 },
    signatureSongs: [
      { title: 'Somewhere Over the Rainbow', artist: 'Israel Kamakawiwoʻole', reason: 'local_hit' },
      { title: 'Hawaii', artist: 'The Beach Boys', reason: 'lyric_mentions' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Joyful', 'Relaxing'],
    description: '太平洋海岛,Ukulele 之乡',
  },
  {
    locationId: 'us_chicago',
    names: ['芝加哥', 'Chicago'],
    type: 'city',
    region: 'north_america',
    country: '美国',
    va: { v: 0.55, a: 0.52 },
    genrePreferences: { blues: 0.85, jazz: 0.8, pop: 0.7, rock: 0.6 },
    signatureSongs: [
      { title: 'Chicago', artist: 'Sufjan Stevens', reason: 'lyric_mentions' },
      { title: 'My Kind of Town', artist: 'Frank Sinatra', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Nostalgic', 'Touching'],
    description: '蓝调与爵士之城',
  },
  // ─── 加拿大 ───
  {
    locationId: 'ca_toronto',
    names: ['多伦多', 'Toronto', 'Canada', '加拿大'],
    type: 'city',
    region: 'north_america',
    country: '加拿大',
    va: { v: 0.58, a: 0.55 },
    genrePreferences: { pop: 0.9, rap: 0.7, rnb: 0.7, electronic: 0.6 },
    signatureSongs: [
      { title: 'Started From the Bottom', artist: 'Drake', reason: 'local_hit' },
      { title: 'Toronto', artist: 'K-os', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Nostalgic'],
    description: 'Drake 故乡,北美多元文化',
  },
  {
    locationId: 'ca_vancouver',
    names: ['温哥华', 'Vancouver'],
    type: 'city',
    region: 'north_america',
    country: '加拿大',
    va: { v: 0.60, a: 0.45 },
    genrePreferences: { pop: 0.85, electronic: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'Vancouver', artist: 'Vance Joy', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Fresh', 'Peaceful'],
    description: '太平洋海岸,山海之城',
  },
  // ─── 南美 ───
  {
    locationId: 'br_rio',
    names: ['里约热内卢', 'Rio de Janeiro', 'Rio', '巴西', 'Brazil'],
    type: 'city',
    region: 'south_america',
    country: '巴西',
    va: { v: 0.75, a: 0.72 },
    genrePreferences: { latin: 0.9, pop: 0.8, electronic: 0.7, samba: 0.7 },
    signatureSongs: [
      { title: 'Garota de Ipanema', artist: 'Tom Jobim', reason: 'lyric_mentions', lyricSnippet: 'Olha que coisa mais linda' },
      { title: 'Mas Que Nada', artist: 'Sérgio Mendes', reason: 'local_hit' },
    ],
    sceneTag: 'party',
    emotionLabels: ['Joyful', 'Exciting'],
    description: '桑巴与 Bossa Nova 之都',
  },
  {
    locationId: 'ar_buenosaires',
    names: ['布宜诺斯艾利斯', 'Buenos Aires', '阿根廷', 'Argentina'],
    type: 'city',
    region: 'south_america',
    country: '阿根廷',
    va: { v: 0.58, a: 0.55 },
    genrePreferences: { latin: 0.85, tango: 0.8, pop: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'Buenos Aires', artist: 'Madonna', reason: 'lyric_mentions' },
      { title: 'Por Una Cabeza', artist: 'Carlos Gardel', reason: 'local_hit' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Romantic', 'Nostalgic'],
    description: '探戈之都',
  },
  {
    locationId: 'cu_havana',
    names: ['哈瓦那', 'Havana', '古巴', 'Cuba'],
    type: 'city',
    region: 'south_america',
    country: '古巴',
    va: { v: 0.65, a: 0.55 },
    genrePreferences: { latin: 0.9, jazz: 0.7, pop: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'Havana', artist: 'Camila Cabello', reason: 'lyric_mentions', lyricSnippet: 'Havana ooh na-na' },
      { title: 'Chan Chan', artist: 'Buena Vista Social Club', reason: 'local_hit' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Nostalgic'],
    description: '加勒比风情,拉丁爵士',
  },
];

// ============================================================================
// 第 4 部分:大洋洲 + 非洲 + 中东
// ============================================================================

const OCEANIA_AFRICA_ME_LOCATIONS: ReadonlyArray<LocationMusicEntry> = [
  // ─── 大洋洲 ───
  {
    locationId: 'au_sydney',
    names: ['悉尼', 'Sydney', '澳大利亚', 'Australia', '悉尼歌剧院', 'Sydney Opera House'],
    type: 'city',
    region: 'oceania',
    country: '澳大利亚',
    va: { v: 0.68, a: 0.55 },
    genrePreferences: { pop: 0.9, electronic: 0.7, rock: 0.6, folk: 0.5 },
    signatureSongs: [
      { title: 'Down Under', artist: 'Men at Work', reason: 'theme_match', lyricSnippet: 'Traveling in a fried-out combie' },
      { title: 'Sydney', artist: 'Katie Wighton', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Fresh'],
    description: '南半球,海港与歌剧院',
  },
  {
    locationId: 'au_melbourne',
    names: ['墨尔本', 'Melbourne'],
    type: 'city',
    region: 'oceania',
    country: '澳大利亚',
    va: { v: 0.58, a: 0.52 },
    genrePreferences: { rock: 0.8, electronic: 0.7, pop: 0.7, folk: 0.6 },
    signatureSongs: [
      { title: 'Melbourne', artist: 'Troye Sivan', reason: 'lyric_mentions' },
    ],
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Fresh', 'Nostalgic'],
    description: '咖啡文化,独立音乐',
  },
  {
    locationId: 'nz_auckland',
    names: ['奥克兰', 'Auckland', '新西兰', 'New Zealand'],
    type: 'city',
    region: 'oceania',
    country: '新西兰',
    va: { v: 0.62, a: 0.45 },
    genrePreferences: { pop: 0.85, folk: 0.7, electronic: 0.6 },
    signatureSongs: [
      { title: 'Auckland', artist: 'Lorde', reason: 'theme_match' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Peaceful', 'Fresh'],
    description: '风帆之城,Lorde 故乡',
  },
  // ─── 非洲 ───
  {
    locationId: 'za_cape_town',
    names: ['开普敦', 'Cape Town', '桌山', 'Table Mountain', '南非', 'South Africa'],
    type: 'city',
    region: 'africa',
    country: '南非',
    va: { v: 0.65, a: 0.50 },
    genrePreferences: { pop: 0.85, electronic: 0.7, folk: 0.6, jazz: 0.5 },
    signatureSongs: [
      { title: 'Cape Town', artist: 'Vic Naidoo', reason: 'lyric_mentions' },
    ],
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Joyful', 'Fresh'],
    description: '好望角,彩虹之国',
  },
  {
    locationId: 'eg_cairo',
    names: ['开罗', 'Cairo', '埃及', 'Egypt', '金字塔', 'Pyramids'],
    type: 'city',
    region: 'africa',
    country: '埃及',
    va: { v: 0.55, a: 0.50 },
    genrePreferences: { pop: 0.85, folk: 0.7, electronic: 0.5 },
    signatureSongs: [
      { title: 'Cairo', artist: 'Tom Odell', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Epic', 'Nostalgic'],
    description: '尼罗河畔,古埃及文明',
  },
  {
    locationId: 'ma_marrakech',
    names: ['马拉喀什', 'Marrakech', '摩洛哥', 'Morocco', '撒哈拉', 'Sahara'],
    type: 'city',
    region: 'africa',
    country: '摩洛哥',
    va: { v: 0.58, a: 0.48 },
    genrePreferences: { folk: 0.8, electronic: 0.7, pop: 0.6 },
    signatureSongs: [
      { title: 'Marrakech', artist: 'Ava Max', reason: 'lyric_mentions' },
      { title: 'Marrakesh Express', artist: 'Crosby, Stills & Nash', reason: 'lyric_mentions' },
    ],
    sceneTag: 'travel',
    emotionLabels: ['Dreamy', 'Nostalgic'],
    description: '北非红城,异域风情',
  },
  // ─── 中东 ───
  {
    locationId: 'ae_dubai',
    names: ['迪拜', 'Dubai', '阿联酋', 'UAE'],
    type: 'city',
    region: 'middle_east',
    country: '阿联酋',
    va: { v: 0.72, a: 0.68 },
    genrePreferences: { pop: 0.9, electronic: 0.8, rap: 0.6, rnb: 0.5 },
    signatureSongs: [
      { title: 'Dubai', artist: 'Lartiste', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Joyful'],
    description: '奢华之都,电音与夜店',
  },
  {
    locationId: 'il_tel_aviv',
    names: ['特拉维夫', 'Tel Aviv', '以色列', 'Israel'],
    type: 'city',
    region: 'middle_east',
    country: '以色列',
    va: { v: 0.65, a: 0.60 },
    genrePreferences: { electronic: 0.9, pop: 0.8, folk: 0.5 },
    signatureSongs: [
      { title: 'Tel Aviv', artist: 'Omer Adam', reason: 'lyric_mentions' },
    ],
    sceneTag: 'city_night',
    emotionLabels: ['Exciting', 'Joyful'],
    description: '中东不夜城,Techno 之都',
  },
];

// ============================================================================
// 第 5 部分:场所类型细化(扩展 POI 场景)
// ============================================================================

/**
 * 具体场所类型的音乐偏好细化
 * 补充 POI_MAPPING_TABLE 的粗映射,给出"该场所该听什么风格"
 */
export interface VenueMusicProfile {
  /** 场所类型 ID */
  venueType: string;
  /** 匹配关键词(POI 名/类别) */
  match: string[];
  /** 风格偏好(权重 0-1,支持扩展风格,匹配时映射回基础 GenreTag) */
  genrePreferences: Record<string, number>;
  /** V-A 倾向 */
  va: VACoordinate;
  /** 场景标签 */
  sceneTag: SongSceneTag;
  /** 情绪标签 */
  emotionLabels: EmotionLabel[];
  /** 说明 */
  description: string;
}

export const VENUE_MUSIC_PROFILES: ReadonlyArray<VenueMusicProfile> = [
  {
    venueType: 'cafe',
    match: ['咖啡', 'cafe', 'coffee', '星巴克', 'Starbucks', '%Arabica', '蓝瓶'],
    genrePreferences: { lofi: 0.9, folk: 0.8, pop: 0.6, jazz: 0.5, rnb: 0.5 },
    va: { v: 0.58, a: 0.30 },
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Relaxing', 'Fresh'],
    description: '咖啡馆:Lo-fi / 民谣 / 轻爵士,适合下午茶',
  },
  {
    venueType: 'bookstore',
    match: ['书店', 'bookstore', 'books', '图书馆', 'library', '诚品', '茑屋'],
    genrePreferences: { lofi: 0.9, classical: 0.7, folk: 0.7, pop: 0.5 },
    va: { v: 0.55, a: 0.25 },
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Peaceful', 'Healing'],
    description: '书店/图书馆:Lo-fi / 古典 / 民谣,安静阅读',
  },
  {
    venueType: 'bar',
    match: ['酒吧', 'bar', 'pub', '居酒屋', '清吧', 'lounge'],
    genrePreferences: { jazz: 0.8, rnb: 0.7, electronic: 0.6, pop: 0.6 },
    va: { v: 0.58, a: 0.45 },
    sceneTag: 'city_night',
    emotionLabels: ['Romantic', 'Nostalgic'],
    description: '酒吧:爵士 / R&B / 慢电子,微醺氛围',
  },
  {
    venueType: 'club',
    match: ['夜店', 'club', 'disco', '电音', '夜场'],
    genrePreferences: { electronic: 0.95, pop: 0.7, rap: 0.6 },
    va: { v: 0.75, a: 0.85 },
    sceneTag: 'party',
    emotionLabels: ['Exciting', 'Joyful'],
    description: '夜店:EDM / House / Techno,高能舞曲',
  },
  {
    venueType: 'gym',
    match: ['健身房', 'gym', 'fitness', '瑜伽', 'yoga', '运动'],
    genrePreferences: { electronic: 0.85, rap: 0.8, pop: 0.7, rock: 0.6 },
    va: { v: 0.70, a: 0.80 },
    sceneTag: 'party',
    emotionLabels: ['Exciting', 'Epic'],
    description: '健身房:电子 / 说唱 / 摇滚,高能激励',
  },
  {
    venueType: 'restaurant',
    match: ['餐厅', 'restaurant', '饭店', 'dining'],
    genrePreferences: { pop: 0.75, jazz: 0.6, folk: 0.6, rnb: 0.5 },
    va: { v: 0.60, a: 0.40 },
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Joyful', 'Romantic'],
    description: '餐厅:流行 / 轻爵士,就餐氛围',
  },
  {
    venueType: 'mall',
    match: ['商场', 'mall', '购物中心', 'shopping', '万达', '大悦城', '太古里'],
    genrePreferences: { pop: 0.9, electronic: 0.6, rnb: 0.5, rap: 0.5 },
    va: { v: 0.62, a: 0.55 },
    sceneTag: 'city_night',
    emotionLabels: ['Joyful', 'Fresh'],
    description: '商场:主流流行,轻松购物',
  },
  {
    venueType: 'park',
    match: ['公园', 'park', '绿地', '花园', 'garden'],
    genrePreferences: { folk: 0.8, pop: 0.7, lofi: 0.6, classical: 0.5 },
    va: { v: 0.60, a: 0.30 },
    sceneTag: 'travel',
    emotionLabels: ['Relaxing', 'Fresh'],
    description: '公园:民谣 / 轻音乐,悠闲散步',
  },
  {
    venueType: 'beach',
    match: ['海滩', 'beach', '沙滩', 'seaside', '海边', '海岸'],
    genrePreferences: { pop: 0.8, lofi: 0.7, electronic: 0.6, folk: 0.5 },
    va: { v: 0.65, a: 0.40 },
    sceneTag: 'seaside_dusk',
    emotionLabels: ['Relaxing', 'Romantic'],
    description: '海滩:流行 / Lo-fi / Chill,海风夕阳',
  },
  {
    venueType: 'mountain',
    match: ['山', 'mountain', '峰', 'peak', '山顶', '登山'],
    genrePreferences: { folk: 0.8, pop: 0.7, guofeng: 0.6, classical: 0.5 },
    va: { v: 0.58, a: 0.40 },
    sceneTag: 'morning_sunrise',
    emotionLabels: ['Epic', 'Peaceful'],
    description: '山顶:民谣 / 国风 / 史诗,壮阔登顶',
  },
  {
    venueType: 'temple',
    match: ['寺', '庙', 'temple', '教堂', 'church', '禅', 'zen'],
    genrePreferences: { guofeng: 0.85, classical: 0.7, folk: 0.6, lofi: 0.5 },
    va: { v: 0.50, a: 0.20 },
    sceneTag: 'guofeng',
    emotionLabels: ['Peaceful', 'Healing'],
    description: '寺庙/教堂:禅意 / 国风 / 圣乐,心灵宁静',
  },
  {
    venueType: 'museum',
    match: ['博物馆', 'museum', '美术馆', 'gallery', '展览', 'exhibition'],
    genrePreferences: { classical: 0.8, lofi: 0.7, folk: 0.6, pop: 0.5 },
    va: { v: 0.55, a: 0.28 },
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Nostalgic', 'Peaceful'],
    description: '博物馆:古典 / Lo-fi,文化沉浸',
  },
  {
    venueType: 'airport',
    match: ['机场', 'airport', '航站楼', 'terminal'],
    genrePreferences: { pop: 0.8, folk: 0.7, electronic: 0.6, lofi: 0.5 },
    va: { v: 0.50, a: 0.50 },
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Missing'],
    description: '机场:流行 / 民谣,离别与启程',
  },
  {
    venueType: 'train_station',
    match: ['火车站', 'train station', '高铁', '地铁', 'subway', 'metro'],
    genrePreferences: { pop: 0.8, folk: 0.7, electronic: 0.5, lofi: 0.5 },
    va: { v: 0.50, a: 0.52 },
    sceneTag: 'travel',
    emotionLabels: ['Nostalgic', 'Fresh'],
    description: '火车站:流行 / 民谣,旅途奔波',
  },
  {
    venueType: 'highway',
    match: ['高速', 'highway', '公路', 'road', '服务区', '自驾'],
    genrePreferences: { rock: 0.8, pop: 0.8, electronic: 0.7, rap: 0.5 },
    va: { v: 0.65, a: 0.60 },
    sceneTag: 'road_trip',
    emotionLabels: ['Exciting', 'Joyful'],
    description: '公路旅行:摇滚 / 流行 / 电子,驰骋感',
  },
  {
    venueType: 'school',
    match: ['学校', 'school', '大学', 'university', '校园', 'campus', '学院'],
    genrePreferences: { pop: 0.9, folk: 0.8, rock: 0.6, rnb: 0.5 },
    va: { v: 0.62, a: 0.50 },
    sceneTag: 'campus',
    emotionLabels: ['Nostalgic', 'Fresh'],
    description: '校园:流行 / 民谣,青春回忆',
  },
  {
    venueType: 'hospital',
    match: ['医院', 'hospital', '诊所', 'clinic'],
    genrePreferences: { lofi: 0.85, classical: 0.7, folk: 0.6, pop: 0.5 },
    va: { v: 0.50, a: 0.25 },
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Healing', 'Peaceful'],
    description: '医院:Lo-fi / 古典,静心治愈',
  },
  {
    venueType: 'home',
    match: ['家', 'home', '住宅', '小区', 'apartment', '宿舍', 'dorm'],
    genrePreferences: { lofi: 0.85, pop: 0.8, folk: 0.7, rnb: 0.5 },
    va: { v: 0.55, a: 0.30 },
    sceneTag: 'late_night_emo',
    emotionLabels: ['Relaxing', 'Healing'],
    description: '家中:Lo-fi / 流行,私密放松',
  },
  {
    venueType: 'office',
    match: ['办公室', 'office', '写字楼', '公司', 'company'],
    genrePreferences: { lofi: 0.9, pop: 0.7, electronic: 0.6, classical: 0.5 },
    va: { v: 0.55, a: 0.35 },
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Relaxing', 'Fresh'],
    description: '办公室:Lo-fi / 轻音乐,专注工作',
  },
  {
    venueType: 'cinema',
    match: ['电影院', 'cinema', '影城', 'theater', '剧院'],
    genrePreferences: { classical: 0.8, pop: 0.7, electronic: 0.5, folk: 0.5 },
    va: { v: 0.55, a: 0.40 },
    sceneTag: 'cafe_afternoon',
    emotionLabels: ['Dreamy', 'Epic'],
    description: '电影院:原声 / 古典,沉浸观影',
  },
];

// ============================================================================
// 第 6 部分:合并 + 查询函数
// ============================================================================

/** 全球所有地点(城市/地标/景区/区域) */
export const ALL_LOCATION_MUSIC_ENTRIES: ReadonlyArray<LocationMusicEntry> = [
  ...ASIA_LOCATIONS,
  ...EUROPE_LOCATIONS,
  ...AMERICA_LOCATIONS,
  ...OCEANIA_AFRICA_ME_LOCATIONS,
];

/**
 * 根据 POI 名称/类别查找匹配的地点音乐映射
 *
 * 查找顺序:
 * 1. 精确匹配 names(中英文/别名)
 * 2. 包含匹配(POI 名称包含地点名)
 * 3. 场所类型匹配(VENUE_MUSIC_PROFILES)
 */
export function findLocationMusic(
  poiName: string,
  category: string,
  district?: string,
): { location?: LocationMusicEntry; venue?: VenueMusicProfile } {
  const haystack = `${poiName} ${category} ${district ?? ''}`.toLowerCase();

  // 1. 精确匹配 names
  for (const entry of ALL_LOCATION_MUSIC_ENTRIES) {
    for (const name of entry.names) {
      if (poiName === name || haystack.includes(name.toLowerCase())) {
        return { location: entry };
      }
    }
  }

  // 2. 场所类型匹配
  for (const venue of VENUE_MUSIC_PROFILES) {
    for (const keyword of venue.match) {
      if (haystack.includes(keyword.toLowerCase())) {
        return { venue };
      }
    }
  }

  return {};
}

/**
 * 根据歌曲标题+歌手查找歌词中提到该地点的歌曲
 * (反向索引:歌曲 → 地点)
 */
export function findSongLocationMention(
  title: string,
  artist: string,
): LocationMusicEntry[] {
  const results: LocationMusicEntry[] = [];
  for (const entry of ALL_LOCATION_MUSIC_ENTRIES) {
    for (const song of entry.signatureSongs) {
      if (
        song.reason === 'lyric_mentions' &&
        (song.title === title || song.title.toLowerCase() === title.toLowerCase()) &&
        (song.artist === artist || song.artist.toLowerCase() === artist.toLowerCase())
      ) {
        results.push(entry);
        break;
      }
    }
  }
  return results;
}

/**
 * 扩展风格 → 基础 GenreTag 映射
 * 30 个 GenreTag 直接映射到自己;其余非标准风格映射到最近的基础类
 */
export const EXTENDED_GENRE_TO_BASE: Record<string, GenreTag> = {
  // 30 个 GenreTag 直接映射到自己(29 主类 + other)
  pop: 'pop',
  folk: 'folk',
  electronic: 'electronic',
  rap: 'rap',
  guofeng: 'guofeng',
  rock: 'rock',
  rnb: 'rnb',
  lofi: 'lofi',
  jazz: 'jazz',
  classical: 'classical',
  country: 'country',
  blues: 'blues',
  reggae: 'reggae',
  metal: 'metal',
  punk: 'punk',
  indie: 'indie',
  ambient: 'ambient',
  // 第 3 轮新增 8 类
  soul: 'soul',
  funk: 'funk',
  disco: 'disco',
  kpop: 'kpop',
  jpop: 'jpop',
  acoustic: 'acoustic',
  soundtrack: 'soundtrack',
  world: 'world',
  // 第 4 轮新增 4 类(子流派独立 + 人声)
  trap: 'trap',
  house: 'house',
  edm: 'edm',
  choir: 'choir',
  // 第 5 轮新增 15 类(子流派独立,均映射到自己)
  phonk: 'phonk',
  driftphonk: 'driftphonk',
  hyperpop: 'hyperpop',
  bedroompop: 'bedroompop',
  citypop: 'citypop',
  dreamcore: 'dreamcore',
  drill: 'drill',
  futurebass: 'futurebass',
  synthwave: 'synthwave',
  vaporwave: 'vaporwave',
  shoegaze: 'shoegaze',
  dreampop: 'dreampop',
  gufeng: 'gufeng', // 古风独立于 guofeng
  xiqiang: 'xiqiang',
  guofengrock: 'guofengrock',
  // 第 6 轮新增 15 类(2025 全球趋势子流派,均映射到自己)
  amapiano: 'amapiano',
  afrobeats: 'afrobeats',
  drumandbass: 'drumandbass',
  ukgarage: 'ukgarage',
  techno: 'techno',
  reggaeton: 'reggaeton',
  dembow: 'dembow',
  trance: 'trance',
  hardwave: 'hardwave',
  anime: 'anime',
  vocaloid: 'vocaloid',
  bachata: 'bachata',
  emo: 'emo',
  poppunk: 'poppunk',
  postpunk: 'postpunk',
  other: 'other',
  // 非 GenreTag 的扩展风格,映射到最近基础类
  latin: 'world',
  cantonese_pop: 'pop',
  samba: 'world',
  tango: 'world',
  bossa_nova: 'world',
  flamenco: 'world',
  celtic: 'world',
};

/**
 * 获取地点的风格偏好向量(补齐所有 45 个风格,未列出默认 0.3)
 * 扩展风格通过 EXTENDED_GENRE_TO_BASE 聚合(取最大值)
 */
export function getLocationGenrePreferences(
  location: LocationMusicEntry | VenueMusicProfile,
): Record<GenreTag, number> {
  const allGenres: GenreTag[] = [
    'pop', 'folk', 'electronic', 'rap', 'guofeng', 'rock', 'rnb', 'lofi',
    'jazz', 'classical', 'country', 'blues', 'reggae', 'metal', 'punk', 'indie', 'ambient',
    'soul', 'funk', 'disco', 'kpop', 'jpop', 'acoustic', 'soundtrack', 'world',
    'trap', 'house', 'edm', 'choir',
    // 第 5 轮新增 15 类
    'phonk', 'driftphonk', 'hyperpop', 'bedroompop', 'citypop', 'dreamcore',
    'drill', 'futurebass', 'synthwave', 'vaporwave', 'shoegaze', 'dreampop',
    'gufeng', 'xiqiang', 'guofengrock',
    // 第 6 轮新增 15 类
    'amapiano', 'afrobeats', 'drumandbass', 'ukgarage', 'techno',
    'reggaeton', 'dembow', 'trance', 'hardwave',
    'anime', 'vocaloid', 'bachata',
    'emo', 'poppunk', 'postpunk',
    'other',
  ];
  const result = {} as Record<GenreTag, number>;
  for (const g of allGenres) {
    result[g] = 0.3; // 默认
  }
  for (const [extGenre, weight] of Object.entries(location.genrePreferences)) {
    const baseGenre = EXTENDED_GENRE_TO_BASE[extGenre] ?? 'other';
    // 同一基础类下取最大值(避免重复累加)
    if (weight > result[baseGenre]) {
      result[baseGenre] = weight;
    }
  }
  return result;
}

/**
 * 获取地点的代表歌曲列表(用于 boost)
 */
export function getSignatureSongs(location: LocationMusicEntry): SignatureSong[] {
  return [...location.signatureSongs];
}

/** 全部地点数量统计 */
export const LOCATION_STATS = {
  total: ALL_LOCATION_MUSIC_ENTRIES.length,
  asia: ASIA_LOCATIONS.length,
  europe: EUROPE_LOCATIONS.length,
  america: AMERICA_LOCATIONS.length,
  oceania_africa_me: OCEANIA_AFRICA_ME_LOCATIONS.length,
  venues: VENUE_MUSIC_PROFILES.length,
} as const;
