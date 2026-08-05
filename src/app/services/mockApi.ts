/**
 * Mock API — 前端调用算法的唯一入口
 *
 * 职责:
 *  1. 提供 5 张示例照片(模拟视觉模型输出的 PhotoFeatures)
 *  2. 调用算法 photoToVA + recommend 生成推荐
 *  3. 为未完成 onboarding 的用户提供默认偏好
 *  4. 暴露风格分组 / 语言选项给 onboarding UI
 *
 * 所有函数纯前端可跑,无网络请求(图片预览 URL 除外)。
 */

import {
  GENRE_DISPLAY_META,
  GENRE_GROUPS,
  GENRE_TAGS,
  LANGUAGE_TAGS,
  initUserPreference,
  photoToVA,
  recommend,
  resolveEmotionLabels,
} from '@algorithm/index';
import type {
  GenreTag,
  LanguageTag,
  OnboardingAnswers,
  PhotoFeatures,
  Song,
  UserPreference,
} from '@algorithm/index';
import type { AnalysisResult, GenreGroupUI, LanguageOption } from '../types';
import { buildDisplayLabel } from '../config/emotionDisplay';
import { useUserStore } from '../stores/userStore';

// ============================================================================
// 1. 示例照片预设(模拟视觉模型输出)
// ============================================================================

export interface SamplePhoto {
  id: string;
  title: string;
  previewUrl: string;
  features: PhotoFeatures;
  location?: string;
}

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: 'beach-sunset',
    title: '黄昏 · 海边',
    previewUrl: '/samples/beach-sunset.svg',
    location: '舟山 · 朱家尖',
    features: {
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
  },
  {
    id: 'city-night',
    title: '城市 · 夜归',
    previewUrl: '/samples/city-night.svg',
    location: '上海 · 武康路',
    features: {
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
  },
  {
    id: 'festival-fireworks',
    title: '节日 · 烟火',
    previewUrl: '/samples/festival-fireworks.svg',
    location: '大阪 · 天神祭',
    features: {
      hue: { hue: 350, tone: 'warm', confidence: 0.86 },
      luminance: { value: 0.55, level: 'mid', confidence: 0.8 },
      saturation: { value: 0.85, level: 'high', confidence: 0.85 },
      scene: { type: 'nightlife', confidence: 0.88 },
      timeOfDay: { value: 'night', confidence: 0.92 },
      weather: { value: 'starry', confidence: 0.75 },
      people: { count: 1, dominantEmotion: 'excited', confidence: 0.78 },
      composition: { type: 'bokeh', confidence: 0.82 },
      overallConfidence: 0.83,
    },
  },
  {
    id: 'rainy-window',
    title: '雨天 · 窗边',
    previewUrl: '/samples/rainy-window.svg',
    location: '杭州 · 西湖',
    features: {
      hue: { hue: 200, tone: 'cool', confidence: 0.84 },
      luminance: { value: 0.4, level: 'low', confidence: 0.78 },
      saturation: { value: 0.3, level: 'low', confidence: 0.75 },
      scene: { type: 'indoor', confidence: 0.85 },
      timeOfDay: { value: 'afternoon', confidence: 0.82 },
      weather: { value: 'rainy', confidence: 0.9 },
      people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
      composition: { type: 'closeup', confidence: 0.78 },
      overallConfidence: 0.8,
    },
  },
  {
    id: 'mountain-sunrise',
    title: '清晨 · 山顶',
    previewUrl: '/samples/mountain-sunrise.svg',
    location: '黄山 · 光明顶',
    features: {
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
  },
];

// ============================================================================
// 2. 音乐库(直接复用算法内置 HOT_CHART_2026)
// ============================================================================

/**
 * 获取音乐库
 *
 * 只用用户导入的歌曲,不掺内置热歌库。
 * 原因:
 *   - 内置热歌库的 localFile/demoFile 是 demo 阶段产物,未来要全部删除
 *   - remote 直链几小时就过期,混用会导致播放失败
 *   - 用户期望"导入什么听什么",不应出现没导入过的歌
 *
 * 未导入时返回空数组(推荐自然返回空,UI 显示"未导入歌曲"提示)。
 */
export function getMockLibrary(): Song[] {
  const userSongs = useUserStore.getState().importedSongs ?? [];
  // 数据迁移:修正旧导入歌的属性(hotRecency + confidence)
  return userSongs.map((song) => {
    if (!song.songId.startsWith('user_')) return song;
    return {
      ...song,
      hotRecency: 'this_month' as const,
      va: { ...song.va, confidence: Math.max(song.va.confidence, 0.75) },
    };
  });
}

// ============================================================================
// 3. 默认用户偏好(未完成 onboarding 时使用)
// ============================================================================

const DEFAULT_ONBOARDING_ANSWERS: OnboardingAnswers = {
  ageRange: '23-27',
  platform: 'netease',
  referenceSongs: [],
  mood: 'neutral',
  genres: ['rap', 'rnb', 'electronic'],
  languages: ['mandarin', 'english'],
};

/** 为未完成 onboarding 的用户构造默认偏好(冷启动) */
export function createDefaultUserPref(): UserPreference {
  return initUserPreference(DEFAULT_ONBOARDING_ANSWERS, []);
}

// ============================================================================
// 4. 照片分析 → 推荐主流程(调用真实算法)
// ============================================================================

/**
 * 分析一张照片并生成推荐
 *
 * @param photo 视觉特征(模拟视觉模型输出)
 * @param userPref 用户偏好(为 null 时用默认偏好)
 * @param source 照片来源
 * @param previewUrl 预览图 URL
 */
export function analyzePhoto(
  photo: PhotoFeatures,
  userPref: UserPreference | null,
  source: AnalysisResult['source'] = 'sample',
  previewUrl?: string,
  _location?: string,
): AnalysisResult {
  const pref = userPref ?? createDefaultUserPref();
  const library = getMockLibrary();

  // 步骤 1:照片 → V-A
  const photoVA = photoToVA(photo);

  // 用户导入的红心歌作为参考歌曲(前 20 首),用于相似度计算(score_ref_sim)
  // 注意:偏好中心已由 PlatformQRModal 通过 applyMultiSourcePreference 更新到 userPref,
  // 这里不再重复计算红心质心,避免覆盖三维度画像
  const userStore = useUserStore.getState();
  const referenceSongs = userStore.importedSongsBySource.liked.slice(0, 20);

  // 直接使用传入的 userPref(已含多维度偏好中心)
  const effectivePref = pref;

  // 步骤 2:推荐(跳过 GPS 融合,mock 阶段不模拟定位)
  // 透传 AI 产出的 musicIntent(五维),让 calcMatchScore 走五维+VA 综合匹配;
  // musicIntent 缺失(Qwen 降级/mock 照片)时算法自动退化为纯 V-A 模式
  const recommendation = recommend({
    photoEmotion: photoVA,
    photoScene: photo.scene.type,
    userPref: effectivePref,
    referenceSongs,
    songLibrary: library,
    musicIntent: photo.musicIntent,
  });

  // 步骤 3:解析情绪标签
  const emotionResult = resolveEmotionLabels(photoVA);

  // 步骤 4:用户导入歌曲优先排前
  // 不改算法选曲,只对最终推荐结果内部重排,把 songId 以 user_ 开头的歌提到各自数组前面
  // 这样推荐列表第一眼看到的就是用户扫码导入的歌,MusicPlayer 默认播第一首即导入歌
  const reorderedRecommendation = {
    ...recommendation,
    coreTracks: prioritizeImportedTracks(recommendation.coreTracks),
    extendedTracks: prioritizeImportedTracks(recommendation.extendedTracks),
  };

  return {
    recommendation: reorderedRecommendation,
    photoVA: { v: photoVA.v, a: photoVA.a },
    primaryLabel: emotionResult.primary,
    secondaryLabel: emotionResult.secondary,
    isMixed: emotionResult.isMixed,
    source,
    previewUrl: previewUrl ?? '',
  };
}

/**
 * 把已入选的导入歌曲排到数组前面,保持其他歌曲相对顺序
 *
 * 导入歌曲识别:songId 以 'user_' 开头(见 musicLibrary.ts makeSongId)
 * 若数组里没有导入歌曲,原样返回(避免无谓拷贝)
 */
function prioritizeImportedTracks<T extends { song: { songId: string } }>(tracks: readonly T[]): T[] {
  if (tracks.length <= 1) return [...tracks];
  const imported = tracks.filter((t) => t.song.songId.startsWith('user_'));
  if (imported.length === 0) return [...tracks];
  const others = tracks.filter((t) => !t.song.songId.startsWith('user_'));
  return [...imported, ...others];
}

/** 异步包装(模拟网络延迟,用于 UI loading 态) */
export function analyzePhotoAsync(
  photo: PhotoFeatures,
  userPref: UserPreference | null,
  source?: AnalysisResult['source'],
  previewUrl?: string,
  location?: string,
): Promise<AnalysisResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(analyzePhoto(photo, userPref, source, previewUrl, location));
    }, 600);
  });
}

