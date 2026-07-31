/**
 * QQ 音乐 API 动态路由入口(合并自原 8 个独立 Serverless Function)
 *
 * 路由:/api/qq/[action]
 *   action 取值:qr-create | qr-check | likelist | user-playlists
 *               | playlist-detail | song-detail-batch | song-url | audio-proxy
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
  callMusicu,
  APPID,
  PT_3RD_AID,
  DAID,
  REDIRECT_URI,
  PTQRSHOW_URL,
  PTQRCHECK_URL,
  AUTHORIZE_URL,
  MUSICU_URL,
  USER_AGENT,
  hash33,
  gtkFromPskey,
  parsePtuiCallback,
  mergeHeadersCookies,
  cookieHeader,
  getCookieValue,
  defaultGuid,
  arrayBufferToBase64,
  extractSetCookies,
  fetchWithTimeout,
  type VercelReq,
  type VercelRes,
  type ApiHandler,
} from './_shared';

// ---------------------------------------------------------------------------
// handler: qr-create  (原 api/qq/qr-create.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qq/qr-create
 * 返回 { qrimg, key }
 *   qrimg: base64 data URL,前端直接渲染
 *   key:   `<encodeURIComponent(qrsig)>|<hash33(qrsig)>`,前端原样回传给 qr-check
 */
async function qrCreate(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  // 1. 请求 ptqrshow 拿二维码图片 + qrsig cookie
  const url =
    `${PTQRSHOW_URL}?appid=${APPID}&e=2&l=M&s=3&d=72&v=4` +
    `&t=${Math.random()}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}` +
    `&u1=${encodeURIComponent('https://graph.qq.com/oauth2.0/login_jump')}`;

  const upstream = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!upstream.ok) {
    jsonBody(res, 500, { error: `ptqrshow 请求失败: ${upstream.status}` });
    return;
  }

  // 2. 从 Set-Cookie 提取 qrsig
  let qrsig = '';
  for (const c of extractSetCookies(upstream.headers)) {
    const match = c.match(/qrsig=([^;]+)/);
    if (match?.[1]) {
      qrsig = match[1];
      break;
    }
  }
  if (!qrsig) {
    jsonBody(res, 500, { error: '未拿到 qrsig cookie' });
    return;
  }

  // 3. 图片 binary 转 base64 data URL
  const buf = await upstream.arrayBuffer();
  const qrimg = `data:image/png;base64,${arrayBufferToBase64(buf)}`;

  // 4. 编码 key:qrsig + ptqrtoken,前端原样回传给 qr-check
  const ptqrtoken = hash33(qrsig);
  const key = `${encodeURIComponent(qrsig)}|${ptqrtoken}`;

  jsonBody(res, 200, { qrimg, key });
}

// ---------------------------------------------------------------------------
// handler: qr-check  (原 api/qq/qr-check.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qq/qr-check  body: { key }
 *   key: qr-create 返回的 `<encodeURIComponent(qrsig)>|<ptqrtoken>`
 *
 * 返回:
 *   { code: 66, message }                    — 二维码未失效,等待扫码
 *   { code: 67, message }                    — 已扫码待确认
 *   { code: 65, message }                    — 二维码已过期
 *   { code: 0, message, cookie, nickname }   — 登录成功
 *
 * 任何一步失败抛错返回 500(由 handleRequest 兜底)。
 */
