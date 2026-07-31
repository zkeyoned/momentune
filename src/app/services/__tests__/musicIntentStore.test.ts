/**
 * musicIntentStore 单元测试
 *
 * 测试环境:node(vitest 默认),需要手动 mock 浏览器 API:
 *  - localStorage:用 Map 实现
 *  - Image:src setter 异步触发 onload
 *  - document.createElement:返回 mock canvas,getContext 返回 mock ctx
 *    ctx.getImageData 返回基于 src 确定性生成的像素(保证同 src 同 hash)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  musicIntentStore,
  hashImage,
  dHashFromPixels,
} from '../musicIntentStore';
import type { MusicIntent } from '@algorithm/index';

// ---------------------------------------------------------------------------
// mock localStorage(Map 实现)
// ---------------------------------------------------------------------------

class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, v);
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// mock Image / document.createElement
// ---------------------------------------------------------------------------

/** 当前正在加载的图片 src(用于 mock getImageData 返回确定性像素) */
let currentSrc = '';

/**
 * 基于 src 生成确定性像素数据(17×16×4 = 1088 bytes)
 * 保证同一 src 总是生成同一像素,从而 hashImage 稳定
 */
function makeMockPixels(seed: string): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(17 * 16 * 4);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < pixels.length; i += 4) {
    const v = (hash + i * 7) & 0xff;
    pixels[i] = v;
    pixels[i + 1] = (v * 2) & 0xff;
    pixels[i + 2] = (v * 3) & 0xff;
    pixels[i + 3] = 255;
  }
  return pixels;
}

class MockImage {
  width = 100;
  height = 100;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src(): string {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    currentSrc = value;
    // 异步触发 onload,模拟浏览器加载
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

function setupMockDom(): void {
  const mockCtx = {
    drawImage: () => {},
    getImageData: () => ({
      data: makeMockPixels(currentSrc),
      width: 17,
      height: 16,
    }),
  };
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => mockCtx,
  };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => mockCanvas,
  };
  (globalThis as unknown as { Image: unknown }).Image = MockImage;
}

// ---------------------------------------------------------------------------
// 测试用 MusicIntent 工厂
// ---------------------------------------------------------------------------

