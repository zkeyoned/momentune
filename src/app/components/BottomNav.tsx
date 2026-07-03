import { NavLink } from 'react-router-dom';
import { hapticTap } from '../hooks/useHapticTap';
import styles from './BottomNav.module.css';

/* —— 线性 SVG 图标(替代原 Unicode 符号 ◐✎⚙) ——
   首页:光圈(摄影感,契合"拍一张照片")
   回忆:打开的书(日记感)
   设置:齿轮(通用) */

const ApertureIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 3l2.9 5.3M21 12l-5.3 0M12 21l-2.9-5.3M3 12l5.3 0" strokeLinecap="round" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <path d="M4 5a2 2 0 012-2h5v16H6a2 2 0 01-2-2V5z" strokeLinejoin="round" />
    <path d="M20 5a2 2 0 00-2-2h-5v16h5a2 2 0 002-2V5z" strokeLinejoin="round" />
  </svg>
);

const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      strokeLinejoin="round"
    />
  </svg>
);

const TABS = [
  { to: '/', label: '首页', Icon: ApertureIcon, end: true },
  { to: '/journal', label: '回忆', Icon: BookIcon, end: false },
  { to: '/settings', label: '设置', Icon: GearIcon, end: false },
] as const;

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="主导航">
      {TABS.map((tab) => {
        const { Icon } = tab;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            onClick={() => hapticTap('light')}
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.icon} aria-hidden>
              <Icon />
            </span>
            <span className={styles.label}>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
