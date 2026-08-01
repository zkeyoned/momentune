import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJournals } from '../hooks/useJournals';
import { hapticTap } from '../hooks/useHapticTap';
import styles from './TimelinePage.module.css';

const MONTH_LABELS_EN = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export function TimelinePage() {
  const journals = useJournals();
  const navigate = useNavigate();

  // 月份统计:取最新一条日记所在月份为"当前展示月"
  const monthStat = useMemo(() => {
    if (journals.length === 0 || !journals[0]) {
      const t = new Date();
      return { year: t.getFullYear(), month: t.getMonth(), count: 0 };
    }
    const latest = journals[0];
    const d = new Date(latest.createdAt);
    const year = d.getFullYear();
    const month = d.getMonth();
    const count = journals.filter((j) => {
      const jd = new Date(j.createdAt);
      return jd.getFullYear() === year && jd.getMonth() === month;
    }).length;
    return { year, month, count };
  }, [journals]);

  const handleCardClick = (id: string) => {
    hapticTap('light');
    navigate(`/journal/${id}`);
  };

  return (
    <div className={styles.page}>
      {/* —— 页头:italic 标语 + Momentune 大标题 + 右上角头像 + 月份行 —— */}
      <header className={styles.header}>
        <div className={styles.headerGlow} aria-hidden />
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <p className={styles.tagline}>moments in melody</p>
            <h1 className={styles.title}>Momentune</h1>
          </div>
          <button
            type="button"
            className={styles.avatar}
            onClick={() => navigate('/settings')}
            aria-label="我的"
          >
            <span aria-hidden>M</span>
          </button>
        </div>

        <div className={styles.monthRow}>
          <span className={styles.monthLabel}>
            {MONTH_LABELS_EN[monthStat.month]} · {monthStat.year}
          </span>
          <span className={styles.monthCount}>共 {monthStat.count} 个瞬间</span>
        </div>
      </header>

      {/* —— 时间线主体 —— */}
      {journals.length === 0 ? (
        <div className={styles.empty}>
          <p className="muted center">还没有瞬间被记下</p>
          <p className="muted center mt-sm">去拍一张照片,留下今天</p>
        </div>
      ) : (
        <section className={styles.timeline}>
          {journals.map((entry) => {
            const d = new Date(entry.createdAt);
            // 日期格式 MM.DD,月份与日都 padStart 2 位
            const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
            return (
              <article
                key={entry.id}
                className={styles.item}
                onClick={() => handleCardClick(entry.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCardClick(entry.id);
                }}
              >
                {/* 左:小方图缩略图 */}
                <img
                  src={entry.photoUrl}
                  alt={entry.photoTitle}
                  className={styles.thumb}
                  loading="lazy"
                />

                {/* 中:上行标题 / 下行情绪标签 */}
                <div className={styles.meta}>
                  <span className={styles.cardTitle}>{entry.photoTitle}</span>
                  <span className={styles.emotionLabel}>{entry.emotion.displayLabel}</span>
                </div>

                {/* 右:日期 MM.DD */}
                <span className={styles.dateText}>{dateStr}</span>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
