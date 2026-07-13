import { useNavigate } from 'react-router-dom';
import { PlatformLogin } from '../components/PlatformLogin';
import { useUserStore } from '../stores/userStore';
import { useThemeStore, type ThemeMode } from '../stores/themeStore';
import type { OnboardingAnswers } from '@algorithm/index';
import styles from './SettingsPage.module.css';

const MOOD_LABELS: Record<NonNullable<OnboardingAnswers['mood']>, string> = {
  healing: '被治愈',
  igniting: '被点燃',
  accompanying: '被陪伴',
  empathizing: '被共情',
  neutral: '都行',
};

const AGE_LABELS: Record<NonNullable<OnboardingAnswers['ageRange']>, string> = {
  under18: '未满 18',
  '18-22': '18-22',
  '23-27': '23-27',
  '28-35': '28-35',
  '36-45': '36-45',
  '46plus': '46+',
};

export function SettingsPage() {
  const navigate = useNavigate();
  const onboarded = useUserStore((s) => s.onboarded);
  const answers = useUserStore((s) => s.answers);
  const platforms = useUserStore((s) => s.platforms);
  const resetOnboarding = useUserStore((s) => s.resetOnboarding);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const loggedInCount = platforms.filter((p) => p.loggedIn).length;

  const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; desc: string }> = [
    { value: 'auto', label: '跟随时刻', desc: '7-19点日间 · 其余夜间' },
    { value: 'light', label: '日间', desc: '银盐' },
    { value: 'dark', label: '夜间', desc: '暗房' },
  ];

  // 重置后回首页,会自动弹 onboarding sheet
  const handleReset = () => {
    resetOnboarding();
    navigate('/');
  };

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

      <section className="section">
        <h2>偏好档案</h2>
        {!onboarded || !answers ? (
          <div className={styles.empty}>
            <p className="muted">还没做过偏好问卷</p>
            <button className="btn btn-primary mt-md" onClick={handleReset} type="button">
              去填写
            </button>
          </div>
        ) : (
          <div className="card">
            <dl className={styles.prefList}>
              <div className={styles.prefRow}>
                <dt>年龄段</dt>
                <dd>{answers.ageRange ? AGE_LABELS[answers.ageRange] : '未填'}</dd>
              </div>
              <div className={styles.prefRow}>
                <dt>主用平台</dt>
                <dd>
                  {platforms.find((p) => p.id === answers.platform)?.label ?? answers.platform}
                </dd>
              </div>
              <div className={styles.prefRow}>
                <dt>情绪偏好</dt>
                <dd>{MOOD_LABELS[answers.mood]}</dd>
              </div>
              <div className={styles.prefRow}>
                <dt>风格偏好</dt>
                <dd className={styles.tagsWrap}>
                  {answers.genres.length > 0 ? (
                    answers.genres.map((g) => <span key={g} className="tag">{g}</span>)
                  ) : (
                    <span className="muted">不限</span>
                  )}
                </dd>
              </div>
              <div className={styles.prefRow}>
                <dt>语言偏好</dt>
                <dd className={styles.tagsWrap}>
                  {answers.languages.length > 0 ? (
                    answers.languages.map((l) => (
                      <span key={l} className="tag tag-muted">{l}</span>
                    ))
                  ) : (
                    <span className="muted">不限</span>
                  )}
                </dd>
              </div>
            </dl>
            <button
              className={`btn btn-ghost ${styles.resetBtn}`}
              onClick={handleReset}
            >
              重置偏好,重新做问卷
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
