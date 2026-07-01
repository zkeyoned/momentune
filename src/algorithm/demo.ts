/**
 * Momentune 算法模块 - 调用示例
 *
 * 展示完整调用链:
 * 1. 照片特征 → V-A(photoToVA)
 * 2. GPS 融合(fuseVisualAndGPS)
 * 3. 用户偏好初始化(initUserPreference)
 * 4. 两阶段推荐(recommend)
 * 5. 用户交互 → 偏好更新(processInteraction)
 *
 * 运行: npm run demo
 *
 * @module algorithm/demo
 */

import {
  // 照片 → V-A
  photoToVA,
  // GPS 融合
  fuseVisualAndGPS,
  buildGPSReverseResult,
  // 推荐
  recommend,
  // 用户偏好
  initUserPreference,
  processInteraction,
  // 工具
  findNearestEmotionLabel,
  resolveEmotionLabels,
  calcVADistance,
  // 配置(展示调参)
  MATCH_WEIGHTS,
  EMOTION_VA_COORDINATES,
  // 类型
  type PhotoFeatures,
  type Song,
  type OnboardingAnswers,
  type InteractionEvent,
  type GPSCoordinate,
  type POIInfo,
} from './index.js';

// ============================================================================
// 工具:格式化输出
// ============================================================================

function fmtVA(v: number, a: number): string {
  return `(V=${v.toFixed(2)}, A=${a.toFixed(2)})`;
}

function fmtScore(s: number): string {
  return s.toFixed(3);
}

// ============================================================================
// 1. 构造照片视觉特征(模拟视觉模型输出)
// ============================================================================

function createSamplePhoto(): PhotoFeatures {
  return {
    hue: { hue: 210, tone: 'cool', confidence: 0.85 },
    luminance: { value: 0.35, level: 'low', confidence: 0.80 },
    saturation: { value: 0.45, level: 'mid', confidence: 0.75 },
    scene: { type: 'city', confidence: 0.90 },
    timeOfDay: { value: 'night', confidence: 0.95 },
    weather: { value: 'cloudy', confidence: 0.70 },
    people: { count: 0, dominantEmotion: 'none', confidence: 0.90 },
    composition: { type: 'landscape', confidence: 0.80 },
    overallConfidence: 0.82,
  };
}

// ============================================================================
// 2. 构造音乐库(模拟 3 层:hot/emotion/fallback)
// ============================================================================

