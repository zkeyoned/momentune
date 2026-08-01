/**
 * 用户状态:平台账号 + 偏好 + 导入歌单
 *
 * 平台登录:网易云 QR 扫码登录,cookie 明文存 localStorage。
 * 导入歌单:登录成功后多维度拉取(红心+自建歌单+最近听过),分别存储并合并。
 *
 * 向后兼容:
 *   - importedSongs(合并后的 Song[])保留,供现有播放/推荐逻辑使用
 *   - importedSongsBySource(按来源分组)供画像分析使用
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { initUserPreference } from '@algorithm/index';
import type { OnboardingAnswers, Song, UserPreference, ImportedSongSource } from '@algorithm/index';
import type { PlatformAccount } from '../types';

/**
 * 默认 onboarding 答案(无问卷时的冷启动兜底,与 mockApi.createDefaultUserPref 保持一致)
 * 注意:问卷已移除,这里仅作为偏好中心初始化的兜底值
 */
const DEFAULT_ONBOARDING_ANSWERS: OnboardingAnswers = {
  platform: 'netease',
  referenceSongs: [],
  mood: 'neutral',
  genres: ['rap', 'rnb', 'electronic'],
  languages: ['mandarin', 'english'],
};

/** 默认用户偏好(无问卷时初始化,导入红心歌后由 setUserPref 更新) */
const DEFAULT_USER_PREF: UserPreference = initUserPreference(DEFAULT_ONBOARDING_ANSWERS, []);

const DEFAULT_PLATFORMS: PlatformAccount[] = [
  { id: 'netease', name: 'netease', label: '网易云音乐', loggedIn: false, color: '#c20c0c', available: true },
  { id: 'qq', name: 'qq', label: 'QQ 音乐', loggedIn: false, color: '#31c27c', available: true },
  { id: 'qishui', name: 'qishui', label: '汽水音乐', loggedIn: false, color: '#ff2c55', available: true },
  { id: 'other', name: 'other', label: '其他平台', loggedIn: false, color: '#8b7a5e', available: false },
];

/** 空的按来源分组导入歌曲 */
function emptyImportedBySource(): Record<ImportedSongSource, Song[]> {
  return { liked: [], playlist: [], recent: [] };
}

/** 合并三个来源的歌曲（去重 by songId） */
function mergeImportedSongs(bySource: Record<ImportedSongSource, Song[]>): Song[] {
  const seen = new Set<string>();
  const merged: Song[] = [];
  for (const source of ['liked', 'playlist', 'recent'] as const) {
    for (const song of bySource[source]) {
      if (!seen.has(song.songId)) {
        seen.add(song.songId);
        merged.push(song);
      }
    }
  }
  return merged;
}

/**
 * 返回某平台导入歌的 songId 判定函数(用于登出时按平台清理)
 * 返回 true 表示该 songId 属于该平台,应被清除
 */
function platformSongFilter(id: PlatformAccount['id']): (songId: string) => boolean {
  if (id === 'qq') return (s) => s.startsWith('user_qq_');
  if (id === 'qishui') return (s) => s.startsWith('user_qishui_');
  // netease: 新前缀歌 + 旧数据兜底(不以 user_ 开头的视为旧 netease 数据)
  return (s) => s.startsWith('user_netease_') || !s.startsWith('user_');
}

/** 按 songId 过滤映射表(清除判定函数返回 true 的条目) */
function filterMapBySongId<T>(
  map: Record<string, T>,
  shouldRemove: (songId: string) => boolean,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    if (!shouldRemove(key)) {
      result[key] = value;
    }
  }
  return result;
}

interface UserState {
  /** 算法偏好对象(无问卷时用默认偏好初始化,导入红心歌后由 setUserPref 更新) */
  userPref: UserPreference | null;
  /** 平台账号列表 */
  platforms: PlatformAccount[];
  /** 用户导入的歌曲(三来源合并后,向后兼容) */
  importedSongs: Song[];
  /** 按来源分组的导入歌曲(画像分析用) */
  importedSongsBySource: Record<ImportedSongSource, Song[]>;
  /** songId → neteaseId 映射(向后兼容,用于播放时获取播放地址) */
  neteaseIdMap: Record<string, number>;
  /** songId → 平台歌曲 ID 映射(多平台通用:QQ 是 musicid 字符串,汽水是 track_id 字符串,网易云是 neteaseId 数字字符串) */
  platformIdMap: Record<string, string>;
  /** songId → 封面 URL 映射(用于导入歌封面显示) */
  coverUrlMap: Record<string, string>;

  // —— actions ——
  /** 更新用户偏好(导入红心歌后应用多维度画像) */
  setUserPref: (userPref: UserPreference) => void;
  loginPlatform: (id: PlatformAccount['id'], nickname?: string, cookie?: string, platformUid?: string | number) => void;
  logoutPlatform: (id: PlatformAccount['id']) => void;
  /** 设置导入的歌曲(兼容旧接口,写入 liked 来源) */
  setImportedSongs: (songs: Song[], neteaseIdMap?: Record<string, number>, coverUrlMap?: Record<string, string>) => void;
  /** 按来源设置导入的歌曲(三维度导入用) */
  setImportedSongsBySource: (
    source: ImportedSongSource,
    songs: Song[],
    neteaseIdMap?: Record<string, number>,
    coverUrlMap?: Record<string, string>,
    platformPrefix?: 'user_netease_' | 'user_qq_' | 'user_qishui_',
  ) => void;
  /** 清除导入的歌曲(登出时调用) */
  clearImportedSongs: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userPref: DEFAULT_USER_PREF,
      platforms: DEFAULT_PLATFORMS,
      importedSongs: [],
      importedSongsBySource: emptyImportedBySource(),
      neteaseIdMap: {},
      platformIdMap: {},
      coverUrlMap: {},

