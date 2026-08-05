import { useState } from 'react';
import styles from './VinylRecord.module.css';

interface VinylRecordProps {
  /** 专辑封面 URL, 可选 */
  coverUrl?: string;
  /** 无封面时用照片裁圆 */
  fallbackPhotoUrl: string;
  /** 播放状态, 控制旋转与唱针 */
  isPlaying: boolean;
  /** 唱片直径 px, 默认 280 */
  size?: number;
}

/**
 * VinylRecord — 黑胶唱片视觉组件
 *
 * 银色拉丝包边 + 同心细纹 + 圆形封面 + 右上银色唱针。
 * 播放时整张唱片 (不含唱针) 旋转, 暂停时唱针略抬。
 * prefers-reduced-motion 时禁用旋转动画。
 */
export function VinylRecord({
  coverUrl,
  fallbackPhotoUrl,
  isPlaying,
  size = 280,
}: VinylRecordProps) {
  // 封面加载失败时切换到 fallback 照片
  const [useFallback, setUseFallback] = useState(false);
  const src = useFallback || !coverUrl ? fallbackPhotoUrl : coverUrl;

  return (
    <div className={styles.record} style={{ width: size, height: size }}>
      <div className={`${styles.disc} ${isPlaying ? styles.spinning : ''}`}>
        <div className={styles.rim} />
        <div className={styles.vinyl} />
        <div className={styles.coverWrap}>
          <img
            src={src}
            className={styles.cover}
            alt=""
            onError={() => {
              if (!useFallback) setUseFallback(true);
            }}
          />
        </div>
        <div className={styles.centerHole} />
      </div>
      <div
        className={`${styles.tonearm} ${!isPlaying ? styles.lifted : ''}`}
        aria-hidden
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <linearGradient id="vinylSilver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8e8e8" />
              <stop offset="100%" stopColor="#888888" />
            </linearGradient>
          </defs>
          {/* 支点圆 (右上, 旋转中心) */}
          <circle cx="80" cy="20" r="7" fill="url(#vinylSilver)" stroke="#666" strokeWidth="1" />
          <circle cx="80" cy="20" r="2" fill="#444" />
          {/* 斜杆 */}
          <line
            x1="80"
            y1="20"
            x2="32"
            y2="68"
            stroke="url(#vinylSilver)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* 头部 (唱头) */}
          <circle cx="32" cy="68" r="6" fill="#3a3a3a" stroke="#888" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
