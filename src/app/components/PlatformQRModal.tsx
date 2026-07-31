import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../stores/userStore';
import { importFlow } from '../services/platformImport';
import type { PlatformId } from '../services/platformImport';
import type { PlatformAccount } from '../types';
import * as neteaseApi from '../services/neteaseApi';
import * as qqApi from '../services/qqApi';
import * as qishuiApi from '../services/qishuiApi';
import styles from './PlatformQRModal.module.css';

interface PlatformQRModalProps {
  platform: PlatformAccount;
  onClose: () => void;
}

type Stage = 'loading' | 'pending' | 'scanned' | 'expired' | 'importing' | 'success' | 'error';

/** 轮询间隔(ms) */
const POLL_INTERVAL_MS = 2500;

/** 扫码状态归一化语义 */
type QrSemantic = 'pending' | 'scanned' | 'expired' | 'success';

/** 各平台扫码登录后统一字段(归一化 checkQrStatus 返回) */
interface UnifiedQrCheckResult {
  code: number;
  cookie?: string;
  nickname?: string;
  uid?: number;
}

/** platform.id 是否为支持扫码登录的平台(netease / qq / qishui) */
function isSupportedPlatform(id: PlatformAccount['id']): id is PlatformId {
  return id === 'netease' || id === 'qq' || id === 'qishui';
}

/**
 * 各平台扫码 code 归一化为统一语义
 *
 * - netease: 801 等待 / 802 已扫码 / 800 过期 / 803 成功
 * - qq:      66  等待 / 67  已扫码 / 65  过期 / 0   成功
 * - qishui:  0   等待 / 1   已扫码 / 3   过期 / 2   成功
 *
 * 未知 code 兜底为 expired,让用户可重试。
 */
function normalizeQrCode(platform: PlatformId, code: number): QrSemantic {
  switch (platform) {
    case 'netease':
      if (code === 801) return 'pending';
      if (code === 802) return 'scanned';
      if (code === 800) return 'expired';
      if (code === 803) return 'success';
      break;
    case 'qq':
      if (code === 66) return 'pending';
      if (code === 67) return 'scanned';
      if (code === 65) return 'expired';
      if (code === 0) return 'success';
      break;
    case 'qishui':
      if (code === 0) return 'pending';
      if (code === 1) return 'scanned';
      if (code === 3) return 'expired';
      if (code === 2) return 'success';
      break;
  }
  return 'expired';
}

/** 根据 platform.id 生成二维码(三个平台均返回 { unikey, qrimg }) */
async function createQrLoginByPlatform(platform: PlatformId): Promise<{ unikey: string; qrimg: string }> {
  switch (platform) {
    case 'netease':
      return neteaseApi.createQrLogin();
    case 'qq':
      return qqApi.createQrLogin();
    case 'qishui':
      return qishuiApi.createQrLogin();
  }
}

/** 根据 platform.id 轮询扫码状态,返回归一化结果 */
async function checkQrStatusByPlatform(platform: PlatformId, key: string): Promise<UnifiedQrCheckResult> {
  switch (platform) {
    case 'netease':
      return neteaseApi.checkQrStatus(key);
    case 'qq':
      return qqApi.checkQrStatus(key);
    case 'qishui':
      return qishuiApi.checkQrStatus(key);
  }
}

/**
 * 扫码登录弹层
 *
 * 支持网易云 / QQ / 汽水三个平台扫码登录:
 *   1. 调对应平台 /api/<platform>/qr-create 获取二维码图片 + unikey
 *   2. 每 2.5s 轮询 /api/<platform>/qr-check 检查扫码状态
 *   3. 登录成功后通过 platformImport.importFlow 拉取歌单并导入音乐库
 */
export function PlatformQRModal({ platform, onClose }: PlatformQRModalProps) {
  const loginPlatform = useUserStore((s) => s.loginPlatform);

  const [stage, setStage] = useState<Stage>('loading');
  const [qrImg, setQrImg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [importProgress, setImportProgress] = useState<string>('');

  const unikeyRef = useRef<string>('');
  const pollTimerRef = useRef<number | null>(null);
  /** 扫码成功标记:防止 useEffect re-run 时重复轮询导致被 800 覆盖 */
  const loginCompletedRef = useRef(false);

  // -----------------------------------------------------------------------
  // 生成二维码(netease / qq / qishui)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!isSupportedPlatform(platform.id)) {
      setStage('error');
      setErrorMsg(`${platform.label} 扫码登录暂不支持`);
      return;
    }
    const pid = platform.id;

    let cancelled = false;

    async function initQr() {
      try {
        setStage('loading');
        const result = await createQrLoginByPlatform(pid);
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
    if (!isSupportedPlatform(platform.id)) return;
    const pid = platform.id;

    const poll = async () => {
      // 扫码已完成,不再轮询(防止 useEffect re-run 时重复启动导致被过期码覆盖)
      if (loginCompletedRef.current) return;
      try {
        const result = await checkQrStatusByPlatform(pid, unikeyRef.current);
        const semantic = normalizeQrCode(pid, result.code);
        if (semantic === 'pending') {
          // 等待扫码,保持 pending
          setStage('pending');
        } else if (semantic === 'scanned') {
          // 已扫码,待确认
          setStage('scanned');
        } else if (semantic === 'expired') {
          // 二维码过期
          setStage('expired');
        } else if (semantic === 'success' && result.cookie) {
          // 登录成功,标记完成,不再轮询
          loginCompletedRef.current = true;
          // 停止 interval
          if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          // 各平台 nickname / uid 差异:
          // - netease: 后端返回 nickname + uid(number)
          // - qq: 后端返回 nickname,不返回 uin
          // - qishui: 后端不返回 nickname,也不返回 uin
          const nickname = result.nickname ?? (pid === 'qishui' ? '汽水音乐用户' : `${platform.label}用户`);
          const platformUid = pid === 'netease' ? result.uid : undefined;
          loginPlatform(pid, nickname, result.cookie, platformUid);
          // 开始导入歌单(netease 需 uid 字符串,qq/qishui 传空字符串)
          const uin = pid === 'netease' ? String(result.uid ?? 0) : '';
          startImportFlow(pid, uin, result.cookie);
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
  // 多维度导入流程（委托 platformImport.importFlow，内部处理各来源拉取）
  // -----------------------------------------------------------------------
  async function startImportFlow(pid: PlatformId, uin: string, cookie: string) {
    try {
      setStage('importing');
      await importFlow(pid, cookie, uin, (msg) => setImportProgress(msg));
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
    if (!isSupportedPlatform(platform.id)) return;
    try {
      setStage('loading');
      loginCompletedRef.current = false;  // 重置登录完成标记
      const result = await createQrLoginByPlatform(platform.id);
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
            <button
              type="button"
              className={styles.mockBtn}
              onClick={handleRegenerate}
            >
              重试 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
