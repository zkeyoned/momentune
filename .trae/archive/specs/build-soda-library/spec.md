# 汽水音乐歌单抓取脚本 Spec

## Why
momentune 音乐库需要接入汽水音乐（soda 平台）的按流派标签聚合的歌曲数据。调研已确认 `github.com/guohuiyuan/music-lib` 的 `soda` 包提供 `SearchPlaylist(keyword)` 和 `GetPlaylistSongs(id)` 两个无需 Cookie 的可用接口。需要写一个正式的 Go 抓取脚本，按流派关键词批量拉取汽水歌单歌曲，归一化去重后输出为结构化 JSON 供音乐库使用。

## What Changes
- 新增 Go 脚本目录 `scripts/build-soda-library/`，包含 `main.go`、`go.mod`、`keywords.txt`
- 脚本复用 `github.com/guohuiyuan/music-lib/soda` 包调用汽水接口
- 支持断点续传：`progress.json` 记录已抓歌单 ID 和已完成关键词，中断重跑时跳过
- 输出 `data/soda_songs.json`（项目根 data/ 目录，脚本自动创建）
- 支持请求间隔（500ms）、归一化去重、genres 合并、appear_count 累加
- 运行结束打印统计：总歌曲数、各流派歌曲数、appear_count ≥ 3 的歌曲数

## Impact
- Affected specs: `investigate-soda-music-lib`（调研结论为本脚本的输入依据）
- Affected code: 新增 `scripts/build-soda-library/`（Go 脚本，不影响 TS 主项目）；新增 `data/soda_songs.json`（数据产物，加入 .gitignore）
- 依赖：本机需有 Go 环境（调研中已 `brew install go`，go1.26.5）

## ADDED Requirements

### Requirement: 关键词输入
脚本 SHALL 从 `scripts/build-soda-library/keywords.txt` 读取关键词，一行一个，忽略空行和以 `#` 开头的注释行。

#### Scenario: 正常读取
- **WHEN** keywords.txt 内容为 `痛苦说唱\n二次元说唱\n城市流行`
- **THEN** 脚本处理 3 个关键词

#### Scenario: 含空行和注释
- **WHEN** 文件含空行或 `#` 开头行
- **THEN** 跳过这些行，只处理有效关键词

### Requirement: 歌单搜索与过滤
对每个关键词，脚本 SHALL 调用 `soda.SearchPlaylist(keyword)`，过滤掉 `track_count < 20` 或 `track_count > 500` 的歌单，取剩余前 10 个。

#### Scenario: 正常过滤
- **WHEN** 搜索返回 20 个歌单，其中 5 个 track_count 在 [20, 500] 区间
- **THEN** 取这 5 个（不足 10 个时取全部符合条件的）

#### Scenario: 搜索失败
- **WHEN** SearchPlaylist 返回 error
- **THEN** 记录错误日志，跳过该关键词，继续处理下一个

### Requirement: 歌曲拉取
对每个通过过滤的歌单，脚本 SHALL 调用 `soda.GetPlaylistSongs(playlistID)` 拉取全部歌曲。

#### Scenario: 拉取成功
- **WHEN** GetPlaylistSongs 返回歌曲列表
- **THEN** 逐首处理，更新全局歌曲字典

#### Scenario: 拉取失败
- **WHEN** GetPlaylistSongs 返回 error
- **THEN** 记录错误日志，跳过该歌单，继续处理下一个歌单

### Requirement: 歌曲记录结构
每首歌（归一化去重后）SHALL 记录以下字段：
- `soda_id`（string）：首次遇到时的汽水歌曲 ID（合并时保留首个）
- `title`（string）：歌曲名（首次遇到时的原始 title）
- `artist`（string）：歌手（首次遇到时的原始 artist）
- `album`（string）：专辑（首次遇到时的原始 album）
- `duration`（int）：时长秒数（首次遇到时的值）
- `genres`（string[]）：命中它的关键词去重合并数组（保持插入顺序）
- `appear_count`（int）：在所有已抓歌单中出现的总次数（合并时累加）

#### Scenario: 首次遇到一首歌
- **WHEN** 歌曲X（归一化key未出现过）首次从关键词A的歌单中拉到
- **THEN** 创建记录：genres=[A]，appear_count=1

#### Scenario: 同一关键词多个歌单含同一首歌
- **WHEN** 歌曲X已在关键词A的歌单1中出现，现又在关键词A的歌单2中出现
- **THEN** appear_count++，genres 保持 [A]（去重，不重复添加）

#### Scenario: 不同关键词命中同一首歌
- **WHEN** 歌曲X已在关键词A处理过（genres=[A]），现又在关键词B的歌单中出现
- **THEN** appear_count++，genres 变为 [A, B]

### Requirement: 归一化去重
脚本 SHALL 按 `title+artist` 归一化作为去重 key：转小写 + 移除所有空格。

