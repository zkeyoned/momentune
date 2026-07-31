/**
 * 批量获取歌曲详情(标题、歌手、封面)
 *
 * POST /api/qq/song-detail-batch  body: { cookie, ids }
 *   ids: songmid 字符串数组
 * 返回: { songs: [{ id, title, artist, coverUrl? }] }
 */

import { handleRequest, jsonBody, getField, callMusicu } from './_shared';

interface SongDetailItem {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

export default handleRequest(async (req, res) => {
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
});
