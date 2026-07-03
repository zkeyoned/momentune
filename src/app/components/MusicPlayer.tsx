import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import type { Song } from '@algorithm/index';
import { findNearestEmotionLabel } from '@algorithm/index';
import { getEmotionDisplay } from '../config/emotionDisplay';
import styles from './MusicPlayer.module.css';

/**
 * 底部常驻播放器
 *
 * 当前为「模拟播放」模式(骨架阶段):
 * - <audio> 元素已就位(满足 spec 要求),src 待接入真实音乐平台 API 后填充
 * - 播放进度由定时器模拟(每首歌虚拟 180s)
 * - play/pause/next/prev/seek 全部可用
 *
 * TODO: 接入 NeteaseCloudMusicApi 后,替换为真实音频流驱动。
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
  const seek = usePlayerStore((s) => s.seek);

  const currentTrack: Song | null =
    currentIndex >= 0 && currentIndex < queue.length ? (queue[currentIndex] ?? null) : null;

  // 切歌时重置模拟时间
  useEffect(() => {
    simTimeRef.current = 0;
    onTimeUpdate(0, SIM_DURATION);
  }, [currentIndex, onTimeUpdate]);

  // 模拟播放定时器
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
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
  }, [isPlaying, currentTrack, next, onTimeUpdate]);

  if (!currentTrack) return null;

  const emotionLabel = findNearestEmotionLabel(currentTrack.va);
  const emotionDisplay = getEmotionDisplay(emotionLabel);

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const p = Number(e.currentTarget.value);
    seek(p);
    simTimeRef.current = p * SIM_DURATION;
    onTimeUpdate(p * SIM_DURATION, SIM_DURATION);
  };

  return (
    <div className={`${styles.player} ${collapsed ? styles.playerCollapsed : ''}`}>
      {/* <audio> 元素:骨架阶段不接入真实 src,结构就位待后续替换 */}
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
            ♪ 演示模式 · 模拟播放
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
