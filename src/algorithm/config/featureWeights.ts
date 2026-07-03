/**
 * 照片视觉特征 → V-A 贡献映射表 + 融合权重
 *
 * 对应算法设计文档「第 1 部分:照片→V-A 坐标映射」
 * 8 个特征(F1-F8),每个映射到目标坐标 (V_i, A_i),
 * 按 w_i 权重融合,并用方向调节系数 α_i 做非对称微调
 *
 * @module algorithm/config/featureWeights
 */

import type {
  BrightnessLevel,
  Composition,
  FaceEmotion,
  SceneType,
  SaturationLevel,
  TimeOfDay,
  Weather,
  VACoordinate,
} from '../types.js';

// ============================================================================
// 1. F1 主色调 hue → (V, A)
// ============================================================================

/** hue 区间 → (V, A) 贡献 */
export const HUE_VA_MAP: ReadonlyArray<{
  range: [number, number];
  name: string;
  va: VACoordinate;
  reason: string;
}> = [
  { range: [0, 30], name: 'red-orange', va: { v: 0.75, a: 0.72 }, reason: '激情热烈' },
  { range: [330, 360], name: 'red-orange-2', va: { v: 0.75, a: 0.72 }, reason: '激情热烈' },
  { range: [30, 60], name: 'yellow-gold', va: { v: 0.70, a: 0.50 }, reason: '温暖愉悦' },
  { range: [300, 330], name: 'pink-magenta', va: { v: 0.72, a: 0.38 }, reason: '浪漫' },
  { range: [180, 270], name: 'blue-cyan', va: { v: 0.32, a: 0.25 }, reason: '冷静忧郁' },
  { range: [270, 300], name: 'purple', va: { v: 0.42, a: 0.45 }, reason: '神秘梦幻' },
  { range: [60, 180], name: 'green', va: { v: 0.58, a: 0.30 }, reason: '清新' },
];

/** 灰阶(S < 0.15)的 V-A 贡献 */
export const GRAYSCALE_VA: VACoordinate = { v: 0.40, a: 0.25 };

// ============================================================================
// 2. F2 亮度 → (V, A)
// ============================================================================

export const LUMINANCE_VA_MAP: Readonly<Record<BrightnessLevel, VACoordinate & { reason: string }>> = {
  high: { v: 0.70, a: 0.50, reason: '明快' },
  mid:  { v: 0.50, a: 0.40, reason: '中性' },
  low:  { v: 0.30, a: 0.55, reason: '低调自带戏剧张力,A 略高' },
} as const;

// ============================================================================
// 3. F3 饱和度 → (V, A)
// ============================================================================

export const SATURATION_VA_MAP: Readonly<Record<SaturationLevel, VACoordinate & { reason: string }>> = {
  high: { v: 0.65, a: 0.70, reason: '高饱和=鲜活有能量' },
  mid:  { v: 0.50, a: 0.40, reason: '中性' },
  low:  { v: 0.40, a: 0.25, reason: '低饱和=寡淡/怀旧' },
} as const;

// ============================================================================
// 4. F4 场景类型 → (V, A)
// ============================================================================

export const SCENE_VA_MAP: Readonly<Record<SceneType, VACoordinate & { reason: string }>> = {
  nature:        { v: 0.55, a: 0.30, reason: '开阔平静' },
  city:          { v: 0.50, a: 0.55, reason: '城市活力' },
  indoor:        { v: 0.50, a: 0.30, reason: '私密安静' },
  people:        { v: 0.60, a: 0.60, reason: '社交活力' },
  food:          { v: 0.72, a: 0.50, reason: '愉悦' },
  architecture:  { v: 0.55, a: 0.40, reason: '结构感' },
  heritage:      { v: 0.45, a: 0.35, reason: '历史沉淀' },
  // —— 第 2 轮新增 5 类 ——
  sports:        { v: 0.72, a: 0.82, reason: '高能积极,运动活力' },
  vehicle:       { v: 0.45, a: 0.45, reason: '流动感,略带思绪' },
  pet:           { v: 0.68, a: 0.35, reason: '温暖治愈,小确幸' },
  art:           { v: 0.55, a: 0.28, reason: '审美沉思,低唤醒' },
  sky:           { v: 0.52, a: 0.22, reason: '辽阔空灵,极低唤醒' },
  // —— 第 3 轮新增 6 类(自然地貌 + 文化空间细分) ——
  beach:         { v: 0.68, a: 0.40, reason: '阳光沙滩,愉悦放松' },
  mountain:      { v: 0.58, a: 0.45, reason: '壮阔攀登,敬畏感' },
  forest:        { v: 0.55, a: 0.22, reason: '幽静林间,极低唤醒治愈' },
  museum:        { v: 0.52, a: 0.25, reason: '文化沉思,低唤醒敬畏' },
  street:        { v: 0.52, a: 0.52, reason: '市井烟火,中等活力' },
  nightlife:     { v: 0.65, a: 0.82, reason: '夜店酒吧,高能狂欢' },
  // —— 第 4 轮新增 6 类(自然地貌细分 + 人文空间) ——
  park:          { v: 0.60, a: 0.25, reason: '城市绿洲,轻松' },
  garden:        { v: 0.65, a: 0.22, reason: '花卉,美好低唤醒' },
  lake:          { v: 0.50, a: 0.20, reason: '水面平静,低唤醒' },
  bridge:        { v: 0.45, a: 0.35, reason: '连接,中性偏沉思' },
  temple:        { v: 0.50, a: 0.15, reason: '宗教,庄重低唤醒' },
  snow:          { v: 0.45, a: 0.30, reason: '冬日,中性偏安静' },
} as const;

