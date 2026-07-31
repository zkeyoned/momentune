/**
 * 获取单首歌曲播放地址(运行时按需调用)
 *
 * POST /api/qq/song-url  body: { cookie, songmid, uin, guid? }
 * 返回: { url, isTrial }
 *   - 明文 MP3: { url: "<mp3 URL>", isTrial: false }
 *   - VIP 歌曲无明文 URL: { url: "", isTrial: true, message: "VIP 歌曲无法播放" }
 *
 * 注意:VIP 加密格式(.mflac)本次不接入,直接降级提示。
 */

import { handleRequest, jsonBody, getField, callMusicu, defaultGuid } from './_shared';

/** QQ 音乐默认 CDN 域名(purl 为相对路径时拼接) */
const QQ_MUSIC_CDN = 'https://dl.stream.qqmusic.qq.com';

export default handleRequest(async (req, res) => {
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
});
