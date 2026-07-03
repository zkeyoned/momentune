/**
 * Momentune 算法模块 - 音乐库
 *
 * 三层音乐库结构(对应算法设计文档「音乐库分层」):
 *   1. 热歌层(hot):紧跟抖音/汽水/网易云榜单,优先推荐
 *   2. 情绪层(emotion):经典品质歌曲 + 用户导入,精准匹配
 *   3. 兜底层(fallback):免版权纯音乐,永不断档
 *
 * 本模块提供:
 *   - HOT_CHART_2026:2026 年精选 30 首热歌数据(手工标注 V-A)
 *   - 用户歌单导入(网易云/QQ/汽水 → Song)
 *   - 热歌榜更新(平台榜单 → 音乐库热歌层)
 *   - 音乐库管理(按层/距离/风格过滤 + 统计)
 *
 * V-A 坐标来源:EMOTION_VA_COORDINATES(71 标签坐标表)
 * 无标签歌曲估算:musicToVA.keywordEstimateVA(元数据关键词启发)
 *
 * @module algorithm/musicLibrary
 */

import { EMOTION_VA_COORDINATES } from './config/emotionLabels.js';
import { keywordEstimateVA } from './musicToVA.js';
import type {
  EmotionLabel,
  GenreTag,
  HotRecency,
  LanguageTag,
  MusicLayer,
  Song,
  SongSceneTag,
  VACoordinate,
  VAWithConfidence,
} from './types.js';

// ============================================================================
// 1. 内部辅助:情绪标签 → V-A
// ============================================================================

/**
 * 从情绪标签构建带置信度的 V-A 坐标
 *
 * 手工标注的曲库使用 'manual' 来源,置信度 0.9
 * (坐标取自 EMOTION_VA_COORDINATES 71 标签表)
 *
 * @param label 71 种细分情绪标签之一
 * @returns 带置信度与来源的 V-A 坐标
 */
function vaFromEmotion(label: EmotionLabel): VAWithConfidence {
  const coord = EMOTION_VA_COORDINATES[label];
  return {
    v: coord.v,
    a: coord.a,
    confidence: 0.9,
    source: 'manual',
  };
}

/**
 * 计算 V-A 二维欧氏距离
 *
 * @param a 坐标 A
 * @param b 坐标 B
 * @returns 欧氏距离(0 ~ √2)
 */
function vaDistance(a: VACoordinate, b: VACoordinate): number {
  const dv = a.v - b.v;
  const da = a.a - b.a;
  return Math.sqrt(dv * dv + da * da);
}

/**
 * 生成稳定的歌曲 ID(基于标题+艺人)
 *
 * @param title 歌曲名
 * @param artist 艺人
 * @param prefix ID 前缀(区分来源)
 * @returns 形如 `${prefix}_${sanitized_title}_${sanitized_artist}` 的 ID
 */
function makeSongId(title: string, artist: string, prefix: string): string {
  const sanitize = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  return `${prefix}_${sanitize(title)}_${sanitize(artist)}`;
}

// ============================================================================
// 2. 2026 年热歌数据(三层 × 30 首)
// ============================================================================

/**
 * 2026 年精选热歌数据(30 首)
 *
 * 三层分布:
 *   - hot(15 首):2026 最新热歌,抖音/汽水/网易云榜单
 *   - emotion(10 首):经典品质歌曲,用户偏好类型
 *   - fallback(5 首):免版权纯音乐,兜底不断档
 *
 * 每首歌的 V-A 坐标由情绪标签从 EMOTION_VA_COORDINATES 查得,
 * 手工标注置信度 0.9。
 */
