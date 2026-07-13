import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath, URL } from 'node:url';

// 注意：本文件用于 Vite 前端构建（dev/build/preview）。
// 单元测试配置见 vitest.config.ts，二者互不影响。

// ---------------------------------------------------------------------------
// 本地 dev middleware:把 /api/vision 转发到 api/vision.ts 的 server handler
// ---------------------------------------------------------------------------
// Vite dev 不会自动跑 api/ 目录(Vercel 约定),本地需要这条 middleware。
// 生产环境:Vercel 自动识别 api/ 目录部署为 Serverless Function,本段不生效。
//
// 做法:用 server.ssrLoadModule 加载 api/vision.ts 模块,直接调 analyzePhotoWithQwenServer。
// API key 从 loadEnv 读 .env 里的 QWEN_API_KEY(无 VITE_ 前缀,不打进前端包)。
//
// 注意:API key 只通过参数传给 ssrLoadModule 加载的模块,
//      绝不会出现在前端 bundle 中。

function visionApiDevPlugin(apiKey: string): Plugin {
  return {
    name: 'momentune-vision-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/vision', async (req, res) => {
        // 只接受 POST
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed, use POST' }));
          return;
        }

        // 收集 body
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          if (typeof chunk === 'string' || chunk instanceof Buffer) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
        }
        const bodyStr = Buffer.concat(chunks).toString('utf-8');

        let bodyJson: { imageDataUrl?: string };
        try {
          bodyJson = JSON.parse(bodyStr);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        const { imageDataUrl } = bodyJson;
        if (!imageDataUrl || typeof imageDataUrl !== 'string') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing or invalid imageDataUrl in body' }));
          return;
        }

        if (!apiKey || apiKey.trim() === '') {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Server QWEN_API_KEY not configured' }));
          return;
        }

        // 加载 api/vision.ts 模块(ssr 模式,支持 TS),调共享核心函数
        try {
          const mod = await server.ssrLoadModule('/api/vision.ts');
          const features = await mod.analyzePhotoWithQwenServer(imageDataUrl, apiKey);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(features));
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown server error';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv 第三个参数 '' 表示加载所有 env(含非 VITE_ 前缀的,如 QWEN_API_KEY)
  const env = loadEnv(mode, process.cwd(), '');
  const qwenApiKey = env.QWEN_API_KEY ?? '';

  return {
    plugins: [
      react(),
      visionApiDevPlugin(qwenApiKey),
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
  };
});
