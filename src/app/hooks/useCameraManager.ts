/**
 * useCameraManager — Web 摄像头资源生命周期管理
 *
 * 统一封装 getUserMedia 流的启动、停止、错误处理和前后置切换,
 * 组件只需声明式地使用 { isReady, hasError, facingMode, flipCamera, captureFrame }。
 *
 * 原生环境不启动摄像头(enabled = false),由系统相机接管。
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface CameraManagerState {
  /** 摄像头是否就绪 */
  isReady: boolean;
  /** 是否发生错误(权限拒绝 / 设备被占用等) */
  hasError: boolean;
  /** 当前朝向 */
  facingMode: 'environment' | 'user';
  /** 翻转前后置 */
  flipCamera: () => void;
  /** 从当前视频帧截取一张镜像照片(dataUrl),失败返回 null */
  captureFrame: () => string | null;
}

export function useCameraManager(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): CameraManagerState {
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // 启动 / 重启摄像头
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const startCamera = async () => {
      try {
        // 先停掉旧流
        streamRef.current?.getTracks().forEach((t) => t.stop());

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsReady(true);
        setHasError(false);
      } catch (err) {
        console.error('[useCameraManager] getUserMedia 失败:', err);
        if (!cancelled) {
          setIsReady(false);
          setHasError(true);
        }
      }
    };
    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled, facingMode, videoRef]);

  // 组件卸载时确保释放
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 始终水平镜像,与 CSS 预览一致
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, [videoRef]);

  return { isReady, hasError, facingMode, flipCamera, captureFrame };
}
