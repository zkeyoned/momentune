/**
 * 日记状态:本地保存的图文音乐日记
 *
 * 持久化到 localStorage,Zustand persist。
 * 初始内置 3 条 mock 日记(演示用),便于时间线页直接看到内容。
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EmotionLabel, Song } from '@algorithm/index';
import type { JournalEntry } from '../types';

/** mock 种子日记(避免空状态影响演示) */
function seedJournals(): JournalEntry[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'seed-1',
      createdAt: now - day * 1,
      photoUrl: 'https://picsum.photos/seed/beach-sunset/600/450',
      photoTitle: '黄昏 · 海边',
      photoFeatures: {
        hue: { hue: 30, tone: 'warm', confidence: 0.88 },
        luminance: { value: 0.6, level: 'mid', confidence: 0.82 },
        saturation: { value: 0.55, level: 'mid', confidence: 0.78 },
        scene: { type: 'beach', confidence: 0.92 },
        timeOfDay: { value: 'golden_hour', confidence: 0.9 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'landscape', confidence: 0.8 },
        overallConfidence: 0.85,
      },
      emotion: {
        va: { v: 0.78, a: 0.32 },
        primary: 'Cozy' as EmotionLabel,
        secondary: 'Peaceful' as EmotionLabel,
        isMixed: true,
        displayLabel: '温柔 · 惬意',
      },
      songs: [] as Song[],
      text: '今天的海,安静得像一句没说出口的话。',
      location: '舟山 · 朱家尖',
    },
    {
      id: 'seed-2',
      createdAt: now - day * 3,
      photoUrl: 'https://picsum.photos/seed/city-night/600/450',
      photoTitle: '城市 · 夜归',
      photoFeatures: {
        hue: { hue: 220, tone: 'cool', confidence: 0.85 },
        luminance: { value: 0.25, level: 'low', confidence: 0.8 },
        saturation: { value: 0.5, level: 'mid', confidence: 0.75 },
        scene: { type: 'city', confidence: 0.9 },
        timeOfDay: { value: 'late_night', confidence: 0.95 },
        weather: { value: 'cloudy', confidence: 0.7 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'leading_lines', confidence: 0.8 },
        overallConfidence: 0.82,
      },
      emotion: {
        va: { v: 0.35, a: 0.45 },
        primary: 'Lonely' as EmotionLabel,
        secondary: 'Melancholic' as EmotionLabel,
        isMixed: true,
        displayLabel: '清冷 · 孤寂',
      },
      songs: [] as Song[],
      text: '末班车开过,路灯把影子拉得很长。',
      location: '上海 · 武康路',
    },
    {
      id: 'seed-3',
      createdAt: now - day * 7,
      photoUrl: 'https://picsum.photos/seed/mountain-sunrise/600/450',
      photoTitle: '清晨 · 山顶',
      photoFeatures: {
        hue: { hue: 45, tone: 'warm', confidence: 0.87 },
        luminance: { value: 0.7, level: 'high', confidence: 0.83 },
        saturation: { value: 0.6, level: 'mid', confidence: 0.78 },
        scene: { type: 'mountain', confidence: 0.93 },
        timeOfDay: { value: 'dawn', confidence: 0.9 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 1, dominantEmotion: 'proud', confidence: 0.78 },
        composition: { type: 'panorama', confidence: 0.82 },
        overallConfidence: 0.84,
      },
      emotion: {
        va: { v: 0.85, a: 0.55 },
        primary: 'Awe' as EmotionLabel,
        isMixed: false,
        displayLabel: '壮阔 · 敬畏',
      },
      songs: [] as Song[],
      text: '爬了四个小时,云海在脚下翻涌。值了。',
      location: '黄山 · 光明顶',
    },
  ];
}

interface JournalState {
  journals: JournalEntry[];

  add: (entry: JournalEntry) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<JournalEntry>) => void;
  getById: (id: string) => JournalEntry | undefined;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set, get) => ({
      journals: seedJournals(),

      add: (entry) => set((s) => ({ journals: [entry, ...s.journals] })),

      remove: (id) => set((s) => ({ journals: s.journals.filter((j) => j.id !== id) })),

      update: (id, patch) =>
        set((s) => ({
          journals: s.journals.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        })),

      getById: (id) => get().journals.find((j) => j.id === id),
    }),
    {
      name: 'momentune-journals',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
