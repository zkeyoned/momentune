import type { CSSProperties } from 'react';
import styles from './RecognitionOverlay.module.css';

/**
 * 识别中覆盖层
 *
 * - 绝对定位铺满父容器, 压暗下层相机机身
 * - previewUrl 作为底图, brightness(0.45) 压暗
 * - 中央橙色圆环进度圈 + 百分比
 * - 圆环下方双行标题 + 三行 Light/Mood/Music Match 小进度
 * - error 非空时切换为错误态: 隐藏进度, 显示文案 + 返回重试按钮
 */

export interface RecognitionOverlayProps {
  previewUrl: string;        // 待识别照片
  step: number;              // 0~3, 0=第一步进行中, 3=全部完成
  progress: number;          // 0~100, 圆环百分比
  error: string | null;      // 非空时显示错误态
  onRetry: () => void;       // 错误态「返回重试」按钮回调
}

// 圆环半径与周长 (与 SVG width/height=120, stroke-width=4 配套)
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// 三行小进度配置: 标签 + 行索引
const STEP_ROWS: { label: string; rowIndex: number }[] = [
  { label: 'Light', rowIndex: 0 },
  { label: 'Mood', rowIndex: 1 },
  { label: 'Music Match', rowIndex: 2 },
];

export function RecognitionOverlay({
  previewUrl,
  step,
  progress,
  error,
  onRetry,
}: RecognitionOverlayProps) {
  // 圆环 stroke-dashoffset: progress 100 时偏移为 0, 0 时偏移为周长
  const clamped = Math.max(0, Math.min(100, progress));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped / 100);

  const photoBgStyle: CSSProperties = {
    backgroundImage: `url(${previewUrl})`,
  };

  if (error) {
    return (
      <div className={styles.root} role="alert" aria-live="assertive">
        <div className={styles.photoBg} style={photoBgStyle} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.errorBox}>
            <p className={styles.errorText}>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={onRetry}>
              返回重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root} role="status" aria-live="polite">
      <div className={styles.photoBg} style={photoBgStyle} aria-hidden="true" />
      <div className={styles.content}>
        {/* 圆环进度圈 */}
        <div className={styles.ringWrap}>
          <svg
            className={styles.ring}
            width={120}
            height={120}
            viewBox="0 0 120 120"
            aria-hidden="true"
          >
            <circle
              className={styles.ringTrack}
              cx={60}
              cy={60}
              r={RING_RADIUS}
            />
            <circle
              className={styles.ringProgress}
              cx={60}
              cy={60}
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className={styles.ringPct}>{Math.round(clamped)}%</span>
        </div>

        {/* 双行标题 */}
        <p className={styles.titleBig}>MATCHING THE MOMENT</p>
        <p className={styles.titleSmall}>Analyzing mood, light, and scene</p>

        {/* 三行小进度 */}
        <div className={styles.steps}>
          {STEP_ROWS.map(({ label, rowIndex }) => {
            const rowDone = step > rowIndex;
            const rowProgress = rowDone ? 100 : step === rowIndex ? 50 : 0;
            return (
              <div className={styles.stepRow} key={label}>
                <span className={styles.stepLabel}>{label}</span>
                {rowDone ? (
                  <svg
                    className={styles.stepCheck}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="var(--stamp-orange)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <div className={styles.stepBarWrap}>
                    <div
                      className={styles.stepBarFill}
                      style={{ width: `${rowProgress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
