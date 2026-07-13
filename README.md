# Momentune

> Every moment has its own melody.
> 每个瞬间，都有一首属于它的旋律。

## 项目简介

Momentune（Moment × Tune）是一款面向生活记录的「照片 → 情绪 → 音乐」日记应用（移动端 Web App + PWA）。拍照后 AI 自动分析照片的情绪与场景，映射到 Valence–Arousal 情绪坐标系，匹配最贴合的音乐，并在 App 内直接播放完整歌曲，保存为一页图文音乐日记，支持时间线与地图回顾。

## 核心特性

- **情绪坐标映射**：照片经视觉模型分析，输出 (效价, 唤醒度) 坐标，再在同一坐标系里为音乐做最近邻匹配——「为什么是这首歌」可解释、可复现。
- **App 内整首播放**：接入用户自己的网易云 / QQ 账号（开源接口 NeteaseCloudMusicApi），以用户身份在 App 内直接播放完整歌曲；少数取不到的歌回退免版权曲库兜底。
- **隐私友好**：照片分析经用户授权，不留存原图。

## 技术栈

- 前端：React + TypeScript（移动端 Web + PWA，Vite 构建）
- 情绪匹配算法：自研 V-A 坐标系映射（`src/algorithm/`，609 单测覆盖）
- 音乐数据：NeteaseCloudMusicApi（仅构建期脚本取播放地址，零运行时依赖）
- 字体：@fontsource 自托管（woff2，离线可用）
- 存储：localStorage（Zustand persist）
- 容器：Capacitor（可选，打包原生 App）

## 目录结构

```
momentune/
├── src/
│   ├── algorithm/        # 情绪匹配算法核心（照片→V-A、音乐→V-A、推荐匹配）
│   │   ├── config/       # 算法配置（情绪标签、风格标签、场景矩阵、权重）
│   │   └── __tests__/    # 算法单测（609 tests）
│   └── app/              # 前端应用
│       ├── components/   # UI 组件（MusicPlayer、SongWheel、PhotoCapture 等）
│       ├── pages/        # 页面（Home、Result、Timeline、Calendar、Journal 等）
│       ├── stores/       # Zustand 状态管理（analysis、player、journal 等）
│       ├── services/     # 服务层（mockApi、photoHeuristic、photoStrategy 等）
│       ├── hooks/        # 自定义 Hooks
│       └── styles/       # 全局样式
├── scripts/              # 构建期脚本（fetch-song-urls：批量取网易云播放地址）
├── public/
│   └── samples/          # 示例照片（SVG 渐变占位图，离线可用）
├── docs/                 # 项目文档（介绍、创意方案、算法设计）
└── README.md
```

## Demo 阶段说明

本项目处于 Demo 阶段，以下功能以务实方案实现，后续可平滑升级：

| 模块 | Demo 方案 | 后续升级方向 |
|------|----------|-------------|
| 照片情绪分析 | Canvas 像素统计 + 模板匹配（`photoHeuristic.ts`） | 接入多模态视觉 API（Qwen-VL / GLM-4V） |
| 音乐播放 | 网易云试听 URL + 模拟播放兜底 | 接入用户账号播放完整歌曲 |
| 音乐库 | 算法内置 2026 热歌榜（60+ 首） | 实时热歌榜 + 用户导入 |
| 定位 | 不依赖 GPS | 高德 / Mapbox + Geolocation |
| 存储 | localStorage | IndexedDB（Dexie.js） |

## 开发

```bash
npm install          # 安装依赖
npm run typecheck    # 类型检查
npm test             # 运行算法单测（609 tests）
npm run dev          # 启动开发服务器
npm run build        # 构建生产包
npm run fetch:urls   # 下载完整83首音频/封面/歌词到本地（约300MB，需 NETEASE_COOKIE 环境变量）
```

### 演示音频

仓库内含 **15 首精选演示音频**（`public/demo-audio/`，128kbps 压缩，约 59MB），覆盖 V-A 情绪各象限，5 张示例照片的默认推荐歌曲均包含在内。部署到 Vercel 后线上版本可播放这 15 首。

完整 83 首音频（`public/audio/`）在 `.gitignore` 中，需本地运行 `npm run fetch:urls` 生成（约 300MB）。音源优先级：本地全量 → 仓库演示音频 → 远程直链（代理）→ 模拟播放。

### 照片情绪分析（Qwen-VL API key 配置）

照片分析使用阿里云百炼 Qwen-VL 模型。API key 在**服务端**读取（`api/vision.ts`），不会被打进前端 bundle，部署到公网后 F12 看不到 key。

**本地开发：**
1. 复制 `.env.example` 为 `.env`，填入你的百炼 API key（变量名 `QWEN_API_KEY`，注意不带 `VITE_` 前缀）
2. `npm run dev` 启动后，Vite dev server 会自动加载 `api/vision.ts` 处理 `/api/vision` 请求（通过 `vite.config.ts` 的 `configureServer` 插件 + `ssrLoadModule`）
3. 若未配置 key，前端会自动降级到 Canvas 像素统计（`photoHeuristic.ts`），不报错

**生产部署（Vercel）：**
- Vercel 自动识别 `api/` 目录部署为 Serverless Function
- 在 Vercel 项目设置 → Environment Variables 添加 `QWEN_API_KEY`
- 前端 POST `/api/vision` → Vercel Function 调百炼 → 返回 PhotoFeatures JSON

> 注：从旧版本升级时，需手动把本地 `.env` 里的 `VITE_QWEN_API_KEY` 改名为 `QWEN_API_KEY`（去掉 `VITE_` 前缀），否则 key 会被打进前端 bundle，失去服务端保护。

## 赛事信息

- 赛事：TRAE AI 创造力大赛
- 赛道：生活娱乐 — 造点新花样
- 初赛截止：2026 年 7 月 15 日
