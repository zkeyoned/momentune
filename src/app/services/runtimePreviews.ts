/**
 * 运行时播放地址管理
 *
 * 用户导入的歌曲(网易云红心歌单)不在构建期生成的 SONG_PREVIEW_URLS 中,
 * 需要在播放时按需从网易云 API 获取播放地址,缓存在内存 Map 中。
 *
 * URL 有时效(几小时),超过 2 小时自动重取。
 */

import { SONG_PREVIEW_URLS, type SongPreview } from './songPreviewUrls';
import { apiUrl } from './apiBase';
import { fetchSongUrl as fetchNeteaseSongUrl } from './neteaseApi';
import * as qqApi from './qqApi';
import * as qishuiApi from './qishuiApi';
import { useUserStore } from '../stores/userStore';

/** 各平台 songId 前缀(与 userStore.setImportedSongsBySource 的 platformPrefix 对齐) */
const PREFIX_NETEASE = 'user_netease_';
const PREFIX_QQ = 'user_qq_';
const PREFIX_QISHUI = 'user_qishui_';

/**
 * 选取某首歌曲播放时应走的音频代理路径(各平台 CDN 域名不同,Referer/UA 也不同)
 *
 * dev:走本地 vite middleware 代理(绕 CORS/ORB)
 * build:直连原始 URL(生产环境由 Vercel 上同路径的 Serverless Function 兜底)
 */
export function getAudioProxyPath(songId: string, rawUrl: string): string {
  if (songId.startsWith(PREFIX_QQ)) return apiUrl(`/api/qq/audio-proxy?url=${encodeURIComponent(rawUrl)}`);
  if (songId.startsWith(PREFIX_QISHUI)) return apiUrl(`/api/qishui/audio-proxy?url=${encodeURIComponent(rawUrl)}`);
  // 网易云导入歌 + 热歌库:走网易云代理
  return apiUrl(`/api/audio-proxy?url=${encodeURIComponent(rawUrl)}`);
}

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
    const result = await fetchNeteaseSongUrl(neteaseId, cookie);
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

// ---------------------------------------------------------------------------
// 多平台凭证获取(QQ/汽水)
// ---------------------------------------------------------------------------

/** 从 userStore.platforms 取指定平台的登录 cookie,未登录返回空串 */
function getPlatformCookie(platformId: 'qq' | 'qishui' | 'netease'): string {
  const platforms = useUserStore.getState().platforms;
  return platforms.find((p) => p.id === platformId)?.cookie ?? '';
}

/**
 * 从 QQ 登录 cookie 中解析 uin(QQ 音乐 musicu.fcg 的 song-url 接口强制要求)
 *
 * QQ 互联登录后 cookie 含 `uin=o0012345678` 格式(QQ 号补零到 10 位 + o 前缀),
 * QQ 音乐 API 直接吃这个原始值,无需二次转换。
 *
 * 匹配时排除 `p_uin`/`wxuin` 等同后缀字段(用行首或分号边界)。
 */
function parseQQUinFromCookie(cookie: string): string | undefined {
  const match = cookie.match(/(?:^|;\s*)uin=([^;]+)/);
  const raw = match?.[1]?.trim();
  if (!raw) return undefined;
  // 兼容 o0012345678 与纯数字两种形态,统一返回带 o 前缀的补零形式
  const digits = raw.replace(/^o0*/, '');
  if (!/^\d+$/.test(digits)) return undefined;
  return 'o' + digits.padStart(10, '0');
}

/** 从 userStore.platformIdMap 取 QQ/汽水的平台歌曲 ID(字符串) */
function getPlatformTrackId(songId: string): string | undefined {
  return useUserStore.getState().platformIdMap[songId];
}

// ---------------------------------------------------------------------------
// 统一入口:按 songId 前缀分发到对应平台
// ---------------------------------------------------------------------------

/**
 * 按需获取播放地址并缓存(多平台统一入口)
 *
 * 分发规则(按 songId 前缀):
 *   user_netease_ → 网易云 fetchSongUrl(id, cookie)
 *   user_qq_      → QQ fetchSongUrl(cookie, songmid, uin)
 *   user_qishui_  → 汽水 fetchSongUrl(cookie, trackId)
 *   其他(热歌库等)→ 走网易云映射兜底
 *
 * 任一平台未登录/缺凭证/获取失败 → 返回 undefined(调用方降级模拟播放)
 */
export async function ensurePreviewFor(songId: string): Promise<SongPreview | undefined> {
  // 1. 静态表优先(热歌库)
  const staticPreview = SONG_PREVIEW_URLS[songId];
  if (staticPreview) return staticPreview;

  // 2. 运行时缓存未过期
  const cached = getPreview(songId);
  if (cached) return cached;

  // 3. 防重复:正在获取中则复用
  const pending = pendingFetches.get(songId);
  if (pending) return pending;

  // 4. 按平台前缀选 fetcher
  const fetcher = pickFetcher(songId);
  if (!fetcher) return undefined;

  // 5. 发起新请求并缓存
  const fetchPromise = (async (): Promise<SongPreview> => {
    const result = await fetcher();
    const coverUrl = getCoverUrl(songId);
    const preview: SongPreview = {
      neteaseId: 0,
      url: result.url,
      isTrial: result.isTrial,
      ...(coverUrl ? { coverUrl } : {}),
    };
    RUNTIME_PREVIEWS.set(songId, { preview, fetchedAt: Date.now() });
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
 * 按 songId 前缀挑选播放地址获取函数
 *
 * 返回 null 表示该平台未登录或缺凭证(无法获取,调用方应降级模拟播放)
 */
function pickFetcher(
  songId: string,
): (() => Promise<{ url: string; isTrial: boolean }>) | null {
  if (songId.startsWith(PREFIX_NETEASE)) {
    const neteaseId = getNeteaseIdBySongId(songId);
    const cookie = getPlatformCookie('netease');
    if (!neteaseId || !cookie) {
      console.warn('[ensurePreviewFor] netease 缺凭证', { songId, hasNeteaseId: !!neteaseId, hasCookie: !!cookie });
      return null;
    }
    return () => fetchNeteaseSongUrl(neteaseId, cookie);
  }
  if (songId.startsWith(PREFIX_QQ)) {
    const songmid = getPlatformTrackId(songId);
    const cookie = getPlatformCookie('qq');
    const uin = parseQQUinFromCookie(cookie);
    if (!songmid || !cookie || !uin) {
      console.warn('[ensurePreviewFor] qq 缺凭证', { songId, hasSongmid: !!songmid, hasCookie: !!cookie, hasUin: !!uin });
      return null;
    }
    return () => qqApi.fetchSongUrl(cookie, songmid, uin);
  }
  if (songId.startsWith(PREFIX_QISHUI)) {
    const trackId = getPlatformTrackId(songId);
    const cookie = getPlatformCookie('qishui');
    if (!trackId || !cookie) {
      console.warn('[ensurePreviewFor] qishui 缺凭证', { songId, hasTrackId: !!trackId, hasCookie: !!cookie, platformIdMapKeys: Object.keys(useUserStore.getState().platformIdMap).length });
      return null;
    }
    return () => qishuiApi.fetchSongUrl(cookie, trackId);
  }
  // 非 user_ 前缀(热歌库等):静态表已覆盖,到这里说明无映射,无法获取
  console.warn('[ensurePreviewFor] 未知前缀,无法匹配平台', { songId });
  return null;
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
