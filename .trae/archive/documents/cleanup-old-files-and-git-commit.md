# 清理老旧文件 + Git 一次提交 — 执行 Plan

## Summary

用户确认当前工作区堆积了大量老旧文件（备份、日志、误提交二进制、废弃脚本、历史文档）和未提交改动（18 个修改文件 + 大量未跟踪文件）。目标：删除垃圾、归档有参考价值的内容、补全 `.gitignore`、同步修正 `go.work`，最后**一次性 commit** 到 main 分支，并保证项目仍可运行（typecheck + test + go 脚本均正常）。

用户决策（已确认）：
- Git 操作：清理后 commit 一次
- 删除范围：备份/日志/二进制（必删）
- 其余由我决定，原则是"以后要参考检查时别找不到东西" → 有参考价值的**归档**而非删除

## Current State Analysis

### git 状态（`git status --short`）
- **18 个 M（已修改）文件**：含本次会话修复的 `src/app/services/mockApi.ts`、`src/algorithm/preference.ts`、`vitest.config.ts`，以及之前会话遗留的 `musicLibrary.ts`、`types.ts`、`PlatformQRModal.tsx`、`userStore.ts`、`neteaseApi.ts` 等
- **大量未跟踪文件（??）**：`.trae/documents/`、`.trae/specs/`、`api/netease/`、`api/audio-proxy.ts`、`data/`、`scripts/build-music-library/`、`scripts/build-soda-library/`、`vercel.json` 等
- 无 stash，分支 main，远端 gitee/main + github/main
- 最近 commit：`d58e144 chore: 将 result-page-preview-v2.html 加入 .gitignore`

### 老旧文件调研结果（来自 search subagent 报告）

**A. 垃圾（可安全删除，可重建或本就应被忽略）：**
| 文件 | 性质 |
|---|---|
| `data/unified_library.bak.json` | 备份 |
| `data/unified_tags.bak.json` | 备份 |
| `data/soda_songs_old_format.json` | 旧格式中间产物（字段 `soda_id` 已被 `songId` 取代） |
| `data/netease_crawl.log` | 爬虫日志（`.gitignore` 已有 `*.log`） |
| `data/qq_crawl.log` | 爬虫日志 |
| `build-music-library`（根目录） | Go 编译二进制误提交 |
| `scripts/build-music-library/build-music-library` | Go 编译二进制误提交 |
| `dist/`（整个目录） | Vite 构建产物，`npm run build` 可重建，`.gitignore` 已忽略 |
| `scripts/build-soda-library/progress.json` | 废弃脚本进度文件，`.gitignore` 已列出 |
| `scripts/build-music-library/progress_netease.json` | 运行时进度，可重建 |
| `scripts/build-music-library/progress_qq.json` | 运行时进度，可重建 |

**B. 有参考价值（归档，不删除）：**
| 内容 | 归档目标 |
|---|---|
| `scripts/build-soda-library/`（整个目录） | `scripts/archive/build-soda-library/` |
| `.trae/documents/`（4 个 md） | `.trae/archive/documents/` |
| `.trae/specs/`（6 个 spec 目录） | `.trae/archive/specs/` |

**C. 保留原位（数据资产，重跑耗时）：**
- `data/unified_library.json`（算法消费的统一曲库）
- `data/unified_tags.json`
- `data/unified_library_stats.json`（统计产物，可重建但保留）
- `data/netease_songs.json`、`data/qq_songs.json`（爬虫原始产物，重跑需几小时）

### 关键依赖关系
- **`go.work` 第 3 行 `use ./scripts/build-soda-library`**：归档该目录前必须移除这行，否则 `go run ./scripts/build-music-library` 会报 "directory not found"
- **`.gitignore` 第 30 行 `go.work`**：go.work 本身不被 git 跟踪，但需保留在工作区供 go 脚本使用
- **`src/algorithm/` 既有测试不修改**（项目硬约束），本次清理不动算法测试

## Proposed Changes

### 步骤 1：删除垃圾文件（11 项）

用 `DeleteFile` 工具逐个删除（二进制和目录用 `rm -rf` 经 RunCommand）：
- `data/unified_library.bak.json`
- `data/unified_tags.bak.json`
- `data/soda_songs_old_format.json`
- `data/netease_crawl.log`
- `data/qq_crawl.log`
- `build-music-library`（根目录二进制）
- `scripts/build-music-library/build-music-library`（二进制）
- `scripts/build-soda-library/progress.json`
- `scripts/build-music-library/progress_netease.json`
- `scripts/build-music-library/progress_qq.json`
- `dist/`（整个目录，`rm -rf dist`）

### 步骤 2：归档有参考价值的内容

用 `git mv`（保留历史）或 `mv` 移动：
- `scripts/build-soda-library/` → `scripts/archive/build-soda-library/`
- `.trae/documents/` → `.trae/archive/documents/`
- `.trae/specs/` → `.trae/archive/specs/`

**注意**：归档后 `.trae/documents/` 会变空，本 plan 文件需先创建后再归档，或直接写到 `.trae/archive/documents/`。实际执行：先写 plan 到 `.trae/documents/`，归档时把 plan 文件一起移到 `.trae/archive/documents/`（plan 执行完即为历史文档，归档合理）。

