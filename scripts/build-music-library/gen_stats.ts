/**
 * gen_stats.ts
 *
 * 生成统一曲库的统计报告，输出到 data/unified_library_stats.json 并打印到 stdout。
 *
 * 统计内容：
 * - 三平台各自歌曲数、去重后总数
 * - 各 GenreTag 分布
 * - V-A 覆盖范围、象限分布、置信度分布
 * - layer 分布、语言分布
 * - 未归一化标签列表
 *
 * 用法: npx tsx scripts/build-music-library/gen_stats.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface Song {
  songId: string;
  title: string;
  artist: string;
  layer: 'hot' | 'emotion' | 'fallback';
  va: { v: number; a: number; confidence: number; source: string };
  genres: string[];
  sceneTags: string[];
  language: string;
  hotRecency: string;
  decade?: number;
}

interface UnifiedSong {
  title: string;
  artist: string;
  platforms: string[];
  appearCount: number;
  primaryGenres: string[];
  subGenres: string[];
  emotionTags: string[];
  sceneTags: string[];
  eraTags: number[];
  languageTags: string[];
  sourceTags: string[];
  instrumentTags: string[];
  unmappedTags: string[];
}

function main(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const PROJECT_ROOT = path.resolve(__dirname, '../..');
  const DATA_DIR = path.join(PROJECT_ROOT, 'data');

  console.log('=== 统一曲库统计报告 ===\n');

  // 读取数据
  const libraryPath = path.join(DATA_DIR, 'unified_library.json');
  const tagsPath = path.join(DATA_DIR, 'unified_tags.json');

  const songs = JSON.parse(fs.readFileSync(libraryPath, 'utf-8')) as Song[];
  const unifiedSongs = JSON.parse(fs.readFileSync(tagsPath, 'utf-8')) as UnifiedSong[];

  // 平台统计
  const platformCounts = new Map<string, number>();
  for (const u of unifiedSongs) {
    for (const p of u.platforms) {
      platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);
    }
  }

  // GenreTag 分布
  const genreCounts = new Map<string, number>();
  for (const s of songs) {
    for (const g of s.genres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }

  // V-A 统计
  let vMin = 1, vMax = 0, aMin = 1, aMax = 0;
  let vSum = 0, aSum = 0, confSum = 0;
  const quadrants = { '高V高A': 0, '高V低A': 0, '低V高A': 0, '低V低A': 0 };
  const confBuckets = { '≥0.85': 0, '0.70-0.85': 0, '0.50-0.70': 0, '<0.50': 0 };
  const sourceCounts = new Map<string, number>();

  for (const s of songs) {
    vSum += s.va.v;
    aSum += s.va.a;
    confSum += s.va.confidence;
    if (s.va.v < vMin) vMin = s.va.v;
    if (s.va.v > vMax) vMax = s.va.v;
    if (s.va.a < aMin) aMin = s.va.a;
    if (s.va.a > aMax) aMax = s.va.a;

    if (s.va.v >= 0.5 && s.va.a >= 0.5) quadrants['高V高A']++;
    else if (s.va.v >= 0.5 && s.va.a < 0.5) quadrants['高V低A']++;
    else if (s.va.v < 0.5 && s.va.a >= 0.5) quadrants['低V高A']++;
    else quadrants['低V低A']++;

    if (s.va.confidence >= 0.85) confBuckets['≥0.85']++;
    else if (s.va.confidence >= 0.70) confBuckets['0.70-0.85']++;
    else if (s.va.confidence >= 0.50) confBuckets['0.50-0.70']++;
    else confBuckets['<0.50']++;

    sourceCounts.set(s.va.source, (sourceCounts.get(s.va.source) ?? 0) + 1);
  }

  // Layer 分布
  const layerCounts = { hot: 0, emotion: 0, fallback: 0 };
  for (const s of songs) layerCounts[s.layer]++;

  // 语言分布
  const langCounts = new Map<string, number>();
  for (const s of songs) langCounts.set(s.language, (langCounts.get(s.language) ?? 0) + 1);

  // 未归一化标签统计
  const unmappedCounts = new Map<string, number>();
  for (const u of unifiedSongs) {
    for (const tag of u.unmappedTags) {
      unmappedCounts.set(tag, (unmappedCounts.get(tag) ?? 0) + 1);
    }
  }

  // 情绪标签分布
  const emotionCounts = new Map<string, number>();
  for (const u of unifiedSongs) {
    for (const tag of u.emotionTags) {
      emotionCounts.set(tag, (emotionCounts.get(tag) ?? 0) + 1);
    }
  }

  // 构建报告对象
  const report = {
    summary: {
      totalSongs: songs.length,
      platformCounts: Object.fromEntries(platformCounts),
    },
    genreDistribution: Object.fromEntries(
      Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]),
    ),
    vaStats: {
      vRange: [Number(vMin.toFixed(4)), Number(vMax.toFixed(4))],
      aRange: [Number(aMin.toFixed(4)), Number(aMax.toFixed(4))],
      avgV: Number((vSum / songs.length).toFixed(4)),
      avgA: Number((aSum / songs.length).toFixed(4)),
      avgConfidence: Number((confSum / songs.length).toFixed(4)),
      quadrants,
      confidenceBuckets: confBuckets,
      sourceDistribution: Object.fromEntries(sourceCounts),
    },
    layerDistribution: layerCounts,
    languageDistribution: Object.fromEntries(
      Array.from(langCounts.entries()).sort((a, b) => b[1] - a[1]),
    ),
    emotionTagDistribution: Object.fromEntries(
      Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1]),
    ),
    unmappedTags: Object.fromEntries(
      Array.from(unmappedCounts.entries()).sort((a, b) => b[1] - a[1]),
    ),
  };

  // 写入文件
  const outputPath = path.join(DATA_DIR, 'unified_library_stats.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  // 打印到 stdout
  console.log('## 概览');
  console.log(`  去重后总歌曲数: ${songs.length}`);
  console.log(`  平台分布:`);
  for (const [p, c] of platformCounts) {
    console.log(`    ${p}: ${c}`);
  }

  console.log('\n## V-A 统计');
  console.log(`  V 范围: [${vMin.toFixed(4)}, ${vMax.toFixed(4)}]`);
  console.log(`  A 范围: [${aMin.toFixed(4)}, ${aMax.toFixed(4)}]`);
  console.log(`  平均 V: ${(vSum / songs.length).toFixed(4)}`);
  console.log(`  平均 A: ${(aSum / songs.length).toFixed(4)}`);
  console.log(`  平均 confidence: ${(confSum / songs.length).toFixed(4)}`);
  console.log(`  象限分布:`);
  for (const [q, c] of Object.entries(quadrants)) {
    console.log(`    ${q}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }
  console.log(`  置信度分布:`);
  for (const [b, c] of Object.entries(confBuckets)) {
    console.log(`    ${b}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }
  console.log(`  Source 分布:`);
  for (const [src, c] of sourceCounts) {
    console.log(`    ${src}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n## GenreTag 分布 Top 15');
  const genreTop = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [g, c] of genreTop) {
    console.log(`  ${g}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n## Layer 分布');
  for (const [l, c] of Object.entries(layerCounts)) {
    console.log(`  ${l}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n## 语言分布');
  for (const [lang, c] of Array.from(langCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang}: ${c} (${((c / songs.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n## 情绪标签分布 Top 10');
  const emotionTop = Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [tag, c] of emotionTop) {
    console.log(`  ${tag}: ${c}`);
  }

  if (unmappedCounts.size > 0) {
    console.log('\n## 未归一化标签 Top 20（供人工补映射）');
    const unmappedTop = Array.from(unmappedCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [tag, c] of unmappedTop) {
      console.log(`  ${tag}: ${c}`);
    }
  } else {
    console.log('\n## 未归一化标签: 无');
  }

  console.log(`\n✓ 统计报告已写入: ${outputPath}`);
}

main();
