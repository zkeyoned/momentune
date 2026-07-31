import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
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

// ---------------------------------------------------------------------------
// 本地 dev middleware:把 /api/netease/* 转发到 api/netease/*.ts 的 handler
// ---------------------------------------------------------------------------
// 与 visionApiDevPlugin 类似,但支持多路由(根据 URL 路径加载对应模块)。
// 生产环境:Vercel 自动识别 api/ 目录部署为 Serverless Function,本段不生效。

function neteaseApiDevPlugin(): Plugin {
  // 路由 → 模块路径映射
  const routes: Record<string, string> = {
    '/api/netease/qr-create': '/api/netease/qr-create.ts',
    '/api/netease/qr-check': '/api/netease/qr-check.ts',
    '/api/netease/likelist': '/api/netease/likelist.ts',
    '/api/netease/song-detail-batch': '/api/netease/song-detail-batch.ts',
    '/api/netease/song-url': '/api/netease/song-url.ts',
  };

  return {
    name: 'momentune-netease-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        // 提取 pathname(去掉 query string)
        const pathname = url.split('?')[0]!;

        // 匹配路由
        const modulePath = routes[pathname];
        if (!modulePath) {
          next();
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

        // 解析 query
        const query: Record<string, string> = {};
        const urlObj = new URL(url, 'http://localhost');
        urlObj.searchParams.forEach((v, k) => { query[k] = v; });

        // 解析 body
        let body: Record<string, unknown> = {};
        if (bodyStr) {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            // 非 JSON body,空对象兜底
          }
        }

        // 构造类 Vercel req/res
        const vercelReq = {
          method: req.method,
          body,
          query,
        };
        const vercelRes = {
          status: (code: number) => ({
            json: (data: unknown) => {
              res.statusCode = code;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            end: (data?: string) => res.end(data),
          }),
          setHeader: (name: string, value: string) => res.setHeader(name, value),
          end: (data?: string) => res.end(data),
        };

        try {
          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default;
          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Module ${modulePath} has no default export` }));
            return;
          }
          await handler(vercelReq, vercelRes);
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

// ---------------------------------------------------------------------------
// 本地 dev middleware:音频代理(替代 Vite server.proxy)
// ---------------------------------------------------------------------------
// Vite 内置 server.proxy 对带查询参数的流式音频代理支持不佳,
// 会报 "Must provide a proper URL as target"。
// 改用自定义 middleware,直接 fetch + pipe,与生产环境 audio-proxy.ts 行为一致。
// 生产环境:Vercel 用 api/audio-proxy.ts Serverless Function,本段不生效。

function audioProxyDevPlugin(): Plugin {
  return {
    name: 'momentune-audio-proxy-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/audio-proxy', async (req, res) => {
        // OPTIONS 预检
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed, use GET' }));
          return;
        }

        // 从 query 取 url 参数
        const fullUrl = new URL(req.url ?? '', 'http://localhost');
        const targetUrl = fullUrl.searchParams.get('url');
        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'missing url param' }));
          return;
        }

        // 请求上游(Referer/UA 与生产环境一致)
        let upstream: Response;
        try {
          upstream = await fetch(targetUrl, {
            headers: {
              Referer: 'https://music.163.com',
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'upstream fetch failed' }));
          return;
        }

        if (upstream.status !== 200 || !upstream.body) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `upstream returned ${upstream.status}` }));
          return;
        }

        // 流式转发
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'audio/mpeg');

        const nodeStream = Readable.fromWeb(
          upstream.body as unknown as NodeReadableStream,
        );
        nodeStream.on('error', () => {
          try { res.end(); } catch { /* already ended */ }
        });
        nodeStream.pipe(res);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// 本地 dev middleware:把 /api/qq/* 和 /api/qishui/* 转发到对应 api/*.ts handler
// ---------------------------------------------------------------------------
// 与 neteaseApiDevPlugin 同模式,代理 QQ 音乐 / 汽水音乐相关端点。
// 生产环境:Vercel 自动识别 api/ 目录部署为 Serverless Function,本段不生效。
// CORS / OPTIONS 预检由各 handler 内部的 handleRequest / setAudioCors 处理(与 netease 一致)。

/**
 * 通用多路由 Vercel-style API dev middleware 工厂
 *
 * 与 neteaseApiDevPlugin 同模式:根据 pathname 匹配路由表,
 * 用 server.ssrLoadModule 加载对应 api/*.ts 模块(支持热更新),
 * 构造类 Vercel req/res 后调 default handler。
 *
 * @param pluginName Vite plugin 名(用于调试)
 * @param routes     pathname → 模块路径映射(如 '/api/qq/qr-create' → '/api/qq/qr-create.ts')
 */
function createVercelApiDevPlugin(pluginName: string, routes: Record<string, string>): Plugin {
  return {
    name: pluginName,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        // 提取 pathname(去掉 query string)
        const pathname = url.split('?')[0]!;

        // 匹配路由,未命中交给后续 middleware
        const modulePath = routes[pathname];
        if (!modulePath) {
          next();
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

        // 解析 query
        const query: Record<string, string> = {};
        const urlObj = new URL(url, 'http://localhost');
        urlObj.searchParams.forEach((v, k) => { query[k] = v; });

        // 解析 body
        let body: Record<string, unknown> = {};
        if (bodyStr) {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            // 非 JSON body,空对象兜底
          }
        }

        // 构造类 Vercel req/res
        const vercelReq = {
          method: req.method,
          body,
          query,
        };
        const vercelRes = {
          status: (code: number) => ({
            json: (data: unknown) => {
              res.statusCode = code;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            end: (data?: string) => res.end(data),
          }),
          setHeader: (name: string, value: string) => res.setHeader(name, value),
          end: (data?: string) => res.end(data),
        };

        // 加载 api/*.ts 模块(ssr 模式,支持热更新),调 default handler
        try {
          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default;
          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Module ${modulePath} has no default export` }));
            return;
          }
          await handler(vercelReq, vercelRes);
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

