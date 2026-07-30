/**
 * 获取用户红心歌单(我喜欢的音乐)
 *
 * POST /api/netease/likelist  body: { uid, cookie }
 * 返回: { ids: number[] }  — 红心歌曲 ID 列表(截取前 100 首)
 */

import { handleRequest, jsonBody, getField, callNetease } from './_shared';

/** 红心列表最大返回数量(控制风控和性能) */
const MAX_LIKELIST_SIZE = 100;

export default handleRequest(async (req, res) => {
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
});
