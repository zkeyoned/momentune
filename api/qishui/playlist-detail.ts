/**
 * 获取歌单详情(歌曲列表,自动翻页)
 *
 * POST /api/qishui/playlist-detail  body: { cookie, playlistId }
 * 返回: { tracks: [{ id, title, artist, coverUrl? }] }
 *
 * 端点:GET https://api.qishui.com/luna/pc/playlist/detail
 *   - 参数:aid, playlist_id, cursor, count=20
 *   - 返回 has_more=true 时用 next_cursor 继续翻页,累积 media_resources
 *
 * 字段结构(对齐 Mineradio SodaPlaylistDetailBody):
 *   {
 *     playlist: {...},
 *     media_resources: [{
 *       id: "xxx",
 *       type: "track",
 *       entity: {
 *         track_wrapper: {
 *           track: {
 *             id: "xxx",
 *             name: "歌名",
 *             artists: [{ name: "歌手" }],
 *             album: { url_cover: { urls: ["//..."] } }
 *           }
 *         }
 *       }
 *     }],
 *     has_more: true/false,
 *     next_cursor: "..."
 *   }
 *
 * 注意:media_resources 直接挂在 root,不在 root.data 下;
 *      歌曲信息要深入 entity.track_wrapper.track 才能拿到。
 *
 * 参考实现:Mineradio-Tauri soda-client.ts + providers/soda/map.ts
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

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

/** 单次请求的歌曲数(与 PC 客户端一致) */
const PAGE_COUNT = 20;
/** 最大翻页数(防失控) */
const MAX_PAGES = 50;

/**
 * 从单个 media_resource 项中提取歌曲信息
 *
 * 结构:item.entity.track_wrapper.track
 * 兼容老结构(直接挂在 item 上)作 fallback
 */
function extractTrackFromMedia(item: Record<string, unknown>): TrackItem | null {
  // 1) 新结构:entity.track_wrapper.track
  const entity = asObj(item.entity);
  const trackWrapper = asObj(entity?.track_wrapper);
  const track = asObj(trackWrapper?.track);

  // 2) fallback:直接当 track
  const fallbackTrack = asObj(item.track) ?? asObj(item);

  const t = track ?? fallbackTrack;
  if (!t) return null;

  // ID:track.id 优先,再 item.id
  const id =
    (typeof t.id === 'string' ? t.id : undefined) ??
    (typeof t.id === 'number' ? String(t.id) : undefined) ??
    (typeof item.id === 'string' ? item.id : undefined) ??
    (typeof item.id === 'number' ? String(item.id) : undefined);
  if (!id) return null;

  // 标题:track.name 优先
  const title =
    (typeof t.name === 'string' && t.name.trim() ? t.name : undefined) ??
    (typeof t.title === 'string' && t.title.trim() ? t.title : undefined) ??
    '未知歌曲';

  // 歌手:track.artists 是 [{ name }]
  let artist = '未知歌手';
  const artistsRaw = t.artists ?? t.singers ?? t.author;
  if (typeof artistsRaw === 'string' && artistsRaw.trim()) {
    artist = artistsRaw.trim();
  } else if (Array.isArray(artistsRaw)) {
    const names = artistsRaw
      .map((a) => {
        const obj = asObj(a);
        const n = obj?.name;
        return typeof n === 'string' ? n.trim() : (typeof a === 'string' ? a.trim() : '');
      })
      .filter(Boolean);
    if (names.length > 0) artist = names.join(' / ');
  }

  // 封面:track.album.url_cover.urls[0](以 // 开头需补 https:)
  let coverUrl: string | undefined;
  const album = asObj(t.album);
  const urlCover = asObj(album?.url_cover);
  const urls = urlCover?.urls;
  if (Array.isArray(urls) && urls.length > 0 && typeof urls[0] === 'string') {
    const raw = urls[0].trim();
    if (raw.startsWith('//')) {
      coverUrl = `https:${raw}`;
    } else if (raw.startsWith('http')) {
      coverUrl = raw;
    }
  }
  // fallback:cover_url / pic_url
  if (!coverUrl) {
    const cu =
      (typeof t.cover_url === 'string' ? t.cover_url : undefined) ??
      (typeof album?.cover_url === 'string' ? album.cover_url : undefined) ??
      (typeof t.pic_url === 'string' ? t.pic_url : undefined);
    if (cu) coverUrl = cu;
  }

  const result: TrackItem = { id, title, artist };
  if (coverUrl) result.coverUrl = coverUrl;
  return result;
}

