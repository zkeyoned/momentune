# 修复运行时封面/播放 + 接通推荐偏好中心 Spec

## Why

上一轮 spec（`import-cover-playback-recommend`）完成了代码层面改动，但用户实测反馈：
- **导入歌封面仍不显示**（渐变色+首字母）
- **导入歌音乐仍放不了**（静默降级 simulated）
- **推荐结果与红心歌无关**（用户疑问"拍照推荐怎么基于红心歌对比"）

经对比调研（Mineradio 9181 stars / serenade / NeteaseCloudMusicApi）+ 本地代码诊断，发现 3 类根因：

1. **封面链路有 2 个断点**：
   - `MusicPlayer.tsx:155` 只从 `preview.coverUrl` 取封面，**缺 `getCoverUrl(songId)` 兜底**（SongWheel 有这层兜底，播放器没有）
   - `song-detail-batch.ts:52` 返回的 `picUrl` 是 `http://` 协议，https 站点混合内容策略阻止加载，触发 `onError` 回退渐变色

2. **播放链路有 2 个断点**：
   - `song-url.ts` 调 `song_url_v1`，VIP/版权歌曲即便有 cookie 也返回空 `url`（普通账号无 VIP 权限），`MusicPlayer.tsx:177-186` 对空 url 静默降级 simulated，无任何提示
   - 生产环境 `/api/audio-proxy` **只在 `vite.config.ts` 里有，Vercel 上无对应 serverless function**，导致部署后 `<audio>` 跨域播放必失败（ORB 策略）

3. **推荐逻辑链路接通但偏好中心未重建**：
   - `mockApi.analyzePhoto` 已传 `referenceSongs` 给 `recommend()` ✓
   - `recommend()` 已把 `referenceSongs` 放入 `MatchContext` ✓
   - `calcMatchScore` 已调 `calcScoreRefSim`（权重 0.05）✓
   - **但 `recommend()` 从未调用 `calcReferenceCenter`**，红心歌不影响 `pref.center`，导致偏好中心只由 onboarding mood anchor 决定，红心歌对推荐几乎无影响
   - `calcReferenceCenter` 只在 `initUserPreference` 中被调用，而 `createDefaultUserPref()` 传的是空数组

## What Changes

### 1. 封面修复（2 处）

#### 1.1 MusicPlayer 补 coverUrl 兜底
- `MusicPlayer.tsx:155` 当前：`const coverUrl = preview?.coverUrl;`
- 改为：`const coverUrl = preview?.coverUrl ?? getCoverUrl(currentTrack.songId);`
- 与 `SongWheel.tsx:141` 保持一致的双重 fallback

#### 1.2 picUrl 强制 https
- `api/netease/song-detail-batch.ts:52` 当前：`album.picUrl ? \`${album.picUrl}?param=200y200\` : undefined`
- 改为：强制把 `http://` 替换为 `https://` 再拼接尺寸参数
- 网易云 CDN 支持 https，避免混合内容阻止

### 2. 播放修复（2 处）

#### 2.1 VIP 歌曲明确提示
- `MusicPlayer.tsx:177-186` 当前：空 url 时静默保持 simulated
- 改为：空 url 时设置 `tier: 'unavailable'`（新状态）或显示"VIP 歌曲无法播放·已切换模拟"提示
- 不再静默降级，让用户知道为什么没声音

#### 2.2 生产环境音频代理 serverless
- 新增 `api/audio-proxy.ts` Vercel serverless function
- 流式转发网易云 CDN 音频，设置 `Content-Type: audio/mpeg` + `Referer: music.163.com`
- 与 dev 环境 `vite.config.ts` 的 `/api/audio-proxy` 行为一致
- 参考 serenade 的流式代理思路（受 Vercel 4.5MB response 限制，做流式 pipe 而非下载缓存）

### 3. 推荐偏好中心接通（核心）

#### 3.1 analyzePhoto 重建偏好中心
- `src/app/services/mockApi.ts` 的 `analyzePhoto` 中，拿到 `importedSongs` 后：
  - 若 `importedSongs` 非空，调用 `calcReferenceCenter(importedSongs)` 计算 V-A 质心
  - 用质心融合/覆盖 `pref.center`（保留 onboarding mood anchor 作为基础，红心歌质心作为调整）
  - 融合策略：`pref.center = onboardingCenter × 0.4 + redHeartCenter × 0.6`（红心歌权重更高，因为是最真实的偏好信号）
- 这样 `calcScorePref` 中的 `vaProximity`（占 score_pref 的 0.25 子项）会真正受红心歌影响

#### 3.2 确认 calcReferenceCenter 导出
- 检查 `src/algorithm/preference.ts` 是否 export `calcReferenceCenter`
- 若未 export，补充 export（不改算法逻辑，只改导出）
- 检查 `src/algorithm/index.ts` 是否 re-export

### 4. 不改的部分（用户明确要求）

- **算法数据不动**：`HOT_CHART_2026`、`GENRE_TAGS`、`EMOTION_VA_COORDINATES` 等数据用户会自行更改
- **算法评分权重不动**：`MATCH_WEIGHTS`、`score_va/scene/pref/scene_fit/ref_sim/hot` 权重不变
- **match.ts 评分函数不动**：`calcMatchScore`、`calcScoreRefSim`、`calcScorePref` 逻辑不变
- **只接通链路**：让已有的 `calcReferenceCenter` 真正被调用，让 `picUrl` 真正能显示，让 `audio-proxy` 在生产可用