      setUserPref: (userPref) => set({ userPref }),

      loginPlatform: (id, nickname, cookie, platformUid) =>
        set((s) => ({
          platforms: s.platforms.map((p) =>
            p.id === id
              ? {
                  ...p,
                  loggedIn: true,
                  nickname: nickname ?? `${p.label}用户`,
                  ...(cookie !== undefined ? { cookie } : {}),
                  ...(platformUid !== undefined ? { platformUid } : {}),
                  // 向后兼容:netease 场景下 platformUid 为 number 时同步写 neteaseUid
                  ...(platformUid !== undefined && typeof platformUid === 'number'
                    ? { neteaseUid: platformUid }
                    : {}),
                }
              : p,
          ),
        })),

      logoutPlatform: (id) =>
        set((s) => {
          const isPlatformSong = platformSongFilter(id);
          return {
            platforms: s.platforms.map((p) =>
              p.id === id
                ? { ...p, loggedIn: false, nickname: undefined, cookie: undefined, platformUid: undefined, neteaseUid: undefined }
                : p,
            ),
            // 按平台前缀过滤导入歌(替代旧版仅 netease 清空全部的逻辑)
            importedSongs: s.importedSongs.filter((song) => !isPlatformSong(song.songId)),
            importedSongsBySource: {
              liked: s.importedSongsBySource.liked.filter((song) => !isPlatformSong(song.songId)),
              playlist: s.importedSongsBySource.playlist.filter((song) => !isPlatformSong(song.songId)),
              recent: s.importedSongsBySource.recent.filter((song) => !isPlatformSong(song.songId)),
            },
            // 清理对应平台的映射数据
            platformIdMap: filterMapBySongId(s.platformIdMap, isPlatformSong),
            neteaseIdMap: filterMapBySongId(s.neteaseIdMap, isPlatformSong),
            coverUrlMap: filterMapBySongId(s.coverUrlMap, isPlatformSong),
          };
        }),

      setImportedSongs: (songs, neteaseIdMap, coverUrlMap) =>
        set((s) => {
          const bySource = { ...s.importedSongsBySource, liked: songs };
          return {
            importedSongs: mergeImportedSongs(bySource),
            importedSongsBySource: bySource,
            ...(neteaseIdMap ? { neteaseIdMap: { ...s.neteaseIdMap, ...neteaseIdMap } } : {}),
            ...(coverUrlMap ? { coverUrlMap: { ...s.coverUrlMap, ...coverUrlMap } } : {}),
          };
        }),

      setImportedSongsBySource: (source, songs, neteaseIdMap, coverUrlMap, platformPrefix) =>
        set((s) => {
          // 若指定平台前缀,把 songId 的 user_ 前缀替换为平台前缀(如 user_xxx → user_netease_xxx)
          const applyPrefix = (songId: string): string =>
            platformPrefix && songId.startsWith('user_')
              ? platformPrefix + songId.slice('user_'.length)
              : songId;
          const finalSongs = platformPrefix
            ? songs.map((song) => ({ ...song, songId: applyPrefix(song.songId) }))
            : songs;
          const remapKeys = <T>(m: Record<string, T> | undefined): Record<string, T> | undefined => {
            if (!m || !platformPrefix) return m;
            const out: Record<string, T> = {};
            for (const [k, v] of Object.entries(m)) out[applyPrefix(k)] = v;
            return out;
          };
          const finalNeteaseIdMap = remapKeys(neteaseIdMap);
          const finalCoverMap = remapKeys(coverUrlMap);

          const bySource = { ...s.importedSongsBySource, [source]: finalSongs };
          return {
            importedSongsBySource: bySource,
            importedSongs: mergeImportedSongs(bySource),
            ...(finalNeteaseIdMap
              ? {
                  neteaseIdMap: { ...s.neteaseIdMap, ...finalNeteaseIdMap },
                  // 同步写入多平台通用映射(neteaseId 转 string)
                  platformIdMap: {
                    ...s.platformIdMap,
                    ...Object.fromEntries(
                      Object.entries(finalNeteaseIdMap).map(([k, v]) => [k, String(v)]),
                    ),
                  },
                }
              : {}),
            ...(finalCoverMap ? { coverUrlMap: { ...s.coverUrlMap, ...finalCoverMap } } : {}),
          };
        }),

      clearImportedSongs: () =>
        set({
          importedSongs: [],
          importedSongsBySource: emptyImportedBySource(),
          neteaseIdMap: {},
          platformIdMap: {},
          coverUrlMap: {},
        }),
    }),
    {
      name: 'momentune-user',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        userPref: s.userPref,
        platforms: s.platforms,
        importedSongs: s.importedSongs,
        importedSongsBySource: s.importedSongsBySource,
        neteaseIdMap: s.neteaseIdMap,
        platformIdMap: s.platformIdMap,
        coverUrlMap: s.coverUrlMap,
      }),
    },
  ),
);
