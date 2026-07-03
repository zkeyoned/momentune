/**
 * Onboarding 问卷状态(5 题 + 平台连接引导)
 *
 * 流程:
 *  1. 年龄段(可选)
 *  2. 平台偏好
 *  3. 风格偏好(至少 3 个,可跳过)
 *  4. 情绪偏好
 *  5. 语言偏好
 *  6. 平台连接(可跳过,稍后在设置里再绑)
 *
 * 完成后由 OnboardingPage 调用 mockApi 初始化 UserPreference 并写入 userStore。
 */

import { create } from 'zustand';
import type {
  GenreTag,
  LanguageTag,
  MoodPreference,
  OnboardingAnswers,
  PlatformPreference,
} from '@algorithm/index';

const TOTAL_STEPS = 6;

interface OnboardingState {
  step: number;
  ageRange: 'under18' | '18-22' | '23-27' | '28-35' | '36-45' | '46plus' | null;
  platform: PlatformPreference | null;
  genres: GenreTag[];
  mood: MoodPreference | null;
  languages: LanguageTag[];
  /** 是否跳过风格选择 */
  genresSkipped: boolean;

  setStep: (step: number) => void;
  next: () => void;
  prev: () => void;
  setAgeRange: (a: OnboardingState['ageRange']) => void;
  setPlatform: (p: PlatformPreference) => void;
  toggleGenre: (g: GenreTag) => void;
  setGenresSkipped: (v: boolean) => void;
  setMood: (m: MoodPreference) => void;
  toggleLanguage: (l: LanguageTag) => void;
  reset: () => void;
  /** 构造 OnboardingAnswers(若数据不全会用兜底值) */
  buildAnswers: () => OnboardingAnswers;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: 0,
  ageRange: null,
  platform: null,
  genres: [],
  mood: null,
  languages: [],
  genresSkipped: false,

  setStep: (step) => set({ step }),
  next: () => set((s) => ({ step: Math.min(s.step + 1, TOTAL_STEPS - 1) })),
  prev: () => set((s) => ({ step: Math.max(s.step - 1, 0) })),

  setAgeRange: (a) => set({ ageRange: a }),

  setPlatform: (p) => set({ platform: p }),

  toggleGenre: (g) =>
    set((s) => {
      const has = s.genres.includes(g);
      return {
        genres: has ? s.genres.filter((x) => x !== g) : [...s.genres, g],
        genresSkipped: false,
      };
    }),

  setGenresSkipped: (v) => set({ genresSkipped: v, genres: [] }),

  setMood: (m) => set({ mood: m }),

  toggleLanguage: (l) =>
    set((s) => {
      const has = s.languages.includes(l);
      return { languages: has ? s.languages.filter((x) => x !== l) : [...s.languages, l] };
    }),

  reset: () =>
    set({
      step: 0,
      ageRange: null,
      platform: null,
      genres: [],
      mood: null,
      languages: [],
      genresSkipped: false,
    }),

  buildAnswers: () => {
    const s = get();
    return {
      ageRange: s.ageRange ?? undefined,
      platform: s.platform ?? 'netease',
      referenceSongs: [],
      mood: s.mood ?? 'neutral',
      genres: s.genresSkipped ? [] : s.genres,
      languages: s.languages,
    };
  },
}));

export const ONBOARDING_TOTAL_STEPS = TOTAL_STEPS;
