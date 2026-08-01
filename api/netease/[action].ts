/**
 * 网易云 API 动态路由入口(合并自原 7 个独立 Serverless Function)
 *
 * 路由:/api/netease/[action]
 *   action 取值:qr-create | qr-check | likelist | recent-songs
 *               | song-detail-batch | song-url | user-playlists
 *
 * Vercel 动态路由会把路径段注入 req.query.action,本文件按 action 分发到对应具名函数。
 * 各 handler 业务逻辑与原独立文件完全一致,仅改存放位置。
 */

import {
  handleRequest,
  jsonBody,
  getField,
  callNetease,
  type VercelReq,
  type VercelRes,
  type ApiHandler,
} from './_shared.js';

// ---------------------------------------------------------------------------
// handler: qr-create  (原 api/netease/qr-create.ts)
// ---------------------------------------------------------------------------

/** POST /api/netease/qr-create 返回 { unikey, qrimg } — qrimg 是 base64 data URL */
async function qrCreate(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  // 1. 生成 unikey
  const keyResult = await callNetease('login_qr_key', { timestamp: Date.now() });
  const unikey = keyResult?.data?.unikey as string | undefined;
  if (!unikey) {
    jsonBody(res, 500, { error: '获取二维码 key 失败' });
    return;
  }

  // 2. 生成二维码图片(base64)
  const createResult = await callNetease('login_qr_create', {
    key: unikey,
    qrimg: true,
    timestamp: Date.now(),
  });
  const qrimg = createResult?.data?.qrimg as string | undefined;
  if (!qrimg) {
    jsonBody(res, 500, { error: '生成二维码失败' });
    return;
  }

  jsonBody(res, 200, { unikey, qrimg });
}

// ---------------------------------------------------------------------------
// handler: qr-check  (原 api/netease/qr-check.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/netease/qr-check  body: { unikey }
 * 返回:
 *   { code: 801, message: '等待扫码' }
 *   { code: 802, message: '已扫码,待确认' }
 *   { code: 800, message: '二维码已过期' }
 *   { code: 803, cookie, nickname, uid }  — 登录成功
 */
async function qrCheck(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const unikey = getField(req, 'unikey');
  if (!unikey) {
    jsonBody(res, 400, { error: '缺少 unikey 参数' });
    return;
  }

  // 1. 检查扫码状态
  // login_qr_check 返回格式: { code: 801/802/803/800, message, cookie } — 在 body 顶层,不在 data 里
  const checkResult = await callNetease<Record<string, unknown>>('login_qr_check', {
    key: unikey,
    timestamp: Date.now(),
  });
  const code = checkResult?.code as number;
  const message = checkResult?.message as string | undefined;
  console.log(`[netease] qr-check unikey=${unikey.slice(0, 8)}... code=${code} msg=${message ?? ''}`);

  // 未成功,返回状态码(803 = 登录成功)
  if (code !== 803) {
    jsonBody(res, 200, { code, message: message ?? '未知状态' });
    return;
  }

  // 2. 登录成功,提取 cookie
  const cookie = (checkResult?.cookie as string) ?? '';
  if (!cookie) {
    jsonBody(res, 500, { error: '登录成功但未返回 cookie' });
    return;
  }

  // 3. 用 cookie 查登录态拿 nickname / uid
  let nickname = '网易云音乐用户';
  let uid: number | undefined;
  try {
    const statusResult = await callNetease('login_status', { timestamp: Date.now() }, cookie);
    const profile = statusResult?.data?.profile;
    if (profile) {
      nickname = (profile.nickname as string) ?? nickname;
      uid = profile.userId as number | undefined;
    }
  } catch {
    // 查登录态失败不影响主流程,用默认 nickname
  }

  // 兜底:如果 login_status 拿不到 uid,从 cookie 里解析 MUSIC_U 字段
  if (!uid) {
    const musicU = cookie.match(/MUSIC_U=([0-9a-f]+)/)?.[1];
    if (musicU) {
      // MUSIC_U 是 hex 编码的 uid,转十进制
      uid = parseInt(musicU, 16);
    }
  }

  jsonBody(res, 200, { code: 803, cookie, nickname, uid });
}

// ---------------------------------------------------------------------------
// handler: likelist  (原 api/netease/likelist.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/netease/likelist  body: { uid, cookie }
 * 返回: { ids: number[] }  — 红心歌曲 ID 列表(截取前 100 首)
 */

/** 红心列表最大返回数量(控制风控和性能) */
const MAX_LIKELIST_SIZE = 100;

