/**
 * 获取用户红心歌单(QQ 音乐 dirid=201)
 *
 * POST /api/qq/likelist  body: { cookie, uin }
 * 返回: { ids: ["<songmid>", ...] }  — 截取前 100 首
 */

import { handleRequest, jsonBody, getField, callMusicu } from './_shared';

/** 红心歌单最大返回数量(控制风控和性能) */
const MAX_LIKELIST_SIZE = 100;

export default handleRequest(async (req, res) => {
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
});
