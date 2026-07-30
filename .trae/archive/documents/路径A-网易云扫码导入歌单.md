# 路径A：网易云扫码登录 → 自动导入红心歌单

## 摘要

把当前 mock 扫码登录替换为真实的网易云 QR 登录，登录成功后自动拉取用户「我喜欢的音乐」红心歌单，通过已存在的 `importUserPlaylist` 接口导入本地音乐库。导入歌曲在播放时按需获取播放地址（非批量预取）。Cookie 明文存 localStorage（复赛可接受）。

## 当前状态分析

### 已具备的基础设施
- `src/algorithm/musicLibrary.ts` 第 1375-1432 行：`importUserPlaylist` / `mergeUserImports` 已实现，期望 `ImportedSongEntry[]`（只需 title + artist）
- `scripts/fetch-song-urls.mts`：已有网易云 API 调用模式（`createRequire` 加载 CJS 包，cookie 从环境变量读）
- `api/vision.ts` + `vite.config.ts` 第 22-85 行 `visionApiDevPlugin`：Serverless Function + dev middleware 模板
- `src/app/components/PlatformQRModal.tsx` 第 21-22 行注释：「正式版接入只需把 mock 轮询换成真实接口，UI 不变」
- `qrcode` 库已是 dependencies

### 关键缺口
1. 无任何运行时网易云 API 接口（只在构建期脚本调用）
2. `PlatformQRModal` 是 5 秒倒计时 mock，零网络请求
3. `userStore` 不存 cookie，`PlatformAccount` 类型无 cookie 字段
4. `mockApi.getMockLibrary` 第 139-141 行不合并用户导入歌曲
5. `SongPreview` 静态表无 runtime 写入机制，`MusicPlayer` 无法播放导入歌曲
6. `NeteaseCloudMusicApi` 在 devDependencies（需移到 dependencies）

## 实现步骤

### 步骤 1：后端 — 新建网易云 Serverless Functions

参考 `api/vision.ts` 模式，在 `api/netease/` 目录新建 6 个文件。

#### 1.1 `api/netease/_shared.ts`
共享模块：加载 NeteaseCloudMusicApi、统一 CORS header、错误处理。
- 用 `createRequire(import.meta.url)` 加载 CJS 包（参考 `scripts/fetch-song-urls.mts` 第 31-33 行）
- 导出 `callNetease(fn, params)` 包装函数：统一传 cookie、try-catch、返回 JSON
- 导出 `setCors(res)` 设置 `Access-Control-Allow-Origin: *` 等 header
- 导出 `handleRequest(handler)` 高阶函数：处理 OPTIONS、CORS、错误兜底

#### 1.2 `api/netease/qr-create.ts`
- 调 `login_qr_key` 拿 `unikey`
- 调 `login_qr_create` 拿 `qrcode` 图片 URL（或用 `qrcode` 库在前端生成，这里只返回 unikey + qrurl）
- 返回 `{ unikey, qrurl }`

#### 1.3 `api/netease/qr-check.ts`
- 入参：`unikey`
- 调 `login_qr_check`，返回 code（800 过期 / 801 等待 / 802 待确认 / 0 成功）
- code=0 时返回 `{ code: 0, cookie, nickname, uid }`（从 `login_status` 拿 nickname/uid）
- 其他 code 返回 `{ code, message }`

#### 1.4 `api/netease/likelist.ts`
- 入参：`cookie`
- 调 `likelist` 接口拿用户红心歌曲 ID 列表（返回 `ids: number[]`）
- 如果红心列表为空，返回 `{ songs: [], message: '红心歌单为空' }`
- 红心 ID 数量可能很多（几百上千），**只取前 100 首**避免风控和性能问题

#### 1.5 `api/netease/song-detail-batch.ts`
- 入参：`ids`（逗号分隔的 neteaseId，单次最多 50 个）
- 调 `song_detail`，返回 `[{ neteaseId, title, artist, coverUrl }]`
- 前端分批调用（100 首分 2 批）

#### 1.6 `api/netease/song-url.ts`
- 入参：`id`（单个 neteaseId）
- 调 `song_url_v1({ id, level: 'standard', cookie })`，失败回退 `song_url({ id, br: 320000, cookie })`
- 返回 `{ url, isTrial }`（参考 `fetch-song-urls.mts` 第 207-243 行的级联逻辑）
- URL 有时效，前端缓存 + 过期重取

### 步骤 2：Vite dev 配置 — 新增 netease API 中间件

