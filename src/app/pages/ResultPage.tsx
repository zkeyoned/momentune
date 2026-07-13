import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PhotoFeatures } from '@algorithm/index';
import { useAnalysisStore } from '../stores/analysisStore';
import { useUserStore } from '../stores/userStore';
import { useJournalStore } from '../stores/journalStore';
import { usePlayerStore } from '../stores/playerStore';
import { useThemeStore } from '../stores/themeStore';
import { buildEmotionDisplayLabel } from '../services/mockApi';
import { getEmotionDisplay } from '../config/emotionDisplay';
import { SongWheel } from '../components/SongWheel';
import { MusicPlayer } from '../components/MusicPlayer';
import styles from './ResultPage.module.css';

/**
 * 根据照片色相和亮度计算氛围色 CSS 变量,注入页面根容器。
 * - --ambient-1/2: 氛围色(径向渐变背景用),亮度跟随当前主题
 * - --ambient-deep: 深色锚点(底部渐变用)
 * - 覆盖 --accent/--accent2 为照片色调,让播放按钮/进度条/情绪标签跟随照片
 * - 银盐(日间):氛围色明亮,accent 覆盖为深色(暗字亮底)
 * - 暗房(夜间):氛围色压暗,accent 覆盖为亮色(亮字暗底,保持对比度)
 * - 低亮度照片(luminance < 0.4)时再降 lightness,夜景更沉
 * - features 缺失或 hue 异常时返回空对象,CSS 回退到 --bg + --glow
 */
function computeAmbientVars(features: PhotoFeatures | undefined, isDarkTheme: boolean): CSSProperties {
  if (!features?.hue || typeof features.hue.hue !== 'number') return {};
  if (!features?.luminance || typeof features.luminance.value !== 'number') return {};

  const H = features.hue.hue;
  const isDarkPhoto = features.luminance.value < 0.4;

  if (isDarkTheme) {
    // 暗房主题:氛围色压暗,accent 用亮色保证暗底上的对比度
    const l1 = isDarkPhoto ? 24 : 34;
    const l2 = isDarkPhoto ? 18 : 26;
    return {
      '--ambient-1': `hsl(${H}, 35%, ${l1}%)`,
      '--ambient-2': `hsl(${(H + 25) % 360}, 40%, ${l2}%)`,
      '--ambient-deep': `hsl(${H}, 45%, 10%)`,
      '--accent': `hsl(${H}, 55%, 62%)`,
      '--accent2': `hsl(${H}, 50%, 52%)`,
    } as CSSProperties;
  }

  // 银盐主题:氛围色明亮,accent 覆盖为深色
  const l1 = isDarkPhoto ? 73 : 88;
  const l2 = isDarkPhoto ? 63 : 78;
  return {
    '--ambient-1': `hsl(${H}, 30%, ${l1}%)`,
    '--ambient-2': `hsl(${(H + 25) % 360}, 35%, ${l2}%)`,
    '--ambient-deep': `hsl(${H}, 40%, 22%)`,
    '--accent': `hsl(${H}, 40%, 22%)`,
    '--accent2': `hsl(${H}, 45%, 16%)`,
  } as CSSProperties;
}

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
  const currentSongId = usePlayerStore((s) =>
    s.currentIndex >= 0 ? s.queue[s.currentIndex]?.songId : undefined,
  );
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const resolvedTheme = useThemeStore((s) => s.resolved);
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
    <div className={styles.page} style={computeAmbientVars(pending.features, resolvedTheme === 'dark')}>
      {/* —— 拍立得照片(居中放大 + 轻微旋转 + 拍摄日期) —— */}
      <section className={styles.photoSection}>
        <div className={styles.polaroid}>
          <img
            src={pending.previewUrl}
            alt={pending.title}
            className={styles.polaroidImg}
          />
        </div>
        <div className={styles.photoMeta}>
          <span className={styles.photoDate}>{fmtShootDate()}</span>
          {pending.location && (
            <span className={styles.photoLoc}>@ {pending.location}</span>
          )}
        </div>
      </section>

      {/* —— 情绪一句话 —— */}
      <p className={styles.moodLine}>
        这一刻的心情，像是 <span className={styles.moodTag}>{primaryEmotion.zh}</span>
      </p>

      {/* —— 封面胶卷(横向滚动) —— */}
      <section className={styles.wheelSection}>
        <SongWheel
          songs={allSongs}
          currentSongId={currentSongId}
          isPlaying={isPlaying}
          onSelect={(song) => playTrack(song, allSongs)}
        />
      </section>

      {/* —— 内嵌毛玻璃播放器 —— */}
      <section className={styles.playerSection}>
        <div className={styles.glassCard}>
          <MusicPlayer inline />
        </div>
      </section>

      {/* —— 感想输入区(毛玻璃卡片内) —— */}
      <section className={styles.inputSection}>
        <div className={styles.glassCard}>
          <label className={styles.inputLabel}>写一句感想</label>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天的情绪，一句话记下来…"
            rows={2}
          />
        </div>
      </section>

      {/* —— 底部按钮(同一行两端对齐) —— */}
      <div className={styles.actions}>
        <Link to="/" className={`btn btn-ghost ${styles.actionBtn}`}>
          再拍一张
        </Link>
        <button
          className={`btn btn-primary ${styles.actionBtn}`}
          onClick={handleSave}
          disabled={saved}
        >
          {saved ? '已保存 ✓' : '保存为日记'}
        </button>
      </div>
    </div>
  );
}
