/**
 * 照片情绪分析 — 前端入口
 *
 * 调用服务端 /api/vision(Vercel Serverless Function / Vite dev middleware),
 * 服务端从 process.env.QWEN_API_KEY 读 key,调百炼 Qwen-VL,返回 PhotoFeatures。
 * API key 不出现在前端代码中,部署到公网后 F12 看不到 key。
 *
 * 降级链:Qwen-VL(服务端) → Canvas 像素统计(photoHeuristic) → 随机兜底。
 * 本模块只负责第一层,失败时抛错由调用方降级。
 *
 * 前端保留的职责:
 *  - 图片压缩(长边 ≤ 1024px,省带宽、提速)
 *  - 10 秒超时(超时走降级)
 *  - 服务端未配置 key 时返回确定性 mock 特征(让 demo 流程顺畅)
 */

import type { PhotoFeatures } from '@algorithm/index';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 请求超时:10 秒,超时走降级,不让用户干等 */
const REQUEST_TIMEOUT_MS = 10_000;

/** 图片压缩:长边上限 1024px,省带宽提速,不影响视觉判断 */
const MAX_IMAGE_SIDE = 1024;

/** 压缩后 JPEG 质量 */
const COMPRESS_QUALITY = 0.85;

// ---------------------------------------------------------------------------
// 图片压缩:长边 ≤ 1024px(浏览器 Canvas,留在前端)
// ---------------------------------------------------------------------------

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const longSide = Math.max(width, height);
      if (longSide <= MAX_IMAGE_SIDE) {
        resolve(dataUrl);
        return;
      }
      const scale = MAX_IMAGE_SIDE / longSide;
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context 不可用'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', COMPRESS_QUALITY));
    };
    img.onerror = () => reject(new Error('图片加载失败,无法压缩'));
    img.src = dataUrl;
  });
}

// ---------------------------------------------------------------------------
// Mock 特征(服务端未配置 key 时用,不发请求,不抛错)
// ---------------------------------------------------------------------------

function getMockFeatures(): PhotoFeatures {
  return {
    hue: { hue: 35, tone: 'warm', confidence: 0.5 },
    luminance: { value: 0.55, level: 'mid', confidence: 0.5 },
    saturation: { value: 0.6, level: 'mid', confidence: 0.5 },
    scene: { type: 'nature', confidence: 0.5 },
    timeOfDay: { value: 'golden_hour', confidence: 0.5 },
    weather: { value: 'sunny', confidence: 0.5 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.5 },
    composition: { type: 'landscape', confidence: 0.5 },
    overallConfidence: 0.5,
  };
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 用 Qwen-VL 分析照片,返回 PhotoFeatures。
 *
 * 流程:压缩图片 → POST /api/vision → 解析响应
 *
 * 失败情况(均抛错,由调用方降级到 Canvas):
 *  - 网络错误 / 超时(10s)
 *  - HTTP 非 2xx(不含 "未配置 key" 的情况)
 *  - 响应无法解析
 *
 * 特殊情况(不抛错,返回 mock 特征):
 *  - 服务端返回 500 且错误信息含 "not configured"(未配 API key)
 *
 * @param imageDataUrl 图片 data URL(原始尺寸,内部会压缩到长边 1024)
 */
export async function analyzePhotoWithQwen(
  imageDataUrl: string,
): Promise<PhotoFeatures> {
  // 压缩图片,省带宽提速
  const compressed = await compressImage(imageDataUrl);

  // 10 秒超时,超时走降级
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: compressed }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Qwen-VL 请求超时(10s)');
    }
    throw new Error(`Qwen-VL 网络错误: ${e instanceof Error ? e.message : '未知'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  // 服务端未配置 API key:返回 mock 特征,不发请求,不抛错
  if (resp.status === 500) {
    const errBody = await resp.json().catch(() => ({}));
    if (typeof errBody?.error === 'string' && errBody.error.includes('not configured')) {
      return getMockFeatures();
    }
    throw new Error(`Qwen-VL 服务端错误: ${errBody?.error ?? resp.status}`);
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Qwen-VL HTTP ${resp.status}: ${errText.slice(0, 120)}`);
  }

  // 成功:返回 PhotoFeatures JSON
  return await resp.json();
}
