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
npm run fetch:urls   # 批量取网易云播放地址（构建期，需 cookie）
```

## 赛事信息

- 赛事：TRAE AI 创造力大赛
- 赛道：生活娱乐 — 造点新花样
- 初赛截止：2026 年 7 月 15 日