// ============================================================================
// 5. F5 时段 → (V, A)
// ============================================================================

export const TIME_OF_DAY_VA_MAP: Readonly<Record<TimeOfDay, VACoordinate & { reason: string }>> = {
  dawn:         { v: 0.62, a: 0.65, reason: '希望复苏' },
  morning:      { v: 0.70, a: 0.55, reason: '清新' },
  noon:         { v: 0.66, a: 0.52, reason: '正午阳光,明亮饱满' },
  daytime:      { v: 0.65, a: 0.50, reason: '常态' },
  golden_hour:  { v: 0.68, a: 0.42, reason: '黄金时刻,温暖浪漫' },
  dusk:         { v: 0.55, a: 0.35, reason: '浪漫怀旧' },
  blue_hour:    { v: 0.42, a: 0.38, reason: '蓝调时刻,忧郁静谧' },
  night:        { v: 0.42, a: 0.50, reason: '深夜多元:霓虹/独处/夜生活,中性偏中唤醒' },
  midnight:     { v: 0.28, a: 0.32, reason: '深夜emo,极低V低A' },
  // —— 第 4 轮新增 4 类时段 ——
  early_morning:{ v: 0.62, a: 0.45, reason: '一日之始,积极中等唤醒' },
  afternoon:    { v: 0.58, a: 0.48, reason: '平稳,中性偏积极' },
  evening:      { v: 0.45, a: 0.40, reason: '日落过渡,偏沉思' },
  late_night:   { v: 0.32, a: 0.38, reason: '深夜0-2点,偏沉思中等偏低唤醒' },
} as const;

// ============================================================================
// 6. F6 天气 → (V, A)
// ============================================================================

export const WEATHER_VA_MAP: Readonly<Record<Weather, VACoordinate & { reason: string }>> = {
  sunny:        { v: 0.70, a: 0.55, reason: '明朗' },
  cloudy:       { v: 0.45, a: 0.35, reason: '低落' },
  overcast:     { v: 0.38, a: 0.28, reason: '阴沉压抑,比cloudy更低' },
  rainy:        { v: 0.35, a: 0.40, reason: '思念忧郁' },
  drizzle:      { v: 0.42, a: 0.32, reason: '毛毛雨,比rainy更柔更轻' },
  thunderstorm: { v: 0.25, a: 0.75, reason: '雷暴,高唤醒低效价' },
  snowy:        { v: 0.55, a: 0.30, reason: '宁静梦幻' },
  foggy:        { v: 0.40, a: 0.30, reason: '朦胧神秘' },
  haze:         { v: 0.30, a: 0.25, reason: '霾,低沉压抑' },
  breezy:       { v: 0.60, a: 0.40, reason: '微风轻拂,轻快舒适' },
  starry:       { v: 0.58, a: 0.28, reason: '星空,宁静辽阔带梦幻' },
  // —— 第 4 轮新增 3 类天气 ——
  humid:        { v: 0.40, a: 0.45, reason: '闷热压抑,消极中等唤醒' },
  windy:        { v: 0.55, a: 0.55, reason: '大风有动感,中性偏积极' },
  sleet:        { v: 0.35, a: 0.40, reason: '雨夹雪,冷冽消极' },
} as const;

// ============================================================================
// 7. F7 人物 → (V, A)
// ============================================================================