async function likelist(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const uid = getField(req, 'uid');
  const cookie = getField(req, 'cookie');

  if (!uid) {
    jsonBody(res, 400, { error: '缺少 uid 参数' });
    return;
  }
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }

  const result = await callNetease('likelist', {
    uid: Number(uid),
    timestamp: Date.now(),
  }, cookie);

  const idsRaw = result?.ids as number[] | undefined;
  if (!Array.isArray(idsRaw)) {
    jsonBody(res, 500, { error: '获取红心歌单失败' });
    return;
  }

  // 截取前 100 首
  const ids = idsRaw.slice(0, MAX_LIKELIST_SIZE);

  jsonBody(res, 200, { ids, total: idsRaw.length });
}

// ---------------------------------------------------------------------------
// handler: recent-songs  (原 api/netease/recent-songs.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/netease/recent-songs  body: { uid, cookie }
 * 返回: { ids: number[] }
 *
 * 使用 record_recent_song 接口(最近播放的歌曲),
 * 截取前 100 首返回
 */

/** 返回歌曲 ID 上限 */
const MAX_RECENT_SONGS = 100;

async function recentSongs(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const uid = getField(req, 'uid');
  const cookie = getField(req, 'cookie');

  if (!uid) {
    jsonBody(res, 400, { error: '缺少 uid 参数' });
    return;
  }
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }

  // 调 record_recent_song 拿最近播放的歌曲
  const result = await callNetease('record_recent_song', {
    limit: MAX_RECENT_SONGS,
    timestamp: Date.now(),
  }, cookie);

  // 数据结构: { data: { list: [{ data: { id } }] } } 或 { list: [{ song: { id } }] }
  const listRaw = (result?.data?.list ?? result?.list ?? []) as Array<{
    data?: { id: number };
    song?: { id: number };
  }>;

  if (!Array.isArray(listRaw)) {
    jsonBody(res, 200, { ids: [] });
    return;
  }

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of listRaw) {
    const id = item.data?.id ?? item.song?.id;
    if (typeof id === 'number' && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
      if (ids.length >= MAX_RECENT_SONGS) break;
    }
  }

  jsonBody(res, 200, { ids });
}

// ---------------------------------------------------------------------------
// handler: song-detail-batch  (原 api/netease/song-detail-batch.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/netease/song-detail-batch  body: { ids, cookie }
 *   ids: 逗号分隔的 neteaseId 字符串(单次最多 50 个)
 *
 * 返回: { songs: [{ neteaseId, title, artist, coverUrl }] }
 */

interface SongDetailItem {
  neteaseId: number;
  title: string;
  artist: string;
  coverUrl?: string;
}

async function songDetailBatch(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const idsStr = getField(req, 'ids');
  const cookie = getField(req, 'cookie');

  if (!idsStr) {
    jsonBody(res, 400, { error: '缺少 ids 参数' });
    return;
  }

  const result = await callNetease('song_detail', {
    ids: idsStr,
    timestamp: Date.now(),
  }, cookie);

  const songsRaw = result?.songs as unknown[] | undefined;
  if (!Array.isArray(songsRaw)) {
    jsonBody(res, 200, { songs: [] });
    return;
  }

  const songs: SongDetailItem[] = songsRaw.map((raw) => {
    const s = raw as Record<string, unknown>;
    const artists = s.ar as Array<{ name?: string }> | undefined;
    const album = s.al as { picUrl?: string } | undefined;
    return {
      neteaseId: s.id as number,
      title: (s.name as string) ?? '未知歌曲',
      artist: artists?.map((a) => a.name ?? '').filter(Boolean).join(' / ') || '未知歌手',
      coverUrl: album?.picUrl ? `${album.picUrl.replace(/^http:\/\//, 'https://')}?param=200y200` : undefined,
    };
  });

  jsonBody(res, 200, { songs });
}

// ---------------------------------------------------------------------------
// handler: song-url  (原 api/netease/song-url.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/netease/song-url  body: { id, cookie }
 *   id: 单个 neteaseId
 *
 * 返回: { url, isTrial }  — url 有时效(几小时),前端需缓存 + 过期重取
 *
 * 音质级联:standard → 试听片段(参考 fetch-song-urls.mts 第 207-243 行)
 */