#### 2.1 改造 `vite.config.ts`
- 在 `visionApiDevPlugin` 旁边新增 `neteaseApiDevPlugin`（或合并为一个通用 `apiDevPlugin`）
- 把 `/api/netease/*` 路径转发到对应 `api/netease/*.ts` 模块
- 复用 `server.ssrLoadModule` 加载 TS 模块的模式
- 路由匹配：`/api/netease/qr-create` → `api/netease/qr-create.ts`，依此类推

### 步骤 3：前端服务层 — 新建 neteaseApi.ts

#### 3.1 新建 `src/app/services/neteaseApi.ts`
封装所有 `/api/netease/*` fetch 调用，返回类型化结果：
- `createQrLogin(): Promise<{ unikey, qrurl }>`
- `checkQrStatus(unikey): Promise<{ code, cookie?, nickname?, uid? }>`
- `fetchLikelist(cookie): Promise<number[]>`
- `fetchSongDetails(ids, cookie): Promise<ImportedSongEntry[]>` — 分批调 song-detail-batch
- `fetchSongUrl(id, cookie): Promise<{ url, isTrial }>`

### 步骤 4：状态层改造 — 扩展 userStore 和类型

#### 4.1 改造 `src/app/types.ts` 第 49-62 行 `PlatformAccount`
新增字段：
- `cookie?: string` — 网易云 MUSIC_U cookie
- `neteaseUid?: number` — 网易云用户 ID

#### 4.2 改造 `src/app/stores/userStore.ts`
- 第 35 行 `loginPlatform` 签名改为 `(id, nickname?, cookie?, neteaseUid?)`
- 第 54-59 行实现存储 cookie/neteaseUid 到 platform 对象
- 新增状态字段 `importedSongs: Song[]`（初始空数组）
- 新增 action `setImportedSongs(songs: Song[])`
- 新增 action `clearImportedSongs()`（登出时调用）
- `partialize` 确认持久化 `platforms`（含 cookie）和 `importedSongs`
- `logoutPlatform` 增加：清除 cookie、清除 importedSongs

### 步骤 5：前端组件改造 — PlatformQRModal 真实扫码

#### 5.1 改造 `src/app/components/PlatformQRModal.tsx`
- **Stage 类型扩展**：`'pending' | 'scanned' | 'success' | 'expired' | 'importing'`
  - `pending`：等待扫码（801）
  - `scanned`：已扫码待确认（802）
  - `success`：登录成功，开始导入
  - `expired`：二维码过期（800），可点击重新生成
  - `importing`：正在拉取红心歌单
- **第 32-42 行 useEffect 改造**：调用 `neteaseApi.createQrLogin()` 拿真实 QR URL 和 unikey，用 `qrcode.toDataURL` 生成图片
- **第 44-61 行 useEffect 改造**：5 秒倒计时改为 2.5 秒间隔轮询 `neteaseApi.checkQrStatus(unikey)`
  - 801 → 保持 pending
  - 802 → setStage('scanned')
  - 800 → setStage('expired')
  - 0 → 拿到 cookie，调用 `loginPlatform`，然后触发红心歌单导入流程，setStage('importing')
- **第 130-137 行**：移除「模拟扫码成功」按钮（或改为「重新生成二维码」按钮，expired 状态显示）
- **新增导入流程**：登录成功后调 `neteaseApi.fetchLikelist(cookie)` → 取前 100 首 ID → 分批 `fetchSongDetails` → 调 `importUserPlaylist` 转 Song[] → `setImportedSongs` → setStage('success') → 1.5 秒后 onClose()
- **UI 文案**：importing 状态显示「正在导入红心歌单...」+ 进度（已导入 X/100 首）

### 步骤 6：音乐库集成 — 合并用户导入歌曲

#### 6.1 改造 `src/app/services/mockApi.ts` 第 139-141 行 `getMockLibrary`
```ts
// 改造前
export function getMockLibrary(): Song[] {
  return HOT_CHART_2026;
}
// 改造后
export function getMockLibrary(): Song[] {
  const userSongs = useUserStore.getState().importedSongs ?? [];
  return mergeUserImports(HOT_CHART_2026, userSongs);
}
```

### 步骤 7：运行时播放地址管理

#### 7.1 新建 `src/app/services/runtimePreviews.ts`
- `RUNTIME_PREVIEWS: Map<string, SongPreview>`（内存 Map，不持久化）
- `getRuntimePreview(songId): SongPreview | undefined`
- `setRuntimePreview(songId, preview)`
- `getPreview(songId): SongPreview | undefined` — 合并查 SONG_PREVIEW_URLS 和 RUNTIME_PREVIEWS
- `ensurePreview(songId, neteaseId, cookie): Promise<SongPreview>` — 按需获取并缓存

