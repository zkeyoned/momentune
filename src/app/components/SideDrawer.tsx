import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hapticTap } from '../hooks/useHapticTap';
import { useUiStore } from '../stores/uiStore';
import styles from './SideDrawer.module.css';

/* —— 线性 SVG 图标(复用自原底部导航, 20px 描边风格) —— */

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

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

interface NavItem {
  key: 'camera' | 'timeline' | 'calendar' | 'faves' | 'mine';
  to: string | null;
  zh: string;
  en: string;
  Icon: () => JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'camera', to: '/', zh: '相机', en: 'CAMERA', Icon: CameraIcon },
  { key: 'timeline', to: '/timeline', zh: '时间线', en: 'TIMELINE', Icon: TimelineIcon },
  { key: 'calendar', to: '/calendar', zh: '日历', en: 'CALENDAR', Icon: CalendarIcon },
  { key: 'faves', to: null, zh: '收藏', en: 'FAVES', Icon: HeartIcon },
  { key: 'mine', to: '/settings', zh: '我的', en: 'MINE', Icon: UserIcon },
];

/** 左边缘手势热区宽度(px) */
const EDGE_ZONE = 24;
/** 横向位移超过该值且明显偏横向才接管手势, 避免和页面垂直滚动打架 */
const ACTIVATE_DX = 8;

export function SideDrawer() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const closeDrawer = useUiStore((s) => s.closeDrawer);

  /* 手指跟拖偏移: null = 未在拖; 值 ∈ [-W, 0], -W 全闭 / 0 全开 */
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const offsetRef = useRef<number | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /** 抽屉实际宽度(跟随机身面板, 而非整个窗口) */
  const measureWidth = (): number => {
    const w = drawerRef.current?.getBoundingClientRect().width;
    if (w && w > 0) return w;
    const shell = rootRef.current?.parentElement;
    const base = shell?.clientWidth ?? window.innerWidth;
    return Math.min(base * 0.7, 320);
  };

  const setOffset = (v: number | null) => {
    offsetRef.current = v;
    setDragOffset(v);
  };

  /* —— 全局边缘手势: 左边缘右滑拉出 / 抽屉上左滑收回 —— */
  useEffect(() => {
    const st = {
      tracking: false,
      active: false,
      mode: 'open' as 'open' | 'close',
      startX: 0,
      startY: 0,
      lastX: 0,
      lastT: 0,
      vX: 0,
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const open = useUiStore.getState().drawerOpen;
      if (open) {
        // 已打开: 只有从抽屉本体上起滑的左滑才接管(右侧暗处走点击收回)
        const el = drawerRef.current;
        if (!el || !el.contains(e.target as Node)) return;
        st.mode = 'close';
      } else {
        // 边缘热区以机身面板左缘为基准
        const shellLeft =
          rootRef.current?.parentElement?.getBoundingClientRect().left ?? 0;
        if (t.clientX > shellLeft + EDGE_ZONE) return;
        st.mode = 'open';
      }
      st.tracking = true;
      st.active = false;
      st.startX = t.clientX;
      st.startY = t.clientY;
      st.lastX = t.clientX;
      st.lastT = e.timeStamp;
      st.vX = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!st.tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - st.startX;
      const dy = t.clientY - st.startY;
      const W = measureWidth();

      if (!st.active) {
        const horizontal =
          st.mode === 'open'
            ? dx > ACTIVATE_DX && dx > Math.abs(dy) * 1.2
            : dx < -ACTIVATE_DX && Math.abs(dx) > Math.abs(dy) * 1.2;
        if (horizontal) {
          st.active = true;
        } else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          st.tracking = false; // 明确是垂直滚动, 让位给页面
          return;
        } else {
          return;
        }
      }

      // 已接管: 阻止页面滚动与浏览器边缘手势误判
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - st.lastT;
      if (dt > 0) st.vX = (t.clientX - st.lastX) / dt;
      st.lastX = t.clientX;
      st.lastT = e.timeStamp;

      if (st.mode === 'open') {
        setOffset(Math.min(0, Math.max(-W, dx - W)));
      } else {
        setOffset(Math.max(-W, Math.min(0, dx)));
      }
    };

    const onTouchEnd = () => {
      if (!st.tracking) return;
      st.tracking = false;
      if (!st.active) return;
      st.active = false;
      const W = measureWidth();
      const cur = offsetRef.current;
      if (cur !== null) {
        const visible = (cur + W) / W; // 0=全闭 1=全开
        // 速度优先, 速度慢则按拉出比例 >35% 判定
        const shouldOpen =
          st.vX > 0.35 ? true : st.vX < -0.35 ? false : visible > 0.35;
        if (shouldOpen) openDrawer();
        else closeDrawer();
      }
      setOffset(null);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [openDrawer, closeDrawer]);

  const isActive = (key: NavItem['key']): boolean => {
    switch (key) {
      case 'camera':
        return pathname === '/' || pathname === '/result';
      case 'timeline':
        return pathname.startsWith('/timeline') || pathname.startsWith('/journal');
      case 'calendar':
        return pathname.startsWith('/calendar');
      case 'mine':
        return pathname.startsWith('/settings');
      default:
        return false;
    }
  };

  const handleNav = (to: string) => {
    hapticTap('light');
    navigate(to);
    closeDrawer();
  };

  /* 拖拽进度 0(全闭) → 1(全开), 用于拖动时同步遮罩透明度 */
  const W = measureWidth();
  const dragging = dragOffset !== null;
  const progress = dragging ? Math.max(0, Math.min(1, (dragOffset + W) / W)) : drawerOpen ? 1 : 0;

  return (
    <div ref={rootRef} className={styles.root} aria-hidden={!drawerOpen && !dragging}>
      {/* 右侧暗纱: 点击收回 */}
      <div
        className={styles.overlay}
        data-visible={drawerOpen || dragging}
        data-dragging={dragging || undefined}
        style={dragging ? { opacity: 0.55 * progress } : undefined}
        onClick={() => {
          hapticTap('light');
          closeDrawer();
        }}
      />

      <aside
        ref={drawerRef}
        className={styles.drawer}
        data-open={drawerOpen}
        data-dragging={dragging || undefined}
        style={dragging ? { transform: `translateX(${dragOffset}px)` } : undefined}
        role="dialog"
        aria-label="导航菜单"
      >
        {/* 品牌区: 刻字 MOMENTUNE + 等宽小字 */}
        <div className={styles.brand}>
          <div className={styles.brandName}>MOMENTUNE</div>
          <div className={styles.brandSub}>NAVIGATION</div>
        </div>
        <div className={styles.divider} aria-hidden />

        {/* 五项导航 */}
        <nav className={styles.nav} aria-label="主导航">
          {NAV_ITEMS.map(({ key, to, zh, en, Icon }) => {
            if (to === null) {
              return (
                <button
                  key={key}
                  type="button"
                  className={`${styles.item} ${styles.disabled}`}
                  disabled
                  aria-label={`${zh}(未开放)`}
                >
                  <span className={styles.itemIcon} aria-hidden>
                    <Icon />
                  </span>
                  <span className={styles.itemZh}>{zh}</span>
                  <span className={styles.itemEn}>{en}</span>
                </button>
              );
            }
            const active = isActive(key);
            return (
              <button
                key={key}
                type="button"
                className={`${styles.item}${active ? ` ${styles.active}` : ''}`}
                onClick={() => handleNav(to)}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.itemIcon} aria-hidden>
                  <Icon />
                </span>
                <span className={styles.itemZh}>{zh}</span>
                <span className={styles.itemEn}>{en}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
