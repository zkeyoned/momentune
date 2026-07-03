import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJournals } from '../hooks/useJournals';
import { PhotoCapture } from '../components/PhotoCapture';
import { JournalCard } from '../components/JournalCard';
import { getEmotionDisplay } from '../config/emotionDisplay';
import styles from './JournalPage.module.css';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

type ViewMode = 'calendar' | 'list';

/* 视图切换线性 SVG 图标(替代原 Unicode ▦ ☰) */
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
  </svg>
);

const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
  </svg>
);

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function toYMD(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function JournalPage() {
  const journals = useJournals();
  const navigate = useNavigate();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // 按日期分组
  const journalsByDate = useMemo(() => {
    const map = new Map<string, typeof journals>();
    for (const j of journals) {
      const key = toYMD(j.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(j);
      map.set(key, arr);
    }
    return map;
  }, [journals]);

  // 日历网格
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateKey: string | null }> = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateKey: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateKey });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const shownJournals = selectedDate
    ? (journalsByDate.get(selectedDate) ?? [])
    : journals.filter((j) => {
        const d = new Date(j.createdAt);
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      });

  return (
    <div className={styles.page}>
      {/* —— 页头 + 视图切换 —— */}
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.pageTitle}>回忆</h1>
            <p className={styles.pageSubtitle}>翻阅每一个被旋律记住的瞬间</p>
          </div>
          {/* 右上角视图切换 */}
          <div className={styles.viewSwitch} role="group" aria-label="视图切换">
            <button
              type="button"
              className={`${styles.switchBtn} ${viewMode === 'calendar' ? styles.switchActive : ''}`}
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              aria-label="日历视图"
            >
              <CalendarIcon />
            </button>
            <button
              type="button"
              className={`${styles.switchBtn} ${viewMode === 'list' ? styles.switchActive : ''}`}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="列表视图"
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </header>

      {/* —— 日历视图 —— */}
      {viewMode === 'calendar' && (
        <>
          <section className={styles.calendarSection}>
            <div className={styles.calHead}>
              <button className={styles.calNav} onClick={prevMonth} aria-label="上个月">
                <ChevronLeft />
              </button>
              <h2 className={styles.calTitle}>{viewYear}年 {MONTH_LABELS[viewMonth]}</h2>
              <button className={styles.calNav} onClick={nextMonth} aria-label="下个月">
                <ChevronRight />
              </button>
            </div>

            <div className={styles.weekRow}>
              {WEEK_LABELS.map((w) => (
                <span key={w} className={styles.weekCell}>{w}</span>
              ))}
            </div>

            <div className={styles.calGrid}>
              {calendarCells.map((cell, i) => {
                if (!cell.day) {
                  return <span key={i} className={styles.calEmpty} />;
                }
                const has = journalsByDate.has(cell.dateKey!);
                const isSelected = selectedDate === cell.dateKey;
                const isToday =
                  cell.day === today.getDate() &&
                  viewMonth === today.getMonth() &&
                  viewYear === today.getFullYear();
                return (
                  <button
                    key={i}
                    className={`${styles.calCell} ${has ? styles.calHas : ''} ${isSelected ? styles.calSelected : ''} ${isToday ? styles.calToday : ''}`}
                    onClick={() => has && setSelectedDate(isSelected ? null : cell.dateKey)}
                    disabled={!has}
                  >
                    <span className={styles.calDayNum}>{cell.day}</span>
                    {has && <span className={styles.calDot} />}
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <button className={styles.clearSel} onClick={() => setSelectedDate(null)}>
                ✕ 清除筛选,显示整月
              </button>
            )}
          </section>

          <section className={styles.photosSection}>
            <div className={styles.photosHead}>
              <h3 className={styles.photosTitle}>
                {selectedDate
                  ? formatDayLabel(journalsByDate.get(selectedDate)?.[0]?.createdAt ?? 0)
                  : MONTH_LABELS[viewMonth]}
              </h3>
              <span className={styles.photosCount}>{shownJournals.length} 篇</span>
            </div>

            {shownJournals.length === 0 ? (
              <div className={styles.empty}>
                <p className="muted center">这个时段还没有日记</p>
                <p className="muted center mt-sm">去拍一张照片,记录今天</p>
              </div>
            ) : (
              <div className={styles.photoGrid}>
                {shownJournals.map((entry) => {
                  const emotionDisplay = getEmotionDisplay(entry.emotion.primary);
                  const d = new Date(entry.createdAt);
                  return (
                    <button
                      key={entry.id}
                      className={styles.photoCard}
                      onClick={() => navigate(`/journal/${entry.id}`)}
                    >
                      <div className={styles.photoWrap}>
                        <img
                          src={entry.photoUrl}
                          alt={entry.photoTitle}
                          className={styles.photo}
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                          }}
                        />
                        <span className={styles.photoDate}>
                          {d.getMonth() + 1}/{d.getDate()}
                        </span>
                        <span className={styles.photoVibe}>{emotionDisplay.vibe}</span>
                      </div>
                      <span className={styles.photoTitle}>{entry.photoTitle}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* —— 列表视图 —— */}
      {viewMode === 'list' && (
        <section className={styles.listSection}>
          {journals.length === 0 ? (
            <div className={styles.empty}>
              <p className="muted center">还没有日记</p>
              <p className="muted center mt-sm">拍一张照片,记下今天的心情</p>
            </div>
          ) : (
            <div className={styles.list}>
              {journals.map((j) => (
                <JournalCard key={j.id} entry={j} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* —— 空状态引导拍照 —— */}
      {journals.length === 0 && (
        <section className="section">
          <div className={styles.captureWrap}>
            <PhotoCapture variant="compact" />
          </div>
        </section>
      )}
    </div>
  );
}
