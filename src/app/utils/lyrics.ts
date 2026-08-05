/**
 * 歌词解析工具（可复用模块）
 *
 * - parseLrc: 解析 LRC 文本为带时间戳的歌词行数组
 * - findCurrentIndex: 根据当前播放时间定位歌词行索引
 * - LyricLine: 歌词行结构
 */

export interface LyricLine {
  time: number;   // 秒
  text: string;
}

/** 解析 LRC 文本，提取 [mm:ss.xx] 时间戳与其后的歌词文本 */
export function parseLrc(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const re = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const raw of lrcText.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    re.lastIndex = 0;
    const matches = [...trimmed.matchAll(re)];
    if (matches.length === 0) continue;
    // 取最后一个时间戳之后的文本
    const lastMatch = matches[matches.length - 1]!;
    const text = trimmed.slice(lastMatch.index! + lastMatch[0].length).trim();
    if (!text) continue;
    const min = parseInt(lastMatch[1]!, 10);
    const sec = parseInt(lastMatch[2]!, 10);
    const ms = lastMatch[3] ? parseInt(lastMatch[3]!.padEnd(3, '0'), 10) : 0;
    lines.push({ time: min * 60 + sec + ms / 1000, text });
  }

  return lines.sort((a, b) => a.time - b.time);
}

/** 查找当前时间对应的歌词行索引 */
export function findCurrentIndex(lines: LyricLine[], t: number): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (t >= lines[i]!.time) return i;
  }
  return 0;
}
