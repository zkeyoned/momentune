/**
 * 多平台歌单导入流程
 *
 * 统一抽象网易云 / QQ / 汽水三个平台的红心歌单 + 自建歌单 + 最近听过导入。
 * 各来源互相独立,单个失败不阻塞其他来源(每个 fetch 都用 try-catch 包裹)。
 *
 * 设计要点:
 *   - 网易云沿用 PlatformQRModal.startImportFlow 的三阶段逻辑
 *   - QQ 红心走 fetchLikelist + fetchSongDetails;自建歌单走 fetchPlaylistDetail 累积
 *   - 汽水通过歌单名称识别"我喜欢的音乐"作为红心,识别不出则降级用第一个歌单
 *   - QQ/汽水的字符串 ID 通过 platformIdMap 写入(网易云仍用 neteaseIdMap)
 *   - 最近听过 QQ/汽水暂为 placeholder,代码注释标 TODO
 *
 * 映射构建策略:统一用 songKey("title|artist") 作为中间键匹配,
 * 不依赖 API 返回顺序,避免分批/去重导致的下标错位。
 */

import * as neteaseApi from './neteaseApi';
import * as qqApi from './qqApi';
import * as qishuiApi from './qishuiApi';
import { importUserPlaylist, applyMultiSourcePreference, initUserPreference } from '@algorithm/index';
import type { ImportedSongEntry, Song, OnboardingAnswers } from '@algorithm/index';
import { useUserStore } from '../stores/userStore';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type PlatformId = 'netease' | 'qq' | 'qishui';

export interface ImportProgress {
  source: 'liked' | 'playlist' | 'recent';
  count: number;
}

