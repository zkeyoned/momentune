import type { Song } from '@algorithm/index';
import { findNearestEmotionLabel } from '@algorithm/index';
import { getEmotionDisplay } from '../config/emotionDisplay';
import styles from './SongCard.module.css';

interface SongCardProps {
  song: Song;
  onPlay: () => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
  rank?: number;
}

/** 由歌曲 V-A 生成封面渐变色(无真实封面时的 fallback) */
function coverGradient(song: Song): string {
  const { v, a } = song.va;
  // 高 V 偏暖橙,低 V 偏冷蓝紫;高 A 提亮
  const hue = Math.round(20 + v * 320); // 20→340
  const sat = 45 + a * 35;
  const light1 = 55 + a * 10;
  const light2 = 35 + a * 8;
  return `linear-gradient(135deg, hsl(${hue}, ${sat}%, ${light1}%), hsl(${hue + 30}, ${sat}%, ${light2}%))`;
}

/** 歌曲首字母(封面占位) */
function coverInitial(title: string): string {
  const ch = title.trim().charAt(0);
  return ch || '♪';
}

export function SongCard({
  song,
  onPlay,
  isCurrent = false,
  isPlaying = false,
  rank,
}: SongCardProps) {
  const label = findNearestEmotionLabel(song.va);
  const display = getEmotionDisplay(label);
  const genreText = song.genres
    .slice(0, 2)
    .map((g) => g)
    .join(' / ');

  return (
    <div
      className={`${styles.card} ${isCurrent ? styles.current : ''}`}
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay();
        }
      }}
    >
      <div
        className={styles.cover}
        style={{ background: coverGradient(song) }}
        aria-hidden
      >
        <span className={styles.coverInitial}>{coverInitial(song.title)}</span>
        {isCurrent && (
          <span className={styles.playingIndicator} aria-hidden>
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
          </span>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.titleRow}>
          {rank != null && <span className={styles.rank}>{rank}</span>}
          <h4 className={styles.title}>{song.title}</h4>
        </div>
        <p className={styles.artist}>{song.artist}</p>
        <div className={styles.tags}>
          <span className={styles.tag}>{display.zh}</span>
          {genreText && <span className={`${styles.tag} ${styles.tagMuted}`}>{genreText}</span>}
          {song.layer === 'hot' && <span className={`${styles.tag} ${styles.tagHot}`}>热歌</span>}
        </div>
      </div>

      <button
        className={styles.playBtn}
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        aria-label={isCurrent && isPlaying ? '暂停' : '播放'}
      >
        {isCurrent && isPlaying ? '❚❚' : '▶'}
      </button>
    </div>
  );
}
