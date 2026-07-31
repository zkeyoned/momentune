/**
 * 获取单首歌曲的播放地址(两步法)
 *
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

import {
  handleRequest,
  jsonBody,
  getField,
  fetchWithTimeout,
  readJsonBody,
  asObj,
  readString,
  buildSodaHeaders,
  SODA_API_CONFIG,
} from './_shared';

/** 最大翻页次数兜底(取 PlayInfoList 时无翻页,这里只用作防御) */
const MAX_QUALITY_RETRY = 5;

export default handleRequest(async (req, res) => {
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
});
