/**
 * Vercel Serverless Function — Qwen-VL 照片情绪分析
 *
 * 接收 POST { imageDataUrl }(前端已压缩到长边 1024px),
 * 服务端从 process.env.QWEN_API_KEY 读 key(不打进前端包),
 * 调用百炼 OpenAI 兼容接口,返回校验后的 PhotoFeatures JSON。
 *
 * 本地开发:vite.config.ts 的 configureServer 插件会加载此模块处理 /api/vision。
 * 生产环境:Vercel 自动识别 api/ 目录部署为 Serverless Function。
 */

import type { PhotoFeatures } from '@algorithm/index';
import type {
  BrightnessLevel,
  Composition,
  FaceEmotion,
  SceneType,
  SaturationLevel,
  TimeOfDay,
  Tone,
  Weather,
} from '@algorithm/index';

// ---------------------------------------------------------------------------
// 常量(从 visionApi.ts 原样搬过来,逻辑一行不改)
// ---------------------------------------------------------------------------

const QWEN_ENDPOINT =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const QWEN_MODEL = 'qwen3-vl-plus';

const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// 枚举合法值(从 src/algorithm/types.ts 原样抄录,用于 prompt + 校验)
// ---------------------------------------------------------------------------

const SCENE_TYPES: readonly SceneType[] = [
  'nature', 'city', 'indoor', 'people', 'food', 'architecture', 'heritage',
  'sports', 'vehicle', 'pet', 'art', 'sky',
  'beach', 'mountain', 'forest', 'museum', 'street', 'nightlife',
  'park', 'garden', 'lake', 'bridge', 'temple', 'snow',
] as const;

const TIME_OF_DAY: readonly TimeOfDay[] = [
  'dawn', 'early_morning', 'morning', 'noon', 'afternoon', 'daytime',
  'golden_hour', 'dusk', 'blue_hour', 'evening', 'night', 'late_night', 'midnight',
] as const;

const WEATHER_TYPES: readonly Weather[] = [
  'sunny', 'cloudy', 'overcast', 'rainy', 'drizzle', 'thunderstorm',
  'snowy', 'foggy', 'haze', 'breezy', 'starry', 'humid', 'windy', 'sleet',
] as const;

const TONE_TYPES: readonly Tone[] = ['warm', 'cool', 'neutral'] as const;

const BRIGHTNESS_LEVELS: readonly BrightnessLevel[] = ['high', 'mid', 'low'] as const;

const SATURATION_LEVELS: readonly SaturationLevel[] = ['high', 'mid', 'low'] as const;

const COMPOSITION_TYPES: readonly Composition[] = [
  'closeup', 'portrait', 'subject', 'landscape', 'panorama', 'symmetry', 'aerial',
  'rule_of_thirds', 'silhouette', 'bokeh', 'negative_space',
  'leading_lines', 'golden_ratio', 'framing', 'centered',
] as const;

const FACE_EMOTIONS: readonly FaceEmotion[] = [
  'smile', 'neutral', 'sad', 'excited', 'surprised', 'thoughtful', 'focused', 'none',
  'laughing', 'crying', 'angry', 'in_love', 'proud', 'calm',
  'bored', 'determined', 'shy', 'grateful', 'content', 'confused',
] as const;

const DEFAULTS = {
  tone: 'neutral' as Tone,
  brightness: 'mid' as BrightnessLevel,
  saturation: 'mid' as SaturationLevel,
  scene: 'indoor' as SceneType,
  timeOfDay: 'daytime' as TimeOfDay,
  weather: 'sunny' as Weather,
  faceEmotion: 'none' as FaceEmotion,
  composition: 'subject' as Composition,
};

// ---------------------------------------------------------------------------
// Prompt 构造(从 visionApi.ts 原样搬过来)
// ---------------------------------------------------------------------------

function buildPrompt(): string {
  return [
    '你是照片情绪分析专家。分析这张照片,输出严格的 JSON(不要任何多余文字、不要 markdown 围栏)。',
    'JSON 字段如下,所有字段必填:',
    '',
    '{',
    '  "hue": { "hue": <0-360 整数>, "tone": <warm|cool|neutral>, "confidence": <0-1> },',
    '  "luminance": { "value": <0-1>, "level": <high|mid|low>, "confidence": <0-1> },',
    '  "saturation": { "value": <0-1>, "level": <high|mid|low>, "confidence": <0-1> },',
    '  "scene": { "type": <场景枚举之一>, "confidence": <0-1> },',
    '  "timeOfDay": { "value": <时段枚举之一>, "confidence": <0-1> },',
    '  "weather": { "value": <天气枚举之一>, "confidence": <0-1> },',
    '  "people": { "count": <非负整数>, "dominantEmotion": <表情枚举之一>, "confidence": <0-1> },',
    '  "composition": { "type": <构图枚举之一>, "confidence": <0-1> },',
    '  "overallConfidence": <0-1>',
    '}',
    '',
    '枚举合法值(只能从中选,不准自创):',
    `- scene.type: ${SCENE_TYPES.join(' | ')}`,
    `- timeOfDay.value: ${TIME_OF_DAY.join(' | ')}`,
    `- weather.value: ${WEATHER_TYPES.join(' | ')}`,
    `- hue.tone: ${TONE_TYPES.join(' | ')}`,
    `- luminance.level: ${BRIGHTNESS_LEVELS.join(' | ')}`,
    `- saturation.level: ${SATURATION_LEVELS.join(' | ')}`,
    `- composition.type: ${COMPOSITION_TYPES.join(' | ')}`,
    `- people.dominantEmotion: ${FACE_EMOTIONS.join(' | ')}`,
    '',
    '判断要点:',
    '- 看照片实际内容判断场景/时段/人物/构图,不要只看颜色',
    '- 无人时 people.count=0、people.dominantEmotion=none',
    '- 室内场景优先判 indoor,城市街景判 city,纯天空判 sky',
    '- confidence 反映你对这个判断的把握,0.5 以下表示很不确定',
    '- overallConfidence 是整体分析置信度,通常取各字段平均',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 响应解析 + 校验(从 visionApi.ts 原样搬过来)
// ---------------------------------------------------------------------------

function stripFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1]!.trim();
  return trimmed;
}

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function validateEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

