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

- 前端：React + TypeScript（移动端 Web + PWA）
- 后端：Node 中间商（NeteaseCloudMusicApi），用户授权后以其身份取歌曲地址
- AI 分析：国内多模态视觉 API（Qwen-VL / GLM-4V / 豆包视觉），输出情绪坐标
- 音乐：接入用户网易云 / QQ 账号取完整歌曲 + 免版权曲库（预标 V-A 坐标）兜底
- 存储：IndexedDB（Dexie.js）
- 地图与定位：高德 / Mapbox + 浏览器 Geolocation

## 目录结构

```
momentune/
├── docs/          # 项目文档（介绍、创意方案 HTML）
├── server/        # 音乐中间商服务（NeteaseCloudMusicApi）
├── src/           # Demo 源代码（前端）
├── public/        # 静态资源（图片、图标）
├── data/          # 模拟数据（音乐库、情绪坐标）
└── README.md      # 项目说明
```

## 赛事信息

- 赛事：TRAE AI 创造力大赛
- 赛道：生活娱乐 — 造点新花样
- 初赛截止：2026 年 7 月 15 日
