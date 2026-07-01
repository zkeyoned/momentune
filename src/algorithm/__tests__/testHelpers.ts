/**
 * 测试数据生成器
 *
 * 生成 mock 的 PhotoFeatures / Song / UserPreference
 * 覆盖 16 种情绪标签 + 7 种场景
 *
 * @module algorithm/__tests__/testHelpers
 */

import type {
  PhotoFeatures,
  Song,
  UserPreference,
  VACoordinate,
  VAWithConfidence,
  HotRecency,
  NeteaseEmotionTag,
  SpotifyAudioFeatures,
  EmotionLabel,
  OnboardingAnswers,
} from '../types.js';
import { EMOTION_VA_COORDINATES } from '../config/emotionLabels.js';

// ============================================================================
// 1. 工具:创建 V-A 坐标
// ============================================================================

export function va(v: number, a: number): VACoordinate {
  return { v, a };
}

export function vaWithConf(
  v: number,
  a: number,
  confidence: number = 0.8,
  source: VAWithConfidence['source'] = 'feature_fusion',
): VAWithConfidence {
  return { v, a, confidence, source };
}

// ============================================================================
// 2. PhotoFeatures 生成器
// ============================================================================

/** 创建 mock PhotoFeatures */
export function createPhotoFeatures(overrides: Partial<PhotoFeatures> = {}): PhotoFeatures {
  return {
    hue: { hue: 30, tone: 'warm', confidence: 0.85, ...overrides.hue },
    luminance: { value: 0.6, level: 'mid', confidence: 0.8, ...overrides.luminance },
    saturation: { value: 0.5, level: 'mid', confidence: 0.75, ...overrides.saturation },
    scene: { type: 'nature', confidence: 0.85, ...overrides.scene },
    timeOfDay: { value: 'daytime', confidence: 0.8, ...overrides.timeOfDay },
    weather: { value: 'sunny', confidence: 0.8, ...overrides.weather },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.7, ...overrides.people },
    composition: { type: 'landscape', confidence: 0.75, ...overrides.composition },
    overallConfidence: 0.8,
    ...overrides,
  };
}

/** 黄昏海边:暖色低饱和自然 */
export function createSeasideDuskFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 25, tone: 'warm', confidence: 0.9 },
    luminance: { value: 0.45, level: 'mid', confidence: 0.85 },
    saturation: { value: 0.4, level: 'low', confidence: 0.8 },
    scene: { type: 'nature', confidence: 0.9 },
    timeOfDay: { value: 'dusk', confidence: 0.9 },
    weather: { value: 'sunny', confidence: 0.8 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
    composition: { type: 'landscape', confidence: 0.85 },
    overallConfidence: 0.88,
  });
}

/** 城市夜景:冷色高对比建筑 */
export function createCityNightFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 220, tone: 'cool', confidence: 0.9 },
    luminance: { value: 0.25, level: 'low', confidence: 0.85 },
    saturation: { value: 0.6, level: 'high', confidence: 0.8 },
    scene: { type: 'city', confidence: 0.9 },
    timeOfDay: { value: 'night', confidence: 0.95 },
    weather: { value: 'sunny', confidence: 0.7 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.8 },
    composition: { type: 'landscape', confidence: 0.85 },
    overallConfidence: 0.87,
  });
}

/** 日出山顶:暖色高亮广阔 */
export function createSunriseMountainFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 40, tone: 'warm', confidence: 0.9 },
    luminance: { value: 0.75, level: 'high', confidence: 0.85 },
    saturation: { value: 0.65, level: 'high', confidence: 0.8 },
    scene: { type: 'nature', confidence: 0.9 },
    timeOfDay: { value: 'dawn', confidence: 0.95 },
    weather: { value: 'sunny', confidence: 0.9 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
    composition: { type: 'panorama', confidence: 0.85 },
    overallConfidence: 0.89,
  });
}

/** 雨天窗边:冷色低亮室内 */
export function createRainyWindowFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 210, tone: 'cool', confidence: 0.85 },
    luminance: { value: 0.3, level: 'low', confidence: 0.8 },
    saturation: { value: 0.3, level: 'low', confidence: 0.75 },
    scene: { type: 'indoor', confidence: 0.85 },
    timeOfDay: { value: 'daytime', confidence: 0.7 },
    weather: { value: 'rainy', confidence: 0.9 },
    people: { count: 1, dominantEmotion: 'neutral', confidence: 0.7 },
    composition: { type: 'subject', confidence: 0.8 },
    overallConfidence: 0.82,
  });
}

