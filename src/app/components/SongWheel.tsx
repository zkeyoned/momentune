import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Song } from '@algorithm/index';
import { SONG_PREVIEW_URLS } from '../services/songPreviewUrls';
import styles from './SongWheel.module.css';

/**
 * 由歌曲 V-A 生成暖色域封面渐变(纯 CSS 兜底,无外部图床依赖)。
 * 暖色域 hue 15-55(橙红到金黄),统一胶片暖调。
 */
function coverGradient(song: Song): string {
  const { v, a } = song.va;
  const hue = Math.round(15 + v * 40);
  const sat = 42 + a * 28;
  const alpha1 = 0.58 + a * 0.18;
  const alpha2 = 0.78 + a * 0.14;
  return `linear-gradient(135deg, hsla(${hue}, ${sat}%, 46%, ${alpha1}) 0%, hsla(${hue + 22}, ${sat}%, 30%, ${alpha2}) 100%)`;
}

function coverInitial(title: string): string {
  return title.trim().charAt(0) || '♪';
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
 * 横向封面胶卷选歌器(参考 result-page-preview-v2.html)。
 *
 * 设计:
 *  - scroll-snap-type: x mandatory 居中吸附
 *  - 二态切换:active(scale 1.06 + 焦糖描边 + 播放角标) / 非 active(scale 0.86 + 半透明)
 *  - 封面图优先用 SONG_PREVIEW_URLS[songId].coverUrl(本地 /covers/{songId}.jpg)
 *  - 加载失败回退到 V-A 渐变色 + 首字母
 *  - 不新建状态:activeIndex 由 currentSongId 推导,滑动结束吸附后回调 onSelect
 */
export function SongWheel({
  songs,
  currentSongId,
  isPlaying,
  onSelect,
}: SongWheelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollRef = useRef(0);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 记录封面图加载失败的 songId(回退到渐变色 + 首字母)
  const [coverErrors, setCoverErrors] = useState<Set<string>>(new Set());

  // 初始居中当前播放曲目(若有),否则居中第 1 首
  useEffect(() => {
    const initIndex = Math.max(
      0,
      songs.findIndex((s) => s.songId === currentSongId),
    );
    const target = itemRefs.current[initIndex < 0 ? 0 : initIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 滑动结束后(debounce 90ms)找到最居中的封面,触发 onSelect
  const handleScroll = () => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const mid = viewport.scrollLeft + viewport.clientWidth / 2;
      let closestIndex = 0;
      let closestDist = Infinity;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (d < closestDist) {
          closestDist = d;
          closestIndex = i;
        }
      });
      const song = songs[closestIndex];
      if (song && song.songId !== currentSongId) {
        onSelect(song, closestIndex);
      }
    }, 90);
  };

  // 鼠标拖拽(仅 mouse 指针)——触摸走原生 scroll-snap
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !viewportRef.current) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startScrollRef.current = viewportRef.current.scrollLeft;
    viewportRef.current.setPointerCapture(e.pointerId);
    viewportRef.current.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !viewportRef.current) return;
    const dx = e.clientX - startXRef.current;
    viewportRef.current.scrollLeft = startScrollRef.current - dx;
  };

  const endDrag = () => {
    draggingRef.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = 'grab';
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  if (songs.length === 0) return null;

  return (
    <div
      ref={viewportRef}
      className={styles.filmStrip}
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      {songs.map((song, i) => {
        const isCurrent = currentSongId === song.songId;
        const preview = SONG_PREVIEW_URLS[song.songId];
        const coverUrl = preview?.coverUrl;
        const coverFailed = coverErrors.has(song.songId);
        // 封面图优先:有 coverUrl 且未加载失败 → 用图片;否则回退渐变色 + 首字母
        const useCoverImg = !!coverUrl && !coverFailed;
        return (
          <div
            key={song.songId}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={`${styles.coverCard} ${isCurrent ? styles.active : ''}`}
            onClick={() => {
              // 点击时先滚动居中,再触发选歌
              itemRefs.current[i]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
              });
              onSelect(song, i);
            }}
            role="button"
            tabIndex={0}
            aria-label={`播放 ${song.title} - ${song.artist}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(song, i);
              }
            }}
          >
            <div
              className={styles.art}
              style={
                useCoverImg
                  ? undefined
                  : { backgroundImage: coverGradient(song) }
              }
              aria-hidden
            >
              {useCoverImg ? (
                <img
                  src={coverUrl}
                  alt=""
                  className={styles.artImg}
                  onError={() => {
                    // 加载失败:加入 set 触发重渲染,回退到渐变色 + 首字母
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
            {/* 播放角标:当前播放中显示波形,当前暂停显示 ❚❚ */}
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
  );
}