### 步骤 3：修正 `go.work`

移除 `use ./scripts/build-soda-library` 行，保留 `use ./scripts/build-music-library`：
```
go 1.26.5

use ./scripts/build-music-library
```
**Why**：build-soda-library 已归档，go.work 不能再引用不存在路径，否则 go 命令失败。

### 步骤 4：补全 `.gitignore`

在末尾追加（防止二进制和进度文件再次混入）：
```
# Go 编译二进制（误提交防护）
/build-music-library
scripts/build-music-library/build-music-library

# 爬虫进度文件（运行时产物）
scripts/build-music-library/progress_*.json

# 备份文件
data/*.bak.json
```
**注意**：`go.work` 已在现有 `.gitignore` 第 30 行被忽略，保持不变。

### 步骤 5：验证项目可运行（保证不出现毛病和 bug）

并行执行三项验证：
1. **前端**：`npm run typecheck` → 必须 exit 0
2. **前端测试**：`npm test -- --reporter=dot` → 必须 exit 0（614 测试全通过）
3. **Go 脚本**：`cd scripts/build-music-library && go build ./...` → 必须 exit 0（确认 go.work 修改后 go 模块仍能编译）

**任一失败则停止，回溯原因，不进入 commit。**

### 步骤 6：Git 一次性 commit

```bash
cd /Users/kongke/Desktop/momentune
git add -A
git status   # 确认暂存内容符合预期
git commit -m "$(cat <<'EOF'
chore: 清理老旧文件 + 归档历史文档 + 提交多维度偏好修复

清理:
- 删除备份 data/*.bak.json、soda_songs_old_format.json
- 删除日志 data/*_crawl.log
- 删除误提交 Go 二进制 build-music-library (根目录+scripts)
- 删除构建产物 dist/ (npm run build 可重建)
- 删除爬虫进度 progress*.json (运行时可重建)

归档(保留参考):
- scripts/build-soda-library → scripts/archive/ (已被 build-music-library 取代)
- .trae/documents → .trae/archive/documents
- .trae/specs → .trae/archive/specs

配置:
- go.work: 移除已归档的 build-soda-library 引用
- .gitignore: 补充二进制/进度/备份防护规则

代码改动(本次会话修复):
- mockApi.ts: 移除红心质心 0.4/0.6 覆盖,改用三维度偏好
- preference.ts: 修复 import type 误把 const 当类型导入的 bug
- vitest.config.ts: 排除被误当测试的 testHelpers.ts

代码改动(之前会话遗留,一并提交):
- 多维度导入(红心+歌单+最近听过)相关: api/netease/, PlatformQRModal, userStore, neteaseApi, types
- 音乐库与标签: musicLibrary, genreTags
- UI: MusicPlayer, SongWheel, onboardingStore, types
- 基础设施: vite.config, package.json, .gitignore, vercel.json
- 测试: extendedLabels/match/preference testHelpers

验证: typecheck ✓ | npm test 614/614 ✓ | go build ✓
EOF
)"
```

**不 push**（用户未要求 push，规则禁止擅自 push）。commit 后告知用户可手动 push 到 gitee/github。

## Assumptions & Decisions

1. **归档优于删除**：用户说"别找不到东西"，故旧脚本和历史文档归档到 `archive/` 子目录而非删除，git 中仍保留历史记录。
2. **爬虫原始数据保留**：`netease_songs.json`/`qq_songs.json` 重跑需几小时，是数据资产，保留原位。
3. **`go.work` 保留工作区但不入库**：`.gitignore` 已忽略 `go.work`，本次只修改其内容（移除 soda 引用），不入库。其他开发者需本地自行创建 `go.work`（已在 README/文档中说明，若未有则本次 commit message 提示）。
4. **不 push**：仅 commit 到本地 main，远端同步由用户决定。
5. **不 squash 历史**：用户选"清理后 commit 一次"，非改写历史，保留既有 15 个 commit 不动。
6. **本 plan 文件归档**：执行完步骤 1-6 后，本 plan 文件随 `.trae/documents/` 归档到 `.trae/archive/documents/`，作为决策记录留存。

## Verification Steps

1. `npm run typecheck` → exit 0
2. `npm test -- --reporter=dot` → exit 0，614 测试全通过
3. `cd scripts/build-music-library && go build ./...` → exit 0
4. `git status` → 工作区干净（无未提交改动）
5. `git log --oneline -3` → 确认新 commit 在最前
6. 抽查归档目录存在：`ls scripts/archive/build-soda-library/`、`ls .trae/archive/specs/`
7. 抽查垃圾已删：`ls data/*.bak.json` 应报 No such file

## Risk & Rollback

- **低风险**：删除项均为可重建产物或备份；归档用 `mv` 保留内容；go.work 只删一行引用
- **回滚**：若 commit 后发现问题，`git reset --soft HEAD~1` 可回到未提交状态；删除的文件若在历史 commit 中可 `git checkout HEAD~1 -- <path>` 恢复
- **最坏情况**：`dist/` 删除影响 `npm run build` 产物 → 重新 `npm run build` 即可；`progress.json` 删除影响爬虫续传 → 重新全量爬取即可（已有原始数据兜底）
