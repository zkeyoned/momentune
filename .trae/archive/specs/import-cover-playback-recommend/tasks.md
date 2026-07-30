# Tasks

- [x] Task 1: 导入歌封面获取链路打通
  - [x] 1.1: 检查 `api/netease/song-detail-batch.ts` 是否返回 `picUrl` 字段，若无则补充
  - [x] 1.2: 修改 `src/app/services/neteaseApi.ts` 的 `fetchSongDetails`，提取 `picUrl` 并存入 `neteaseIdMap` 或返回值
  - [x] 1.3: 修改 `src/app/services/runtimePreviews.ts` 的 `ensurePreview`，在获取播放 URL 时同时获取封面 URL，填充 `SongPreview.coverUrl`
  - [x] 1.4: 验证 `SongWheel.tsx` 能正确渲染导入歌封面（无需改 UI，确认数据流通即可）

- [x] Task 2: 推荐逻辑接通 referenceSongs
  - [x] 2.1: 修改 `src/app/services/mockApi.ts` 的 `analyzePhoto`，取 `importedSongs` 前 20 首作为 `referenceSongs` 传入 `recommend()`
  - [x] 2.2: 修改 `src/app/stores/onboardingStore.ts`，onboarding 完成时若已有红心歌也传入 `referenceSongs`
  - [x] 2.3: 移除 `src/algorithm/match.ts:362-366` 的 `user_` 1.25x 加成
  - [x] 2.4: 移除 `src/algorithm/match.ts:455-466` 的 `user_` 候选池距离豁免
  - [x] 2.5: 保留 `src/algorithm/musicLibrary.ts` 的 `hotRecency='this_month'` 和 `confidence=0.75` 数据质量修正（不动）
  - [x] 2.6: 保留 `src/app/services/mockApi.ts` 的 `getMockLibrary` 数据迁移逻辑（不动）

- [ ] Task 3: 验证
  - [ ] 3.1: 运行 `npm run typecheck` 确保类型安全
  - [ ] 3.2: 运行 `npm test` 确保现有 609 个测试全通过
  - [ ] 3.3: 写模拟验证脚本，确认接通 `referenceSongs` 后推荐结果包含"与红心歌相似的新歌"而非"全是红心歌"

# Task Dependencies
- Task 2 依赖 Task 1 完成（封面获取链路打通后再改推荐逻辑，避免交叉调试）
- Task 3 依赖 Task 1 + Task 2 完成
