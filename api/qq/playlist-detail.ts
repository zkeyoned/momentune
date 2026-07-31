/**
 * 获取歌单详情(歌曲列表)
 *
 * POST /api/qq/playlist-detail  body: { cookie, playlistId, begin?, num? }
 * 返回: { tracks: [{ id, title, artist }], total }
 * 支持分页:begin(偏移,默认 0)、num(每页数量,默认 100)
 */

import { handleRequest, jsonBody, getField, callMusicu } from './_shared';

interface TrackMeta {
  id: string;
  title: string;
  artist: string;
}

/** 默认每页歌曲数 */
const DEFAULT_PAGE_SIZE = 100;

export default handleRequest(async (req, res) => {
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
});
