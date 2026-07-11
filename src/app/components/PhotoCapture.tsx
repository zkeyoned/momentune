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

  /**
   * 提交照片到分析流程
   *
   * - 示例照片(带 features):直接 setPending 跳转
   * - 相机/相册(无 features):用占位 features + needsFeatureEstimation 标记,
   *   立即跳转到 ResultPage,特征估计在 runAnalysis 的 loading 态下完成
   *   (用户可见"AI 正在感受…"),避免快门后界面无响应。
   */
  const submitPhoto = (
    dataUrl: string,
    source: 'camera' | 'album' | 'sample',
    title: string,
    location?: string,
    features?: SamplePhoto['features'],
  ) => {
    if (features) {
      // 示例照片:已有预设特征,直接进入分析
      setPending({
        features,
        previewUrl: dataUrl,
        source,
        title,
        location,
      });
    } else {
      // 相机/相册:占位特征(随机一个示例的特征),标记需要估计
      const placeholder =
        SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)]!.features;
      setPending({
        features: placeholder,
        previewUrl: dataUrl,
        source,
        title,
        location,
        needsFeatureEstimation: true,
      });
    }
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
      {/* —— 主入口:从相册选择(demo 主路径,最醒目) —— */}
      <button
        type="button"
        className={styles.primaryAlbum}
        onClick={handleAlbum}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="1.8" />
          <path d="M21 16l-5-5L5 19" />
        </svg>
        <span className={styles.primaryAlbumText}>
          <span className={styles.primaryAlbumTitle}>从相册选择照片</span>
          <span className={styles.primaryAlbumHint}>推荐 · 最快入口</span>
        </span>
      </button>

      {/* —— 分隔线 —— */}
      <div className={styles.divider}>
        <span className={styles.dividerLine} aria-hidden />
        <span className={styles.dividerText}>或拍照</span>
        <span className={styles.dividerLine} aria-hidden />
      </div>

      {/* —— 取景框(次要入口) —— */}
      <div className={styles.viewfinder}>
        {native ? (
          <span className={styles.vfCenter} aria-hidden>
            <span className={styles.vfIcon}>📷</span>
            <span className={styles.vfHint}>点击下方按钮拍照</span>
          </span>
        ) : (
          <>
            <video
              ref={videoRef}
              className={styles.cameraVideo}
              playsInline
              muted
              autoPlay
            />

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
                <span className={styles.vfHint}>无法访问摄像头 · 用上方相册入口</span>
              </span>
            )}
          </>
        )}
      </div>

      {/* —— 拍照控制:快门 + 翻转(次要) —— */}
      <div className={styles.controls}>
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

        <button
          type="button"
          className={styles.shutter}
          onClick={handleShutter}
          disabled={!native && !camera.isReady}
          aria-label="拍照"
        >
          <span className={styles.shutterInner} />
        </button>

        {/* 占位保持快门居中 */}
        <span className={styles.controlsSpacer} aria-hidden />
      </div>

      {/* 摄像头不可用时,显示示例照片作为 fallback */}
      {camera.hasError && !native && (
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
      )}

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
