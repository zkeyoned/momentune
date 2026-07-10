import { NavLink, useNavigate } from 'react-router-dom';
import { hapticTap } from '../hooks/useHapticTap';
import styles from './BottomNav.module.css';

/* —— 线性 SVG 图标(暖色胶片设计稿风格) ——
   5 项导航: 时间线 / 日历 / 相机凸起 / 收藏 / 我的
   图标来自 Momentune.html 设计稿
   中间相机按钮为凸起圆形 caramel 渐变 */

const TimelineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
    <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <rect x="4" y="5" width="16" height="16" rx="3.5" />
    <path d="M4 9.5h16M8.5 3v4M15.5 3v4" strokeLinecap="round" />
  </svg>
);

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <path
      d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      strokeLinejoin="round"
    />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// 凸起相机按钮专用图标(白色描边)
const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export function BottomNav() {
  const navigate = useNavigate();

  // 中间相机按钮:跳到首页拍照
  const handleCamera = () => {
    hapticTap('medium');
    navigate('/');
  };

  return (
    <nav className={styles.nav} aria-label="主导航">
      {/* 左 1: 时间线 */}
      <NavLink
        to="/timeline"
        onClick={() => hapticTap('light')}
        className={({ isActive }) =>
          `${styles.tab} ${isActive ? styles.active : ''}`
        }
      >
        <span className={styles.icon} aria-hidden>
          <TimelineIcon />
        </span>
        <span className={styles.label}>时间线</span>
      </NavLink>

      {/* 左 2: 日历 */}
      <NavLink
        to="/calendar"
        onClick={() => hapticTap('light')}
        className={({ isActive }) =>
          `${styles.tab} ${isActive ? styles.active : ''}`
        }
      >
        <span className={styles.icon} aria-hidden>
          <CalendarIcon />
        </span>
        <span className={styles.label}>日历</span>
      </NavLink>

      {/* 中: 凸起相机按钮 */}
      <button
        type="button"
        className={styles.cameraBtn}
        onClick={handleCamera}
        aria-label="拍照"
      >
        <span className={styles.cameraBtnInner} aria-hidden>
          <CameraIcon />
        </span>
      </button>

      {/* 右 2: 收藏(暂未开放,置灰) */}
      <button
        type="button"
        className={`${styles.tab} ${styles.disabled}`}
        disabled
        aria-label="收藏(未开放)"
      >
        <span className={styles.icon} aria-hidden>
          <HeartIcon />
        </span>
        <span className={styles.label}>收藏</span>
      </button>

      {/* 右 1: 我的 */}
      <NavLink
        to="/settings"
        onClick={() => hapticTap('light')}
        className={({ isActive }) =>
          `${styles.tab} ${isActive ? styles.active : ''}`
        }
      >
        <span className={styles.icon} aria-hidden>
          <UserIcon />
        </span>
        <span className={styles.label}>我的</span>
      </NavLink>
    </nav>
  );
}
