/**
 * 71 种细分情绪标签的 V-A 坐标定义
 *
 * 来源:心理学 Valence-Arousal 模型 + GEMS(Geneva Emotional Music Scale)+ 中国古典文学情绪 + 抖音/汽水音乐 2024-2025 热词 + Momentune 业务校准
 * V: 0.0 消极 → 1.0 积极
 * A: 0.0 平静 → 1.0 高能
 *
 * GEMS 9 维基础:Wonder/Transcendence/Tenderness/Nostalgia/Peacefulness/Power/Joyful Activation/Tension/Sadness
 *
 * 扩展路径(71 标签):
 *  - 16 基础 + 4 GEMS + 8 复合/细分 = 28(第 2 轮)
 *  - +5 中国古典(Wistful/Zen/Heroic/PartingSorrow/Smitten)
 *  - +3 GEMS-25 子项(Awe/Triumphant/Inspired)
 *  - +3 音乐特有(Groove/Ethereal/Hype)
 *  - +3 抖音热词(Overwhelmed/Resonant/Masterpiece)
 *  - +5 中国古典补充(Wanderer/Ambitious/TragicHeroic/Leisurely/Lovesick)
 *  - +3 GEMS-25 剩余(Solemnity/Spiritual/Activation)
 *  - +3 音乐特有补充(Anthemic/Hypnotic/Aggressive)
 *  - +3 网络热词补充(Addicted/EmoNight/Vibes)
 *  - +7 第 5 轮填补 V-A 空间空白(AbstractBanger/SensualNeon/Cinematic/EtherealJoy/Playful/Brooding/TriumphantJoy)
 *  - +8 第 6 轮填补 V-A 极端区域空白(Despair/Desolate/Rage/Panic/Euphoric/Exhilarating/Burnout/TearJerker)
 *
 * @module algorithm/config/emotionLabels
 */

import type { EmotionLabel, VACoordinate } from '../types.js';

