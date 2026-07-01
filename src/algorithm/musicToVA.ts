/**
 * 音乐 → V-A 坐标标注
 *
 * 对应算法设计文档「第 3 部分:音乐→V-A 坐标标注方案」
 *
 * 三层方法(按优先级):
 * 1. 网易云 12 标签映射(emo163 数据集)
 * 2. Spotify 音频特征转换(valence/energy + 修正)
 * 3. 无标签歌曲估算:
 *    A. 音频回归模型(librosa + XGBoost,离线训练)
 *    B. 启发式公式(tempo + RMS + loudness + mode + centroid + lyrics)
 *    C. 元数据关键词(标题/歌名启发)
 *
 * 每首歌标注 va_confidence,匹配时低置信度权重打折
 *
 * @module algorithm/musicToVA
 */

import { NETEASE_TAG_VA } from './config/emotionLabels.js';
import {
  METHOD_A_CONFIDENCE,
  METHOD_B_CONFIDENCE,
  METHOD_C_CONFIDENCE,
  MINOR_KEY_V_PENALTY,
  MINOR_KEY_PENALTY_THRESHOLD,
  ACOUSTIC_A_PENALTY,
  ACOUSTIC_PENALTY_THRESHOLD,
  HEURISTIC_DEFAULT_V,
  HEURISTIC_V_WEIGHTS,
  HEURISTIC_A_WEIGHTS,
} from './config/thresholds.js';
import { clamp01, normalizeTempo, normalizeLoudness } from './utils.js';
import type {
  NeteaseEmotionTag,
  Song,
  SpotifyAudioFeatures,
  VAWithConfidence,
} from './types.js';

// ============================================================================
// 1. 网易云 12 标签 → V-A
// ============================================================================

/**
 * 网易云标签 → V-A(单标签)
 */
export function neteaseTagToVA(tag: NeteaseEmotionTag): VAWithConfidence {
  const va = NETEASE_TAG_VA[tag];
  if (!va) {
    return { v: 0.5, a: 0.4, confidence: 0.4, source: 'fallback_default' };
  }
  return { v: va.v, a: va.a, confidence: 0.85, source: 'netease_tag' };
}

/**
 * 网易云多标签 → V-A(加权质心)
 *
 * 权重 = 该标签下歌曲被点赞数(反映标签强度)
 * 若无点赞数,取均值
 *
 * @param tags 标签列表
 * @param weights 各标签权重(点赞数,可选)
 */
export function neteaseMultiTagToVA(
  tags: readonly NeteaseEmotionTag[],
  weights?: Readonly<Partial<Record<NeteaseEmotionTag, number>>>,
): VAWithConfidence {
  if (tags.length === 0) {
    return { v: 0.5, a: 0.4, confidence: 0.4, source: 'fallback_default' };
  }
  if (tags.length === 1) {
    return neteaseTagToVA(tags[0]!);
  }

  // 加权质心
  let vSum = 0;
  let aSum = 0;
  let weightSum = 0;
  for (const tag of tags) {
    const va = NETEASE_TAG_VA[tag];
    if (!va) continue;
    const w = weights?.[tag] ?? 1;
    vSum += va.v * w;
    aSum += va.a * w;
    weightSum += w;
  }
  if (weightSum === 0) {
    return { v: 0.5, a: 0.4, confidence: 0.4, source: 'fallback_default' };
  }
  return {
    v: vSum / weightSum,
    a: aSum / weightSum,
    confidence: 0.82,
    source: 'netease_tag',
  };
}

// ============================================================================
// 2. Spotify 音频特征 → V-A(含修正)
// ============================================================================

/**
 * Spotify 音频特征 → V-A
 *
 * V = valence(直接使用)
 * A = 0.6 × energy + 0.2 × tempo_norm + 0.2 × loudness_norm
 *
 * 修正:
 * - 小调(mode=0)且 valence > 0.6 → V 减 0.08(小调高 valence 常是"苦情欢快")
 * - acousticness > 0.7 → A 减 0.05(原声偏静)
 */
