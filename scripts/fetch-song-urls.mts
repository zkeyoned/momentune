/**
 * 批量获取歌曲真实播放地址、封面和歌词并下载到本地的一次性脚本（构建期工具）
 *
 * 用法:
 *   # 全量
 *   npm run fetch:urls
 *   # 试跑前 5 首
 *   LIMIT=5 npm run fetch:urls
 *   # 带网易云 cookie(拿到完整歌曲而非试听片段)
 *   NETEASE_COOKIE='MUSIC_U=xxxx' npm run fetch:urls
 *
 * 产出:
 *   - src/app/services/songPreviewUrls.ts (含 coverUrl / localFile)
 *   - public/audio/{songId}.mp3   (本地音频,不上库)
 *   - public/covers/{songId}.jpg  (本地封面,不上库)
 *   - public/lyrics/{songId}.lrc  (歌词文件,不上库)
 *
 * 运行时不依赖任何网易云接口,本脚本仅在构建期执行。
 * 下载总量约 300MB,需十几分钟。每首之间 sleep 1s 防风控。
 */

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync, createWriteStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { HOT_CHART_2026 } from '../src/algorithm/musicLibrary.ts';
import type { Song } from '../src/algorithm/types.ts';

const require = createRequire(import.meta.url);
// NeteaseCloudMusicApi 是 CommonJS 包,用 createRequire 加载
const { search, song_url_v1, song_url, song_detail, lyric } = require('NeteaseCloudMusicApi');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// 配置
// ============================================================================

const cookie = process.env.NETEASE_COOKIE ?? '';
const limit = process.env.LIMIT ? Number(process.env.LIMIT) : 0; // 0 = 全量
const sleepMin = 500;
const sleepMax = 1000;
/** 每首之间固定 sleep 1s 防风控 */
const INTER_SONG_SLEEP = 1000;

// 输出文件路径
const OUTPUT_PATH = resolve(__dirname, '../src/app/services/songPreviewUrls.ts');
const LYRICS_DIR = resolve(__dirname, '../public/lyrics');
const AUDIO_DIR = resolve(__dirname, '../public/audio');
const COVERS_DIR = resolve(__dirname, '../public/covers');

// ============================================================================
// 工具函数
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randSleep(): Promise<void> {
  return sleep(sleepMin + Math.random() * (sleepMax - sleepMin));
}

/** 规范化歌手名:分隔符统一、去空格、小写 */
function normalizeArtist(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[/;；，,、&]/g, '')
    .trim();
}

/**
 * 判断搜索结果的歌手是否与目标歌手模糊匹配
 * 处理多人合作(用 / ; 、 , 分隔),任一名字包含即算匹配
 */
function artistMatches(resultArtists: string[], targetArtist: string): boolean {
  const targetParts = targetArtist
    .split(/[/;；，,、&]/)
    .map((p) => normalizeArtist(p))
    .filter((p) => p.length > 0);

  const resultParts = resultArtists.map((a) => normalizeArtist(a)).filter((a) => a.length > 0);

  // 任一目标名字 与 任一结果名字 存在包含关系即算匹配
  for (const t of targetParts) {
    for (const r of resultParts) {
      if (t.length >= 2 && r.length >= 2 && (t.includes(r) || r.includes(t))) {
        return true;
      }
      // 完全相等(短名也允许)
      if (t === r) return true;
    }
  }
  return false;
}

/**
 * 流式下载文件到本地
 * @returns 文件字节数(用 statSync 兜底,content-length 不一定准)
 */
