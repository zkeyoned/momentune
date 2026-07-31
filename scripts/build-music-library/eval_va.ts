/**
 * eval_va.ts
 *
 * V-A 金标准评测脚本：用人工标注的 141 首金标准歌曲（data/va_golden_set.json）
 * 校验当前管线产出的曲库（data/unified_library.json）的 V-A 预测质量。
 *
 * 评测流程：
 * 1. 读取金标准 songs 数组与统一曲库 Song[] 数组
 * 2. 用归一化 key（normalize(title) + '|' + normalize(artist)）将曲库建成 Map
 * 3. 遍历金标准逐首匹配，记录匹配成功 / 未匹配
 * 4. 对匹配成功的歌曲计算：V MAE、A MAE、四象限命中率（阈值 0.5）
 *
 * 输出指标：
 * - matchedCount / totalCount
 * - vMae、aMae（平均绝对误差）
 * - quadrantAccuracy、quadrantHits（命中分布）
 * - unmatched 未匹配歌曲列表
 *
 * 报告写入 data/eval_va_report.json：
 * - 不带参数：写入 baseline 字段（首次基线用），保留已有 iterations 数组。
 * - 带 --label <name>：追加到 iterations 数组（同 label 覆盖），保留 baseline 不变。
 *
 * 用法:
 *   npx tsx scripts/build-music-library/eval_va.ts                 # 写 baseline
 *   npx tsx scripts/build-music-library/eval_va.ts --label xxx     # 写 iterations[label=xxx]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface GoldenSong {
  title: string;
  artist: string;
  v: number;
  a: number;
}

interface LibrarySong {
  songId: string;
  title: string;
  artist: string;
  va: { v: number; a: number; confidence: number; source: string };
}

interface UnmatchedSong {
  title: string;
  artist: string;
}

interface EvalResult {
  matchedCount: number;
  totalCount: number;
  vMae: number;
  aMae: number;
  quadrantAccuracy: number;
  quadrantHits: { '高V高A': number; '高V低A': number; '低V高A': number; '低V低A': number };
  unmatched: UnmatchedSong[];
}

type QuadrantKey = '高V高A' | '高V低A' | '低V高A' | '低V低A';

/**
 * 归一化单段字符串（title 或 artist）：
 * 1. 去掉中文（）与英文 () 括号及其内容
 * 2. 去掉所有非字母数字非 CJK 字符（保留中文、假名、谚文、拉丁字母数字）
 * 3. toLowerCase
 * 4. 去掉所有空白
 */
function normalizeSegment(s: string): string {
  let t = s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
  t = t.replace(/[^\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7afa-z0-9]/gi, '');
  t = t.toLowerCase();
  t = t.replace(/\s+/g, '');
  return t;
}

/** 拼接 title 与 artist 成归一化匹配 key */
function normalizeKey(title: string, artist: string): string {
  return `${normalizeSegment(title)}|${normalizeSegment(artist)}`;
}

/** 按 0.5 阈值判定四象限 */
function quadrantOf(v: number, a: number): QuadrantKey {
  if (v >= 0.5 && a >= 0.5) return '高V高A';
  if (v >= 0.5 && a < 0.5) return '高V低A';
  if (v < 0.5 && a >= 0.5) return '低V高A';
  return '低V低A';
}

