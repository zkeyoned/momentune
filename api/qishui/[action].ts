/**
 * 汽水音乐 API 动态路由入口(合并自原 6 个独立 Serverless Function)
 *
 * 路由:/api/qishui/[action]
 *   action 取值:qr-create | qr-check | playlist-list
 *               | playlist-detail | song-url | audio-proxy
 *
 * Vercel 动态路由会把路径段注入 req.query.action,本文件按 action 分发到对应具名函数。
 * 各 handler 业务逻辑与原独立文件完全一致,仅改存放位置。
 */

import { Readable } from 'node:stream';
import type { ServerResponse } from 'node:http';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import {
  handleRequest,
  jsonBody,
  getField,
  fetchWithTimeout,
  readJsonBody,
  asObj,
  readString,
  cookieFromSetCookieHeaders,
  buildSodaHeaders,
  SODA_QR_CODE_URL,
  SODA_QR_CHECK_URL,
  SODA_API_CONFIG,
  UA,
  REFERER,
  type VercelReq,
  type VercelRes,
  type ApiHandler,
} from './_shared';

// ---------------------------------------------------------------------------
// handler: qr-create  (原 api/qishui/qr-create.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qishui/qr-create
 * 返回 { qrimg, token } — qrimg 是 data:image/png;base64,... 可直接 <img src>
 *
 * 端点:GET https://api.qishui.com/passport/web/get_qrcode/
 * 参考实现:Mineradio-Tauri soda-qr-login.ts
 *
 * 注意:URL 必须包含 account_sdk_source_info / iid / version_code 等反风控参数,
 *      缺失会返回 error_code=4031 "版本过低"。
 */