#### 7.2 改造 `src/app/components/MusicPlayer.tsx` 第 127 行
```ts
// 改造前
const preview = currentTrack ? SONG_PREVIEW_URLS[currentTrack.songId] : undefined;
// 改造后
const preview = currentTrack ? getPreview(currentTrack.songId) : undefined;
```
- 切歌时如果 preview 不存在或 URL 过期，调 `ensurePreview` 异步获取
- 获取期间显示 loading 状态

#### 7.3 改造 `src/app/components/SongWheel.tsx` 第 139-143 行
封面也改用 `getPreview` 合并查询。

### 步骤 8：依赖调整

#### 8.1 改造 `package.json`
- 第 51 行 `NeteaseCloudMusicApi` 从 devDependencies 移到 dependencies
- 运行 `npm install` 更新 lock 文件

## 关键约束与风险

### 8.1 Vercel Serverless 兼容性（最高风险）
NeteaseCloudMusicApi 是 CJS 包，依赖较重（crypto/axios）。Vercel Hobby 计划函数有 50MB 限制。
**缓解**：先做一个 `api/netease/qr-create.ts` 原型，部署到 Vercel 验证打包是否成功。如果超限，改用裸 `fetch` 直接调网易云 HTTP 接口（手动实现 weapi 加密）。

### 8.2 网易云风控
红心列表可能几百上千首。批量调 `song_detail`（每批 50 个）+ 后续 `song_url` 调用，需控制频率。
**缓解**：红心只取前 100 首；song_detail 分批间隔 500ms；song_url 播放时按需取，不批量。

### 8.3 播放地址时效
`song_url_v1` 返回的 URL 通常几小时过期。
**缓解**：runtimePreviews 存获取时间戳，超过 2 小时自动重取。

### 8.4 V-A 标注质量
`keywordEstimateVA` 启发式估算 confidence 只有 0.5，导入歌曲推荐质量低于热歌库。
**缓解**：复赛阶段可接受；后续可接入网易云歌曲分类标签辅助标注。

### 8.5 Song 类型无 neteaseId
`importUserPlaylist` 生成的 songId 是 `user_${title}_${artist}_${idx}`，与 neteaseId 无关。播放时需要 neteaseId 取 URL。
**缓解**：`runtimePreviews` 存 songId → neteaseId 映射；`importedSongs` 里每个 Song 对象额外挂载 neteaseId（扩展类型或用 Map 旁路存储）。

## 验证步骤

1. **本地 dev 验证 QR 登录**：`npm run dev` → 打开 /settings → 点网易云 → 用手机网易云 App 扫码 → 确认登录 → 检查 userStore 里 cookie 已写入
2. **验证红心导入**：登录成功后观察控制台，确认 likelist 返回 → song_detail 批量返回 → importUserPlaylist 执行 → importedSongs 写入
3. **验证音乐库合并**：拍照 → 看推荐结果里是否出现导入的歌曲（mergeUserImports 生效）
4. **验证播放**：点击导入歌曲 → 确认调 /api/netease/song-url 拿到地址 → 播放成功
5. **验证刷新恢复**：刷新页面 → 确认登录态保持（cookie 持久化）→ 导入歌曲仍在库中
6. **验证登出**：点断开 → 确认 cookie 清除、importedSongs 清空、库回到纯 HOT_CHART_2026
7. **验证 Vercel 部署**：push 到 main → Vercel 自动部署 → 线上扫码登录可用（重点验证 Serverless Function 打包无报错）
8. **typecheck + test**：`npm run typecheck` 和 `npm test` 全部通过（src/algorithm/ 不改，测试应不受影响）

## 文件清单

### 新增文件（10 个）
- `api/netease/_shared.ts`
- `api/netease/qr-create.ts`
- `api/netease/qr-check.ts`
- `api/netease/likelist.ts`
- `api/netease/song-detail-batch.ts`
- `api/netease/song-url.ts`
- `src/app/services/neteaseApi.ts`
- `src/app/services/runtimePreviews.ts`

### 修改文件（7 个）
- `vite.config.ts` — 新增 netease dev middleware
- `package.json` — NeteaseCloudMusicApi 移到 dependencies
- `src/app/types.ts` — PlatformAccount 增加 cookie / neteaseUid
- `src/app/stores/userStore.ts` — 扩展 loginPlatform、新增 importedSongs
- `src/app/components/PlatformQRModal.tsx` — mock 换真实扫码 + 自动导入
- `src/app/services/mockApi.ts` — getMockLibrary 合并 importedSongs
- `src/app/components/MusicPlayer.tsx` — 用 getPreview 替代直接查 SONG_PREVIEW_URLS
- `src/app/components/SongWheel.tsx` — 封面查询改用 getPreview
