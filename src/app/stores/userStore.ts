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
import type { OnboardingAnswers, Song, UserPreference, ImportedSongSource } from '@algorithm/index';
import type { PlatformAccount } from '../types';

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

interface UserState {
  /** 是否已完成 onboarding */
  onboarded: boolean;
  /** 用户是否已跳过/关闭 onboarding sheet(不再自动弹) */
  onboardingDismissed: boolean;
  /** onboarding 问卷答案 */
  answers: OnboardingAnswers | null;
  /** 算法偏好对象(完成 onboarding 后由 mockApi 初始化) */
  userPref: UserPreference | null;
  /** 平台账号列表 */
  platforms: PlatformAccount[];
  /** 用户导入的歌曲(三来源合并后,向后兼容) */
  importedSongs: Song[];
  /** 按来源分组的导入歌曲(画像分析用) */
  importedSongsBySource: Record<ImportedSongSource, Song[]>;
  /** songId → neteaseId 映射(用于播放时获取播放地址) */
  neteaseIdMap: Record<string, number>;
  /** songId → 封面 URL 映射(用于导入歌封面显示) */
  coverUrlMap: Record<string, string>;

  // —— actions ——
  setOnboarded: (answers: OnboardingAnswers, userPref: UserPreference) => void;
  /** 跳过/关闭 onboarding sheet,本次不再自动弹(设置页重置后会再次弹) */
  dismissOnboarding: () => void;
  loginPlatform: (id: PlatformAccount['id'], nickname?: string, cookie?: string, neteaseUid?: number) => void;
  logoutPlatform: (id: PlatformAccount['id']) => void;
  /** 设置导入的歌曲(兼容旧接口,写入 liked 来源) */
  setImportedSongs: (songs: Song[], neteaseIdMap?: Record<string, number>, coverUrlMap?: Record<string, string>) => void;
  /** 按来源设置导入的歌曲(三维度导入用) */
  setImportedSongsBySource: (
    source: ImportedSongSource,
    songs: Song[],
    neteaseIdMap?: Record<string, number>,
    coverUrlMap?: Record<string, string>,
  ) => void;
  /** 清除导入的歌曲(登出时调用) */
  clearImportedSongs: () => void;
  resetOnboarding: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      onboarded: false,
      onboardingDismissed: false,
      answers: null,
      userPref: null,
      platforms: DEFAULT_PLATFORMS,
      importedSongs: [],
      importedSongsBySource: emptyImportedBySource(),
      neteaseIdMap: {},
      coverUrlMap: {},

      setOnboarded: (answers, userPref) =>
        set({ onboarded: true, onboardingDismissed: true, answers, userPref }),

      dismissOnboarding: () => set({ onboardingDismissed: true }),

      loginPlatform: (id, nickname, cookie, neteaseUid) =>
        set((s) => ({
          platforms: s.platforms.map((p) =>
            p.id === id
              ? {
                  ...p,
                  loggedIn: true,
                  nickname: nickname ?? `${p.label}用户`,
                  ...(cookie !== undefined ? { cookie } : {}),
                  ...(neteaseUid !== undefined ? { neteaseUid } : {}),
                }
              : p,
          ),
        })),

      logoutPlatform: (id) =>
        set((s) => ({
          platforms: s.platforms.map((p) =>
            p.id === id
              ? { ...p, loggedIn: false, nickname: undefined, cookie: undefined, neteaseUid: undefined }
              : p,
          ),
          // 登出网易云时清除导入歌曲
          ...(id === 'netease' ? {
            importedSongs: [],
            importedSongsBySource: emptyImportedBySource(),
            neteaseIdMap: {},
            coverUrlMap: {},
          } : {}),
        })),

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

      setImportedSongsBySource: (source, songs, neteaseIdMap, coverUrlMap) =>
        set((s) => {
          const bySource = { ...s.importedSongsBySource, [source]: songs };
          return {
            importedSongsBySource: bySource,
            importedSongs: mergeImportedSongs(bySource),
            ...(neteaseIdMap ? { neteaseIdMap: { ...s.neteaseIdMap, ...neteaseIdMap } } : {}),
            ...(coverUrlMap ? { coverUrlMap: { ...s.coverUrlMap, ...coverUrlMap } } : {}),
          };
        }),

      clearImportedSongs: () =>
        set({
          importedSongs: [],
          importedSongsBySource: emptyImportedBySource(),
          neteaseIdMap: {},
          coverUrlMap: {},
        }),

      resetOnboarding: () =>
        set({ onboarded: false, onboardingDismissed: false, answers: null, userPref: null }),
    }),
    {
      name: 'momentune-user',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        onboardingDismissed: s.onboardingDismissed,
        answers: s.answers,
        userPref: s.userPref,
        platforms: s.platforms,
        importedSongs: s.importedSongs,
        importedSongsBySource: s.importedSongsBySource,
        neteaseIdMap: s.neteaseIdMap,
        coverUrlMap: s.coverUrlMap,
      }),
    },
  ),
);
