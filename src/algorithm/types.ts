/**
 * Momentune 算法模块 - 类型定义
 *
 * 设计原则:
 * - 严格 TypeScript,无 any
 * - 所有数值坐标用 VACoordinate,避免散落 tuple
 * - 枚举用字面量联合类型,便于序列化与跨层传递
 * - 配置与逻辑分离:类型在此,常量在 config/
 *
 * @module algorithm/types
 */

// ============================================================================
// 1. 情绪坐标系
// ============================================================================

/** Valence 效价:0.0 消极 → 1.0 积极 */
export type Valence = number;

/** Arousal 唤醒度:0.0 平静 → 1.0 高能 */
export type Arousal = number;

/** V-A 二维情绪坐标 */
export interface VACoordinate {
  v: Valence;
  a: Arousal;
}

/**
 * 71 种细分情绪标签(中文|英文双标签)
 *
 * 来源:Valence-Arousal 模型 + GEMS(Geneva Emotional Music Scale)+ 中国古典文学情绪 + 抖音/汽水音乐 2024-2025 热词 + 业务校准
 * GEMS 9 维:Wonder/Transcendence/Tenderness/Nostalgia/Peacefulness/Power/Joyful Activation/Tension/Sadness
 *
 * 扩展路径:
 *  - 16 基础标签(V-A 模型核心)
 *  - +4 GEMS 补全(Wonder/Transcendence/Tenderness/Power)
 *  - +8 复合/细分(Hopeful/Bittersweet/Serene/Sentimental/Cozy/Mysterious/Whimsical/Yearning)
 *  - +5 中国古典文化情绪(Wistful惆怅/Zen禅意/Heroic豪迈/PartingSorrow离愁/Smitten倾心)
 *  - +3 GEMS-25 学术子项(Awe敬畏/Triumphant凯旋/Inspired灵感迸发)
 *  - +3 音乐特有情绪(Groove律动/Ethereal仙气/Hype燃场)
 *  - +3 抖音/汽水音乐平台热词(Overwhelmed破防/Resonant共鸣/Masterpiece封神)
 *  - +5 中国古典文化情绪补充(Wanderer羁旅/Ambitious壮志/TragicHeroic悲壮/Leisurely闲适/Lovesick相思)
 *  - +3 GEMS-25 剩余子项(Solemnity庄重/Spiritual灵性/Activation激活)
 *  - +3 音乐特有情绪补充(Anthemic颂歌感/Hypnotic催眠/Aggressive侵略性)
 *  - +3 抖音/网络热词补充(Addicted上头/EmoNight emo夜/Vibes氛围感)
 *  - +7 第 5 轮填补 V-A 空间空白(AbstractBanger抽象魔性/SensualNeon霓虹暧昧/Cinematic电影感/EtherealJoy飘飘然/Playful调皮/Brooding郁结/TriumphantJoy胜利喜悦)
 *  - +8 第 6 轮填补 V-A 极端区域空白(Despair绝望/Desolate荒凉/Rage暴怒/Panic恐慌/Euphoric狂喜/Exhilarating酣畅/Burnout摆烂/TearJerker泪目)
 */
