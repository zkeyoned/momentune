/**
 * 获取用户所有歌单的歌曲 ID（合并去重）
 *
 * POST /api/netease/user-playlists  body: { uid, cookie }
 * 返回: { ids: number[], playlists: {id, name, trackCount}[] }
 *
 * 流程:
 *   1. 调 user_playlist 拿用户所有歌单列表
 *   2. 对每个歌单调 playlist_track_all 拿歌曲 ID
 *   3. 合并去重，截取前 200 首
 *
 * 容错: 单个歌单失败不阻塞其他歌单
 */

import { handleRequest, jsonBody, getField, callNetease } from './_shared';

/** 返回歌曲 ID 上限（控制风控和性能） */
const MAX_SONG_IDS = 200;
/** 单次最多处理的歌单数量 */
const MAX_PLAYLISTS = 10;
/** 歌单间请求间隔（ms，防风控） */
const PLAYLIST_FETCH_INTERVAL_MS = 400;

interface PlaylistMeta {
  id: number;
  name: string;
  trackCount: number;
}

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

  // 过滤掉红心歌单（红心由 likelist 单独拉取），取前 MAX_PLAYLISTS 个
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
      // 单个歌单失败，跳过，继续下一个
    }
    // 防风控间隔
    await new Promise((r) => setTimeout(r, PLAYLIST_FETCH_INTERVAL_MS));
  }

  const ids = Array.from(allIds).slice(0, MAX_SONG_IDS);
  jsonBody(res, 200, { ids, playlists });
});