function main(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const PROJECT_ROOT = path.resolve(__dirname, '../..');
  const DATA_DIR = path.join(PROJECT_ROOT, 'data');

  console.log('=== eval_va: V-A 金标准评测 ===\n');

  // 读取数据
  const goldenPath = path.join(DATA_DIR, 'va_golden_set.json');
  const libraryPath = path.join(DATA_DIR, 'unified_library.json');

  const goldenRaw = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as {
    meta: { count: number };
    songs: GoldenSong[];
  };
  const goldenSongs = goldenRaw.songs;

  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8')) as LibrarySong[];

  console.log(`读取金标准: ${goldenSongs.length} 首`);
  console.log(`读取曲库: ${library.length} 首`);

  // 构建曲库 Map（first-wins，保留靠前的主版本）
  const libMap = new Map<string, LibrarySong>();
  for (const song of library) {
    const key = normalizeKey(song.title, song.artist);
    if (!libMap.has(key)) libMap.set(key, song);
  }

  // 匹配并计算指标
  let vMaeSum = 0;
  let aMaeSum = 0;
  let quadrantHitCount = 0;
  const quadrantHits: EvalResult['quadrantHits'] = {
    '高V高A': 0,
    '高V低A': 0,
    '低V高A': 0,
    '低V低A': 0,
  };
  const unmatched: UnmatchedSong[] = [];

  for (const g of goldenSongs) {
    const key = normalizeKey(g.title, g.artist);
    const matched = libMap.get(key);
    if (!matched) {
      unmatched.push({ title: g.title, artist: g.artist });
      continue;
    }
    const dv = Math.abs(matched.va.v - g.v);
    const da = Math.abs(matched.va.a - g.a);
    vMaeSum += dv;
    aMaeSum += da;

    const predQ = quadrantOf(matched.va.v, matched.va.a);
    const goldQ = quadrantOf(g.v, g.a);
    if (predQ === goldQ) {
      quadrantHitCount++;
      quadrantHits[goldQ]++;
    }
  }

  const matchedCount = goldenSongs.length - unmatched.length;
  const vMae = matchedCount > 0 ? vMaeSum / matchedCount : 0;
  const aMae = matchedCount > 0 ? aMaeSum / matchedCount : 0;
  const quadrantAccuracy = matchedCount > 0 ? quadrantHitCount / matchedCount : 0;

  const result: EvalResult = {
    matchedCount,
    totalCount: goldenSongs.length,
    vMae: Number(vMae.toFixed(4)),
    aMae: Number(aMae.toFixed(4)),
    quadrantAccuracy: Number(quadrantAccuracy.toFixed(4)),
    quadrantHits,
    unmatched,
  };

  // 打印匹配结果
  console.log('\n=== 匹配结果 ===');
  console.log(`匹配成功: ${matchedCount} / ${goldenSongs.length}`);
  console.log(`未匹配: ${unmatched.length} 首`);
  for (const u of unmatched) {
    console.log(`  ${u.title} - ${u.artist}`);
  }

  // 打印基线分数
  console.log('\n=== 基线分数 ===');
  console.log(`V MAE: ${result.vMae.toFixed(4)}`);
  console.log(`A MAE: ${result.aMae.toFixed(4)}`);
  console.log(`四象限命中率: ${result.quadrantAccuracy.toFixed(4)} (${quadrantHitCount}/${matchedCount})`);
  console.log('象限命中分布:');
  for (const [q, c] of Object.entries(quadrantHits)) {
    console.log(`  ${q}: ${c}`);
  }

  // 解析 --label 参数：有参数时写入 iterations[label]，无参数时写入 baseline（首次基线用）
  const labelArg = process.argv.find(a => a.startsWith('--label='));
  const labelIdx = process.argv.indexOf('--label');
  const label = labelArg ? labelArg.slice('--label='.length)
    : (labelIdx !== -1 && process.argv[labelIdx + 1] ? process.argv[labelIdx + 1] : null);

  // 写入报告（有 --label 时追加到 iterations；无 --label 时更新 baseline，保留已有 iterations）
  const reportPath = path.join(DATA_DIR, 'eval_va_report.json');
  let existingBaseline: unknown = null;
  let iterations: unknown[] = [];
  if (fs.existsSync(reportPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as { baseline?: unknown; iterations?: unknown[] };
      if (existing.baseline !== undefined) existingBaseline = existing.baseline;
      if (Array.isArray(existing.iterations)) iterations = existing.iterations;
    } catch {
      // 解析失败则忽略，使用空 iterations
    }
  }

  const entry = {
    matchedCount: result.matchedCount,
    totalCount: result.totalCount,
    vMae: result.vMae,
    aMae: result.aMae,
    quadrantAccuracy: result.quadrantAccuracy,
    quadrantHits: result.quadrantHits,
    unmatched: result.unmatched,
    recordedAt: new Date().toISOString(),
  };

  let report: { baseline: unknown; iterations: unknown[] };
  if (label) {
    // 有 --label：写入 iterations 数组（保留原 baseline；同 label 覆盖）
    const filtered = iterations.filter(it => (it as { label?: string } | null)?.label !== label);
    filtered.push({ label, ...entry });
    report = { baseline: existingBaseline ?? entry, iterations: filtered };
    console.log(`\n✓ 报告已写入 iterations[label=${label}]: ${path.relative(PROJECT_ROOT, reportPath)}`);
  } else {
    // 无 --label：写入 baseline（保留原 iterations）
    report = { baseline: entry, iterations };
    console.log(`\n✓ 报告已写入 baseline: ${path.relative(PROJECT_ROOT, reportPath)}`);
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
}

main();
