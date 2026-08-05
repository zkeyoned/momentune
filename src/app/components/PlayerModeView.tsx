import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Song } from '@algorithm/index';
import { usePlayerStore } from '../stores/playerStore';
import { SONG_PREVIEW_URLS } from '../services/songPreviewUrls';
import { getPreview, getCoverUrl } from '../services/runtimePreviews';
import { VinylRecord } from './VinylRecord';
import { parseLrc, findCurrentIndex, type LyricLine } from '../utils/lyrics';
import styles from './PlayerModeView.module.css';

/**
 * PlayerModeView — 全屏播放器视图 (状态三)
 *
 * 强虚化照片背景 + 黑胶唱片 + 歌词高亮 + 拉丝金属控制钮。
 * 左右滑动切换上/下一首, 左上角 ‹ 退回照片模式。
 */

interface PlayerModeViewProps {
  /** pending.previewUrl, 用作强虚化背景 + 唱片封面 fallback */
  photoUrl: string;
  /** 左上角 ‹ 退回照片模式 */
  onExit: () => void;
}

/** 时间格式化: 复制自 MusicPlayer/LyricsPanel 的 fmtTime */
function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// —— SVG 图标 (fill=currentColor, 深灰刻蚀感) ——
const PrevIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="20" height="20" aria-hidden>
    <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="26" height="26" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="26" height="26" aria-hidden>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
const NextIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="20" height="20" aria-hidden>
    <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
  </svg>
);

export function PlayerModeView({ photoUrl, onExit }: PlayerModeViewProps) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);

  const currentSong: Song | null =
    currentIndex >= 0 && currentIndex < queue.length ? (queue[currentIndex] ?? null) : null;

  // 歌词状态
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const lastSongIdRef = useRef<string | null>(null);

  // 滑动换歌: 记录 pointerdown 起始位置
  const swipeDownRef = useRef<{ x: number; y: number } | null>(null);
  // 进度条拖拽
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!currentSong) return;
    if (lastSongIdRef.current === currentSong.songId) return;
    lastSongIdRef.current = currentSong.songId;
    setLines(null);
    fetch(`/lyrics/${currentSong.songId}.lrc`)
      .then((res) => {
        if (!res.ok) throw new Error('404');
        return res.text();
      })
      .then((text) => {
        const parsed = parseLrc(text);
        setLines(parsed.length > 0 ? parsed : null);
      })
      .catch(() => setLines(null));
  }, [currentSong?.songId]);

  if (!currentSong) return null;

  const preview = SONG_PREVIEW_URLS[currentSong.songId] ?? getPreview(currentSong.songId);
  const currentCoverUrl = preview?.coverUrl ?? getCoverUrl(currentSong.songId);

  const currentLineIdx =
    lines && lines.length > 0 ? findCurrentIndex(lines, currentTime) : -1;
  const currentLine = currentLineIdx >= 0 ? lines![currentLineIdx] : null;
  const nextLine =
    currentLineIdx >= 0 && currentLineIdx + 1 < lines!.length
      ? lines![currentLineIdx + 1]
      : null;

  // —— 根容器滑动换歌 ——
  const handleRootPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipeDownRef.current = { x: e.clientX, y: e.clientY };
  };
  const handleRootPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const down = swipeDownRef.current;
    swipeDownRef.current = null;
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) prev();
      else next();
    }
  };

  // —— 进度条拖拽 (stopPropagation 避免触发换歌) ——
  const seekFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(p);
  };
  const handleTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    draggingRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture 在部分环境可能抛错, 忽略 */
    }
    seekFromEvent(e.clientX);
  };
  const handleTrackPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    seekFromEvent(e.clientX);
  };
  const handleTrackPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
  };

  // 退出按钮: 阻止 pointer 冒泡, 避免影响滑动判定
  const handleExitPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <div
      className={styles.root}
      onPointerDown={handleRootPointerDown}
      onPointerUp={handleRootPointerUp}
    >
      {/* 背景层 */}
      <img src={photoUrl} className={styles.bg} alt="" />
      <div className={styles.bgOverlay} />

      {/* 左上角退出 */}
      <button
        type="button"
        className={styles.exitBtn}
        onClick={onExit}
        onPointerDown={handleExitPointerDown}
        aria-label="返回照片模式"
      >
        <span className={styles.exitIcon}>‹</span>
      </button>

      {/* 内容层 */}
      <div className={styles.content}>
        <VinylRecord
          coverUrl={currentCoverUrl}
          fallbackPhotoUrl={photoUrl}
          isPlaying={isPlaying}
          size={280}
        />

        <div className={styles.songInfo}>
          <h2 className={styles.songTitle}>{currentSong.title}</h2>
          <span className={styles.songArtist}>{currentSong.artist}</span>
        </div>

        {lines && lines.length > 0 && (
          <div className={styles.lyrics}>
            <p className={styles.lyricCurrent}>{currentLine?.text ?? ''}</p>
            <p className={styles.lyricNext}>{nextLine?.text ?? ''}</p>
          </div>
        )}

        <div className={styles.progressWrap}>
          <span className={styles.time}>{fmtTime(currentTime)}</span>
          <div
            ref={trackRef}
            className={styles.progressTrack}
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={handleTrackPointerUp}
            onPointerCancel={handleTrackPointerUp}
          >
            <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
            <div className={styles.progressHandle} style={{ left: `${progress * 100}%` }} />
          </div>
          <span className={styles.time}>{fmtTime(duration)}</span>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.metalBtn} ${styles.metalBtnSmall}`}
            onClick={prev}
            aria-label="上一首"
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            className={`${styles.metalBtn} ${styles.metalBtnLarge}`}
            onClick={toggle}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className={`${styles.metalBtn} ${styles.metalBtnSmall}`}
            onClick={next}
            aria-label="下一首"
          >
            <NextIcon />
          </button>
        </div>
      </div>

      {/* 底部小字提示 */}
      <div className={styles.hint}>滑动切换上一首 / 下一首</div>
    </div>
  );
}