export function spotifyFeaturesToVA(features: SpotifyAudioFeatures): VAWithConfidence {
  // V = valence 直接使用
  let v = features.valence;

  // 小调修正
  if (features.mode === 0 && v > MINOR_KEY_PENALTY_THRESHOLD) {
    v -= MINOR_KEY_V_PENALTY;
  }

  // A = 0.6 × energy + 0.2 × tempo_norm + 0.2 × loudness_norm
  let a =
    0.6 * features.energy +
    0.2 * normalizeTempo(features.tempo) +
    0.2 * normalizeLoudness(features.loudness);

  // 原声修正
  if (features.acousticness > ACOUSTIC_PENALTY_THRESHOLD) {
    a -= ACOUSTIC_A_PENALTY;
  }

  return {
    v: clamp01(v),
    a: clamp01(a),
    confidence: 0.8,
    source: 'spotify_feature',
  };
}

// ============================================================================
// 3. 无标签歌曲估算 - 方法 B(启发式公式,默认)
// ============================================================================

/** 音频特征(方法 B 用,可由 librosa 提取) */
export interface AudioFeaturesForHeuristic {
  /** BPM */
  tempo: number;
  /** RMS 能量(0-1) */
  rms: number;
  /** 响度(dB) */
  loudness: number;
  /** 调式:1 大调, -1 小调, 0 未知 */
  mode: 1 | -1 | 0;
  /** 频谱质心(Hz),原声偏低,电子偏高 */
  spectralCentroid: number;
  /** 歌词情感分(-1 消极 ~ 1 积极,0 无歌词) */
  lyricsSentiment: number;
}

/**
 * 方法 B:启发式公式估算 V-A
 *
 * V = 0.50 + 0.25 × mode_signal + 0.15 × centroid_norm + 0.35 × lyrics_sentiment
 * A = 0.50 × tempo_norm + 0.30 × RMS_norm + 0.20 × loudness_norm
 *
 * 优点:无需训练,可解释
 * 缺点:精度低于方法 A
 */
export function heuristicEstimateVA(features: AudioFeaturesForHeuristic): VAWithConfidence {
  // mode_signal: +1 大调, -1 小调, 0 未知
  const modeSignal = features.mode;

  // centroid_norm: (centroid - 1500) / 3000, clamp 到 [-1, 1]
  const centroidNorm = clamp01((features.spectralCentroid - 1500) / 3000) * 2 - 1;

  // V
  const v =
    HEURISTIC_V_WEIGHTS.base +
    HEURISTIC_V_WEIGHTS.mode * modeSignal +
    HEURISTIC_V_WEIGHTS.centroid * centroidNorm +
    HEURISTIC_V_WEIGHTS.lyrics * features.lyricsSentiment;

  // 归一化 RMS(假设输入已是 0-1)
  const rmsNorm = clamp01(features.rms);

  // A
  const a =
    HEURISTIC_A_WEIGHTS.tempo * normalizeTempo(features.tempo) +
    HEURISTIC_A_WEIGHTS.rms * rmsNorm +
    HEURISTIC_A_WEIGHTS.loudness * normalizeLoudness(features.loudness);

  return {
    v: clamp01(v),
    a: clamp01(a),
    confidence: METHOD_B_CONFIDENCE,
    source: 'heuristic_formula',
  };
}

// ============================================================================
// 4. 无标签歌曲估算 - 方法 C(元数据关键词)
// ============================================================================

/** 关键词 → V/A 偏移 */
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

/**
 * 方法 C:元数据关键词启发(最低精度,兜底)
 * 仅靠标题/歌名关键词估算
 */
export function keywordEstimateVA(title: string, artist: string = ''): VAWithConfidence {
  const text = `${title} ${artist}`;
  let v = HEURISTIC_DEFAULT_V;
  let a = 0.45;

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        v += rule.vDelta;
        a += rule.aDelta;
      }
    }
  }

  return {
    v: clamp01(v),
    a: clamp01(a),
    confidence: METHOD_C_CONFIDENCE,
    source: 'metadata_keyword',
  };
}

// ============================================================================
// 5. 无标签歌曲估算 - 方法 A(音频回归,接口预留)
// ============================================================================

/**
 * 方法 A:音频回归模型预测函数签名
 *
 * 工程层需注入实现:
 * 1. librosa 提取音频特征(tempo, RMS, spectral_centroid, zero_crossing_rate, chroma, mode)
 * 2. 用预训练 XGBoost 模型预测 V/A
 *
 * 精度最高,但需离线训练和算力
 */
export type AudioRegressionFunction = (
  audioFeatures: AudioFeaturesForHeuristic,
) => Promise<{ v: number; a: number } | null>;

/**
 * 方法 A 包装:调用注入的回归模型,失败则降级方法 B
 */
