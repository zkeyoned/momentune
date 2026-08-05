import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../stores/analysisStore';
import { useJournalStore } from '../stores/journalStore';
import { useUiStore } from '../stores/uiStore';
import { useUserStore } from '../stores/userStore';
import { SAMPLE_PHOTOS } from '../services/mockApi';
import type { SamplePhoto } from '../services/mockApi';
import { isNative, hapticImpact, hapticNotify } from '../services/nativeBridge';
import { createPhotoStrategy } from '../services/photoStrategy';
import { useCameraManager } from '../hooks/useCameraManager';
import { RecognitionOverlay } from '../components/RecognitionOverlay';
import styles from './HomePage.module.css';

function fmtDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function flipHorizontal(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function HomePage() {
  const navigate = useNavigate();
  const setPending = useAnalysisStore((s) => s.setPending);
  const pending = useAnalysisStore((s) => s.pending);
  const loading = useAnalysisStore((s) => s.loading);
  const result = useAnalysisStore((s) => s.result);
  const error = useAnalysisStore((s) => s.error);
  const clear = useAnalysisStore((s) => s.clear);
  const runAnalysis = useAnalysisStore((s) => s.runAnalysis);
  const userPref = useUserStore((s) => s.userPref);
  const recentPhoto = useJournalStore((s) => s.journals[0]?.photoUrl);
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const toggleDrawer = useUiStore((s) => s.toggleDrawer);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const native = isNative();

  const camera = useCameraManager(videoRef, !native);
  const isFront = camera.facingMode === 'user';

  const photoStrategy = useMemo(
    () => createPhotoStrategy(camera.captureFrame, fileRef),
    [camera.captureFrame],
  );

  const [gridOn, setGridOn] = useState(false);
  const [autoMood, setAutoMood] = useState(true);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [step, setStep] = useState(0);
  const progress = Math.round((step / 3) * 100);

  // 监听 loading 推进 step: false→true 重置并按 1.2s/2.4s 推进; true→false 一次性到 3
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    const prev = prevLoadingRef.current;
    if (!prev && loading) {
      setStep(0);
      const t1 = setTimeout(() => setStep(1), 1200);
      const t2 = setTimeout(() => setStep(2), 2400);
      prevLoadingRef.current = true;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (prev && !loading) {
      setStep(3);
      prevLoadingRef.current = false;
    }
    return undefined;
  }, [loading]);

  // 识别完成后延时跳转,让圆环动画走完
  useEffect(() => {
    if (!loading && result) {
      const t = setTimeout(() => navigate('/result'), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [loading, result, navigate]);

  const submitPhoto = (
    dataUrl: string,
    source: 'camera' | 'album' | 'sample',
    title: string,
    location?: string,
    features?: SamplePhoto['features'],
  ) => {
    if (features) {
      setPending({
        features,
        previewUrl: dataUrl,
        source,
        title,
        location,
      });
    } else {
      const placeholder =
        SAMPLE_PHOTOS[Math.floor(Math.random() * SAMPLE_PHOTOS.length)]!.features;
      setPending({
        features: placeholder,
        previewUrl: dataUrl,
        source,
        title,
        location,
        needsFeatureEstimation: true,
      });
    }
    void hapticNotify('success');
    // 主动触发识别,不再立即跳转;跳转时机由上方 effect 控制
    void runAnalysis(userPref);
  };

  const handleShutter = async () => {
    void hapticImpact('medium');
    setShutterFlash(true);
    await new Promise((r) => setTimeout(r, 110));
    let photoData = await photoStrategy.capturePhoto();
    if (photoData && !native && camera.facingMode === 'environment') {
      photoData = await flipHorizontal(photoData);
    }
    setShutterFlash(false);
    if (photoData) {
      submitPhoto(photoData, 'camera', `抓拍 ${new Date().toLocaleTimeString()}`);
    }
  };

  const handleFlip = () => {
    void hapticImpact('light');
    camera.flipCamera();
  };

  const handleAlbum = async () => {
    void hapticImpact('light');
    const photoData = await photoStrategy.pickPhoto();
    if (photoData) {
      submitPhoto(photoData, 'album', '我的照片');
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    submitPhoto(
      url,
      'album',
      file.name.replace(/\.[^.]+$/, '').slice(0, 20) || '我的照片',
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.topPlate}>
        <div className={styles.brandGroup}>
          <div className={styles.brand} aria-label="MOMENTUNE">
            MOMENTUNE
          </div>
          <div className={styles.brandSub}>5.0 MEGA PIXELS・CCD</div>
        </div>

        <span className={styles.powerLed} aria-label="电源指示灯" />
      </div>

      <div className={styles.body}>
        <div className={styles.viewfinder}>
          <video
            ref={videoRef}
            className={`${styles.video} ${isFront ? styles.videoFront : ''}`}
            playsInline
            muted
            autoPlay
          />

          <span className={styles.moodLabel}>MOOD·AUTO</span>
          <div className={styles.battery} aria-label="电量">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.dateStamp}>{fmtDate()}</div>
          <span className={styles.glassReflect} aria-hidden />

          {gridOn && (
            <>
              <span className={`${styles.gridLine} ${styles.gridH1}`} aria-hidden />
              <span className={`${styles.gridLine} ${styles.gridH2}`} aria-hidden />
              <span className={`${styles.gridLine} ${styles.gridV1}`} aria-hidden />
              <span className={`${styles.gridLine} ${styles.gridV2}`} aria-hidden />
            </>
          )}

          {shutterFlash && <div className={styles.flash} aria-hidden />}

          {native && (
            <div className={styles.vfHint}>
              <span className={styles.vfHintIcon} aria-hidden>📷</span>
              <span className={styles.vfHintText}>点击下方快门拍照</span>
            </div>
          )}
          {!native && !camera.isReady && !camera.hasError && (
            <div className={styles.vfHint}>
              <span className={styles.vfHintIcon} aria-hidden>📷</span>
              <span className={styles.vfHintText}>正在启动摄像头…</span>
            </div>
          )}
          {!native && camera.hasError && (
            <div className={styles.vfHint}>
              <span className={styles.vfHintIcon} aria-hidden>📷</span>
              <span className={styles.vfHintText}>无法访问摄像头</span>
            </div>
          )}
        </div>

        {/* 屏幕下方实体按键排: 英文刻字 + 键帽 + 凹槽线 */}
        <div className={styles.keyRow}>
          <button
            type="button"
            className={styles.pkey}
            data-on={autoMood || undefined}
            onClick={() => setAutoMood((v) => !v)}
            aria-pressed={autoMood}
            aria-label="情绪自动"
          >
            <span className={styles.pkeyLabel}>MOOD</span>
            <span className={styles.pkeyCap} aria-hidden />
            <span className={styles.pkeyGroove} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.pkey}
            data-on={gridOn || undefined}
            onClick={() => setGridOn((v) => !v)}
            aria-pressed={gridOn}
            aria-label="网格"
          >
            <span className={styles.pkeyLabel}>GRID</span>
            <span className={styles.pkeyCap} aria-hidden />
            <span className={styles.pkeyGroove} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.pkey}
            data-on={drawerOpen || undefined}
            onClick={toggleDrawer}
            aria-pressed={drawerOpen}
            aria-label="菜单"
          >
            <span className={styles.pkeyLabel}>MENU</span>
            <span className={styles.pkeyCap} aria-hidden />
            <span className={styles.pkeyGroove} aria-hidden />
          </button>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.albumBtn}
            onClick={handleAlbum}
            aria-label="相册"
          >
            {recentPhoto ? (
              <img src={recentPhoto} alt="最近照片" className={styles.albumImg} />
            ) : null}
          </button>

          <button
            type="button"
            className={styles.shutter}
            onClick={handleShutter}
            disabled={!native && !camera.isReady}
            aria-label="拍照"
          >
            <span className={styles.shutterBody} aria-hidden>
              <span className={styles.shutterHub} aria-hidden />
            </span>
          </button>

          <button
            type="button"
            className={styles.flipBtn}
            onClick={handleFlip}
            aria-label="翻转摄像头"
          >
            <span className={styles.flipKnob} aria-hidden>
              {/* 刻线图标: 两道弧形箭头首尾相对绕圈, 中心小圆点代表镜头 */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <path d="M5.2 12a6.8 6.8 0 0 1 11.9-4.5" strokeLinecap="round" />
                <path d="M18.8 12a6.8 6.8 0 0 1-11.9 4.5" strokeLinecap="round" />
                <path d="M17.6 4.6l-.6 3.1-3.1-.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.4 19.4l.6-3.1 3.1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="1.7" />
              </svg>
            </span>
          </button>
        </div>

        <div className={styles.speaker} aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className={styles.speakerHole} />
          ))}
        </div>
      </div>

      {!native && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleFile}
        />
      )}

      {(loading || error) && pending && (
        <RecognitionOverlay
          previewUrl={pending.previewUrl}
          step={step}
          progress={progress}
          error={error}
          onRetry={() => clear()}
        />
      )}
    </div>
  );
}
