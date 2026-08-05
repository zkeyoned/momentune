import styles from './PhotoPaper.module.css';

interface PhotoPaperProps {
  /** 照片 URL */
  src: string;
  /** 日期戳文字, 如 "2026.08.05" */
  dateLabel: string;
  /** 可选位置文字 */
  location?: string;
}

/**
 * PhotoPaper — CCD 拍立得相纸视觉组件
 *
 * 白底卡片 + 3:4 照片 + 右下橙色日期戳 + 底部刻字。
 * 容器宽度由父级控制, 本组件只负责内部布局。
 */
export function PhotoPaper({ src, dateLabel, location }: PhotoPaperProps) {
  return (
    <div className={styles.paper}>
      <div className={styles.photoWrap}>
        <img src={src} className={styles.photo} alt="" />
        <span className={styles.dateStamp}>{dateLabel}</span>
      </div>
      <span className={styles.engraving}>MOMENTUNE・CCD</span>
      {location && <span className={styles.location}>· {location}</span>}
    </div>
  );
}
