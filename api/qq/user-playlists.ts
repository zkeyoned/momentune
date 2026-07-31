/**
 * 获取用户自建歌单列表
 *
 * POST /api/qq/user-playlists  body: { cookie, uin }
 * 返回: { playlists: [{ id, title, trackCount }] }
 */

import { handleRequest, jsonBody, getField, callMusicu } from './_shared';

interface PlaylistMeta {
  id: string;
  title: string;
  trackCount: number;
}

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
});
