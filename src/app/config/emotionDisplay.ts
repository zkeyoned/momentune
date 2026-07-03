/**
 * 情绪标签 → 中文展示映射(前端用)
 *
 * 算法层只导出英文 EmotionLabel(71 种),前端展示需要中文短语。
 * 中文文案取自算法 types.ts 注释,部分微调以更口语化。
 */

import type { EmotionLabel } from '@algorithm/index';

export interface EmotionDisplay {
  /** 中文显示名 */
  zh: string;
  /** 一句话氛围描述(用于卡片副标题) */
  vibe: string;
}

export const EMOTION_DISPLAY: Record<EmotionLabel, EmotionDisplay> = {
  // —— 16 基础 ——
  Exciting: { zh: '兴奋', vibe: '心跳加速的雀跃' },
  Joyful: { zh: '欢快', vibe: '阳光明媚的开心' },
  Romantic: { zh: '浪漫', vibe: '柔软的暧昧时刻' },
  Fresh: { zh: '清新', vibe: '晨露般的干净' },
  Healing: { zh: '治愈', vibe: '被温柔包裹' },
  Relaxing: { zh: '放松', vibe: '松一口气的舒展' },
  Peaceful: { zh: '宁静', vibe: '万籁俱寂的安详' },
  Touching: { zh: '感动', vibe: '眼眶微热的暖' },
  Nostalgic: { zh: '怀旧', vibe: '泛黄的旧时光' },
  Missing: { zh: '思念', vibe: '想一个人的重量' },
  Lonely: { zh: '孤独', vibe: '一个人的清冷' },
  Melancholic: { zh: '忧郁', vibe: '化不开的灰' },
  Tense: { zh: '紧张', vibe: '悬而未决的弦' },
  Epic: { zh: '燃', vibe: '热血上涌的冲' },
  Dark: { zh: '暗黑', vibe: '深处的影' },
  Dreamy: { zh: '梦幻', vibe: '不真实的轻' },
  // —— GEMS 4 ——
  Wonder: { zh: '惊叹', vibe: '屏息的壮美' },
  Transcendence: { zh: '超然', vibe: '物我两忘的出离' },
  Tenderness: { zh: '柔情', vibe: '克制而深的暖' },
  Power: { zh: '力量', vibe: '由内而外的强' },
  // —— 复合 8 ——
  Hopeful: { zh: '希望', vibe: '微微亮的期待' },
  Bittersweet: { zh: '苦甜参半', vibe: '笑着流泪' },
  Serene: { zh: '空灵', vibe: '云端的轻' },
  Sentimental: { zh: '感伤', vibe: '比怀旧更柔的涩' },
  Cozy: { zh: '温馨', vibe: '小确幸的暖' },
  Mysterious: { zh: '神秘', vibe: '欲说还休的暗' },
  Whimsical: { zh: '俏皮', vibe: '跳着走的轻快' },
  Yearning: { zh: '渴望', vibe: '想靠近的主动' },
  // —— 中国古典 5 ——
  Wistful: { zh: '惆怅', vibe: '落花流年式苦甜' },
  Zen: { zh: '禅意', vibe: '止水般的静' },
  Heroic: { zh: '豪迈', vibe: '英气勃发的我' },
  PartingSorrow: { zh: '离愁', vibe: '长亭送别的痛' },
  Smitten: { zh: '倾心', vibe: '一整个爱住' },
  // —— GEMS-25 子项 3 ——
  Awe: { zh: '敬畏', vibe: '面对壮美的震颤' },
  Triumphant: { zh: '凯旋', vibe: '登顶的荣光' },
  Inspired: { zh: '灵感迸发', vibe: '被点亮想创造' },
  // —— 音乐特有 3 ——
  Groove: { zh: '律动', vibe: '身体跟着打拍子' },
  Ethereal: { zh: '仙气', vibe: '非人间的飘渺' },
  Hype: { zh: '燃场', vibe: '副歌前的蓄势' },
  // —— 抖音热词 3 ——
  Overwhelmed: { zh: '破防', vibe: '被一句词击穿' },
  Resonant: { zh: '共鸣', vibe: '这首歌写的就是我' },
  Masterpiece: { zh: '封神', vibe: '神作的审美震撼' },
  // —— 古典补充 5 ——
  Wanderer: { zh: '羁旅', vibe: '客居他乡的漂泊' },
  Ambitious: { zh: '壮志', vibe: '抱负远大的昂扬' },
  TragicHeroic: { zh: '悲壮', vibe: '知其不可而为之' },
  Leisurely: { zh: '闲适', vibe: '无所事事的惬意' },
  Lovesick: { zh: '相思', vibe: '衣带渐宽的缠绵' },
  // —— GEMS-25 剩余 3 ——
  Solemnity: { zh: '庄重', vibe: '严肃而沉的正式' },
  Spiritual: { zh: '灵性', vibe: '超脱的精神性' },
  Activation: { zh: '激活', vibe: '能量涌动的兴奋' },
  // —— 音乐补充 3 ——
  Anthemic: { zh: '颂歌感', vibe: '大合唱的升华' },
  Hypnotic: { zh: '催眠', vibe: '重复律动的沉浸' },
  Aggressive: { zh: '侵略性', vibe: '攻击性的宣泄' },
  // —— 网络热词 3 ——
  Addicted: { zh: '上头', vibe: '单曲循环停不下' },
  EmoNight: { zh: 'emo夜', vibe: '夜里的矫情自怜' },
  Vibes: { zh: '氛围感', vibe: '模糊但正面的氛围' },
  // —— 第 5 轮 7 ——
  AbstractBanger: { zh: '抽象魔性', vibe: '发疯 BGM 的洗脑' },
  SensualNeon: { zh: '霓虹暧昧', vibe: '夜店赛博的迷离' },
  Cinematic: { zh: '电影感', vibe: 'OST 式的史诗' },
  EtherealJoy: { zh: '飘飘然', vibe: '轻飘飘的喜悦' },
  Playful: { zh: '调皮', vibe: '童趣的俏皮' },
  Brooding: { zh: '郁结', vibe: '闷闷不乐的结' },
  TriumphantJoy: { zh: '胜利喜悦', vibe: '夺冠的狂喜' },
  // —— 第 6 轮 8 ——
  Despair: { zh: '绝望', vibe: '无路可走的死寂' },
  Desolate: { zh: '荒凉', vibe: '废墟旷野的苍茫' },
  Rage: { zh: '暴怒', vibe: '失控的毁灭冲动' },
  Panic: { zh: '恐慌', vibe: '恐惧的爆发' },
  Euphoric: { zh: '狂喜', vibe: '极致的身体亢奋' },
  Exhilarating: { zh: '酣畅', vibe: '尽兴痛快的释放' },
  Burnout: { zh: '摆烂', vibe: '不挣扎了的躺平' },
  TearJerker: { zh: '泪目', vibe: '瞬间被戳中' },
};

/** 获取情绪展示(安全 fallback) */
export function getEmotionDisplay(label: EmotionLabel): EmotionDisplay {
  return EMOTION_DISPLAY[label] ?? { zh: label, vibe: '' };
}

/** 构造展示标签(主+次合并,如 "温柔 · 惬意") */
export function buildDisplayLabel(
  primary: EmotionLabel,
  secondary?: EmotionLabel,
): string {
  const p = getEmotionDisplay(primary).zh;
  if (!secondary) return p;
  const s = getEmotionDisplay(secondary).zh;
  return `${p} · ${s}`;
}
