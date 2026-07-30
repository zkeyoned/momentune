/**
 * 获取用户最近听过的歌曲 ID
 *
 * POST /api/netease/recent-songs  body: { uid, cookie }
 * 返回: { ids: number[] }
 *
 * 使用 record_recent_song 接口（最近播放的歌曲），
 * 截取前 100 首返回
 */

import { handleRequest, jsonBody, getField, callNetease } from './_shared';

/** 返回歌曲 ID 上限 */
const MAX_RECENT_SONGS = 100;

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
});
