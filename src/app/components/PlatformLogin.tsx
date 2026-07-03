import { useState } from 'react';
import { useUserStore } from '../stores/userStore';
import type { PlatformAccount } from '../types';
import { PlatformQRModal } from './PlatformQRModal';
import styles from './PlatformLogin.module.css';

interface PlatformLoginProps {
  /** 紧凑模式:隐藏标题说明(用于 onboarding 等嵌入式场景) */
  compact?: boolean;
  /** 兼容旧接口,onboarding 完成回调(简洁卡片模式不再需要,保留入参不破坏调用) */
  onLoginComplete?: () => void;
}

/**
 * 音乐平台简洁状态卡片
 *
 * - 未开放平台(other)置灰显示"未开放",不可点击
 * - 可用未连接平台点击 → 打开 QR 扫码弹层(mock)
 * - 已连接平台点击 → 断开连接
 */
export function PlatformLogin({ compact = false }: PlatformLoginProps) {
  const platforms = useUserStore((s) => s.platforms);
  const logoutPlatform = useUserStore((s) => s.logoutPlatform);
  const [qrPlatform, setQrPlatform] = useState<PlatformAccount | null>(null);

  const handleClick = (p: PlatformAccount) => {
    // 未开放平台不可点
    if (p.available === false) return;
    // 已连接 → 断开
    if (p.loggedIn) {
      logoutPlatform(p.id);
      return;
    }
    // 未连接 → 打开扫码弹层
    setQrPlatform(p);
  };

  return (
    <div className={styles.wrap}>
      {!compact && (
        <div className={styles.header}>
          <p className={styles.desc}>
            点击卡片扫码登录。demo 阶段为模拟扫码,正式版会接入平台授权。
          </p>
        </div>
      )}

      <div className={styles.grid}>
        {platforms.map((p) => {
          const disabled = p.available === false;
          return (
            <button
              key={p.id}
              type="button"
              className={`${styles.card} ${p.loggedIn ? styles.connected : ''} ${disabled ? styles.disabled : ''}`}
              onClick={() => handleClick(p)}
              aria-pressed={p.loggedIn}
              disabled={disabled}
            >
              <span
                className={styles.icon}
                style={{ background: p.loggedIn ? p.color : 'var(--film-grain)' }}
                aria-hidden
              >
                {p.label.charAt(0)}
              </span>
              <span className={styles.name}>{p.label}</span>
              <span className={styles.status}>
                {disabled
                  ? '未开放'
                  : p.loggedIn
                    ? '已连接'
                    : '扫码连接'}
              </span>
            </button>
          );
        })}
      </div>

      {qrPlatform && (
        <PlatformQRModal
          platform={qrPlatform}
          onClose={() => setQrPlatform(null)}
        />
      )}
    </div>
  );
}
