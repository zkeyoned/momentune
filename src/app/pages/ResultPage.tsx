import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../stores/analysisStore';
import { useUserStore } from '../stores/userStore';
import { useJournalStore } from '../stores/journalStore';
import { buildEmotionDisplayLabel } from '../services/mockApi';
import { PhotoModeView } from '../components/PhotoModeView';
import { PlayerModeView } from '../components/PlayerModeView';
import styles from './ResultPage.module.css';

/** 格式化拍摄日期:2026.08.05(与 HomePage 日期戳同格式) */
function fmtShootDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

type Mode = 'photo' | 'player';

export function ResultPage() {
  const navigate = useNavigate();
  const pending = useAnalysisStore((s) => s.pending);
  const result = useAnalysisStore((s) => s.result);
  const loading = useAnalysisStore((s) => s.loading);
  const error = useAnalysisStore((s) => s.error);
  const runAnalysis = useAnalysisStore((s) => s.runAnalysis);
  const clearAnalysis = useAnalysisStore((s) => s.clear);
  const userPref = useUserStore((s) => s.userPref);
  const addJournal = useJournalStore((s) => s.add);

  // 状态二/三切换:photo 默认;点歌名胶囊切 player;左上角 ‹ 退回 photo
  const [mode, setMode] = useState<Mode>('photo');

  // 兼容老路径:直接访问 /result 时若 pending 已设但分析未触发则补触发
  // HomePage 改造后会主动触发,此处分支会被覆盖,先保留避免破坏
  useEffect(() => {
    if (pending && !result && !loading && !error) {
      runAnalysis(userPref);
    }
  }, [pending, result, loading, error, runAnalysis, userPref]);

  // —— 空态:无待分析照片 ——
  if (!pending) {
    return (
      <div className={styles.page}>
        <div className={styles.placeholder}>
          <p>还没有选择照片</p>
          <Link to="/" className="btn btn-primary mt-md">
            去拍照
          </Link>
        </div>
      </div>
    );
  }

  // —— Loading 占位(识别已在 HomePage 完成,正常路径不会到这里) ——
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.placeholder}>识别中…</div>
      </div>
    );
  }

  // —— 错误态 ——
  if (error || !result) {
    return (
      <div className={styles.page}>
        <div className={styles.placeholder}>
          <p>分析失败:{error ?? '未知错误'}</p>
          <Link to="/" className="btn btn-ghost mt-md">
            返回重试
          </Link>
        </div>
      </div>
    );
  }

  // —— 成功态:状态二(照片模式) + 状态三(播放器模式) ——
  const displayLabel = buildEmotionDisplayLabel(result.primaryLabel, result.secondaryLabel);
  const allSongs = [
    ...result.recommendation.coreTracks.map((t) => t.song),
    ...result.recommendation.extendedTracks.map((t) => t.song),
  ];

  // 下滑返回相机:清空 pending + 跳 /
  const handleSwipeDown = () => {
    clearAnalysis();
    navigate('/');
  };

  // 保存日记:由 PhotoModeView 内的 JournalSaveSheet 收集 text 后回调
  const handleSaveJournal = (text: string) => {
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
    navigate(`/journal/${id}`);
  };

  return (
    <div className={styles.page}>
      <PhotoModeView
        previewUrl={pending.previewUrl}
        title={pending.title}
        location={pending.location}
        songs={allSongs}
        dateLabel={fmtShootDate()}
        emotionLabel={displayLabel}
        onEnterPlayer={() => setMode('player')}
        onSwipeDown={handleSwipeDown}
        onSaveJournal={handleSaveJournal}
      />
      {mode === 'player' && (
        <PlayerModeView
          photoUrl={pending.previewUrl}
          onExit={() => setMode('photo')}
        />
      )}
    </div>
  );
}