async function qrCheck(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const key = getField(req, 'key');
  if (!key) {
    jsonBody(res, 400, { error: '缺少 key 参数' });
    return;
  }

  // 解码 key 拿 qrsig 和 ptqrtoken
  const keyParts = key.split('|');
  const qrsigEncoded = keyParts[0];
  const ptqrtokenStr = keyParts[1];
  if (!qrsigEncoded || !ptqrtokenStr) {
    jsonBody(res, 400, { error: 'key 格式不合法' });
    return;
  }
  const qrsig = decodeURIComponent(qrsigEncoded);
  const ptqrtoken = Number(ptqrtokenStr);

  // 累积 cookies(整个登录流程共用)
  const cookies = new Map<string, string>();
  cookies.set('qrsig', `qrsig=${qrsig}`);

  // ---------------- 第 2 步:轮询扫码状态(ptqrlogin) ----------------
  const checkUrl =
    `${PTQRCHECK_URL}?u1=${encodeURIComponent('https://graph.qq.com/oauth2.0/login_jump')}` +
    `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
    `&action=0-0-${Date.now()}&js_ver=23111510&js_type=1&login_sig=&pt_uistyle=40` +
    `&aid=${APPID}&daid=${DAID}&pt_3rd_aid=${PT_3RD_AID}`;

  const checkRes = await fetchWithTimeout(checkUrl, {
    headers: {
      Cookie: cookieHeader(cookies),
      Referer: 'https://xui.ptlogin2.qq.com/',
      'User-Agent': USER_AGENT,
    },
  });

  if (!checkRes.ok) {
    jsonBody(res, 500, { error: `ptqrlogin 请求失败: ${checkRes.status}` });
    return;
  }

  // 累积 check 阶段返回的 cookie
  mergeHeadersCookies(cookies, checkRes.headers);

  const checkText = await checkRes.text();
  const { code, redirectUrl, message } = parsePtuiCallback(checkText);

  // 未成功:66 未扫码 / 67 已扫码待确认 / 65 已过期
  if (code !== 0) {
    jsonBody(res, 200, { code, message: message || '未知状态' });
    return;
  }

  if (!redirectUrl) {
    jsonBody(res, 500, { error: '登录成功但未拿到 redirect_url' });
    return;
  }

  // ---------------- 第 3 步:check_sig 换 p_skey ----------------
  const sigRes = await fetchWithTimeout(redirectUrl, {
    redirect: 'manual',
    headers: {
      Cookie: cookieHeader(cookies),
      'User-Agent': USER_AGENT,
    },
  });
  mergeHeadersCookies(cookies, sigRes.headers);

  // 提取 p_skey 算 g_tk
  const pskey = getCookieValue(cookies, 'p_skey');
  if (!pskey) {
    jsonBody(res, 500, { error: '未拿到 p_skey' });
    return;
  }
  const gtk = gtkFromPskey(pskey);

  // ---------------- 第 4 步:oauth2.0/authorize 换 code ----------------
  const authorizeBody = new URLSearchParams({
    response_type: 'code',
    client_id: PT_3RD_AID,
    redirect_uri: REDIRECT_URI,
    scope: 'get_user_info,get_app_friends',
    state: 'state',
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '1',
    openapi: '1010_1030',
    g_tk: String(gtk),
    auth_time: new Date().toString(),
    ui: defaultGuid(),
  });

  const authRes = await fetchWithTimeout(AUTHORIZE_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies),
      'User-Agent': USER_AGENT,
    },
    body: authorizeBody.toString(),
  });
  mergeHeadersCookies(cookies, authRes.headers);

  // 从 Location 头提取 code
  const location = authRes.headers.get('location') ?? '';
  const codeMatch = location.match(/[?&]code=([^&]+)/);
  const authCode = codeMatch?.[1] ? decodeURIComponent(codeMatch[1]) : '';
  if (!authCode) {
    jsonBody(res, 500, { error: '未拿到 OAuth code' });
    return;
  }

  // ---------------- 第 5 步:musicu.fcg 换 QQ 音乐 cookie ----------------
  const musicuBody = JSON.stringify({
    comm: { g_tk: gtk, platform: 'yqq', ct: 24, cv: 0 },
    req: {
      module: 'QQConnectLogin.LoginServer',
      method: 'QQLogin',
      param: { code: authCode },
    },
  });

  const musicuRes = await fetchWithTimeout(MUSICU_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies),
      'User-Agent': USER_AGENT,
      Referer: 'https://y.qq.com/',
    },
    body: musicuBody,
  });
  mergeHeadersCookies(cookies, musicuRes.headers);

  // 解析返回,尝试拿 nickname
  let nickname = 'QQ音乐用户';
  try {
    const musicuJson = (await musicuRes.json()) as {
      req?: { data?: { nickname?: string } };
    };
    const nick = musicuJson?.req?.data?.nickname;
    if (nick) nickname = nick;
  } catch {
    // 解析失败不影响主流程,用默认 nickname
  }

  const finalCookie = cookieHeader(cookies);
  if (!finalCookie) {
    jsonBody(res, 500, { error: '登录成功但未拿到 cookie' });
    return;
  }

  jsonBody(res, 200, { code: 0, message: '登录成功', cookie: finalCookie, nickname });
}

// ---------------------------------------------------------------------------
// handler: likelist  (原 api/qq/likelist.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qq/likelist  body: { cookie, uin }
 * 返回: { ids: ["<songmid>", ...] }  — 截取前 100 首
 */

/** 红心歌单最大返回数量(控制风控和性能) */
const MAX_LIKELIST_SIZE = 100;

async function likelist(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const uin = getField(req, 'uin');

  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!uin) {
    jsonBody(res, 400, { error: '缺少 uin 参数' });
    return;
  }

  // enc_host_uin:对 uin 做 base64 编码(QQ 音乐红心歌单接口需要)
  const euin = Buffer.from(uin).toString('base64');

  const data = (await callMusicu(cookie, 'music.srfDissInfo.DissInfo', 'CgiGetDiss', {
    disstid: 0,
    dirid: 201,
    enc_host_uin: euin,
    song_begin: 0,
    song_num: MAX_LIKELIST_SIZE,
  })) as { songlist?: Array<Record<string, unknown>> } | undefined;

  const songlist = data?.songlist ?? [];
  const ids: string[] = [];
  for (const s of songlist) {
    const mid = s.songmid;
    if (typeof mid === 'string' && mid) {
      ids.push(mid);
      if (ids.length >= MAX_LIKELIST_SIZE) break;
    }
  }

  jsonBody(res, 200, { ids });
}

// ---------------------------------------------------------------------------
// handler: user-playlists  (原 api/qq/user-playlists.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qq/user-playlists  body: { cookie, uin }
 * 返回: { playlists: [{ id, title, trackCount }] }
 */

interface PlaylistMeta {
  id: string;
  title: string;
  trackCount: number;
}

async function userPlaylists(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const uin = getField(req, 'uin');

  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!uin) {
    jsonBody(res, 400, { error: '缺少 uin 参数' });
    return;
  }

  const data = (await callMusicu(
    cookie,
    'music.musicasset.PlaylistBaseRead',
    'GetPlaylistByUin',
    { uin: Number(uin) },
  )) as {
    v_playlist?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>>;
  } | undefined;

  // v_playlist 可能是数组或对象(以 tid 为 key),兼容两种
  const vPlaylist = data?.v_playlist;
  let playlistRaw: Array<Record<string, unknown>> = [];
  if (Array.isArray(vPlaylist)) {
    playlistRaw = vPlaylist;
  } else if (vPlaylist && typeof vPlaylist === 'object') {
    playlistRaw = Object.values(vPlaylist);
  }

  const playlists: PlaylistMeta[] = playlistRaw
    .map((p) => ({
      id: String(p.tid ?? p.dirId ?? p.dirid ?? ''),
      title: String(p.dname ?? p.title ?? p.name ?? '未知歌单'),
      trackCount: Number(p.songnum ?? p.song_num ?? p.trackCount ?? 0),
    }))
    .filter((p) => p.id);

  jsonBody(res, 200, { playlists });
}

// ---------------------------------------------------------------------------
// handler: playlist-detail  (原 api/qq/playlist-detail.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qq/playlist-detail  body: { cookie, playlistId, begin?, num? }
 * 返回: { tracks: [{ id, title, artist }], total }
 * 支持分页:begin(偏移,默认 0)、num(每页数量,默认 100)
 */

interface TrackMeta {
  id: string;
  title: string;
  artist: string;
}

/** 默认每页歌曲数 */
const DEFAULT_PAGE_SIZE = 100;

async function playlistDetail(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const playlistId = getField(req, 'playlistId');
  const beginStr = getField(req, 'begin') ?? '0';
  const numStr = getField(req, 'num') ?? String(DEFAULT_PAGE_SIZE);

  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!playlistId) {
    jsonBody(res, 400, { error: '缺少 playlistId 参数' });
    return;
  }

  const data = (await callMusicu(cookie, 'music.srfDissInfo.DissInfo', 'CgiGetDiss', {
    disstid: Number(playlistId),
    dirid: 0,
    song_begin: Number(beginStr),
    song_num: Number(numStr),
  })) as { songlist?: Array<Record<string, unknown>>; total_song_num?: number } | undefined;

  const songlist = data?.songlist ?? [];
  const tracks: TrackMeta[] = [];
  for (const s of songlist) {
    const singer = s.singer as Array<{ name?: string }> | undefined;
    const artist = singer?.map((x) => x.name ?? '').filter(Boolean).join(' / ') || '未知歌手';
    const id = String(s.songmid ?? '');
    if (id) {
      tracks.push({
        id,
        title: String(s.songname ?? '未知歌曲'),
        artist,
      });
    }
  }

  jsonBody(res, 200, { tracks, total: data?.total_song_num ?? tracks.length });
}

// ---------------------------------------------------------------------------
// handler: song-detail-batch  (原 api/qq/song-detail-batch.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qq/song-detail-batch  body: { cookie, ids }
 *   ids: songmid 字符串数组
 * 返回: { songs: [{ id, title, artist, coverUrl? }] }
 */

interface SongDetailItem {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

async function songDetailBatch(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const ids = getField<string[]>(req, 'ids');

  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    jsonBody(res, 400, { error: '缺少 ids 参数' });
    return;
  }

  const data = (await callMusicu(
    cookie,
    'music.trackInfo.UniformRuleCtrl',
    'CgiGetTrackInfo',
    { songmids: ids },
  )) as { tracks?: Array<Record<string, unknown>> } | undefined;

  const tracksRaw = data?.tracks ?? [];
  const songs: SongDetailItem[] = [];
  for (const s of tracksRaw) {
    const singer = s.singer as Array<{ name?: string }> | undefined;
    const artist = singer?.map((x) => x.name ?? '').filter(Boolean).join(' / ') || '未知歌手';
    const album = s.album as { mid?: string; name?: string } | undefined;
    let coverUrl: string | undefined;
    if (album?.mid) {
      coverUrl = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${album.mid}.jpg`;
    }
    const id = String(s.songmid ?? '');
    if (id) {
      songs.push({
        id,
        title: String(s.songname ?? '未知歌曲'),
        artist,
        coverUrl,
      });
    }
  }

  jsonBody(res, 200, { songs });
}