/** 71 标签的 V-A 坐标表(只读常量) */
export const EMOTION_VA_COORDINATES: Readonly<Record<EmotionLabel, VACoordinate>> = {
  // —— 原有 16 标签 ——
  Exciting:       { v: 0.85, a: 0.85 }, // 高能积极
  Joyful:         { v: 0.80, a: 0.70 }, // 开心愉悦
  Romantic:       { v: 0.70, a: 0.35 }, // 甜蜜暧昧
  Fresh:          { v: 0.65, a: 0.30 }, // 轻快干净
  Healing:        { v: 0.55, a: 0.25 }, // 温暖安慰
  Relaxing:       { v: 0.50, a: 0.20 }, // 卸下压力
  Peaceful:       { v: 0.45, a: 0.15 }, // 空旷安静
  Touching:       { v: 0.40, a: 0.45 }, // 催泪共鸣
  Nostalgic:      { v: 0.35, a: 0.30 }, // 回忆青春
  Missing:        { v: 0.30, a: 0.40 }, // 想念某人
  Lonely:         { v: 0.25, a: 0.35 }, // 一个人
  Melancholic:    { v: 0.20, a: 0.25 }, // 低沉内敛
  Tense:          { v: 0.30, a: 0.80 }, // 悬疑压迫
  Epic:           { v: 0.60, a: 0.90 }, // 热血激昂
  Dark:           { v: 0.15, a: 0.60 }, // 阴郁沉重
  Dreamy:         { v: 0.55, a: 0.20 }, // 迷幻飘渺
  // —— GEMS 新增 4 标签 ——
  Wonder:         { v: 0.75, a: 0.55 }, // 惊叹 (GEMS: Wonder,敬畏自然/艺术)
  Transcendence:  { v: 0.50, a: 0.15 }, // 超然 (GEMS: Transcendence,超越世俗)
  Tenderness:     { v: 0.65, a: 0.25 }, // 柔情 (GEMS: Tenderness,比 Healing 更柔软)
  Power:          { v: 0.65, a: 0.80 }, // 力量 (GEMS: Power,比 Epic 更内敛的力量)
  // —— 复合/细分新增 8 标签 ——
  Hopeful:        { v: 0.68, a: 0.45 }, // 希望 (积极+期待,比 Healing 更向前)
  Bittersweet:    { v: 0.35, a: 0.35 }, // 苦甜 (积极+悲伤复合,笑中带泪)
  Serene:         { v: 0.48, a: 0.10 }, // 空灵 (比 Peaceful 更极致,A 极低)
  Sentimental:    { v: 0.30, a: 0.20 }, // 感伤 (比 Nostalgic 更柔更被动)
  Cozy:           { v: 0.62, a: 0.22 }, // 温馨 (室内小确幸,比 Healing 更小空间)
  Mysterious:     { v: 0.40, a: 0.50 }, // 神秘 (比 Dreamy 更暗,比 Dark 更轻)
  Whimsical:      { v: 0.72, a: 0.60 }, // 俏皮 (比 Joyful 更轻快调皮)
  Yearning:       { v: 0.35, a: 0.50 }, // 渴望 (比 Missing 更主动,A 更高)
  // —— 中国古典文化情绪新增 5 标签 ——
  Wistful:        { v: 0.30, a: 0.32 }, // 惆怅 (落花流年式苦甜参半,比 Nostalgic 更涩更厚)
  Zen:            { v: 0.55, a: 0.08 }, // 禅意 (物我两忘的超然止水,全系统最低唤醒,略偏正价接纳)
  Heroic:         { v: 0.77, a: 0.80 }, // 豪迈 (个人化英气勃发,比 Epic 更"我",比 Exciting 更沉)
  PartingSorrow:  { v: 0.25, a: 0.42 }, // 离愁 (长亭送别式带主动思念的离别痛,比 Lonely 更有方向)
  Smitten:        { v: 0.85, a: 0.60 }, // 倾心 (瞬间迷恋爆发,对应"一整个爱住",V 极高 A 中等)
  // —— GEMS-25 学术子项新增 3 标签 ——
  Awe:            { v: 0.62, a: 0.68 }, // 敬畏 (面对壮美自然/神作的崇高震颤,比 Exciting 多一层谦卑)
  Triumphant:     { v: 0.88, a: 0.82 }, // 凯旋 (胜利登顶的极致荣光,全系统最高效价,比 Epic 更具方向性)
  Inspired:       { v: 0.70, a: 0.58 }, // 灵感迸发 (被作品点亮、想立刻创造,比 Dreamy 主动,比 Exciting 内敛)
  // —— 音乐特有情绪新增 3 标签 ——
  Groove:         { v: 0.70, a: 0.65 }, // 律动 (身体不自觉跟着打拍子的快感,与 Joyful 情绪性正交)
  Ethereal:       { v: 0.62, a: 0.12 }, // 仙气 (空灵飘渺的非人间感,比 Dreamy 更冷,比 Peaceful 更玄)
  Hype:           { v: 0.72, a: 0.92 }, // 燃场 (副歌前的鼓点蓄势,全系统最高唤醒,比 Epic 更"未爆发")
  // —— 抖音/汽水音乐平台热词新增 3 标签 ——
  Overwhelmed:    { v: 0.28, a: 0.78 }, // 破防 (被一句词/一个音击穿心理防线,填补低 V 高 A 空白)
  Resonant:       { v: 0.50, a: 0.70 }, // 共鸣 ("这首歌写的就是我"的深层身份共振,比 Touching 更自我)
  Masterpiece:    { v: 0.78, a: 0.55 }, // 封神 (对作品级神作的审美震撼,比 Awe 更偏作品评价)
  // —— 第 4 轮:中国古典文化情绪补充 5 标签 ——
  Wanderer:       { v: 0.38, a: 0.22 }, // 羁旅 (客居他乡的漂泊感,比 Lonely 更有空间纵深感,V 略高因有探索意)
  Ambitious:      { v: 0.74, a: 0.72 }, // 壮志 (抱负远大的昂扬,比 Heroic 更面向未来,比 Power 更个人化)
  TragicHeroic:   { v: 0.42, a: 0.88 }, // 悲壮 (知其不可为而为之,高唤醒但带悲色,填补中 V 极高 A 空白)
  Leisurely:      { v: 0.70, a: 0.18 }, // 闲适 (无所事事的惬意,比 Cozy 更户外更开阔,A 极低)
  Lovesick:       { v: 0.32, a: 0.52 }, // 相思 (比 Missing 更缠绵更主动,衣带渐宽式,A 更高)
  // —— 第 4 轮:GEMS-25 剩余子项 3 标签 ——
  Solemnity:      { v: 0.48, a: 0.28 }, // 庄重 (严肃庄重,比 Peaceful 更正式更沉,比 Tenderness 更肃)
  Spiritual:      { v: 0.58, a: 0.20 }, // 灵性 (超脱精神性,比 Transcendence 更宗教感,V 略高)
  Activation:     { v: 0.62, a: 0.75 }, // 激活 (能量涌动,比 Joyful 更偏生理性兴奋,V 略低)
  // —— 第 4 轮:音乐特有情绪补充 3 标签 ——
  Anthemic:       { v: 0.78, a: 0.88 }, // 颂歌感 (大合唱的集体升华感,比 Epic 更群体性,比 Heroic 更宏大,调高 A 避免与 Heroic 过近)
  Hypnotic:       { v: 0.48, a: 0.38 }, // 催眠 (重复性律动的沉浸感,比 Groove 更内化,A 更低)
  Aggressive:     { v: 0.22, a: 0.92 }, // 侵略性 (攻击性强的宣泄,比 Tense 更主动更外放,A 极高)
  // —— 第 4 轮:抖音/网络热词补充 3 标签 ——
  Addicted:       { v: 0.55, a: 0.78 }, // 上头 (单曲循环停不下来,比 Smitten 更偏作品依赖,调低 A 避免与 Epic 过近)
  EmoNight:       { v: 0.24, a: 0.48 }, // emo夜 (夜间矫情自怜,比 Melancholic 更场景化,A 略高)
  Vibes:          { v: 0.60, a: 0.35 }, // 氛围感 (模糊但正面的氛围,比 Dreamy 更口语化更轻松)
  // —— 第 5 轮:填补 V-A 空间空白 7 标签(精心设计坐标避免过密,CRITIQUE 后调整) ——
  AbstractBanger: { v: 0.54, a: 0.93 }, // 抽象魔性 (抖音发疯 BGM,CRITIQUE 后从 0.52,0.90 调高 A 避开 TragicHeroic/Addicted)
  SensualNeon:    { v: 0.40, a: 0.65 }, // 霓虹暧昧 (夜店 phonk,CRITIQUE 后从 0.50,0.58 调到中低 V 中高 A 避开 Resonant)
  Cinematic:      { v: 0.56, a: 0.52 }, // 电影感 (史诗配乐/影视 OST 叙事张力)
  EtherealJoy:    { v: 0.80, a: 0.22 }, // 飘飘然 (CRITIQUE 后从 0.78,0.25 调高 V 调低 A 避开 Leisurely)
  Playful:        { v: 0.86, a: 0.45 }, // 调皮 (童趣俏皮)
  Brooding:       { v: 0.14, a: 0.40 }, // 郁结 (CRITIQUE 后从 0.16,0.45 调低 V 调低 A 避开 EmoNight/PartingSorrow)
  TriumphantJoy:  { v: 0.95, a: 0.55 }, // 胜利喜悦 (CRITIQUE 后从 0.92,0.68 调高 V 调低 A 避开 Smitten)
  // —— 第 6 轮:填补 V-A 极端区域空白 8 标签(CRITIQUE 后调整 Exhilarating/Burnout 坐标,与最近标签距离 > 0.08) ——
  Despair:      { v: 0.05, a: 0.18 }, // 绝望 (极低 V 低 A,无路可走的死寂,与 Brooding 0.14,0.40 距离 0.24)
  Desolate:     { v: 0.15, a: 0.10 }, // 荒凉 (低 V 极低 A,废墟旷野苍茫感,与 Melancholic 0.20,0.25 距离 0.16)
  Rage:         { v: 0.08, a: 0.97 }, // 暴怒 (极低 V 极高 A,全系统最高 A,与 Aggressive 0.22,0.92 距离 0.15)
  Panic:        { v: 0.15, a: 0.78 }, // 恐慌 (低 V 中高 A,恐惧爆发,与 Tense 0.30,0.80 距离 0.15)
  Euphoric:     { v: 0.94, a: 0.96 }, // 狂喜 (极高 V 极高 A,身体性极致亢奋,与 Exciting 0.85,0.85 距离 0.13)
  Exhilarating: { v: 0.95, a: 0.72 }, // 酣畅 (CRITIQUE 后从 0.92,0.68 调高 V 调高 A,避开 Smitten 0.85,0.60;与 TriumphantJoy 0.95,0.55 距离 0.108)
  Burnout:      { v: 0.38, a: 0.05 }, // 摆烂 (CRITIQUE 后从 0.32,0.08 调高 V 调低 A,避开 Sentimental 0.30,0.20;V 略高因"摆烂"带无所谓而非感伤)
  TearJerker:   { v: 0.25, a: 0.65 }, // 泪目 (中低 V 中高 A,瞬间被戳中泪水涌出,与 Lovesick 0.32,0.52 距离 0.15)
} as const;