export default handleRequest(async (req, res) => {
  if (req.method !== 'POST') {
    jsonBody(res, 405, { error: 'Method not allowed, use POST' });
    return;
  }

  const cookie = getField(req, 'cookie');
  const playlistId = getField(req, 'playlistId');
  if (!cookie) {
    jsonBody(res, 400, { error: '缺少 cookie 参数' });
    return;
  }
  if (!playlistId) {
    jsonBody(res, 400, { error: '缺少 playlistId 参数' });
    return;
  }

  const allMediaResources: unknown[] = [];
  let cursor: string | number = '1';
  let hasMore = true;
  let page = 0;

  // 自动翻页:has_more=true 时用 next_cursor 继续
  while (hasMore && page < MAX_PAGES) {
    page += 1;
    const url =
      `${SODA_API_CONFIG.API_BASE}/luna/pc/playlist/detail` +
      `?aid=${SODA_API_CONFIG.AID}` +
      `&playlist_id=${encodeURIComponent(playlistId)}` +
      `&cursor=${encodeURIComponent(String(cursor))}` +
      `&count=${PAGE_COUNT}`;

    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, {
        method: 'GET',
        headers: buildSodaHeaders({ cookie }),
      });
    } catch (e) {
      // 已有数据时返回已累积的,不再继续
      if (allMediaResources.length > 0) break;
      jsonBody(res, 500, {
        error: `请求 playlist/detail 失败: ${e instanceof Error ? e.message : 'unknown'}`,
      });
      return;
    }

    if (!resp.ok) {
      if (allMediaResources.length > 0) break;
      jsonBody(res, 500, { error: `playlist/detail 返回 ${resp.status}` });
      return;
    }

    const body = await readJsonBody(resp);
    const root = asObj(body) ?? {};

    // media_resources 直接挂在 root(对齐 Mineradio readMediaResources)
    // 兼容:若 root.data 是对象且 root 自身没有 media_resources,再 fallback 到 root.data
    let mediaResources = root.media_resources;
    if (!Array.isArray(mediaResources)) {
      const dataField = asObj(root.data);
      mediaResources = dataField?.media_resources;
    }
    if (Array.isArray(mediaResources)) {
      allMediaResources.push(...mediaResources);
    }

    // has_more / next_cursor 同样直接读 root(对齐 Mineradio readPlaylistNextCursor)
    hasMore = root.has_more === true;
    const nextCursor = root.next_cursor;
    if (hasMore && typeof nextCursor === 'string' && nextCursor.trim()) {
      cursor = nextCursor;
    } else if (hasMore && (typeof nextCursor === 'number' || typeof nextCursor === 'string')) {
      cursor = nextCursor as string | number;
    } else {
      hasMore = false;
    }
  }

  // 从累积的 media_resources 提取歌曲信息
  const tracks: TrackItem[] = [];
  const seenIds = new Set<string>();
  // 用 songKey 二次去重(防止同名同歌手重复)
  const seenKeys = new Set<string>();

  for (const raw of allMediaResources) {
    const item = asObj(raw);
    if (!item) continue;
    const track = extractTrackFromMedia(item);
    if (!track) continue;
    if (seenIds.has(track.id)) continue;
    seenIds.add(track.id);

    const key = `${track.title}|${track.artist}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    tracks.push(track);
  }

  jsonBody(res, 200, { tracks });
});
