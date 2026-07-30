# Tasks

- [x] Task 1: 修复封面显示链路
  - [x] 1.1: 修改 `api/netease/song-detail-batch.ts:52`，把 `album.picUrl` 强制 `http://` → `https://` 再拼接 `?param=200y200`
  - [x] 1.2: 修改 `src/app/components/MusicPlayer.tsx:155`，封面取值改为 `preview?.coverUrl ?? getCoverUrl(currentTrack.songId)`（与 SongWheel 一致）
  - [x] 1.3: 确认 `getCoverUrl` 已从 `runtimePreviews.ts` 导入到 MusicPlayer（已补充 import）

- [x] Task 2: 修复播放降级提示
  - [x] 2.1: 修改 `src/app/components/MusicPlayer.tsx:177-186`，当 `ensurePreview` 返回的 `p.url` 为空时，显示"VIP 歌曲无法播放·已切换模拟"提示（而非静默降级）
  - [x] 2.2: 保持 simulated 播放不中断，仅增加用户可见的提示信息

- [x] Task 3: 新增生产环境音频代理 serverless
  - [x] 3.1: 新建 `api/audio-proxy.ts` Vercel serverless function
  - [x] 3.2: 实现：接收 `url` query 参数，fetch 网易云 CDN 音频，流式 pipe 到 response
  - [x] 3.3: 设置 `Content-Type: audio/mpeg`、`Referer: music.163.com`、`User-Agent`、CORS 头
  - [x] 3.4: 处理错误：上游失败时返回 502 + 明确错误信息
  - [x] 3.5: 确认 `vite.config.ts` 的 dev 代理与生产 serverless 行为一致（dev 走 vite proxy，prod 走 serverless）

- [x] Task 4: 接通推荐偏好中心（核心）
  - [x] 4.1: 检查 `src/algorithm/preference.ts` 是否 export `calcReferenceCenter`（已是 export，无需改）
  - [x] 4.2: 检查 `src/algorithm/index.ts` 是否 re-export `calcReferenceCenter`（已通过 `export *` re-export，无需改）
  - [x] 4.3: 修改 `src/app/services/mockApi.ts` 的 `analyzePhoto`：红心歌非空时调 `calcReferenceCenter` 重建 `pref.center`（onboarding×0.4 + redHeart×0.6）
  - [x] 4.4: 确认 `referenceSongs` 仍照旧传入 `recommend()`（保持 `calcScoreRefSim` 0.05 权重影响）

- [x] Task 5: 验证
  - [x] 5.1: 运行 `npm run typecheck` 确保类型安全（通过，exit 0）
  - [x] 5.2: 运行 `npm test` 确保现有测试全通过（609 tests passed）
  - [x] 5.3: 写模拟验证脚本（`src/app/__tests__/recommend-center.test.ts`，5 tests passed，核心断言：融合后推荐结果 V-A 质心更接近红心歌质心）
  - [ ] 5.4: 手动验证（用户侧）：扫码导入红心歌 → 拍照 → 确认封面显示、播放提示、推荐结果与红心歌相关（需用户实测）

# Task Dependencies
- Task 1 / 2 / 3 相互独立，可并行
- Task 4 独立（只涉及算法导出和 mockApi）
- Task 5 依赖 Task 1-4 全部完成