async function qrCreate(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  let resp: Response;
  try {
    resp = await fetchWithTimeout(SODA_QR_CODE_URL, {
      method: 'GET',
      headers: buildSodaHeaders(),
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求汽水音乐 get_qrcode 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!resp.ok) {
    jsonBody(res, 500, { error: `get_qrcode 返回 ${resp.status}` });
    return;
  }

  const body = await readJsonBody(resp);
  const root = asObj(body);
  const data = asObj(root?.data);

  // 校验 message === 'success'(Mineradio readSodaQrCodeBody 契约)
  const message = readString(root?.message) ?? '';
  if (message !== 'success') {
    const desc = readString(data?.description) ?? message;
    jsonBody(res, 500, { error: `get_qrcode 失败: ${desc}` });
    return;
  }

  const qrcode = readString(data?.qrcode);
  const token = readString(data?.token);

  if (!qrcode || !token) {
    jsonBody(res, 500, { error: 'get_qrcode 未返回 qrcode 或 token' });
    return;
  }

  // qrcode 是 data:image/png;base64,... 前端直接 <img src=qrimg>
  jsonBody(res, 200, { qrimg: qrcode, token });
}

// ---------------------------------------------------------------------------
// handler: qr-check  (原 api/qishui/qr-check.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qishui/qr-check  body: { token }
 *
 * 返回:
 *   { code: 0, status: 'new',       message: '等待扫码' }
 *   { code: 1, status: 'scanned',   message: '已扫码',  avatarUrl }
 *   { code: 2, status: 'confirmed', message: '登录成功', cookie }
 *   { code: 3, status: 'expired',   message: '二维码已过期', newToken }
 *
 * 端点:POST https://api.qishui.com/passport/web/check_qrconnect/
 *   - body 为 application/x-www-form-urlencoded
 *   - 成功登录后,cookie 在 Set-Cookie 响应头中,需提取
 *
 * 关键:用 data.status 字段判断状态(对齐 Mineradio readSodaQrCheckBody):
 *   - "new"       → 等待扫码
 *   - "scanned"   → 已扫码待确认
 *   - "confirmed" → 登录成功
 *   - "expired"   → 过期
 * 不要用 error_code 判断,登录成功时 error_code 不是固定值。
 *
 * 参考实现:Mineradio-Tauri soda-qr-login.ts
 */
async function qrCheck(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const token = getField(req, 'token');
  if (!token) {
    jsonBody(res, 400, { error: '缺少 token 参数' });
    return;
  }

  // check_qrconnect URL(含完整反风控参数,见 _shared.ts SODA_QR_CHECK_URL)
  const url = SODA_QR_CHECK_URL;

  // POST body: application/x-www-form-urlencoded(对齐 Mineradio)
  const formBody =
    `need_logo=false` +
    `&need_short_url=false` +
    `&is_frontier=true` +
    `&token=${encodeURIComponent(token)}` +
    `&is_new_login=1` +
    `&next=${encodeURIComponent(SODA_API_CONFIG.API_BASE)}`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: buildSodaHeaders({
        contentType: 'application/x-www-form-urlencoded',
      }),
      body: formBody,
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求 check_qrconnect 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!resp.ok) {
    jsonBody(res, 500, { error: `check_qrconnect 返回 ${resp.status}` });
    return;
  }

  const body = await readJsonBody(resp);
  const root = asObj(body) ?? {};
  const data = asObj(root.data) ?? {};

  // Mineradio 契约:message !== "success" 视为请求失败
  const message = readString(root.message) ?? '';
  if (message !== 'success') {
    const desc = readString(data.description) ?? message ?? '未知错误';
    jsonBody(res, 500, { error: `check_qrconnect 失败: ${desc}` });
    return;
  }

  // 核心:用 status 字段判断(不要用 error_code)
  const status = readString(data.status) ?? '';
  // 已扫码时返回 scan_user_info.avatar_url
  const scanUserInfo = asObj(data.scan_user_info);
  const avatarUrl = readString(scanUserInfo?.avatar_url);

  // 1) 等待扫码(status="new")
  if (status === 'new' || status === '') {
    jsonBody(res, 200, { code: 0, status: 'new', message: '等待扫码' });
    return;
  }

  // 2) 已扫码(status="scanned",带 avatar_url)
  if (status === 'scanned' || (avatarUrl && status !== 'confirmed')) {
    jsonBody(res, 200, {
      code: 1,
      status: 'scanned',
      message: '已扫码,待确认',
      avatarUrl,
    });
    return;
  }

  // 3) 登录成功(status="confirmed"):从 Set-Cookie 提取 cookie
  if (status === 'confirmed') {
    const cookie = cookieFromSetCookieHeaders(resp.headers);
    if (!cookie) {
      jsonBody(res, 500, { error: '登录成功但 Set-Cookie 头缺失' });
      return;
    }
    jsonBody(res, 200, {
      code: 2,
      status: 'confirmed',
      message: '登录成功',
      cookie,
    });
    return;
  }

  // 4) 过期(status="expired"):尝试从 data 拿新 token(刷新二维码)
  if (status === 'expired') {
    const newToken = readString(data.token);
    jsonBody(res, 200, {
      code: 3,
      status: 'expired',
      message: '二维码已过期',
      newToken: newToken && newToken !== token ? newToken : undefined,
    });
    return;
  }

  // 兜底:无法识别的 status,视为过期让用户重试
  jsonBody(res, 200, {
    code: 3,
    status: 'expired',
    message: `未知状态: ${status || '空'}`,
    newToken: undefined,
  });
}

// ---------------------------------------------------------------------------
// handler: playlist-list  (原 api/qishui/playlist-list.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qishui/playlist-list  body: { cookie }
 * 返回: { playlists: [{ id, title, trackCount, coverUrl? }] }
 *
 * 端点:GET https://api.qishui.com/luna/pc/me/playlist?aid=386088
 *   - 需要 cookie 头
 *
 * 参考实现:Mineradio-Tauri soda-client.ts
 */

interface PlaylistItem {
  id: string;
  title: string;
  trackCount: number;
  coverUrl?: string;
}

async function playlistList(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }

  const url =
    `${SODA_API_CONFIG.API_BASE}/luna/pc/me/playlist` +
    `?aid=${SODA_API_CONFIG.AID}`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, {
      method: 'GET',
      headers: buildSodaHeaders({ cookie }),
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求 me/playlist 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!resp.ok) {
    jsonBody(res, 500, { error: `me/playlist 返回 ${resp.status}` });
    return;
  }

  const body = await readJsonBody(resp);
  // 返回结构(对齐 Mineradio):root.playlists 或 root.data.playlists
  const root = asObj(body);
  let playlistsRaw = root?.playlists;
  if (!Array.isArray(playlistsRaw)) {
    const dataField = asObj(root?.data);
    playlistsRaw = dataField?.playlists;
  }

  if (!Array.isArray(playlistsRaw)) {
    jsonBody(res, 200, { playlists: [] });
    return;
  }

  const playlists: PlaylistItem[] = playlistsRaw
    .map((raw): PlaylistItem | null => {
      const p = asObj(raw) ?? {};
      // 字段映射(对齐 Mineradio SodaPlaylistBody):
      //   id / title / count_tracks / url_cover.urls[0]
      // 兼容老字段名:playlist_id / name / track_count / cover_url
      const id =
        (typeof p.id === 'string' ? p.id : undefined) ??
        (typeof p.id === 'number' ? String(p.id) : undefined) ??
        (typeof p.playlist_id === 'string' ? p.playlist_id : undefined) ??
        (typeof p.playlist_id === 'number' ? String(p.playlist_id) : undefined);
      if (!id || id.length === 0) return null;

      const title =
        (typeof p.title === 'string' && p.title.trim() ? p.title : undefined) ??
        (typeof p.name === 'string' && p.name.trim() ? p.name : undefined) ??
        '未知歌单';
      const trackCount =
        (typeof p.count_tracks === 'number' ? p.count_tracks : undefined) ??
        (typeof p.track_count === 'number' ? p.track_count : undefined) ??
        (typeof p.trackCount === 'number' ? p.trackCount : undefined) ??
        0;

      // 封面:url_cover.urls[0](以 // 开头需补 https:)
      let coverUrl: string | undefined;
      const urlCover = asObj(p.url_cover);
      const urls = urlCover?.urls;
      if (Array.isArray(urls) && urls.length > 0 && typeof urls[0] === 'string') {
        const raw = urls[0].trim();
        if (raw.startsWith('//')) coverUrl = `https:${raw}`;
        else if (raw.startsWith('http')) coverUrl = raw;
      }
      if (!coverUrl) {
        const cu =
          (typeof p.cover_url === 'string' ? p.cover_url : undefined) ??
          (typeof p.pic_url === 'string' ? p.pic_url : undefined);
        if (cu) coverUrl = cu;
      }

      const item: PlaylistItem = { id, title, trackCount };
      if (coverUrl) item.coverUrl = coverUrl;
      return item;
    })
    .filter((p): p is PlaylistItem => p !== null);

  jsonBody(res, 200, { playlists });
}

