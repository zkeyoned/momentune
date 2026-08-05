/**
 * UI 状态管理 — 全局界面交互状态
 *
 * 侧边抽屉导航开关状态。
 * 抽屉入口共三个: 屏幕左边缘右滑 / 相机页 MENU 实体键 / 各页顶栏菜单按钮,
 * 因此状态必须放全局, 不能用组件内部状态。
 */

import { create } from 'zustand';

interface UiState {
  /** 侧边抽屉是否打开 */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
}));
