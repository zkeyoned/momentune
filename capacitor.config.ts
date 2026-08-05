import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.momentune.app',
  appName: 'Momentune',
  webDir: 'dist',
  backgroundColor: '#0d1117',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#f2f3f4',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // 状态栏白字,配 App 深色场景(拍照/播放)
      style: 'LIGHT',
      backgroundColor: '#0d1117',
      overlaysWebView: false,
    },
    Camera: {
      // 允许同时用相机和相册
      permissions: ['camera', 'photos'],
    },
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0d1117',
  },
};

export default config;