// ---------------------------------------------------------------------------
// handler: playlist-detail  (原 api/qishui/playlist-detail.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qishui/playlist-detail  body: { cookie, playlistId }
 * 返回: { tracks: [{ id, title, artist, coverUrl? }] }
 *
 * 端点:GET https://api.qishui.com/luna/pc/playlist/detail
 *   - 参数:aid, playlist_id, cursor, count=20
 *   - 返回 has_more=true 时用 next_cursor 继续翻页,累积 media_resources
 *
 * 字段结构(对齐 Mineradio SodaPlaylistDetailBody):
 *   {
 *     playlist: {...},
 *     media_resources: [{
 *       id: "xxx",
 *       type: "track",
 *       entity: {
 *         track_wrapper: {
 *           track: {
 *             id: "xxx",
 *             name: "歌名",
 *             artists: [{ name: "歌手" }],
 *             album: { url_cover: { urls: ["//..."] } }
 *           }
 *         }
 *       }
 *     }],
 *     has_more: true/false,
 *     next_cursor: "..."
 *   }
 *
 * 注意:media_resources 直接挂在 root,不在 root.data 下;
 *      歌曲信息要深入 entity.track_wrapper.track 才能拿到。
 *
 * 参考实现:Mineradio-Tauri soda-client.ts + providers/soda/map.ts
 */

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

