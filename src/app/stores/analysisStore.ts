/**
 * 分析流程状态:跨页面传递"待分析照片" + 推荐结果
 *
 * 流程:HomePage 选照片 → setPending → 跳转 /result → ResultPage 调 runAnalysis
 */

import { create } from 'zustand';
import type { PhotoFeatures, UserPreference } from '@algorithm/index';
import { analyzePhotoAsync } from '../services/mockApi';
import type { AnalysisResult } from '../types';

export interface PendingPhoto {
  features: PhotoFeatures;
  previewUrl: string;
  source: AnalysisResult['source'];
  title: string;
  location?: string;
}

interface AnalysisState {
  pending: PendingPhoto | null;
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;

  setPending: (p: PendingPhoto) => void;
  runAnalysis: (userPref: UserPreference | null) => Promise<void>;
  clear: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  pending: null,
  result: null,
  loading: false,
  error: null,

  setPending: (p) => set({ pending: p, result: null, error: null }),

  runAnalysis: async (userPref) => {
    const { pending } = get();
    if (!pending) {
      set({ error: '没有待分析的照片' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const result = await analyzePhotoAsync(
        pending.features,
        userPref,
        pending.source,
        pending.previewUrl,
        pending.location,
      );
      set({ result, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '分析失败,请重试',
      });
    }
  },

  clear: () => set({ pending: null, result: null, loading: false, error: null }),
}));
