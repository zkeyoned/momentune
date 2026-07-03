import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { useOnboardingStore, ONBOARDING_TOTAL_STEPS } from '../stores/onboardingStore';
import { useUserStore } from '../stores/userStore';
import { PlatformLogin } from '../components/PlatformLogin';
import { getGenreGroups, getLanguageOptions } from '../services/mockApi';
import { initUserPreference } from '@algorithm/index';
import type { GenreTag, LanguageTag, MoodPreference, PlatformPreference } from '@algorithm/index';
import styles from './OnboardingPage.module.css';

const AGE_OPTIONS = [
  { id: 'under18', label: '未满 18' },
  { id: '18-22', label: '18-22' },
  { id: '23-27', label: '23-27' },
  { id: '28-35', label: '28-35' },
  { id: '36-45', label: '36-45' },
  { id: '46plus', label: '46+' },
] as const;

const PLATFORM_OPTIONS: Array<{ id: PlatformPreference; label: string }> = [
  { id: 'netease', label: '网易云音乐' },
  { id: 'qq', label: 'QQ 音乐' },
  { id: 'qishui', label: '汽水音乐' },
  { id: 'other', label: '其他' },
];

const MOOD_OPTIONS: Array<{ id: MoodPreference; label: string; desc: string }> = [
  { id: 'healing', label: '被治愈', desc: '需要温暖、抚慰的歌' },
  { id: 'igniting', label: '被点燃', desc: '需要燃、有能量的歌' },
  { id: 'accompanying', label: '被陪伴', desc: '需要不孤独的氛围' },
  { id: 'empathizing', label: '被共情', desc: '需要懂我此刻的歌' },
  { id: 'neutral', label: '都行', desc: '看照片决定就好' },
];

interface OnboardingPageProps {
  /** 关闭 sheet(跳过)回调 */
  onClose: () => void;
}

