/**
 * visionApi 单元测试
 *
 * 测试环境:node(vitest 默认),需要手动 mock 浏览器 API:
 *  - fetch:全局 mock
 *  - Image:src setter 异步触发 onload(width/height 设小值,让 compressImage 直接 resolve)
 *  - document.createElement:返回 mock canvas(compressImage 在 longSide ≤ 1024 时不走 canvas,
 *    但仍需 document 存在以免 hashImage 内部抛错)
 *  - musicIntentStore:整体 mock(vi.mock),隔离依赖
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PhotoFeatures, MusicIntent } from '@algorithm/index';

// ---------------------------------------------------------------------------
// vi.mock 必须在顶层(hoisted)
// ---------------------------------------------------------------------------

vi.mock('../musicIntentStore', () => ({
  musicIntentStore: {
    hashImage: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
    updateManually: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// mock Image / document.createElement(compressImage 需要)
// ---------------------------------------------------------------------------

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
      data: new Uint8ClampedArray(17 * 16 * 4),
      width: 17,
      height: 16,
    }),
  };
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => mockCtx,
    toDataURL: () => 'data:image/jpeg;base64,MOCK',
  };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => mockCanvas,
  };
  (globalThis as unknown as { Image: unknown }).Image = MockImage;
}

// ---------------------------------------------------------------------------
// mock fetch 工厂
// ---------------------------------------------------------------------------

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

// ---------------------------------------------------------------------------
// 测试数据工厂
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

function makePhotoFeatures(withIntent = false): PhotoFeatures {
  const base: PhotoFeatures = {
    hue: { hue: 200, tone: 'cool', confidence: 0.9 },
    luminance: { value: 0.4, level: 'mid', confidence: 0.9 },
    saturation: { value: 0.5, level: 'mid', confidence: 0.9 },
    scene: { type: 'city', confidence: 0.9 },
    timeOfDay: { value: 'night', confidence: 0.9 },
    weather: { value: 'sunny', confidence: 0.9 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
    composition: { type: 'portrait', confidence: 0.9 },
    overallConfidence: 0.9,
  };
  if (withIntent) {
    return { ...base, musicIntent: makeIntent('happy') };
  }
  return base;
}

// ---------------------------------------------------------------------------
// 引入被测模块(mock 已生效)
// ---------------------------------------------------------------------------

import { analyzePhotoWithQwen } from '../visionApi';
import { musicIntentStore } from '../musicIntentStore';

// 便捷别名(mock 实现)
const mockHashImage = musicIntentStore.hashImage as ReturnType<typeof vi.fn>;
const mockGet = musicIntentStore.get as ReturnType<typeof vi.fn>;
const mockSave = musicIntentStore.save as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('analyzePhotoWithQwen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDom();
    // 默认 fetch mock(可被单个测试覆盖)
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  it('外存命中:不调 fetch,返回 mock features + cached musicIntent', async () => {
    const cached = makeIntent('cached');
    mockHashImage.mockResolvedValue('hash-abc');
    mockGet.mockReturnValue(cached);
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(makeOkResponse(makePhotoFeatures(true)));

    const result = await analyzePhotoWithQwen('data:image/png;base64,AAAA');

    // 不调 fetch
    expect(fetchMock).not.toHaveBeenCalled();
    // 不调 save(命中时不写)
    expect(mockSave).not.toHaveBeenCalled();
    // 返回的是 mock 视觉特征 + cached musicIntent
    expect(result.musicIntent).toEqual(cached);
    // 视觉字段是 mock 值(getMockFeatures 的 hue.hue === 35)
    expect(result.hue.hue).toBe(35);
    expect(result.overallConfidence).toBe(0.5);
  });

  it('外存未命中:调 fetch,成功后写入外存', async () => {
    mockHashImage.mockResolvedValue('hash-xyz');
    mockGet.mockReturnValue(null);
    const features = makePhotoFeatures(true);
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(makeOkResponse(features));

    const result = await analyzePhotoWithQwen('data:image/png;base64,BBBB');

    // 调了 fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/vision',
      expect.objectContaining({ method: 'POST' }),
    );
    // 写入外存
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('hash-xyz', features.musicIntent);
    // 返回 AI 结果
    expect(result).toEqual(features);
  });

  it('Qwen-VL 返回不含 musicIntent:不写入外存', async () => {
    mockHashImage.mockResolvedValue('hash-no-intent');
    mockGet.mockReturnValue(null);
    const features = makePhotoFeatures(false); // 不含 musicIntent
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(makeOkResponse(features));

    const result = await analyzePhotoWithQwen('data:image/png;base64,CCCC');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 不写入外存(避免缓存空值)
    expect(mockSave).not.toHaveBeenCalled();
    expect(result).toEqual(features);
  });

  it('hashImage 返回空字符串:跳过外存逻辑,走原流程', async () => {
    mockHashImage.mockResolvedValue(''); // 空字符串
    // get 不应被调用
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(makeOkResponse(makePhotoFeatures(true)));

    const result = await analyzePhotoWithQwen('data:image/png;base64,DDDD');

    // hashImage 返回空 → 不查 get
    expect(mockGet).not.toHaveBeenCalled();
    // 走原流程调 fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 有 musicIntent 时仍尝试 save,但 imageHash 为空 → save 内部应被调用但传入空 hash
    // 注:visionApi 中 `if (imageHash && features.musicIntent)` 短路,空字符串 falsy → 不调 save
    expect(mockSave).not.toHaveBeenCalled();
    expect(result.musicIntent).toBeDefined();
  });

  it('网络错误:抛错(原逻辑)', async () => {
    mockHashImage.mockResolvedValue('hash-net-err');
    mockGet.mockReturnValue(null);
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      analyzePhotoWithQwen('data:image/png;base64,EEEE'),
    ).rejects.toThrow(/Qwen-VL 网络错误/);

    // 错误时不写外存
    expect(mockSave).not.toHaveBeenCalled();
  });
});
