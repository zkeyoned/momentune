/**
 * 网易云 API 前端封装
 *
 * 封装所有 /api/netease/* fetch 调用,返回类型化结果。
 * 后端接口在 api/netease/ 目录,Vercel 自动部署为 Serverless Function。
 */

import type { ImportedSongEntry } from '@algorithm/index';
import { apiUrl } from './apiBase';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface QrCreateResult {
  unikey: string;
  /** base64 data URL,可直接 <img src={qrimg}> */
  qrimg: string;
}

export interface QrCheckResult {
  /** 800 过期 / 801 等待 / 802 待确认 / 0 成功 */
  code: number;
  message?: string;
  /** code=0 时有值 */
  cookie?: string;
  nickname?: string;
  uid?: number;
}

export interface LikelistResult {
  ids: number[];
  total: number;
}

export interface UserPlaylistsResult {
  ids: number[];
  playlists: Array<{ id: number; name: string; trackCount: number }>;
}

export interface RecentSongsResult {
  ids: number[];
}

export interface SongDetailItem {
  neteaseId: number;
  title: string;
  artist: string;
  coverUrl?: string;
}

export interface SongUrlResult {
  url: string;
  isTrial: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// fetch 封装
// ---------------------------------------------------------------------------

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const resp = await fetch(apiUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${url} HTTP ${resp.status}: ${text.slice(0, 120)}`);
  }
  return resp.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API 调用
// ---------------------------------------------------------------------------

/** 生成扫码登录二维码 */
export function createQrLogin(): Promise<QrCreateResult> {
  return postJson('/api/netease/qr-create', {});
}

/** 轮询扫码状态(前端 2.5s 调一次) */
export function checkQrStatus(unikey: string): Promise<QrCheckResult> {
  return postJson('/api/netease/qr-check', { unikey });
}

/** 获取用户红心歌单 ID 列表 */
export function fetchLikelist(uid: number, cookie: string): Promise<LikelistResult> {
  return postJson('/api/netease/likelist', { uid, cookie });
}

/** 获取用户所有自建歌单的歌曲 ID（合并去重，已排除红心歌单） */
export function fetchUserPlaylists(uid: number, cookie: string): Promise<UserPlaylistsResult> {
  return postJson('/api/netease/user-playlists', { uid, cookie });
}

/** 获取用户最近听过的歌曲 ID */
export function fetchRecentSongs(uid: number, cookie: string): Promise<RecentSongsResult> {
  return postJson('/api/netease/recent-songs', { uid, cookie });
}

/**
 * 批量获取歌曲详情并转换为 ImportedSongEntry[]
 *
 * 内部分批调用(每批 50 个),返回合并后的条目。
 * 同时维护 neteaseId 映射,供后续播放使用。
 *
 * @param ids 网易云歌曲 ID 数组
 * @param cookie 登录 cookie
 * @returns { entries: ImportedSongEntry[], neteaseIdMap: Map<songKey, neteaseId> }
 */
export async function fetchSongDetails(
  ids: number[],
  cookie: string,
): Promise<{
  entries: ImportedSongEntry[];
  neteaseIdMap: Map<string, number>;
  coverUrlMap: Map<string, string>;
}> {
  const BATCH_SIZE = 50;
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE));
  }

  const allItems: SongDetailItem[] = [];
  for (const batch of batches) {
    const result = await postJson<{ songs: SongDetailItem[] }>(
      '/api/netease/song-detail-batch',
      { ids: batch.join(','), cookie },
    );
    allItems.push(...result.songs);
    // 分批间隔 500ms 防风控
    if (batches.length > 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const entries: ImportedSongEntry[] = [];
  const neteaseIdMap = new Map<string, number>();
  const coverUrlMap = new Map<string, string>();

  for (const item of allItems) {
    entries.push({
      title: item.title,
      artist: item.artist,
    });
    const key = `${item.title}|${item.artist}`;
    neteaseIdMap.set(key, item.neteaseId);
    if (item.coverUrl) {
      coverUrlMap.set(key, item.coverUrl);
    }
  }

  return { entries, neteaseIdMap, coverUrlMap };
}

/** 获取单首歌曲的播放地址(播放时按需调用) */
export function fetchSongUrl(id: number, cookie: string): Promise<SongUrlResult> {
  return postJson('/api/netease/song-url', { id, cookie });
}
