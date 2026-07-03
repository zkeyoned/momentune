/**
 * 播放器状态(MusicPlayer 组件消费)
 *
 * 设计:store 只持有状态与控制意图,真正的 <audio> 元素由 MusicPlayer 组件持有,
 * 通过订阅 store 变化驱动 audio.play/pause/seek。
 */

import { create } from 'zustand';
import type { Song } from '@algorithm/index';

interface PlayerState {
  /** 当前播放队列 */
  queue: Song[];
  /** 当前曲目在队列中的下标,-1 表示空 */
  currentIndex: number;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 进度 0-1 */
  progress: number;
  /** 当前曲时长(秒,0 表示未知) */
  duration: number;
  /** 当前播放位置(秒) */
  currentTime: number;
  /** 音量 0-1 */
  volume: number;

  // —— actions ——
  /** 播放指定曲目(可附带队列) */
  playTrack: (song: Song, queue?: Song[]) => void;
  /** 播放队列中指定下标 */
  playIndex: (index: number) => void;
  /** 切换播放/暂停 */
  toggle: () => void;
  /** 下一首 */
  next: () => void;
  /** 上一首 */
  prev: () => void;
  /** 由 audio 元素事件回调更新进度 */
  onTimeUpdate: (currentTime: number, duration: number) => void;
  /** 跳转到进度 */
  seek: (progress: number) => void;
  /** 设置音量 */
  setVolume: (v: number) => void;
  /** 停止并清空 */
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  progress: 0,
  duration: 0,
  currentTime: 0,
  volume: 0.8,

  playTrack: (song, queue) => {
    const list = queue ?? [song];
    const idx = list.findIndex((s) => s.songId === song.songId);
    const safeIdx = idx >= 0 ? idx : 0;
    set({
      queue: list,
      currentIndex: safeIdx,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });
  },

  playIndex: (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    set({ currentIndex: index, isPlaying: true, progress: 0, currentTime: 0, duration: 0 });
  },

  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    const ni = (currentIndex + 1) % queue.length;
    set({ currentIndex: ni, isPlaying: true, progress: 0, currentTime: 0, duration: 0 });
  },

  prev: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    const pi = (currentIndex - 1 + queue.length) % queue.length;
    set({ currentIndex: pi, isPlaying: true, progress: 0, currentTime: 0, duration: 0 });
  },

  onTimeUpdate: (currentTime, duration) => {
    const progress = duration > 0 ? currentTime / duration : 0;
    set({ currentTime, duration, progress });
  },

  seek: (p) => {
    const { duration } = get();
    const ct = duration > 0 ? p * duration : 0;
    set({ progress: p, currentTime: ct });
  },

  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),

  stop: () =>
    set({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      progress: 0,
      currentTime: 0,
      duration: 0,
    }),
}));

/** 当前曲目的 selector(避免在组件里重复计算) */
export function useCurrentTrack(): Song | null {
  return usePlayerStore((s) => {
    if (s.currentIndex < 0 || s.currentIndex >= s.queue.length) return null;
    return s.queue[s.currentIndex] ?? null;
  });
}