/** 网易云 12 种情绪标签 → V-A 坐标(emo163 数据集映射) */
export const NETEASE_TAG_VA: Readonly<Record<string, VACoordinate>> = {
  Exciting:    { v: 0.85, a: 0.85 },
  Joyful:      { v: 0.80, a: 0.70 },
  Romantic:    { v: 0.70, a: 0.35 },
  Fresh:       { v: 0.65, a: 0.30 },
  Healing:     { v: 0.55, a: 0.25 },
  Relaxing:    { v: 0.50, a: 0.20 },
  Peaceful:    { v: 0.45, a: 0.15 },
  Touching:    { v: 0.40, a: 0.45 },
  Nostalgic:   { v: 0.35, a: 0.30 },
  Melancholic: { v: 0.20, a: 0.25 },
  Lonely:      { v: 0.25, a: 0.35 },
  Missing:     { v: 0.30, a: 0.40 },
} as const;

/** 首次问卷 Q3 情绪偏好 → 锚点 V-A 坐标 */
export const MOOD_PREFERENCE_ANCHOR: Readonly<Record<string, VACoordinate>> = {
  healing:      { v: 0.55, a: 0.25 }, // Healing
  igniting:     { v: 0.70, a: 0.85 }, // Exciting/Epic
  accompanying: { v: 0.30, a: 0.35 }, // Lonely/Missing
  empathizing:  { v: 0.35, a: 0.30 }, // Nostalgic/Melancholic
  neutral:      { v: 0.50, a: 0.40 }, // 不偏移
} as const;
