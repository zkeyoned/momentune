import { useEffect, useRef, useState } from 'react';
import { PlatformLogin } from './PlatformLogin';
import { useUserStore } from '../stores/userStore';
import styles from './PlatformPopover.module.css';

/**
 * 音乐平台收纳按钮 + 浮层。
 * 点击按钮展开浮层,内含 PlatformLogin compact 卡片网格。
 * 点击外部或 ESC 关闭。用于放在 section 标题栏右上角。
 */
export function PlatformPopover() {
  const platforms = useUserStore((s) => s.platforms);
  const loggedInCount = platforms.filter((p) => p.loggedIn).length;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={styles.dot} data-on={loggedInCount > 0} />
        <span className={styles.triggerLabel}>音乐 {loggedInCount}/{platforms.length}</span>
        <span className={styles.caret} aria-hidden>{open ? '✕' : '⌄'}</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.popover} role="dialog" aria-label="音乐平台">
            <div className={styles.popoverHead}>
              <span className={styles.popoverTitle}>音乐平台</span>
              <span className={styles.popoverHint}>点击卡片扫码登录</span>
            </div>
            <PlatformLogin compact />
          </div>
        </>
      )}
    </div>
  );
}
