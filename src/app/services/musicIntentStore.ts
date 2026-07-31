/**
 * MusicIntent localStorage 外存
 *
 * 用途:
 *  - 同一张照片不重复调 Qwen-VL(省 token),用图片 hash 做 key 缓存 MusicIntent
 *  - 支持手动微调 moodTags:保留 AI 原始输出 + 微调历史,不丢失
 *
 * 存储 layout:
 *  - 条目 key:`momentune:mi:<imageHash>` → StoreEntry(JSON)
 *  - 索引 key:`momentune:mi:index` → IndexEntry[](JSON),用于 LRU
 *
 * LRU / 过期策略:
 *  - save 时索引超 50 条 → 按 lastAccessedAt 升序删除最旧的
 *  - get 时单条 lastAccessedAt 超 30 天 → 删除该条目并返回 null
 *
 * hashImage 用 dHash 算法(17×16 像素,相邻像素比较生成 256 位指纹,转 64 字符 hex),
 * 同一图片(像素相同)总是输出同一 hash。
 */

import type { MusicIntent } from '@algorithm/index';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'momentune:mi:';
const INDEX_KEY = 'momentune:mi:index';

/** 索引最大条数,超过按 LRU 删除最旧 */
const MAX_ENTRIES = 50;

/** 单条过期阈值:30 天未访问 → 删除 */
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000;

/** 手动微调历史最多保留条数 */
const MAX_HISTORY = 5;

/** dHash 采样尺寸:宽 17(多 1 列用于相邻比较) × 高 16 */
const DHASH_WIDTH = 17;
const DHASH_HEIGHT = 16;

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** localStorage 中单条 MusicIntent 缓存条目 */
interface StoreEntry {
  /** 当前生效的 MusicIntent(AI 原始或最近一次手动微调) */
  intent: MusicIntent;
  /** AI 原始输出(手动微调时不丢失,首次写入时 = intent) */
  originalAIOutput?: MusicIntent;
  /** 手动微调历史(每次微调把上一版 intent 推入),最多 MAX_HISTORY 条 */
  history?: MusicIntent[];
  /** 首次创建时间戳 */
  createdAt: number;
  /** 最近访问时间戳(用于 LRU 与过期判断) */
  lastAccessedAt: number;
}

/** 索引条目:记录所有缓存的 imageHash + 最近访问时间 */
interface IndexEntry {
  imageHash: string;
  lastAccessedAt: number;
}

// ---------------------------------------------------------------------------
// dHash 核心算法(纯函数,便于测试)
// ---------------------------------------------------------------------------

/** RGB → 灰度(ITU-R BT.601 加权) */
function toGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * dHash 核心:输入 17×16 像素的 RGBA 数据,输出 64 字符 hex 字符串
 *
 * 算法:
 *  1. 每行 17 像素 → 16 次相邻比较(左 > 右 记 1,否则 0)
 *  2. 16 行 × 16 = 256 位
 *  3. 每 4 位转 1 个 hex 字符 → 64 字符
 *
 * 同一像素数据总是输出同一 hash。
 */
export function dHashFromPixels(data: Uint8ClampedArray): string {
  const bits: number[] = [];
  for (let row = 0; row < DHASH_HEIGHT; row++) {
    for (let col = 0; col < DHASH_WIDTH - 1; col++) {
      const idxLeft = (row * DHASH_WIDTH + col) * 4;
      const idxRight = (row * DHASH_WIDTH + col + 1) * 4;
      const leftGray = toGray(
        data[idxLeft]!,
        data[idxLeft + 1]!,
        data[idxLeft + 2]!,
      );
      const rightGray = toGray(
        data[idxRight]!,
        data[idxRight + 1]!,
        data[idxRight + 2]!,
      );
      bits.push(leftGray > rightGray ? 1 : 0);
    }
  }
  // 256 bits → 64 hex chars(每 4 位一个 nibble)
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble =
      (bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!;
    hex += nibble.toString(16);
  }
  return hex;
}

