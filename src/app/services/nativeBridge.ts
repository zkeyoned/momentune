/**
 * 原生能力桥接层
 *
 * 统一封装 Capacitor 原生插件,Web 环境下自动降级。
 * 组件层只调本模块,不直接依赖 Capacitor,保持 Web/PWA 版本可独立运行。
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/** 是否运行在 Capacitor 原生壳里 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

// ————————————————
// Haptics 震动反馈
// ————————————————

export type HapticImpact = 'light' | 'medium' | 'heavy';
export type HapticNotification = 'success' | 'warning' | 'error';

const impactMap: Record<HapticImpact, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

const notifMap: Record<HapticNotification, NotificationType> = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
};

/** 轻触震动 — 按钮/卡片按压反馈 */
export async function hapticImpact(style: HapticImpact = 'light'): Promise<void> {
  if (!isNative()) return; // Web 降级:无震动
  try {
    await Haptics.impact({ style: impactMap[style] });
  } catch {
    // 静默失败:不阻塞 UI
  }
}

/** 通知震动 — 操作成功/失败反馈 */
export async function hapticNotify(type: HapticNotification): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: notifMap[type] });
  } catch {
    // 静默失败
  }
}

/** 选择震动 — 滚动/切换选中 */
export async function hapticSelection(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.selectionStart();
  } catch {
    // 静默失败
  }
}

// ————————————————
// Camera 原生相机
// ————————————————

export interface NativePhotoResult {
  /** dataUrl(base64) 或 file:// 路径 */
  path: string;
  /** 是否为 base64 dataUrl */
  isDataUrl: boolean;
}

/**
 * 调用原生相机拍照
 * - 原生环境:Capacitor Camera 插件,系统相机 UI
 * - Web 降级:返回 null,由调用方 fallback 到 getUserMedia
 */
export async function takeNativePhoto(): Promise<NativePhotoResult | null> {
  if (!isNative()) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false,
      correctOrientation: true,
    });
    return {
      path: photo.dataUrl ?? '',
      isDataUrl: true,
    };
  } catch {
    return null; // 用户取消或权限拒绝
  }
}

/**
 * 从原生相册选照片
 * - 原生环境:Capacitor Camera 插件,系统相册 UI
 * - Web 降级:返回 null,由调用方 fallback 到 <input type=file>
 */
export async function pickNativePhoto(): Promise<NativePhotoResult | null> {
  if (!isNative()) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      correctOrientation: true,
    });
    return {
      path: photo.dataUrl ?? '',
      isDataUrl: true,
    };
  } catch {
    return null;
  }
}
