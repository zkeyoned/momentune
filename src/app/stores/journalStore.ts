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

/**
 * mock 种子歌曲:从 HOT_CHART_2026 中精选 3 组(每组 2 首),
 * 与种子日记的情绪/场景匹配,便于时间线/日历页直接展示歌曲行。
 * 后续接入真实推荐结果时,这些 mock 数据会被替换。
 */
function mockSong(
  songId: string,
  title: string,
  artist: string,
  v: number,
  a: number,
  genres: Song['genres'],
  sceneTags: Song['sceneTags'],
): Song {
  return {
    songId,
    title,
    artist,
    layer: 'hot',
    va: { v, a, confidence: 0.9, source: 'manual' },
    genres,
    sceneTags,
    language: 'mandarin',
    hotRecency: 'this_month',
    decade: 2026,
  };
}

/** mock 种子日记(避免空状态影响演示) */
function seedJournals(): JournalEntry[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'seed-1',
      createdAt: now - day * 1,
      photoUrl: '/samples/beach-sunset.svg',
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
      songs: [
        mockSong('hot_lianren_lironghao', '恋人', '李荣浩', 0.78, 0.32, ['pop', 'rnb'], ['wine_night', 'first_date']),
        mockSong('hot_renjianyanhuo_chengxiang', '人间烟火', '程响', 0.7, 0.3, ['pop'], ['cafe_afternoon', 'city_walk']),
      ],
      text: '今天的海,安静得像一句没说出口的话。落日把潮汐染成蜂蜜色,耳机里循环着李荣浩,世界突然很慢。',
      location: '舟山 · 朱家尖',
    },
    {
      id: 'seed-2',
      createdAt: now - day * 3,
      photoUrl: '/samples/city-night.svg',
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
      songs: [
        mockSong('hot_natianxiayule_zhoujielun', '那天下雨了', '周杰伦', 0.4, 0.45, ['pop'], ['rainy_window', 'rainy_day']),
        mockSong('hot_jietuo_zhengrunze', '解脱', '郑润泽', 0.35, 0.5, ['pop'], ['breakup', 'late_night_emo']),
      ],
      text: '末班车开过,路灯把影子拉得很长。武康路的梧桐在风里翻了个身,像是替我说了句晚安。',
      location: '上海 · 武康路',
    },
    {
      id: 'seed-3',
      createdAt: now - day * 7,
      photoUrl: '/samples/mountain-sunrise.svg',
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
      songs: [
        mockSong('hot_benteng_zhoushen', '奔腾', '周深', 0.85, 0.55, ['guofeng', 'pop'], ['travel', 'mountain_top']),
        mockSong('hot_longyaohuaxia_longyoulin', '龙耀华夏', '龙友林', 0.82, 0.6, ['guofeng', 'guofengrock'], ['festival', 'travel']),
      ],
      text: '爬了四个小时,云海在脚下翻涌。第一缕光从远山后溢出来时,整个人被震住了。值了。',
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
      version: 2,
      // 升级到 v2 时:对旧版种子日记(seed-*)补上 mock 歌曲,
      // 不影响用户真实创建的日记。
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        const state = persistedState as { journals?: JournalEntry[] };
        if (!Array.isArray(state.journals)) return persistedState;
        const fresh = seedJournals();
        const seedMap = new Map(fresh.map((j) => [j.id, j]));
        state.journals = state.journals.map((j) => {
          // 仅对旧版种子日记(seed-*)且 songs 为空的条目补歌曲
          if (version < 2 && j.id.startsWith('seed-') && (!j.songs || j.songs.length === 0)) {
            const freshSeed = seedMap.get(j.id);
            if (freshSeed) return { ...j, songs: freshSeed.songs, text: freshSeed.text };
          }
          return j;
        });
        return state;
      },
    },
  ),
);
