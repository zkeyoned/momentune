import { PlatformLogin } from '../components/PlatformLogin';
import { useUserStore } from '../stores/userStore';
import { useThemeStore, type ThemeMode } from '../stores/themeStore';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const platforms = useUserStore((s) => s.platforms);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const loggedInCount = platforms.filter((p) => p.loggedIn).length;

  const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; desc: string }> = [
    { value: 'auto', label: '跟随时刻', desc: '7-19点日间 · 其余夜间' },
    { value: 'light', label: '日间', desc: '银盐' },
    { value: 'dark', label: '夜间', desc: '暗房' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.filmBadge} aria-hidden>ROLL · 03</span>
        <h1 className={styles.title}>设置</h1>
      </header>

      <section className="section">
        <h2>音乐平台</h2>
        <p className="muted mb-md">
          {loggedInCount}/{platforms.length} 已登录
        </p>
        <PlatformLogin />
      </section>

      <section className="section">
        <h2>外观</h2>
        <p className="muted mb-md">界面跟着一天的时刻变化</p>
        <div className={styles.themeList}>
          {THEME_OPTIONS.map((opt) => {
            const active = themeMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`${styles.themeRow} ${active ? styles.themeRowActive : ''}`}
                onClick={() => setThemeMode(opt.value)}
                aria-pressed={active}
              >
                <span className={styles.themeRadio} aria-hidden>
                  <span className={styles.themeRadioDot} />
                </span>
                <span className={styles.themeText}>
                  <span className={styles.themeLabel}>{opt.label}</span>
                  <span className={styles.themeDesc}>{opt.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
