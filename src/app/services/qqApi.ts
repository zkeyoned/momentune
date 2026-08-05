/**
 * QQ 音乐 API 前端封装
 *
 * 封装所有 /api/qq/* fetch 调用,返回类型化结果。
 * 后端接口在 api/qq/ 目录,Vercel 自动部署为 Serverless Function。
 *
 * QQ 音乐歌曲 ID 是 songmid(字符串),与网易云 neteaseId(数字)不同。
 * fetchSongDetails 后端返回 `{ songs: [{ id, ... }] }`,前端把 `id` 映射为 `qqId`,
 * 与测试契约(qqApi.test.ts)对齐。
 */

import type { ImportedSongEntry } from '@algorithm/index';
import { apiUrl } from './apiBase';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** QQ 扫码登录二维码生成结果(后端返回 key,前端映射为 unikey) */
export interface QrCreateResult {
  unikey: string;
  /** base64 data URL 或图片 URL,可直接 <img src={qrimg}> */
  qrimg: string;
}

/** QQ 扫码状态(code: 0 成功 / 66 等待 / 67 待确认 / 65 过期) */
export interface QrCheckResult {
  code: number;
  message?: string;
  /** code=0 时有值 */
  cookie?: string;
  nickname?: string;
}

export interface LikelistResult {
  /** songmid 字符串数组 */
  ids: string[];
}

export interface UserPlaylistsResult {
  playlists: Array<{ id: string; title: string; trackCount: number }>;
}

export interface PlaylistDetailResult {
  tracks: Array<{ id: string; title: string; artist: string }>;
  total: number;
}

/** QQ 歌曲详情条目(后端 id 映射为 qqId) */
export interface SongDetailItem {
  /** songmid */
  qqId: string;
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

/** 生成扫码登录二维码(后端返回 { qrimg, key },前端 key→unikey) */
export async function createQrLogin(): Promise<QrCreateResult> {
  const raw = await postJson<{ qrimg: string; key: string }>('/api/qq/qr-create', {});
  return { qrimg: raw.qrimg, unikey: raw.key };
}

/** 轮询扫码状态(body 传 key) */
export function checkQrStatus(key: string): Promise<QrCheckResult> {
  return postJson('/api/qq/qr-check', { key });
}

/** 获取用户红心歌单(QQ 音乐 dirid=201),返回 songmid 列表(最多 100) */
export function fetchLikelist(uin: string, cookie: string): Promise<LikelistResult> {
  return postJson('/api/qq/likelist', { cookie, uin });
}

/** 获取用户自建歌单列表 */
export function fetchUserPlaylists(uin: string, cookie: string): Promise<UserPlaylistsResult> {
  return postJson('/api/qq/user-playlists', { cookie, uin });
}

/** 获取歌单详情(歌曲列表) */
export function fetchPlaylistDetail(
  cookie: string,
  playlistId: string,
  uin: string,
): Promise<PlaylistDetailResult> {
  return postJson('/api/qq/playlist-detail', { cookie, playlistId, uin });
}

/**
 * 批量获取歌曲详情
 *
 * 内部分批调用(每批 50 个 songmid)防风控,后端返回 `{ songs: [{ id, ... }] }`,
 * 前端把 `id` 映射为 `qqId`(对齐 qqApi.test.ts 契约)。
 *
 * @param ids songmid 字符串数组
 * @param cookie 登录 cookie
 * @returns { songs: SongDetailItem[] }(每项含 qqId/title/artist/coverUrl?)
 */
export async function fetchSongDetails(
  ids: string[],
  cookie: string,
): Promise<{ songs: SongDetailItem[] }> {
  const BATCH_SIZE = 50;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE));
  }

  const allSongs: SongDetailItem[] = [];
  for (const batch of batches) {
    const result = await postJson<{
      songs: Array<{ id: string; title: string; artist: string; coverUrl?: string }>;
    }>('/api/qq/song-detail-batch', { cookie, ids: batch });
    for (const s of result.songs) {
      allSongs.push({
        qqId: s.id,
        title: s.title,
        artist: s.artist,
        ...(s.coverUrl ? { coverUrl: s.coverUrl } : {}),
      });
    }
    // 分批间隔 500ms 防风控
    if (batches.length > 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return { songs: allSongs };
}

/** 获取单首歌曲播放地址(VIP 歌曲无明文 URL 时 isTrial=true) */
export function fetchSongUrl(
  cookie: string,
  songmid: string,
  uin: string,
): Promise<SongUrlResult> {
  return postJson('/api/qq/song-url', { cookie, songmid, uin });
}

// 保留 ImportedSongEntry 类型引用(供 platformImport 内部转换使用)
export type { ImportedSongEntry };