/** 单次请求的歌曲数(与 PC 客户端一致) */
const PAGE_COUNT = 20;
/** 最大翻页数(防失控) */
const MAX_PAGES = 50;

/**
 * 从单个 media_resource 项中提取歌曲信息
 *
 * 结构:item.entity.track_wrapper.track
 * 兼容老结构(直接挂在 item 上)作 fallback
 */
function extractTrackFromMedia(item: Record<string, unknown>): TrackItem | null {
  // 1) 新结构:entity.track_wrapper.track
  const entity = asObj(item.entity);
  const trackWrapper = asObj(entity?.track_wrapper);
  const track = asObj(trackWrapper?.track);

  // 2) fallback:直接当 track
  const fallbackTrack = asObj(item.track) ?? asObj(item);

  const t = track ?? fallbackTrack;
  if (!t) return null;

  // ID:track.id 优先,再 item.id
  const id =
    (typeof t.id === 'string' ? t.id : undefined) ??
    (typeof t.id === 'number' ? String(t.id) : undefined) ??
    (typeof item.id === 'string' ? item.id : undefined) ??
    (typeof item.id === 'number' ? String(item.id) : undefined);
  if (!id) return null;

  // 标题:track.name 优先
  const title =
    (typeof t.name === 'string' && t.name.trim() ? t.name : undefined) ??
    (typeof t.title === 'string' && t.title.trim() ? t.title : undefined) ??
    '未知歌曲';

  // 歌手:track.artists 是 [{ name }]
  let artist = '未知歌手';
  const artistsRaw = t.artists ?? t.singers ?? t.author;
  if (typeof artistsRaw === 'string' && artistsRaw.trim()) {
    artist = artistsRaw.trim();
  } else if (Array.isArray(artistsRaw)) {
    const names = artistsRaw
      .map((a) => {
        const obj = asObj(a);
        const n = obj?.name;
        return typeof n === 'string' ? n.trim() : (typeof a === 'string' ? a.trim() : '');
      })
      .filter(Boolean);
    if (names.length > 0) artist = names.join(' / ');
  }

  // 封面:track.album.url_cover.urls[0](以 // 开头需补 https:)
  let coverUrl: string | undefined;
  const album = asObj(t.album);
  const urlCover = asObj(album?.url_cover);
  const urls = urlCover?.urls;
  if (Array.isArray(urls) && urls.length > 0 && typeof urls[0] === 'string') {
    const raw = urls[0].trim();
    if (raw.startsWith('//')) {
      coverUrl = `https:${raw}`;
    } else if (raw.startsWith('http')) {
      coverUrl = raw;
    }
  }
  // fallback:cover_url / pic_url
  if (!coverUrl) {
    const cu =
      (typeof t.cover_url === 'string' ? t.cover_url : undefined) ??
      (typeof album?.cover_url === 'string' ? album.cover_url : undefined) ??
      (typeof t.pic_url === 'string' ? t.pic_url : undefined);
    if (cu) coverUrl = cu;
  }

  const result: TrackItem = { id, title, artist };
  if (coverUrl) result.coverUrl = coverUrl;
  return result;
}