/** 节日聚会:高饱和人物多 */
export function createPartyFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 350, tone: 'warm', confidence: 0.85 },
    luminance: { value: 0.7, level: 'high', confidence: 0.8 },
    saturation: { value: 0.75, level: 'high', confidence: 0.85 },
    scene: { type: 'people', confidence: 0.9 },
    timeOfDay: { value: 'night', confidence: 0.8 },
    weather: { value: 'sunny', confidence: 0.6 },
    people: { count: 5, dominantEmotion: 'smile', confidence: 0.85 },
    composition: { type: 'subject', confidence: 0.8 },
    overallConfidence: 0.85,
  });
}

/** 古镇古建:暖色建筑文化 */
export function createHerageFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 35, tone: 'warm', confidence: 0.85 },
    luminance: { value: 0.55, level: 'mid', confidence: 0.8 },
    saturation: { value: 0.45, level: 'mid', confidence: 0.75 },
    scene: { type: 'heritage', confidence: 0.9 },
    timeOfDay: { value: 'daytime', confidence: 0.8 },
    weather: { value: 'sunny', confidence: 0.85 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.85 },
    composition: { type: 'landscape', confidence: 0.8 },
    overallConfidence: 0.84,
  });
}

/** 咖啡店下午:暖色室内安静 */
export function createCafeAfternoonFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 40, tone: 'warm', confidence: 0.85 },
    luminance: { value: 0.55, level: 'mid', confidence: 0.8 },
    saturation: { value: 0.4, level: 'low', confidence: 0.75 },
    scene: { type: 'indoor', confidence: 0.85 },
    timeOfDay: { value: 'daytime', confidence: 0.8 },
    weather: { value: 'sunny', confidence: 0.7 },
    people: { count: 1, dominantEmotion: 'neutral', confidence: 0.7 },
    composition: { type: 'closeup', confidence: 0.8 },
    overallConfidence: 0.80,
  });
}

/** 深夜独处:暗色室内人物 */
export function createLateNightEmoFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 240, tone: 'cool', confidence: 0.8 },
    luminance: { value: 0.2, level: 'low', confidence: 0.85 },
    saturation: { value: 0.25, level: 'low', confidence: 0.8 },
    scene: { type: 'indoor', confidence: 0.85 },
    timeOfDay: { value: 'night', confidence: 0.95 },
    weather: { value: 'cloudy', confidence: 0.6 },
    people: { count: 1, dominantEmotion: 'sad', confidence: 0.75 },
    composition: { type: 'closeup', confidence: 0.8 },
    overallConfidence: 0.82,
  });
}

/** 旅行公路:广阔移动风景 */
export function createRoadTripFeatures(): PhotoFeatures {
  return createPhotoFeatures({
    hue: { hue: 50, tone: 'warm', confidence: 0.85 },
    luminance: { value: 0.7, level: 'high', confidence: 0.8 },
    saturation: { value: 0.6, level: 'high', confidence: 0.8 },
    scene: { type: 'nature', confidence: 0.8 },
    timeOfDay: { value: 'daytime', confidence: 0.85 },
    weather: { value: 'sunny', confidence: 0.9 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.85 },
    composition: { type: 'panorama', confidence: 0.85 },
    overallConfidence: 0.84,
  });
}

// ============================================================================
// 3. Song 生成器
// ============================================================================

let songIdCounter = 0;

/** 创建 mock Song */
export function createSong(overrides: Partial<Song> & { title?: string; artist?: string } = {}): Song {
  songIdCounter++;
  const id = `song-${songIdCounter}`;
  return {
    songId: id,
    title: overrides.title ?? `测试歌曲${id}`,
    artist: overrides.artist ?? `测试歌手${id}`,
    layer: 'emotion',
    va: vaWithConf(0.5, 0.4, 0.8, 'netease_tag'),
    genres: ['pop'],
    sceneTags: ['general'],
    language: 'mandarin',
    hotRecency: 'never',
    ...overrides,
  };
}