/** 构造展示标签(主+次,如 "温柔 · 惬意") */
export function buildEmotionDisplayLabel(
  primary: AnalysisResult['primaryLabel'],
  secondary?: AnalysisResult['secondaryLabel'],
): string {
  return buildDisplayLabel(primary, secondary);
}

// ============================================================================
// 5. Onboarding UI 数据源
// ============================================================================

/** 风格分组(来自算法 GENRE_GROUPS + GENRE_DISPLAY_META) */
export function getGenreGroups(): GenreGroupUI[] {
  return GENRE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    tags: GENRE_TAGS.filter((tag) => GENRE_DISPLAY_META[tag]?.group === group.id).map(
      (tag) => ({
        id: tag,
        label: GENRE_DISPLAY_META[tag]?.label ?? tag,
        desc: GENRE_DISPLAY_META[tag]?.desc ?? '',
        hot: GENRE_DISPLAY_META[tag]?.hot ?? 1,
      }),
    ),
  }));
}

/** 语言选项 */
export function getLanguageOptions(): LanguageOption[] {
  const labels: Record<LanguageTag, string> = {
    mandarin: '华语',
    english: '欧美',
    korean: '韩语',
    japanese: '日语',
    cantonese: '粤语',
    instrumental: '纯音乐',
    other: '其他',
  };
  return LANGUAGE_TAGS.map((id) => ({ id, label: labels[id] }));
}

/** 热门风格(用于 onboarding 快速选择,top 6 by hotness) */
export function getHotGenres(): GenreTag[] {
  return [...GENRE_TAGS]
    .sort((a, b) => (GENRE_DISPLAY_META[b]?.hot ?? 0) - (GENRE_DISPLAY_META[a]?.hot ?? 0))
    .slice(0, 8);
}
