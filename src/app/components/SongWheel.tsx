import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Song } from '@algorithm/index';
import { findNearestEmotionLabel } from '@algorithm/index';
import { getEmotionDisplay } from '../config/emotionDisplay';
import styles from './SongWheel.module.css';

/** 由歌曲 V-A 生成暖色域封面 overlay(叠在 picsum 底图上,营造情绪色调)
 *  暖色域 hue 15-55(橙红到金黄),不再用全色域 HSL,统一胶片暖调 */
function coverOverlay(song: Song): string {
  const { v, a } = song.va;
  const hue = Math.round(15 + v * 40);
  const sat = 42 + a * 28;
  const alpha1 = 0.58 + a * 0.18;
  const alpha2 = 0.78 + a * 0.14;
  return `linear-gradient(135deg, hsla(${hue}, ${sat}%, 46%, ${alpha1}) 0%, hsla(${hue + 22}, ${sat}%, 30%, ${alpha2}) 100%)`;
}

/** 稳定封面底图(基于 songId 的 picsum 占位,真实图片质感) */
function coverImage(song: Song): string {
  return `https://picsum.photos/seed/${encodeURIComponent(song.songId)}/200/200`;
}

function coverInitial(title: string): string {
  return title.trim().charAt(0) || '♪';
}

interface SongWheelProps {
  /** 推荐歌曲列表 */
  songs: Song[];
  /** 照片预览 URL */
  photoUrl: string;
  /** 照片标题(显示在照片左下角 chip) */
  photoTitle: string;
  /** 当前播放歌曲 id */
  currentSongId?: string;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 选中某首歌(点击封面) */
  onSelect: (song: Song, index: number) => void;
}

export function SongWheel({
  songs,
  photoUrl,
  photoTitle,
  currentSongId,
  isPlaying,
  onSelect,
}: SongWheelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollRef = useRef(0);

  // 默认居中第 4 首(index 3,核心推荐第 4 首)
  const defaultIndex = Math.min(3, Math.max(0, songs.length - 1));
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [transforms, setTransforms] = useState(
    songs.map(() => ({ scale: 1, opacity: 1 })),
  );

  const update = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vpRect = viewport.getBoundingClientRect();
    const centerY = vpRect.top + vpRect.height / 2;

    let closestIndex = 0;
    let closestDist = Infinity;

    const next = itemRefs.current.map((el, i) => {
      if (!el) return { scale: 1, opacity: 1 };
      const r = el.getBoundingClientRect();
      const dist = Math.abs(r.top + r.height / 2 - centerY);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
      return {
        scale: Math.max(0.62, 1.26 - dist / 175),
        opacity: Math.max(0.25, 1 - dist / 190),
      };
    });

    setTransforms(next);
    setActiveIndex(closestIndex);
  };

  // 初始把默认推荐曲目滚到居中
  useEffect(() => {
    const viewport = viewportRef.current;
    const target = itemRefs.current[defaultIndex];
    if (viewport && target) {
      viewport.scrollTop =
        target.offsetTop - (viewport.clientHeight / 2 - target.offsetHeight / 2);
    }
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !viewportRef.current) return;
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startScrollRef.current = viewportRef.current.scrollTop;
    viewportRef.current.setPointerCapture(e.pointerId);
    viewportRef.current.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !viewportRef.current) return;
    const dy = e.clientY - startYRef.current;
    viewportRef.current.scrollTop = startScrollRef.current - dy;
    update();
  };

  const endDrag = () => {
    draggingRef.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = 'grab';
  };

  if (songs.length === 0) return null;

  const active = songs[activeIndex] ?? songs[0]!;
  const activeEmotionLabel = findNearestEmotionLabel(active.va);
  const activeEmotionDisplay = getEmotionDisplay(activeEmotionLabel);

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        {/* 左:照片(拍立得化,奶油米边框 + 底部手写题字) */}
        <div className={styles.photo}>
          <img src={photoUrl} alt={photoTitle} className={styles.photoImg} />
          <span className={styles.photoChip}>{photoTitle}</span>
        </div>

        {/* 右:垂直滚轮(暖光从照片侧渗入,氛围渗透替代原花括号连接) */}
        <div
          ref={viewportRef}
          className={styles.viewport}
          onScroll={() => requestAnimationFrame(update)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerCancel={endDrag}
        >
          <div className={styles.track}>
            {songs.map((song, i) => {
              const isActive = i === activeIndex;
              const isCurrent = currentSongId === song.songId;
              return (
                <div
                  key={song.songId}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className={`${styles.cover} ${isActive ? styles.coverActive : ''}`}
                  style={{
                    transform: `scale(${transforms[i]?.scale ?? 1})`,
                    opacity: transforms[i]?.opacity ?? 1,
                  }}
                  onClick={() => onSelect(song, i)}
                  role="button"
                  tabIndex={0}
                  aria-label={`播放 ${song.title}`}
                >
                  <div
                    className={styles.art}
                    style={{
                      backgroundImage: `${coverOverlay(song)}, url(${coverImage(song)})`,
                    }}
                    aria-hidden
                  >
                    <span className={styles.artInitial}>{coverInitial(song.title)}</span>
                  </div>
                  {/* 当前正在播放:封面右上角波形动效 */}
                  {isCurrent && isPlaying && (
                    <span className={styles.playingDot} aria-hidden>
                      <span className={styles.bar} />
                      <span className={styles.bar} />
                      <span className={styles.bar} />
                    </span>
                  )}
                  {isCurrent && !isPlaying && (
                    <span className={styles.pausedBadge} aria-hidden>❚❚</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 下方:当前居中曲目的标题 + 情绪 */}
      <div className={styles.now}>
        <div className={styles.nowTitle}>{active.title}</div>
        <div className={styles.nowMood}>
          {active.artist} · {activeEmotionDisplay.zh}
        </div>
      </div>
    </div>
  );
}
