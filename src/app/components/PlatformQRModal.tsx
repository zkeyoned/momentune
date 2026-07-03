import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useUserStore } from '../stores/userStore';
import type { PlatformAccount } from '../types';
import styles from './PlatformQRModal.module.css';

interface PlatformQRModalProps {
  platform: PlatformAccount;
  onClose: () => void;
}

type Stage = 'pending' | 'success';

/**
 * 扫码登录弹层(mock)
 *
 * 用 qrcode 库生成真实可扫的 QR 图(内容指向 mock OAuth URL)。
 * 模拟轮询:打开后 5 秒自动变为"扫码成功",
 * 也提供"模拟扫码成功"按钮手动触发(便于 demo 演示)。
 *
 * 正式版接入真实 OAuth 时,只需把 mock 轮询换成真实接口,
 * QR 内容换成平台返回的授权 URL,UI 不变。
 */
export function PlatformQRModal({ platform, onClose }: PlatformQRModalProps) {
  const loginPlatform = useUserStore((s) => s.loginPlatform);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [stage, setStage] = useState<Stage>('pending');
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<number | null>(null);

  // 生成 QR 图(mock OAuth URL)
  useEffect(() => {
    const mockOAuthUrl = `https://momentune.app/oauth/${platform.id}?token=mock_${Date.now()}`;
    QRCode.toDataURL(mockOAuthUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#2E2620', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [platform.id]);

  // 5 秒倒计时模拟扫码成功
  useEffect(() => {
    if (stage !== 'pending') return;
    setCountdown(5);
    timerRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setStage('success');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [stage]);

  // 成功后写入登录态 + 自动关闭
  useEffect(() => {
    if (stage !== 'success') return;
    loginPlatform(platform.id, undefined);
    const t = window.setTimeout(onClose, 1200);
    return () => window.clearTimeout(t);
  }, [stage, platform.id, loginPlatform, onClose]);

  const handleManualSuccess = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setStage('success');
  };

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

        {stage === 'pending' ? (
          <>
            {/* QR 码 */}
            <div className={styles.qrWrap}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="登录二维码" className={styles.qr} />
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
              <span className={styles.waitingText}>等待扫码确认 · {countdown}s</span>
            </div>

            {/* 手动触发按钮(demo 演示用) */}
            <button
              type="button"
              className={styles.mockBtn}
              onClick={handleManualSuccess}
            >
              模拟扫码成功 →
            </button>
          </>
        ) : (
          <div className={styles.successState}>
            <div className={styles.successIcon} aria-hidden>✓</div>
            <div className={styles.successTitle}>扫码成功</div>
            <div className={styles.successSub}>{platform.label} 已连接</div>
          </div>
        )}
      </div>
    </div>
  );
}