// ---------------------------------------------------------------------------
// handler: song-url  (原 api/qq/song-url.ts)
// ---------------------------------------------------------------------------

/**
 * POST /api/qq/song-url  body: { cookie, songmid, uin, guid? }
 * 返回: { url, isTrial }
 *   - 明文 MP3: { url: "<mp3 URL>", isTrial: false }
 *   - VIP 歌曲无明文 URL: { url: "", isTrial: true, message: "VIP 歌曲无法播放" }
 *
 * 注意:VIP 加密格式(.mflac)本次不接入,直接降级提示。
 */

/** QQ 音乐默认 CDN 域名(purl 为相对路径时拼接) */
const QQ_MUSIC_CDN = 'https://dl.stream.qqmusic.qq.com';

async function songUrl(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const songmid = getField(req, 'songmid');
  const uin = getField(req, 'uin');
  const guid = getField(req, 'guid') || defaultGuid();

  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!songmid) {
    jsonBody(res, 400, { error: '缺少 songmid 参数' });
    return;
  }
  if (!uin) {
    jsonBody(res, 400, { error: '缺少 uin 参数' });
    return;
  }

  const data = (await callMusicu(cookie, 'music.vkey.GetVkey', 'UrlGetVkey', {
    songmid: [songmid],
    songtype: [0],
    uin,
    format: 'json',
    guid,
  })) as { midurlinfo?: Array<Record<string, unknown>> } | undefined;

  const purl = String(data?.midurlinfo?.[0]?.purl ?? '');
  if (!purl) {
    // 无明文 URL:VIP 歌曲或需加密格式(.mflac),本次不接入
    jsonBody(res, 200, { url: '', isTrial: true, message: 'VIP 歌曲无法播放' });
    return;
  }

  // purl 是相对路径时拼接 CDN 域名
  const url = purl.startsWith('http') ? purl : `${QQ_MUSIC_CDN}/${purl}`;

  jsonBody(res, 200, { url, isTrial: false });
}

// ---------------------------------------------------------------------------
// handler: audio-proxy  (原 api/qq/audio-proxy.ts)
// ---------------------------------------------------------------------------

/**
 * GET /api/qq/audio-proxy?url=<QQ 音乐 CDN 地址>
 *   绕过浏览器 CORS/ORB 限制,流式转发音频数据。
 *   Referer/UA 与 QQ 音乐官网一致。
 *
 * 行为与 /api/audio-proxy.ts(网易云代理)一致,仅改 Referer/UA。
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

  // 请求上游(Referer/UA 与 QQ 音乐官网一致)
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      headers: {
        Referer: 'https://y.qq.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
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
  'likelist': likelist,
  'user-playlists': userPlaylists,
  'playlist-detail': playlistDetail,
  'song-detail-batch': songDetailBatch,
  'song-url': songUrl,
  'audio-proxy': audioProxy,
};

export default handleRequest(async (req, res) => {
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  console.log(`[qq] action=${action} method=${req.method ?? ''}`);
  const handler = handlers[action];
  if (!handler) {
    jsonBody(res, 404, { error: `Unknown action: ${action}` });
    return;
  }
  await handler(req, res);
});