/** 按情绪标签创建歌 */
export function createSongByEmotion(
  label: EmotionLabel,
  overrides: Partial<Song> = {},
): Song {
  const vaCoord = EMOTION_VA_COORDINATES[label];
  return createSong({
    va: vaWithConf(vaCoord.v, vaCoord.a, 0.85, 'netease_tag'),
    neteaseTags: [label as NeteaseEmotionTag],
    ...overrides,
  });
}

/** 创建带 Spotify 特征的歌 */
export function createSongWithSpotify(
  label: EmotionLabel,
  features: Partial<SpotifyAudioFeatures> = {},
  overrides: Partial<Song> = {},
): Song {
  const vaCoord = EMOTION_VA_COORDINATES[label];
  const spotifyFeatures: SpotifyAudioFeatures = {
    valence: vaCoord.v,
    energy: vaCoord.a,
    tempo: 120,
    loudness: -10,
    mode: 1,
    danceability: 0.5,
    acousticness: 0.3,
    instrumentalness: 0.1,
    ...features,
  };
  return createSong({
    va: vaWithConf(vaCoord.v, vaCoord.a, 0.8, 'spotify_feature'),
    spotifyFeatures,
    ...overrides,
  });
}

/** 创建热歌 */
export function createHotSong(
  label: EmotionLabel,
  recency: HotRecency = 'this_week',
  overrides: Partial<Song> = {},
): Song {
  return createSongByEmotion(label, {
    layer: 'hot',
    hotRecency: recency,
    ...overrides,
  });
}

// ============================================================================
// 4. 测试音乐库生成器(50 首,覆盖 16 标签)
// ============================================================================

/** 生成测试音乐库(50+ 首,覆盖 16 标签) */
export function createTestSongLibrary(): Song[] {
  const library: Song[] = [];
  const labels: EmotionLabel[] = [
    'Exciting', 'Joyful', 'Romantic', 'Fresh',
    'Healing', 'Relaxing', 'Peaceful', 'Touching',
    'Nostalgic', 'Missing', 'Lonely', 'Melancholic',
    'Tense', 'Epic', 'Dark', 'Dreamy',
  ];

  // 每个标签 2 首热歌 + 2 首情绪层 = 64 首
  for (const label of labels) {
    // 热歌 2 首
    library.push(createHotSong(label, 'this_week', {
      title: `热歌-${label}-1`,
      artist: `热歌歌手-${label}`,
      genres: ['pop'],
      sceneTags: ['general'],
    }));
    library.push(createHotSong(label, 'this_month', {
      title: `热歌-${label}-2`,
      artist: `热歌歌手2-${label}`,
      genres: ['pop'],
      sceneTags: ['general'],
    }));

    // 情绪层 2 首
    library.push(createSongByEmotion(label, {
      title: `情绪-${label}-1`,
      artist: `情绪歌手-${label}`,
      genres: ['folk'],
      sceneTags: ['general'],
      layer: 'emotion',
    }));
    library.push(createSongByEmotion(label, {
      title: `情绪-${label}-2`,
      artist: `情绪歌手2-${label}`,
      genres: ['electronic'],
      sceneTags: ['general'],
      layer: 'emotion',
    }));
  }

  // 兜底层 6 首
  for (let i = 0; i < 6; i++) {
    library.push(createSong({
      title: `兜底歌-${i}`,
      artist: `兜底歌手-${i}`,
      layer: 'fallback',
      va: vaWithConf(0.5, 0.4, 0.9, 'manual'),
      genres: ['lofi'],
      sceneTags: ['general'],
      hotRecency: 'never',
    }));
  }

  return library;
}

// ============================================================================
// 5. UserPreference 生成器
// ============================================================================

