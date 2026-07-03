import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SAMPLE_PHOTOS } from '../services/mockApi';
import type { SamplePhoto } from '../services/mockApi';
import { useAnalysisStore } from '../stores/analysisStore';
import {
  isNative,
  takeNativePhoto,
  pickNativePhoto,
  hapticImpact,
  hapticNotify,
} from '../services/nativeBridge';
import styles from './PhotoCapture.module.css';

interface PhotoCaptureProps {
  onPick?: (photo: SamplePhoto) => void;
  variant?: 'full' | 'compact';
}

export function PhotoCapture({ onPick, variant = 'full' }: PhotoCaptureProps) {
  const navigate = useNavigate();
  const setPending = useAnalysisStore((s) => s.setPending);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const native = isNative();

  // Web 环境:启动摄像头预览。原生环境用系统相机,不需要预览。
  useEffect(() => {
    if (variant !== 'full' || native) return;

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
        setCameraReady(true);
        setCameraError(false);
      } catch {
        if (!cancelled) setCameraError(true);
      }
    };
    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [variant, native, facingMode]);

  // Web 快门:从视频帧截取一张照片(始终镜像,与预览一致)
  const captureFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // 始终水平镜像,与 CSS 预览一致
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  /** 提交照片到分析流程 */
  const submitPhoto = (
    dataUrl: string,
    source: 'camera' | 'album' | 'sample',
    title: string,
    location?: string,
    features?: SamplePhoto['features'],
  ) => {
    const sampleFeatures =
      features ?? SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)]!.features;
    setPending({
      features: sampleFeatures,
      previewUrl: dataUrl,
      source,
      title,
      location,
    });
    void hapticNotify('success');
    navigate('/result');
  };

  // —— 拍照 ——
  const handleShutter = async () => {
    void hapticImpact('medium');

    // 原生环境:调系统相机
    if (native) {
      const photo = await takeNativePhoto();
      if (photo && photo.path) {
        submitPhoto(photo.path, 'camera', `抓拍 ${new Date().toLocaleTimeString()}`);
      }
      return;
    }

    // Web 环境:从视频截帧
    const dataUrl = captureFrame();
    if (!dataUrl) return;
    submitPhoto(dataUrl, 'camera', `抓拍 ${new Date().toLocaleTimeString()}`);
  };

  // —— 切换前后置 ——
  const handleFlip = () => {
    void hapticImpact('light');
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
  };

  // —— 选照片(相册) ——
  const handleAlbum = async () => {
    void hapticImpact('light');

    // 原生环境:调系统相册
    if (native) {
      const photo = await pickNativePhoto();
      if (photo && photo.path) {
        submitPhoto(photo.path, 'album', '我的照片');
      }
      return;
    }

    // Web 环境:触发 file input
    fileRef.current?.click();
  };

  const handlePick = (photo: SamplePhoto) => {
    if (onPick) {
      onPick(photo);
      return;
    }
    submitPhoto(photo.previewUrl, 'sample', photo.title, photo.location, photo.features);
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    submitPhoto(
      url,
      'album',
      file.name.replace(/\.[^.]+$/, '').slice(0, 20) || '我的照片',
    );
  };

  if (variant === 'compact') {
    return (
      <div className={styles.wrap}>
        <div className={styles.samples}>
          <p className={styles.samplesTitle}>示例照片 · 点任一即分析</p>
          <div className={styles.grid}>
            {SAMPLE_PHOTOS.map((p) => (
              <button
                key={p.id}
                className={styles.sampleItem}
                onClick={() => handlePick(p)}
              >
                <img
                  src={p.previewUrl}
                  alt={p.title}
                  className={styles.sampleImg}
                  loading="lazy"
                />
                <span className={styles.sampleLabel}>{p.title}</span>
              </button>
            ))}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleFile}
        />
      </div>
    );
  }

  const isFront = facingMode === 'user';

  return (
    <div className={styles.wrap}>
      {/* —— 取景框 —— */}
      <div className={styles.viewfinder}>
        {native ? (
          // 原生环境:不显示预览,显示取景框引导
          <span className={styles.vfCenter} aria-hidden>
            <span className={styles.vfIcon}>📷</span>
            <span className={styles.vfHint}>点击下方按钮拍照</span>
          </span>
        ) : (
          <>
            {/* Web 环境:实时摄像头预览(CSS 始终镜像) */}
            <video
              ref={videoRef}
              className={styles.cameraVideo}
              playsInline
              muted
              autoPlay
            />

            {/* 顶部信息条(模式 + 状态) */}
            <div className={styles.vfTopBar}>
              <span className={styles.vfMode}>{isFront ? '自拍' : '后置'}</span>
              {cameraReady && (
                <span className={styles.vfStatus}>
                  <span className={styles.vfStatusDot} aria-hidden />
                  LIVE
                </span>
              )}
            </div>

            <span className={styles.corner} data-pos="tl" aria-hidden />
            <span className={styles.corner} data-pos="tr" aria-hidden />
            <span className={styles.corner} data-pos="bl" aria-hidden />
            <span className={styles.corner} data-pos="br" aria-hidden />
            {!cameraReady && !cameraError && (
              <span className={styles.vfCenter} aria-hidden>
                <span className={styles.vfIcon}>📷</span>
                <span className={styles.vfHint}>正在启动摄像头...</span>
              </span>
            )}
            {cameraError && (
              <span className={styles.vfCenter} aria-hidden>
                <span className={styles.vfIcon}>📷</span>
                <span className={styles.vfHint}>无法访问摄像头</span>
              </span>
            )}
            <canvas ref={canvasRef} className={styles.hiddenCanvas} />
          </>
        )}
      </div>

      {/* —— 控制区:相册 + 快门 + 翻转 —— */}
      <div className={styles.controls}>
        {/* 左:相册 */}
        <button
          type="button"
          className={`${styles.miniBtn} ${styles.albumBtn}`}
          onClick={handleAlbum}
          aria-label="从相册选择"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10.5" r="1.8" />
            <path d="M21 16l-5-5L5 19" />
          </svg>
        </button>

        {/* 中:快门 */}
        <button
          type="button"
          className={styles.shutter}
          onClick={handleShutter}
          disabled={!native && !cameraReady}
          aria-label="拍照"
        >
          <span className={styles.shutterInner} />
        </button>

        {/* 右:翻转前后置 */}
        <button
          type="button"
          className={`${styles.miniBtn} ${styles.flipBtn}`}
          onClick={handleFlip}
          aria-label={isFront ? '切换到后置摄像头' : '切换到前置摄像头'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
            <path d="M3 7h13l-3-3M21 17H8l3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Web 环境的 file input fallback */}
      {!native && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleFile}
        />
      )}
    </div>
  );
}
