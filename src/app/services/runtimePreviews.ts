/**
 * 运行时播放地址管理
 *
 * 用户导入的歌曲(网易云红心歌单)不在构建期生成的 SONG_PREVIEW_URLS 中,
 * 需要在播放时按需从网易云 API 获取播放地址,缓存在内存 Map 中。
 *
 * URL 有时效(几小时),超过 2 小时自动重取。
 */

import { SONG_PREVIEW_URLS, type SongPreview } from './songPreviewUrls';
import { fetchSongUrl } from './neteaseApi';
import { useUserStore } from '../stores/userStore';

/** URL 缓存有效期(2 小时) */
const URL_TTL_MS = 2 * 60 * 60 * 1000;

/** 运行时获取的 preview(含获取时间戳) */
interface RuntimePreviewEntry {
  preview: SongPreview;
  fetchedAt: number;
}

/** 内存缓存:songId → preview entry(不持久化,刷新后清空) */
const RUNTIME_PREVIEWS = new Map<string, RuntimePreviewEntry>();

/** 正在获取中的 songId(防重复请求) */
const pendingFetches = new Map<string, Promise<SongPreview>>();

/**
 * 合并查询静态表和运行时表
 *
 * 优先返回静态表(构建期生成的 SONG_PREVIEW_URLS),
 * 静态表没有时返回运行时缓存。
 *
 * 如果运行时缓存的 URL 已过期,返回 undefined(调用方应调 ensurePreview 重取)。
 */
export function getPreview(songId: string): SongPreview | undefined {
  // 1. 静态表优先(构建期生成的,有 localFile)
  const staticPreview = SONG_PREVIEW_URLS[songId];
  if (staticPreview) return staticPreview;

  // 2. 运行时缓存
  const runtimeEntry = RUNTIME_PREVIEWS.get(songId);
  if (runtimeEntry) {
    // 检查是否过期
    const age = Date.now() - runtimeEntry.fetchedAt;
    if (age < URL_TTL_MS) {
      return runtimeEntry.preview;
    }
    // 过期,清除旧缓存
    RUNTIME_PREVIEWS.delete(songId);
  }

  return undefined;
}

/**
 * 按需获取播放地址并缓存
 *
 * 1. 静态表有 → 直接返回
 * 2. 运行时缓存未过期 → 直接返回
 * 3. 否则调 /api/netease/song-url 获取新地址
 *
 * 防重复:同一 songId 同时只发一个请求。
 *
 * @param songId 歌曲 ID
 * @param neteaseId 网易云歌曲 ID(从 userStore.neteaseIdMap 查)
 * @param cookie 网易云登录 cookie(从 userStore.platforms 查)
 */
export async function ensurePreview(
  songId: string,
  neteaseId: number,
  cookie: string,
): Promise<SongPreview | undefined> {
  // 1. 静态表优先
  const staticPreview = SONG_PREVIEW_URLS[songId];
  if (staticPreview) return staticPreview;

  // 2. 运行时缓存未过期
  const runtimeEntry = RUNTIME_PREVIEWS.get(songId);
  if (runtimeEntry) {
    const age = Date.now() - runtimeEntry.fetchedAt;
    if (age < URL_TTL_MS) {
      return runtimeEntry.preview;
    }
  }

  // 3. 防重复:正在获取中则复用
  const pending = pendingFetches.get(songId);
  if (pending) return pending;

  // 4. 发起新请求
  const fetchPromise = (async (): Promise<SongPreview> => {
    const result = await fetchSongUrl(neteaseId, cookie);
    const coverUrl = getCoverUrl(songId);
    const preview: SongPreview = {
      neteaseId,
      url: result.url,
      isTrial: result.isTrial,
      ...(coverUrl ? { coverUrl } : {}),
    };
    RUNTIME_PREVIEWS.set(songId, {
      preview,
      fetchedAt: Date.now(),
    });
    return preview;
  })();

  pendingFetches.set(songId, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    pendingFetches.delete(songId);
  }
}

/**
 * 从 userStore 获取网易云 cookie
 *
 * @returns cookie 字符串,未登录返回空字符串
 */
export function getNeteaseCookie(): string {
  const platforms = useUserStore.getState().platforms;
  const netease = platforms.find((p) => p.id === 'netease');
  return netease?.cookie ?? '';
}

/**
 * 根据 songId 查 neteaseId
 *
 * 先查 userStore.neteaseIdMap,没有返回 undefined
 */
export function getNeteaseIdBySongId(songId: string): number | undefined {
  return useUserStore.getState().neteaseIdMap[songId];
}

/**
 * 根据 songId 查封面 URL
 *
 * 从 userStore.coverUrlMap 查(扫码导入时存入)。
 * 热歌库的封面在 SONG_PREVIEW_URLS 静态表中,不在此处查。
 */
export function getCoverUrl(songId: string): string | undefined {
  return useUserStore.getState().coverUrlMap[songId];
}
