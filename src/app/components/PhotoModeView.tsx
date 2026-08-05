import { useEffect, useState, useRef, type PointerEvent } from 'react';
import type { Song } from '@algorithm/index';
import { usePlayerStore } from '../stores/playerStore';
import { PhotoPaper } from './PhotoPaper';
import { JournalSaveSheet } from './JournalSaveSheet';
import styles from './PhotoModeView.module.css';

interface PhotoModeViewProps {
  /** 待分析照片预览 URL (pending.previewUrl) */
  previewUrl: string;
  /** 照片标题 (pending.title) */
  title: string;
  /** 可选位置 (pending.location) */
  location?: string;
  /** 推荐列表 3-5 首 (allSongs) */
  songs: Song[];
  /** 格式化日期, 如 "2026.08.05" */
  dateLabel: string;
  /** 情绪标签文字, 用于默认感想填充 */
  emotionLabel: string;
  /** 轻点歌名胶囊 → 进状态三 */
  onEnterPlayer: () => void;
  /** 下滑 → 返回相机 (父级负责 clear + navigate) */
  onSwipeDown: () => void;
  /** 保存日记 (父级负责构造 journal + addJournal + navigate) */
  onSaveJournal: (text: string) => void;
}

/**
 * PhotoModeView — 状态二: 全屏相纸模式
 *
 * 中央 CCD 相纸 + 顶部毛玻璃胶囊(歌名/小唱片/音量条)
 * + 圆点指示器 + 两侧淡箭头 + 右上角保存按钮。
 * 左右滑动切歌(不换照片), 下滑返回相机。
 */
export function PhotoModeView({
  previewUrl,
  title,
  location,
  songs,
  dateLabel,
  emotionLabel,
  onEnterPlayer,
  onSwipeDown,
  onSaveJournal,
}: PhotoModeViewProps) {
  // 订阅 playerStore
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);

  // 进入时自动播放第一首
  useEffect(() => {
    const first = songs[0];
    if (first) {
      playTrack(first!, songs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当前曲目: 优先取 queue[currentIndex], 兜底 songs[0]
  const currentSong = queue[currentIndex] ?? songs[0];

  // 圆点指示器当前索引 (queue 与 songs 一致时直接用 currentIndex)
  const activeDotIndex =
    currentIndex >= 0 && currentIndex < songs.length ? currentIndex : 0;

  // 保存日记浮层
  const [showSaveSheet, setShowSaveSheet] = useState(false);

  // —— 滑动手势: 记录 pointerdown 起点 ——
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: PointerEvent) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: PointerEvent) => {
    const down = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    // 水平优先: 左右滑动切歌
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) prev();
      else next();
      return;
    }
    // 下滑: 返回相机
    if (dy > 60 && Math.abs(dy) > Math.abs(dx)) {
      onSwipeDown();
    }
  };

  // 阻止胶囊/按钮上的指针事件冒泡到根容器 (避免误触发滑动)
  const stopPointer = (e: PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={styles.page}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* CCD 相纸 (竖向居中) */}
      <div className={styles.paperWrap}>
        <div className={styles.paper}>
          <PhotoPaper
            src={previewUrl}
            dateLabel={dateLabel}
            location={location}
          />
        </div>
      </div>

      {/* 两侧淡 ‹ › 箭头提示 (列表长度 > 1 时) */}
      {songs.length > 1 && (
        <>
          <span
            className={`${styles.arrow} ${styles.arrowLeft}`}
            aria-hidden="true"
          >
            ‹
          </span>
          <span
            className={`${styles.arrow} ${styles.arrowRight}`}
            aria-hidden="true"
          >
            ›
          </span>
        </>
      )}

      {/* 顶部毛玻璃胶囊 (点击进入播放器) */}
      <div
        className={styles.capsule}
        role="button"
        tabIndex={0}
        onClick={onEnterPlayer}
        onPointerDown={stopPointer}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEnterPlayer();
          }
        }}
        aria-label={`进入播放器: ${currentSong?.title ?? ''}`}
      >
        {/* 左侧迷你小唱片 (播放时旋转) */}
        <div
          className={`${styles.discIcon} ${
            isPlaying ? styles.discSpinning : ''
          }`}
          aria-hidden="true"
        >
          <span className={styles.discCenter} />
        </div>

        {/* 中间歌名・歌手 */}
        <div className={styles.songMeta}>
          <span className={styles.songTitle}>
            {currentSong?.title ?? '—'}
          </span>
          <span className={styles.songArtist}>
            {currentSong?.artist ?? '—'}
          </span>
        </div>

        {/* 右侧跳动音量条 (暂停时静止) */}
        <div className={styles.volBars} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`${styles.volBar} ${
                isPlaying ? '' : styles.volPaused
              }`}
            />
          ))}
        </div>
      </div>

      {/* 圆点指示器 (列表长度 > 1 时) */}
      {songs.length > 1 && (
        <div className={styles.dots} aria-hidden="true">
          {songs.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${
                i === activeDotIndex ? styles.dotActive : ''
              }`}
            />
          ))}
        </div>
      )}

      {/* 右上角小图标按钮 → 打开保存日记浮层 */}
      <button
        type="button"
        className={styles.saveBtn}
        onClick={() => setShowSaveSheet(true)}
        onPointerDown={stopPointer}
        aria-label="保存为日记"
      >
        <svg
          className={styles.saveIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* 笔记本/日记本图标 */}
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M9 8h7M9 12h7M9 16h4" />
        </svg>
      </button>

      {/* 底部一行等宽小字提示 */}
      <div className={styles.hint}>轻点歌名 进入播放器・下滑返回相机</div>

      {/* 保存日记浮层 */}
      <JournalSaveSheet
        show={showSaveSheet}
        onClose={() => setShowSaveSheet(false)}
        onSave={(text) => {
          onSaveJournal(text);
          setShowSaveSheet(false);
        }}
        defaultText={`${title} · ${emotionLabel}`}
        pendingTitle={title}
        emotionLabel={emotionLabel}
      />
    </div>
  );
}
