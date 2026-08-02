import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Song } from '@algorithm/index';
import { useAnalysisStore } from '../stores/analysisStore';
import { useUserStore } from '../stores/userStore';
import { useJournalStore } from '../stores/journalStore';
import { usePlayerStore } from '../stores/playerStore';
import { buildEmotionDisplayLabel } from '../services/mockApi';
import { getEmotionDisplay } from '../config/emotionDisplay';
import { SongWheel } from '../components/SongWheel';
import styles from './ResultPage.module.css';

/** 格式化拍摄日期:2026 · 07 · 13 形式(参考设计稿) */
function fmtShootDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y} · ${m} · ${day}`;
}

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
  const toggle = usePlayerStore((s) => s.toggle);
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
        <div className={styles.lcdShell}>
          <div className={`${styles.screen} ${styles.centerScreen}`}>
            <div className="section center">
              <p className="muted">还没有选择照片</p>
              <Link to="/" className="btn btn-primary mt-md">
                去拍照
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingView previewUrl={pending.previewUrl} title={pending.title} loading={loading} />;
  }

  if (error || !result) {
    return (
      <div className={styles.page}>
        <div className={styles.lcdShell}>
          <div className={`${styles.screen} ${styles.centerScreen}`}>
            <div className="section center">
              <p className="muted">分析失败:{error ?? '未知错误'}</p>
              <Link to="/" className="btn btn-ghost mt-md">
                返回重试
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayLabel = buildEmotionDisplayLabel(result.primaryLabel, result.secondaryLabel);
  const primaryEmotion = getEmotionDisplay(result.primaryLabel);
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
    <ResultSuccessView
      pending={pending}
      primaryEmotionZh={primaryEmotion.zh}
      allSongs={allSongs}
      currentSongId={currentSongId}
      isPlaying={isPlaying}
      text={text}
      setText={setText}
      saved={saved}
      onPlayTrack={playTrack}
      onToggle={toggle}
      onSave={handleSave}
    />
  );
}

// ============================================================
// Loading 视图:全屏照片背景 + 渐变遮罩 + 三步进度 + 底部进度条
// 步骤推进纯前端模拟,不碰 analysisStore
// ============================================================

const LOADING_STEPS = ['读取光线与色调', '判断这一刻的情绪', '从曲库里挑歌'];

interface LoadingViewProps {
  previewUrl: string;
  title: string;
  loading: boolean;
}

function LoadingView({ previewUrl, title, loading }: LoadingViewProps) {
  // step: 0=第一步进行中, 1=第一步完成, 2=第二步完成(第三步进行中), 3=全部完成
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1200);
    const t2 = setTimeout(() => setStep(2), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // 分析结束(loading=false)时,把剩余步骤一次性全部完成
  useEffect(() => {
    if (!loading) setStep(3);
  }, [loading]);

  const progress = (step / 3) * 100;

  return (
    <div className={styles.loadingPage}>
      <img src={previewUrl} alt={title} className={styles.loadingBg} />
      <div className={styles.loadingOverlay} />

      <div className={styles.loadingContent}>
        <h2 className={styles.loadingTitle}>AI 正在感受这一刻…</h2>
        <ul className={styles.stepList}>
          {LOADING_STEPS.map((label, i) => {
            const idx = i + 1;
            const done = step >= idx;
            const doing = !done && step === idx - 1;
            return (
              <li key={label} className={styles.stepItem}>
                <span
                  className={[
                    styles.stepDot,
                    done ? styles.stepDone : '',
                    doing ? styles.stepDoing : '',
                  ].join(' ')}
                  aria-hidden
                >
                  {done && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="11"
                      height="11"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className={styles.stepLabel}>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.progressTrack} aria-hidden>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ============================================================
// 成功态视图:照片主角 + SongWheel + 信息行 + 感想 + 两按钮
// (普通 flex column 滚动布局,无上拉 sheet)
// ============================================================

interface ResultSuccessViewProps {
  pending: { previewUrl: string; title: string; location?: string };
  primaryEmotionZh: string;
  allSongs: Song[];
  currentSongId: string | undefined;
  isPlaying: boolean;
  text: string;
  setText: (v: string) => void;
  saved: boolean;
  onPlayTrack: (song: Song, queue?: Song[]) => void;
  onToggle: () => void;
  onSave: () => void;
}

function ResultSuccessView({
  pending,
  primaryEmotionZh,
  allSongs,
  currentSongId,
  isPlaying,
  text,
  setText,
  saved,
  onPlayTrack,
  onToggle,
  onSave,
}: ResultSuccessViewProps) {
  const currentSong = allSongs.find((s) => s.songId === currentSongId) ?? allSongs[0];

  const handlePlayClick = () => {
    if (currentSongId === undefined) {
      if (currentSong) onPlayTrack(currentSong, allSongs);
    } else {
      onToggle();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.lcdShell}>
        <div className={styles.screen}>
          {/* —— 上半:照片主角 —— */}
          <section className={styles.photoSection}>
            <img src={pending.previewUrl} alt={pending.title} className={styles.heroImg} />
            <div className={styles.photoCaption}>
              <span className={styles.photoDate}>{fmtShootDate()}</span>
              {pending.location && <span className={styles.photoLoc}>· {pending.location}</span>}
            </div>
          </section>

          {/* —— 下半:轮播 + 信息 + 输入 + 按钮 —— */}
          <section className={styles.bottomSection}>
            <SongWheel
              songs={allSongs}
              currentSongId={currentSongId}
              isPlaying={isPlaying}
              onSelect={(song) => onPlayTrack(song, allSongs)}
            />

            {currentSong && (
              <div
                className={styles.songInfo}
                key={currentSongId}
                role="button"
                tabIndex={0}
                aria-label={isPlaying ? '暂停' : '播放'}
                onClick={handlePlayClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePlayClick();
                  }
                }}
              >
                <span className={styles.songTitle}>{currentSong.title}</span>
                <span className={styles.songArtist}>{currentSong.artist}</span>
                <span className={styles.moodTag}>{primaryEmotionZh}</span>
              </div>
            )}

            <textarea
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="今天的情绪，一句话记下来…"
              rows={2}
            />

            <div className={styles.actions}>
              <Link to="/" className={`btn btn-ghost ${styles.actionBtn}`}>
                再拍一张
              </Link>
              <button
                className={`btn btn-primary ${styles.actionBtn}`}
                onClick={onSave}
                disabled={saved}
              >
                {saved ? '已保存 ✓' : '保存为日记'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