#### Scenario: 大小写和空格差异
- **WHEN** 两首歌 title/artist 分别为 "Foo Bar"/"Baz" 和 "foo  bar"/"baz"
- **THEN** 归一化后均为 "foobarbaz"，识别为同一首歌合并

### Requirement: 请求间隔
脚本 SHALL 在每次 HTTP 请求（SearchPlaylist 和 GetPlaylistSongs）之间间隔 500ms。

#### Scenario: 间隔生效
- **WHEN** 连续发起多次请求
- **THEN** 相邻两次请求开始时间间隔 ≥ 500ms

### Requirement: 断点续传
脚本 SHALL 维护 `scripts/build-soda-library/progress.json`，记录已完成的关键词和已抓歌单 ID，支持中断后重跑。

progress.json 结构：
```json
{
  "completed_keywords": ["痛苦说唱"],
  "scraped_playlist_ids": ["7435...", "7510..."]
}
```

#### Scenario: 首次运行
- **WHEN** progress.json 不存在
- **THEN** 从头开始处理所有关键词，运行中逐步写入 progress

#### Scenario: 中断后续传
- **WHEN** progress.json 存在，已完成关键词"痛苦说唱"，进行到"二次元说唱"的第3个歌单时中断
- **THEN** 重跑时跳过"痛苦说唱"整个关键词；对"二次元说唱"重新搜索歌单，跳过已抓的3个歌单ID，从第4个开始抓

#### Scenario: 歌单ID去重
- **WHEN** 某歌单ID已在 scraped_playlist_ids 中（可能被前一个关键词抓过）
- **THEN** 跳过该歌单不重复拉取歌曲（该歌单歌曲的 genres 不再加当前关键词——这是断点续传的已知取舍，全量重跑可保证完全准确）

### Requirement: 持久化写入
脚本 SHALL 在每个歌单处理完成后立即写回 `progress.json` 和 `data/soda_songs.json`，避免中断丢失数据。

#### Scenario: 单歌单处理完即落盘
- **WHEN** 一个歌单的歌曲拉取并合并完成
- **THEN** 同步写回 progress.json 和 soda_songs.json

### Requirement: 输出格式
脚本 SHALL 输出 `data/soda_songs.json`，内容为去重后的歌曲数组。

```json
[
  {
    "soda_id": "7173900173256198146",
    "title": "下水道蚂蚁",
    "artist": "连麻swimming / JinJiBeWater_隼",
    "album": "真假美猴王",
    "duration": 178,
    "genres": ["痛苦说唱"],
    "appear_count": 2
  }
]
```

#### Scenario: 目录不存在
- **WHEN** data/ 目录不存在
- **THEN** 脚本自动创建

### Requirement: 统计输出
脚本 SHALL 在运行结束后打印统计到 stdout：
- 总歌曲数（去重后）
- 各流派歌曲数（按 genres 分组计数，一首歌有多个 genre 时在每个 genre 都计一次）
- appear_count ≥ 3 的歌曲数

#### Scenario: 统计格式
- **WHEN** 运行完成
- **THEN** 输出形如：
  ```
  ===== 抓取统计 =====
  总歌曲数（去重后）: 320
  各流派歌曲数:
    痛苦说唱: 180
    二次元说唱: 95
    城市流行: 88
  appear_count ≥ 3 的歌曲数: 42
  ```

### Requirement: 试跑验证
脚本完成后 SHALL 先用 3 个关键词（痛苦说唱、二次元说唱、城市流行）试跑一轮，展示统计结果给用户确认，确认后再跑全量关键词。

#### Scenario: 试跑
- **WHEN** keywords.txt 含 3 个关键词
- **THEN** 运行脚本，输出 data/soda_songs.json 和统计，展示给用户

#### Scenario: 全量跑（用户确认后）
- **WHEN** 用户确认试跑结果，补充 keywords.txt 为全量关键词
- **THEN** 重跑脚本，断点续传跳过已完成的 3 个关键词，只处理新增关键词

## 设计约定

### 路径约定
- 脚本从项目根目录运行：`go run ./scripts/build-soda-library`
- `keywords.txt` 和 `progress.json` 在脚本目录内（`scripts/build-soda-library/`）
- 输出 `data/soda_songs.json` 在项目根 `data/` 下

### 归一化 key 生成
```go
func normalizeKey(title, artist string) string {
    s := strings.ToLower(title + artist)
    return strings.Join(strings.Fields(s), "") // 去所有空白
}
```

### 错误处理
- 单个关键词搜索失败：记录日志，跳过，继续下一个
- 单个歌单拉取失败：记录日志，跳过，继续下一个
- progress.json 或 soda_songs.json 读写失败：致命错误，退出

### .gitignore 更新
- `data/soda_songs.json` 和 `scripts/build-soda-library/progress.json` 加入 .gitignore
- `scripts/build-soda-library/keywords.txt` 保留版本控制（试跑3个关键词的版本）
