/**
 * 用户状态:平台账号 + 偏好
 *
 * 平台登录目前是 mock(后端未实现),完成 onboarding 后会写入 userPref。
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { OnboardingAnswers, UserPreference } from '@algorithm/index';
import type { PlatformAccount } from '../types';

const DEFAULT_PLATFORMS: PlatformAccount[] = [
  { id: 'netease', name: 'netease', label: '网易云音乐', loggedIn: false, color: '#c20c0c', available: true },
  { id: 'qq', name: 'qq', label: 'QQ 音乐', loggedIn: false, color: '#31c27c', available: true },
  { id: 'qishui', name: 'qishui', label: '汽水音乐', loggedIn: false, color: '#ff2c55', available: true },
  { id: 'other', name: 'other', label: '其他平台', loggedIn: false, color: '#8b7a5e', available: false },
];

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

  // —— actions ——
  setOnboarded: (answers: OnboardingAnswers, userPref: UserPreference) => void;
  /** 跳过/关闭 onboarding sheet,本次不再自动弹(设置页重置后会再次弹) */
  dismissOnboarding: () => void;
  loginPlatform: (id: PlatformAccount['id'], nickname?: string) => void;
  logoutPlatform: (id: PlatformAccount['id']) => void;
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

      setOnboarded: (answers, userPref) =>
        set({ onboarded: true, onboardingDismissed: true, answers, userPref }),

      dismissOnboarding: () => set({ onboardingDismissed: true }),

      loginPlatform: (id, nickname) =>
        set((s) => ({
          platforms: s.platforms.map((p) =>
            p.id === id ? { ...p, loggedIn: true, nickname: nickname ?? `${p.label}用户` } : p,
          ),
        })),

      logoutPlatform: (id) =>
        set((s) => ({
          platforms: s.platforms.map((p) =>
            p.id === id ? { ...p, loggedIn: false, nickname: undefined } : p,
          ),
        })),

      resetOnboarding: () =>
        set({ onboarded: false, onboardingDismissed: false, answers: null, userPref: null }),
    }),
    {
      name: 'momentune-user',
      storage: createJSONStorage(() => localStorage),
      // 不持久化平台登录态(模拟会过期)
      partialize: (s) => ({
        onboarded: s.onboarded,
        onboardingDismissed: s.onboardingDismissed,
        answers: s.answers,
        userPref: s.userPref,
        platforms: s.platforms,
      }),
    },
  ),
);