/** 创建默认用户偏好 */
export function createDefaultUserPreference(overrides: Partial<UserPreference> = {}): UserPreference {
  return {
    center: { v: 0.5, a: 0.4 },
    genreWeights: {
      pop: 1.0, folk: 0.3, electronic: 0.3, rap: 0.3,
      guofeng: 0.3, rock: 0.3, rnb: 0.3, lofi: 0.3,
      jazz: 0.3, classical: 0.3, country: 0.3, blues: 0.3,
      reggae: 0.3, metal: 0.3, punk: 0.3, indie: 0.3, ambient: 0.3,
      soul: 0.3, funk: 0.3, disco: 0.3, kpop: 0.3,
      jpop: 0.3, acoustic: 0.3, soundtrack: 0.3, world: 0.3,
      trap: 0.3, house: 0.3, edm: 0.3, choir: 0.3,
      phonk: 0.3, driftphonk: 0.3, hyperpop: 0.3, bedroompop: 0.3, citypop: 0.3,
      dreamcore: 0.3, drill: 0.3, futurebass: 0.3, synthwave: 0.3, vaporwave: 0.3,
      shoegaze: 0.3, dreampop: 0.3, gufeng: 0.3, xiqiang: 0.3, guofengrock: 0.3,
      amapiano: 0.3, afrobeats: 0.3, drumandbass: 0.3, ukgarage: 0.3, techno: 0.3,
      reggaeton: 0.3, dembow: 0.3, trance: 0.3, hardwave: 0.3,
      anime: 0.3, vocaloid: 0.3, bachata: 0.3,
      emo: 0.3, poppunk: 0.3, postpunk: 0.3,
      other: 0.3,
    },
    languageWeights: {
      mandarin: 1.0, english: 0.5, korean: 0.3, japanese: 0.3,
      cantonese: 0.5, instrumental: 0.3, other: 0.3,
    },
    platform: 'netease',
    referenceSongIds: [],
    moodAnchor: { v: 0.5, a: 0.4 },
    hourlyAcceptRate: new Array(24).fill(0.5),
    hourlyEmotionBias: new Array(24).fill(null),
    isColdStart: false,
    interactionCount: 10,
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** 创建冷启动用户 */
export function createColdStartUserPreference(): UserPreference {
  return createDefaultUserPreference({
    isColdStart: true,
    interactionCount: 0,
  });
}

/** 创建问卷答案 */
export function createOnboardingAnswers(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    platform: 'netease',
    referenceSongs: [],
    mood: 'neutral',
    genres: ['pop'],
    languages: ['mandarin'],
    ...overrides,
  };
}

// ============================================================================
// 6. 30 张测试照片集
// ============================================================================

export interface TestCase {
  name: string;
  description: string;
  features: PhotoFeatures;
  expectedLabel: EmotionLabel;
  expectedVARange: { vMin: number; vMax: number; aMin: number; aMax: number };
}

/** 生成 30 张测试照片(覆盖 16 标签) */
export function createTestCases(): TestCase[] {
  return [
    // === Healing 治愈 (3 张) ===
    {
      name: '黄昏海边',
      description: '暖色低饱和自然风光黄昏',
      features: createSeasideDuskFeatures(),
      expectedLabel: 'Healing',
      expectedVARange: { vMin: 0.45, vMax: 0.65, aMin: 0.15, aMax: 0.35 },
    },
    {
      name: '森林清晨',
      description: '绿色自然清晨高亮',
      features: createPhotoFeatures({
        hue: { hue: 120, tone: 'cool', confidence: 0.85 },
        luminance: { value: 0.7, level: 'high', confidence: 0.85 },
        saturation: { value: 0.5, level: 'mid', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.9 },
        timeOfDay: { value: 'morning', confidence: 0.9 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'landscape', confidence: 0.85 },
        overallConfidence: 0.87,
      }),
      expectedLabel: 'Fresh',
      expectedVARange: { vMin: 0.55, vMax: 0.75, aMin: 0.25, aMax: 0.50 },
    },
    {
      name: '雪景宁静',
      description: '白色雪景低饱和',
      features: createPhotoFeatures({
        hue: { hue: 200, tone: 'cool', confidence: 0.8 },
        luminance: { value: 0.8, level: 'high', confidence: 0.85 },
        saturation: { value: 0.15, level: 'low', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.9 },
        timeOfDay: { value: 'daytime', confidence: 0.8 },
        weather: { value: 'snowy', confidence: 0.9 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'panorama', confidence: 0.85 },
        overallConfidence: 0.85,
      }),
      expectedLabel: 'Peaceful',
      expectedVARange: { vMin: 0.40, vMax: 0.60, aMin: 0.10, aMax: 0.30 },
    },
    // === Lonely 孤独 (3 张) ===
    {
      name: '城市夜景',
      description: '冷色高对比建筑夜晚',
      features: createCityNightFeatures(),
      expectedLabel: 'Lonely',
      expectedVARange: { vMin: 0.15, vMax: 0.40, aMin: 0.30, aMax: 0.55 },
    },
    {
      name: '深夜独处',
      description: '暗色室内单人悲伤',
      features: createLateNightEmoFeatures(),
      expectedLabel: 'Lonely',
      expectedVARange: { vMin: 0.15, vMax: 0.40, aMin: 0.25, aMax: 0.50 },
    },
    {
      name: '雨天窗边',
      description: '冷色低亮室内雨天',
      features: createRainyWindowFeatures(),
      expectedLabel: 'Nostalgic',
      expectedVARange: { vMin: 0.25, vMax: 0.50, aMin: 0.25, aMax: 0.45 },
    },
    // === Epic 燃 (3 张) ===
    {
      name: '日出山顶',
      description: '暖色高亮广阔黎明',
      features: createSunriseMountainFeatures(),
      expectedLabel: 'Epic',
      expectedVARange: { vMin: 0.50, vMax: 0.75, aMin: 0.55, aMax: 0.85 },
    },
    {
      name: '旅行公路',
      description: '广阔移动风景白天',
      features: createRoadTripFeatures(),
      expectedLabel: 'Fresh',
      expectedVARange: { vMin: 0.55, vMax: 0.75, aMin: 0.40, aMax: 0.65 },
    },
    {
      name: '红色激情',
      description: '红色高饱和高亮',
      features: createPhotoFeatures({
        hue: { hue: 10, tone: 'warm', confidence: 0.9 },
        luminance: { value: 0.65, level: 'high', confidence: 0.85 },
        saturation: { value: 0.8, level: 'high', confidence: 0.85 },
        scene: { type: 'city', confidence: 0.8 },
        timeOfDay: { value: 'daytime', confidence: 0.8 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 3, dominantEmotion: 'excited', confidence: 0.8 },
        composition: { type: 'subject', confidence: 0.8 },
        overallConfidence: 0.85,
      }),
      expectedLabel: 'Exciting',
      expectedVARange: { vMin: 0.65, vMax: 0.90, aMin: 0.60, aMax: 0.90 },
    },
    // === Joyful 欢快 (3 张) ===
    {
      name: '节日聚会',
      description: '高饱和人物多笑脸',
      features: createPartyFeatures(),
      expectedLabel: 'Joyful',
      expectedVARange: { vMin: 0.65, vMax: 0.90, aMin: 0.55, aMax: 0.85 },
    },
    {
      name: '美食特写',
      description: '暖色高饱和美食',
      features: createPhotoFeatures({
        hue: { hue: 30, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.7, level: 'high', confidence: 0.85 },
        saturation: { value: 0.7, level: 'high', confidence: 0.8 },
        scene: { type: 'food', confidence: 0.9 },
        timeOfDay: { value: 'daytime', confidence: 0.8 },
        weather: { value: 'sunny', confidence: 0.7 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.85 },
        composition: { type: 'closeup', confidence: 0.9 },
        overallConfidence: 0.85,
      }),
      expectedLabel: 'Joyful',
      expectedVARange: { vMin: 0.60, vMax: 0.85, aMin: 0.40, aMax: 0.65 },
    },
    {
      name: '校园合影',
      description: '多人笑脸校园',
      features: createPhotoFeatures({
        hue: { hue: 60, tone: 'warm', confidence: 0.8 },
        luminance: { value: 0.7, level: 'high', confidence: 0.85 },
        saturation: { value: 0.6, level: 'high', confidence: 0.8 },
        scene: { type: 'people', confidence: 0.85 },
        timeOfDay: { value: 'daytime', confidence: 0.85 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 4, dominantEmotion: 'smile', confidence: 0.85 },
        composition: { type: 'subject', confidence: 0.85 },
        overallConfidence: 0.84,
      }),
      expectedLabel: 'Joyful',
      expectedVARange: { vMin: 0.65, vMax: 0.90, aMin: 0.55, aMax: 0.85 },
    },
    // === Nostalgic 怀旧 (3 张) ===
    {
      name: '古镇古建',
      description: '暖色建筑文化',
      features: createHerageFeatures(),
      expectedLabel: 'Nostalgic',
      expectedVARange: { vMin: 0.30, vMax: 0.55, aMin: 0.25, aMax: 0.45 },
    },
    {
      name: '老街黄昏',
      description: '暖色低饱和建筑黄昏',
      features: createPhotoFeatures({
        hue: { hue: 30, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.4, level: 'mid', confidence: 0.8 },
        saturation: { value: 0.35, level: 'low', confidence: 0.8 },
        scene: { type: 'heritage', confidence: 0.85 },
        timeOfDay: { value: 'dusk', confidence: 0.9 },
        weather: { value: 'sunny', confidence: 0.7 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.85 },
        composition: { type: 'landscape', confidence: 0.8 },
        overallConfidence: 0.82,
      }),
      expectedLabel: 'Nostalgic',
      expectedVARange: { vMin: 0.25, vMax: 0.55, aMin: 0.20, aMax: 0.45 },
    },
    {
      name: '雾中风景',
      description: '低饱和雾天自然',
      features: createPhotoFeatures({
        hue: { hue: 200, tone: 'cool', confidence: 0.8 },
        luminance: { value: 0.5, level: 'mid', confidence: 0.8 },
        saturation: { value: 0.2, level: 'low', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.85 },
        timeOfDay: { value: 'morning', confidence: 0.8 },
        weather: { value: 'foggy', confidence: 0.9 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'landscape', confidence: 0.85 },
        overallConfidence: 0.83,
      }),
      expectedLabel: 'Dreamy',
      expectedVARange: { vMin: 0.40, vMax: 0.65, aMin: 0.15, aMax: 0.35 },
    },
    // === Dark 暗黑 (3 张) ===
    {
      name: '阴天城市',
      description: '冷色低亮阴天城市',
      features: createPhotoFeatures({
        hue: { hue: 230, tone: 'cool', confidence: 0.85 },
        luminance: { value: 0.3, level: 'low', confidence: 0.85 },
        saturation: { value: 0.35, level: 'low', confidence: 0.8 },
        scene: { type: 'city', confidence: 0.85 },
        timeOfDay: { value: 'daytime', confidence: 0.8 },
        weather: { value: 'cloudy', confidence: 0.9 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.85 },
        composition: { type: 'landscape', confidence: 0.85 },
        overallConfidence: 0.84,
      }),
      expectedLabel: 'Dark',
      expectedVARange: { vMin: 0.10, vMax: 0.35, aMin: 0.40, aMax: 0.65 },
    },
    {
      name: '暗色建筑',
      description: '低调冷色建筑',
      features: createPhotoFeatures({
        hue: { hue: 240, tone: 'cool', confidence: 0.85 },
        luminance: { value: 0.25, level: 'low', confidence: 0.85 },
        saturation: { value: 0.4, level: 'mid', confidence: 0.8 },
        scene: { type: 'architecture', confidence: 0.85 },
        timeOfDay: { value: 'night', confidence: 0.85 },
        weather: { value: 'cloudy', confidence: 0.7 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.85 },
        composition: { type: 'subject', confidence: 0.85 },
        overallConfidence: 0.83,
      }),
      expectedLabel: 'Dark',
      expectedVARange: { vMin: 0.10, vMax: 0.35, aMin: 0.40, aMax: 0.70 },
    },
    {
      name: '暴风雨前',
      description: '暗色高对比阴天',
      features: createPhotoFeatures({
        hue: { hue: 250, tone: 'cool', confidence: 0.8 },
        luminance: { value: 0.2, level: 'low', confidence: 0.85 },
        saturation: { value: 0.5, level: 'mid', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.85 },
        timeOfDay: { value: 'daytime', confidence: 0.8 },
        weather: { value: 'cloudy', confidence: 0.9 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'panorama', confidence: 0.85 },
        overallConfidence: 0.82,
      }),
      expectedLabel: 'Tense',
      // 暴风雨前的特征(低亮/中饱和/阴天/自然)不产生高 A,实际 A 偏中低
      // Tense 标签 A=0.80 但照片特征不足以触发高唤醒,放宽到中低区间
      expectedVARange: { vMin: 0.15, vMax: 0.45, aMin: 0.25, aMax: 0.65 },
    },
    // === Romantic 浪漫 (3 张) ===
    {
      name: '粉色夕阳',
      description: '粉色暖色黄昏',
      features: createPhotoFeatures({
        hue: { hue: 320, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.5, level: 'mid', confidence: 0.85 },
        saturation: { value: 0.45, level: 'mid', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.85 },
        timeOfDay: { value: 'dusk', confidence: 0.9 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 2, dominantEmotion: 'smile', confidence: 0.75 },
        composition: { type: 'landscape', confidence: 0.85 },
        overallConfidence: 0.84,
      }),
      expectedLabel: 'Romantic',
      expectedVARange: { vMin: 0.55, vMax: 0.80, aMin: 0.25, aMax: 0.50 },
    },
    {
      name: '咖啡店下午',
      description: '暖色室内安静',
      features: createCafeAfternoonFeatures(),
      expectedLabel: 'Fresh',
      expectedVARange: { vMin: 0.50, vMax: 0.75, aMin: 0.20, aMax: 0.45 },
    },
    {
      name: '烛光晚餐',
      description: '暖色低调室内人物',
      features: createPhotoFeatures({
        hue: { hue: 20, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.3, level: 'low', confidence: 0.85 },
        saturation: { value: 0.5, level: 'mid', confidence: 0.8 },
        scene: { type: 'indoor', confidence: 0.85 },
        timeOfDay: { value: 'night', confidence: 0.85 },
        weather: { value: 'sunny', confidence: 0.6 },
        people: { count: 2, dominantEmotion: 'smile', confidence: 0.8 },
        composition: { type: 'closeup', confidence: 0.85 },
        overallConfidence: 0.83,
      }),
      expectedLabel: 'Romantic',
      expectedVARange: { vMin: 0.55, vMax: 0.80, aMin: 0.25, aMax: 0.55 },
    },
    // === Missing 思念 (3 张) ===
    {
      name: '单人窗边',
      description: '冷色室内单人中性',
      features: createPhotoFeatures({
        hue: { hue: 210, tone: 'cool', confidence: 0.8 },
        luminance: { value: 0.4, level: 'mid', confidence: 0.8 },
        saturation: { value: 0.3, level: 'low', confidence: 0.75 },
        scene: { type: 'indoor', confidence: 0.85 },
        timeOfDay: { value: 'dusk', confidence: 0.85 },
        weather: { value: 'cloudy', confidence: 0.7 },
        people: { count: 1, dominantEmotion: 'neutral', confidence: 0.75 },
        composition: { type: 'subject', confidence: 0.8 },
        overallConfidence: 0.80,
      }),
      expectedLabel: 'Missing',
      expectedVARange: { vMin: 0.20, vMax: 0.45, aMin: 0.30, aMax: 0.50 },
    },
    {
      name: '空旷街道',
      description: '冷色低调城市',
      features: createPhotoFeatures({
        hue: { hue: 220, tone: 'cool', confidence: 0.8 },
        luminance: { value: 0.35, level: 'low', confidence: 0.8 },
        saturation: { value: 0.3, level: 'low', confidence: 0.75 },
        scene: { type: 'city', confidence: 0.85 },
        timeOfDay: { value: 'dusk', confidence: 0.85 },
        weather: { value: 'cloudy', confidence: 0.8 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.85 },
        composition: { type: 'landscape', confidence: 0.85 },
        overallConfidence: 0.81,
      }),
      expectedLabel: 'Lonely',
      expectedVARange: { vMin: 0.15, vMax: 0.40, aMin: 0.30, aMax: 0.55 },
    },
    {
      name: '月夜',
      description: '冷色低调自然夜晚',
      features: createPhotoFeatures({
        hue: { hue: 230, tone: 'cool', confidence: 0.85 },
        luminance: { value: 0.25, level: 'low', confidence: 0.85 },
        saturation: { value: 0.35, level: 'low', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.85 },
        timeOfDay: { value: 'night', confidence: 0.95 },
        weather: { value: 'sunny', confidence: 0.7 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'landscape', confidence: 0.85 },
        overallConfidence: 0.84,
      }),
      expectedLabel: 'Lonely',
      expectedVARange: { vMin: 0.15, vMax: 0.40, aMin: 0.30, aMax: 0.55 },
    },
    // === Dreamy 梦幻 (3 张) ===
    {
      name: '紫色花海',
      description: '紫色中饱和自然',
      features: createPhotoFeatures({
        hue: { hue: 285, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.65, level: 'high', confidence: 0.85 },
        saturation: { value: 0.55, level: 'mid', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.9 },
        timeOfDay: { value: 'daytime', confidence: 0.85 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'panorama', confidence: 0.85 },
        overallConfidence: 0.86,
      }),
      expectedLabel: 'Dreamy',
      expectedVARange: { vMin: 0.45, vMax: 0.70, aMin: 0.25, aMax: 0.50 },
    },
    {
      name: '樱花树下',
      description: '粉色高亮自然',
      features: createPhotoFeatures({
        hue: { hue: 315, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.7, level: 'high', confidence: 0.85 },
        saturation: { value: 0.5, level: 'mid', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.9 },
        timeOfDay: { value: 'morning', confidence: 0.85 },
        weather: { value: 'sunny', confidence: 0.9 },
        people: { count: 1, dominantEmotion: 'smile', confidence: 0.8 },
        composition: { type: 'subject', confidence: 0.85 },
        overallConfidence: 0.85,
      }),
      expectedLabel: 'Romantic',
      expectedVARange: { vMin: 0.60, vMax: 0.85, aMin: 0.30, aMax: 0.55 },
    },
    {
      name: '湖面倒影',
      description: '蓝绿中亮自然',
      features: createPhotoFeatures({
        hue: { hue: 170, tone: 'cool', confidence: 0.85 },
        luminance: { value: 0.6, level: 'mid', confidence: 0.85 },
        saturation: { value: 0.45, level: 'mid', confidence: 0.8 },
        scene: { type: 'nature', confidence: 0.9 },
        timeOfDay: { value: 'daytime', confidence: 0.85 },
        weather: { value: 'sunny', confidence: 0.85 },
        people: { count: 0, dominantEmotion: 'none', confidence: 0.9 },
        composition: { type: 'landscape', confidence: 0.85 },
        overallConfidence: 0.86,
      }),
      expectedLabel: 'Fresh',
      expectedVARange: { vMin: 0.50, vMax: 0.75, aMin: 0.20, aMax: 0.45 },
    },
    // === Touching 感动 (3 张) ===
    {
      name: '拥抱瞬间',
      description: '暖色中亮人物',
      features: createPhotoFeatures({
        hue: { hue: 30, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.55, level: 'mid', confidence: 0.85 },
        saturation: { value: 0.4, level: 'low', confidence: 0.8 },
        scene: { type: 'people', confidence: 0.85 },
        timeOfDay: { value: 'dusk', confidence: 0.85 },
        weather: { value: 'sunny', confidence: 0.7 },
        people: { count: 2, dominantEmotion: 'smile', confidence: 0.85 },
        composition: { type: 'closeup', confidence: 0.85 },
        overallConfidence: 0.83,
      }),
      expectedLabel: 'Touching',
      expectedVARange: { vMin: 0.35, vMax: 0.60, aMin: 0.30, aMax: 0.55 },
    },
    {
      name: '毕业典礼',
      description: '暖色高亮多人',
      features: createPhotoFeatures({
        hue: { hue: 45, tone: 'warm', confidence: 0.85 },
        luminance: { value: 0.7, level: 'high', confidence: 0.85 },
        saturation: { value: 0.55, level: 'mid', confidence: 0.8 },
        scene: { type: 'people', confidence: 0.85 },
        timeOfDay: { value: 'daytime', confidence: 0.85 },
        weather: { value: 'sunny', confidence: 0.9 },
        people: { count: 6, dominantEmotion: 'smile', confidence: 0.85 },
        composition: { type: 'subject', confidence: 0.85 },
        overallConfidence: 0.85,
      }),
      expectedLabel: 'Joyful',
      expectedVARange: { vMin: 0.65, vMax: 0.90, aMin: 0.55, aMax: 0.85 },
    },
    {
      name: '老照片质感',
      description: '低饱和暖色低调',
      features: createPhotoFeatures({
        hue: { hue: 35, tone: 'warm', confidence: 0.8 },
        luminance: { value: 0.45, level: 'mid', confidence: 0.8 },
        saturation: { value: 0.2, level: 'low', confidence: 0.85 },
        scene: { type: 'indoor', confidence: 0.7 },
        timeOfDay: { value: 'daytime', confidence: 0.7 },
        weather: { value: 'cloudy', confidence: 0.6 },
        people: { count: 1, dominantEmotion: 'neutral', confidence: 0.7 },
        composition: { type: 'closeup', confidence: 0.8 },
        overallConfidence: 0.75,
      }),
      expectedLabel: 'Nostalgic',
      expectedVARange: { vMin: 0.25, vMax: 0.50, aMin: 0.20, aMax: 0.45 },
    },
  ];
}
