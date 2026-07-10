import { useMemo, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SAMPLE_PHOTOS } from '../services/mockApi';
import type { SamplePhoto } from '../services/mockApi';
import { useAnalysisStore } from '../stores/analysisStore';
import { isNative, hapticImpact, hapticNotify } from '../services/nativeBridge';
import { createPhotoStrategy } from '../services/photoStrategy';
import { useCameraManager } from '../hooks/useCameraManager';
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
  const native = isNative();

  // 摄像头资源管理(Web 环境)
  const camera = useCameraManager(videoRef, variant === 'full' && !native);

  // 平台拍照策略
  const photoStrategy = useMemo(
    () => createPhotoStrategy(camera.captureFrame, fileRef),
    [camera.captureFrame],
  );

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
    const photoData = await photoStrategy.capturePhoto();
    if (photoData) {
      submitPhoto(photoData, 'camera', `抓拍 ${new Date().toLocaleTimeString()}`);
    }
  };

  // —— 切换前后置 ——
  const handleFlip = () => {
    void hapticImpact('light');
    camera.flipCamera();
  };

  // —— 选照片(相册) ——
  const handleAlbum = async () => {
    void hapticImpact('light');
    const photoData = await photoStrategy.pickPhoto();
    if (photoData) {
      submitPhoto(photoData, 'album', '我的照片');
    }
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

  const isFront = camera.facingMode === 'user';

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
              {camera.isReady && (
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
            {!camera.isReady && !camera.hasError && (
              <span className={styles.vfCenter} aria-hidden>
                <span className={styles.vfIcon}>📷</span>
                <span className={styles.vfHint}>正在启动摄像头...</span>
              </span>
            )}
            {camera.hasError && (
              <span className={styles.vfCenter} aria-hidden>
                <span className={styles.vfIcon}>📷</span>
                <span className={styles.vfHint}>无法访问摄像头</span>
              </span>
            )}
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
          disabled={!native && !camera.isReady}
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
