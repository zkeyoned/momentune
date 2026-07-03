/**
 * Momentune 前端 — 应用层类型
 *
 * 这些类型仅服务于前端 UI 层,不污染算法模块。
 * 算法相关类型一律从 @algorithm/index 引入。
 */

import type {
  EmotionLabel,
  GenreTag,
  LanguageTag,
  PhotoFeatures,
  PlatformPreference,
  RecommendationResult,
  Song,
  VACoordinate,
} from '@algorithm/index';

/** 一篇图文音乐日记 */
export interface JournalEntry {
  /** 稳定 ID(前端生成,时间戳基) */
  id: string;
  /** 创建时间戳(ms) */
  createdAt: number;
  /** 照片预览(mock: 用渐变或占位图 URL) */
  photoUrl: string;
  /** 照片缩略名(用于卡片标题) */
  photoTitle: string;
  /** 算法输入(原始视觉特征) */
  photoFeatures: PhotoFeatures;
  /** 情绪信息(算法输出,前端展示用) */
  emotion: {
    va: VACoordinate;
    primary: EmotionLabel;
    secondary?: EmotionLabel;
    isMixed: boolean;
    /** 展示用中文短语,如 "温柔 · 惬意" */
    displayLabel: string;
  };
  /** 推荐歌曲 Top 3(保存为日记时记录) */
  songs: Song[];
  /** 用户写的感想文字 */
  text: string;
  /** GPS 反查地点(若有) */
  location?: string;
}

/** 音乐平台账号(mock) */
export interface PlatformAccount {
  id: PlatformPreference;
  name: string;
  /** 中文显示名 */
  label: string;
  /** 是否已登录 */
  loggedIn: boolean;
  /** 账号昵称(mock) */
  nickname?: string;
  /** 主题色 */
  color: string;
  /** 是否开放接入(未开放的平台置灰,不可点击) */
  available?: boolean;
}

/** 推荐 + 照片分析的复合结果(页面消费) */
export interface AnalysisResult {
  /** 算法推荐结果 */
  recommendation: RecommendationResult;
  /** 照片 V-A(融合后) */
  photoVA: VACoordinate;
  /** 主导情绪标签 */
  primaryLabel: EmotionLabel;
  /** 次要情绪标签 */
  secondaryLabel?: EmotionLabel;
  /** 是否混合情绪 */
  isMixed: boolean;
  /** 照片来源(本地上传 / 相机拍摄) */
  source: 'camera' | 'album' | 'sample';
  /** 照片预览 URL */
  previewUrl: string;
}

/** 风格分组(前端 onboarding 用,来自算法 GENRE_GROUPS) */
export interface GenreGroupUI {
  id: string;
  label: string;
  tags: Array<{
    id: GenreTag;
    label: string;
    desc: string;
    hot: number;
  }>;
}

/** 语言标签(前端用) */
export interface LanguageOption {
  id: LanguageTag;
  label: string;
}
