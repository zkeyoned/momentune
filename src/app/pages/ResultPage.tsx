import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../stores/analysisStore';
import { useUserStore } from '../stores/userStore';
import { useJournalStore } from '../stores/journalStore';
import { usePlayerStore } from '../stores/playerStore';
import { buildEmotionDisplayLabel } from '../services/mockApi';
import { SongWheel } from '../components/SongWheel';
import styles from './ResultPage.module.css';

export function ResultPage() {
  const navigate = useNavigate();
  const pending = useAnalysisStore((s) => s.pending);
  const result = useAnalysisStore((s) => s.result);
  const loading = useAnalysisStore((s) => s.loading);
  const error = useAnalysisStore((s) => s.error);
  const runAnalysis = useAnalysisStore((s) => s.runAnalysis);
  const userPref = useUserStore((s) => s.userPref);
  const addJournal = useJournalStore((s) => s.add);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentSongId = usePlayerStore((s) =>
    s.currentIndex >= 0 ? s.queue[s.currentIndex]?.songId : undefined,
  );
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pending && !result && !loading && !error) {
      runAnalysis(userPref);
    }
  }, [pending, result, loading, error, runAnalysis, userPref]);

  if (!pending) {
    return (
      <div className={styles.page}>
        <div className="section center">
          <p className="muted">还没有选择照片</p>
          <Link to="/" className="btn btn-primary mt-md">
            去拍照
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.previewWrap}>
          <img src={pending.previewUrl} alt={pending.title} className={styles.previewImg} />
        </div>
        <div className="section center">
          <div className={styles.analyzing}>
            <div className={styles.spinner} aria-hidden />
            <p className="muted mt-md">AI 正在感受这张照片的情绪…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className={styles.page}>
        <div className="section center">
          <p className="muted">分析失败:{error ?? '未知错误'}</p>
          <Link to="/" className="btn btn-ghost mt-md">
            返回重试
          </Link>
        </div>
      </div>
    );
  }

  const displayLabel = buildEmotionDisplayLabel(result.primaryLabel, result.secondaryLabel);
  const allSongs = [
    ...result.recommendation.coreTracks.map((t) => t.song),
    ...result.recommendation.extendedTracks.map((t) => t.song),
  ];

  const handleSave = () => {
    const id = `journal-${Date.now()}`;
    addJournal({
      id,
      createdAt: Date.now(),
      photoUrl: pending.previewUrl,
      photoTitle: pending.title,
      photoFeatures: pending.features,
      emotion: {
        va: result.photoVA,
        primary: result.primaryLabel,
        secondary: result.secondaryLabel,
        isMixed: result.isMixed,
        displayLabel,
      },
      songs: allSongs.slice(0, 3),
      text: text || `${pending.title} · ${displayLabel}`,
      location: pending.location,
    });
    setSaved(true);
    setTimeout(() => navigate(`/journal/${id}`), 600);
  };

  return (
    <div className={styles.page}>
      {/* —— 照片 + 歌曲轮盘 —— */}
      <section className={styles.wheelSection}>
        <SongWheel
          songs={allSongs}
          photoUrl={pending.previewUrl}
          photoTitle={pending.title}
          currentSongId={currentSongId}
          isPlaying={isPlaying}
          onSelect={(song) => playTrack(song, allSongs)}
        />

        {pending.location && (
          <p className={styles.locationLine}>@ {pending.location}</p>
        )}
      </section>

      {/* —— 写感想 + 保存 —— */}
      <section className="section">
        <h2>写一句感想</h2>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="今天的情绪,一句话记下来…"
          rows={3}
        />
      </section>

      <div className={styles.actions}>
        <Link to="/" className="btn btn-ghost">
          再拍一张
        </Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={saved}>
          {saved ? '已保存 ✓' : '保存为日记'}
        </button>
      </div>
    </div>
  );
}
