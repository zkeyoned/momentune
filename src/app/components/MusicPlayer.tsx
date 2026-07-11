import { useEffect, useRef, useState, useCallback, type ChangeEvent } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import type { Song } from '@algorithm/index';
import { findNearestEmotionLabel } from '@algorithm/index';
import { getEmotionDisplay } from '../config/emotionDisplay';
import { SONG_PREVIEW_URLS } from '../services/songPreviewUrls';
import { LyricsPanel } from './LyricsPanel';

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

const RETRO_STYLE_ID = 'momentune-musicplayer-retro';

function ensureRetroStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(RETRO_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = RETRO_STYLE_ID;
  el.textContent = `
    @keyframes mp-cassette-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .mp-spin { animation: none !important; }
    }
    .mp-range::-webkit-slider-runnable-track { height: 3px; background: var(--rule); border-radius: 100px; }
    .mp-range::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 12px; height: 12px;
      background: var(--accent); border-radius: 50%;
      cursor: pointer; opacity: 0.85;
      box-shadow: 0 1px 4px rgba(168,101,66,0.35);
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .mp-range::-webkit-slider-thumb:hover,
    .mp-range::-webkit-slider-thumb:active { opacity: 1; transform: scale(1.35); }
    .mp-range::-moz-range-track { height: 3px; background: var(--rule); border-radius: 100px; border: none; }
    .mp-range::-moz-range-thumb {
      width: 12px; height: 12px;
      background: var(--accent); border-radius: 50%;
      cursor: pointer; border: none; opacity: 0.85;
      box-shadow: 0 1px 4px rgba(168,101,66,0.35);
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .mp-range::-moz-range-thumb:hover,
    .mp-range::-moz-range-thumb:active { opacity: 1; transform: scale(1.35); }
    .mp-range::-moz-range-progress { height: 3px; background: var(--accent); border-radius: 100px; }
  `;
  document.head.appendChild(el);
}

export interface MusicPlayerProps {
  onToggleLyrics?: (show: boolean) => void;
}

