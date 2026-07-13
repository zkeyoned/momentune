/**
 * 主题状态管理 — 银盐(日间) / 暗房(夜间) 双主题
 *
 * 三模式:
 *   auto  → 按本地时间 7:00-19:00 银盐,其余暗房(产品叙事:界面跟着一天的时刻变化)
 *   light → 固定银盐
 *   dark  → 固定暗房
 *
 * 持久化到 localStorage,通过 html[data-theme] 属性切换。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  /** 用户选择的模式 */
  mode: ThemeMode;
  /** 实际生效的主题(由 mode + 时间计算) */
  resolved: ResolvedTheme;
  /** 设置模式,自动计算 resolved 并同步到 DOM */
  setMode: (mode: ThemeMode) => void;
  /** auto 模式下按时间重新计算 resolved(定时器调用) */
  refresh: () => void;
}

/** 7:00-19:00 → 日间,其余 → 夜间 */
function isDaytime(): boolean {
  const h = new Date().getHours();
  return h >= 7 && h < 19;
}

/** 由 mode 计算 resolved */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return isDaytime() ? 'light' : 'dark';
}

/** 同步 html[data-theme] 属性 */
function applyToDOM(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'auto',
      resolved: resolveTheme('auto'),

      setMode: (mode) => {
        const resolved = resolveTheme(mode);
        applyToDOM(resolved);
        set({ mode, resolved });
      },

      refresh: () => {
        const { mode } = get();
        if (mode !== 'auto') return; // 固定模式不需要刷新
        const resolved = resolveTheme('auto');
        const current = get().resolved;
        if (resolved !== current) {
          applyToDOM(resolved);
          set({ resolved });
        }
      },
    }),
    {
      name: 'momentune-theme',
      // 只持久化 mode,resolved 每次启动重新计算
      partialize: (s) => ({ mode: s.mode }),
      // 启动时同步 DOM
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.resolved = resolveTheme(state.mode);
          applyToDOM(state.resolved);
        }
      },
    },
  ),
);