async function songUrl(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const id = getField(req, 'id');
  const cookie = getField(req, 'cookie');

  if (!id) {
    jsonBody(res, 400, { error: '缺少 id 参数' });
    return;
  }

  // 尝试 standard 音质
  let url = '';
  let isTrial = false;

  try {
    const result = await callNetease('song_url_v1', {
      id: Number(id),
      level: 'standard',
      timestamp: Date.now(),
    }, cookie);

    const data = result?.data as Array<Record<string, unknown>> | undefined;
    const first = data?.[0];
    const rawUrl = first?.url as string | undefined;
    const size = first?.size as number | undefined;

    if (rawUrl) {
      url = rawUrl;
      // size < 500KB 判定为试听片段(参考 fetch-song-urls.mts 逻辑)
      isTrial = typeof size === 'number' && size < 500_000;
    }
  } catch {
    // song_url_v1 失败,尝试旧接口兜底
    try {
      const result = await callNetease('song_url', {
        id: Number(id),
        br: 320000,
        timestamp: Date.now(),
      }, cookie);
      const data = result?.data as Array<Record<string, unknown>> | undefined;
      const first = data?.[0];
      url = (first?.url as string) ?? '';
    } catch {
      // 两个接口都失败
    }
  }

  if (!url) {
    jsonBody(res, 200, { url: '', isTrial: false, message: '无法获取播放地址(可能需要 VIP 或已下架)' });
    return;
  }

  jsonBody(res, 200, { url, isTrial });
}

// ---------------------------------------------------------------------------
// handler: user-playlists  (原 api/netease/user-playlists.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/netease/user-playlists  body: { uid, cookie }
 * 返回: { ids: number[], playlists: {id, name, trackCount}[] }
 *
 * 流程:
 *   1. 调 user_playlist 拿用户所有歌单列表
 *   2. 对每个歌单调 playlist_track_all 拿歌曲 ID
 *   3. 合并去重,截取前 200 首
 *
 * 容错: 单个歌单失败不阻塞其他歌单
 */

/** 返回歌曲 ID 上限(控制风控和性能) */
const MAX_SONG_IDS = 200;
/** 单次最多处理的歌单数量 */
const MAX_PLAYLISTS = 10;
/** 歌单间请求间隔(ms,防风控) */
const PLAYLIST_FETCH_INTERVAL_MS = 400;

interface PlaylistMeta {
  id: number;
  name: string;
  trackCount: number;
}

async function userPlaylists(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const uid = getField(req, 'uid');
  const cookie = getField(req, 'cookie');

  if (!uid) {
    jsonBody(res, 400, { error: '缺少 uid 参数' });
    return;
  }
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }

  // 1. 拿用户歌单列表
  const playlistResult = await callNetease('user_playlist', {
    uid: Number(uid),
    timestamp: Date.now(),
  }, cookie);

  const playlistsRaw = (playlistResult?.playlist ?? []) as Array<{
    id: number;
    name: string;
    trackCount: number;
  }>;

  if (!Array.isArray(playlistsRaw) || playlistsRaw.length === 0) {
    jsonBody(res, 200, { ids: [], playlists: [] });
    return;
  }

  // 过滤掉红心歌单(红心由 likelist 单独拉取),取前 MAX_PLAYLISTS 个
  const playlists: PlaylistMeta[] = playlistsRaw
    .filter((p) => p.name !== '我喜欢的音乐')
    .slice(0, MAX_PLAYLISTS)
    .map((p) => ({ id: p.id, name: p.name, trackCount: p.trackCount }));

  // 2. 逐个歌单拉歌曲 ID
  const allIds = new Set<number>();

  for (const p of playlists) {
    if (allIds.size >= MAX_SONG_IDS) break;
    try {
      const detail = await callNetease('playlist_track_all', {
        id: p.id,
        limit: 100,
        timestamp: Date.now(),
      }, cookie);
      const tracks = (detail?.songs ?? []) as Array<{ id: number }>;
      for (const t of tracks) {
        if (typeof t.id === 'number') allIds.add(t.id);
        if (allIds.size >= MAX_SONG_IDS) break;
      }
    } catch {
      // 单个歌单失败,跳过,继续下一个
    }
    // 防风控间隔
    await new Promise((r) => setTimeout(r, PLAYLIST_FETCH_INTERVAL_MS));
  }

  const ids = Array.from(allIds).slice(0, MAX_SONG_IDS);
  jsonBody(res, 200, { ids, playlists });
}

// ---------------------------------------------------------------------------
// 动态路由分发入口
// ---------------------------------------------------------------------------

const handlers: Record<string, ApiHandler> = {
  'qr-create': qrCreate,
  'qr-check': qrCheck,
  'likelist': likelist,
  'recent-songs': recentSongs,
  'song-detail-batch': songDetailBatch,
  'song-url': songUrl,
  'user-playlists': userPlaylists,
};

export default handleRequest(async (req, res) => {
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  console.log(`[netease] action=${action} method=${req.method ?? ''}`);
  const handler = handlers[action];
  if (!handler) {
    jsonBody(res, 404, { error: `Unknown action: ${action}` });
    return;
  }
  await handler(req, res);
});
