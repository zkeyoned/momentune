/**
 * qishuiApi 单元测试
 *
 * 测试环境:node(vitest 默认),手动 mock 全局 fetch。
 * 测试要点:
 *   - createQrLogin:后端返回 { qrimg, token },前端映射为 { qrimg, unikey }
 *   - checkQrStatus:code=2 时返回 cookie
 *   - fetchPlaylists:cookie 作为 body 传递
 *   - fetchSongUrl:返回 url 和 isTrial
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createQrLogin,
  checkQrStatus,
  fetchPlaylists,
  fetchPlaylistDetail,
  fetchSongUrl,
} from '../services/qishuiApi';

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

function makeErrorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () => body,
  } as Response;
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('qishuiApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  // -------- createQrLogin --------

  it('createQrLogin:后端返回 token,前端映射为 unikey,qrimg 透传', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    // 汽水后端返回 qrcode URL(非 data URL)和 token
    fetchMock.mockResolvedValue(
      makeOkResponse({
        qrimg: 'https://api.qishui.com/qrcode/abc123.png',
        token: 'token-xyz',
      }),
    );

    const result = await createQrLogin();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qishui/qr-create',
      expect.objectContaining({ method: 'POST' }),
    );
    // token 映射为 unikey
    expect(result.unikey).toBe('token-xyz');
    // qrimg 是非空字符串(汽水返回的是图片 URL)
    expect(result.qrimg).toBeTruthy();
    expect(result.qrimg).toBe('https://api.qishui.com/qrcode/abc123.png');
  });

  // -------- checkQrStatus --------

  it('checkQrStatus:code=2 时返回 cookie', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        code: 2,
        status: 'confirmed',
        message: '登录成功',
        cookie: 'sessionid=abc; uid=123',
      }),
    );

    const result = await checkQrStatus('token-xyz');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qishui/qr-check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'token-xyz' }),
      }),
    );
    expect(result.code).toBe(2);
    expect(result.cookie).toBe('sessionid=abc; uid=123');
  });

  it('checkQrStatus:code=0 等待扫码,无 cookie', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({ code: 0, status: '', message: '等待扫码' }),
    );

    const result = await checkQrStatus('token-xyz');

    expect(result.code).toBe(0);
    expect(result.cookie).toBeUndefined();
  });

  it('checkQrStatus:code=1 已扫码,带 avatarUrl', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        code: 1,
        status: 'scanned',
        message: '已扫码,待确认',
        avatarUrl: 'https://example.com/avatar.png',
      }),
    );

    const result = await checkQrStatus('token-xyz');

    expect(result.code).toBe(1);
    expect(result.avatarUrl).toBe('https://example.com/avatar.png');
    expect(result.cookie).toBeUndefined();
  });

  it('checkQrStatus:code=3 过期,带 newToken', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        code: 3,
        status: 'expired',
        message: '二维码已过期,已下发新 token',
        newToken: 'token-new',
      }),
    );

    const result = await checkQrStatus('token-xyz');

    expect(result.code).toBe(3);
    expect(result.newToken).toBe('token-new');
  });

  // -------- fetchPlaylists --------

  it('fetchPlaylists:cookie 作为 body 传递,返回 playlists 数组', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        playlists: [
          { id: 'pl-1', title: '我的歌单', trackCount: 30, coverUrl: 'https://cover/1.jpg' },
          { id: 'pl-2', title: '红心歌单', trackCount: 10 },
        ],
      }),
    );

    const result = await fetchPlaylists('cookie-abc');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qishui/playlist-list',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ cookie: 'cookie-abc' }),
      }),
    );
    expect(result.playlists).toHaveLength(2);
    expect(result.playlists[0]).toEqual({
      id: 'pl-1',
      title: '我的歌单',
      trackCount: 30,
      coverUrl: 'https://cover/1.jpg',
    });
  });

  it('fetchPlaylists:无歌单时返回空数组', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(makeOkResponse({ playlists: [] }));

    const result = await fetchPlaylists('cookie-abc');

    expect(result.playlists).toEqual([]);
  });

  // -------- fetchPlaylistDetail --------

  it('fetchPlaylistDetail:传 cookie 和 playlistId,返回 tracks', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        tracks: [
          { id: 't-1', title: '晴天', artist: '周杰伦', coverUrl: 'https://c/1.jpg' },
          { id: 't-2', title: '稻香', artist: '周杰伦' },
        ],
      }),
    );

    const result = await fetchPlaylistDetail('cookie-abc', 'pl-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qishui/playlist-detail',
      expect.objectContaining({
        body: JSON.stringify({ cookie: 'cookie-abc', playlistId: 'pl-1' }),
      }),
    );
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0]?.coverUrl).toBe('https://c/1.jpg');
    expect(result.tracks[1]?.coverUrl).toBeUndefined();
  });

  // -------- fetchSongUrl --------

  it('fetchSongUrl:返回 url 和 isTrial(正常播放)', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        url: 'https://cdn.qishui.com/play/song.mp3',
        quality: 'higher',
        isTrial: false,
      }),
    );

    const result = await fetchSongUrl('cookie-abc', 't-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qishui/song-url',
      expect.objectContaining({
        body: JSON.stringify({ cookie: 'cookie-abc', trackId: 't-1' }),
      }),
    );
    expect(result.url).toBe('https://cdn.qishui.com/play/song.mp3');
    expect(result.isTrial).toBe(false);
    expect(result.quality).toBe('higher');
  });

  it('fetchSongUrl:试听地址 isTrial=true', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        url: 'https://cdn.qishui.com/preview/song.mp3',
        quality: 'medium',
        isTrial: true,
      }),
    );

    const result = await fetchSongUrl('cookie-abc', 't-2');

    expect(result.isTrial).toBe(true);
  });

  it('fetchSongUrl:无可用地址时 url 为空,带 message', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        url: '',
        quality: '',
        isTrial: false,
        message: 'PlayInfoList 为空',
      }),
    );

    const result = await fetchSongUrl('cookie-abc', 't-3');

    expect(result.url).toBe('');
    expect(result.message).toBe('PlayInfoList 为空');
  });

  // -------- 错误处理 --------

  it('HTTP 非 2xx 抛错,带 status 和 body 片段', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeErrorResponse(500, '内部错误:数据库连接失败'),
    );

    await expect(fetchSongUrl('cookie-abc', 't-1')).rejects.toThrow(
      /HTTP 500/,
    );
    await expect(fetchSongUrl('cookie-abc', 't-1')).rejects.toThrow(
      /内部错误/,
    );
  });
});