/** 人物维度的 V-A 贡献(基于人数 + 表情) */
export function getPeopleVA(count: number, emotion: FaceEmotion): VACoordinate {
  if (count === 0 || emotion === 'none') {
    return { v: 0.50, a: 0.35 }; // 中性
  }
  if (count === 1) {
    switch (emotion) {
      case 'smile':      return { v: 0.72, a: 0.55 }; // 开心
      case 'excited':    return { v: 0.78, a: 0.72 }; // 兴奋
      case 'neutral':    return { v: 0.32, a: 0.45 }; // 孤独emo
      case 'sad':        return { v: 0.25, a: 0.40 }; // 悲伤
      case 'surprised':  return { v: 0.70, a: 0.78 }; // 惊讶,高唤醒
      case 'thoughtful': return { v: 0.40, a: 0.30 }; // 沉思,低唤醒
      case 'focused':    return { v: 0.55, a: 0.60 }; // 专注,中高唤醒
      // —— 第 3 轮新增 6 类表情 ——
      case 'laughing':   return { v: 0.85, a: 0.80 }; // 大笑,极高积极高能
      case 'crying':     return { v: 0.15, a: 0.55 }; // 哭泣,极低效价中唤醒
      case 'angry':      return { v: 0.12, a: 0.88 }; // 愤怒,极低效价极高唤醒
      case 'in_love':    return { v: 0.82, a: 0.50 }; // 恋爱中,高积极中唤醒
      case 'proud':      return { v: 0.78, a: 0.65 }; // 自豪,高积极中高唤醒
      case 'calm':       return { v: 0.55, a: 0.18 }; // 平静,中效价极低唤醒
      // —— 第 4 轮新增 6 类表情 ——
      case 'bored':      return { v: 0.35, a: 0.15 }; // 无聊,低唤醒轻度消极
      case 'determined': return { v: 0.65, a: 0.70 }; // 坚定,积极高唤醒
      case 'shy':        return { v: 0.55, a: 0.30 }; // 害羞,中性低唤醒
      case 'grateful':   return { v: 0.72, a: 0.45 }; // 感恩,积极中等唤醒
      case 'content':    return { v: 0.68, a: 0.20 }; // 满足,积极低唤醒
      case 'confused':   return { v: 0.40, a: 0.50 }; // 困惑,消极中等唤醒
    }
  }
  // 多人
  return { v: 0.75, a: 0.70 }; // 聚会兴奋
}

// ============================================================================
// 8. F8 构图 → (V, A)
// ============================================================================

export const COMPOSITION_VA_MAP: Readonly<Record<Composition, VACoordinate & { reason: string }>> = {
  closeup:          { v: 0.55, a: 0.50, reason: '亲密' },
  portrait:         { v: 0.58, a: 0.42, reason: '人像,聚焦情感' },
  subject:          { v: 0.55, a: 0.45, reason: '聚焦' },
  landscape:        { v: 0.50, a: 0.32, reason: '开阔' },
  panorama:         { v: 0.50, a: 0.35, reason: '广阔' },
  symmetry:         { v: 0.52, a: 0.38, reason: '对称,秩序感' },
  aerial:           { v: 0.60, a: 0.45, reason: '航拍,惊叹感' },
  // —— 第 3 轮新增 4 类摄影技法 ——
  rule_of_thirds:   { v: 0.55, a: 0.40, reason: '三分法,经典平衡构图' },
  silhouette:       { v: 0.35, a: 0.55, reason: '剪影,高对比戏剧张力' },
  bokeh:            { v: 0.62, a: 0.30, reason: '散景,梦幻柔焦' },
  negative_space:   { v: 0.50, a: 0.18, reason: '留白,极简空灵低唤醒' },
  // —— 第 4 轮新增 4 类进阶摄影技法 ——
  leading_lines:    { v: 0.55, a: 0.45, reason: '引导线,视线引导平衡' },
  golden_ratio:     { v: 0.60, a: 0.40, reason: '黄金螺旋,美学积极' },
  framing:          { v: 0.50, a: 0.35, reason: '框架构图,聚焦中性' },
  centered:         { v: 0.55, a: 0.45, reason: '居中构图,庄重平衡' },
} as const;

// ============================================================================
// 9. 8 特征融合权重 w_i
// ============================================================================

export const FEATURE_WEIGHTS = {
  hue: 0.22, // F1 主色调
  luminance: 0.15, // F2 亮度
  saturation: 0.10, // F3 饱和度
  scene: 0.18, // F4 场景
  timeOfDay: 0.12, // F5 时段
  weather: 0.08, // F6 天气
  people: 0.10, // F7 人物
  composition: 0.05, // F8 构图
} as const;

// ============================================================================
// 10. 方向调节系数 α_i (V/A 非对称微调)
// ============================================================================

/**
 * 方向调节系数:对 w_i 的倍率
 * V 方向:色彩/亮度权重大
 * A 方向:饱和度/人物权重大
 * 实际使用时会做归一化(Σ w_i·α_i = 1)
 */
export const FEATURE_DIRECTION_COEFFICIENTS = {
  hue:         { v: 1.20, a: 0.70 }, // 色调对 V 影响大
  luminance:   { v: 1.15, a: 0.80 }, // 亮度偏 V
  saturation:  { v: 0.70, a: 1.40 }, // 饱和度偏 A
  scene:       { v: 1.00, a: 1.00 },
  timeOfDay:   { v: 0.90, a: 1.10 },
  weather:     { v: 1.00, a: 1.00 },
  people:      { v: 0.85, a: 1.30 }, // 人物偏 A
  composition: { v: 0.90, a: 1.10 },
} as const;

/** 特征维度键名(便于遍历) */
export type FeatureKey = keyof typeof FEATURE_WEIGHTS;
