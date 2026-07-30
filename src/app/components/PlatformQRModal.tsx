import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../stores/userStore';
import { importUserPlaylist, applyMultiSourcePreference } from '@algorithm/index';
import type { Song, ImportedSongSource } from '@algorithm/index';
import type { PlatformAccount } from '../types';
import * as neteaseApi from '../services/neteaseApi';
import styles from './PlatformQRModal.module.css';

interface PlatformQRModalProps {
  platform: PlatformAccount;
  onClose: () => void;
}

type Stage = 'loading' | 'pending' | 'scanned' | 'expired' | 'importing' | 'success' | 'error';

/** 轮询间隔(ms) */
const POLL_INTERVAL_MS = 2500;
/** 各来源最大导入数量 */
const MAX_LIKED = 100;
const MAX_PLAYLIST = 200;
const MAX_RECENT = 100;

/**
 * 构建 songId → neteaseId 和 songId → coverUrl 映射
 * 用于播放时获取播放地址和封面显示
 */
function buildSongIdMaps(
  songs: Song[],
  entries: Array<{ title: string; artist: string }>,
  neteaseIdMap: Map<string, number>,
  coverUrlMap: Map<string, string>,
): { idMap: Record<string, number>; coverMap: Record<string, string> } {
  const idMap: Record<string, number> = {};
  const coverMap: Record<string, string> = {};
  songs.forEach((song, idx) => {
    const entry = entries[idx];
    if (entry) {
      const key = `${entry.title}|${entry.artist}`;
      const neteaseId = neteaseIdMap.get(key);
      if (neteaseId !== undefined) {
        idMap[song.songId] = neteaseId;
      }
      const coverUrl = coverUrlMap.get(key);
      if (coverUrl) {
        coverMap[song.songId] = coverUrl;
      }
    }
  });
  return { idMap, coverMap };
}

/**
 * 扫码登录弹层
 *
 * 真实接入网易云 QR 登录:
 *   1. 调 /api/netease/qr-create 获取二维码图片 + unikey
 *   2. 每 2.5s 轮询 /api/netease/qr-check 检查扫码状态
 *   3. 登录成功后自动拉取红心歌单,通过 importUserPlaylist 导入音乐库
 *
 * 非 netease 平台暂未接入,显示"即将上线"。
 */
