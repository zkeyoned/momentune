/**
 * 伪 AI 照片特征估计 — Canvas 像素分析 + 模板匹配 + 随机兜底
 *
 * demo 阶段没有真实视觉模型,用 Canvas 对照片做轻量像素分析:
 *  1. 缩放到 64×64,遍历像素,RGB→HSL
 *  2. 统计 hue(环形均值)/luminance/saturation 三个维度
 *  3. 与 SAMPLE_PHOTOS 模板做加权距离匹配(hue 0.4 / lum 0.35 / sat 0.25)
 *  4. 取最接近的模板,继承其 scene/timeOfDay/weather/people/composition
 *  5. 置信度统一压低(heuristic 来源,明显低于视觉模型)
 *
 * 任一步骤失败(跨域图片/非图片/Canvas 不可用)→ 随机选一个模板兜底,
 * 保证流程不中断。
 */

import type { PhotoFeatures } from '@algorithm/index';
import {
  BRIGHTNESS_LEVELS,
  SATURATION_LEVELS,
  type BrightnessLevel,
  type SaturationLevel,
  type Tone,
} from '@algorithm/index';
import { SAMPLE_PHOTOS } from './mockApi';

/** 权重:模板匹配时三个维度的加权 */
const W_HUE = 0.4;
const W_LUM = 0.35;
const W_SAT = 0.25;

/** 缩采样尺寸:64×64 足够统计颜色,运算量小 */
const SAMPLE_SIZE = 64;

/** heuristic 来源的统一置信度(明显低于视觉模型的 0.8+) */
const HEURISTIC_CONFIDENCE = 0.55;
const HEURISTIC_OVERALL = 0.5;

// ---------------------------------------------------------------------------
// RGB → HSL
// ---------------------------------------------------------------------------