async function playlistDetail(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const playlistId = getField(req, 'playlistId');
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!playlistId) {
    jsonBody(res, 400, { error: '缺少 playlistId 参数' });
    return;
  }

  const allMediaResources: unknown[] = [];
  let cursor: string | number = '1';
  let hasMore = true;
  let page = 0;

  // 自动翻页:has_more=true 时用 next_cursor 继续
  while (hasMore && page < MAX_PAGES) {
    page += 1;
    const url =
      `${SODA_API_CONFIG.API_BASE}/luna/pc/playlist/detail` +
      `?aid=${SODA_API_CONFIG.AID}` +
      `&playlist_id=${encodeURIComponent(playlistId)}` +
      `&cursor=${encodeURIComponent(String(cursor))}` +
      `&count=${PAGE_COUNT}`;

    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, {
        method: 'GET',
        headers: buildSodaHeaders({ cookie }),
      });
    } catch (e) {
      // 已有数据时返回已累积的,不再继续
      if (allMediaResources.length > 0) break;
      jsonBody(res, 500, {
        error: `请求 playlist/detail 失败: ${e instanceof Error ? e.message : 'unknown'}`,
      });
      return;
    }

    if (!resp.ok) {
      if (allMediaResources.length > 0) break;
      jsonBody(res, 500, { error: `playlist/detail 返回 ${resp.status}` });
      return;
    }

    const body = await readJsonBody(resp);
    const root = asObj(body) ?? {};

    // media_resources 直接挂在 root(对齐 Mineradio readMediaResources)
    // 兼容:若 root.data 是对象且 root 自身没有 media_resources,再 fallback 到 root.data
    let mediaResources = root.media_resources;
    if (!Array.isArray(mediaResources)) {
      const dataField = asObj(root.data);
      mediaResources = dataField?.media_resources;
    }
    if (Array.isArray(mediaResources)) {
      allMediaResources.push(...mediaResources);
    }

    // has_more / next_cursor 同样直接读 root(对齐 Mineradio readPlaylistNextCursor)
    hasMore = root.has_more === true;
    const nextCursor = root.next_cursor;
    if (hasMore && typeof nextCursor === 'string' && nextCursor.trim()) {
      cursor = nextCursor;
    } else if (hasMore && (typeof nextCursor === 'number' || typeof nextCursor === 'string')) {
      cursor = nextCursor as string | number;
    } else {
      hasMore = false;
    }
  }

  // 从累积的 media_resources 提取歌曲信息
  const tracks: TrackItem[] = [];
  const seenIds = new Set<string>();
  // 用 songKey 二次去重(防止同名同歌手重复)
  const seenKeys = new Set<string>();

  for (const raw of allMediaResources) {
    const item = asObj(raw);
    if (!item) continue;
    const track = extractTrackFromMedia(item);
    if (!track) continue;
    if (seenIds.has(track.id)) continue;
    seenIds.add(track.id);

    const key = `${track.title}|${track.artist}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    tracks.push(track);
  }

  jsonBody(res, 200, { tracks });
}

// ---------------------------------------------------------------------------
// handler: song-url  (原 api/qishui/song-url.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qishui/song-url  body: { cookie, trackId }
 * 返回: { url, quality, isTrial }  — url 是明文 mp3 直链,前端可经 /api/qishui/audio-proxy 转发播放
 *
 * 两步流程(参考 Mineradio-Tauri soda-client.ts 播放地址提取):
 *   1. GET track_v2 → 拿 track_player.url_player_info(一个 URL)
 *   2. GET url_player_info → 返回 { Result: { Data: { PlayInfoList: [...] } } }
 *   3. PlayInfoList 每项: { MainPlayUrl, BackupPlayUrl, PlayAuth, Quality }
 *      取第一个有 MainPlayUrl 的,直接返回明文 mp3 URL,不需解密
 *
 * Quality 枚举(从高到低):spatial / hi_res / highest / higher / medium
 */

/** 最大翻页次数兜底(取 PlayInfoList 时无翻页,这里只用作防御) */
const MAX_QUALITY_RETRY = 5;

async function songUrl(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const trackId = getField(req, 'trackId');
  console.log('[qishui/song-url] 收到请求', { trackId, cookieLen: (cookie || '').length, cookieHead: (cookie || '').slice(0, 80) });
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!trackId) {
    jsonBody(res, 400, { error: '缺少 trackId 参数' });
    return;
  }

  // ---- 第一步:GET track_v2 拿 url_player_info ----
  const trackV2Url =
    `${SODA_API_CONFIG.API_BASE}/luna/pc/track_v2` +
    `?track_id=${encodeURIComponent(trackId)}` +
    `&media_type=track` +
    `&aid=${SODA_API_CONFIG.AID}`;

  let trackV2Resp: Response;
  try {
    trackV2Resp = await fetchWithTimeout(trackV2Url, {
      method: 'GET',
      headers: buildSodaHeaders({ cookie }),
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求 track_v2 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!trackV2Resp.ok) {
    jsonBody(res, 500, { error: `track_v2 返回 ${trackV2Resp.status}` });
    return;
  }

  const trackV2Body = await readJsonBody(trackV2Resp);
  // 路径:data.track_player.url_player_info
  const trackV2Root = asObj(trackV2Body);
  const trackV2Data = asObj(trackV2Root?.data) ?? trackV2Root;
  const trackPlayer = asObj(trackV2Data?.track_player);
  const urlPlayerInfo = readString(trackPlayer?.url_player_info);
  console.log('[qishui/song-url] track_v2 返回', { trackV2Status: trackV2Resp.status, hasUrlPlayerInfo: !!urlPlayerInfo, urlPlayerInfoHead: (urlPlayerInfo || '').slice(0, 100), trackV2Keys: trackV2Root ? Object.keys(trackV2Root) : null, statusCode: trackV2Root?.status_code, statusInfo: trackV2Root?.status_info, hasData: !!trackV2Root?.data, dataKeys: trackV2Data ? Object.keys(trackV2Data) : null });

  if (!urlPlayerInfo) {
    console.log('[qishui/song-url] 返回空 url(无 url_player_info)', { trackId });
    jsonBody(res, 200, {
      url: '',
      quality: '',
      isTrial: false,
      message: 'track_v2 未返回 url_player_info(可能歌曲已下架或需要 VIP)',
    });
    return;
  }

  // ---- 第二步:GET url_player_info 拿 PlayInfoList ----
  let playResp: Response;
  try {
    playResp = await fetchWithTimeout(urlPlayerInfo, {
      method: 'GET',
      headers: buildSodaHeaders({ cookie }),
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求 url_player_info 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!playResp.ok) {
    console.log('[qishui/song-url] url_player_info HTTP 失败', { status: playResp.status });
    jsonBody(res, 500, { error: `url_player_info 返回 ${playResp.status}` });
    return;
  }

  const playBody = await readJsonBody(playResp);
  // 路径:Result.Data.PlayInfoList
  const playRoot = asObj(playBody);
  const resultField = asObj(playRoot?.Result) ?? asObj(playRoot?.result);
  const dataField = asObj(resultField?.Data) ?? asObj(resultField?.data);
  const playInfoList = dataField?.PlayInfoList ?? dataField?.play_info_list;
  console.log('[qishui/song-url] url_player_info 返回', { playStatus: playResp.status, playRootKeys: playRoot ? Object.keys(playRoot) : null, hasPlayInfoList: Array.isArray(playInfoList), playInfoListLen: Array.isArray(playInfoList) ? playInfoList.length : 0 });

  if (!Array.isArray(playInfoList) || playInfoList.length === 0) {
    jsonBody(res, 200, {
      url: '',
      quality: '',
      isTrial: false,
      message: 'PlayInfoList 为空',
    });
    return;
  }

  // 取第一个有 MainPlayUrl 的
  let chosenUrl = '';
  let chosenQuality = '';
  let retry = 0;
  for (const item of playInfoList) {
    if (retry++ > MAX_QUALITY_RETRY) break;
    const info = asObj(item) ?? {};
    const mainPlayUrl =
      readString(info.MainPlayUrl) ?? readString(info.main_play_url);
    const quality =
      readString(info.Quality) ?? readString(info.quality) ?? '';
    if (mainPlayUrl) {
      chosenUrl = mainPlayUrl;
      chosenQuality = quality;
      break;
    }
    // BackupPlayUrl 兜底
    const backupUrl =
      readString(info.BackupPlayUrl) ?? readString(info.backup_play_url);
    if (backupUrl && !chosenUrl) {
      chosenUrl = backupUrl;
      chosenQuality = quality;
      // 继续找 MainPlayUrl
    }
  }

  if (!chosenUrl) {
    jsonBody(res, 200, {
      url: '',
      quality: '',
      isTrial: false,
      message: 'PlayInfoList 中无可用播放地址',
    });
    return;
  }

  // 汽水音乐直接返回明文 mp3 URL,不需要解密
  // isTrial 判定:URL 中含 /preview/ 或 trial 标记
  const isTrial = /\/preview\/|trial/i.test(chosenUrl);

  jsonBody(res, 200, {
    url: chosenUrl,
    quality: chosenQuality,
    isTrial,
  });
}

// ---------------------------------------------------------------------------
// handler: audio-proxy  (原 api/qishui/audio-proxy.ts)
// ---------------------------------------------------------------------------

/**
 * GET /api/qishui/audio-proxy?url=<汽水音乐 CDN 地址>
 *   绕过浏览器 CORS/ORB 限制,流式转发音频数据。
 *   Referer/UA 与 Luna PC 客户端一致,避免被风控。
 *
 * 参考:api/audio-proxy.ts(网易云音频代理)
 */

/** 音频代理专用 CORS 头(仅允许 GET/OPTIONS) */
function setAudioCors(res: VercelRes): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/** 返回 JSON 错误(带 CORS) */
function jsonError(res: VercelRes, code: number, error: string): void {
  setAudioCors(res);
  res.status(code).json({ error });
}

async function audioProxy(req: VercelReq, res: VercelRes): Promise<void> {
  // OPTIONS 预检
  if (req.method === 'OPTIONS') {
    setAudioCors(res);
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    jsonError(res, 405, 'Method not allowed, use GET');
    return;
  }

  const targetUrl = getField(req, 'url');
  if (!targetUrl) {
    jsonError(res, 400, 'missing url param');
    return;
  }

  // 请求上游(Referer/UA 与 Luna PC 一致)
  // 音频流可能较大,超时放宽到 30s
  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          Referer: REFERER,
          'User-Agent': UA,
        },
      },
      30_000,
    );
  } catch {
    jsonError(res, 502, 'upstream fetch failed');
    return;
  }

  if (upstream.status !== 200) {
    jsonError(res, upstream.status, `upstream returned ${upstream.status}`);
    return;
  }

  if (!upstream.body) {
    jsonError(res, 502, 'upstream empty body');
    return;
  }

  // 流式转发:设置响应头后 pipe 上游 body 到 res
  setAudioCors(res);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const contentType = upstream.headers.get('content-type');
  res.setHeader('Content-Type', contentType ?? 'audio/mpeg');

  // Node fetch 的 body 是 Web ReadableStream,需转成 Node Readable 再 pipe
  // 断言:运行时全局 ReadableStream 即 node:stream/web 的实现,
  // 但 lib.dom 与 @types/node 的类型声明不一致,需 unknown 中转
  const nodeStream = Readable.fromWeb(
    upstream.body as unknown as NodeReadableStream,
  );
  // 流式错误兜底(网络中断等,避免未捕获错误 crash 进程)
  nodeStream.on('error', () => {
    try {
      res.end();
    } catch {
      /* response already ended */
    }
  });
  nodeStream.pipe(res as unknown as ServerResponse);
}

// ---------------------------------------------------------------------------
// 动态路由分发入口
// ---------------------------------------------------------------------------

const handlers: Record<string, ApiHandler> = {
  'qr-create': qrCreate,
  'qr-check': qrCheck,
  'playlist-list': playlistList,
  'playlist-detail': playlistDetail,
  'song-url': songUrl,
  'audio-proxy': audioProxy,
};

export default handleRequest(async (req, res) => {
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  console.log(`[qishui] action=${action} method=${req.method ?? ''}`);
  const handler = handlers[action];
  if (!handler) {
    jsonBody(res, 404, { error: `Unknown action: ${action}` });
    return;
  }
  await handler(req, res);
});