export function PlatformQRModal({ platform, onClose }: PlatformQRModalProps) {
  const loginPlatform = useUserStore((s) => s.loginPlatform);
  const setImportedSongsBySource = useUserStore((s) => s.setImportedSongsBySource);

  const [stage, setStage] = useState<Stage>('loading');
  const [qrImg, setQrImg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [importProgress, setImportProgress] = useState<string>('');

  const unikeyRef = useRef<string>('');
  const pollTimerRef = useRef<number | null>(null);
  /** 扫码成功标记:防止 useEffect re-run 时重复轮询导致被 800 覆盖 */
  const loginCompletedRef = useRef(false);

  // -----------------------------------------------------------------------
  // 生成二维码(仅 netease)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (platform.id !== 'netease') {
      setStage('error');
      setErrorMsg(`${platform.label} 扫码登录即将上线`);
      return;
    }

    let cancelled = false;

    async function initQr() {
      try {
        setStage('loading');
        const result = await neteaseApi.createQrLogin();
        if (cancelled) return;
        unikeyRef.current = result.unikey;
        setQrImg(result.qrimg);
        setStage('pending');
      } catch (e) {
        if (cancelled) return;
        setStage('error');
        setErrorMsg(e instanceof Error ? e.message : '生成二维码失败');
      }
    }

    initQr();
    return () => {
      cancelled = true;
    };
  }, [platform.id]);

  // -----------------------------------------------------------------------
  // 轮询扫码状态(仅 pending 和 scanned 阶段)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (stage !== 'pending' && stage !== 'scanned') return;

    const poll = async () => {
      // 扫码已完成,不再轮询(防止 useEffect re-run 时重复启动导致被 800 覆盖)
      if (loginCompletedRef.current) return;
      try {
        const result = await neteaseApi.checkQrStatus(unikeyRef.current);
        if (result.code === 801) {
          // 等待扫码,保持 pending
          setStage('pending');
        } else if (result.code === 802) {
          // 已扫码,待确认
          setStage('scanned');
        } else if (result.code === 800) {
          // 二维码过期
          setStage('expired');
        } else if (result.code === 803 && result.cookie) {
          // 登录成功,标记完成,不再轮询
          loginCompletedRef.current = true;
          // 停止 interval
          if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          loginPlatform(
            'netease',
            result.nickname,
            result.cookie,
            result.uid,
          );
          // 开始导入红心歌单(uid 可能因 login_status 结构差异拿不到,用 0 兜底)
          startImportFlow(result.uid ?? 0, result.cookie);
        }
      } catch {
        // 轮询失败,静默(下次重试)
      }
    };

    pollTimerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
    // 立即执行一次(不等第一个 interval)
    poll();

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [stage]);

  // -----------------------------------------------------------------------
  // 多维度导入流程（红心 + 自建歌单 + 最近听过）
  // -----------------------------------------------------------------------
  async function startImportFlow(uid: number, cookie: string) {
    try {
      setStage('importing');

      const summary: Array<{ source: ImportedSongSource; count: number }> = [];

      // —— 阶段 1: 红心歌单 ——
      setImportProgress('正在获取红心歌单...');
      try {
        const likelistResult = await neteaseApi.fetchLikelist(uid, cookie);
        const ids = likelistResult.ids.slice(0, MAX_LIKED);
        if (ids.length > 0) {
          const { entries, neteaseIdMap, coverUrlMap } = await neteaseApi.fetchSongDetails(ids, cookie);
          const songs: Song[] = importUserPlaylist(entries);
          const { idMap, coverMap } = buildSongIdMaps(songs, entries, neteaseIdMap, coverUrlMap);
          setImportedSongsBySource('liked', songs, idMap, coverMap);
          summary.push({ source: 'liked', count: songs.length });
        }
      } catch {
        // 红心失败不阻塞
      }

      // —— 阶段 2: 自建歌单 ——
      setImportProgress('正在获取自建歌单...');
      try {
        const playlistsResult = await neteaseApi.fetchUserPlaylists(uid, cookie);
        const ids = playlistsResult.ids.slice(0, MAX_PLAYLIST);
        if (ids.length > 0) {
          const { entries, neteaseIdMap, coverUrlMap } = await neteaseApi.fetchSongDetails(ids, cookie);
          const songs: Song[] = importUserPlaylist(entries);
          const { idMap, coverMap } = buildSongIdMaps(songs, entries, neteaseIdMap, coverUrlMap);
          setImportedSongsBySource('playlist', songs, idMap, coverMap);
          summary.push({ source: 'playlist', count: songs.length });
        }
      } catch {
        // 歌单失败不阻塞
      }

      // —— 阶段 3: 最近听过 ——
      setImportProgress('正在获取最近听过...');
      try {
        const recentResult = await neteaseApi.fetchRecentSongs(uid, cookie);
        const ids = recentResult.ids.slice(0, MAX_RECENT);
        if (ids.length > 0) {
          const { entries, neteaseIdMap, coverUrlMap } = await neteaseApi.fetchSongDetails(ids, cookie);
          const songs: Song[] = importUserPlaylist(entries);
          const { idMap, coverMap } = buildSongIdMaps(songs, entries, neteaseIdMap, coverUrlMap);
          setImportedSongsBySource('recent', songs, idMap, coverMap);
          summary.push({ source: 'recent', count: songs.length });
        }
      } catch {
        // 最近听过失败不阻塞
      }

      // —— 应用多维度画像到 userPref ——
      const state = useUserStore.getState();
      if (state.userPref && summary.length > 0) {
        const updatedPref = applyMultiSourcePreference(state.userPref, state.importedSongsBySource);
        state.setOnboarded(state.answers ?? {
          platform: 'netease',
          referenceSongs: [],
          mood: 'neutral',
          genres: [],
          languages: [],
        }, updatedPref);
      }

      const totalImported = summary.reduce((sum, s) => sum + s.count, 0);
      setImportProgress(`已导入 ${totalImported} 首歌曲（${summary.map((s) => `${s.source}: ${s.count}`).join(' · ')}）`);
      setStage('success');
    } catch (e) {
      setStage('error');
      setErrorMsg(e instanceof Error ? e.message : '导入歌单失败');
    }
  }

  // -----------------------------------------------------------------------
  // 重新生成二维码(expired 状态)
  // -----------------------------------------------------------------------
  const handleRegenerate = async () => {
    try {
      setStage('loading');
      loginCompletedRef.current = false;  // 重置登录完成标记
      const result = await neteaseApi.createQrLogin();
      unikeyRef.current = result.unikey;
      setQrImg(result.qrimg);
      setStage('pending');
    } catch (e) {
      setStage('error');
      setErrorMsg(e instanceof Error ? e.message : '生成二维码失败');
    }
  };

  // -----------------------------------------------------------------------
  // 成功后自动关闭
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (stage !== 'success') return;
    const t = window.setTimeout(onClose, 1500);
    return () => window.clearTimeout(t);
  }, [stage, onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-label={`${platform.label} 扫码登录`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="关闭"
        >
          ✕
        </button>

        {/* 平台标识 */}
        <div className={styles.platformHead}>
          <span
            className={styles.platformIcon}
            style={{ background: platform.color }}
            aria-hidden
          >
            {platform.label.charAt(0)}
          </span>
          <div>
            <div className={styles.platformName}>{platform.label}</div>
            <div className={styles.platformSub}>扫码登录</div>
          </div>
        </div>

        {(stage === 'loading' || stage === 'pending' || stage === 'scanned') && (
          <>
            {/* QR 码 */}
            <div className={styles.qrWrap}>
              {qrImg ? (
                <img src={qrImg} alt="登录二维码" className={styles.qr} />
              ) : (
                <div className={styles.qrPlaceholder}>生成中...</div>
              )}
              {/* 扫描线动效 */}
              <span className={styles.scanLine} aria-hidden />
            </div>

            <p className={styles.hint}>
              请用 <span className={styles.platformTag}>{platform.label}</span> App 扫码登录
            </p>

            <div className={styles.waiting}>
              <span className={styles.spinner} aria-hidden />
              <span className={styles.waitingText}>
                {stage === 'loading' && '正在生成二维码...'}
                {stage === 'pending' && '等待扫码...'}
                {stage === 'scanned' && '已扫码,请在手机上确认'}
              </span>
            </div>
          </>
        )}

        {stage === 'expired' && (
          <div className={styles.successState}>
            <div className={styles.successIcon} aria-hidden>!</div>
            <div className={styles.successTitle}>二维码已过期</div>
            <div className={styles.successSub}>请重新生成二维码</div>
            <button
              type="button"
              className={styles.mockBtn}
              onClick={handleRegenerate}
            >
              重新生成二维码 →
            </button>
          </div>
        )}

        {stage === 'importing' && (
          <div className={styles.successState}>
            <div className={styles.successIcon} aria-hidden>♪</div>
            <div className={styles.successTitle}>正在导入你的音乐</div>
            <div className={styles.successSub}>{importProgress}</div>
          </div>
        )}

        {stage === 'success' && (
          <div className={styles.successState}>
            <div className={styles.successIcon} aria-hidden>✓</div>
            <div className={styles.successTitle}>扫码成功</div>
            <div className={styles.successSub}>
              {platform.label} 已连接
              {importProgress && ` · ${importProgress}`}
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className={styles.successState}>
            <div className={styles.successIcon} aria-hidden>✕</div>
            <div className={styles.successTitle}>出错</div>
            <div className={styles.successSub}>{errorMsg}</div>
            {platform.id === 'netease' && (
              <button
                type="button"
                className={styles.mockBtn}
                onClick={handleRegenerate}
              >
                重试 →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