function createSampleLibrary(): Song[] {
  const songs: Song[] = [];

  // 辅助:按情绪标签构造歌曲
  const make = (
    id: string,
    title: string,
    artist: string,
    layer: Song['layer'],
    label: keyof typeof EMOTION_VA_COORDINATES,
    genres: Song['genres'],
    sceneTags: Song['sceneTags'],
    language: Song['language'] = 'mandarin',
    hotRecency: Song['hotRecency'] = 'never',
    decade = 2020,
  ): Song => {
    const va = EMOTION_VA_COORDINATES[label];
    return {
      songId: id,
      title,
      artist,
      layer,
      va: { v: va.v, a: va.a, confidence: layer === 'fallback' ? 0.65 : 0.85, source: 'manual' },
      genres,
      sceneTags,
      language,
      hotRecency,
      decade,
    };
  };

  // 热歌层(hot):抖音/汽水/网易云榜单
  songs.push(make('h1', '孤勇者', '陈奕迅', 'hot', 'Epic', ['pop'], ['city_night'], 'mandarin', 'this_month', 2020));
  songs.push(make('h2', '起风了', '买辣椒也用券', 'hot', 'Nostalgic', ['pop'], ['campus'], 'mandarin', 'this_month', 2018));
  songs.push(make('h3', '错位时空', '艾辰', 'hot', 'Missing', ['pop'], ['late_night_emo'], 'mandarin', 'this_week', 2021));
  songs.push(make('h4', '白月光与朱砂痣', '大籽', 'hot', 'Romantic', ['pop'], ['cafe_afternoon'], 'mandarin', 'this_month', 2020));
  songs.push(make('h5', '飞鸟和蝉', '任然', 'hot', 'Melancholic', ['pop'], ['seaside_dusk'], 'mandarin', 'half_year', 2020));
  songs.push(make('h6', '踏山河', '是七叔呢', 'hot', 'Epic', ['guofeng'], ['travel'], 'mandarin', 'this_month', 2021));
  songs.push(make('h7', '黑月光', '毛不易', 'hot', 'Dark', ['pop'], ['city_night'], 'mandarin', 'half_year', 2023));
  songs.push(make('h8', '星辰大海', '黄霄雲', 'hot', 'Exciting', ['pop'], ['morning_sunrise'], 'mandarin', 'this_week', 2021));

  // 情绪层(emotion):emo163 数据集
  songs.push(make('e1', '夜曲', '周杰伦', 'emotion', 'Melancholic', ['pop', 'rnb'], ['late_night_emo'], 'mandarin', 'older', 2005));
  songs.push(make('e2', '晴天', '周杰伦', 'emotion', 'Nostalgic', ['pop'], ['campus'], 'mandarin', 'older', 2003));
  songs.push(make('e3', '七里香', '周杰伦', 'emotion', 'Romantic', ['pop'], ['cafe_afternoon'], 'mandarin', 'older', 2004));
  songs.push(make('e4', '稻香', '周杰伦', 'emotion', 'Healing', ['pop', 'folk'], ['morning_sunrise'], 'mandarin', 'older', 2008));
  songs.push(make('e5', '遇见', '孙燕姿', 'emotion', 'Missing', ['pop'], ['rainy_window'], 'mandarin', 'older', 2003));
  songs.push(make('e6', '后来', '刘若英', 'emotion', 'Touching', ['pop'], ['campus'], 'mandarin', 'older', 2001));
  songs.push(make('e7', '成都', '赵雷', 'emotion', 'Nostalgic', ['folk'], ['travel'], 'mandarin', 'older', 2017));
  songs.push(make('e8', '理想三旬', '陈鸿宇', 'emotion', 'Melancholic', ['folk'], ['rainy_window'], 'mandarin', 'older', 2015));
  songs.push(make('e9', '南山南', '马頔', 'emotion', 'Lonely', ['folk'], ['late_night_emo'], 'mandarin', 'older', 2014));
  songs.push(make('e10', '奇妙能力歌', '陈粒', 'emotion', 'Fresh', ['folk'], ['cafe_afternoon'], 'mandarin', 'older', 2015));
  songs.push(make('e11', '光年之外', '邓紫棋', 'emotion', 'Epic', ['pop'], ['travel'], 'mandarin', 'older', 2016));
  songs.push(make('e12', '泡沫', '邓紫棋', 'emotion', 'Touching', ['pop'], ['late_night_emo'], 'mandarin', 'older', 2014));

  // 兜底层(fallback):免版权
  songs.push(make('f1', '安静钢琴曲', 'RoyaltyFree', 'fallback', 'Peaceful', ['lofi'], ['cafe_afternoon'], 'instrumental', 'never', 2020));
  songs.push(make('f2', '雨夜轻音乐', 'RoyaltyFree', 'fallback', 'Relaxing', ['lofi'], ['rainy_window'], 'instrumental', 'never', 2020));
  songs.push(make('f3', '深夜电子', 'RoyaltyFree', 'fallback', 'Dark', ['electronic'], ['city_night'], 'instrumental', 'never', 2021));
  songs.push(make('f4', '晨光Ambient', 'RoyaltyFree', 'fallback', 'Fresh', ['electronic'], ['morning_sunrise'], 'instrumental', 'never', 2020));
  songs.push(make('f5', '公路旅行BGM', 'RoyaltyFree', 'fallback', 'Exciting', ['electronic'], ['road_trip'], 'instrumental', 'never', 2021));
  songs.push(make('f6', '海边Lo-fi', 'RoyaltyFree', 'fallback', 'Dreamy', ['lofi'], ['seaside_dusk'], 'instrumental', 'never', 2020));

  return songs;
}

// ============================================================================
// 3. 模拟 GPS 反查
// ============================================================================

function simulateGPSReverse(coord: GPSCoordinate, poi: POIInfo) {
  return buildGPSReverseResult(coord, poi, 'amap');
}

