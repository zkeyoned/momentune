# 多维度导入与偏好画像重构 — 剩余执行 Plan

## 背景问答（用户当前疑问）

### Q1: 导入的是不是只有红心？
**否。** 当前 [PlatformQRModal.tsx](file:///Users/kongke/Desktop/momentune/src/app/components/PlatformQRModal.tsx#L166-L240) `startImportFlow` 已是三阶段导入：
- `liked` 红心歌单（fetchLikelist，上限 100）
- `playlist` 自建歌单（fetchUserPlaylists，上限 200）
- `recent` 最近听过（fetchRecentSongs，上限 100）

三来源分别存入 [userStore.ts](file:///Users/kongke/Desktop/momentune/src/app/stores/userStore.ts#L58) `importedSongsBySource`，并通过 [preference.ts](file:///Users/kongke/Desktop/momentune/src/algorithm/preference.ts#L595-L612) `applyMultiSourcePreference` 加权计算偏好中心（红心 1.0 / 歌单 0.7 / 最近听过 0.5）。

### Q2: Mineradio（XxHuberrr/Mineradio）为什么能搜全曲库？
Mineradio 是 **Windows Electron 桌面播放器**，定位是"播放 + 视觉化"。它能搜全曲库是因为直接调用网易云/QQ的 **search 接口**——搜索是播放器的基础功能。Momentune 是**推荐系统**，导入用户数据是为了建偏好画像，目的不同，不应对标其"全曲库搜索"能力。

## 已完成项（无需再做）

| 项 | 文件 | 状态 |
|---|---|---|
| 三维度后端端点 | `api/netease/user-playlists.ts`、`recent-songs.ts` | ✅ |
| 前端 service 封装 | `neteaseApi.ts` `fetchUserPlaylists`/`fetchRecentSongs` | ✅ |
| userStore 按来源存储 | `importedSongsBySource` + `setImportedSongsBySource` | ✅ |
| PlatformQRModal 三阶段导入 | `startImportFlow` 串行三阶段 + 容错 | ✅ |
| 多维度画像计算 | `calcMultiSourcePreferenceCenter`/`calcMultiSourceGenreWeights`/`calcMultiSourceLanguageWeights`/`applyMultiSourcePreference` | ✅ |
| 导入后更新偏好 | PlatformQRModal 调 `applyMultiSourcePreference` 写回 `userStore.userPref` | ✅ |
| scorePref 权重提升 | [thresholds.ts:101](file:///Users/kongke/Desktop/momentune/src/algorithm/config/thresholds.ts#L101) `scorePref: 0.35`（冷启动 0.22）| ✅ 超额（原定 0.25） |
| 类型定义 | `ImportedSongSource`/`ImportedSongsBySource` | ✅ |

## 剩余工作

### Task 1: 修正 mockApi.ts — 移除红心质心覆盖逻辑（核心 bug）

**问题**：[mockApi.ts:207-224](file:///Users/kongke/Desktop/momentune/src/app/services/mockApi.ts#L207-L224) 的 `analyzePhoto` 仍在用旧逻辑：
```typescript
const referenceSongs = userStore.importedSongs.slice(0, 20);  // 前20首≈红心
const redHeartCenter = calcReferenceCenter(referenceSongs);
effectivePref = { ...pref, center: pref.center*0.4 + redHeartCenter*0.6 };
```
这会**覆盖** PlatformQRModal 已经通过 `applyMultiSourcePreference` 算好的三维度偏好中心，导致推荐时画像退化为"红心单维度"。

**修正**：
- 移除 `calcReferenceCenter` + 0.4/0.6 融合逻辑
- `effectivePref` 直接用传入的 `userPref`（已是多维度更新后的）
- `referenceSongs` 保留（仍用于 `score_ref_sim` 相似度计算），但改为从 `importedSongsBySource.liked` 取前 20 首（语义更清晰）
- 移除未再使用的 `calcReferenceCenter` import（若 mockApi 中已无引用）

**影响范围**：仅 `src/app/services/mockApi.ts`，不动 `src/algorithm/`

### Task 2: 验证
- `npm run typecheck` 通过
- `npm test` 通过（不修改 `src/algorithm/__tests__`）

## 可选后续（视验证结果决定）

若修正后推荐结果仍"偏老/缺氛围感/缺微忧郁"，再考虑：
- **音乐库补强**：在 `data/unified_library.json` 中补 2024-2026 微忧郁/氛围感歌曲（emo/ambient/R&B/indie pop），扩充候选池
- **新歌加权**：在 match.ts `calcHotBoostByRecency` 里提高 `this_week`/`this_month` 的 boost，降低 `older` 权重

这属于数据层调优，不在本次 plan 范围内，待 Task 1-2 完成后根据实际推荐效果决定是否启动。

## 风险

- **低风险**：Task 1 只改 mockApi.ts 一个文件，算法层零改动，既有测试不受影响
- **回退方案**：若修正后推荐效果变差，可恢复 0.4/0.6 融合（但需同步关闭 PlatformQRModal 的 applyMultiSourcePreference 调用，避免双重处理）
