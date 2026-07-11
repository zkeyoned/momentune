/**
 * 阿里百炼 Qwen-VL 视觉大模型 — 真实照片情绪分析
 *
 * 调用百炼 OpenAI 兼容接口,让 qwen-vl-plus 直接输出 PhotoFeatures JSON。
 * 相比 photoHeuristic.ts 的 Canvas 像素统计,Qwen-VL 能真正"看懂"照片内容
 * (场景/人物/时段/构图),而非只按颜色猜模板。
 *
 * 降级链:Qwen-VL → Canvas 像素统计(photoHeuristic) → 随机兜底。
 * 本模块只负责第一层,失败时抛错由调用方降级。
 *
 * API key 从 import.meta.env.VITE_QWEN_API_KEY 读取,
 * 真实 .env 由用户自行创建(见 .env.example),不入库不索要。
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
// 常量
// ---------------------------------------------------------------------------

/** 百炼 OpenAI 兼容接口地址 */
const QWEN_ENDPOINT =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

/** 视觉模型:qwen3-vl-plus 是当前活跃的专用视觉模型(qwen-vl-plus 的升级替代) */
const QWEN_MODEL = 'qwen3-vl-plus';

/** 请求超时:10 秒,超时走降级,不让用户干等 */
const REQUEST_TIMEOUT_MS = 10_000;

/** 图片压缩:长边上限 1024px,省 token 提速,不影响视觉判断 */
const MAX_IMAGE_SIDE = 1024;

/** 压缩后 JPEG 质量 */
const COMPRESS_QUALITY = 0.85;

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

/** 枚举校验失败时的默认值(选最中性的) */
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
// 图片压缩:长边 ≤ 1024px
// ---------------------------------------------------------------------------

/**
 * 把 dataUrl 图片压缩到长边 MAX_IMAGE_SIDE 以内,返回 JPEG dataUrl。
 * 已经足够小时不重绘,直接返回原值省一次编码。
 */
function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const longSide = Math.max(width, height);
      // 已经够小,直接返回原 dataUrl
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
// Prompt 构造
// ---------------------------------------------------------------------------

/**
 * 构造给 Qwen-VL 的 prompt。
 *
 * 关键约束:
 *  - 只输出 JSON,不要任何多余文字、不要 markdown 围栏
 *  - 所有枚举只能从给定列表里选
 *  - 数值字段严格在指定范围
 *  - 字段名与 PhotoFeatures 类型一一对应
 */
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
// 响应解析 + 校验
// ---------------------------------------------------------------------------

/** 去除可能的 markdown 围栏(```json ... ``` 或 ``` ... ```) */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  // 匹配开头的 ```json 或 ``` 和结尾的 ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1]!.trim();
  return trimmed;
}

/** 数值夹紧到 [min, max] */
function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** 枚举校验:不在合法集合里返回 default */
function validateEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

/**
 * 把模型返回的 raw JSON 逐字段校验、修正为合法 PhotoFeatures。
 * 任何字段缺失/非法都会用默认值修正,不抛错(尽量救回来)。
 * 只有整个 JSON 都 parse 不了时才在上游抛错。
 */
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
// 主入口
// ---------------------------------------------------------------------------

/**
 * 无 API key 时返回确定性 mock 照片特征。
 * 不依赖网络,不抛错,让 demo 流程顺畅走通。
 */
function getMockFeatures(): PhotoFeatures {
  return {
    hue: {
      hue: 35,
      tone: 'warm',
      confidence: 0.5,
    },
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

/**
 * 用 Qwen-VL 分析照片,返回 PhotoFeatures。
 *
 * 失败情况(均抛错,由调用方降级):
 *  - 未配置 API key(VITE_QWEN_API_KEY 为空)
 *  - 网络错误 / 超时(10s)
 *  - HTTP 非 2xx
 *  - 响应无法解析为合法 JSON
 *
 * @param imageDataUrl 图片 data URL(原始尺寸,内部会压缩到长边 1024)
 */
export async function analyzePhotoWithQwen(
  imageDataUrl: string,
): Promise<PhotoFeatures> {
  const apiKey = import.meta.env.VITE_QWEN_API_KEY;
  // key 为空:返回确定性 mock 特征,不发请求,不抛错
  if (!apiKey || apiKey.trim() === '') {
    return getMockFeatures();
  }

  // 压缩图片,省 token 提速
  const compressed = await compressImage(imageDataUrl);

  const body = {
    model: QWEN_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: compressed } },
          { type: 'text', text: buildPrompt() },
        ],
      },
    ],
  };

  // 10 秒超时,超时走降级
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
    // abort 超时 或 网络错误
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
  // OpenAI 兼容格式:choices[0].message.content
  // Qwen-VL 通常返回字符串,但偶尔回退为数组 [{type:'text', text:'...'}]
  const content: unknown = data?.choices?.[0]?.message?.content;
  let textContent: string;
  if (typeof content === 'string') {
    textContent = content;
  } else if (Array.isArray(content)) {
    // 取第一个 text 项
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

  // 逐字段校验修正(尽量救,不轻易抛错)
  return normalizeFeatures(parsed);
}
