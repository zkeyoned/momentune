/**
 * qqApi 单元测试
 *
 * 测试环境:node(vitest 默认),手动 mock 全局 fetch。
 * 测试要点:
 *   - createQrLogin:后端返回 { qrimg, key },前端映射为 { qrimg, unikey }
 *   - checkQrStatus:code=0/66/67/65 分支
 *   - fetchLikelist:返回 ids 数组
 *   - fetchSongDetails:后端 id 映射为 qqId
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createQrLogin,
  checkQrStatus,
  fetchLikelist,
  fetchUserPlaylists,
  fetchPlaylistDetail,
  fetchSongDetails,
  fetchSongUrl,
} from '../services/qqApi';

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

describe('qqApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  // -------- createQrLogin --------

  it('createQrLogin:后端返回 key,前端映射为 unikey;qrimg 是 data URL', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    // QQ 后端返回 base64 data URL 和 key(`<qrsig>|<ptqrtoken>`)
    fetchMock.mockResolvedValue(
      makeOkResponse({
        qrimg: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        key: 'qrsig-abc|12345',
      }),
    );

    const result = await createQrLogin();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qq/qr-create',
      expect.objectContaining({ method: 'POST' }),
    );
    // key 映射为 unikey
    expect(result.unikey).toBe('qrsig-abc|12345');
    // qrimg 是 data URL
    expect(result.qrimg).toMatch(/^data:image\/png;base64,/);
  });

  // -------- checkQrStatus --------

  it('checkQrStatus:code=0 登录成功,返回 cookie 和 nickname', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        code: 0,
        message: '登录成功',
        cookie: 'uin=o12345; p_skey=abc',
        nickname: 'QQ音乐用户',
      }),
    );

    const result = await checkQrStatus('qrsig-abc|12345');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qq/qr-check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'qrsig-abc|12345' }),
      }),
    );
    expect(result.code).toBe(0);
    expect(result.cookie).toBe('uin=o12345; p_skey=abc');
    expect(result.nickname).toBe('QQ音乐用户');
  });

  it('checkQrStatus:code=66 未扫码,无 cookie', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({ code: 66, message: '二维码未失效,等待扫码' }),
    );

    const result = await checkQrStatus('qrsig-abc|12345');

    expect(result.code).toBe(66);
    expect(result.cookie).toBeUndefined();
    expect(result.nickname).toBeUndefined();
  });

  it('checkQrStatus:code=67 已扫码待确认', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({ code: 67, message: '二维码认证中' }),
    );

    const result = await checkQrStatus('qrsig-abc|12345');

    expect(result.code).toBe(67);
    expect(result.cookie).toBeUndefined();
  });

  it('checkQrStatus:code=65 已过期', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({ code: 65, message: '二维码已失效' }),
    );

    const result = await checkQrStatus('qrsig-abc|12345');

    expect(result.code).toBe(65);
    expect(result.cookie).toBeUndefined();
  });

  // -------- fetchLikelist --------

  it('fetchLikelist:返回 songmid 字符串数组', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        ids: ['songmid-1', 'songmid-2', 'songmid-3'],
      }),
    );

    const result = await fetchLikelist('12345', 'cookie-abc');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qq/likelist',
      expect.objectContaining({
        body: JSON.stringify({ cookie: 'cookie-abc', uin: '12345' }),
      }),
    );
    expect(result.ids).toEqual(['songmid-1', 'songmid-2', 'songmid-3']);
    // 确认是字符串数组(QQ 用 songmid)
    expect(result.ids.every((id) => typeof id === 'string')).toBe(true);
  });

  it('fetchLikelist:空红心歌单返回空数组', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(makeOkResponse({ ids: [] }));

    const result = await fetchLikelist('12345', 'cookie-abc');

    expect(result.ids).toEqual([]);
  });

  // -------- fetchUserPlaylists --------

  it('fetchUserPlaylists:返回歌单列表', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        playlists: [
          { id: 'p-1', title: '我的歌单', trackCount: 20 },
          { id: 'p-2', title: '收藏', trackCount: 5 },
        ],
      }),
    );

    const result = await fetchUserPlaylists('12345', 'cookie-abc');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qq/user-playlists',
      expect.objectContaining({
        body: JSON.stringify({ cookie: 'cookie-abc', uin: '12345' }),
      }),
    );
    expect(result.playlists).toHaveLength(2);
    expect(result.playlists[0]).toEqual({
      id: 'p-1',
      title: '我的歌单',
      trackCount: 20,
    });
  });

  // -------- fetchPlaylistDetail --------

  it('fetchPlaylistDetail:传 cookie/playlistId/uin,返回 tracks 和 total', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        tracks: [
          { id: 'sm-1', title: '七里香', artist: '周杰伦' },
          { id: 'sm-2', title: '夜曲', artist: '周杰伦' },
        ],
        total: 50,
      }),
    );

    const result = await fetchPlaylistDetail('cookie-abc', 'pl-1', '12345');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qq/playlist-detail',
      expect.objectContaining({
        body: JSON.stringify({ cookie: 'cookie-abc', playlistId: 'pl-1', uin: '12345' }),
      }),
    );
    expect(result.tracks).toHaveLength(2);
    expect(result.total).toBe(50);
  });

  // -------- fetchSongDetails --------

  it('fetchSongDetails:后端 id 映射为 qqId', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        songs: [
          {
            id: 'sm-1',
            title: '七里香',
            artist: '周杰伦',
            coverUrl: 'https://y.gtimg.cn/photo_new/T002R300x300M000abc.jpg',
          },
          { id: 'sm-2', title: '夜曲', artist: '周杰伦' },
        ],
      }),
    );

    const result = await fetchSongDetails(['sm-1', 'sm-2'], 'cookie-abc');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qq/song-detail-batch',
      expect.objectContaining({
        body: JSON.stringify({ cookie: 'cookie-abc', ids: ['sm-1', 'sm-2'] }),
      }),
    );
    expect(result.songs).toHaveLength(2);
    // 关键:后端 id 映射为 qqId
    expect(result.songs[0]?.qqId).toBe('sm-1');
    expect(result.songs[0]?.title).toBe('七里香');
    expect(result.songs[0]?.coverUrl).toBe(
      'https://y.gtimg.cn/photo_new/T002R300x300M000abc.jpg',
    );
    // 无 coverUrl 时不包含该字段
    expect(result.songs[1]?.qqId).toBe('sm-2');
    expect(result.songs[1]?.coverUrl).toBeUndefined();
  });

  // -------- fetchSongUrl --------

  it('fetchSongUrl:正常播放返回 url 和 isTrial=false', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        url: 'https://dl.stream.qqmusic.qq.com/M5001song.mp3',
        isTrial: false,
      }),
    );

    const result = await fetchSongUrl('cookie-abc', 'sm-1', '12345');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/qq/song-url',
      expect.objectContaining({
        body: JSON.stringify({ cookie: 'cookie-abc', songmid: 'sm-1', uin: '12345' }),
      }),
    );
    expect(result.url).toBe('https://dl.stream.qqmusic.qq.com/M5001song.mp3');
    expect(result.isTrial).toBe(false);
  });

  it('fetchSongUrl:VIP 歌曲无明文 URL,isTrial=true 带 message', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(
      makeOkResponse({
        url: '',
        isTrial: true,
        message: 'VIP 歌曲无法播放',
      }),
    );

    const result = await fetchSongUrl('cookie-abc', 'sm-vip', '12345');

    expect(result.url).toBe('');
    expect(result.isTrial).toBe(true);
    expect(result.message).toBe('VIP 歌曲无法播放');
  });

  // -------- 错误处理 --------

  it('HTTP 非 2xx 抛错,带 status 和 body 片段', async () => {
    const fetchMock = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    fetchMock.mockResolvedValue(makeErrorResponse(403, 'Forbidden: cookie 已过期'));

    await expect(fetchLikelist('12345', 'cookie-abc')).rejects.toThrow(/HTTP 403/);
    await expect(fetchLikelist('12345', 'cookie-abc')).rejects.toThrow(/Forbidden/);
  });
});
