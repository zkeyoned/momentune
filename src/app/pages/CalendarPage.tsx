import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJournals } from '../hooks/useJournals';
import { usePlayerStore } from '../stores/playerStore';
import { hapticTap } from '../hooks/useHapticTap';
import type { Song } from '@algorithm/index';
import styles from './CalendarPage.module.css';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

function toYMD(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function CalendarPage() {
  const journals = useJournals();
  const navigate = useNavigate();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentSongId = usePlayerStore((s) => {
    if (s.currentIndex < 0 || s.currentIndex >= s.queue.length) return null;
    return s.queue[s.currentIndex]?.songId ?? null;
  });
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // 当月瞬间数
  const monthCount = useMemo(() => {
    return journals.filter((j) => {
      const d = new Date(j.createdAt);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }).length;
  }, [journals, viewYear, viewMonth]);

  // 精选日记:优先选中日期的第一条,否则取当月第一条,否则取全部第一条
  const featured = useMemo(() => {
    if (selectedDate) {
      const arr = journalsByDate.get(selectedDate);
      if (arr && arr.length > 0) return arr[0];
    }
    const monthItems = journals.filter((j) => {
      const d = new Date(j.createdAt);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
    if (monthItems.length > 0) return monthItems[0];
    return journals[0] ?? null;
  }, [journals, journalsByDate, selectedDate, viewYear, viewMonth]);

  const prevMonth = () => {
    hapticTap('light');
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };
  const nextMonth = () => {
    hapticTap('light');
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const handlePlay = (song: Song, queue: Song[]) => {
    hapticTap('medium');
    playTrack(song, queue);
  };

  const handleCardClick = (id: string) => {
    hapticTap('light');
    navigate(`/journal/${id}`);
  };

  return (
    <div className={styles.page}>
      {/* —— 页头:italic "memories" + 年月 + 左右箭头 —— */}
      <header className={styles.header}>
        <div className={styles.headerGlow} aria-hidden />
        <p className={styles.tagline}>memories</p>
        <div className={styles.calHead}>
          <button className={styles.calNav} onClick={prevMonth} aria-label="上个月">
            <ChevronLeft />
          </button>
          <h1 className={styles.calTitle}>
            {viewYear}年 {MONTH_LABELS[viewMonth]}
          </h1>
          <button className={styles.calNav} onClick={nextMonth} aria-label="下个月">
            <ChevronRight />
          </button>
        </div>
      </header>

      {/* —— 月份标题行:左侧月份 + 右侧"X 个瞬间" —— */}
      <div className={styles.monthStatRow}>
        <span className={styles.monthStatLabel}>{MONTH_LABELS[viewMonth]}</span>
        <span className={styles.monthStatCount}>{monthCount} 个瞬间</span>
      </div>

      {/* —— 日历网格卡片 —— */}
      <section className={styles.calSection}>
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

      {/* —— 下方精选日记大卡 —— */}
      <section className={styles.featuredSection}>
        {featured ? (
          <FeaturedCard
            entry={featured}
            currentSongId={currentSongId}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onClick={() => handleCardClick(featured.id)}
          />
        ) : (
          <div className={styles.empty}>
            <p className="muted center">这个时段还没有日记</p>
            <p className="muted center mt-sm">去拍一张照片,记录今天</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* —— 精选日记大卡子组件 —— */
interface FeaturedCardProps {
  entry: import('../types').JournalEntry;
  currentSongId: string | null;
  isPlaying: boolean;
  onPlay: (song: Song, queue: Song[]) => void;
  onClick: () => void;
}

function FeaturedCard({
  entry,
  currentSongId,
  isPlaying,
  onPlay,
  onClick,
}: FeaturedCardProps) {
  const d = new Date(entry.createdAt);
  const datePill = `${d.getMonth() + 1}/${d.getDate()}`;
  const firstSong = entry.songs[0];
  const isCurrent = firstSong ? currentSongId === firstSong.songId : false;
  const showPlaying = isCurrent && isPlaying;

  return (
    <article
      className={styles.featured}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
    >
      {/* 大图 + 暗角遮罩 + 双 pill(演示稿设计:左上日期,右下情绪) */}
      <div className={styles.featuredPhoto}>
        <img
          src={entry.photoUrl}
          alt={entry.photoTitle}
          className={styles.featuredImg}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
          }}
        />
        <div className={styles.featuredVignette} aria-hidden />
        {/* 左上日期 pill(深褐半透 + blur) */}
        <span className={styles.datePill}>{datePill}</span>
        {/* 右下情绪 pill(焦糖半透) — 回归演示稿位置 */}
        <span className={styles.emotionPill}>{entry.emotion.displayLabel}</span>
      </div>

      <div className={styles.featuredBody}>
        <h3 className={styles.featuredTitle}>{entry.photoTitle}</h3>
        <p className={styles.featuredDesc}>{entry.text}</p>

        {/* 歌曲行(演示稿设计:音符图标 + 歌名—歌手,焦糖色,顶部分割线) */}
        {firstSong ? (
          <button
            type="button"
            className={`${styles.songRow} ${showPlaying ? styles.songRowPlaying : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onPlay(firstSong, entry.songs);
            }}
            aria-label={showPlaying ? '暂停' : '播放'}
          >
            <svg className={styles.songIcon} viewBox="0 0 24 24" aria-hidden>
              <path
                d="M9 18V5l10-2v13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="19" cy="16" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span className={styles.songText}>
              {firstSong.title} — {firstSong.artist}
            </span>
            {showPlaying && <span className={styles.playingDot} aria-hidden />}
          </button>
        ) : (
          <div className={styles.songRow}>
            <span className={styles.songPlaceholderText}>暂无推荐歌曲</span>
          </div>
        )}
      </div>
    </article>
  );
}
