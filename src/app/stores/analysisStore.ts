/**
 * 分析流程状态:跨页面传递"待分析照片" + 推荐结果
 *
 * 流程:HomePage 选照片 → setPending → 跳转 /result → ResultPage 调 runAnalysis
 */

import { create } from 'zustand';
import type { PhotoFeatures, UserPreference } from '@algorithm/index';
import { analyzePhotoAsync } from '../services/mockApi';
import { estimatePhotoFeatures } from '../services/photoHeuristic';
import { analyzePhotoWithQwen } from '../services/visionApi';
import type { AnalysisResult } from '../types';

export interface PendingPhoto {
  features: PhotoFeatures;
  previewUrl: string;
  source: AnalysisResult['source'];
  title: string;
  location?: string;
  /**
   * 标记:features 为占位值,需在 runAnalysis 阶段用 Canvas 重新估计。
   * 相机/相册上传(无预设 features)置 true;示例照片置 false。
   */
  needsFeatureEstimation?: boolean;
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
      // 若 features 为占位值(相机/相册上传),需重新估计真实特征。
      // 三层兜底,任何情况下分析流程不卡死:
      //   1. Qwen-VL 视觉大模型(真实看懂照片内容)
      //   2. Canvas 像素统计 + 模板匹配(photoHeuristic)
      //   3. estimatePhotoFeatures 内部失败时自带的随机兜底
      // 这一阶段在 ResultPage 的 loading 态下进行,用户可见"AI 正在感受…"。
      let features = pending.features;
      if (pending.needsFeatureEstimation) {
        try {
          features = await analyzePhotoWithQwen(pending.previewUrl);
        } catch {
          // Qwen 失败(无 key/超时/网络/解析错误)→ 降级到 Canvas
          features = await estimatePhotoFeatures(pending.previewUrl);
        }
        // 用估计结果回填 pending,后续保存日记时使用真实特征
        set({ pending: { ...pending, features, needsFeatureEstimation: false } });
      }
      const result = await analyzePhotoAsync(
        features,
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
