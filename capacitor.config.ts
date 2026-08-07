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
      // 状态栏黑字,配机身银色场景
      style: 'DARK',
      backgroundColor: '#e9ebec',
      overlaysWebView: true,
    },
    Camera: {
      // 允许同时用相机和相册
      permissions: ['camera', 'photos'],
    },
  },
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0d1117',
  },
};

export default config;
