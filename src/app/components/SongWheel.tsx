import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { Song } from '@algorithm/index';
import { SONG_PREVIEW_URLS } from '../services/songPreviewUrls';
import { getPreview, getCoverUrl } from '../services/runtimePreviews';
import { usePlayerStore } from '../stores/playerStore';
import styles from './SongWheel.module.css';

function coverInitial(title: string): string {
  return title.trim().charAt(0) || '♪';
}

/** 读取 --dur-hov(0.2s)并转为毫秒,用于音量淡入淡出时长 */
function getFadeDurationMs(): number {
  if (typeof document === 'undefined') return 0;
  const val = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-hov'));
  return (isNaN(val) ? 0 : val) * 1000;
}

interface SongWheelProps {
  /** 推荐歌曲列表 */
  songs: Song[];
  /** 当前播放歌曲 id(决定哪张封面高亮) */
  currentSongId?: string;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 选中某首歌(点击/吸附触发) */
  onSelect: (song: Song, index: number) => void;
}

/**
 * 居中放大封面轮播选歌器。
 *
 * 设计:
 *  - 中间那张大且清晰(scale 1.0),左右各露一点、缩小变淡
 *  - 基于 transform: translateX 控制,不用原生 scroll-snap
 *  - 拖动时连续缩放/透明度变化(浮点 centerFloat)
 *  - 松手吸附到最近 index;边缘有 0.3 阻力回弹
 *  - 切歌时若正在播放,先用 setVolume 线性淡出→切歌→淡入
 *  - 底部圆点指示器
 *  - 封面图优先用 SONG_PREVIEW_URLS[songId].coverUrl,加载失败回退渐变色 + 首字母
 */
