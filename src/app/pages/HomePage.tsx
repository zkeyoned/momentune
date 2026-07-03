import { PhotoCapture } from '../components/PhotoCapture';
import { PlatformPopover } from '../components/PlatformPopover';
import { OnboardingPage } from './OnboardingPage';
import { useUserStore } from '../stores/userStore';
import styles from './HomePage.module.css';

export function HomePage() {
  const onboarded = useUserStore((s) => s.onboarded);
  const onboardingDismissed = useUserStore((s) => s.onboardingDismissed);
  const dismissOnboarding = useUserStore((s) => s.dismissOnboarding);

  // 首次进入且未跳过/未完成 → 自动弹 onboarding sheet
  const showOnboarding = !onboarded && !onboardingDismissed;

  return (
    <div className={styles.page}>
      {/* —— Hero(胶片日记封面) —— */}
      <section className={styles.hero}>
        <span className={styles.filmBadge} aria-hidden>FILM · 35MM</span>
        <h1 className={styles.title}>Momentune</h1>
        <p className={styles.taglineEn}>Every moment has its own melody.</p>
      </section>

      {/* —— 拍照入口(自适应填满剩余空间) —— */}
      <section className={styles.contentSection}>
        <div className={styles.sectionHead}>
          <h2>拍一张照片</h2>
          <PlatformPopover />
        </div>
        <PhotoCapture variant="full" />
      </section>

      {/* —— 首次进入自动弹 onboarding sheet —— */}
      {showOnboarding && <OnboardingPage onClose={dismissOnboarding} />}
    </div>
  );
}
