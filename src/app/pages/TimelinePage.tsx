import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJournals } from '../hooks/useJournals';
import { usePlayerStore } from '../stores/playerStore';
import { hapticTap } from '../hooks/useHapticTap';
import type { Song } from '@algorithm/index';
import styles from './TimelinePage.module.css';

const MONTH_LABELS_EN = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 由歌曲 V-A 生成封面渐变色(无真实封面时的 fallback,与 SongCard 一致) */
function coverGradient(song: Song): string {
  const { v, a } = song.va;
  const hue = Math.round(20 + v * 320);
  const sat = 45 + a * 35;
  const light1 = 55 + a * 10;
  const light2 = 35 + a * 8;
  return `linear-gradient(135deg, hsl(${hue}, ${sat}%, ${light1}%), hsl(${hue + 30}, ${sat}%, ${light2}%))`;
}

function coverInitial(title: string): string {
  return title.trim().charAt(0) || '♪';
}

/** 秒数格式化为 mm:ss */
function formatTime(sec: number): string {
  if (!sec || sec < 0 || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TimelinePage() {
  const journals = useJournals();
  const navigate = useNavigate();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const seek = usePlayerStore((s) => s.seek);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const currentSongId = usePlayerStore((s) => {
    if (s.currentIndex < 0 || s.currentIndex >= s.queue.length) return null;
    return s.queue[s.currentIndex]?.songId ?? null;
  });
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

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
            const dayNum = String(d.getDate()).padStart(2, '0');
            const week = WEEK_LABELS[d.getDay()];
            const firstSong = entry.songs[0];
            const isCurrent = firstSong ? currentSongId === firstSong.songId : false;
            const showPlaying = isCurrent && isPlaying;

            return (
              <article key={entry.id} className={styles.item}>
                {/* 左侧:大日期数字 + 星期 + 竖线 */}
                <div className={styles.dateCol}>
                  <span className={styles.dayNum}>{dayNum}</span>
                  <span className={styles.weekLabel}>{week}</span>
                  <span className={styles.line} aria-hidden />
                </div>

                {/* 右侧:卡片 */}
                <div
                  className={styles.card}
                  onClick={() => handleCardClick(entry.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCardClick(entry.id);
                  }}
                >
                  {/* 图片占位区 */}
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
                  </div>

                  <div className={styles.body}>
                    {/* 情绪 pill(绿点+文字) */}
                    <div className={styles.emotionRow}>
                      <span className={styles.emotionPill}>
                        <span className={styles.emotionDot} aria-hidden />
                        {entry.emotion.displayLabel}
                      </span>
                    </div>

                    {/* 描述文字 */}
                    <p className={styles.desc}>{entry.text}</p>

                    {/* 分割线 */}
                    <div className={styles.divider} aria-hidden />

                    {/* —— 升级版播放器横条 —— */}
                    {firstSong ? (
                      <div className={`${styles.playerBar} ${showPlaying ? styles.playerBarPlaying : ''}`}>
                        {/* 左:圆形封面(播放时旋转 + 呼吸光晕) */}
                        <button
                          type="button"
                          className={styles.playerCover}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlay(firstSong, entry.songs);
                          }}
                          aria-label={showPlaying ? '暂停' : '播放'}
                        >
                          <span
                            className={`${styles.coverInner} ${showPlaying ? styles.coverRotating : ''}`}
                            style={{ background: coverGradient(firstSong) }}
                            aria-hidden
                          >
                            <span className={styles.coverInitial}>
                              {coverInitial(firstSong.title)}
                            </span>
                          </span>
                          {showPlaying && <span className={styles.coverGlow} aria-hidden />}
                          <span
                            className={`${styles.coverOverlay} ${showPlaying ? styles.coverOverlayPlaying : ''}`}
                            aria-hidden
                          >
                            {showPlaying ? (
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="5" width="4" height="14" rx="1" />
                                <rect x="14" y="5" width="4" height="14" rx="1" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 5v14l12-7z" />
                              </svg>
                            )}
                          </span>
                        </button>

                        {/* 中:频谱条 + 进度条 + 时长 */}
                        <div className={styles.playerMain}>
                          <div className={styles.spectrum} aria-hidden>
                            {[0, 1, 2, 3, 4].map((i) => (
                              <span
                                key={i}
                                className={`${styles.spectrumBar} ${showPlaying ? styles.spectrumBarActive : ''}`}
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </div>

                          <div
                            className={styles.progressTrack}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const p = (e.clientX - rect.left) / rect.width;
                              seek(Math.max(0, Math.min(1, p)));
                            }}
                            role="slider"
                            tabIndex={0}
                            aria-valuenow={Math.round((isCurrent ? progress : 0) * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="播放进度"
                          >
                            <span
                              className={styles.progressFill}
                              style={{ width: `${(isCurrent ? progress : 0) * 100}%` }}
                            />
                            <span
                              className={styles.progressThumb}
                              style={{ left: `${(isCurrent ? progress : 0) * 100}%` }}
                              aria-hidden
                            />
                          </div>

                          <div className={styles.timeRow}>
                            <span className={styles.timeCurrent}>
                              {formatTime(isCurrent ? currentTime : 0)}
                            </span>
                            <span className={styles.timeDivider}>/</span>
                            <span className={styles.timeDuration}>
                              {formatTime(isCurrent ? duration : 0)}
                            </span>
                          </div>
                        </div>

                        {/* 右:上一首/下一首 */}
                        <div className={styles.playerControls}>
                          <button
                            type="button"
                            className={styles.ctrlBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCurrent) prev();
                            }}
                            disabled={!isCurrent}
                            aria-label="上一首"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={styles.ctrlBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCurrent) next();
                            }}
                            disabled={!isCurrent}
                            aria-label="下一首"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.songRow}>
                        <span className={styles.songPlaceholder}>♪</span>
                        <span className={styles.songPlaceholderText}>暂无推荐歌曲</span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
