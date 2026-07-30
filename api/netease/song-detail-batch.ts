/**
 * 批量获取歌曲详情(标题、歌手、封面)
 *
 * POST /api/netease/song-detail-batch  body: { ids, cookie }
 *   ids: 逗号分隔的 neteaseId 字符串(单次最多 50 个)
 *
 * 返回: { songs: [{ neteaseId, title, artist, coverUrl }] }
 */

import { handleRequest, jsonBody, getField, callNetease } from './_shared';

interface SongDetailItem {
  neteaseId: number;
  title: string;
  artist: string;
  coverUrl?: string;
}

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const idsStr = getField(req, 'ids');
  const cookie = getField(req, 'cookie');

  if (!idsStr) {
    jsonBody(res, 400, { error: '缺少 ids 参数' });
    return;
  }

  const result = await callNetease('song_detail', {
    ids: idsStr,
    timestamp: Date.now(),
  }, cookie);

  const songsRaw = result?.songs as unknown[] | undefined;
  if (!Array.isArray(songsRaw)) {
    jsonBody(res, 200, { songs: [] });
    return;
  }

  const songs: SongDetailItem[] = songsRaw.map((raw) => {
    const s = raw as Record<string, unknown>;
    const artists = s.ar as Array<{ name?: string }> | undefined;
    const album = s.al as { picUrl?: string } | undefined;
    return {
      neteaseId: s.id as number,
      title: (s.name as string) ?? '未知歌曲',
      artist: artists?.map((a) => a.name ?? '').filter(Boolean).join(' / ') || '未知歌手',
      coverUrl: album?.picUrl ? `${album.picUrl.replace(/^http:\/\//, 'https://')}?param=200y200` : undefined,
    };
  });

  jsonBody(res, 200, { songs });
});
