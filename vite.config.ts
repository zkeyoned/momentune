import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath, URL } from 'node:url';

// 注意：本文件用于 Vite 前端构建（dev/build/preview）。
// 单元测试配置见 vitest.config.ts，二者互不影响。

export default defineConfig({
  plugins: [
    react(),
    // 自签名 HTTPS:demo 需在手机上现场拍照,getUserMedia 仅在 HTTPS/localhost 下可用,
    // 手机走局域网 IP 访问必须有 HTTPS(自签名证书浏览器会警告,点"高级→继续访问")。
    // basicSsl(),  // 临时注释:Trae 内置预览不支持自签名 HTTPS。手机拍照时恢复
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Momentune · 瞬间旋律',
        short_name: 'Momentune',
        description: '拍照→AI情绪分析→音乐推荐→图文音乐日记',
        // 深色主题:智能绿主色 + 深蓝黑底
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'window-controls-overlay'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        categories: ['lifestyle', 'music', 'photography'],
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,woff}'],
        // Noto Serif SC 中文字体 woff 文件约 2.1MB,超过 Workbox 默认 2MB 限制
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@algorithm': fileURLToPath(new URL('./src/algorithm', import.meta.url)),
      '@config': fileURLToPath(new URL('./src/algorithm/config', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: false,
    proxy: {
      // 网易云音频代理:绕过 CORS/ORB 限制
      // router 是 http-proxy-middleware 的有效选项,Vite 类型定义未包含,此处用 any
      '/api/audio-proxy': {
        changeOrigin: true,
        router: (req: any) => {
          const fullUrl = new URL(req.url ?? '', 'http://localhost');
          const targetUrl = fullUrl.searchParams.get('url');
          if (!targetUrl) return 'http://localhost';
          return new URL(targetUrl).origin;
        },
        configure: (proxy: any) => {
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            const fullUrl = new URL(req.url ?? '', 'http://localhost');
            const targetUrl = fullUrl.searchParams.get('url');
            if (!targetUrl) return;
            const target = new URL(targetUrl);
            proxyReq.path = target.pathname + target.search;
            proxyReq.setHeader('host', target.host);
            proxyReq.setHeader('Referer', 'https://music.163.com/');
          });
        },
      } as any,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
});
