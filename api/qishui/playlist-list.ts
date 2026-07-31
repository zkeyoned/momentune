/**
 * 获取用户所有歌单
 *
 * POST /api/qishui/playlist-list  body: { cookie }
 * 返回: { playlists: [{ id, title, trackCount, coverUrl? }] }
 *
 * 端点:GET https://api.qishui.com/luna/pc/me/playlist?aid=386088
 *   - 需要 cookie 头
 *
 * 参考实现:Mineradio-Tauri soda-client.ts
 */

import {
  handleRequest,
  jsonBody,
  getField,
  fetchWithTimeout,
  readJsonBody,
  asObj,
  buildSodaHeaders,
  SODA_API_CONFIG,
} from './_shared';

interface PlaylistItem {
  id: string;
  title: string;
  trackCount: number;
  coverUrl?: string;
}

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }

  const url =
    `${SODA_API_CONFIG.API_BASE}/luna/pc/me/playlist` +
    `?aid=${SODA_API_CONFIG.AID}`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, {
      method: 'GET',
      headers: buildSodaHeaders({ cookie }),
    });
  } catch (e) {
    jsonBody(res, 500, {
      error: `请求 me/playlist 失败: ${e instanceof Error ? e.message : 'unknown'}`,
    });
    return;
  }

  if (!resp.ok) {
    jsonBody(res, 500, { error: `me/playlist 返回 ${resp.status}` });
    return;
  }

  const body = await readJsonBody(resp);
  // 返回结构(对齐 Mineradio):root.playlists 或 root.data.playlists
  const root = asObj(body);
  let playlistsRaw = root?.playlists;
  if (!Array.isArray(playlistsRaw)) {
    const dataField = asObj(root?.data);
    playlistsRaw = dataField?.playlists;
  }

  if (!Array.isArray(playlistsRaw)) {
    jsonBody(res, 200, { playlists: [] });
    return;
  }

  const playlists: PlaylistItem[] = playlistsRaw
    .map((raw): PlaylistItem | null => {
      const p = asObj(raw) ?? {};
      // 字段映射(对齐 Mineradio SodaPlaylistBody):
      //   id / title / count_tracks / url_cover.urls[0]
      // 兼容老字段名:playlist_id / name / track_count / cover_url
      const id =
        (typeof p.id === 'string' ? p.id : undefined) ??
        (typeof p.id === 'number' ? String(p.id) : undefined) ??
        (typeof p.playlist_id === 'string' ? p.playlist_id : undefined) ??
        (typeof p.playlist_id === 'number' ? String(p.playlist_id) : undefined);
      if (!id || id.length === 0) return null;

      const title =
        (typeof p.title === 'string' && p.title.trim() ? p.title : undefined) ??
        (typeof p.name === 'string' && p.name.trim() ? p.name : undefined) ??
        '未知歌单';
      const trackCount =
        (typeof p.count_tracks === 'number' ? p.count_tracks : undefined) ??
        (typeof p.track_count === 'number' ? p.track_count : undefined) ??
        (typeof p.trackCount === 'number' ? p.trackCount : undefined) ??
        0;

      // 封面:url_cover.urls[0](以 // 开头需补 https:)
      let coverUrl: string | undefined;
      const urlCover = asObj(p.url_cover);
      const urls = urlCover?.urls;
      if (Array.isArray(urls) && urls.length > 0 && typeof urls[0] === 'string') {
        const raw = urls[0].trim();
        if (raw.startsWith('//')) coverUrl = `https:${raw}`;
        else if (raw.startsWith('http')) coverUrl = raw;
      }
      if (!coverUrl) {
        const cu =
          (typeof p.cover_url === 'string' ? p.cover_url : undefined) ??
          (typeof p.pic_url === 'string' ? p.pic_url : undefined);
        if (cu) coverUrl = cu;
      }

      const item: PlaylistItem = { id, title, trackCount };
      if (coverUrl) item.coverUrl = coverUrl;
      return item;
    })
    .filter((p): p is PlaylistItem => p !== null);

  jsonBody(res, 200, { playlists });
});
