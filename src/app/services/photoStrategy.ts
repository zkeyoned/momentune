/**
 * 拍照策略 — 统一 Web / 原生平台的照片获取接口
 *
 * 组件层不关心平台差异,只调 strategy.capturePhoto() / strategy.pickPhoto(),
 * 由策略实现决定走 getUserMedia 截帧还是 Capacitor 原生相机/相册。
 */

import { isNative, takeNativePhoto, pickNativePhoto } from './nativeBridge';
import type { RefObject } from 'react';

export interface PhotoStrategy {
  /** 拍照:返回 dataUrl/file 路径,失败或取消返回 null */
  capturePhoto: () => Promise<string | null>;
  /** 选照片(相册):原生返回路径,Web 触发 file input 并返回 null(由 onChange 接管) */
  pickPhoto: () => Promise<string | null>;
}

/**
 * 创建当前平台的拍照策略
 *
 * @param captureFrame Web 环境的截帧函数(由 useCameraManager 提供)
 * @param fileInputRef Web 环境的 <input type=file> 引用
 */
export function createPhotoStrategy(
  captureFrame: () => string | null,
  fileInputRef: RefObject<HTMLInputElement | null>,
): PhotoStrategy {
  if (isNative()) {
    return {
      capturePhoto: async () => {
        const photo = await takeNativePhoto();
        return photo?.path || null;
      },
      pickPhoto: async () => {
        const photo = await pickNativePhoto();
        return photo?.path || null;
      },
    };
  }

  return {
    capturePhoto: async () => captureFrame(),
    pickPhoto: async () => {
      fileInputRef.current?.click();
      return null; // Web 环境由 onChange 事件接管
    },
  };
}