## Impact

- **Affected code**:
  - `src/app/components/MusicPlayer.tsx` — 补 coverUrl 兜底 + VIP 提示
  - `api/netease/song-detail-batch.ts` — picUrl 强制 https
  - `api/audio-proxy.ts` — 新增 Vercel serverless 流式代理
  - `src/app/services/mockApi.ts` — analyzePhoto 重建 pref.center
  - `src/algorithm/preference.ts` — 确认 calcReferenceCenter export（若缺则补）
  - `src/algorithm/index.ts` — 确认 re-export（若缺则补）
- **NOT affected**:
  - `src/algorithm/match.ts` 评分函数（不改）
  - `src/algorithm/recommend.ts` 推荐主流程（不改）
  - `src/algorithm/musicLibrary.ts` 数据层（不改）
  - `src/algorithm/config/*` 配置数据（不改）
- **用户数据**: 用户表示算法数据会自行更改，本 spec 仅接通链路，不动数据

## ADDED Requirements

### Requirement: MusicPlayer 封面兜底
系统 SHALL 在 MusicPlayer 中为导入歌提供与 SongWheel 一致的封面兜底链路。

#### Scenario: 导入歌在播放器中显示封面
- **WHEN** 用户点击导入歌进入播放器
- **AND** `preview.coverUrl` 为空（ensurePreview 未成功）
- **AND** `userStore.coverUrlMap[songId]` 有值
- **THEN** MusicPlayer 通过 `getCoverUrl(songId)` 兜底获取封面
- **AND** 显示真实专辑封面而非渐变色

### Requirement: 封面 URL 强制 https
系统 SHALL 把网易云返回的 `picUrl` 强制转为 https 协议，避免混合内容阻止。

#### Scenario: picUrl 是 http 协议
- **WHEN** `song-detail-batch` API 收到 `album.picUrl = "http://p1.music.126.net/..."`
- **THEN** 返回 `coverUrl = "https://p1.music.126.net/...?param=200y200"`
- **AND** 前端 `<img>` 标签在 https 站点正常加载

### Requirement: VIP 歌曲播放失败明确提示
系统 SHALL 在音频 URL 为空时明确提示用户，而非静默降级。

#### Scenario: VIP 歌曲无法获取播放地址
- **WHEN** `song_url_v1` 返回空 `url`
- **THEN** MusicPlayer 显示"VIP 歌曲无法播放·已切换模拟"提示
- **AND** 保持 simulated 模拟播放（不中断体验）
- **AND** 用户明确知道为什么没真实声音

### Requirement: 生产环境音频代理
系统 SHALL 在生产环境（Vercel）提供 `/api/audio-proxy` 流式代理，避免 `<audio>` 跨域失败。

#### Scenario: 生产环境播放网易云音频
- **WHEN** 部署到 Vercel
- **AND** 用户点击歌曲播放
- **THEN** 音频请求走 `https://<vercel-domain>/api/audio-proxy?url=<netease-url>`
- **AND** serverless 流式转发网易云 CDN 音频
- **AND** 设置 `Content-Type: audio/mpeg` + 防盗链 Referer
- **AND** `<audio>` 标签成功播放

### Requirement: 红心歌重建偏好中心
系统 SHALL 在拍照推荐时，用用户导入的红心歌重建偏好中心，使红心歌真正影响推荐结果。

#### Scenario: 有红心歌时重建偏好中心
- **WHEN** 用户已导入红心歌（importedSongs 非空）
- **AND** 用户拍照触发推荐
- **THEN** 系统调用 `calcReferenceCenter(importedSongs)` 计算红心歌 V-A 质心
- **AND** 融合到 `pref.center`（onboardingCenter × 0.4 + redHeartCenter × 0.6）
- **AND** 用融合后的 `pref.center` 传入 `recommend()`
- **AND** `calcScorePref` 中的 `vaProximity` 真正受红心歌影响
- **AND** 推荐结果偏向"与红心歌情绪/风格相似的新歌"

#### Scenario: 无红心歌时保持原行为
- **WHEN** 用户未导入红心歌
- **THEN** `pref.center` 保持 onboarding mood anchor（现有行为）
- **AND** 推荐结果不受影响

## MODIFIED Requirements

### Requirement: analyzePhoto 推荐流程
`analyzePhoto` 在调用 `recommend()` 前，若 `importedSongs` 非空，先用 `calcReferenceCenter` 重建 `pref.center`。

**Reason**: 现有实现只传 `referenceSongs` 给 `recommend()`，但 `recommend()` 不调 `calcReferenceCenter`，导致红心歌不影响偏好中心，推荐结果与红心歌无关。

**Migration**: 在 `analyzePhoto` 中 `recommend()` 调用前插入偏好中心重建逻辑。保留 `referenceSongs` 传参（仍影响 `calcScoreRefSim`）。

## REMOVED Requirements

无（本 spec 不移除任何需求，只修复和接通）。