function normalizeFeatures(raw: Record<string, unknown>): PhotoFeatures {
  const hue = (raw.hue ?? {}) as Record<string, unknown>;
  const luminance = (raw.luminance ?? {}) as Record<string, unknown>;
  const saturation = (raw.saturation ?? {}) as Record<string, unknown>;
  const scene = (raw.scene ?? {}) as Record<string, unknown>;
  const timeOfDay = (raw.timeOfDay ?? {}) as Record<string, unknown>;
  const weather = (raw.weather ?? {}) as Record<string, unknown>;
  const people = (raw.people ?? {}) as Record<string, unknown>;
  const composition = (raw.composition ?? {}) as Record<string, unknown>;

  return {
    hue: {
      hue: clamp(hue.hue, 0, 360, 0),
      tone: validateEnum(hue.tone, TONE_TYPES, DEFAULTS.tone),
      confidence: clamp(hue.confidence, 0, 1, 0.5),
    },
    luminance: {
      value: clamp(luminance.value, 0, 1, 0.5),
      level: validateEnum(luminance.level, BRIGHTNESS_LEVELS, DEFAULTS.brightness),
      confidence: clamp(luminance.confidence, 0, 1, 0.5),
    },
    saturation: {
      value: clamp(saturation.value, 0, 1, 0.5),
      level: validateEnum(saturation.level, SATURATION_LEVELS, DEFAULTS.saturation),
      confidence: clamp(saturation.confidence, 0, 1, 0.5),
    },
    scene: {
      type: validateEnum(scene.type, SCENE_TYPES, DEFAULTS.scene),
      confidence: clamp(scene.confidence, 0, 1, 0.5),
    },
    timeOfDay: {
      value: validateEnum(timeOfDay.value, TIME_OF_DAY, DEFAULTS.timeOfDay),
      confidence: clamp(timeOfDay.confidence, 0, 1, 0.5),
    },
    weather: {
      value: validateEnum(weather.value, WEATHER_TYPES, DEFAULTS.weather),
      confidence: clamp(weather.confidence, 0, 1, 0.5),
    },
    people: {
      count: Math.max(0, Math.floor(clamp(people.count, 0, 99, 0))),
      dominantEmotion: validateEnum(
        people.dominantEmotion,
        FACE_EMOTIONS,
        DEFAULTS.faceEmotion,
      ),
      confidence: clamp(people.confidence, 0, 1, 0.5),
    },
    composition: {
      type: validateEnum(composition.type, COMPOSITION_TYPES, DEFAULTS.composition),
      confidence: clamp(composition.confidence, 0, 1, 0.5),
    },
    overallConfidence: clamp(raw.overallConfidence, 0, 1, 0.5),
  };
}

// ---------------------------------------------------------------------------
// 核心分析函数(Vercel handler 和 Vite dev middleware 共用)
// ---------------------------------------------------------------------------

/**
 * 用 Qwen-VL 分析照片,返回 PhotoFeatures。
 *
 * @param imageDataUrl 图片 data URL(前端已压缩到长边 1024)
 * @param apiKey 百炼 API key(由调用方从 process.env.QWEN_API_KEY 传入)
 * @throws 网络错误/超时/HTTP 非 2xx/响应无法解析
 */
export async function analyzePhotoWithQwenServer(
  imageDataUrl: string,
  apiKey: string,
): Promise<PhotoFeatures> {
  const body = {
    model: QWEN_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: buildPrompt() },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(QWEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Qwen-VL HTTP ${resp.status}: ${errText.slice(0, 120)}`);
  }

  const data = await resp.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  let textContent: string;
  if (typeof content === 'string') {
    textContent = content;
  } else if (Array.isArray(content)) {
    const textItem = content.find(
      (c): c is { type: string; text: string } =>
        typeof c === 'object' && c !== null && (c as { type: string }).type === 'text',
    );
    textContent = textItem?.text ?? '';
  } else {
    throw new Error('Qwen-VL 返回格式异常:无 content 字段');
  }

  if (!textContent) {
    throw new Error('Qwen-VL 返回空内容');
  }

  const stripped = stripFence(textContent);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error('Qwen-VL 返回非合法 JSON');
  }

  return normalizeFeatures(parsed);
}

// ---------------------------------------------------------------------------
// Vercel Serverless Function 入口
// ---------------------------------------------------------------------------

/**
 * Vercel handler:接收 POST { imageDataUrl },返回 PhotoFeatures JSON。
 * Vercel 会自动解析 JSON body 到 req.body。
 */
export default async function handler(
  req: { method?: string; body?: { imageDataUrl?: string } },
  res: {
    status: (code: number) => { json: (data: unknown) => void };
  },
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, use POST' });
    return;
  }

  const { imageDataUrl } = req.body ?? {};
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    res.status(400).json({ error: 'Missing or invalid imageDataUrl in body' });
    return;
  }

  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    res.status(500).json({ error: 'Server QWEN_API_KEY not configured' });
    return;
  }

  try {
    const features = await analyzePhotoWithQwenServer(imageDataUrl, apiKey);
    res.status(200).json(features);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown server error';
    res.status(500).json({ error: message });
  }
}
