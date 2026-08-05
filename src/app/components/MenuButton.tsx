import { hapticTap } from '../hooks/useHapticTap';
import { useUiStore } from '../stores/uiStore';
import styles from './MenuButton.module.css';

/**
 * 顶栏菜单键 — 刻在机身上的三横线图标按钮
 * 灰色描边 + 一线白色下高光(刻痕效果), 无文字
 * 用于时间线 / 日历 / 我的三页顶栏左上角, 点击拉开侧边抽屉
 */
export function MenuButton() {
  const openDrawer = useUiStore((s) => s.openDrawer);

  return (
    <button
      type="button"
      className={styles.menuBtn}
      aria-label="打开导航菜单"
      onClick={() => {
        hapticTap('light');
        openDrawer();
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    </button>
  );
}