export const EMOTION_LABELS = [
  // —— 原有 16 标签 ——
  'Exciting', // 兴奋
  'Joyful', // 欢快
  'Romantic', // 浪漫
  'Fresh', // 清新
  'Healing', // 治愈
  'Relaxing', // 放松
  'Peaceful', // 宁静
  'Touching', // 感动
  'Nostalgic', // 怀旧
  'Missing', // 思念
  'Lonely', // 孤独
  'Melancholic', // 忧郁
  'Tense', // 紧张
  'Epic', // 燃
  'Dark', // 暗黑
  'Dreamy', // 梦幻
  // —— GEMS 新增 4 标签 ——
  'Wonder', // 惊叹 (GEMS: Wonder)
  'Transcendence', // 超然 (GEMS: Transcendence)
  'Tenderness', // 柔情 (GEMS: Tenderness)
  'Power', // 力量 (GEMS: Power)
  // —— 复合/细分新增 8 标签 ——
  'Hopeful', // 希望 (积极+期待)
  'Bittersweet', // 苦甜 (积极+悲伤复合)
  'Serene', // 空灵 (比 Peaceful 更极致)
  'Sentimental', // 感伤 (比 Nostalgic 更柔)
  'Cozy', // 温馨 (室内小确幸)
  'Mysterious', // 神秘 (比 Dreamy 更暗)
  'Whimsical', // 俏皮 (比 Joyful 更轻快)
  'Yearning', // 渴望 (比 Missing 更主动)
  // —— 中国古典文化情绪新增 5 标签 ——
  'Wistful', // 惆怅 (落花流年式苦甜参半,比 Nostalgic 更涩)
  'Zen', // 禅意 (物我两忘的超然止水,全系统最低唤醒)
  'Heroic', // 豪迈 (个人化英气勃发,比 Epic 更"我")
  'PartingSorrow', // 离愁 (长亭送别式带主动思念的离别痛)
  'Smitten', // 倾心 (瞬间迷恋爆发,对应"一整个爱住")
  // —— GEMS-25 学术子项新增 3 标签 ——
  'Awe', // 敬畏 (面对壮美自然/神作的崇高震颤)
  'Triumphant', // 凯旋 (胜利登顶的极致荣光,全系统最高效价)
  'Inspired', // 灵感迸发 (被作品点亮、想立刻创造)
  // —— 音乐特有情绪新增 3 标签 ——
  'Groove', // 律动 (身体不自觉跟着打拍子的快感)
  'Ethereal', // 仙气 (空灵飘渺的非人间感,比 Dreamy 更冷)
  'Hype', // 燃场 (副歌前的鼓点蓄势,全系统最高唤醒)
  // —— 抖音/汽水音乐平台热词新增 3 标签 ——
  'Overwhelmed', // 破防 (被一句词/一个音击穿心理防线)
  'Resonant', // 共鸣 ("这首歌写的就是我"的深层身份共振)
  'Masterpiece', // 封神 (对作品级神作的审美震撼)
  // —— 第 4 轮:中国古典文化情绪补充 5 标签 ——
  'Wanderer', // 羁旅 (客居他乡的漂泊感,比 Lonely 更有空间纵深感)
  'Ambitious', // 壮志 (抱负远大的昂扬,比 Heroic 更面向未来)
  'TragicHeroic', // 悲壮 (知其不可为而为之,高唤醒但带悲色)
  'Leisurely', // 闲适 (无所事事的惬意,比 Cozy 更户外更开阔)
  'Lovesick', // 相思 (比 Missing 更缠绵更主动,衣带渐宽式)
  // —— 第 4 轮:GEMS-25 剩余子项 3 标签 ——
  'Solemnity', // 庄重 (严肃庄重,比 Peaceful 更正式更沉)
  'Spiritual', // 灵性 (超脱精神性,比 Transcendence 更宗教感)
  'Activation', // 激活 (能量涌动,比 Joyful 更偏生理性兴奋)
  // —— 第 4 轮:音乐特有情绪补充 3 标签 ——
  'Anthemic', // 颂歌感 (大合唱的集体升华感,比 Epic 更群体性)
  'Hypnotic', // 催眠 (重复性律动的沉浸感,比 Groove 更内化)
  'Aggressive', // 侵略性 (攻击性强的宣泄,比 Tense 更主动更外放)
  // —— 第 4 轮:抖音/网络热词补充 3 标签 ——
  'Addicted', // 上头 (单曲循环停不下来,比 Smitten 更偏作品依赖)
  'EmoNight', // emo夜 (夜间矫情自怜,比 Melancholic 更场景化)
  'Vibes', // 氛围感 (模糊但正面的氛围,比 Dreamy 更口语化更轻松)
  // —— 第 5 轮:填补 V-A 空间空白 7 标签(精心设计坐标避免过密,CRITIQUE 后调整) ——
  'AbstractBanger', // 抽象魔性 (抖音发疯 BGM,填补中 V 极高 A 空白)
  'SensualNeon', // 霓虹暧昧 (夜店 phonk/赛博,填补中 V 中高 A 空白)
  'Cinematic', // 电影感 (史诗配乐/影视 OST,填补中 V 中 A 空白)
  'EtherealJoy', // 飘飘然 (轻飘飘的喜悦,填补高 V 低 A 空白)
  'Playful', // 调皮 (童趣俏皮,填补极高 V 中 A 空白)
  'Brooding', // 郁结 (闷闷不乐的郁结感,填补低 V 中 A 空白)
  'TriumphantJoy', // 胜利喜悦 (夺冠狂喜,填补极高 V 中高 A 空白)
  // —— 第 6 轮:填补 V-A 极端区域空白 8 标签(扩大覆盖面,精心设计坐标避免过密) ——
  'Despair', // 绝望 (极低 V 低 A,无路可走的死寂,比 Brooding 更底更静)
  'Desolate', // 荒凉 (低 V 极低 A,废墟旷野的苍茫感,填补极低 A 空白)
  'Rage', // 暴怒 (极低 V 极高 A,全系统最高 A,失控的毁灭冲动)
  'Panic', // 恐慌 (低 V 中高 A,恐惧爆发,比 Tense 更极致的惊恐)
  'Euphoric', // 狂喜 (极高 V 极高 A,身体性极致亢奋,填补右上角空白)
  'Exhilarating', // 酣畅 (极高 V 中高 A,尽兴痛快的释放,比 Exciting 略低 A)
  'Burnout', // 摆烂 (中低 V 极低 A,当代青年"不挣扎了"的状态)
  'TearJerker', // 泪目 (中低 V 中高 A,瞬间被戳中泪水涌出,比 Touching 更突然)
] as const;

export type EmotionLabel = (typeof EMOTION_LABELS)[number];

/** 带置信度的 V-A 坐标 */
export interface VAWithConfidence extends VACoordinate {
  /** 置信度 0-1,低置信度在匹配时会被惩罚 */
  confidence: number;
  /** 标注来源 */
  source: VASource;
}

/** V-A 标注来源(影响 confidence 默认值) */
export type VASource =
  | 'visual_model' // 视觉模型直接输出
  | 'feature_fusion' // 8 特征融合(本算法)
  | 'gps_fusion' // GPS 辅助融合
  | 'netease_tag' // 网易云标签映射
  | 'spotify_feature' // Spotify valence/energy
  | 'audio_regression' // 音频回归模型(方法 A)
  | 'heuristic_formula' // 启发式公式(方法 B)
  | 'metadata_keyword' // 元数据关键词(方法 C)
  | 'manual' // 人工标注
  | 'fallback_default'; // 兜底默认值

// ============================================================================
// 2. 照片特征 - 视觉模型输出
// ============================================================================

