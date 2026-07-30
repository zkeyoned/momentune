# 导入歌封面/播放/推荐逻辑重构 Spec

## Why

用户扫码导入网易云红心歌单后，存在三个问题：
1. **导入歌无封面** — 热歌库 75 首有本地封面，但导入歌（`user_` 前缀）封面恒为 `undefined`，回退到渐变色+首字母，与参考项目 Mineradio（有 `picUrl` + 代理）差距明显
2. **导入歌播放不稳定** — 导入歌走远程 URL（`ensurePreview` → `song-url` API），URL 易过期/失败，且 `ensurePreview` 返回的 `SongPreview` 不含 `coverUrl` 字段
3. **推荐逻辑未接通** — 算法原本设计了"用红心歌建立偏好中心 → 推荐相似新歌"的机制（`referenceSongs` + `calcReferenceCenter` + `calcScoreRefSim`），但 app 层 `mockApi.ts:210` 传的是空数组 `[]`，导致：
   - `calcScoreRefSim`（权重 0.05）恒返回 0.5，对推荐结果无影响
   - `calcReferenceCenter` 返回 null，用户偏好中心只由问卷情绪锚点决定，与红心歌无关
   - 当前实现用"距离豁免 + 1.25x 加成"补偿，但这会让红心歌直接占满推荐位，违背"发现新歌"的产品定位

用户原话："扫完二维码放的都是咱自己喜欢的歌，那拍照推荐时怎么对比？"——答案正是要接通 `referenceSongs` 机制。

## What Changes

### 1. 导入歌封面获取
- `song-detail-batch.ts` API 已返回 `picUrl`，但前端 `neteaseApi.fetchSongDetails` 没有提取该字段
- `ensurePreview` 返回的 `SongPreview` 要补充 `coverUrl` 字段（从 `song-detail-batch` 获取或运行时单独请求）
- `SongWheel.tsx` 已支持 `coverUrl` 渲染，无需改 UI 逻辑

### 2. 导入歌播放保障
- `ensurePreview` 当前只获取 `url` + `isTrial`，要同时获取 `coverUrl`
- 播放降级链路已完整（local → demo → remote → simulated），无需大改
- 重点：确保 `neteaseIdMap` 和 `cookie` 正确传递到 `ensurePreview`

### 3. 推荐逻辑接通 referenceSongs
- **`mockApi.ts:analyzePhoto`**：把用户导入的红心歌作为 `referenceSongs` 传入 `recommend()`（取前 20 首避免过多影响性能）
- **`onboardingStore.ts`**：onboarding 完成时，若用户已导入红心歌，也传入 `referenceSongs`
- **移除补偿性 hack**：
  - 移除 `match.ts:362-366` 的 `user_` 1.25x 加成
  - 移除 `match.ts:455-466` 的 `user_` 距离豁免（或改为宽松阈值而非完全豁免）
- **保留**：`musicLibrary.ts` 的 `hotRecency='this_month'` 和 `confidence=0.75`（这些是数据质量修正，不是推荐偏向）

### 4. 推荐策略平衡
- 导入歌仍可进入候选池（不排除），但不再有特权
- 通过 `referenceSongs` 影响 `calcScoreRefSim`（0.05 权重）和 `calcReferenceCenter`（影响 `scorePref` 0.35 权重中的 `vaProximity` 子项）
- 效果：推荐结果应是"与用户红心歌风格/情绪相似的新歌"，而非"用户自己的红心歌"
- 若用户想听自己的红心歌，可通过 MusicPlayer 的"我的红心"入口（未来功能）

## Impact

- **Affected code**:
  - `src/app/services/mockApi.ts` — analyzePhoto 传入 referenceSongs
  - `src/app/services/runtimePreviews.ts` — ensurePreview 补充 coverUrl
  - `src/app/services/neteaseApi.ts` — fetchSongDetails 提取 picUrl
  - `src/algorithm/match.ts` — 移除 user_ 加成和距离豁免
  - `src/app/stores/onboardingStore.ts` — onboarding 传入 referenceSongs
  - `api/netease/song-detail-batch.ts` — 确认 picUrl 字段返回
