import { useEffect, useRef, useState } from 'react';
import { parseLrc, findCurrentIndex, type LyricLine } from '../utils/lyrics';

/**
 * 歌词面板
 *
 * - 点「歌词」按钮展开(通过 show prop 控制)
 * - 运行时 fetch(`/lyrics/${songId}.lrc`) 加载 LRC
 * - 解析 [mm:ss.xx] 时间戳，按当前播放时间高亮当前句
 * - 404 或解析为空显示"纯音乐,静静听"
 * - 模拟播放模式下也按虚拟时间同步
 * - 切歌时重新加载并复位滚动
 * - height 过渡动画展开/收起
 */

interface LyricsPanelProps {
  show: boolean;
  songId: string;
  currentTime: number;          // 当前播放时间(秒)
  isPlaying: boolean;
}

export function LyricsPanel({ show, songId, currentTime, isPlaying }: LyricsPanelProps) {
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSongIdRef = useRef<string | null>(null);

  // 切歌时重新加载歌词
  useEffect(() => {
    if (!songId) return;
    if (lastSongIdRef.current === songId) return;
    lastSongIdRef.current = songId;

    setLines(null);
    setEmpty(false);
    setLoading(true);

    fetch(`/lyrics/${songId}.lrc`)
      .then((res) => {
        if (!res.ok) throw new Error('404');
        return res.text();
      })
      .then((text) => {
        const parsed = parseLrc(text);
        if (parsed.length === 0) {
          setEmpty(true);
        } else {
          setLines(parsed);
        }
      })
      .catch(() => {
        setEmpty(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [songId]);

  // 高亮当前行 + 滚动居中
  useEffect(() => {
    if (!show || !lines || lines.length === 0 || !scrollRef.current) return;

    const scroll = () => {
      if (!scrollRef.current) return;
      const idx = findCurrentIndex(lines, currentTime);
      const el = scrollRef.current.children[idx] as HTMLElement | undefined;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    scroll();
  }, [show, lines, currentTime, isPlaying]);

  if (!show) return null;

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 216,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  };

  const maskStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 2,
    background:
      'linear-gradient(to bottom, var(--warm-cream) 0%, transparent 20%, transparent 80%, var(--warm-cream) 100%)',
  };

  const scrollStyle: React.CSSProperties = {
    height: '100%',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '40px 16px',
    scrollbarWidth: 'none',
  };

  const lineBase: React.CSSProperties = {
    textAlign: 'center',
    padding: '6px 0',
    fontFamily: 'var(--font-serif)',
    fontSize: '0.88rem',
    lineHeight: 1.6,
    color: 'var(--muted)',
    transition: 'color 0.3s ease, font-size 0.3s ease, font-weight 0.3s ease',
  };

  const activeLine: React.CSSProperties = {
    ...lineBase,
    color: 'var(--accent)',
    fontSize: '1.05rem',
    fontWeight: 700,
  };

  return (
    <div style={containerStyle}>
      <div style={maskStyle} />
      <div ref={scrollRef} style={scrollStyle}>
        {/* 顶部占位 */}
        <div style={{ height: 48 }} />

        {loading && (
          <p style={{ ...lineBase, color: 'var(--muted)', opacity: 0.6 }}>
            加载歌词中...
          </p>
        )}

        {empty && (
          <p style={{ ...lineBase, color: 'var(--muted)', fontStyle: 'italic' }}>
            纯音乐，静静听
          </p>
        )}

        {lines && lines.map((line, i) => {
          const idx = findCurrentIndex(lines, currentTime);
          const active = i === idx;
          return (
            <p key={i} style={active ? activeLine : lineBase}>
              {line.text}
            </p>
          );
        })}

        {/* 底部占位 */}
        <div style={{ height: 48 }} />
      </div>
    </div>
  );
}
