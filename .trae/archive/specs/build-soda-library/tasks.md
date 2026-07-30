# Tasks

- [x] Task 1: 创建 Go 脚本骨架与依赖配置
  - [x] SubTask 1.1: 创建 `scripts/build-soda-library/go.mod`，module 名 `build-soda-library`，require `github.com/guohuiyuan/music-lib`（go mod tidy 从公共代理拉取成功，未用 replace）
  - [x] SubTask 1.2: 创建 `scripts/build-soda-library/keywords.txt`，内容为 3 个试跑关键词（痛苦说唱、二次元说唱、城市流行）
  - [x] SubTask 1.3: `go mod tidy` 拉取依赖成功（生成 go.sum）

- [x] Task 2: 实现 main.go 核心逻辑
  - [x] SubTask 2.1: 实现 keywords.txt 读取（跳过空行和 # 注释）
  - [x] SubTask 2.2: 实现 progress.json 读写（completed_keywords + scraped_playlist_ids 结构）
  - [x] SubTask 2.3: 实现 soda_songs.json 读写（加载已有数据用于断点续传合并）
  - [x] SubTask 2.4: 实现归一化 key 函数（title+artist 转小写去空格）
  - [x] SubTask 2.5: 实现主循环：遍历关键词 → 跳过已完成 → SearchPlaylist → 过滤(20≤track_count≤500) → 取前10 → 遍历歌单 → 跳过已抓ID → GetPlaylistSongs → 合并歌曲（genres去重合并、appear_count累加）→ 落盘
  - [x] SubTask 2.6: 实现 500ms 请求间隔（每次 SearchPlaylist 和 GetPlaylistSongs 前）
  - [x] SubTask 2.7: 实现统计输出（总歌曲数、各流派歌曲数、appear_count≥3 的歌曲数）

- [x] Task 3: 更新 .gitignore
  - [x] SubTask 3.1: 在项目根 .gitignore 添加 `data/soda_songs.json`、`scripts/build-soda-library/progress.json`、`go.work`、`go.work.sum`
  - [x] 备注：为支持从项目根 `go run ./scripts/build-soda-library`，额外创建了 `go.work`（已加入 .gitignore）

- [x] Task 4: 试跑 3 个关键词并展示统计
  - [x] SubTask 4.1: 从项目根运行 `go run ./scripts/build-soda-library`（exit 0）
  - [x] SubTask 4.2: 确认 data/soda_songs.json 生成且格式正确（数组，字段齐全，按 appear_count 降序）
  - [x] SubTask 4.3: 确认 progress.json 生成且记录正确（3 个已完成关键词，30 个已抓歌单 ID）
  - [x] SubTask 4.4: 捕获统计输出展示给用户，等待确认后再跑全量

# Task Dependencies
- Task 2 依赖 Task 1（需先有 go.mod 和依赖）
- Task 3 独立，可与 Task 2 并行
- Task 4 依赖 Task 1 + Task 2 + Task 3
