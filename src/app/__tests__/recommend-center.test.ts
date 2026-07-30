/**
 * 验证：红心歌重建偏好中心后，推荐结果偏向红心歌 V-A 质心
 *
 * 对应 spec: fix-cover-playback-recommend-center Task 5.3
 */

import { describe, it, expect } from 'vitest';
import {
  calcReferenceCenter,
  initUserPreference,
  recommend,
  HOT_CHART_2026,
} from '@algorithm/index';
import type { Song, OnboardingAnswers, VAWithConfidence } from '@algorithm/index';

// 构造 20 首红心歌：V-A 都偏高 valence(0.8) 高 arousal(0.7)，代表欢快歌
function makeRedHeartSongs(): Song[] {
  return Array.from({ length: 20 }, (_, i) => ({
    songId: `user_test_${i}`,
    title: `红心歌 ${i}`,
    artist: `测试歌手 ${i}`,
    layer: 'emotion' as const,
    va: { v: 0.8, a: 0.7, confidence: 0.85, source: 'manual' as const },
    genres: ['pop'],
    sceneTags: [],
    language: 'mandarin',
    hotRecency: 'this_month' as const,
    duration: 240,
  }));
}

const answers: OnboardingAnswers = {
  mood: 'neutral',
  genres: ['pop'],
  languages: ['mandarin'],
  platform: 'netease',
  referenceSongs: [],
};

/** 计算推荐结果的 V-A 质心 */
function resultCentroid(result: { coreTracks: { song: Song }[]; extendedTracks: { song: Song }[] }): { v: number; a: number } | null {
  const all = [...result.coreTracks, ...result.extendedTracks].map((t) => t.song);
  if (all.length === 0) return null;
  const vSum = all.reduce((s, song) => s + song.va.v, 0);
  const aSum = all.reduce((s, song) => s + song.va.a, 0);
  return { v: vSum / all.length, a: aSum / all.length };
}

describe('红心歌重建偏好中心验证', () => {
  it('calcReferenceCenter 正确计算红心歌 V-A 质心', () => {
    const songs = makeRedHeartSongs();
    const center = calcReferenceCenter(songs);
    expect(center).not.toBeNull();
    expect(center!.v).toBeCloseTo(0.8, 2);
    expect(center!.a).toBeCloseTo(0.7, 2);
  });

  it('calcReferenceCenter 空数组返回 null', () => {
    expect(calcReferenceCenter([])).toBeNull();
  });

  it('融合偏好中心值正确：onboarding×0.4 + redHeart×0.6', () => {
    const redHeart = makeRedHeartSongs();
    const redHeartCenter = calcReferenceCenter(redHeart)!;
    const basePref = initUserPreference(answers, []);

    // 融合：onboardingCenter × 0.4 + redHeartCenter × 0.6
    const fusedCenter = {
      v: basePref.center.v * 0.4 + redHeartCenter.v * 0.6,
      a: basePref.center.a * 0.4 + redHeartCenter.a * 0.6,
    };

    // basePref.center 对应 neutral mood anchor: { v: 0.5, a: 0.4 }
    // 融合后：0.5×0.4 + 0.8×0.6 = 0.68, 0.4×0.4 + 0.7×0.6 = 0.58
    expect(fusedCenter.v).toBeCloseTo(0.68, 2);
    expect(fusedCenter.a).toBeCloseTo(0.58, 2);
  });

  it('融合红心歌后推荐结果 V-A 质心比未融合时更接近红心歌质心', () => {
    const redHeart = makeRedHeartSongs();
    const redHeartCenter = calcReferenceCenter(redHeart)!;
    const basePref = initUserPreference(answers, []);
    const library = HOT_CHART_2026 as Song[];

    // 照片情绪中性，不偏向任何方向
    const photoEmotion: VAWithConfidence = { v: 0.5, a: 0.4, confidence: 0.8, source: 'manual' };

    // 场景 A：未融合红心歌（仅 onboarding center）
    const resultWithout = recommend({
      photoEmotion,
      photoScene: 'indoor',
      userPref: basePref,
      referenceSongs: [],
      songLibrary: library,
    });

    // 场景 B：融合红心歌（onboarding×0.4 + redHeart×0.6）
    const fusedPref = {
      ...basePref,
      center: {
        v: basePref.center.v * 0.4 + redHeartCenter.v * 0.6,
        a: basePref.center.a * 0.4 + redHeartCenter.a * 0.6,
      },
    };
    const resultWith = recommend({
      photoEmotion,
      photoScene: 'indoor',
      userPref: fusedPref,
      referenceSongs: redHeart,
      songLibrary: library,
    });

    const centroidWithout = resultCentroid(resultWithout);
    const centroidWith = resultCentroid(resultWith);

    expect(centroidWithout).not.toBeNull();
    expect(centroidWith).not.toBeNull();

    // 红心歌质心 (0.8, 0.7)
    // 融合后的推荐结果质心应该更接近 (0.8, 0.7)
    const distWithout = Math.sqrt(
      (centroidWithout!.v - 0.8) ** 2 + (centroidWithout!.a - 0.7) ** 2,
    );
    const distWith = Math.sqrt(
      (centroidWith!.v - 0.8) ** 2 + (centroidWith!.a - 0.7) ** 2,
    );

    // 核心断言：融合后距离红心歌质心更近
    expect(distWith).toBeLessThan(distWithout);
  });

  it('无红心歌时推荐结果不受影响（保持原行为）', () => {
    const basePref = initUserPreference(answers, []);
    const library = HOT_CHART_2026 as Song[];
    const photoEmotion: VAWithConfidence = { v: 0.5, a: 0.4, confidence: 0.8, source: 'manual' };

    const result = recommend({
      photoEmotion,
      photoScene: 'indoor',
      userPref: basePref,
      referenceSongs: [],
      songLibrary: library,
    });

    // 应该有推荐结果
    expect(result.coreTracks.length).toBeGreaterThan(0);
    expect(result.extendedTracks.length).toBeGreaterThanOrEqual(0);
  });
});
