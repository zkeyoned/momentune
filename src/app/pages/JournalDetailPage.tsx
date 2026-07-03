import { Link, useNavigate, useParams } from 'react-router-dom';
import { useJournal } from '../hooks/useJournals';
import { useJournalStore } from '../stores/journalStore';
import { usePlayerStore } from '../stores/playerStore';
import { SongCard } from '../components/SongCard';
import styles from './JournalDetailPage.module.css';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}.${m}.${day} · ${h}:${min}`;
}

export function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const journal = useJournal(id);
  const remove = useJournalStore((s) => s.remove);
  const navigate = useNavigate();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentSongId = usePlayerStore((s) =>
    s.currentIndex >= 0 ? s.queue[s.currentIndex]?.songId : undefined,
  );
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  if (!journal) {
    return (
      <div className={styles.page}>
        <div className="section center">
          <p className="muted">日记不存在</p>
          <Link to="/journal" className="btn btn-ghost mt-md">
            ← 返回回忆
          </Link>
        </div>
      </div>
    );
  }


  const handleDelete = () => {
    if (window.confirm('确定删除这篇日记吗?')) {
      remove(journal.id);
      navigate('/journal');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.photoWrap}>
        <img
          src={journal.photoUrl}
          alt={journal.photoTitle}
          className={styles.photo}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
          }}
        />
        <div className={styles.photoOverlay}>
          <span className={styles.emotionPill}>{journal.emotion.displayLabel}</span>
          {journal.location && <span className={styles.location}>@ {journal.location}</span>}
        </div>
      </div>

      <section className="section">
        <div className={styles.meta}>
          <span className="mono muted">{formatDate(journal.createdAt)}</span>
        </div>
        <h1 className={styles.title}>{journal.photoTitle}</h1>
      </section>

      <section className="section">
        <h2>这一天的心情</h2>
        <p className={styles.text}>{journal.text}</p>
      </section>

      {journal.songs.length > 0 && (
        <section className="section">
          <h2>那天推荐的歌 · {journal.songs.length} 首</h2>
          <div className={styles.songList}>
            {journal.songs.map((song, idx) => (
              <SongCard
                key={song.songId}
                song={song}
                rank={idx + 1}
                onPlay={() => playTrack(song, journal.songs)}
                isCurrent={currentSongId === song.songId}
                isPlaying={isPlaying && currentSongId === song.songId}
              />
            ))}
          </div>
        </section>
      )}

      <div className={styles.actions}>
        <Link to="/journal" className="btn btn-ghost">
          ← 回忆
        </Link>
        <button className={`btn btn-ghost ${styles.deleteBtn}`} onClick={handleDelete}>
          删除
        </button>
      </div>
    </div>
  );
}
