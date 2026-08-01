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
        style={{ background: 'var(--cover-placeholder)' }}
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
