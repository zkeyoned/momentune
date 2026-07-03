/**
 * useHapticTap — 全局触感反馈 hook
 *
 * 在原生环境调 Haptics.impact,Web 环境静默 no-op。
 * 用于按钮/卡片按压时的物理反馈,与 CSS :active 视觉反馈同步。
 */

import { useCallback } from 'react';
import { hapticImpact, type HapticImpact } from '../services/nativeBridge';

/** 返回一个 onPress 回调,触发原生震动 */
export function useHapticTap(style: HapticImpact = 'light') {
  return useCallback(() => {
    void hapticImpact(style);
  }, [style]);
}

/**
 * 触发一次震动(非 hook 形式,用于事件处理器内直接调)
 * 例:onClick={() => hapticTap('medium')}
 */
export function hapticTap(style: HapticImpact = 'light') {
  void hapticImpact(style);
}