- **NOT affected**: `src/algorithm/` 核心算法逻辑（preference.ts、recommend.ts、match.ts 的评分函数本身不改，只改 app 层传参和移除 hack）
- **用户数据**: 用户表示算法数据（HOT_CHART_2026 等）会自行更改，本 spec 不涉及数据层

## ADDED Requirements

### Requirement: 导入歌封面显示
系统 SHALL 在用户导入红心歌单后，为每首导入歌获取并显示网易云专辑封面。

#### Scenario: 导入歌有 picUrl
- **WHEN** 用户扫码导入红心歌单
- **THEN** 系统从 `song-detail-batch` API 获取每首歌的 `picUrl`
- **AND** 存入 `runtimePreviews` 缓存的 `SongPreview.coverUrl`
- **AND** SongWheel 渲染封面图片

#### Scenario: picUrl 获取失败
- **WHEN** 封面 URL 获取失败或为空
- **THEN** 回退到 V-A 渐变色 + 首字母（现有逻辑）

### Requirement: 导入歌播放保障
系统 SHALL 确保导入歌在用户已登录状态下能播放真实音频。

#### Scenario: 正常播放
- **WHEN** 用户点击导入歌
- **AND** 用户已登录网易云（有 cookie）
- **AND** `neteaseIdMap` 有该歌的映射
- **THEN** 系统调用 `ensurePreview` 获取播放 URL
- **AND** 先用 simulated 播放，获取成功后切换到 remote

#### Scenario: 播放失败
- **WHEN** URL 获取失败或过期
- **THEN** 保持 simulated 模拟播放（不中断用户体验）

### Requirement: 红心歌作为推荐偏好信号
系统 SHALL 将用户导入的红心歌作为 `referenceSongs` 传入推荐算法，影响偏好中心和相似度计算。

#### Scenario: 有红心歌时推荐
- **WHEN** 用户已导入红心歌（importedSongs 非空）
- **AND** 用户拍照触发推荐
- **THEN** 系统取前 20 首红心歌作为 `referenceSongs`
- **AND** 传入 `recommend()` 函数
- **AND** `calcScoreRefSim` 基于红心歌计算候选歌相似度
- **AND** `calcReferenceCenter` 用红心歌 V-A 质心影响偏好中心

#### Scenario: 无红心歌时推荐
- **WHEN** 用户未导入红心歌
- **THEN** `referenceSongs` 为空数组（现有行为）

## MODIFIED Requirements

### Requirement: 导入歌候选池过滤
导入歌不再无条件豁免 V-A 距离过滤，改为与普通歌相同的过滤规则。

**Reason**: 豁免 + 加成会导致红心歌占满推荐位，违背"发现新歌"定位。接通 `referenceSongs` 后，红心歌通过偏好中心间接影响推荐，不需要直接占位。

**Migration**: 移除 `match.ts:455-466` 的 `user_` 豁免逻辑，移除 `match.ts:362-366` 的 1.25x 加成。保留 `musicLibrary.ts` 的 `hotRecency='this_month'` 和 `confidence=0.75` 数据质量修正。

## REMOVED Requirements

### Requirement: user_ 前缀歌的 1.25x 乘性加成
**Reason**: 这是未接通 `referenceSongs` 时的补偿性 hack，现在接通后应移除，避免双重加权。
**Migration**: 删除 `match.ts:362-366` 的 `if (song.songId.startsWith('user_'))` 分支。

### Requirement: user_ 前缀歌的候选池距离豁免
**Reason**: 同上，补偿性 hack。
**Migration**: 删除 `match.ts:455-466` 的 `user_` 豁免，恢复统一距离过滤。