/** 场景类型(24 类,原 18 类 + 第 4 轮新增 6 类自然/人文细类) */
export const SCENE_TYPES = [
  'nature', // 自然风光
  'city', // 城市街景
  'indoor', // 室内
  'people', // 人物
  'food', // 美食
  'architecture', // 建筑
  'heritage', // 古迹
  // —— 第 2 轮新增 5 类 ——
  'sports', // 运动场景(球场/健身房/户外运动)
  'vehicle', // 车辆交通(车内/公路/车站)
  'pet', // 宠物动物
  'art', // 艺术文化(画作/雕塑/展览)
  'sky', // 天空云朵(纯天空/日月星辰)
  // —— 第 3 轮新增 6 类(自然地貌 + 文化空间细分) ——
  'beach', // 海滩(沙滩/海岸/浪花)
  'mountain', // 山脉(山顶/山间/徒步)
  'forest', // 森林(树林/竹林/湿地)
  'museum', // 博物馆(展览馆/美术馆/科技馆)
  'street', // 街道(巷弄/市集/街区)
  'nightlife', // 夜生活(酒吧/夜店/夜市)
  // —— 第 4 轮新增 6 类(自然地貌细分 + 人文空间) ——
  'park', // 公园(城市公园/街心花园/植物园)
  'garden', // 花园(私家花园/花卉展览/温室)
  'lake', // 湖泊(湖边/水库/池塘)
  'bridge', // 桥梁(天桥/立交/古桥/跨海桥)
  'temple', // 寺庙(佛寺/道观/教堂/清真寺)
  'snow', // 雪景(积雪/雪山/冰挂/雪人)
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

/** 时段(13 类,原 9 类 + 第 4 轮新增 4 类) */
export const TIME_OF_DAY = [
  'dawn', // 黎明(5-6 点)
  'early_morning', // 清晨(6-8 点,第 4 轮新增)
  'morning', // 上午(8-11 点)
  'noon', // 正午(11-13 点)
  'afternoon', // 下午(13-16 点,第 4 轮新增)
  'daytime', // 白天泛指(16-18 点)
  'golden_hour', // 黄金时刻(日落前 1 小时)
  'dusk', // 黄昏(日落)
  'blue_hour', // 蓝调时刻(日落后 30 分钟)
  'evening', // 傍晚(19-21 点,第 4 轮新增)
  'night', // 夜晚(21-23 点)
  'late_night', // 深夜(0-2 点,第 4 轮新增)
  'midnight', // 午夜(2-5 点)
] as const;
export type TimeOfDay = (typeof TIME_OF_DAY)[number];

/** 天气(14 类,原 11 类 + 第 4 轮新增 3 类) */
export const WEATHER_TYPES = [
  'sunny', // 晴天
  'cloudy', // 多云
  'overcast', // 阴天
  'rainy', // 雨天
  'drizzle', // 毛毛雨(比 rainy 更柔)
  'thunderstorm', // 雷暴
  'snowy', // 雪天
  'foggy', // 雾天
  'haze', // 霾
  'breezy', // 微风(轻快)
  'starry', // 星空(夜晚晴朗)
  // —— 第 4 轮新增 3 类 ——
  'humid', // 闷热(高湿度低风速,压抑感)
  'windy', // 大风(比 breezy 更强烈,有动感)
  'sleet', // 雨夹雪(过渡天气,冷冽)
] as const;
export type Weather = (typeof WEATHER_TYPES)[number];

/** 色调(3 类) */
export const TONE_TYPES = ['warm', 'cool', 'neutral'] as const;
export type Tone = (typeof TONE_TYPES)[number];

/** 明暗调性(3 类) */
export const BRIGHTNESS_LEVELS = ['high', 'mid', 'low'] as const;
export type BrightnessLevel = (typeof BRIGHTNESS_LEVELS)[number];

/** 饱和度等级(3 类) */
export const SATURATION_LEVELS = ['high', 'mid', 'low'] as const;
export type SaturationLevel = (typeof SATURATION_LEVELS)[number];

/** 构图类型(15 类,原 11 类 + 第 4 轮新增 4 类摄影技法) */
export const COMPOSITION_TYPES = [
  'closeup', // 特写
  'portrait', // 人像
  'subject', // 主体
  'landscape', // 风景
  'panorama', // 全景
  'symmetry', // 对称构图
  'aerial', // 航拍俯视
  // —— 第 3 轮新增 4 类(摄影技法) ——
  'rule_of_thirds', // 三分法(经典构图,平衡)
  'silhouette', // 剪影(高对比,戏剧性)
  'bokeh', // 散景(浅景深,梦幻柔焦)
  'negative_space', // 留白(极简,空灵)
  // —— 第 4 轮新增 4 类(进阶摄影技法) ——
  'leading_lines', // 引导线(道路/河流/栏杆引导视线)
  'golden_ratio', // 黄金螺旋(美学黄金比例构图)
  'framing', // 框架构图(门窗/树枝/拱门框住主体)
  'centered', // 居中构图(主体正中,庄重对称)
] as const;
export type Composition = (typeof COMPOSITION_TYPES)[number];

/** 人物表情(20 类,原 14 类 + 第 4 轮新增 6 类) */
export const FACE_EMOTIONS = [
  'smile', // 笑脸
  'neutral', // 中性
  'sad', // 悲伤
  'excited', // 兴奋
  'surprised', // 惊讶
  'thoughtful', // 沉思
  'focused', // 专注
  'none', // 无人或未识别
  // —— 第 3 轮新增 6 类(更细表情) ——
  'laughing', // 大笑(比 smile 更强烈)
  'crying', // 哭泣(比 sad 更极致)
  'angry', // 愤怒(负面高唤醒)
  'in_love', // 恋爱中(甜蜜迷恋)
  'proud', // 自豪(成就感)
  'calm', // 平静(安详)
  // —— 第 4 轮新增 6 类(更丰富表情) ——
  'bored', // 无聊(低唤醒轻度消极)
  'determined', // 坚定(目标明确的决心)
  'shy', // 害羞(腼腆不好意思)
  'grateful', // 感恩(被温暖后的感激)
  'content', // 满足(安详的愉悦,比 calm 更正面)
  'confused', // 困惑(迷茫不确定)
] as const;
export type FaceEmotion = (typeof FACE_EMOTIONS)[number];

/** 人物信息 */
export interface PeopleInfo {
  /** 检测到的人数(0 表示无人) */
  count: number;
  /** 主导表情(多人时取最显著) */
  dominantEmotion: FaceEmotion;
  /** 检测置信度 */
  confidence: number;
}

/** 主色调信息(HSV) */
export interface HueInfo {
  /** 主导色 hue 角度 0-360 */
  hue: number;
  /** 暖/冷/中性分类 */
  tone: Tone;
  /** 分类置信度 */
  confidence: number;
}

/**
 * 照片视觉特征(视觉模型输出)
 * 8 个维度,每个带置信度
 *
 * 对应算法设计文档「第 1 部分:照片→V-A 坐标映射」
 */
export interface PhotoFeatures {
  /** F1 主色调 */
  hue: HueInfo;
  /** F2 亮度 0-1(归一化灰度均值) */
  luminance: {
    value: number; // 0-1
    level: BrightnessLevel;
    confidence: number;
  };
  /** F3 饱和度 0-1 */
  saturation: {
    value: number; // 0-1
    level: SaturationLevel;
    confidence: number;
  };
  /** F4 场景类型 */
  scene: {
    type: SceneType;
    confidence: number;
  };
  /** F5 时段(可由 EXIF 时间补充) */
  timeOfDay: {
    value: TimeOfDay;
    confidence: number;
  };
  /** F6 天气 */
  weather: {
    value: Weather;
    confidence: number;
  };
  /** F7 人物 */
  people: PeopleInfo;
  /** F8 构图 */
  composition: {
    type: Composition;
    confidence: number;
  };
  /** 整体置信度(各特征置信度加权均值) */
  overallConfidence: number;
}

// ============================================================================
// 3. GPS 与 POI
// ============================================================================

/** GPS 坐标 */
export interface GPSCoordinate {
  lat: number;
  lng: number;
  /** 定位精度(米) */
  accuracy?: number;
}

/** 高德 POI 类型码(部分关键分类) */
export interface POIInfo {
  /** POI 名称,如"故宫博物院" */
  name: string;
  /** 高德类型码,如 "110100" */
  typeCode: string;
  /** 一级分类名,如"风景名胜" */
  category: string;
  /** 行政区,如"北京市东城区" */
  district?: string;
}

/** GPS 反查结果 */
export interface GPSReverseResult {
  coordinate: GPSCoordinate;
  poi: POIInfo;
  /** 反查服务来源 */
  provider: 'amap' | 'tencent' | 'osm';
  /** 该 POI 映射到的场景类型(若可识别) */
  mappedScene?: SceneType;
  /** GPS 给出的 V-A 坐标(由场景映射表查得) */
  mappedVA?: VACoordinate;
  /** 映射置信度 */
  confidence: number;
  /** 命中的具体地点音乐映射(城市/地标级,若匹配到 locationMusicMap) */
  locationMusic?: {
    /** 命中的地点条目(含代表歌曲/风格偏好) */
    location?: unknown;
    /** 命中的场所类型(咖啡馆/书店等细类) */
    venue?: unknown;
  };
}

// ============================================================================
// 4. 音乐相关
// ============================================================================

/** 音乐库层(影响 hot_boost) */
export const MUSIC_LAYERS = [
  'hot', // 热歌层:抖音/汽水/网易云榜单
  'emotion', // 情绪层:emo163 / Spotify
  'fallback', // 兜底层:免版权
] as const;
export type MusicLayer = (typeof MUSIC_LAYERS)[number];

/** 热歌新鲜度等级(基于上榜时间) */
export const HOT_RECENCY = [
  'this_week', // 本周上榜
  'this_month', // 近 1 月
  'half_year', // 近 6 月
  'older', // 更早
  'never', // 未上过榜
] as const;
export type HotRecency = (typeof HOT_RECENCY)[number];

/** 音乐风格标签(60 标签,按 10 组分类,参考 QQ音乐/网易云/汽水音乐 2026 界面) */
export const GENRE_TAGS = [
  // ── 说唱 ──
  'rap', // 说唱
  'trap', // 陷阱说唱
  'drill', // Drill
  // ── 电子 ──
  'electronic', // 电子
  'house', // 浩室
  'techno', // Techno
  'trance', // Trance
  'drumandbass', // Drum & Bass
  'ukgarage', // UK Garage
  'edm', // EDM舞曲
  'synthwave', // Synthwave
  'hardwave', // Hardwave
  'futurebass', // Future Bass
  'vaporwave', // Vaporwave
  'phonk', // Phonk
  'driftphonk', // Drift Phonk
  // ── R&B/灵魂 ──
  'rnb', // R&B
  'soul', // 灵魂乐
  'funk', // 放克
  'disco', // 迪斯科
  // ── 流行 ──
  'pop', // 流行
  'kpop', // K-Pop
  'jpop', // J-Pop
  'hyperpop', // Hyperpop
  'bedroompop', // 卧室流行
  'citypop', // City Pop
  // ── 国风 ──
  'guofeng', // 国风
  'gufeng', // 古风
  'xiqiang', // 戏腔
  'guofengrock', // 国风摇滚
  // ── 摇滚/独立 ──
  'rock', // 摇滚
  'indie', // 独立
  'metal', // 金属
  'punk', // 朋克
  'poppunk', // 流行朋克
  'emo', // Emo
  'postpunk', // 后朋克
  'shoegaze', // 盯鞋
  'dreampop', // 梦泡
  // ── 轻音乐/氛围/古典 ──
  'ambient', // 氛围
  'lofi', // Lo-Fi
  'dreamcore', // 梦核
  'classical', // 古典
  'jazz', // 爵士
  'acoustic', // 原声
  'choir', // 合唱
  // ── 拉丁/非洲/雷鬼 ──
  'reggae', // 雷鬼
  'reggaeton', // Reggaeton
  'dembow', // Dembow
  'afrobeats', // Afrobeats
  'amapiano', // Amapiano
  'bachata', // Bachata
  'world', // 世界音乐
  // ── 二次元/ACG/影视 ──
  'anime', // 动漫
  'vocaloid', // Vocaloid
  'soundtrack', // 影视配乐
  // ── 民谣/乡村/根源 ──
  'folk', // 民谣
  'country', // 乡村
  'blues', // 布鲁斯
  // ── 其他 ──
  'other', // 其他
] as const;
export type GenreTag = (typeof GENRE_TAGS)[number];

/** 风格标签展示元数据(前端渲染用) */
export interface GenreDisplayMeta {
  /** 中文显示名 */
  label: string;
  /** 父分组 ID */
  group: string;
  /** 一句话描述 */
  desc: string;
  /** 热度标签(1-5,5=当前最火) */
  hot: number;
}

/** 10 个风格分组(前端展示层级) */
export const GENRE_GROUPS = [
  { id: 'rap', label: '说唱' },
  { id: 'electronic', label: '电子' },
  { id: 'rnb', label: 'R&B/灵魂' },
  { id: 'pop', label: '流行' },
  { id: 'guofeng', label: '国风' },
  { id: 'rock_indie', label: '摇滚/独立' },
  { id: 'ambient_classical', label: '轻音乐/氛围' },
  { id: 'latin_afro', label: '拉丁/非洲' },
  { id: 'acg', label: '二次元/ACG' },
  { id: 'folk_country', label: '民谣/乡村' },
] as const;

/** 风格标签 → 展示元数据映射(60 条目) */
export const GENRE_DISPLAY_META: Record<GenreTag, GenreDisplayMeta> = {
  // ── 说唱 ──
  rap: { label: '说唱', group: 'rap', desc: 'Hip-Hop/中文说唱', hot: 5 },
  trap: { label: 'Trap', group: 'rap', desc: '808鼓机+hi-hat三连音', hot: 4 },
  drill: { label: 'Drill', group: 'rap', desc: '暗黑滑音街头说唱', hot: 4 },
  // ── 电子 ──
  electronic: { label: '电子', group: 'electronic', desc: '合成器/电子音乐', hot: 4 },
  house: { label: '浩室', group: 'electronic', desc: '4/4拍律动舞曲', hot: 3 },
  techno: { label: 'Techno', group: 'electronic', desc: '工业底特律电子', hot: 3 },
  trance: { label: 'Trance', group: 'electronic', desc: '旋律升华出神舞曲', hot: 3 },
  drumandbass: { label: 'Drum & Bass', group: 'electronic', desc: '170BPM碎拍', hot: 3 },
  ukgarage: { label: 'UK Garage', group: 'electronic', desc: '2-step英式车库', hot: 3 },
  edm: { label: 'EDM舞曲', group: 'electronic', desc: '大场电子舞曲', hot: 4 },
  synthwave: { label: 'Synthwave', group: 'electronic', desc: '80s霓虹复古电子', hot: 4 },
  hardwave: { label: 'Hardwave', group: 'electronic', desc: '电影感赛博电子', hot: 4 },
  futurebass: { label: 'Future Bass', group: 'electronic', desc: '和声切分电子', hot: 3 },
  vaporwave: { label: 'Vaporwave', group: 'electronic', desc: '蒸汽波降速采样', hot: 3 },
  phonk: { label: 'Phonk', group: 'electronic', desc: '失真808+牛铃漂移', hot: 5 },
  driftphonk: { label: 'Drift Phonk', group: 'electronic', desc: '高BPM漂移电音', hot: 5 },
  // ── R&B/灵魂 ──
  rnb: { label: 'R&B', group: 'rnb', desc: '节奏布鲁斯', hot: 4 },
  soul: { label: '灵魂乐', group: 'rnb', desc: 'Soul/Neo-Soul', hot: 3 },
  funk: { label: '放克', group: 'rnb', desc: '律动感Funk', hot: 2 },
  disco: { label: '迪斯科', group: 'rnb', desc: '复古Disco', hot: 2 },
  // ── 流行 ──
  pop: { label: '流行', group: 'pop', desc: '华语/欧美流行', hot: 5 },
  kpop: { label: 'K-Pop', group: 'pop', desc: '韩流偶像', hot: 5 },
  jpop: { label: 'J-Pop', group: 'pop', desc: '日系流行', hot: 4 },
  hyperpop: { label: 'Hyperpop', group: 'pop', desc: '失真人声+glitch', hot: 4 },
  bedroompop: { label: '卧室流行', group: 'pop', desc: 'DIY卧室质感', hot: 4 },
  citypop: { label: 'City Pop', group: 'pop', desc: '80s日式复古', hot: 4 },
  // ── 国风 ──
  guofeng: { label: '国风', group: 'guofeng', desc: '中国风流行', hot: 5 },
  gufeng: { label: '古风', group: 'guofeng', desc: '五声音阶真古法', hot: 4 },
  xiqiang: { label: '戏腔', group: 'guofeng', desc: '戏曲发声融入流行', hot: 4 },
  guofengrock: { label: '国风摇滚', group: 'guofeng', desc: '民乐+摇滚融合', hot: 3 },
  // ── 摇滚/独立 ──
  rock: { label: '摇滚', group: 'rock_indie', desc: '经典摇滚', hot: 3 },
  indie: { label: '独立', group: 'rock_indie', desc: '独立/另类', hot: 4 },
  metal: { label: '金属', group: 'rock_indie', desc: '重金属/激流', hot: 2 },
  punk: { label: '朋克', group: 'rock_indie', desc: 'Punk摇滚', hot: 2 },
  poppunk: { label: '流行朋克', group: 'rock_indie', desc: 'MCR/AVC复兴', hot: 4 },
  emo: { label: 'Emo', group: 'rock_indie', desc: 'Midwest Emo复兴', hot: 4 },
  postpunk: { label: '后朋克', group: 'rock_indie', desc: '冷峻bassline', hot: 3 },
  shoegaze: { label: '盯鞋', group: 'rock_indie', desc: '音墙混响迷幻', hot: 3 },
  dreampop: { label: '梦泡', group: 'rock_indie', desc: '飘渺人声+混响', hot: 3 },
  // ── 轻音乐/氛围/古典 ──
  ambient: { label: '氛围', group: 'ambient_classical', desc: '环境音乐', hot: 3 },
  lofi: { label: 'Lo-Fi', group: 'ambient_classical', desc: '低保真放松', hot: 4 },
  dreamcore: { label: '梦核', group: 'ambient_classical', desc: '超现实梦幻', hot: 3 },
  classical: { label: '古典', group: 'ambient_classical', desc: '古典交响', hot: 2 },
  jazz: { label: '爵士', group: 'ambient_classical', desc: 'Jazz/摇摆', hot: 2 },
  acoustic: { label: '原声', group: 'ambient_classical', desc: '不插电纯人声', hot: 3 },
  choir: { label: '合唱', group: 'ambient_classical', desc: '人声合唱团', hot: 1 },
  // ── 拉丁/非洲/雷鬼 ──
  reggae: { label: '雷鬼', group: 'latin_afro', desc: '牙买加雷鬼', hot: 2 },
  reggaeton: { label: 'Reggaeton', group: 'latin_afro', desc: '拉丁节奏流行', hot: 5 },
  dembow: { label: 'Dembow', group: 'latin_afro', desc: '多米尼加节奏', hot: 4 },
  afrobeats: { label: 'Afrobeats', group: 'latin_afro', desc: '西非流行舞曲', hot: 5 },
  amapiano: { label: 'Amapiano', group: 'latin_afro', desc: '南非深层浩室', hot: 4 },
  bachata: { label: 'Bachata', group: 'latin_afro', desc: '多米尼加浪漫吉他', hot: 3 },
  world: { label: '世界音乐', group: 'latin_afro', desc: '非洲/拉丁/印度', hot: 2 },
  // ── 二次元/ACG/影视 ──
  anime: { label: '动漫', group: 'acg', desc: '动漫原声/OP/ED', hot: 5 },
  vocaloid: { label: 'Vocaloid', group: 'acg', desc: '虚拟人声/初音/洛天依', hot: 4 },
  soundtrack: { label: '影视配乐', group: 'acg', desc: 'OST/游戏配乐', hot: 3 },
  // ── 民谣/乡村/根源 ──
  folk: { label: '民谣', group: 'folk_country', desc: '城市/独立民谣', hot: 4 },
  country: { label: '乡村', group: 'folk_country', desc: '美式乡村', hot: 2 },
  blues: { label: '布鲁斯', group: 'folk_country', desc: '蓝调根源', hot: 2 },
  // ── 其他 ──
  other: { label: '其他', group: 'folk_country', desc: '其他风格', hot: 1 },
} as const;

/** 语言标签 */
export const LANGUAGE_TAGS = [
  'mandarin', // 华语
  'english', // 欧美
  'korean', // 韩语
  'japanese', // 日语
  'cantonese', // 粤语
  'instrumental', // 纯音乐
  'other', // 其他
] as const;
export type LanguageTag = (typeof LANGUAGE_TAGS)[number];

/** 网易云 12 种情绪标签(emo163 数据集) */
export const NETEASE_EMOTION_TAGS = [
  'Exciting',
  'Joyful',
  'Romantic',
  'Fresh',
  'Healing',
  'Relaxing',
  'Peaceful',
  'Touching',
  'Nostalgic',
  'Melancholic',
  'Lonely',
  'Missing',
] as const;
export type NeteaseEmotionTag = (typeof NETEASE_EMOTION_TAGS)[number];

/** Spotify 音频特征 */
export interface SpotifyAudioFeatures {
  valence: number; // 0-1
  energy: number; // 0-1
  tempo: number; // BPM
  loudness: number; // dB,通常 -30 ~ 0
  mode: 0 | 1; // 0=小调, 1=大调
  danceability: number; // 0-1
  acousticness: number; // 0-1
  instrumentalness: number; // 0-1
}

/** 歌曲场景标签(用于 score_scene,77 类,原 36 + 第4轮 +12 + 第5轮 +17 生活叙事 + 第6轮 +12 日常高频) */
export const SONG_SCENE_TAGS = [
  'travel', // 旅行
  'city_night', // 城市夜景
  'seaside_dusk', // 海边/黄昏
  'campus', // 校园
  'party', // 聚会
  'guofeng', // 古风
  'late_night_emo', // 深夜emo
  'road_trip', // 公路旅行
  'morning_sunrise', // 日出山顶
  'rainy_window', // 雨天窗边
  'cafe_afternoon', // 咖啡店下午
  'general', // 通用
  // —— 第 2 轮新增 12 类(季节/活动/生活场景) ——
  'summer_beach', // 夏日海滩
  'winter_snow', // 冬日雪景
  'spring_bloom', // 春日花季
  'autumn_leaves', // 秋日落叶
  'festival', // 节日庆典
  'wedding', // 婚礼
  'workout', // 运动健身
  'meditation', // 冥想静修
  'commute', // 通勤路上
  'sleep', // 睡眠放松
  'reading', // 阅读时光
  'rooftop_sunset', // 屋顶日落
  // —— 第 3 轮新增 12 类(生活叙事/人生节点/氛围场景) ——
  'graduation', // 毕业(青春节点)
  'breakup', // 分手(情感低谷)
  'night_drive', // 夜间驾驶(独自开车)
  'campfire', // 篝火(户外夜晚)
  'library', // 图书馆(安静专注)
  'airport', // 机场(离别/重逢)
  'train_window', // 火车窗边(旅途思绪)
  'beach_bonfire', // 海滩篝火(夏日夜晚)
  'mountain_top', // 山顶(登顶壮阔)
  'wine_night', // 微醺夜晚(独酌/二人世界)
  'morning_coffee', // 晨间咖啡(一天开始)
  'afterparty', // 派对后(散场余韵)
  // —— 第 4 轮新增 12 类(人生节点/日常场景/天气氛围) ——
  'first_date', // 初次约会(心动紧张)
  'birthday', // 生日(庆祝节点)
  'moving', // 搬家(人生转折)
  'study_focus', // 专注学习(深度心流)
  'workout_cardio', // 有氧训练(高强度燃脂)
  'workout_yoga', // 瑜伽冥想(身心平衡)
  'commute_morning', // 早高峰通勤(赶路)
  'commute_evening', // 晚高峰通勤(疲惫归途)
  'rainy_day', // 雨天(室内听雨)
  'snowy_day', // 雪天(室外赏雪)
  'stargazing', // 观星(仰望星空)
  'night_run', // 夜跑(城市夜间运动)
  // —— 第 5 轮新增 17 类(抖音/小红书高频生活叙事场景) ——
  'overtime_healing', // 加班治愈(深夜办公/解压)
  'gym_breakthrough', // 健身突破(撸铁/力量训练,区别于 workout_cardio)
  'city_walk', // 城市漫步(街头扫街/松弛感)
  'new_love_crush', // 新恋情暧昧(区别于 first_date,更长期)
  'solo_living', // 独居vlog(一个人也要好好生活)
  'summer_fireworks', // 夏夜烟火(区别于 summer_beach,夜间庆典)
  'qixi_valentine', // 七夕情人节(中式浪漫)
  'new_year_countdown', // 跨年倒计时(新年庆典)
  'music_festival', // 音乐节现场(live演出)
  'job_hunting', // 求职考研(逆袭励志)
  'pet_companion', // 宠物陪伴(撸猫遛狗)
  'bathing', // 洗澡时(浴室独处放空)
  'gaming', // 打游戏(电竞/游戏BGM)
  'camping', // 露营(户外白天,区别于 campfire 篝火)
  'autumn_literary', // 秋日文艺(区别于 autumn_leaves,更人文)
  'winter_warm', // 冬日暖屋(室内温暖,区别于 winter_snow 室外)
  'street_snap', // 街头扫街(摄影/纪实)
  // —— 第 6 轮新增 12 类(抖音/小红书高频日常场景,覆盖烹饪/户外/情感节点) ——
  'cooking', // 烹饪下厨(治愈系厨房 vlog)
  'hiking', // 徒步登山(户外运动,区别于 mountain_top 登顶瞬间)
  'morning_run', // 晨跑(一日之始的运动,区别于 night_run)
  'reunion', // 团聚重逢(亲友相聚,区别于 party 聚会)
  'karaoke', // 唱K(KTV 高歌,强社交)
  'confession', // 表白(告白瞬间,高紧张高期待)
  'secret_crush', // 暗恋(心事重重,区别于 new_love_crush 双向暧昧)
  'breakup_recovery', // 失恋恢复(走出阴霾,区别于 breakup 当下)
  'exam_cramming', // 考研冲刺(深夜自习,拼搏励志)
  'autumn_rain', // 秋雨(冷冽萧瑟,区别于 autumn_literary 人文)
  'spring_morning', // 春日清晨(清新苏醒,区别于 spring_bloom 花季)
  'anniversary', // 纪念日(恋爱/结婚周年)
] as const;
export type SongSceneTag = (typeof SONG_SCENE_TAGS)[number];

/**
 * 歌曲对象(算法层使用的最小结构)
 * 工程层可在此基础上扩展(id/cover/url 等)
 */
export interface Song {
  /** 稳定唯一 ID(跨平台) */
  songId: string;
  title: string;
  artist: string;
  /** 音乐库层 */
  layer: MusicLayer;
  /** V-A 坐标(带置信度) */
  va: VAWithConfidence;
  /** 风格标签(可多个) */
  genres: GenreTag[];
  /** 场景标签(可多个) */
  sceneTags: SongSceneTag[];
  /** 语言 */
  language: LanguageTag;
  /** 网易云情绪标签(若来自 emo163) */
  neteaseTags?: NeteaseEmotionTag[];
  /** Spotify 音频特征(若可获取) */
  spotifyFeatures?: SpotifyAudioFeatures;
  /** 热歌新鲜度 */
  hotRecency: HotRecency;
  /** 发布年代(用于相似度计算) */
  decade?: number; // 如 2020 表示 2020s
}

// ============================================================================
// 5. 用户偏好
// ============================================================================

/** 首次问卷 Q3:情绪偏好选项 */
export const MOOD_PREFERENCES = [
  'healing', // 被治愈
  'igniting', // 被点燃
  'accompanying', // 被陪伴
  'empathizing', // 被共情
  'neutral', // 都行
] as const;
export type MoodPreference = (typeof MOOD_PREFERENCES)[number];

/** 音乐平台偏好 */
export const PLATFORM_PREFERENCES = [
  'netease',
  'qq',
  'qishui',
  'other',
] as const;
export type PlatformPreference = (typeof PLATFORM_PREFERENCES)[number];

/** 首次问卷答案 */
export interface OnboardingAnswers {
  /** Q0 年龄段(可选,用于初始偏好指导) */
  ageRange?: 'under18' | '18-22' | '23-27' | '28-35' | '36-45' | '46plus';
  /** Q1 平台偏好 */
  platform: PlatformPreference;
  /** Q2 参考歌曲(2-3 首的 songId 或标题+歌手) */
  referenceSongs: Array<{ songId?: string; title: string; artist: string }>;
  /** Q3 情绪偏好 */
  mood: MoodPreference;
  /** Q4 风格偏好(可多选,空表示不限) */
  genres: GenreTag[];
  /** Q5 语言偏好(可多选,空表示不限) */
  languages: LanguageTag[];
}

/** 风格偏好权重向量 */
export type GenreWeightVector = Record<GenreTag, number>;

/** 语言偏好权重向量 */
export type LanguageWeightVector = Record<LanguageTag, number>;

/**
 * 用户偏好模型
 * 包含首次问卷初始化 + 持续学习状态
 */
export interface UserPreference {
  /** 偏好中心点(V-A 坐标) */
  center: VACoordinate;
  /** 风格偏好权重(0-3,初始 0.3-1.0) */
  genreWeights: GenreWeightVector;
  /** 语言偏好权重 */
  languageWeights: LanguageWeightVector;
  /** 平台偏好 */
  platform: PlatformPreference;
  /** 参考歌曲 ID 列表(用于 score_ref_sim) */
  referenceSongIds: string[];
  /** 情绪偏好锚点 */
  moodAnchor: VACoordinate;
  /** 时段偏好:P(accept | hour) 的直方图,24 维 */
  hourlyAcceptRate: number[]; // length 24
  /** 时段情绪分布:每个时段最偏好的情绪标签 */
  hourlyEmotionBias: Array<EmotionLabel | null>; // length 24
  /** 是否处于冷启动期(前 5 次推荐) */
  isColdStart: boolean;
  /** 历史交互次数 */
  interactionCount: number;
  /** 上次更新时间(时间戳) */
  updatedAt: number;
}

// ============================================================================
// 6. 匹配与推荐结果
// ============================================================================

/** 单首歌的匹配分数明细(用于调试与可解释性) */
export interface MatchScoreBreakdown {
  /** V-A 空间距离得分(0-1,越大越好) */
  scoreVA: number;
  /** 场景标签匹配得分 */
  scoreScene: number;
  /** 用户偏好匹配得分 */
  scorePref: number;
  /** 场景适配度(历史/先验) */
  scoreSceneFit: number;
  /** 参考歌曲相似度 */
  scoreRefSim: number;
  /** 热歌度(仅加性策略使用) */
  scoreHot: number;
  /** 加权基础分(不含 boost) */
  baseScore: number;
  /** 热歌乘性 boost 系数(1.0-1.2) */
  hotBoost: number;
  /** 置信度惩罚系数(0-1) */
  confidencePenalty: number;
  /** 最终分数 */
  finalScore: number;
}

/** 推荐单首歌(带分数与来源标记) */
export interface RecommendedTrack {
  song: Song;
  breakdown: MatchScoreBreakdown;
  /** 来源:核心曲 / 扩展自某首歌 */
  source: 'core' | 'extended';
  /** 若是扩展曲,记录扩展自哪首核心曲 */
  extendedFromSongId?: string;
  /** 扩展曲与源曲的相似度 */
  similarityToSource?: number;
  /** 是否为探索曲(ε-贪婪) */
  isExplore: boolean;
}

/** 推荐结果 */
export interface RecommendationResult {
  /** 照片情绪(融合 GPS 后) */
  photoEmotion: VAWithConfidence;
  /** 主导情绪标签 */
  primaryLabel: EmotionLabel;
  /** 次要情绪标签(混合情绪时存在) */
  secondaryLabel?: EmotionLabel;
  /** 标签是否混合(距两标签都近) */
  isMixedEmotion: boolean;
  /** GPS 是否参与融合 */
  gpsUsed: boolean;
  /** 置信度低标记(前端可据此加轻交互) */
  lowConfidence: boolean;
  /** 核心 8 首 */
  coreTracks: RecommendedTrack[];
  /** 扩展 7-12 首 */
  extendedTracks: RecommendedTrack[];
  /** 元信息 */
  meta: RecommendationMeta;
}

/** 推荐结果元信息 */
export interface RecommendationMeta {
  total: number;
  sourceBreakdown: {
    hot: number;
    emotion: number;
    fallback: number;
  };
  exploreFlag: boolean;
  /** 候选池规模(阶段 1 过滤后) */
  candidatePoolSize: number;
  /** 算法版本(便于 A/B) */
  algorithmVersion: string;
}

// ============================================================================
// 7. 用户行为信号(用于持续学习)
// ============================================================================

export const INTERACTION_SIGNALS = [
  'skip', // 跳过
  'complete', // 听完不存
  'loop', // 循环播放
  'save_diary', // 保存日记
] as const;
export type InteractionSignal = (typeof INTERACTION_SIGNALS)[number];

/** 一次用户交互记录 */
export interface InteractionEvent {
  /** 被交互的歌曲 */
  songId: string;
  /** 该歌的 V-A(便于更新偏好中心) */
  songVA: VACoordinate;
  /** 该歌的风格 */
  genres: GenreTag[];
  /** 该歌的语言 */
  language: LanguageTag;
  /** 交互信号 */
  signal: InteractionSignal;
  /** 拍照时段(0-23) */
  hour: number;
  /** 该歌对应的照片情绪标签 */
  emotionLabel: EmotionLabel;
  /** 时间戳 */
  timestamp: number;
}