export async function regressionEstimateVA(
  audioFeatures: AudioFeaturesForHeuristic,
  regressionFn?: AudioRegressionFunction,
): Promise<VAWithConfidence> {
  if (regressionFn) {
    try {
      const result = await regressionFn(audioFeatures);
      if (result) {
        return {
          v: clamp01(result.v),
          a: clamp01(result.a),
          confidence: METHOD_A_CONFIDENCE,
          source: 'audio_regression',
        };
      }
    } catch {
      // 降级方法 B
    }
  }
  return heuristicEstimateVA(audioFeatures);
}

// ============================================================================
// 6. 综合标注:歌曲 → V-A(主入口)
// ============================================================================

/** 综合标注输入 */
export interface SongVAInput {
  /** 网易云情绪标签(若来自 emo163) */
  neteaseTags?: NeteaseEmotionTag[];
  /** 网易云标签权重(点赞数) */
  neteaseTagWeights?: Readonly<Record<NeteaseEmotionTag, number>>;
  /** Spotify 音频特征 */
  spotifyFeatures?: SpotifyAudioFeatures;
  /** 音频特征(方法 A/B 用) */
  audioFeatures?: AudioFeaturesForHeuristic;
  /** 方法 A 回归函数 */
  regressionFn?: AudioRegressionFunction;
  /** 标题(方法 C 用) */
  title?: string;
  /** 歌手(方法 C 用) */
  artist?: string;
}

/**
 * 歌曲 → V-A 综合标注(主入口)
 *
 * 优先级:网易云标签 > Spotify 特征 > 方法 A 回归 > 方法 B 启发式 > 方法 C 关键词
 *
 * 多源融合:若同时有网易云标签 + Spotify 特征,取加权平均
 */
export async function songToVA(input: SongVAInput): Promise<VAWithConfidence> {
  const results: VAWithConfidence[] = [];

  // 源 1:网易云标签
  if (input.neteaseTags && input.neteaseTags.length > 0) {
    results.push(neteaseMultiTagToVA(input.neteaseTags, input.neteaseTags.length === 1 ? undefined : input.neteaseTagWeights));
  }

  // 源 2:Spotify 特征
  if (input.spotifyFeatures) {
    results.push(spotifyFeaturesToVA(input.spotifyFeatures));
  }

  // 源 3/4:音频特征(方法 A 优先,降级 B)
  if (input.audioFeatures) {
    const va = await regressionEstimateVA(input.audioFeatures, input.regressionFn);
    results.push(va);
  }

  // 源 5:方法 C 关键词(仅当其他源都无)
  if (results.length === 0 && input.title) {
    results.push(keywordEstimateVA(input.title, input.artist));
  }

  // 全无:返回默认值
  if (results.length === 0) {
    return { v: 0.5, a: 0.4, confidence: 0.3, source: 'fallback_default' };
  }

  // 单源:直接返回
  if (results.length === 1) {
    return results[0]!;
  }

  // 多源融合:按置信度加权平均
  return weightedAverageVA(results);
}

/** 多源 V-A 加权平均(按置信度) */
function weightedAverageVA(results: readonly VAWithConfidence[]): VAWithConfidence {
  let vSum = 0;
  let aSum = 0;
  let weightSum = 0;
  for (const r of results) {
    const w = r.confidence;
    vSum += r.v * w;
    aSum += r.a * w;
    weightSum += w;
  }
  if (weightSum === 0) {
    return { v: 0.5, a: 0.4, confidence: 0.3, source: 'fallback_default' };
  }
  // 融合后置信度取最大值(多源印证,置信度提升)
  const maxConfidence = Math.max(...results.map((r) => r.confidence));
  return {
    v: vSum / weightSum,
    a: aSum / weightSum,
    confidence: Math.min(1, maxConfidence + 0.05), // 多源印证 +0.05
    source: results[0]!.source, // 取第一个源
  };
}

// ============================================================================
// 7. 工具:从 Song 对象提取 V-A(若已标注则直接返回)
// ============================================================================

/**
 * 获取歌曲的 V-A(若 song.va 已有标注则直接返回,否则用 songToVA 估算)
 */
export async function getSongVA(song: Song): Promise<VAWithConfidence> {
  // 若已有标注且来源非默认,直接返回
  if (song.va.source !== 'fallback_default' && song.va.confidence > 0.3) {
    return song.va;
  }
  // 重新估算
  return songToVA({
    neteaseTags: song.neteaseTags,
    spotifyFeatures: song.spotifyFeatures,
    title: song.title,
    artist: song.artist,
  });
}