// ---------------------------------------------------------------------------
// 图片加载(Canvas 绘制需要 HTMLImageElement)
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src.slice(0, 40)}`));
    img.src = src;
  });
}

/**
 * 对图片做 dHash,输出稳定的 64 字符 hex 字符串
 *
 * 同一图片(像素相同)总是输出同一 hash,用于 localStorage 缓存 key。
 * 非浏览器环境(SSR,无 document)返回空字符串,不抛错。
 * 任何环节失败(跨域/非图片/Canvas 不可用)返回空字符串,不抛错。
 *
 * @param imageDataUrl 图片 data URL(base64)
 */
export async function hashImage(imageDataUrl: string): Promise<string> {
  if (
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  ) {
    return '';
  }
  try {
    const img = await loadImage(imageDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = DHASH_WIDTH;
    canvas.height = DHASH_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, DHASH_WIDTH, DHASH_HEIGHT);
    const imageData = ctx.getImageData(0, 0, DHASH_WIDTH, DHASH_HEIGHT);
    return dHashFromPixels(imageData.data);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// localStorage 安全访问(避免 SSR / quota 异常炸栈)
// ---------------------------------------------------------------------------

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota exceeded 或其他错误:静默忽略,缓存非关键路径
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function entryKey(imageHash: string): string {
  return `${KEY_PREFIX}${imageHash}`;
}

// ---------------------------------------------------------------------------
// 索引读写
// ---------------------------------------------------------------------------

function readIndex(): IndexEntry[] {
  const raw = safeGet(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (e): e is IndexEntry =>
          e != null &&
          typeof e.imageHash === 'string' &&
          typeof e.lastAccessedAt === 'number',
      );
    }
    return [];
  } catch {
    return [];
  }
}

function writeIndex(entries: IndexEntry[]): void {
  safeSet(INDEX_KEY, JSON.stringify(entries));
}

// ---------------------------------------------------------------------------
// LRU / 过期清理
// ---------------------------------------------------------------------------

/** 删除指定 hash 的条目和索引项 */
function removeEntry(imageHash: string): void {
  safeRemove(entryKey(imageHash));
  const entries = readIndex();
  const filtered = entries.filter((e) => e.imageHash !== imageHash);
  if (filtered.length !== entries.length) {
    writeIndex(filtered);
  }
}

/**
 * LRU 清理:索引超 MAX_ENTRIES 时,按 lastAccessedAt 升序删除最旧的
 * 直到条数 ≤ MAX_ENTRIES
 *
 * 同毫秒处理:save/get 维护索引时把命中条目移到数组末尾(最近访问在尾),
 * 故数组顺序即访问顺序(旧→新)。sort 在 lastAccessedAt 相同时返回 0,
 * 依赖 ES2019+ 稳定排序保持数组顺序,从而在同毫秒内仍能按访问顺序区分 LRU。
 */
function enforceLRU(): void {
  let entries = readIndex();
  if (entries.length <= MAX_ENTRIES) return;
  // 升序(旧→新);lastAccessedAt 相同时稳定排序保持数组访问顺序
  entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
  for (const e of toRemove) {
    safeRemove(entryKey(e.imageHash));
  }
  writeIndex(entries.slice(toRemove.length));
}

// ---------------------------------------------------------------------------
// get / save / clear / updateManually
// ---------------------------------------------------------------------------

/**
 * 读取缓存的 MusicIntent
 *
 * - 命中且未过期:更新 lastAccessedAt,返回 intent
 * - 命中但超 30 天未访问:删除条目,返回 null
 * - 未命中:返回 null
 */
export function get(imageHash: string): MusicIntent | null {
  if (!imageHash) return null;
  const now = Date.now();
  const raw = safeGet(entryKey(imageHash));
  if (!raw) return null;
  let entry: StoreEntry;
  try {
    entry = JSON.parse(raw) as StoreEntry;
  } catch {
    return null;
  }
  // 过期清理:超 30 天未访问 → 删除
  if (now - entry.lastAccessedAt > EXPIRE_MS) {
    removeEntry(imageHash);
    return null;
  }
  // 更新访问时间
  entry.lastAccessedAt = now;
  safeSet(entryKey(imageHash), JSON.stringify(entry));
  // 同步索引:把命中条目移到数组末尾(最近访问),保证同毫秒内 LRU 仍能按访问顺序区分
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.imageHash === imageHash);
  if (idx >= 0) {
    const [hit] = entries.splice(idx, 1);
    hit!.lastAccessedAt = now;
    entries.push(hit!);
    writeIndex(entries);
  } else {
    // 索引缺失(可能被外部清过),补一条
    entries.push({ imageHash, lastAccessedAt: now });
    writeIndex(entries);
    enforceLRU();
  }
  return entry.intent;
}

/**
 * 写入缓存的 MusicIntent
 *
 * @param opts.isManualEdit true 表示手动微调:把旧 intent 推入 history,
 *   保留 originalAIOutput(首次设置时 = 旧 intent);false/缺省表示 AI 写入
 */
export function save(
  imageHash: string,
  intent: MusicIntent,
  opts?: { isManualEdit?: boolean },
): void {
  if (!imageHash) return;
  const now = Date.now();
  const key = entryKey(imageHash);
  const existingRaw = safeGet(key);
  let existing: StoreEntry | null = null;
  if (existingRaw) {
    try {
      existing = JSON.parse(existingRaw) as StoreEntry;
    } catch {
      existing = null;
    }
  }

  if (opts?.isManualEdit && existing) {
    // 手动微调:旧 intent 推入 history,保留 originalAIOutput
    const history = existing.history ? [...existing.history] : [];
    history.push(existing.intent);
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }
    const entry: StoreEntry = {
      intent,
      originalAIOutput: existing.originalAIOutput ?? existing.intent,
      history,
      createdAt: existing.createdAt,
      lastAccessedAt: now,
    };
    safeSet(key, JSON.stringify(entry));
  } else {
    // AI 首次写入或覆盖:originalAIOutput 仅在首次设置,后续 AI 重写不覆盖
    const entry: StoreEntry = {
      intent,
      originalAIOutput: existing?.originalAIOutput ?? intent,
      history: existing?.history ?? [],
      createdAt: existing?.createdAt ?? now,
      lastAccessedAt: now,
    };
    safeSet(key, JSON.stringify(entry));
  }

  // 更新索引:命中条目移到末尾(最近访问),保证同毫秒内 LRU 仍能按访问顺序区分
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.imageHash === imageHash);
  if (idx >= 0) {
    const [hit] = entries.splice(idx, 1);
    hit!.lastAccessedAt = now;
    entries.push(hit!);
  } else {
    entries.push({ imageHash, lastAccessedAt: now });
  }
  writeIndex(entries);
  enforceLRU();
}

/**
 * 手动微调:等价于 save(hash, newIntent, { isManualEdit: true })
 * 把上一版 intent 推入 history,保留 originalAIOutput
 */
export function updateManually(
  imageHash: string,
  newIntent: MusicIntent,
): void {
  save(imageHash, newIntent, { isManualEdit: true });
}

/**
 * 清空所有 momentune:mi: 前缀的条目(含索引)
 * 兜底遍历 localStorage,防止索引与实际条目不一致
 */
export function clear(): void {
  const entries = readIndex();
  for (const e of entries) {
    safeRemove(entryKey(e.imageHash));
  }
  safeRemove(INDEX_KEY);
  // 兜底:遍历所有 key,删除前缀匹配的
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      safeRemove(k);
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// 统一导出
// ---------------------------------------------------------------------------

export const musicIntentStore = {
  hashImage,
  get,
  save,
  clear,
  updateManually,
};