// ============================================================================
// 主流程
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('  Momentune 图片-音乐情绪匹配算法 Demo');
  console.log('='.repeat(70));

  // ─── 步骤 1:照片 → V-A ───
  console.log('\n📸 步骤 1:照片视觉特征 → V-A 坐标');
  console.log('-'.repeat(50));

  const photo = createSamplePhoto();
  console.log('输入照片特征:');
  console.log(`  色调: hue=${photo.hue.hue}° (${photo.hue.tone})`);
  console.log(`  亮度: ${photo.luminance.value} (${photo.luminance.level})`);
  console.log(`  饱和度: ${photo.saturation.value} (${photo.saturation.level})`);
  console.log(`  场景: ${photo.scene.type}`);
  console.log(`  时段: ${photo.timeOfDay.value}`);
  console.log(`  天气: ${photo.weather.value}`);
  console.log(`  人物: ${photo.people.count}人`);

  const visualVA = photoToVA(photo);
  console.log(`\n视觉 V-A: ${fmtVA(visualVA.v, visualVA.a)}`);
  console.log(`  置信度: ${fmtScore(visualVA.confidence)}`);
  console.log(`  最近情绪标签: ${findNearestEmotionLabel(visualVA)}`);

  // ─── 步骤 2:GPS 融合 ───
  console.log('\n📍 步骤 2:GPS 辅助融合');
  console.log('-'.repeat(50));

  const gpsCoord: GPSCoordinate = { lat: 31.2304, lng: 121.4737 };
  const poi: POIInfo = {
    name: '外滩',
    typeCode: '110100',
    category: '风景名胜',
    district: '上海市黄浦区',
  };
  const gpsResult = simulateGPSReverse(gpsCoord, poi);
  console.log(`GPS 反查: ${gpsResult.poi.name} (${gpsResult.poi.category})`);
  console.log(`  映射场景: ${gpsResult.mappedScene ?? '未识别'}`);
  if (gpsResult.mappedVA) {
    console.log(`  GPS V-A: ${fmtVA(gpsResult.mappedVA.v, gpsResult.mappedVA.a)}`);
  }

  const photoHour = 23; // 深夜 23:00
  const fusion = fuseVisualAndGPS({
    visualVA,
    gpsResult,
    photoHour,
  });
  console.log(`\n融合策略: ${fusion.strategy}`);
  console.log(`融合 V-A: ${fmtVA(fusion.va.v, fusion.va.a)}`);
  console.log(`  置信度: ${fmtScore(fusion.va.confidence)}`);
  console.log(`  GPS 参与: ${fusion.gpsUsed ? '是' : '否(视觉置信度够高)'}`);
  console.log(`  深夜修正: ${photoHour >= 22 || photoHour < 5 ? '已应用(V-0.08, A-0.10)' : '未应用'}`);
  console.log(`  低置信度: ${fusion.lowConfidence ? '⚠️ 是' : '✓ 否'}`);

  const emotionResult = resolveEmotionLabels(fusion.va);
  console.log(`\n情绪标签:`);
  console.log(`  主导: ${emotionResult.primary}`);
  if (emotionResult.secondary) {
    console.log(`  次要: ${emotionResult.secondary}`);
  }
  console.log(`  混合情绪: ${emotionResult.isMixed ? '是' : '否'}`);

  // ─── 步骤 3:用户偏好初始化 ───
  console.log('\n👤 步骤 3:用户偏好初始化(首次问卷)');
  console.log('-'.repeat(50));

  const answers: OnboardingAnswers = {
    platform: 'netease',
    referenceSongs: [
      { title: '夜曲', artist: '周杰伦' },
      { title: '成都', artist: '赵雷' },
    ],
    mood: 'empathizing',
    genres: ['pop', 'folk'],
    languages: ['mandarin'],
  };

  const library = createSampleLibrary();
  const referenceSongs = library.filter(
    (s) => answers.referenceSongs.some((r) => r.title === s.title),
  );

  const userPref = initUserPreference(answers, referenceSongs);
  console.log(`问卷答案:`);
  console.log(`  平台: ${answers.platform}`);
  console.log(`  情绪偏好: ${answers.mood}`);
  console.log(`  风格: ${answers.genres.join(', ')}`);
  console.log(`  参考歌: ${referenceSongs.map((s) => s.title).join(', ')}`);
  console.log(`\n偏好中心: ${fmtVA(userPref.center.v, userPref.center.a)}`);
  console.log(`  冷启动: ${userPref.isColdStart ? '是' : '否'}`);

  // ─── 步骤 4:两阶段推荐 ───
  console.log('\n🎵 步骤 4:两阶段推荐');
  console.log('-'.repeat(50));
  console.log(`音乐库: ${library.length} 首(hot ${library.filter((s) => s.layer === 'hot').length} + emotion ${library.filter((s) => s.layer === 'emotion').length} + fallback ${library.filter((s) => s.layer === 'fallback').length})`);

  const result = recommend({
    photoEmotion: fusion.va,
    photoScene: fusion.derivedScene ?? 'city',
    userPref,
    referenceSongs,
    songLibrary: library,
  });

  console.log(`\n推荐结果:`);
  console.log(`  总数: ${result.meta.total} 首`);
  console.log(`  主导情绪: ${result.primaryLabel}${result.isMixedEmotion ? ` + ${result.secondaryLabel}(混合)` : ''}`);
  console.log(`  GPS 使用: ${result.gpsUsed ? '是' : '否'}`);
  console.log(`  探索曲: ${result.meta.exploreFlag ? '是' : '否'}`);
  console.log(`  来源分布: hot ${result.meta.sourceBreakdown.hot} / emotion ${result.meta.sourceBreakdown.emotion} / fallback ${result.meta.sourceBreakdown.fallback}`);

  console.log(`\n核心 8 首:`);
  result.coreTracks.forEach((track, i) => {
    const label = findNearestEmotionLabel(track.song.va);
    const dist = calcVADistance(fusion.va, track.song.va);
    console.log(
      `  ${i + 1}. ${track.song.title} - ${track.song.artist}` +
      ` [${track.song.layer}] ${label}` +
      ` 分=${fmtScore(track.breakdown.finalScore)}` +
      ` 距离=${fmtScore(dist)}` +
      `${track.isExplore ? ' ⭐探索' : ''}`,
    );
  });

  console.log(`\n扩展曲(${result.extendedTracks.length} 首):`);
  result.extendedTracks.forEach((track, i) => {
    const label = findNearestEmotionLabel(track.song.va);
    console.log(
      `  ${i + 1}. ${track.song.title} - ${track.song.artist}` +
      ` [${track.song.layer}] ${label}` +
      ` 分=${fmtScore(track.breakdown.finalScore)}` +
      (track.extendedFromSongId ? ` ←扩展自 ${track.extendedFromSongId}` : ''),
    );
  });

  // ─── 步骤 5:模拟用户交互 → 偏好更新 ───
  console.log('\n🔄 步骤 5:用户交互 → 偏好更新(EMA 学习)');
  console.log('-'.repeat(50));

  const firstSong = result.coreTracks[0]!;
  const event: InteractionEvent = {
    songId: firstSong.song.songId,
    songVA: firstSong.song.va,
    genres: firstSong.song.genres,
    language: firstSong.song.language,
    signal: 'save_diary',
    hour: 23,
    emotionLabel: findNearestEmotionLabel(firstSong.song.va),
    timestamp: Date.now(),
  };

  console.log(`交互: ${event.signal} → ${firstSong.song.title}`);

  const updatedPref = processInteraction(userPref, event);
  console.log(`\n偏好变化:`);
  console.log(`  中心: ${fmtVA(userPref.center.v, userPref.center.a)} → ${fmtVA(updatedPref.center.v, updatedPref.center.a)}`);
  console.log(`  交互次数: ${userPref.interactionCount} → ${updatedPref.interactionCount}`);
  console.log(`  冷启动: ${userPref.isColdStart ? '是' : '否'} → ${updatedPref.isColdStart ? '是' : '否'}`);

  // 风格权重变化
  console.log(`  风格权重变化:`);
  for (const g of firstSong.song.genres) {
    const oldW = userPref.genreWeights[g];
    const newW = updatedPref.genreWeights[g];
    if (oldW !== newW) {
      console.log(`    ${g}: ${oldW.toFixed(2)} → ${newW.toFixed(2)}`);
    }
  }

  // ─── 展示调参能力 ───
  console.log('\n⚙️ 附:匹配权重配置(调参参考)');
  console.log('-'.repeat(50));
  console.log('当前 MATCH_WEIGHTS:');
  for (const [key, val] of Object.entries(MATCH_WEIGHTS)) {
    console.log(`  ${key}: ${val}`);
  }
  console.log(`  总和: ${Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)}`);

  console.log('\n' + '='.repeat(70));
  console.log('  Demo 完成');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('Demo 运行失败:', err);
  process.exit(1);
});