async function downloadFile(url: string, dest: string): Promise<number> {
  const res = await fetch(url, {
    headers: {
      // 网易云音频/图片对 Referer 不强制,加上保险
      Referer: 'https://music.163.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  // Readable.fromWeb 将 Web ReadableStream 转 Node Stream,流式写盘不占内存
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest));
  return statSync(dest).size;
}

/** 人类可读的文件大小 */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

// ============================================================================
// 搜索:歌名+歌手 → 网易云歌曲 id
// ============================================================================

interface SearchResult {
  id: number;
  title: string;
  artists: string[];
}

/**
 * 搜索歌曲,返回网易云歌曲 id
 *
 * 策略:
 *   1. 取前 5 条结果
 *   2. 第 1 条歌手模糊匹配 → 直接用
 *   3. 第 1 条不匹配 → 在前 3 条里按歌手模糊匹配选一个
 *   4. 都对不上 → 返回 null(记为失败,不硬塞错歌)
 */
async function searchSongId(
  title: string,
  artist: string,
): Promise<{ neteaseId: number; matchedTitle: string } | null> {
  const keywords = `${title} ${artist}`;
  let result;
  try {
    result = await search({ keywords, limit: 5, cookie });
  } catch (e) {
    console.warn(`  [搜索异常] ${title} - ${artist}: ${(e as Error).message}`);
    return null;
  }

  const songs = result?.body?.result?.songs;
  if (!Array.isArray(songs) || songs.length === 0) {
    return null;
  }

  // 规范化搜索结果
  const candidates: SearchResult[] = songs.map((s: any) => ({
    id: s.id as number,
    title: s.name as string,
    artists: Array.isArray(s.artists) ? s.artists.map((a: any) => a.name as string) : [],
  }));

  // 策略 1:第 1 条歌手匹配
  if (candidates[0] && artistMatches(candidates[0].artists, artist)) {
    return { neteaseId: candidates[0].id, matchedTitle: candidates[0].title };
  }

  // 策略 2:前 3 条里按歌手模糊匹配
  for (let i = 0; i < Math.min(3, candidates.length); i++) {
    const c = candidates[i]!;
    if (artistMatches(c.artists, artist)) {
      return { neteaseId: c.id, matchedTitle: c.title };
    }
  }

  // 都对不上 → 失败
  return null;
}

// ============================================================================
// 取播放地址:级联音质 + 试听兜底(参考 Mineradio handleSongUrl)
// ============================================================================

interface SongUrlResult {
  url: string;
  isTrial: boolean;
}

/**
 * 按音质级联取播放地址
 *
 * 逻辑(直接照搬 Mineradio handleSongUrl):
 *   - exhigh → standard 两档级联
 *   - 优先返回完整歌曲(url 存在且 freeTrialInfo === null)
 *   - 试听片段(url 存在但 freeTrialInfo 非 null)记为兜底,继续试下一档
 *   - 全部档位失败 → 返回 null
 */
async function handleSongUrl(id: number): Promise<SongUrlResult | null> {
  const qualities = ['exhigh', 'standard'] as const;
  let trialFallback: SongUrlResult | null = null;

  for (const level of qualities) {
    let result;
    try {
      result = await song_url_v1({ id, level, cookie });
    } catch {
      // v1 挂了退回旧接口
      try {
        result = await song_url({ id, br: 999000, cookie });
      } catch {
        continue;
      }
    }

    const d = result?.body?.data?.[0];
    const url = d?.url;
    const freeTrial = d?.freeTrialInfo;

    if (url && !freeTrial) {
      // 完整歌曲,最优
      return { url, isTrial: false };
    }
    if (url && freeTrial && !trialFallback) {
      // 试听片段,记下兜底,继续试其他音质
      trialFallback = { url, isTrial: true };
    }
    // url 为 null → 该档位拿不到,试下一档
  }

  // 没有完整歌,退而求其次用试听
  if (trialFallback) return trialFallback;
  // 彻底拿不到(版权/下架)
  return null;
}

// ============================================================================
// 主流程
// ============================================================================

interface FetchOutcome {
  songId: string;
  title: string;
  artist: string;
  neteaseId: number;
  matchedTitle: string;
  url: string;
  isTrial: boolean;
  coverUrl?: string;
  /** 本地音频文件 web 路径(下载成功时填) */
  localFile?: string;
  /** 本地音频字节数(汇总用) */
  audioSize?: number;
}

async function main() {
  const allSongs: readonly Song[] = HOT_CHART_2026;
  const songs = limit > 0 ? allSongs.slice(0, limit) : allSongs;

  console.log('========================================');
  console.log('Momentune · 歌曲播放地址 + 本地下载脚本');
  console.log('========================================');
  console.log(`总歌曲数: ${songs.length}${limit > 0 ? ` (试跑前 ${limit} 首)` : ''}`);
  console.log(`Cookie: ${cookie ? '已提供' : '未提供(部分歌可能只拿到试听/null)'}`);
  console.log(`音频目录: ${AUDIO_DIR}`);
  console.log(`封面目录: ${COVERS_DIR}`);
  console.log(`歌词目录: ${LYRICS_DIR}`);
  console.log('');

  // 确保目录存在
  for (const dir of [LYRICS_DIR, AUDIO_DIR, COVERS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const successes: FetchOutcome[] = []; // 完整歌曲
  const trials: FetchOutcome[] = []; // 试听片段
  const failedSearch: { songId: string; title: string; artist: string }[] = []; // 搜索失败
  const failedUrl: { songId: string; title: string; artist: string; neteaseId: number }[] = []; // 拿不到地址

  // 本地下载统计
  let audioOk = 0;
  let audioFail = 0;
  let coverOk = 0;
  let coverFail = 0;
  let totalAudioBytes = 0;
  const audioFailures: { songId: string; title: string; reason: string }[] = [];

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]!;
    const progress = `[${i + 1}/${songs.length}]`;
    console.log(`${progress} ${song.title} - ${song.artist}`);

    // 步骤 1:搜索网易云 id
    const searchResult = await searchSongId(song.title, song.artist);
    if (!searchResult) {
      console.warn(`  [搜索失败] 没有匹配结果,跳过`);
      failedSearch.push({ songId: song.songId, title: song.title, artist: song.artist });
      await sleep(INTER_SONG_SLEEP);
      continue;
    }
    console.log(`  [搜索] neteaseId=${searchResult.neteaseId} (${searchResult.matchedTitle})`);

    // 步骤 2:取播放地址
    const urlResult = await handleSongUrl(searchResult.neteaseId);
    if (!urlResult) {
      console.warn(`  [地址失败] 拿不到播放地址(版权/下架),跳过`);
      failedUrl.push({
        songId: song.songId,
        title: song.title,
        artist: song.artist,
        neteaseId: searchResult.neteaseId,
      });
      await sleep(INTER_SONG_SLEEP);
      continue;
    }

    const outcome: FetchOutcome = {
      songId: song.songId,
      title: song.title,
      artist: song.artist,
      neteaseId: searchResult.neteaseId,
      matchedTitle: searchResult.matchedTitle,
      url: urlResult.url,
      isTrial: urlResult.isTrial,
    };

    if (urlResult.isTrial) {
      trials.push(outcome);
      console.log(`  [试听] ${urlResult.url.slice(0, 60)}...`);
    } else {
      successes.push(outcome);
      console.log(`  [完整] ${urlResult.url.slice(0, 60)}...`);
    }
    await randSleep();

    // 步骤 3:取专辑封面 + 下载到本地
    let remotePicUrl: string | undefined;
    try {
      const detailRes = await song_detail({ ids: String(searchResult.neteaseId), cookie });
      const picUrl = detailRes?.body?.songs?.[0]?.al?.picUrl;
      if (picUrl) {
        remotePicUrl = `${picUrl}?param=200y200`;
        console.log(`  [封面] ${remotePicUrl.slice(0, 60)}...`);
      }
    } catch (e) {
      console.warn(`  [封面] 获取失败: ${(e as Error).message}`);
    }

    // 封面下载到本地:失败不中断,回退用远程 picUrl
    if (remotePicUrl) {
      const coverPath = resolve(COVERS_DIR, `${outcome.songId}.jpg`);
      try {
        await downloadFile(remotePicUrl, coverPath);
        outcome.coverUrl = `/covers/${outcome.songId}.jpg`;
        coverOk++;
        console.log(`  [封面下载] ✓ /covers/${outcome.songId}.jpg`);
      } catch (e) {
        // 下载失败回退到远程 URL
        outcome.coverUrl = remotePicUrl;
        coverFail++;
        console.warn(`  [封面下载] ✗ 失败,回退远程: ${(e as Error).message}`);
      }
    }
    await randSleep();

    // 步骤 4:取歌词并写入文件
    try {
      const lyricRes = await lyric({ id: searchResult.neteaseId, cookie });
      const lrcText = lyricRes?.body?.lrc?.lyric;
      if (lrcText && !lrcText.includes('纯音乐') && !lrcText.includes('此歌曲为没有填词的纯音乐')) {
        const lrcPath = resolve(LYRICS_DIR, `${outcome.songId}.lrc`);
        writeFileSync(lrcPath, lrcText, 'utf-8');
        console.log(`  [歌词] 已保存 ${outcome.songId}.lrc`);
      } else {
        console.log(`  [歌词] 无歌词或纯音乐,跳过`);
      }
    } catch (e) {
      console.warn(`  [歌词] 获取失败: ${(e as Error).message}`);
    }

    // 步骤 5:下载音频到本地(核心):单曲失败不中断整体流程
    const audioPath = resolve(AUDIO_DIR, `${outcome.songId}.mp3`);
    try {
      const size = await downloadFile(urlResult.url, audioPath);
      outcome.localFile = `/audio/${outcome.songId}.mp3`;
      outcome.audioSize = size;
      totalAudioBytes += size;
      audioOk++;
      console.log(`  [音频下载] ✓ ${fmtSize(size)} /audio/${outcome.songId}.mp3`);
    } catch (e) {
      audioFail++;
      audioFailures.push({
        songId: outcome.songId,
        title: outcome.title,
        reason: (e as Error).message,
      });
      console.warn(`  [音频下载] ✗ 失败(回退远程 url): ${(e as Error).message}`);
    }

    // 每首之间固定 sleep 1s 防风控
    await sleep(INTER_SONG_SLEEP);
  }

  // ============================================================================
  // 汇总打印
  // ============================================================================
  console.log('');
  console.log('========================================');
  console.log('汇总');
  console.log('========================================');
  console.log(`完整歌曲: ${successes.length} 首`);
  console.log(`试听片段: ${trials.length} 首`);
  console.log(`搜索失败: ${failedSearch.length} 首`);
  console.log(`地址失败: ${failedUrl.length} 首`);
  console.log(`成功率: ${((successes.length + trials.length) / songs.length * 100).toFixed(1)}%`);
  console.log('');
  console.log('—— 本地下载统计 ——');
  console.log(`音频: 成功 ${audioOk} 首 / 失败 ${audioFail} 首 / 总大小 ${fmtSize(totalAudioBytes)}`);
  console.log(`封面: 成功 ${coverOk} 首 / 失败 ${coverFail} 首`);

  if (failedSearch.length > 0) {
    console.log('');
    console.log('—— 搜索失败列表 ——');
    for (const f of failedSearch) console.log(`  ${f.title} - ${f.artist}`);
  }
  if (failedUrl.length > 0) {
    console.log('');
    console.log('—— 地址失败列表 ——');
    for (const f of failedUrl) console.log(`  ${f.title} - ${f.artist} (neteaseId=${f.neteaseId})`);
  }
  if (audioFailures.length > 0) {
    console.log('');
    console.log('—— 音频下载失败列表(将回退远程 url) ——');
    for (const f of audioFailures) console.log(`  ${f.title} [${f.songId}]: ${f.reason}`);
  }

  // ============================================================================
  // 写入产出文件
  // ============================================================================
  const allResults = [...successes, ...trials];
  writeOutputFile(allResults);
  console.log('');
  console.log(`已写入: ${OUTPUT_PATH}`);
  console.log(`共 ${allResults.length} 条映射 (${successes.length} 完整 + ${trials.length} 试听)`);
  console.log(`其中 ${audioOk} 首已下载本地音频,${audioOk > 0 ? '断网可播' : '仍依赖远程'}`);
}

/**
 * 生成 songPreviewUrls.ts 文件内容
 *
 * 每首歌带 title 注释字段,方便人工抽查:
 *   // 歌名 - 歌手 (网易云: matchedTitle, id: 12345)
 *   'songId': { neteaseId: 12345, url: '...', isTrial: false, localFile: '/audio/songId.mp3' },
 */
function writeOutputFile(results: FetchOutcome[]): void {
  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * 歌曲真实播放地址映射表');
  lines.push(' *');
  lines.push(' * 由 scripts/fetch-song-urls.mts 生成,请勿手动编辑。');
  lines.push(' * 重新生成: npm run fetch:urls');
  lines.push(' *');
  lines.push(' * 说明:');
  lines.push(' *   - 完整歌曲(isTrial=false):可完整播放');
  lines.push(' *   - 试听片段(isTrial=true):约 30s-1min,标记后前端提示');
  lines.push(' *   - localFile: 本地音频文件,优先于 url 播放(同源,无过期/跨域/混合内容问题)');
  lines.push(' *   - coverUrl: 优先指向本地 /covers/{songId}.jpg,下载失败时为远程 URL');
  lines.push(' *   - 未收录的歌不在此表中,前端自动回退到模拟播放');
  lines.push(' */');
  lines.push('');
  lines.push('export interface SongPreview {');
  lines.push('  /** 网易云歌曲数字 id */');
  lines.push('  neteaseId: number;');
  lines.push('  /** 播放地址(外域,audio 标签可直接播) */');
  lines.push('  url: string;');
  lines.push('  /** 是否为试听片段 */');
  lines.push('  isTrial: boolean;');
  lines.push('  /** 专辑封面(优先本地 /covers/{songId}.jpg,失败时为远程 URL) */');
  lines.push('  coverUrl?: string;');
  lines.push('  /** 本地音频文件 web 路径(优先于 url 播放,同源无过期) */');
  lines.push('  localFile?: string;');
  lines.push('}');
  lines.push('');
  lines.push('export const SONG_PREVIEW_URLS: Record<string, SongPreview> = {');

  for (const r of results) {
    // 每首歌上方加注释,方便人工抽查
    lines.push(
      `  // ${r.title} - ${r.artist} (网易云: ${r.matchedTitle}, id: ${r.neteaseId})`,
    );
    const coverUrlStr = r.coverUrl ? `, coverUrl: '${r.coverUrl}'` : '';
    const localFileStr = r.localFile ? `, localFile: '${r.localFile}'` : '';
    lines.push(
      `  '${r.songId}': { neteaseId: ${r.neteaseId}, url: '${r.url}', isTrial: ${r.isTrial}${coverUrlStr}${localFileStr} },`,
    );
  }

  lines.push('};');
  lines.push('');

  writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');
}

main().catch((e) => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