export function OnboardingPage({ onClose }: OnboardingPageProps) {
  const {
    step,
    ageRange,
    platform,
    genres,
    mood,
    languages,
    genresSkipped,
    next,
    prev,
    setAgeRange,
    setPlatform,
    toggleGenre,
    setGenresSkipped,
    setMood,
    toggleLanguage,
    reset,
    buildAnswers,
  } = useOnboardingStore();
  const setOnboarded = useUserStore((s) => s.setOnboarded);

  const genreGroups = getGenreGroups();
  const languageOptions = getLanguageOptions();
  const isLast = step === ONBOARDING_TOTAL_STEPS - 1;

  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  // 进入动画 + 锁背景滚动 + ESC 关闭
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const canNext = (): boolean => {
    if (step === 0) return true; // 年龄段可跳过
    if (step === 1) return !!platform;
    if (step === 2) return genresSkipped || genres.length >= 3;
    if (step === 3) return !!mood;
    if (step === 4) return true; // 语言可跳过
    return true;
  };

  const handleComplete = () => {
    const answers = buildAnswers();
    const userPref = initUserPreference(answers, []);
    setOnboarded(answers, userPref);
    reset();
    onClose();
  };

  // —— 下滑跳过手势(只在 grabber 上触发) ——
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) dragStartY.current = t.clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (dragStartY.current === null) return;
    const t = e.touches[0];
    if (!t) return;
    const dy = t.clientY - dragStartY.current;
    if (dy > 0) setDragY(dy); // 只允许下拉
  };
  const onTouchEnd = () => {
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
    dragStartY.current = null;
  };

  const sheetStyle = dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div
        className={styles.sheet}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* —— grabber + 跳过 —— */}
        <div
          className={styles.grabber}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className={styles.handle} aria-hidden />
          <button className={styles.skipBtn} onClick={onClose} type="button">
            跳过
          </button>
        </div>

        {/* —— 进度 —— */}
        <header className={styles.header}>
          <div className={styles.progressDots}>
            {Array.from({ length: ONBOARDING_TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${i < step ? styles.dotDone : ''}`}
              />
            ))}
          </div>
          <p className={styles.stepLabel}>
            第 {step + 1} / {ONBOARDING_TOTAL_STEPS} 步
          </p>
        </header>

        {/* —— 可滚动问卷内容 —— */}
        <main className={styles.body}>
          {step === 0 && (
            <div>
              <h1 className={styles.qTitle}>你多大了?</h1>
              <p className="muted mb-md">用于校准推荐偏好,可选</p>
              <div className={styles.optionGrid}>
                {AGE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className={`${styles.optionCard} ${ageRange === o.id ? styles.optionActive : ''}`}
                    onClick={() => setAgeRange(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className={styles.qTitle}>主用哪个音乐 App?</h1>
              <p className="muted mb-md">后续可在设置里连接平台</p>
              <div className={styles.optionList}>
                {PLATFORM_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className={`${styles.optionRow} ${platform === o.id ? styles.optionActive : ''}`}
                    onClick={() => setPlatform(o.id)}
                  >
                    <span>{o.label}</span>
                    {platform === o.id && <span className={styles.check}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className={styles.qTitle}>喜欢哪些风格?</h1>
              <p className="muted mb-md">至少选 3 个,或直接跳过</p>
              {!genresSkipped && genres.length > 0 && (
                <p className={`${styles.selectedCount} accent`}>已选 {genres.length}</p>
              )}
              {genreGroups.map((group) => (
                <div key={group.id} className={styles.genreGroup}>
                  <h3 className={styles.genreGroupTitle}>{group.label}</h3>
                  <div className={styles.genreGrid}>
                    {group.tags.map((tag) => (
                      <button
                        key={tag.id}
                        className={`${styles.genreChip} ${genres.includes(tag.id) ? styles.optionActive : ''}`}
                        onClick={() => toggleGenre(tag.id as GenreTag)}
                      >
                        <span className={styles.genreLabel}>{tag.label}</span>
                        {tag.hot >= 4 && <span className={styles.hotDot} aria-label="热门">★</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                className={`btn btn-ghost btn-block ${styles.skipGenreBtn}`}
                onClick={() => setGenresSkipped(true)}
              >
                {genresSkipped ? '已选择跳过 ✓' : '跳过,不限制风格'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className={styles.qTitle}>照片配歌,你最想要?</h1>
              <p className="muted mb-md">这会影响推荐的情绪倾向</p>
              <div className={styles.optionList}>
                {MOOD_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className={`${styles.optionRow} ${mood === o.id ? styles.optionActive : ''}`}
                    onClick={() => setMood(o.id)}
                  >
                    <div>
                      <div className={styles.moodLabel}>{o.label}</div>
                      <div className={`muted ${styles.moodDesc}`}>{o.desc}</div>
                    </div>
                    {mood === o.id && <span className={styles.check}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className={styles.qTitle}>语言偏好?</h1>
              <p className="muted mb-md">多选,可不选</p>
              <div className={styles.optionList}>
                {languageOptions.map((o) => (
                  <button
                    key={o.id}
                    className={`${styles.optionRow} ${languages.includes(o.id) ? styles.optionActive : ''}`}
                    onClick={() => toggleLanguage(o.id as LanguageTag)}
                  >
                    <span>{o.label}</span>
                    {languages.includes(o.id) && <span className={styles.check}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h1 className={styles.qTitle}>绑定音乐平台</h1>
              <p className="muted mb-md">
                登录后可播放完整歌曲。可跳过,稍后在「设置」里再绑
              </p>
              <PlatformLogin compact />
            </div>
          )}
        </main>

        {/* —— 底部按钮 —— */}
        <footer className={styles.footer}>
          {step > 0 && (
            <button className="btn btn-ghost" onClick={prev}>
              ← 上一步
            </button>
          )}
          {!isLast ? (
            <button className="btn btn-primary" onClick={next} disabled={!canNext()}>
              下一步 →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleComplete}>
              完成,开始使用 →
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
