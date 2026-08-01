import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../stores/analysisStore';
import { useJournalStore } from '../stores/journalStore';
import { SAMPLE_PHOTOS } from '../services/mockApi';
import type { SamplePhoto } from '../services/mockApi';
import { isNative, hapticImpact, hapticNotify } from '../services/nativeBridge';
import { createPhotoStrategy } from '../services/photoStrategy';
import { useCameraManager } from '../hooks/useCameraManager';
import styles from './HomePage.module.css';

/** 格式化今日日期:YYYY · MM · DD */
function fmtDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y} · ${m} · ${day}`;
}

/**
 * 将 dataUrl 水平翻转(用于后置摄像头:hook 的 captureFrame 始终镜像,
 * 后置拍风景时需要翻回来恢复正常方向,避免风景左右反过来)
 */
function flipHorizontal(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function HomePage() {
  const navigate = useNavigate();
  const setPending = useAnalysisStore((s) => s.setPending);
  const recentPhoto = useJournalStore((s) => s.journals[0]?.photoUrl);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const native = isNative();

  // 直接使用 useCameraManager(方案 A:不再渲染 PhotoCapture full)
  const camera = useCameraManager(videoRef, !native);
  // 前置摄像头预览需镜像(自拍像照镜子才自然);后置不镜像(风景真实方向)
  const isFront = camera.facingMode === 'user';

  // 平台拍照策略
  const photoStrategy = useMemo(
    () => createPhotoStrategy(camera.captureFrame, fileRef),
    [camera.captureFrame],
  );

  // 取景框辅助开关
  const [gridOn, setGridOn] = useState(false);
  const [autoMood, setAutoMood] = useState(true);

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
      setPending({
        features,
        previewUrl: dataUrl,
        source,
        title,
        location,
      });
    } else {
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
    let photoData = await photoStrategy.capturePhoto();
    // hook 的 captureFrame 始终水平镜像,自拍时这是对的(与预览一致);
    // 后置拍风景时反了,需翻回来恢复风景正常方向
    if (photoData && !native && camera.facingMode === 'environment') {
      photoData = await flipHorizontal(photoData);
    }
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

  // 占位触感(双重曝光 / 定时 / 闪光 / 胶片 暂未实现)
  const handlePlaceholder = () => {
    void hapticImpact('light');
  };

  return (
    <div className={styles.page}>
      {/* —— 顶部:今日日期 —— */}
      <div className={styles.dateBar} aria-label="今日日期">
        {fmtDate()}
      </div>

      {/* —— 取景框 —— */}
      <div className={styles.viewfinder}>
        <video
          ref={videoRef}
          className={`${styles.video} ${isFront ? styles.videoFront : ''}`}
          playsInline
          muted
          autoPlay
        />

        {/* 九宫格辅助线 */}
        {gridOn && (
          <>
            <span className={`${styles.gridLine} ${styles.gridH1}`} aria-hidden />
            <span className={`${styles.gridLine} ${styles.gridH2}`} aria-hidden />
            <span className={`${styles.gridLine} ${styles.gridV1}`} aria-hidden />
            <span className={`${styles.gridLine} ${styles.gridV2}`} aria-hidden />
          </>
        )}

        {/* 底部内侧胶囊:情绪 / 网格 */}
        <div className={styles.vfPills}>
          <button
            type="button"
            className={styles.vfPill}
            data-active={autoMood || undefined}
            onClick={() => setAutoMood((v) => !v)}
          >
            情绪 自动
          </button>
          <button
            type="button"
            className={styles.vfPill}
            data-active={gridOn || undefined}
            onClick={() => setGridOn((v) => !v)}
          >
            网格
          </button>
        </div>

        {/* 原生环境或摄像头未就绪时的占位 */}
        {native && (
          <div className={styles.vfHint}>
            <span className={styles.vfHintIcon} aria-hidden>📷</span>
            <span className={styles.vfHintText}>点击下方快门拍照</span>
          </div>
        )}
        {!native && !camera.isReady && !camera.hasError && (
          <div className={styles.vfHint}>
            <span className={styles.vfHintIcon} aria-hidden>📷</span>
            <span className={styles.vfHintText}>正在启动摄像头…</span>
          </div>
        )}
        {!native && camera.hasError && (
          <div className={styles.vfHint}>
            <span className={styles.vfHintIcon} aria-hidden>📷</span>
            <span className={styles.vfHintText}>无法访问摄像头</span>
          </div>
        )}
      </div>

      {/* —— 细线图标横排(闪光 / 翻转) —— */}
      <div className={styles.iconRow}>
        {/* 闪光 */}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handlePlaceholder}
          aria-label="闪光灯"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path d="M13 2L5 14h6l-2 8 8-12h-6l2-8z" strokeLinejoin="round" />
          </svg>
        </button>

        {/* 翻转摄像头 */}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleFlip}
          aria-label="翻转摄像头"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path d="M4 9a8 8 0 0114-3" strokeLinecap="round" />
            <path d="M20 15a8 8 0 01-14 3" strokeLinecap="round" />
            <path d="M4 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* —— 主操作行 —— */}
      <div className={styles.actionRow}>
        {/* 左:最近一张照片缩略图 */}
        <button
          type="button"
          className={styles.thumb}
          onClick={handleAlbum}
          aria-label="最近照片"
        >
          {recentPhoto ? (
            <img src={recentPhoto} alt="最近照片" className={styles.thumbImg} />
          ) : null}
        </button>

        {/* 中:大圆形快门 */}
        <button
          type="button"
          className={styles.shutter}
          onClick={handleShutter}
          disabled={!native && !camera.isReady}
          aria-label="拍照"
        >
          <span className={styles.shutterInner} />
        </button>

        {/* 右:胶片按钮(占位) */}
        <button
          type="button"
          className={styles.filmBtn}
          onClick={handlePlaceholder}
        >
          胶片
        </button>
      </div>

      {/* Web 环境隐藏的文件输入(相册选择) */}
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