/** QQ 音乐 API dev middleware:代理 /api/qq/* 到 api/qq/*.ts */
function qqApiDevPlugin(): Plugin {
  return createVercelApiDevPlugin('momentune-qq-api-dev', {
    '/api/qq/qr-create': '/api/qq/qr-create.ts',
    '/api/qq/qr-check': '/api/qq/qr-check.ts',
    '/api/qq/likelist': '/api/qq/likelist.ts',
    '/api/qq/user-playlists': '/api/qq/user-playlists.ts',
    '/api/qq/playlist-detail': '/api/qq/playlist-detail.ts',
    '/api/qq/song-detail-batch': '/api/qq/song-detail-batch.ts',
    '/api/qq/song-url': '/api/qq/song-url.ts',
    '/api/qq/audio-proxy': '/api/qq/audio-proxy.ts',
  });
}

/** 汽水音乐 API dev middleware:代理 /api/qishui/* 到 api/qishui/*.ts */
function qishuiApiDevPlugin(): Plugin {
  return createVercelApiDevPlugin('momentune-qishui-api-dev', {
    '/api/qishui/qr-create': '/api/qishui/qr-create.ts',
    '/api/qishui/qr-check': '/api/qishui/qr-check.ts',
    '/api/qishui/playlist-list': '/api/qishui/playlist-list.ts',
    '/api/qishui/playlist-detail': '/api/qishui/playlist-detail.ts',
    '/api/qishui/song-url': '/api/qishui/song-url.ts',
    '/api/qishui/audio-proxy': '/api/qishui/audio-proxy.ts',
  });
}

export default defineConfig(({ mode }) => {
  // loadEnv 第三个参数 '' 表示加载所有 env(含非 VITE_ 前缀的,如 QWEN_API_KEY)
  const env = loadEnv(mode, process.cwd(), '');
  const qwenApiKey = env.QWEN_API_KEY ?? '';

  return {
    plugins: [
      react(),
      visionApiDevPlugin(qwenApiKey),
      neteaseApiDevPlugin(),
      audioProxyDevPlugin(),
      qqApiDevPlugin(),
      qishuiApiDevPlugin(),
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
      // 音频代理已由 audioProxyDevPlugin middleware 处理(替代 server.proxy)
      // Vite 内置 proxy 对带查询参数的流式音频代理支持不佳,会报 "Must provide a proper URL as target"
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'es2020',
    },
  };
});