export const HOT_CHART_2026: readonly Song[] = [
  // —— 热歌层 hot(15 首,2026 最新热歌) ——
  {
    songId: 'hot_benteng_zhoushen',
    title: '奔腾',
    artist: '周深',
    layer: 'hot',
    va: vaFromEmotion('Epic'),
    genres: ['guofeng', 'pop'],
    sceneTags: ['travel', 'mountain_top'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_yibanyiban_topbarry',
    title: '一半一半',
    artist: 'Top Barry',
    layer: 'hot',
    va: vaFromEmotion('Joyful'),
    genres: ['rap', 'pop'],
    sceneTags: ['city_walk', 'commute'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_renjianyanhuo_chengxiang',
    title: '人间烟火',
    artist: '程响',
    layer: 'hot',
    va: vaFromEmotion('Healing'),
    genres: ['pop'],
    sceneTags: ['cafe_afternoon', 'city_walk'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_ruoyueliangmeilai_wangyuzhouleto',
    title: '若月亮没来',
    artist: '王宇宙Leto/乔浚丞',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['folk', 'pop'],
    sceneTags: ['late_night_emo', 'stargazing'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_longyaohuaxia_longyoulin',
    title: '龙耀华夏',
    artist: '龙友林',
    layer: 'hot',
    va: vaFromEmotion('Epic'),
    genres: ['guofeng', 'guofengrock'],
    sceneTags: ['festival', 'travel'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_lianren_lironghao',
    title: '恋人',
    artist: '李荣浩',
    layer: 'hot',
    va: vaFromEmotion('Romantic'),
    genres: ['pop', 'rnb'],
    sceneTags: ['wine_night', 'first_date'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_callmyname_zhangyixing',
    title: 'Call My Name',
    artist: '张艺兴',
    layer: 'hot',
    va: vaFromEmotion('Exciting'),
    genres: ['electronic', 'pop'],
    sceneTags: ['party', 'night_drive'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_shunqiziran_guochanafa',
    title: '顺其自然',
    artist: '国产阿发',
    layer: 'hot',
    va: vaFromEmotion('Peaceful'),
    genres: ['folk'],
    sceneTags: ['morning_coffee', 'camping'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_natianxiayule_zhoujielun',
    title: '那天下雨了',
    artist: '周杰伦',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['pop'],
    sceneTags: ['rainy_window', 'rainy_day'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_jietuo_zhengrunze',
    title: '解脱',
    artist: '郑润泽',
    layer: 'hot',
    va: vaFromEmotion('Melancholic'),
    genres: ['pop'],
    sceneTags: ['breakup', 'late_night_emo'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_xiu_jiangchen',
    title: '锈',
    artist: '江辰',
    layer: 'hot',
    va: vaFromEmotion('Lonely'),
    genres: ['rap', 'pop'],
    sceneTags: ['late_night_emo', 'solo_living'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2025,
  },
  {
    songId: 'hot_mengya_renran',
    title: '梦哑',
    artist: '任然',
    layer: 'hot',
    va: vaFromEmotion('Melancholic'),
    genres: ['pop'],
    sceneTags: ['sleep', 'late_night_emo'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_feifan_liudehua',
    title: '非凡',
    artist: '刘德华',
    layer: 'hot',
    va: vaFromEmotion('Heroic'),
    genres: ['pop', 'rock'],
    sceneTags: ['job_hunting', 'workout'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_boli_garetht',
    title: '玻璃',
    artist: 'Gareth.T',
    layer: 'hot',
    va: vaFromEmotion('Melancholic'),
    genres: ['rnb'],
    sceneTags: ['breakup', 'wine_night'],
    language: 'cantonese',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_qianghuo_baoshiGem',
    title: '槍火',
    artist: '宝石Gem',
    layer: 'hot',
    va: vaFromEmotion('Hype'),
    genres: ['rap'],
    sceneTags: ['gaming', 'night_drive'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_shangewang_gongfupanggai',
    title: '山歌王',
    artist: '功夫胖/GAI周延',
    layer: 'hot',
    va: vaFromEmotion('Hype'),
    genres: ['rap', 'guofeng'],
    sceneTags: ['festival', 'night_drive'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_myway_yanhaoxiangxieyishengyu',
    title: 'My Way(由我)',
    artist: '严浩翔/谢帝/盛宇',
    layer: 'hot',
    va: vaFromEmotion('Hype'),
    genres: ['rap'],
    sceneTags: ['workout_cardio', 'gaming'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_ddbackseat_topbarryrapeter',
    title: 'DD backseat',
    artist: 'Top Barry/Rapeter',
    layer: 'hot',
    va: vaFromEmotion('Groove'),
    genres: ['rap', 'pop'],
    sceneTags: ['night_drive', 'city_walk'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_beipanneed_cashtrippy',
    title: '背叛 NEED<3',
    artist: 'CashTrippy',
    layer: 'hot',
    va: vaFromEmotion('Tense'),
    genres: ['rap'],
    sceneTags: ['late_night_emo', 'gaming'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_paiweihouxiang_wannida',
    title: '排尾后巷',
    artist: '万妮达',
    layer: 'hot',
    va: vaFromEmotion('Groove'),
    genres: ['rap', 'rnb'],
    sceneTags: ['night_drive', 'city_night'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_crazylove_wangyitaiaire',
    title: 'Crazy Love',
    artist: '王以太/艾热',
    layer: 'hot',
    va: vaFromEmotion('Romantic'),
    genres: ['rap', 'rnb'],
    sceneTags: ['first_date', 'wine_night'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_fantowupinjieban_ciyo',
    title: '反乌托邦(拼接版)',
    artist: 'Ciyo',
    layer: 'hot',
    va: vaFromEmotion('AbstractBanger'),
    genres: ['electronic', 'rap'],
    sceneTags: ['gaming', 'night_drive'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_xiaohetangshui2026leijidun_ykkkk',
    title: '小河淌水(2026雷击顿)',
    artist: 'YKKKK马丹阳',
    layer: 'hot',
    va: vaFromEmotion('Groove'),
    genres: ['electronic', 'guofeng'],
    sceneTags: ['party', 'road_trip'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_niaizheshuiremix_moonlight',
    title: '你爱着谁Remix',
    artist: 'moonlight',
    layer: 'hot',
    va: vaFromEmotion('Dreamy'),
    genres: ['electronic', 'pop'],
    sceneTags: ['seaside_dusk', 'rooftop_sunset'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_lemonadezeddremix_aeszed',
    title: 'LEMONADE (Zedd Remix)',
    artist: 'aespa/Zedd',
    layer: 'hot',
    va: vaFromEmotion('Exciting'),
    genres: ['electronic', 'kpop'],
    sceneTags: ['party', 'workout_cardio'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_ijustmight_brunomars',
    title: 'I Just Might',
    artist: 'Bruno Mars',
    layer: 'hot',
    va: vaFromEmotion('Groove'),
    genres: ['rnb', 'electronic'],
    sceneTags: ['cafe_afternoon', 'city_walk'],
    language: 'english',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_yuguohoudefengjing_dizzydizzo',
    title: '雨过后的风景',
    artist: 'Dizzy Dizzo',
    layer: 'hot',
    va: vaFromEmotion('Healing'),
    genres: ['rnb', 'pop'],
    sceneTags: ['rainy_day', 'cafe_afternoon'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_chanel_tyla',
    title: 'CHANEL',
    artist: 'Tyla',
    layer: 'hot',
    va: vaFromEmotion('SensualNeon'),
    genres: ['rnb', 'afrobeats'],
    sceneTags: ['summer_beach', 'wine_night'],
    language: 'english',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_stealthemoon_wangjunkai',
    title: 'Steal The Moon',
    artist: '王俊凯',
    layer: 'hot',
    va: vaFromEmotion('Dreamy'),
    genres: ['rnb', 'pop'],
    sceneTags: ['stargazing', 'rooftop_sunset'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_xiegushideren_wangsulong',
    title: '写故事的人',
    artist: '汪苏泷',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['pop', 'rnb'],
    sceneTags: ['rainy_window', 'study_focus'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },

  // —— 情绪层 emotion(10 首,经典品质歌曲) ——
  {
    songId: 'emo_buyihan_lironghao',
    title: '不遗憾',
    artist: '李荣浩',
    layer: 'emotion',
    va: vaFromEmotion('Relaxing'),
    genres: ['pop', 'rnb'],
    sceneTags: ['seaside_dusk', 'road_trip'],
    language: 'mandarin',
    hotRecency: 'older',
    decade: 2020,
  },
  {
    songId: 'emo_yintian_mowenwei',
    title: '阴天',
    artist: '莫文蔚',
    layer: 'emotion',
    va: vaFromEmotion('Cozy'),
    genres: ['pop', 'rnb'],
    sceneTags: ['commute_evening', 'cafe_afternoon'],
    language: 'mandarin',
    hotRecency: 'older',
    decade: 1999,
  },
  {
    songId: 'emo_xiaochao_maobuyi',
    title: '消愁',
    artist: '毛不易',
    layer: 'emotion',
    va: vaFromEmotion('Melancholic'),
    genres: ['folk'],
    sceneTags: ['late_night_emo', 'wine_night'],
    language: 'mandarin',
    hotRecency: 'older',
    decade: 2017,
  },
  {
    songId: 'emo_peniduguomanchangsuiyue_chenyixun',
    title: '陪你度过漫长岁月',
    artist: '陈奕迅',
    layer: 'emotion',
    va: vaFromEmotion('Tenderness'),
    genres: ['pop'],
    sceneTags: ['reunion', 'anniversary'],
    language: 'mandarin',
    hotRecency: 'older',
    decade: 2015,
  },
  {
    songId: 'emo_yanyuan_xuezhiqian',
    title: '演员',
    artist: '薛之谦',
    layer: 'emotion',
    va: vaFromEmotion('Lonely'),
    genres: ['pop'],
    sceneTags: ['breakup', 'late_night_emo'],
    language: 'mandarin',
    hotRecency: 'older',
    decade: 2015,
  },
  {
    songId: 'emo_yecaoyuzhizihua_linsanqi',
    title: '野草与栀子花',
    artist: '林三七',
    layer: 'emotion',
    va: vaFromEmotion('Fresh'),
    genres: ['folk'],
    sceneTags: ['spring_bloom', 'camping'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2025,
  },
  {
    songId: 'emo_jiahewanggang_hailaimu',
    title: '嘉禾望岗',
    artist: '海来阿木',
    layer: 'emotion',
    va: vaFromEmotion('Wanderer'),
    genres: ['folk'],
    sceneTags: ['train_window', 'commute'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_xinghelidechuan_maobuyi',
    title: '星河里的船',
    artist: '毛不易',
    layer: 'emotion',
    va: vaFromEmotion('Peaceful'),
    genres: ['folk'],
    sceneTags: ['stargazing', 'meditation'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_xiangyunduan_xiaoxiaohaiyangBo',
    title: '向云端',
    artist: '小霞/海洋Bo',
    layer: 'emotion',
    va: vaFromEmotion('Healing'),
    genres: ['folk', 'pop'],
    sceneTags: ['morning_sunrise', 'mountain_top'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_xiaomeiman_zhoushen',
    title: '小美满',
    artist: '周深',
    layer: 'emotion',
    va: vaFromEmotion('Joyful'),
    genres: ['pop'],
    sceneTags: ['pet_companion', 'cooking'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_power_kanyewest',
    title: 'POWER',
    artist: 'Kanye West',
    layer: 'emotion',
    va: vaFromEmotion('Power'),
    genres: ['rap', 'electronic'],
    sceneTags: ['workout_cardio', 'night_drive'],
    language: 'english',
    hotRecency: 'older',
    decade: 2010,
  },
  {
    songId: 'emo_runaway_kanyewest',
    title: 'Runaway',
    artist: 'Kanye West',
    layer: 'emotion',
    va: vaFromEmotion('Melancholic'),
    genres: ['rap', 'pop'],
    sceneTags: ['late_night_emo', 'city_walk'],
    language: 'english',
    hotRecency: 'older',
    decade: 2010,
  },
  {
    songId: 'emo_sickomode_travisscott',
    title: 'SICKO MODE',
    artist: 'Travis Scott',
    layer: 'emotion',
    va: vaFromEmotion('Hype'),
    genres: ['trap', 'rap'],
    sceneTags: ['party', 'night_drive'],
    language: 'english',
    hotRecency: 'older',
    decade: 2018,
  },
  {
    songId: 'emo_passionfruit_drake',
    title: 'Passionfruit',
    artist: 'Drake',
    layer: 'emotion',
    va: vaFromEmotion('Vibes'),
    genres: ['rnb', 'rap'],
    sceneTags: ['seaside_dusk', 'cafe_afternoon'],
    language: 'english',
    hotRecency: 'older',
    decade: 2017,
  },
  {
    songId: 'emo_circles_postmalone',
    title: 'Circles',
    artist: 'Post Malone',
    layer: 'emotion',
    va: vaFromEmotion('Relaxing'),
    genres: ['rap', 'rnb'],
    sceneTags: ['commute_evening', 'rainy_window'],
    language: 'english',
    hotRecency: 'older',
    decade: 2019,
  },
  {
    songId: 'emo_heartless_kanyewest',
    title: 'Heartless',
    artist: 'Kanye West',
    layer: 'emotion',
    va: vaFromEmotion('EmoNight'),
    genres: ['rap', 'electronic'],
    sceneTags: ['late_night_emo', 'night_drive'],
    language: 'english',
    hotRecency: 'older',
    decade: 2008,
  },
  {
    songId: 'emo_thehills_theweeknd',
    title: 'The Hills',
    artist: 'The Weeknd',
    layer: 'emotion',
    va: vaFromEmotion('Dark'),
    genres: ['rnb', 'electronic'],
    sceneTags: ['city_night', 'wine_night'],
    language: 'english',
    hotRecency: 'older',
    decade: 2015,
  },
  {
    songId: 'emo_goosebumps_travisscott',
    title: 'goosebumps',
    artist: 'Travis Scott',
    layer: 'emotion',
    va: vaFromEmotion('Aggressive'),
    genres: ['trap', 'rap'],
    sceneTags: ['gaming', 'night_drive'],
    language: 'english',
    hotRecency: 'older',
    decade: 2016,
  },
  {
    songId: 'emo_noidea_dontoliver',
    title: 'No Idea',
    artist: 'Don Toliver',
    layer: 'emotion',
    va: vaFromEmotion('Hypnotic'),
    genres: ['trap', 'rnb'],
    sceneTags: ['night_drive', 'rooftop_sunset'],
    language: 'english',
    hotRecency: 'older',
    decade: 2020,
  },
  {
    songId: 'emo_qiandaohaidishuoaini_wannida',
    title: '潜到海底说爱你',
    artist: '万妮达',
    layer: 'emotion',
    va: vaFromEmotion('Romantic'),
    genres: ['rap', 'rnb'],
    sceneTags: ['seaside_dusk', 'summer_beach'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_baotouyoucaoyuan_huangtao',
    title: '包头也有草原',
    artist: '黄涛',
    layer: 'emotion',
    va: vaFromEmotion('Wanderer'),
    genres: ['guofeng', 'folk'],
    sceneTags: ['travel', 'hiking'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_hulatangzhige_dongheband',
    title: '胡辣汤之歌',
    artist: '东河乐队',
    layer: 'emotion',
    va: vaFromEmotion('Joyful'),
    genres: ['folk', 'guofeng'],
    sceneTags: ['cooking', 'festival'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },

  // —— 兜底层 fallback(5 首,免版权纯音乐) ——
  {
    songId: 'fb_chenguangambience_royaltyfree',
    title: '晨光Ambient',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('Fresh'),
    genres: ['electronic'],
    sceneTags: ['morning_sunrise', 'spring_morning'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2024,
  },
  {
    songId: 'fb_shenyelofi_royaltyfree',
    title: '深夜Lo-fi',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('Relaxing'),
    genres: ['lofi'],
    sceneTags: ['late_night_emo', 'study_focus'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2024,
  },
  {
    songId: 'fb_gongludianzi_royaltyfree',
    title: '公路电子',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('Exciting'),
    genres: ['electronic'],
    sceneTags: ['road_trip', 'night_drive'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2024,
  },
  {
    songId: 'fb_haibianfenwei_royaltyfree',
    title: '海边氛围',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('Dreamy'),
    genres: ['ambient'],
    sceneTags: ['seaside_dusk', 'summer_beach'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2024,
  },
  {
    songId: 'fb_mingxianggangqin_royaltyfree',
    title: '冥想钢琴',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('Peaceful'),
    genres: ['classical'],
    sceneTags: ['meditation', 'sleep'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2024,
  },
  {
    songId: 'fb_phonkdrift_royaltyfree',
    title: 'Phonk漂移',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('Aggressive'),
    genres: ['phonk', 'electronic'],
    sceneTags: ['night_drive', 'gaming'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2025,
  },
  {
    songId: 'fb_chengshilofi_royaltyfree',
    title: '城市Lo-fi',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('Cozy'),
    genres: ['lofi', 'electronic'],
    sceneTags: ['study_focus', 'commute_evening'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2025,
  },
  {
    songId: 'fb_saibonihong_royaltyfree',
    title: '赛博霓虹',
    artist: 'RoyaltyFree',
    layer: 'fallback',
    va: vaFromEmotion('SensualNeon'),
    genres: ['electronic', 'synthwave'],
    sceneTags: ['city_night', 'night_drive'],
    language: 'instrumental',
    hotRecency: 'never',
    decade: 2025,
  },
  // ============================================================================
  // 第3轮扩充：2026年全网真实热歌（QQ音乐巅峰榜+网易云飙升榜+Billboard Summer+Spotify）
  // 新增37首，覆盖Pop/Rap/Electronic/Guofeng/Kpop/R&B/Country等
  // ============================================================================

  // ——— 热歌层 hot：华语2026热歌 ———
  {
    songId: 'hot_xiangshensuo_zhangzhenyuan',
    title: '相思锁',
    artist: '张真源',
    layer: 'hot',
    va: vaFromEmotion('Romantic'),
    genres: ['guofeng', 'pop'],
    sceneTags: ['first_date', 'qixi_valentine'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_rangnizhidao_wangsulong_gem',
    title: '让你知道',
    artist: '汪苏泷/G.E.M.邓紫棋',
    layer: 'hot',
    va: vaFromEmotion('Healing'),
    genres: ['pop'],
    sceneTags: ['reunion', 'cafe_afternoon'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_jiejiaodewanfeng_chenxiaochun',
    title: '街角的晚风',
    artist: '陈小春',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['pop'],
    sceneTags: ['city_walk', 'commute_evening'],
    language: 'cantonese',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_mingrizuobiao_linjunjie',
    title: '明日坐标',
    artist: '林俊杰',
    layer: 'hot',
    va: vaFromEmotion('Epic'),
    genres: ['pop', 'electronic'],
    sceneTags: ['stargazing', 'road_trip'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_hengxingbuwang_f3_maydayashin',
    title: '恒星不忘 forever',
    artist: 'F3/五月天阿信',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['rock', 'pop'],
    sceneTags: ['reunion', 'anniversary'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_shijiezengyuwode_wangfei',
    title: '世界赠予我的',
    artist: '王菲',
    layer: 'hot',
    va: vaFromEmotion('Dreamy'),
    genres: ['pop'],
    sceneTags: ['meditation', 'morning_sunrise'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_qianmingbi_rapeter',
    title: '签名笔 (Live)',
    artist: 'Rapeter',
    layer: 'hot',
    va: vaFromEmotion('Groove'),
    genres: ['rap', 'pop'],
    sceneTags: ['city_night', 'night_drive'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_nongsuolanjing_qiude',
    title: '浓缩蓝鲸',
    artist: '裘德',
    layer: 'hot',
    va: vaFromEmotion('Dreamy'),
    genres: ['pop'],
    sceneTags: ['seaside_dusk', 'rainy_window'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_zhuiluo_sunnan_huangzihongfan',
    title: '坠落 (Live)',
    artist: '孙楠/黄子弘凡',
    layer: 'hot',
    va: vaFromEmotion('Epic'),
    genres: ['pop', 'rock'],
    sceneTags: ['mountain_top', 'workout_cardio'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_tiandi_xilinnayigao',
    title: '甜敌',
    artist: '希林娜依高',
    layer: 'hot',
    va: vaFromEmotion('Joyful'),
    genres: ['pop', 'electronic'],
    sceneTags: ['party', 'first_date'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_colt45_dankodanko',
    title: 'Colt.45',
    artist: '弹壳Danko',
    layer: 'hot',
    va: vaFromEmotion('Hype'),
    genres: ['rap'],
    sceneTags: ['night_drive', 'gaming'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_xiaoyaoxian_kuaizixiongdi',
    title: '逍遥仙',
    artist: '筷子兄弟',
    layer: 'hot',
    va: vaFromEmotion('Joyful'),
    genres: ['guofeng', 'pop'],
    sceneTags: ['festival', 'spring_bloom'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_luoyangzhi_xusong',
    title: '洛阳纸',
    artist: '许嵩',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['guofeng', 'pop'],
    sceneTags: ['study_focus', 'rainy_window'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_zhujue_wangfei',
    title: '主角',
    artist: '王菲',
    layer: 'hot',
    va: vaFromEmotion('Power'),
    genres: ['guofeng', 'pop'],
    sceneTags: ['job_hunting', 'workout_cardio'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_zhamengyueruxingkong_wangyuan',
    title: '蚱蜢跃入星空',
    artist: '王源',
    layer: 'hot',
    va: vaFromEmotion('Dreamy'),
    genres: ['pop'],
    sceneTags: ['stargazing', 'sleep'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_chizi_zhoushen',
    title: '赤子',
    artist: '周深',
    layer: 'hot',
    va: vaFromEmotion('Epic'),
    genres: ['pop', 'guofeng'],
    sceneTags: ['travel', 'mountain_top'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_zichaiyuan_zhangyunlei',
    title: '紫钗缘',
    artist: '张云雷',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['guofeng', 'folk'],
    sceneTags: ['qixi_valentine', 'wine_night'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_cucao_xusong',
    title: '粗糙',
    artist: '许嵩',
    layer: 'hot',
    va: vaFromEmotion('Cozy'),
    genres: ['guofeng', 'folk'],
    sceneTags: ['cafe_afternoon', 'study_focus'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_alive_wangjiaer_ashin',
    title: 'Alive',
    artist: '王嘉尔/阿信',
    layer: 'hot',
    va: vaFromEmotion('Exciting'),
    genres: ['electronic', 'kpop'],
    sceneTags: ['party', 'workout_cardio'],
    language: 'mandarin',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_zenme_houminghao',
    title: '怎么能',
    artist: '侯明昊',
    layer: 'hot',
    va: vaFromEmotion('Romantic'),
    genres: ['pop'],
    sceneTags: ['first_date', 'rooftop_sunset'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_lueluelue_topdenglu',
    title: '略略略略略',
    artist: 'TOP登陆少年组合',
    layer: 'hot',
    va: vaFromEmotion('Joyful'),
    genres: ['pop', 'electronic'],
    sceneTags: ['party', 'gaming'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_yibaiersanbai_huangzihongfan',
    title: '一拜二拜三拜',
    artist: '黄子弘凡/王者荣耀',
    layer: 'hot',
    va: vaFromEmotion('Epic'),
    genres: ['guofeng', 'electronic'],
    sceneTags: ['gaming', 'festival'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },

  // ——— 热歌层 hot：国际2026热歌 ———
  {
    songId: 'hot_janicestfu_drake',
    title: 'Janice STFU',
    artist: 'Drake',
    layer: 'hot',
    va: vaFromEmotion('Hype'),
    genres: ['rap'],
    sceneTags: ['party', 'night_drive'],
    language: 'english',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_thecure_oliviarodrigo',
    title: 'The Cure',
    artist: 'Olivia Rodrigo',
    layer: 'hot',
    va: vaFromEmotion('Melancholic'),
    genres: ['pop'],
    sceneTags: ['breakup', 'rainy_window'],
    language: 'english',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_dropdead_oliviarodrigo',
    title: 'Drop Dead',
    artist: 'Olivia Rodrigo',
    layer: 'hot',
    va: vaFromEmotion('Tense'),
    genres: ['pop', 'rock'],
    sceneTags: ['breakup', 'workout_cardio'],
    language: 'english',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_choosintexas_ellalangley',
    title: 'Choosin\' Texas',
    artist: 'Ella Langley',
    layer: 'hot',
    va: vaFromEmotion('Joyful'),
    genres: ['country', 'pop'],
    sceneTags: ['road_trip', 'summer_beach'],
    language: 'english',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_hatethatimadeyou_arianagrande',
    title: 'Hate That I Made You Love Me',
    artist: 'Ariana Grande',
    layer: 'hot',
    va: vaFromEmotion('Melancholic'),
    genres: ['pop', 'rnb'],
    sceneTags: ['breakup', 'wine_night'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_iknewit_taylorswift',
    title: 'I Knew It, I Knew You',
    artist: 'Taylor Swift',
    layer: 'hot',
    va: vaFromEmotion('Nostalgic'),
    genres: ['pop'],
    sceneTags: ['first_date', 'reunion'],
    language: 'english',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'hot_stupidsong_oliviarodrigo',
    title: 'stupid song',
    artist: 'Olivia Rodrigo',
    layer: 'hot',
    va: vaFromEmotion('Joyful'),
    genres: ['pop', 'rock'],
    sceneTags: ['party', 'city_walk'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_runway_ladygaga_doechii',
    title: 'Runway',
    artist: 'Lady Gaga & Doechii',
    layer: 'hot',
    va: vaFromEmotion('Exciting'),
    genres: ['electronic', 'pop'],
    sceneTags: ['party', 'workout_cardio'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_rude_hearts2hearts',
    title: 'RUDE!',
    artist: 'Hearts2Hearts',
    layer: 'hot',
    va: vaFromEmotion('Exciting'),
    genres: ['electronic', 'kpop'],
    sceneTags: ['party', 'gaming'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_feverpitch_richz',
    title: 'Fever Pitch',
    artist: 'Richz',
    layer: 'hot',
    va: vaFromEmotion('Hype'),
    genres: ['electronic'],
    sceneTags: ['gaming', 'night_drive'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_swim_bts',
    title: 'Swim',
    artist: 'BTS',
    layer: 'hot',
    va: vaFromEmotion('Hype'),
    genres: ['kpop', 'electronic'],
    sceneTags: ['workout_cardio', 'party'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'hot_intoyou_arianagrande',
    title: 'Into You',
    artist: 'Ariana Grande',
    layer: 'hot',
    va: vaFromEmotion('Romantic'),
    genres: ['pop', 'rnb'],
    sceneTags: ['first_date', 'wine_night'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2016,
  },
  {
    songId: 'hot_iconicbymistake_lesserafim',
    title: 'ICONIC BY MISTAKE',
    artist: 'LE SSERAFIM/ILLIT/KATSEYE',
    layer: 'hot',
    va: vaFromEmotion('Exciting'),
    genres: ['kpop', 'electronic'],
    sceneTags: ['party', 'city_walk'],
    language: 'english',
    hotRecency: 'this_month',
    decade: 2026,
  },

  // ——— 情绪层 emotion：品质好歌 ———
  {
    songId: 'emo_manineed_oliviadean',
    title: 'Man I Need',
    artist: 'Olivia Dean',
    layer: 'emotion',
    va: vaFromEmotion('Romantic'),
    genres: ['soul', 'pop'],
    sceneTags: ['cafe_afternoon', 'first_date'],
    language: 'english',
    hotRecency: 'older',
    decade: 2025,
  },
  {
    songId: 'emo_sanyuelive_youchangjing',
    title: '三月 (live)',
    artist: '尤长靖',
    layer: 'emotion',
    va: vaFromEmotion('Nostalgic'),
    genres: ['pop'],
    sceneTags: ['rainy_window', 'commute_evening'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_beher_ellalangley',
    title: 'Be Her',
    artist: 'Ella Langley',
    layer: 'emotion',
    va: vaFromEmotion('Romantic'),
    genres: ['country', 'pop'],
    sceneTags: ['seaside_dusk', 'road_trip'],
    language: 'english',
    hotRecency: 'older',
    decade: 2025,
  },
  {
    songId: 'emo_angel_yinmeilai',
    title: 'ANGEL (天使)',
    artist: '尹美莱/Tiger JK/Bizzy',
    layer: 'emotion',
    va: vaFromEmotion('Epic'),
    genres: ['kpop', 'rap'],
    sceneTags: ['city_night', 'night_drive'],
    language: 'korean',
    hotRecency: 'this_week',
    decade: 2026,
  },
  {
    songId: 'emo_brandnewsky_mingchao',
    title: 'Brand New Sky',
    artist: '鸣潮先约电台/飞行雪绒',
    layer: 'emotion',
    va: vaFromEmotion('Epic'),
    genres: ['electronic', 'pop'],
    sceneTags: ['gaming', 'mountain_top'],
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_wu_yonzuukenshi',
    title: '烏 - Raven',
    artist: '米津玄師',
    layer: 'emotion',
    va: vaFromEmotion('Dark'),
    genres: ['pop', 'electronic'],
    sceneTags: ['city_night', 'late_night_emo'],
    language: 'japanese',
    hotRecency: 'this_month',
    decade: 2026,
  },
  {
    songId: 'emo_aizo_kinggnu',
    title: 'AIZO',
    artist: 'King Gnu',
    layer: 'emotion',
    va: vaFromEmotion('Hype'),
    genres: ['rock', 'electronic'],
    sceneTags: ['gaming', 'workout_cardio'],
    language: 'japanese',
    hotRecency: 'this_month',
    decade: 2026,
  },
] as const;

// ============================================================================
// 3. 用户导入接口
// ============================================================================

/** 用户导入的歌曲条目(从网易云/QQ/汽水歌单导入) */
export interface ImportedSongEntry {
  title: string;
  artist: string;
  /** 已知的风格标签(可选,平台 API 可提供) */
  genres?: GenreTag[];
  /** 已知的情绪标签(可选,网易云 emo163 可提供) */
  emotionLabel?: EmotionLabel;
  /** 语言 */
  language?: LanguageTag;
}

/**
 * 将用户导入的歌单转换为 Song 对象
 *
 * V-A 标注策略(按优先级):
 *   1. 有情绪标签 → 直接从 EMOTION_VA_COORDINATES 映射(confidence 0.85, source 'netease_tag')
 *   2. 无情绪标签 → 调用 keywordEstimateVA 根据标题/艺人启发式估算
 *      (confidence 0.5, source 'metadata_keyword')
 *
 * 用户导入的歌统一标记为 emotion 层,hotRecency 设为 'never'。
 *
 * @param entries 用户导入的歌单条目
 * @returns 转换后的 Song 数组(未合并入音乐库)
 */
export function importUserPlaylist(entries: readonly ImportedSongEntry[]): Song[] {
  return entries.map((entry, idx) => {
    const songId = makeSongId(entry.title, entry.artist, 'user');
    const genres: GenreTag[] = entry.genres ?? ['pop'];
    const language: LanguageTag = entry.language ?? 'mandarin';

    // V-A 标注:有情绪标签直接映射,无则关键词启发
    let va: VAWithConfidence;
    if (entry.emotionLabel) {
      const coord = EMOTION_VA_COORDINATES[entry.emotionLabel];
      va = {
        v: coord.v,
        a: coord.a,
        confidence: 0.85,
        source: 'netease_tag',
      };
    } else {
      va = keywordEstimateVA(entry.title, entry.artist);
    }

    return {
      songId: `${songId}_${idx}`,
      title: entry.title,
      artist: entry.artist,
      layer: 'emotion' as MusicLayer,
      va,
      genres,
      sceneTags: ['general'] as SongSceneTag[],
      language,
      hotRecency: 'never' as HotRecency,
      decade: new Date().getFullYear(),
    };
  });
}

/**
 * 合并用户导入的歌曲到音乐库
 *
 * 用户导入的歌标记为 emotion 层,与现有库合并(去重按 songId)。
 * 已存在的 songId 不会被覆盖(保留库中已有版本)。
 *
 * @param library 现有音乐库(只读)
 * @param userSongs 用户导入并已转换的 Song 数组(只读)
 * @returns 合并后的新音乐库
 */
export function mergeUserImports(
  library: readonly Song[],
  userSongs: readonly Song[],
): Song[] {
  const existingIds = new Set(library.map((s) => s.songId));
  const additions: Song[] = [];
  for (const song of userSongs) {
    if (!existingIds.has(song.songId)) {
      additions.push(song);
    }
  }
  return [...library, ...additions];
}

// ============================================================================
// 4. 热歌榜更新接口
// ============================================================================

/** 热歌榜条目(从平台 API 获取) */
export interface HotChartEntry {
  title: string;
  artist: string;
  /** 上榜时间戳 */
  listedDate?: number;
  /** 平台来源 */
  source: 'douyin' | 'qishui' | 'netease' | 'qq';
  genres?: GenreTag[];
  emotionLabel?: EmotionLabel;
  language?: LanguageTag;
}

/**
 * 根据 listedDate 推断热歌新鲜度等级
 *
 * - 7 天内 → this_week
 * - 30 天内 → this_month
 * - 180 天内 → half_year
 * - 更早 → older
 * - 无时间戳 → this_week(新上榜默认)
 *
 * @param listedDate 上榜时间戳(ms),可选
 * @returns 热歌新鲜度等级
 */
function inferHotRecency(listedDate?: number): HotRecency {
  if (!listedDate) return 'this_week';
  const now = Date.now();
  const diffDays = (now - listedDate) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return 'this_week';
  if (diffDays <= 30) return 'this_month';
  if (diffDays <= 180) return 'half_year';
  return 'older';
}

/**
 * 将热歌榜条目转换为 Song 对象
 *
 * V-A 标注:有情绪标签直接映射,无则关键词启发估算
 * 层级:hot;hotRecency 由 listedDate 推断
 */
function hotChartEntryToSong(entry: HotChartEntry): Song {
  const songId = makeSongId(entry.title, entry.artist, 'hot');
  const genres: GenreTag[] = entry.genres ?? ['pop'];
  const language: LanguageTag = entry.language ?? 'mandarin';

  let va: VAWithConfidence;
  if (entry.emotionLabel) {
    const coord = EMOTION_VA_COORDINATES[entry.emotionLabel];
    va = {
      v: coord.v,
      a: coord.a,
      confidence: 0.85,
      source: 'netease_tag',
    };
  } else {
    va = keywordEstimateVA(entry.title, entry.artist);
  }

  return {
    songId,
    title: entry.title,
    artist: entry.artist,
    layer: 'hot',
    va,
    genres,
    sceneTags: ['general'],
    language,
    hotRecency: inferHotRecency(entry.listedDate),
    decade: new Date().getFullYear(),
  };
}

/**
 * 更新热歌榜:将新上榜歌曲加入热歌层
 *
 * 处理逻辑:
 *   - 已存在的歌(按 songId 匹配)→ 更新 hotRecency,计入 updated
 *   - 新歌 → 估算 V-A 后加入热歌层,计入 added
 *   - 返回更新后的完整音乐库
 *
 * @param currentLibrary 当前音乐库(只读)
 * @param newEntries 新上榜的热歌条目
 * @returns added 新增歌曲 / updated 更新歌曲 / library 更新后的音乐库
 */
export function updateHotChart(
  currentLibrary: readonly Song[],
  newEntries: readonly HotChartEntry[],
): { added: Song[]; updated: Song[]; library: Song[] } {
  const libraryMap = new Map<string, Song>();
  for (const song of currentLibrary) {
    libraryMap.set(song.songId, song);
  }

  const added: Song[] = [];
  const updated: Song[] = [];

  for (const entry of newEntries) {
    const newSong = hotChartEntryToSong(entry);
    const existing = libraryMap.get(newSong.songId);
    if (existing) {
      // 已存在:更新 hotRecency(保留原有 V-A 标注避免抖动)
      const refreshed: Song = {
        ...existing,
        layer: 'hot',
        hotRecency: inferHotRecency(entry.listedDate),
      };
      libraryMap.set(newSong.songId, refreshed);
      updated.push(refreshed);
    } else {
      // 新歌:加入热歌层
      libraryMap.set(newSong.songId, newSong);
      added.push(newSong);
    }
  }

  return {
    added,
    updated,
    library: Array.from(libraryMap.values()),
  };
}

// ============================================================================
// 5. 音乐库管理
// ============================================================================

/**
 * 获取完整音乐库(三层合并)
 *
 * 返回 HOT_CHART_2026 的浅拷贝数组(便于上层修改不影响常量)。
 *
 * @returns 30 首三层合并的歌曲数组
 */
export function createMusicLibrary(): Song[] {
  return HOT_CHART_2026.map((song) => ({ ...song }));
}

/**
 * 按层获取歌曲
 *
 * @param library 音乐库(只读)
 * @param layer 音乐库层:'hot' | 'emotion' | 'fallback'
 * @returns 该层的所有歌曲
 */
export function getSongsByLayer(library: readonly Song[], layer: MusicLayer): Song[] {
  return library.filter((song) => song.layer === layer);
}

/**
 * 按 V-A 距离过滤
 *
 * 返回与 center 的欧氏距离 ≤ maxDistance 的歌曲,按距离升序排列。
 *
 * @param library 音乐库(只读)
 * @param center V-A 中心坐标
 * @param maxDistance 最大欧氏距离(0 ~ √2 ≈ 1.414)
 * @returns 距离内的歌曲数组(升序)
 */
export function filterByVADistance(
  library: readonly Song[],
  center: VACoordinate,
  maxDistance: number,
): Song[] {
  return library
    .map((song) => ({ song, distance: vaDistance(song.va, center) }))
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.song);
}

/**
 * 按风格过滤
 *
 * 返回包含任意一个指定风格标签的歌曲(OR 语义)。
 * 若 genres 为空数组,返回全部歌曲(无过滤)。
 *
 * @param library 音乐库(只读)
 * @param genres 风格标签列表(任一命中即入选)
 * @returns 命中风格的歌曲数组
 */
export function filterByGenre(library: readonly Song[], genres: GenreTag[]): Song[] {
  if (genres.length === 0) {
    return [...library];
  }
  const genreSet = new Set(genres);
  return library.filter((song) => song.genres.some((g) => genreSet.has(g)));
}

/** 音乐库统计结果 */
export interface LibraryStats {
  /** 歌曲总数 */
  total: number;
  /** 按层统计 */
  byLayer: Record<MusicLayer, number>;
  /** 按风格统计(部分映射,仅含出现的风格) */
  byGenre: Partial<Record<GenreTag, number>>;
  /** 按语言统计(部分映射) */
  byLanguage: Partial<Record<LanguageTag, number>>;
  /** V-A 坐标覆盖范围 */
  vaCoverage: { vRange: [number, number]; aRange: [number, number] };
}

/**
 * 统计音乐库信息
 *
 * 输出:总数 / 按层 / 按风格 / 按语言 / V-A 覆盖范围。
 * 空库的 vaCoverage 返回 [0, 0] 范围。
 *
 * @param library 音乐库(只读)
 * @returns 统计结果
 */
export function getLibraryStats(library: readonly Song[]): LibraryStats {
  const byLayer: Record<MusicLayer, number> = { hot: 0, emotion: 0, fallback: 0 };
  const byGenre: Partial<Record<GenreTag, number>> = {};
  const byLanguage: Partial<Record<LanguageTag, number>> = {};

  let vMin = Infinity;
  let vMax = -Infinity;
  let aMin = Infinity;
  let aMax = -Infinity;

  for (const song of library) {
    // 按层
    byLayer[song.layer]++;

    // 按风格
    for (const g of song.genres) {
      byGenre[g] = (byGenre[g] ?? 0) + 1;
    }

    // 按语言
    byLanguage[song.language] = (byLanguage[song.language] ?? 0) + 1;

    // V-A 覆盖范围
    if (song.va.v < vMin) vMin = song.va.v;
    if (song.va.v > vMax) vMax = song.va.v;
    if (song.va.a < aMin) aMin = song.va.a;
    if (song.va.a > aMax) aMax = song.va.a;
  }

  const vaCoverage =
    library.length === 0
      ? { vRange: [0, 0] as [number, number], aRange: [0, 0] as [number, number] }
      : {
          vRange: [vMin, vMax] as [number, number],
          aRange: [aMin, aMax] as [number, number],
        };

  return {
    total: library.length,
    byLayer,
    byGenre,
    byLanguage,
    vaCoverage,
  };
}