export function SongWheel({
  songs,
  currentSongId,
  isPlaying,
  onSelect,
}: SongWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fadeRafRef = useRef<number | null>(null);

  // centerIndex: 当前居中的整数 index(用于渲染高亮 + 圆点)
  // translateX: 轮播轨道的位移(负值),控制哪张卡居中
  // itemStep: 相邻封面中心间距(封面宽 + gap),用于位移计算
  const [centerIndex, setCenterIndex] = useState(() => {
    const idx = songs.findIndex((s) => s.songId === currentSongId);
    return idx >= 0 ? idx : 0;
  });
  const [translateX, setTranslateX] = useState(0);
  const [itemStep, setItemStep] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // 记录封面图加载失败的 songId(回退到渐变色 + 首字母)
  const [coverErrors, setCoverErrors] = useState<Set<string>>(new Set());

  const dragStartRef = useRef({ x: 0, translateX: 0 });

  // —— 测量 itemStep + 初始居中 ——
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || songs.length === 0) return;
    // 测量第一张封面宽 + gap
    const firstCard = track.querySelector('[data-card="0"]') as HTMLDivElement | null;
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth;
    const gap = parseFloat(getComputedStyle(track).gap || '0') || 0;
    const step = cardWidth + gap;
    setItemStep(step);
    // 初始居中到 currentSongId 对应的那首
    const idx = songs.findIndex((s) => s.songId === currentSongId);
    const initIndex = idx >= 0 ? idx : 0;
    setCenterIndex(initIndex);
    setTranslateX(-(initIndex * step));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— 外部 currentSongId 变化时同步居中(非拖动中) ——
  useEffect(() => {
    if (isDragging || songs.length === 0 || itemStep === 0) return;
    const idx = songs.findIndex((s) => s.songId === currentSongId);
    const newIndex = idx >= 0 ? idx : 0;
    if (newIndex !== centerIndex) {
      setCenterIndex(newIndex);
      setTranslateX(-(newIndex * itemStep));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongId]);

  // —— 清理音量淡入淡出 raf ——
  useEffect(() => {
    return () => {
      if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
    };
  }, []);

  // —— 音量线性渐变(requestAnimationFrame) ——
  const fadeVolume = (from: number, to: number, durationMs: number, onComplete: () => void) => {
    const setVolume = usePlayerStore.getState().setVolume;
    if (durationMs <= 0) {
      setVolume(to);
      onComplete();
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const current = from + (to - from) * progress;
      setVolume(current);
      if (progress < 1) {
        fadeRafRef.current = requestAnimationFrame(animate);
      } else {
        fadeRafRef.current = null;
        onComplete();
      }
    };
    if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
    fadeRafRef.current = requestAnimationFrame(animate);
  };

  // —— 切歌(含音量淡入淡出) ——
  const changeSong = (newIndex: number) => {
    const song = songs[newIndex];
    if (!song) return;
    setCenterIndex(newIndex);

    if (song.songId === currentSongId) return; // 同一首,仅居中不切歌

    if (isPlaying) {
      // 正在播放:先淡出音量到 0,切歌,再淡入回原值
      const originalVolume = usePlayerStore.getState().volume;
      const dur = getFadeDurationMs();
      fadeVolume(originalVolume, 0, dur, () => {
        onSelect(song, newIndex);
        // 下一帧再淡入,确保 store 已切歌
        requestAnimationFrame(() => {
          fadeVolume(0, originalVolume, dur, () => {});
        });
      });
    } else {
      // 不在播放:直接切歌
      onSelect(song, newIndex);
    }
  };

  // —— 拖动处理 ——
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; // 鼠标仅左键
    if (songs.length <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, translateX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || itemStep === 0) return;
    const dx = e.clientX - dragStartRef.current.x;
    let next = dragStartRef.current.translateX + dx;

    // 边缘阻力:第一张继续往右拖(translateX > 0)/最后一张继续往左拖时乘 0.3
    const minTranslateX = -((songs.length - 1) * itemStep);
    if (next > 0) {
      next = next * 0.3;
    } else if (next < minTranslateX) {
      next = minTranslateX + (next - minTranslateX) * 0.3;
    }
    setTranslateX(next);
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (itemStep === 0) return;

    // 计算最近 index 并吸附
    const floatIndex = -translateX / itemStep;
    const nearestIndex = Math.round(floatIndex);
    const clampedIndex = Math.max(0, Math.min(songs.length - 1, nearestIndex));

    setTranslateX(-(clampedIndex * itemStep));
    changeSong(clampedIndex);
  };

  // —— 点击封面:居中并切歌 ——
  const handleCardClick = (i: number) => {
    if (isDragging) return; // 拖动中不触发点击
    if (i === centerIndex) return; // 已居中,不操作
    setTranslateX(-(i * itemStep));
    changeSong(i);
  };

  if (songs.length === 0) return null;

  // 浮点 center(拖动时连续变化,用于 scale/opacity)
  const centerFloat = itemStep > 0 ? -translateX / itemStep : centerIndex;

  return (
    <div className={styles.carousel}>
      <div
        ref={containerRef}
        className={styles.carouselViewport}
      >
        <div
          ref={trackRef}
          className={`${styles.carouselTrack} ${isDragging ? styles.dragging : ''}`}
          style={{ transform: `translateX(${translateX}px)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {songs.map((song, i) => {
            const preview = SONG_PREVIEW_URLS[song.songId] ?? getPreview(song.songId);
            const coverUrl = preview?.coverUrl ?? getCoverUrl(song.songId);
            const coverFailed = coverErrors.has(song.songId);
            const useCoverImg = !!coverUrl && !coverFailed;
            const isCurrent = currentSongId === song.songId;

            // 连续缩放/透明度:d = i - centerFloat
            const d = i - centerFloat;
            const scale = Math.max(0.5, 1 - Math.abs(d) * 0.14);
            const opacity = Math.max(0, 1 - Math.abs(d) * 0.35);

            return (
              <div
                key={song.songId}
                data-card={i}
                className={`${styles.coverCard} ${i === centerIndex ? styles.active : ''}`}
                style={{
                  transform: `scale(${scale})`,
                  opacity,
                }}
                onClick={() => handleCardClick(i)}
                role="button"
                tabIndex={0}
                aria-label={`播放 ${song.title} - ${song.artist}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(i);
                  }
                }}
              >
                <div
                  className={styles.art}
                  style={
                    useCoverImg
                      ? undefined
                      : { backgroundImage: 'var(--cover-placeholder)' }
                  }
                  aria-hidden
                >
                  {useCoverImg ? (
                    <img
                      src={coverUrl}
                      alt=""
                      className={styles.artImg}
                      onError={() => {
                        setCoverErrors((prev) => {
                          const next = new Set(prev);
                          next.add(song.songId);
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <span className={styles.artInitial}>{coverInitial(song.title)}</span>
                  )}
                </div>
                {/* 中心卡且正在播放:小波形角标 */}
                {i === centerIndex && isCurrent && isPlaying && (
                  <span className={styles.playingDot} aria-hidden>
                    <span className={styles.bar} />
                    <span className={styles.bar} />
                    <span className={styles.bar} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部圆点指示器(不可点击) */}
      <div className={styles.dots} aria-hidden>
        {songs.map((_, i) => (
          <span
            key={i}
            className={`${styles.dot} ${i === centerIndex ? styles.dotActive : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
