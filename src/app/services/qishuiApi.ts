/**
 * 汽水音乐 API 前端封装
 *
 * 封装所有 /api/qishui/* fetch 调用,返回类型化结果。
 * 后端接口在 api/qishui/ 目录,Vercel 自动部署为 Serverless Function。
 *
 * 汽水音乐歌曲 ID 是 track_id(字符串),后端 playlist-detail 自动翻页
 * 直接返回带 title/artist/coverUrl 的完整曲目列表,无需单独 song-detail。
 *
 * 扫码登录:后端返回 token,前端映射为 unikey(对齐 neteaseApi 风格)。
 */

import { apiUrl } from './apiBase';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 汽水扫码登录二维码生成结果(后端返回 token,前端映射为 unikey) */
export interface QrCreateResult {
  unikey: string;
  /** 图片 URL 或 data URL,可直接 <img src={qrimg}> */
  qrimg: string;
}

/** 汽水扫码状态(code: 0 等待 / 1 已扫码 / 2 成功 / 3 过期) */
export interface QrCheckResult {
  code: number;
  status?: string;
  message?: string;
  /** code=2 时有值 */
  cookie?: string;
  /** code=1 时有值(已扫码,展示头像) */
  avatarUrl?: string;
  /** code=3 时有值(已下发新 token,前端用新 token 重新轮询) */
  newToken?: string;
}

export interface PlaylistListItem {
  id: string;
  title: string;
  trackCount: number;
  coverUrl?: string;
}

export interface PlaylistsResult {
  playlists: PlaylistListItem[];
}

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

export interface PlaylistDetailResult {
  tracks: PlaylistTrack[];
}

export interface SongUrlResult {
  url: string;
  isTrial: boolean;
  quality?: string;
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

/** 生成扫码登录二维码(后端返回 { qrimg, token },前端 token→unikey) */
export async function createQrLogin(): Promise<QrCreateResult> {
  const raw = await postJson<{ qrimg: string; token: string }>('/api/qishui/qr-create', {});
  return { qrimg: raw.qrimg, unikey: raw.token };
}

/** 轮询扫码状态(body 传 token) */
export function checkQrStatus(token: string): Promise<QrCheckResult> {
  return postJson('/api/qishui/qr-check', { token });
}

/** 获取用户所有歌单列表 */
export function fetchPlaylists(cookie: string): Promise<PlaylistsResult> {
  return postJson('/api/qishui/playlist-list', { cookie });
}

/** 获取歌单详情(歌曲列表,后端自动翻页累积) */
export function fetchPlaylistDetail(
  cookie: string,
  playlistId: string,
): Promise<PlaylistDetailResult> {
  return postJson('/api/qishui/playlist-detail', { cookie, playlistId });
}

/** 获取单首歌曲播放地址(后端两步取 MainPlayUrl) */
export function fetchSongUrl(cookie: string, trackId: string): Promise<SongUrlResult> {
  return postJson('/api/qishui/song-url', { cookie, trackId });
}
