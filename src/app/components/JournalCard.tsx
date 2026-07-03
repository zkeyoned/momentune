import { useNavigate } from 'react-router-dom';
import type { JournalEntry } from '../types';
import { getEmotionDisplay } from '../config/emotionDisplay';
import styles from './JournalCard.module.css';

interface JournalCardProps {
  entry: JournalEntry;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}.${m}.${day} · ${h}:${min}`;
}

export function JournalCard({ entry }: JournalCardProps) {
  const navigate = useNavigate();
  const emotionDisplay = getEmotionDisplay(entry.emotion.primary);
  const firstSong = entry.songs[0];

  return (
    <article
      className={styles.card}
      onClick={() => navigate(`/journal/${entry.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/journal/${entry.id}`);
      }}
    >
      <div className={styles.photoWrap}>
        <img
          src={entry.photoUrl}
          alt={entry.photoTitle}
          className={styles.photo}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className={styles.emotionPill}>{entry.emotion.displayLabel}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.date}>{formatDate(entry.createdAt)}</span>
          {entry.location && <span className={styles.location}>@ {entry.location}</span>}
        </div>

        <h4 className={styles.title}>{entry.photoTitle}</h4>

        <p className={styles.text}>{entry.text}</p>

        <div className={styles.footer}>
          <span className={styles.vibe}>{emotionDisplay.vibe}</span>
          {firstSong && (
            <span className={styles.songMini}>
              ♪ {firstSong.title} · {firstSong.artist}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
