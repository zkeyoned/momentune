import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import type { Song } from '@algorithm/index';
import { findNearestEmotionLabel } from '@algorithm/index';
import { getEmotionDisplay } from '../config/emotionDisplay';
import { SONG_PREVIEW_URLS } from '../services/songPreviewUrls';
import styles from './MusicPlayer.module.css';

/**
 * 底部常驻播放器
 *
 * 双模式播放:
 *  - 真实播放:歌曲在 SONG_PREVIEW_URLS 映射表中有真实播放地址,挂 <audio> src
 *    驱动原生事件(loadedmetadata/timeupdate/ended/error)。error 时降级到模拟。
 *  - 模拟播放:映射表无记录或真实地址出错,走 setInterval 虚拟 180s 进度。
 *
 * 提示文案:完整歌曲不显示 / 试听片段显示「♪ 试听片段」/ 模拟兜底显示「♪ 演示模式 · 模拟播放」。
 */

const SIM_DURATION = 180; // 模拟歌曲时长(秒)
const TICK_MS = 500;

/** 由歌曲 V-A 生成封面渐变色 */
function coverGradient(song: Song): string {
  const { v, a } = song.va;
  const hue = Math.round(20 + v * 320);
  const sat = 45 + a * 35;
  return `linear-gradient(135deg, hsl(${hue}, ${sat}%, 58%), hsl(${hue + 30}, ${sat}%, 38%))`;
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const simTimeRef = useRef(0);
  const [collapsed, setCollapsed] = useState(false);
  // 真实播放地址出错时降级到模拟模式
  const [errorFallback, setErrorFallback] = useState(false);

  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const onTimeUpdate = usePlayerStore((s) => s.onTimeUpdate);

  const currentTrack: Song | null =
    currentIndex >= 0 && currentIndex < queue.length ? (queue[currentIndex] ?? null) : null;

  // 查映射表
  const preview = currentTrack ? SONG_PREVIEW_URLS[currentTrack.songId] : undefined;
  // 是否真实播放:有映射地址且未出错降级
  const isRealPlayback = !!preview && !errorFallback;
  const isTrial = preview?.isTrial ?? false;

  // 切歌时重置降级标记和模拟时间
  useEffect(() => {
    setErrorFallback(false);
    simTimeRef.current = 0;
    // 模拟模式设虚拟时长,真实模式等 loadedmetadata 回填
    onTimeUpdate(0, preview ? 0 : SIM_DURATION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.songId]);

  // 真实播放:绑定 audio src + 原生事件(切歌时清理旧监听器,避免叠加/泄漏)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isRealPlayback || !preview) return;

    // 设置新 src 并加载
    audio.src = preview.url;
    audio.load();

    const onLoadedMetadata = () => {
      onTimeUpdate(0, audio.duration);
      // 切歌时若 store 状态为播放中,自动续播
      if (usePlayerStore.getState().isPlaying) {
        audio.play().catch(() => {
          // 浏览器自动播放策略可能拒绝,静默(用户点播放按钮时会再次尝试)
        });
      }
    };
    const onTimeUpdateHandler = () => {
      onTimeUpdate(audio.currentTime, audio.duration);
    };
    const onEnded = () => {
      next();
    };
    const onError = () => {
      // 地址过期/失效,降级到模拟播放
      setErrorFallback(true);
      onTimeUpdate(simTimeRef.current, SIM_DURATION);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdateHandler);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      // 切歌时清理旧监听器,避免叠加导致进度错乱/内存泄漏
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdateHandler);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealPlayback, currentTrack?.songId]);

  // 真实播放:isPlaying 变化时同步 audio.play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isRealPlayback) return;
    if (isPlaying) {
      audio.play().catch(() => {
        // 自动播放策略可能拒绝首次播放,静默处理
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, isRealPlayback]);

  // 模拟播放定时器(仅非真实播放时启用)
  useEffect(() => {
    if (isRealPlayback || !isPlaying || !currentTrack) return;
    const interval = setInterval(() => {
      let t = simTimeRef.current + TICK_MS / 1000;
      if (t >= SIM_DURATION) {
        t = 0;
        next();
      }
      simTimeRef.current = t;
      onTimeUpdate(t, SIM_DURATION);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isRealPlayback, isPlaying, currentTrack, next, onTimeUpdate]);

  if (!currentTrack) return null;

  const emotionLabel = findNearestEmotionLabel(currentTrack.va);
  const emotionDisplay = getEmotionDisplay(emotionLabel);

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const p = Number(e.currentTarget.value);
    const audio = audioRef.current;
    if (isRealPlayback && audio && audio.duration) {
      audio.currentTime = p * audio.duration;
      onTimeUpdate(p * audio.duration, audio.duration);
    } else {
      simTimeRef.current = p * SIM_DURATION;
      onTimeUpdate(p * SIM_DURATION, SIM_DURATION);
    }
  };

  // 提示文案:完整歌曲不显示 / 试听显示「♪ 试听片段」/ 模拟兜底显示演示模式
  let hint: string | null = null;
  if (!isRealPlayback) {
    hint = '♪ 演示模式 · 模拟播放';
  } else if (isTrial) {
    hint = '♪ 试听片段';
  }

  return (
    <div className={`${styles.player} ${collapsed ? styles.playerCollapsed : ''}`}>
      {/* <audio> 不加 crossOrigin:audio 标签不受同源策略限制,加了反而因对方无 CORS 头失败 */}
      <audio ref={audioRef} preload="none" />

      {collapsed ? (
        /* 收起态:极简横条 */
        <button
          type="button"
          className={styles.collapsedBar}
          onClick={() => setCollapsed(false)}
        >
          <div
            className={styles.collapsedCover}
            style={{ background: coverGradient(currentTrack) }}
            aria-hidden
          />
          <span className={styles.collapsedTitle}>{currentTrack.title}</span>
          <span className={styles.collapsedIcon} aria-hidden>▲</span>
        </button>
      ) : (
        /* 展开态:完整播放器 */
        <>
          <div className={styles.bar}>
            <div
              className={styles.cover}
              style={{ background: coverGradient(currentTrack) }}
              aria-hidden
            >
              <span className={styles.coverInitial}>
                {currentTrack.title.charAt(0)}
              </span>
              {isPlaying && (
                <span className={styles.equalizer} aria-hidden>
                  <span /><span /><span />
                </span>
              )}
            </div>

            <div className={styles.info}>
              <div className={styles.titleRow}>
                <span className={styles.title}>{currentTrack.title}</span>
                <span className={styles.tag}>{emotionDisplay.zh}</span>
              </div>
              <p className={styles.artist}>{currentTrack.artist}</p>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={progress}
                className={styles.progress}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={handleSeek}
                aria-label="进度"
              />
              <div className={styles.timeRow}>
                <span className={styles.time}>{fmtTime(currentTime)}</span>
                <span className={styles.time}>{fmtTime(duration || SIM_DURATION)}</span>
              </div>
            </div>

            <div className={styles.controls}>
              <button className={styles.ctrlBtn} onClick={prev} aria-label="上一首">
                ⏮
              </button>
              <button
                className={`${styles.ctrlBtn} ${styles.playBtn}`}
                onClick={toggle}
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button className={styles.ctrlBtn} onClick={next} aria-label="下一首">
                ⏭
              </button>
            </div>
          </div>

          <p className={styles.demoHint}>
            {hint && <span>{hint}</span>}
            <button
              type="button"
              className={styles.hideBtn}
              onClick={() => setCollapsed(true)}
            >
              ▼ 收起
            </button>
          </p>
        </>
      )}
    </div>
  );
}