export interface ImportResult {
  total: number;
  bySource: ImportProgress[];
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 各来源最大导入数量(与 PlatformQRModal 保持一致) */
const MAX_LIKED = 100;
const MAX_PLAYLIST = 200;
const MAX_RECENT = 100;

/** 默认 onboarding 答案(applyMultiSourcePreference 兜底用,与 PlatformQRModal 一致) */
const DEFAULT_ONBOARDING_ANSWERS: OnboardingAnswers = {
  platform: 'netease',
  referenceSongs: [],
  mood: 'neutral',
  genres: [],
  languages: [],
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 把 user_xxx 形式的 songId 加上平台前缀
 * 与 userStore.setImportedSongsBySource 内部 applyPrefix 逻辑保持一致
 */
function applyPlatformPrefix(
  songId: string,
  prefix: 'user_netease_' | 'user_qq_' | 'user_qishui_',
): string {
  return songId.startsWith('user_') ? prefix + songId.slice('user_'.length) : songId;
}

/**
 * 构建 songId → 平台 ID 映射 + songId → coverUrl 映射
 * 与 PlatformQRModal.buildSongIdMaps 等价,泛化支持 number/string 两种 ID 类型
 *
 * @param songs importUserPlaylist 转换后的 Song[](songId 为原始 user_xxx 形式)
 * @param entries 与 songs 一一对应的导入条目
 * @param idByKey songKey("title|artist") → 平台 ID 映射
 * @param coverByKey songKey → 封面 URL 映射
 */
function buildSongMaps<T>(
  songs: Song[],
  entries: ImportedSongEntry[],
  idByKey: Map<string, T>,
  coverByKey: Map<string, string>,
): { idMap: Record<string, T>; coverMap: Record<string, string> } {
  const idMap: Record<string, T> = {};
  const coverMap: Record<string, string> = {};
  songs.forEach((song, idx) => {
    const entry = entries[idx];
    if (!entry) return;
    const key = `${entry.title}|${entry.artist}`;
    const id = idByKey.get(key);
    if (id !== undefined) {
      idMap[song.songId] = id;
    }
    const cover = coverByKey.get(key);
    if (cover) {
      coverMap[song.songId] = cover;
    }
  });
  return { idMap, coverMap };
}

/**
 * 单独写入 platformIdMap(对 QQ/汽水的字符串 ID,store 的 setImportedSongsBySource 不直接支持)
 * 必须在 setImportedSongsBySource 调用后使用,此时 store 内 songId 已加前缀
 *
 * @param idMap key 是原始 songId(未加前缀),value 是平台歌曲 ID
 * @param prefix 平台前缀
 */
function writePlatformIdMap(
  idMap: Record<string, string>,
  prefix: 'user_qq_' | 'user_qishui_',
): void {
  const cur = useUserStore.getState().platformIdMap;
  const next: Record<string, string> = { ...cur };
  for (const [songId, pid] of Object.entries(idMap)) {
    next[applyPlatformPrefix(songId, prefix)] = pid;
  }
  useUserStore.setState({ platformIdMap: next });
}

/** 应用多维度画像到 userPref(与 PlatformQRModal 一致) */
function applyMultiSourcePrefIfAvailable(summary: ImportProgress[]): void {
  if (summary.length === 0) return;
  const state = useUserStore.getState();
  // userPref 初始即默认偏好(非 null),兜底防老数据 null
  const basePref = state.userPref ?? initUserPreference(DEFAULT_ONBOARDING_ANSWERS, []);
  const updatedPref = applyMultiSourcePreference(basePref, state.importedSongsBySource);
  state.setUserPref(updatedPref);
}

/** 格式化进度回调节尾消息 */
function formatProgress(total: number, summary: ImportProgress[]): string {
  return `已导入 ${total} 首歌曲(${summary.map((s) => `${s.source}: ${s.count}`).join(' · ')})`;
}

/** 按 songKey("title|artist") 去重条目,保持首次出现顺序 */
function dedupeEntriesByKey(entries: ImportedSongEntry[]): ImportedSongEntry[] {
  const seen = new Set<string>();
  const out: ImportedSongEntry[] = [];
  for (const e of entries) {
    const key = `${e.title}|${e.artist}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 多平台歌单导入流程
 *
 * @param platform 平台 ID
 * @param cookie 登录 cookie
 * @param uin QQ 用 uin(字符串 musicid),网易云用数字 uid 转字符串,汽水传空字符串 ""
 * @param onProgress 进度回调
 */
export async function importFlow(
  platform: PlatformId,
  cookie: string,
  uin: string,
  onProgress?: (msg: string) => void,
): Promise<ImportResult> {
  switch (platform) {
    case 'netease':
      return importNetease(cookie, uin, onProgress);
    case 'qq':
      return importQQ(cookie, uin, onProgress);
    case 'qishui':
      return importQishui(cookie, onProgress);
  }
}

// ---------------------------------------------------------------------------
// 网易云
// ---------------------------------------------------------------------------

async function importNetease(
  cookie: string,
  uin: string,
  onProgress?: (msg: string) => void,
): Promise<ImportResult> {
  const uid = Number(uin);
  const summary: ImportProgress[] = [];
  const setImportedSongsBySource = useUserStore.getState().setImportedSongsBySource;

  // —— 阶段 1: 红心歌单 ——
  onProgress?.('正在获取红心歌单...');
  try {
    const likelistResult = await neteaseApi.fetchLikelist(uid, cookie);
    const ids = likelistResult.ids.slice(0, MAX_LIKED);
    if (ids.length > 0) {
      const { entries, neteaseIdMap, coverUrlMap } = await neteaseApi.fetchSongDetails(ids, cookie);
      const songs: Song[] = importUserPlaylist(entries);
      const { idMap, coverMap } = buildSongMaps(songs, entries, neteaseIdMap, coverUrlMap);
      setImportedSongsBySource('liked', songs, idMap, coverMap, 'user_netease_');
      summary.push({ source: 'liked', count: songs.length });
    }
  } catch {
    // 红心失败不阻塞
  }

  // —— 阶段 2: 自建歌单 ——
  onProgress?.('正在获取自建歌单...');
  try {
    const playlistsResult = await neteaseApi.fetchUserPlaylists(uid, cookie);
    const ids = playlistsResult.ids.slice(0, MAX_PLAYLIST);
    if (ids.length > 0) {
      const { entries, neteaseIdMap, coverUrlMap } = await neteaseApi.fetchSongDetails(ids, cookie);
      const songs: Song[] = importUserPlaylist(entries);
      const { idMap, coverMap } = buildSongMaps(songs, entries, neteaseIdMap, coverUrlMap);
      setImportedSongsBySource('playlist', songs, idMap, coverMap, 'user_netease_');
      summary.push({ source: 'playlist', count: songs.length });
    }
  } catch {
    // 歌单失败不阻塞
  }

  // —— 阶段 3: 最近听过 ——
  onProgress?.('正在获取最近听过...');
  try {
    const recentResult = await neteaseApi.fetchRecentSongs(uid, cookie);
    const ids = recentResult.ids.slice(0, MAX_RECENT);
    if (ids.length > 0) {
      const { entries, neteaseIdMap, coverUrlMap } = await neteaseApi.fetchSongDetails(ids, cookie);
      const songs: Song[] = importUserPlaylist(entries);
      const { idMap, coverMap } = buildSongMaps(songs, entries, neteaseIdMap, coverUrlMap);
      setImportedSongsBySource('recent', songs, idMap, coverMap, 'user_netease_');
      summary.push({ source: 'recent', count: songs.length });
    }
  } catch {
    // 最近听过失败不阻塞
  }

  // —— 应用多维度画像到 userPref ——
  applyMultiSourcePrefIfAvailable(summary);

  const total = summary.reduce((sum, s) => sum + s.count, 0);
  onProgress?.(formatProgress(total, summary));
  return { total, bySource: summary };
}

// ---------------------------------------------------------------------------
// QQ 音乐
// ---------------------------------------------------------------------------

async function importQQ(
  cookie: string,
  uin: string,
  onProgress?: (msg: string) => void,
): Promise<ImportResult> {
  const summary: ImportProgress[] = [];
  const setImportedSongsBySource = useUserStore.getState().setImportedSongsBySource;

  // —— 阶段 1: 红心歌单(dirid=201) ——
  onProgress?.('正在获取红心歌单...');
  try {
    const likelistResult = await qqApi.fetchLikelist(uin, cookie);
    const ids = likelistResult.ids.slice(0, MAX_LIKED);
    if (ids.length > 0) {
      const { songs: qqSongs } = await qqApi.fetchSongDetails(ids, cookie);
      const entries: ImportedSongEntry[] = qqSongs.map((s) => ({ title: s.title, artist: s.artist }));
      // 用 songKey 匹配构建 qqId/cover 映射(不依赖返回顺序)
      const qqIdByKey = new Map<string, string>();
      const coverByKey = new Map<string, string>();
      for (const s of qqSongs) {
        const key = `${s.title}|${s.artist}`;
        qqIdByKey.set(key, s.qqId);
        if (s.coverUrl) coverByKey.set(key, s.coverUrl);
      }
      const songs: Song[] = importUserPlaylist(entries);
      const { idMap, coverMap } = buildSongMaps(songs, entries, qqIdByKey, coverByKey);
      setImportedSongsBySource('liked', songs, undefined, coverMap, 'user_qq_');
      writePlatformIdMap(idMap, 'user_qq_');
      summary.push({ source: 'liked', count: songs.length });
    }
  } catch {
    // 红心失败不阻塞
  }

  // —— 阶段 2: 自建歌单(对每个歌单调 fetchPlaylistDetail 累积曲目) ——
  onProgress?.('正在获取自建歌单...');
  try {
    const playlistsResult = await qqApi.fetchUserPlaylists(uin, cookie);
    const playlists = playlistsResult.playlists.slice(0, MAX_PLAYLIST);
    if (playlists.length > 0) {
      const allEntries: ImportedSongEntry[] = [];
      const qqIdByKey = new Map<string, string>();
      // QQ playlist-detail 不返回封面,coverByKey 为空
      const coverByKey = new Map<string, string>();
      for (const p of playlists) {
        try {
          const detail = await qqApi.fetchPlaylistDetail(cookie, p.id, uin);
          for (const t of detail.tracks) {
            const key = `${t.title}|${t.artist}`;
            allEntries.push({ title: t.title, artist: t.artist });
            // 同名去重时保留首次
            if (!qqIdByKey.has(key)) {
              qqIdByKey.set(key, t.id);
            }
          }
        } catch {
          // 单个歌单失败不阻塞其他
        }
      }
      const dedupedEntries = dedupeEntriesByKey(allEntries);
      if (dedupedEntries.length > 0) {
        const songs: Song[] = importUserPlaylist(dedupedEntries);
        const { idMap, coverMap } = buildSongMaps(songs, dedupedEntries, qqIdByKey, coverByKey);
        setImportedSongsBySource('playlist', songs, undefined, coverMap, 'user_qq_');
        writePlatformIdMap(idMap, 'user_qq_');
        summary.push({ source: 'playlist', count: songs.length });
      }
    }
  } catch {
    // 歌单失败不阻塞
  }

  // —— 阶段 3: 最近听过 ——
  onProgress?.('正在获取最近听过...');
  // TODO: QQ 音乐最近听过歌曲列表端点未实现,后续接入

  // —— 应用多维度画像 ——
  applyMultiSourcePrefIfAvailable(summary);

  const total = summary.reduce((sum, s) => sum + s.count, 0);
  onProgress?.(formatProgress(total, summary));
  return { total, bySource: summary };
}

// ---------------------------------------------------------------------------
// 汽水音乐
// ---------------------------------------------------------------------------

/** 识别"我喜欢的音乐"歌单:名称包含"喜欢"或"红心" */
function isQishuiLikedPlaylist(title: string): boolean {
  return title.includes('喜欢') || title.includes('红心');
}

async function importQishui(
  cookie: string,
  onProgress?: (msg: string) => void,
): Promise<ImportResult> {
  const summary: ImportProgress[] = [];
  const setImportedSongsBySource = useUserStore.getState().setImportedSongsBySource;

  // 拉所有歌单列表(后续阶段共用)
  let playlists: qishuiApi.PlaylistListItem[] = [];
  try {
    onProgress?.('正在获取红心歌单...');
    const result = await qishuiApi.fetchPlaylists(cookie);
    playlists = result.playlists;
  } catch {
    // 拉不到歌单列表,直接返回空结果
    applyMultiSourcePrefIfAvailable(summary);
    onProgress?.(formatProgress(0, summary));
    return { total: 0, bySource: summary };
  }

  // 识别红心歌单(我喜欢的音乐)
  let likedPlaylist = playlists.find((p) => isQishuiLikedPlaylist(p.title));
  // 降级:识别不出红心歌单时把第一个歌单当红心(任务约束)
  if (!likedPlaylist && playlists.length > 0) {
    likedPlaylist = playlists[0];
  }

  // —— 阶段 1: 红心歌单 ——
  if (likedPlaylist) {
    try {
      const detail = await qishuiApi.fetchPlaylistDetail(cookie, likedPlaylist.id);
      const tracks = detail.tracks.slice(0, MAX_LIKED);
      if (tracks.length > 0) {
        const entries: ImportedSongEntry[] = tracks.map((t) => ({
          title: t.title,
          artist: t.artist,
        }));
        const trackIdByKey = new Map<string, string>();
        const coverByKey = new Map<string, string>();
        for (const t of tracks) {
          const key = `${t.title}|${t.artist}`;
          trackIdByKey.set(key, t.id);
          if (t.coverUrl) coverByKey.set(key, t.coverUrl);
        }
        const songs: Song[] = importUserPlaylist(entries);
        const { idMap, coverMap } = buildSongMaps(songs, entries, trackIdByKey, coverByKey);
        setImportedSongsBySource('liked', songs, undefined, coverMap, 'user_qishui_');
        writePlatformIdMap(idMap, 'user_qishui_');
        summary.push({ source: 'liked', count: songs.length });
      }
    } catch {
      // 红心歌单失败不阻塞
    }
  }

  // —— 阶段 2: 其他歌单(收藏 + 自建,统一作为 playlist 来源) ——
  onProgress?.('正在获取自建歌单...');
  try {
    const otherPlaylists = playlists
      .filter((p) => p.id !== likedPlaylist?.id)
      .slice(0, MAX_PLAYLIST);
    const allEntries: ImportedSongEntry[] = [];
    const trackIdByKey = new Map<string, string>();
    const coverByKey = new Map<string, string>();
    for (const p of otherPlaylists) {
      try {
        const detail = await qishuiApi.fetchPlaylistDetail(cookie, p.id);
        for (const t of detail.tracks) {
          const key = `${t.title}|${t.artist}`;
          allEntries.push({ title: t.title, artist: t.artist });
          if (!trackIdByKey.has(key)) {
            trackIdByKey.set(key, t.id);
          }
          if (t.coverUrl && !coverByKey.has(key)) {
            coverByKey.set(key, t.coverUrl);
          }
        }
      } catch {
        // 单个歌单失败不阻塞其他
      }
    }
    const dedupedEntries = dedupeEntriesByKey(allEntries);
    if (dedupedEntries.length > 0) {
      const songs: Song[] = importUserPlaylist(dedupedEntries);
      const { idMap, coverMap } = buildSongMaps(songs, dedupedEntries, trackIdByKey, coverByKey);
      setImportedSongsBySource('playlist', songs, undefined, coverMap, 'user_qishui_');
      writePlatformIdMap(idMap, 'user_qishui_');
      summary.push({ source: 'playlist', count: songs.length });
    }
  } catch {
    // 歌单失败不阻塞
  }

  // —— 阶段 3: 最近听过 ——
  onProgress?.('正在获取最近听过...');
  // TODO: 汽水音乐最近听过歌曲列表端点未实现,后续接入

  // —— 应用多维度画像 ——
  applyMultiSourcePrefIfAvailable(summary);

  const total = summary.reduce((sum, s) => sum + s.count, 0);
  onProgress?.(formatProgress(total, summary));
  return { total, bySource: summary };
}