function makeIntent(tag: string): MusicIntent {
  return {
    moodTags: [tag],
    energyLevel: 'mid',
    genreHints: ['pop'],
    languageHint: 'mandarin',
    vibeDescription: `测试 ${tag}`,
  };
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('musicIntentStore', () => {
  beforeEach(() => {
    // 重置 localStorage + DOM mock
    const mem = new MemStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      mem as unknown as Storage;
    currentSrc = '';
    setupMockDom();
  });

  it('save 后 get 能取回 MusicIntent', () => {
    const intent = makeIntent('慵懒');
    musicIntentStore.save('hash-1', intent);
    const got = musicIntentStore.get('hash-1');
    expect(got).not.toBeNull();
    expect(got!.moodTags).toEqual(['慵懒']);
    expect(got!.energyLevel).toBe('mid');
    expect(got!.vibeDescription).toBe('测试 慵懒');
  });

  it('get 未命中返回 null', () => {
    expect(musicIntentStore.get('not-exist')).toBeNull();
  });

  it('同一 dataUrl hashImage 两次调用结果相同(稳定)', async () => {
    const dataUrl = 'data:image/png;base64,AAAA';
    const h1 = await hashImage(dataUrl);
    const h2 = await hashImage(dataUrl);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64); // 256 bits → 64 hex chars
  });

  it('不同 dataUrl hashImage 结果不同', async () => {
    const h1 = await hashImage('data:image/png;base64,AAAA');
    const h2 = await hashImage('data:image/png;base64,BBBB');
    expect(h1).not.toBe(h2);
  });

  it('dHashFromPixels 对同一像素数据输出相同 hash', () => {
    const pixels = makeMockPixels('abc');
    const h1 = dHashFromPixels(pixels);
    const h2 = dHashFromPixels(pixels);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
  });

  it('hashImage 非浏览器环境(SSR)返回空字符串', async () => {
    // 临时移除 document
    const savedDoc = (globalThis as unknown as { document?: unknown }).document;
    delete (globalThis as unknown as { document?: unknown }).document;
    try {
      const h = await hashImage('data:image/png;base64,AAAA');
      expect(h).toBe('');
    } finally {
      (globalThis as unknown as { document?: unknown }).document = savedDoc;
    }
  });

  it('LRU:save 51 条后最旧条目被清理', () => {
    // 写入 51 条,索引上限 50
    for (let i = 0; i < 51; i++) {
      musicIntentStore.save(`hash-lru-${i}`, makeIntent(`t${i}`));
    }
    // 第 0 条(hash-lru-0)应该已被清理(最旧)
    expect(musicIntentStore.get('hash-lru-0')).toBeNull();
    // 第 1 条也应被清理(LRU 删除 1 条)
    expect(musicIntentStore.get('hash-lru-1')).not.toBeNull();
    // 第 50 条(最新)应该存在
    expect(musicIntentStore.get('hash-lru-50')).not.toBeNull();

    // 索引条数应 ≤ 50
    const indexRaw = localStorage.getItem('momentune:mi:index');
    expect(indexRaw).not.toBeNull();
    const index = JSON.parse(indexRaw!) as Array<{ imageHash: string }>;
    expect(index.length).toBeLessThanOrEqual(50);
  });

  it('过期清理:lastAccessedAt 为 31 天前,get 时返回 null', () => {
    const hash = 'hash-expired';
    const intent = makeIntent('过期');
    musicIntentStore.save(hash, intent);

    // 手动改写 lastAccessedAt 为 31 天前
    const key = `momentune:mi:${hash}`;
    const raw = localStorage.getItem(key);
    expect(raw).not.toBeNull();
    const entry = JSON.parse(raw!) as {
      intent: MusicIntent;
      lastAccessedAt: number;
    };
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;
    entry.lastAccessedAt = Date.now() - thirtyOneDays;
    localStorage.setItem(key, JSON.stringify(entry));

    // 同步改索引,让 get 能命中条目
    const indexRaw = localStorage.getItem('momentune:mi:index');
    const index = JSON.parse(indexRaw!) as Array<{
      imageHash: string;
      lastAccessedAt: number;
    }>;
    const idx = index.findIndex((e) => e.imageHash === hash);
    if (idx >= 0) {
      index[idx]!.lastAccessedAt = Date.now() - thirtyOneDays;
      localStorage.setItem('momentune:mi:index', JSON.stringify(index));
    }

    // get 应触发过期清理,返回 null
    expect(musicIntentStore.get(hash)).toBeNull();
    // 条目应被删除
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('updateManually:原 AI 输出进入 history,originalAIOutput 保留', () => {
    const hash = 'hash-manual';
    const aiIntent = makeIntent('AI原始');
    // 首次 AI 写入
    musicIntentStore.save(hash, aiIntent);

    // 手动微调
    const manualIntent = makeIntent('手动微调');
    musicIntentStore.updateManually(hash, manualIntent);

    // get 返回微调后的 intent
    const got = musicIntentStore.get(hash);
    expect(got).not.toBeNull();
    expect(got!.moodTags).toEqual(['手动微调']);

    // 直接读 localStorage 验证 history 与 originalAIOutput
    const raw = localStorage.getItem(`momentune:mi:${hash}`);
    expect(raw).not.toBeNull();
    const entry = JSON.parse(raw!) as {
      intent: MusicIntent;
      originalAIOutput?: MusicIntent;
      history?: MusicIntent[];
    };
    // originalAIOutput 应保留 AI 原始输出
    expect(entry.originalAIOutput).toBeDefined();
    expect(entry.originalAIOutput!.moodTags).toEqual(['AI原始']);
    // history 应包含微调前的旧 intent(即 AI 原始)
    expect(entry.history).toBeDefined();
    expect(entry.history!.length).toBe(1);
    expect(entry.history![0]!.moodTags).toEqual(['AI原始']);
  });

  it('updateManually 多次微调:history 累积,最多 5 条', () => {
    const hash = 'hash-multi';
    musicIntentStore.save(hash, makeIntent('v0'));
    for (let i = 1; i <= 7; i++) {
      musicIntentStore.updateManually(hash, makeIntent(`v${i}`));
    }
    const raw = localStorage.getItem(`momentune:mi:${hash}`);
    const entry = JSON.parse(raw!) as {
      intent: MusicIntent;
      originalAIOutput?: MusicIntent;
      history?: MusicIntent[];
    };
    // history 上限 5
    expect(entry.history!.length).toBe(5);
    // originalAIOutput 仍是首次写入的 v0
    expect(entry.originalAIOutput!.moodTags).toEqual(['v0']);
    // 当前 intent 是最后一次微调
    expect(entry.intent.moodTags).toEqual(['v7']);
  });

  it('clear 清空所有 momentune:mi: 前缀的 key', () => {
    musicIntentStore.save('hash-a', makeIntent('a'));
    musicIntentStore.save('hash-b', makeIntent('b'));
    expect(musicIntentStore.get('hash-a')).not.toBeNull();
    musicIntentStore.clear();
    expect(musicIntentStore.get('hash-a')).toBeNull();
    expect(musicIntentStore.get('hash-b')).toBeNull();
    expect(localStorage.getItem('momentune:mi:index')).toBeNull();
  });

  it('get 命中时更新 lastAccessedAt(用于 LRU)', () => {
    // 写入 50 条填满索引
    for (let i = 0; i < 50; i++) {
      musicIntentStore.save(`hash-${i}`, makeIntent(`t${i}`));
    }
    // 访问 hash-0,提升其 lastAccessedAt
    const before = Date.now();
    musicIntentStore.get('hash-0');
    // 再写入第 51 条,触发 LRU,hash-0 不应被删除(刚访问过)
    musicIntentStore.save('hash-51', makeIntent('new'));
    expect(musicIntentStore.get('hash-0')).not.toBeNull();
    // hash-1(最旧未访问)应被删除
    expect(musicIntentStore.get('hash-1')).toBeNull();
    expect(before).toBeLessThanOrEqual(Date.now());
  });
});