interface HSL {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

// ---------------------------------------------------------------------------
// 环形均值(色调是环形量,不能直接算术平均)
// ---------------------------------------------------------------------------

function circularMean(hues: number[]): number {
  if (hues.length === 0) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (const h of hues) {
    const rad = (h * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  let deg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/** 环形距离:0-180(两点在色环上的最短弧) */
function circularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ---------------------------------------------------------------------------
// 派生分类
// ---------------------------------------------------------------------------

function deriveTone(hue: number): Tone {
  // 暖:0-60 & 300-360;冷:180-300;中性:60-180 附近低饱和过渡带
  if ((hue >= 0 && hue < 60) || hue >= 300) return 'warm';
  if (hue >= 180 && hue < 300) return 'cool';
  return 'neutral';
}

function deriveBrightnessLevel(lum: number): BrightnessLevel {
  if (lum >= 0.55) return 'high';
  if (lum >= 0.3) return 'mid';
  return 'low';
}

function deriveSaturationLevel(sat: number): SaturationLevel {
  if (sat >= 0.6) return 'high';
  if (sat >= 0.3) return 'mid';
  return 'low';
}

// ---------------------------------------------------------------------------
// 像素统计核心
// ---------------------------------------------------------------------------

interface PixelStats {
  hue: number;
  luminance: number;
  saturation: number;
}

function computePixelStats(data: Uint8ClampedArray): PixelStats {
  const hues: number[] = [];
  let lumSum = 0;
  let satSum = 0;
  let count = 0;
  // 步长 4(RGBA),每帧 64*64=4096 像素
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const alpha = data[i + 3]!;
    if (alpha < 10) continue; // 跳过透明像素
    const { h, s, l } = rgbToHsl(r, g, b);
    // 极低饱和度的像素对色调统计贡献小且不稳定,加权剔除
    if (s > 0.08) hues.push(h);
    lumSum += l;
    satSum += s;
    count++;
  }
  if (count === 0) {
    return { hue: 0, luminance: 0.5, saturation: 0 };
  }
  return {
    hue: hues.length > 0 ? circularMean(hues) : 0,
    luminance: lumSum / count,
    saturation: satSum / count,
  };
}

// ---------------------------------------------------------------------------
// 模板匹配
// ---------------------------------------------------------------------------

/** 加权距离:越小越接近。hue 用环形距离,lum/sat 用绝对差 */
function templateDistance(
  stats: PixelStats,
  template: PhotoFeatures,
): number {
  const hueDist = circularDistance(stats.hue, template.hue.hue);
  const lumDist = Math.abs(stats.luminance - template.luminance.value);
  const satDist = Math.abs(stats.saturation - template.saturation.value);
  return W_HUE * hueDist + W_LUM * lumDist + W_SAT * satDist;
}

/** 在 SAMPLE_PHOTOS 模板里找最接近的一个,返回其 features */
function matchTemplate(stats: PixelStats): PhotoFeatures {
  let best = SAMPLE_PHOTOS[0]!.features;
  let bestDist = Infinity;
  for (const sample of SAMPLE_PHOTOS) {
    const d = templateDistance(stats, sample.features);
    if (d < bestDist) {
      bestDist = d;
      best = sample.features;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 组装 PhotoFeatures
// ---------------------------------------------------------------------------

function buildFeatures(stats: PixelStats, template: PhotoFeatures): PhotoFeatures {
  const tone = deriveTone(stats.hue);
  const brightnessLevel = deriveBrightnessLevel(stats.luminance);
  const satLevel = deriveSaturationLevel(stats.saturation);
  return {
    hue: { hue: Math.round(stats.hue), tone, confidence: HEURISTIC_CONFIDENCE },
    luminance: {
      value: Number(stats.luminance.toFixed(3)),
      level: brightnessLevel,
      confidence: HEURISTIC_CONFIDENCE,
    },
    saturation: {
      value: Number(stats.saturation.toFixed(3)),
      level: satLevel,
      confidence: HEURISTIC_CONFIDENCE,
    },
    // 以下维度无法从像素统计可靠推断,继承模板
    scene: { type: template.scene.type, confidence: HEURISTIC_CONFIDENCE * 0.9 },
    timeOfDay: { value: template.timeOfDay.value, confidence: HEURISTIC_CONFIDENCE * 0.85 },
    weather: { value: template.weather.value, confidence: HEURISTIC_CONFIDENCE * 0.8 },
    people: {
      count: template.people.count,
      dominantEmotion: template.people.dominantEmotion,
      confidence: HEURISTIC_CONFIDENCE * 0.7,
    },
    composition: { type: template.composition.type, confidence: HEURISTIC_CONFIDENCE * 0.75 },
    overallConfidence: HEURISTIC_OVERALL,
  };
}

// ---------------------------------------------------------------------------
// 随机兜底(Canvas 失败/跨域/非图片时)
// ---------------------------------------------------------------------------

function randomFallback(): PhotoFeatures {
  const template =
    SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)]!.features;
  // 深拷贝模板并压低置信度
  return {
    ...template,
    hue: { ...template.hue, confidence: 0.3 },
    luminance: { ...template.luminance, confidence: 0.3 },
    saturation: { ...template.saturation, confidence: 0.3 },
    scene: { ...template.scene, confidence: 0.3 },
    timeOfDay: { ...template.timeOfDay, confidence: 0.3 },
    weather: { ...template.weather, confidence: 0.3 },
    people: { ...template.people, confidence: 0.3 },
    composition: { ...template.composition, confidence: 0.3 },
    overallConfidence: 0.3,
  };
}

// ---------------------------------------------------------------------------
// 图片加载(Canvas 绘制需要 HTMLImageElement)
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // data URL / blob URL / 同源 URL 都不需要 crossOrigin;
    // 加 crossOrigin 反而可能导致带凭据的跨域图片加载失败
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src.slice(0, 40)}`));
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 对一张图片做伪 AI 特征估计
 *
 * @param imageSrc 图片 URL(data URL / blob URL / 同源路径)
 * @returns PhotoFeatures(失败时随机兜底,绝不 reject)
 */
export async function estimatePhotoFeatures(imageSrc: string): Promise<PhotoFeatures> {
  try {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return randomFallback();
    }
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const stats = computePixelStats(imageData.data);
    const template = matchTemplate(stats);
    return buildFeatures(stats, template);
  } catch {
    // 任何环节失败都不阻断流程,随机兜底
    return randomFallback();
  }
}

// ---------------------------------------------------------------------------
// 导出工具(便于测试)
// ---------------------------------------------------------------------------

export const __testing = {
  rgbToHsl,
  circularMean,
  circularDistance,
  deriveTone,
  deriveBrightnessLevel,
  deriveSaturationLevel,
  computePixelStats,
  matchTemplate,
  buildFeatures,
  W_HUE,
  W_LUM,
  W_SAT,
  BRIGHTNESS_LEVELS,
  SATURATION_LEVELS,
};