export function MusicPlayer({ onToggleLyrics }: MusicPlayerProps = {}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const simTimeRef = useRef(0);
  const [collapsed, setCollapsed] = useState(false);
  // 真实播放地址出错时降级到模拟模式
  const [errorFallback, setErrorFallback] = useState(false);
  // 封面图加载失败时降级到渐变色
  const [coverError, setCoverError] = useState(false);
  // 歌词面板显隐
  const [showLyrics, setShowLyrics] = useState(false);

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

  // 开发环境通过 Vite proxy 代理音频请求,绕过 CORS/ORB 限制
  const audioSrc = (() => {
    if (!preview) return '';
    const rawUrl = preview.url;
    if (import.meta.env.DEV) {
      return `/api/audio-proxy?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
  })();

  const coverUrl = preview?.coverUrl;

  // 注入 retro 样式(仅客户端)
  useEffect(() => { ensureRetroStyle(); }, []);

  // 切歌时重置降级标记和模拟时间
  useEffect(() => {
    setErrorFallback(false);
    setCoverError(false);
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
    audio.src = audioSrc || preview.url;
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

  const handleToggleLyrics = useCallback(() => {
    setShowLyrics((prev) => {
      const next = !prev;
      onToggleLyrics?.(next);
      return next;
    });
  }, [onToggleLyrics]);

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

  const hasCoverImg = !!(coverUrl && !coverError);
  const gradient = coverGradient(currentTrack);

  // ============================================================
  // 渲染: 卡带封面子组件
  // ============================================================

  const CassetteCover = ({ size }: { size: number }) => {
    const innerPct = 0.68;
    const innerSize = size * innerPct;
    const holeSize = size * 0.108;
    const fontSize = size * 0.38;
    const borderW = Math.max(1.5, size * 0.04);

    return (
      <div
        aria-hidden
        className={isPlaying ? 'mp-spin' : undefined}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          border: `${borderW}px solid #3A3128`,
          background: 'repeating-conic-gradient(#3A3128 0% 1.8%, transparent 1.8% 3.6%)',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: isPlaying ? 'mp-cassette-spin 4s linear infinite' : undefined,
          ...(isPlaying ? {} : { animationPlayState: 'paused' }),
        }}
      >
        {/* 内圈 — 封面图或渐变色+首字母 */}
        <div
          style={{
            width: innerSize, height: innerSize,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hasCoverImg ? (
            <img
              src={coverUrl}
              alt=""
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              onError={() => setCoverError(true)}
            />
          ) : (
            <div
              style={{
                width: '100%', height: '100%',
                background: gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                lineHeight: 1,
              }}>
                {currentTrack.title.charAt(0)}
              </span>
            </div>
          )}
        </div>
        {/* 中心孔 */}
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: holeSize, height: holeSize,
            borderRadius: '50%',
            background: '#1A1510',
            zIndex: 2,
          }}
        />
      </div>
    );
  };

  // ============================================================
  // 渲染: SVG 图标
  // ============================================================

  const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="22" height="22" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
  const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="22" height="22" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
  const PrevIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="18" height="18" aria-hidden>
      <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
    </svg>
  );
  const NextIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="18" height="18" aria-hidden>
      <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
    </svg>
  );
  const LyricsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </svg>
  );
  const ChevronUpIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );

  // ============================================================
  // 公共按钮样式
  // ============================================================

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 0, cursor: 'pointer', background: 'transparent',
    WebkitTapHighlightColor: 'transparent',
  };

  // ============================================================
  // 主容器样式
  // ============================================================

  const playerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 4px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 24px)',
    maxWidth: 'calc(var(--app-max-width) - 24px)',
    background: 'var(--warm-cream)',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(58,49,40,0.14)',
    zIndex: 99,
    padding: collapsed ? '0 12px' : '10px 12px 8px',
    transition: 'padding 0.25s ease',
  };

  return (
    <div style={playerStyle}>
      {/* <audio> 不加 crossOrigin:audio 标签不受同源策略限制,加了反而因对方无 CORS 头失败 */}
      <audio ref={audioRef} preload="none" />

      {/* 歌词面板 */}
      <LyricsPanel
        show={showLyrics}
        songId={currentTrack.songId}
        currentTime={currentTime}
        isPlaying={isPlaying}
      />

      {collapsed ? (
        /* ================================================================
           收起态: 44px 胶囊横条
           ================================================================ */
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="展开播放器"
          style={{
            ...btnBase,
            width: '100%', height: 44,
            gap: 10, padding: '0 4px',
            borderRadius: 16,
          }}
        >
          <CassetteCover size={30} />
          <span style={{
            flex: 1, minWidth: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: '0.78rem', fontWeight: 600,
            color: 'var(--ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textAlign: 'left',
          }}>
            {currentTrack.title}
          </span>
          <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <ChevronUpIcon />
          </span>
        </button>
      ) : (
        /* ================================================================
           展开态: 两行浮动卡片
           ================================================================ */
        <>
          {/* ---- Row 1: 卡带封面 | 歌曲信息 | 控制按钮 ---- */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 卡带封面 */}
            <CassetteCover size={46} />

            {/* 歌曲信息 */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '0.9rem', fontWeight: 700,
                color: 'var(--ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                lineHeight: 1.3,
              }}>
                {currentTrack.title}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                marginTop: 2,
                fontSize: '0.68rem', color: 'var(--muted)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.artist}
                </span>
                <span style={{ flexShrink: 0 }}>·</span>
                <span style={{
                  flexShrink: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(168,101,66,0.12)',
                  color: 'var(--accent)',
                }}>
                  {emotionDisplay.zh}
                </span>
              </div>
            </div>

            {/* 控制按钮组: prev / play / next */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {/* 上一首 */}
              <button
                type="button"
                onClick={prev}
                aria-label="上一首"
                style={{
                  ...btnBase,
                  width: 40, height: 40,
                  borderRadius: '50%',
                  color: 'var(--ink)',
                  transition: 'opacity 0.2s ease, transform 0.12s ease',
                }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)'; }}
                onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                <PrevIcon />
              </button>

              {/* 播放/暂停 */}
              <button
                type="button"
                onClick={toggle}
                aria-label={isPlaying ? '暂停' : '播放'}
                style={{
                  ...btnBase,
                  width: 52, height: 52,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: '#F4ECDD',
                  boxShadow: '0 3px 12px rgba(168,101,66,0.35)',
                  transition: 'transform 0.12s ease, box-shadow 0.2s ease',
                }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)'; }}
                onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              {/* 下一首 */}
              <button
                type="button"
                onClick={next}
                aria-label="下一首"
                style={{
                  ...btnBase,
                  width: 40, height: 40,
                  borderRadius: '50%',
                  color: 'var(--ink)',
                  transition: 'opacity 0.2s ease, transform 0.12s ease',
                }}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)'; }}
                onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                <NextIcon />
              </button>
            </div>
          </div>

          {/* ---- Row 2: 歌词按钮 + 提示文案 + 进度条 + 时间 ---- */}
          <div style={{ marginTop: 10 }}>
            {/* 顶部行: 歌词 + 徽章 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              {/* 歌词按钮 */}
              <button
                type="button"
                onClick={handleToggleLyrics}
                style={{
                  ...btnBase,
                  gap: 4, padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-sans)',
                  color: showLyrics ? 'var(--accent)' : 'var(--muted)',
                  background: showLyrics ? 'rgba(168,101,66,0.1)' : 'transparent',
                  transition: 'color 0.2s ease, background 0.2s ease',
                }}
              >
                <LyricsIcon />
                歌词
              </button>

              {/* 右侧提示 / 收起 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {hint && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem', color: 'var(--muted)',
                    opacity: 0.7, letterSpacing: '0.04em',
                  }}>
                    {hint}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  style={{
                    ...btnBase,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.58rem', color: 'var(--muted)',
                    padding: '1px 4px',
                    borderRadius: 'var(--radius-pill)',
                    transition: 'color 0.2s ease',
                  }}
                >
                  ▼ 收起
                </button>
              </div>
            </div>

            {/* 进度条 */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              className="mp-range"
              onPointerDown={(e) => e.stopPropagation()}
              onChange={handleSeek}
              aria-label="进度"
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
                width: '100%',
                height: 3,
                background: 'transparent',
                borderRadius: 'var(--radius-pill)',
                outline: 'none',
                cursor: 'pointer',
                margin: 0,
                accentColor: 'var(--accent)',
              }}
            />

            {/* 时间标签 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: 1,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10, color: 'var(--muted)',
              }}>
                {fmtTime(currentTime)}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10, color: 'var(--muted)',
              }}>
                {fmtTime(duration || SIM_DURATION)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
