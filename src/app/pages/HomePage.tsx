import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../stores/analysisStore';
import { useJournalStore } from '../stores/journalStore';
import { SAMPLE_PHOTOS } from '../services/mockApi';
import type { SamplePhoto } from '../services/mockApi';
import { isNative, hapticImpact, hapticNotify } from '../services/nativeBridge';
import { createPhotoStrategy } from '../services/photoStrategy';
import { useCameraManager } from '../hooks/useCameraManager';
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
  const recentPhoto = useJournalStore((s) => s.journals[0]?.photoUrl);

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
    navigate('/result');
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

        <div className={styles.dialGroup}>
          <div className={styles.modeDial} aria-hidden>
            <span className={styles.dialText}>标准</span>
            <span className={styles.dialPointer} />
          </div>
          <div className={styles.dialCaption}>格式：标准・邮票・专辑</div>
        </div>
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

        <div className={styles.nameplates}>
          <button
            type="button"
            className={styles.nameplate}
            data-active={autoMood || undefined}
            onClick={() => setAutoMood((v) => !v)}
          >
            情绪·自动
          </button>
          <button
            type="button"
            className={styles.nameplate}
            data-active={gridOn || undefined}
            onClick={() => setGridOn((v) => !v)}
          >
            网格
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
            <span className={styles.shutterInner} />
          </button>

          <button
            type="button"
            className={styles.flipBtn}
            onClick={handleFlip}
            aria-label="翻转摄像头"
          >
            <span className={styles.flipKnob} aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <path d="M4 9a8 8 0 0114-3" strokeLinecap="round" />
                <path d="M20 15a8 8 0 01-14 3" strokeLinecap="round" />
                <path d="M4 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className={styles.flipLabel}>翻转摄像头</span>
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
    </div>
  );
}
