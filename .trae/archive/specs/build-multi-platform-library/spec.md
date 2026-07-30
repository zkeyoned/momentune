# 多平台音乐库抓取与标签统一 Spec

## Why
当前只有汽水音乐一个来源（48449 首歌），且抓取关键词中 22 个未被项目的 `GENRE_KEYWORD_MAPPING` 覆盖。需要用相同方法再抓网易云和 QQ 音乐，将三个平台的关键词/标签统一归一，然后基于统一后的标签数据重新标注所有歌曲的 V-A 坐标，为推荐算法提供更大更准的曲库底座。

## What Changes
- 新增网易云抓取脚本 `scripts/build-music-library/netease_crawler.go`，复用 `music-lib/netease` 包
- 新增 QQ 音乐抓取脚本 `scripts/build-music-library/qq_crawler.go`，复用 `music-lib/qq` 包
- 将现有 `scripts/build-soda-library/` 重构为 `scripts/build-music-library/soda_crawler.go`，统一目录结构
- 三个平台共享关键词文件 `scripts/build-music-library/keywords.txt` 和断点续传机制
- 输出三份原始数据：`data/soda_songs.json`、`data/netease_songs.json`、`data/qq_songs.json`
- 新增标签统一脚本 `scripts/build-music-library/unify_tags.ts`，将三平台原始关键词归一为项目标准 `GenreTag`
- 新增 V-A 标注脚本 `scripts/build-music-library/assign_va.ts`，基于统一标签重新计算所有歌曲 V-A 坐标
- 输出最终合并曲库 `data/unified_library.json`（标准 `Song[]` 格式，可直接被算法消费）
- **BREAKING**: 废弃旧 `data/soda_songs.json` 的原始格式，统一为 `Song` 接口格式

## Impact
- Affected specs: `build-soda-library`（soda 抓取逻辑迁移到新目录）、`investigate-soda-music-lib`（调研结论仍然有效）
- Affected code:
  - `scripts/build-soda-library/` → 迁移至 `scripts/build-music-library/`
  - `src/algorithm/config/genreTags.ts`（补充缺失的关键词映射）
  - `src/algorithm/musicLibrary.ts`（未来可直接加载 `unified_library.json`）
  - `data/` 目录新增多个数据文件
- 依赖：本机 Go 环境（已安装 go1.26.5）、`github.com/guohuiyuan/music-lib` 已在 go.work 中声明

## ADDED Requirements

### Requirement: 多平台抓取架构
系统 SHALL 提供统一的多平台音乐歌单抓取框架，支持汽水音乐（soda）、网易云音乐（netease）、QQ 音乐（qq）三个平台，使用相同的关键词列表和相同的归一化去重逻辑。

#### Scenario: 三平台共享关键词
- **WHEN** keywords.txt 包含 88 个关键词
- **THEN** 三个平台各自用全部关键词搜索歌单，独立输出原始数据

#### Scenario: 平台独立断点续传
- **WHEN** netease 抓取中断在第 50 个关键词
- **THEN** 重跑时 netease 从第 50 个关键词续传，soda 和 qq 的进度互不影响

### Requirement: 网易云音乐抓取
脚本 SHALL 调用 `netease.SearchPlaylist(keyword)` 搜索歌单，过滤 `track_count < 20` 或 `track_count > 500` 的歌单，取前 10 个，逐个调用 `netease.GetPlaylistSongs(playlistID)` 拉取歌曲。

#### Scenario: 正常抓取
- **WHEN** 用关键词"痛苦说唱"搜索网易云歌单
- **THEN** 返回歌单列表，过滤后取前 10 个，逐个拉取歌曲并合并

#### Scenario: 无需 Cookie
- **WHEN** 未配置任何网易云 Cookie
- **THEN** SearchPlaylist 和 GetPlaylistSongs 正常工作（weapi 加密已在库内封装）

### Requirement: QQ 音乐抓取
脚本 SHALL 调用 `qq.SearchPlaylist(keyword)` 搜索歌单，过滤逻辑与网易云一致，取前 10 个歌单拉取歌曲。

#### Scenario: 正常抓取
- **WHEN** 用关键词"痛苦说唱"搜索 QQ 音乐歌单
- **THEN** 返回歌单列表，过滤后取前 10 个，逐个拉取歌曲并合并

### Requirement: 多平台歌曲记录结构
每个平台输出的原始歌曲数据 SHALL 包含以下字段：
- `platform_id`（string）：平台内歌曲 ID
- `platform`（string）：来源平台（"soda" / "netease" / "qq"）
- `title`（string）：歌曲名
- `artist`（string）：歌手
- `album`（string）：专辑
- `duration`（int）：时长秒数
- `raw_tags`（string[]）：命中它的搜索关键词去重合并数组
- `appear_count`（int）：跨歌单出现总次数

#### Scenario: 跨平台同一首歌
- **WHEN** 歌曲《起风了》在 soda、netease、qq 三个平台都被抓到
- **THEN** 三个平台各自独立记录该歌曲，标签统一阶段再跨平台合并

### Requirement: 标签统一归一
系统 SHALL 将三平台所有原始关键词（raw_tags）统一归一为项目的 69 个标准 `GenreTag`，并识别出非流派标签（情绪/场景/年代/语种等）单独分类。

#### Scenario: 流派标签归一
- **WHEN** 原始标签为"痛苦说唱"
- **THEN** 归一为 `emorap`

#### Scenario: 非流派标签识别
- **WHEN** 原始标签为"失恋"
- **THEN** 识别为情绪标签，不归入 GenreTag，而是用于 V-A 标注的情绪信号

#### Scenario: 未覆盖关键词处理
- **WHEN** 原始标签无法映射到任何现有 GenreTag（如"freestyle"）
- **THEN** 归入 `other` 或新增映射规则

### Requirement: V-A 坐标重新标注
系统 SHALL 基于统一后的标签数据，为所有歌曲重新计算 V-A（Valence-Arousal）坐标，替代之前的手工/关键词估算方式。

#### Scenario: 基于情绪标签标注
- **WHEN** 歌曲 raw_tags 包含"失恋"、"伤感"、"深夜emo"
- **THEN** V-A 坐标偏向低 Valence（消极）、中高 Arousal

#### Scenario: 基于流派标签标注
- **WHEN** 歌曲 raw_tags 包含"phonk"、"漂移电音"
- **THEN** V-A 坐标偏向中低 Valence、高 Arousal

#### Scenario: 多标签融合
- **WHEN** 歌曲同时有流派标签（如"trap"）和情绪标签（如"励志"）
- **THEN** 融合两种信号计算综合 V-A 坐标，流派定基调、情绪做修正

### Requirement: 最终统一曲库输出
系统 SHALL 输出 `data/unified_library.json`，格式为标准 `Song[]`，可直接被 `src/algorithm/musicLibrary.ts` 消费。

每首歌曲 SHALL 包含：
- `songId`：跨平台稳定 ID（`{platform}_{normalized_title}_{normalized_artist}`）
- `title`、`artist`、`album`
- `layer`：音乐库层级（`hot` / `emotion` / `fallback`）
- `va`：V-A 坐标（含 confidence 和 source）
- `genres`：归一化后的 GenreTag 数组
- `sceneTags`：从原始标签中提取的场景标签
- `language`：推断的语言标签
- `hotRecency`：基于 appear_count 推断的新鲜度
- `decade`：从标签推断的年代
- `source`：来源平台

#### Scenario: 可直接加载
- **WHEN** 算法层调用 `createMusicLibrary()`
- **THEN** 可选择加载 `unified_library.json` 作为曲库数据源

### Requirement: 统计报告
系统 SHALL 在标签统一和 V-A 标注完成后输出统计报告：
- 三平台各自歌曲总数和去重后总数
- 统一后各 GenreTag 的歌曲数分布
- V-A 空间覆盖范围（vRange、aRange）
- 各 layer 分布
- 未归一化标签列表（供人工补映射）

#### Scenario: 统计输出
- **WHEN** 标签统一和 V-A 标注完成
- **THEN** 打印完整统计到 stdout，并写入 `data/unified_library_stats.json`

## MODIFIED Requirements

### Requirement: 抓取脚本目录结构
原 `scripts/build-soda-library/` SHALL 迁移至 `scripts/build-music-library/`，包含：
- `main.go`：入口，按平台参数分发
- `soda_crawler.go`：汽水音乐抓取逻辑
- `netease_crawler.go`：网易云抓取逻辑
- `qq_crawler.go`：QQ 音乐抓取逻辑
- `common.go`：共享的归一化、断点续传、输出逻辑
- `keywords.txt`：三平台共享关键词
- `go.mod`：模块定义

#### Scenario: 运行指定平台
- **WHEN** 执行 `go run ./scripts/build-music-library -platform soda`
- **THEN** 只抓取汽水音乐

#### Scenario: 运行全部平台
- **WHEN** 执行 `go run ./scripts/build-music-library -platform all`
- **THEN** 依次抓取 soda、netease、qq 三个平台

## 设计约定

### 关键词复用
三平台共用 `keywords.txt`（现有 88 个关键词），每个平台独立搜索、独立输出。

### 归一化去重 key
```go
func normalizeKey(title, artist string) string {
    s := strings.ToLower(title + artist)
    return strings.Join(strings.Fields(s), "")
}
```

### 断点续传
每个平台独立维护 progress 文件：
- `scripts/build-music-library/progress_soda.json`
- `scripts/build-music-library/progress_netease.json`
- `scripts/build-music-library/progress_qq.json`

### 请求间隔
500ms（与现有 soda 脚本一致）。

### 标签归一优先级
1. 先匹配 `GENRE_KEYWORD_MAPPING` 中的已有规则
2. 补充 22 个缺失关键词的映射规则
3. 无法归一为 GenreTag 的标签，按类型分类：
   - 情绪标签（失恋/伤感/治愈系/燃向/深夜emo/雨天/怀旧/励志/暧昧/迷幻）
   - 场景标签（咖啡厅/公路旅行/旅行）
   - 年代标签（80年代/90年代）
   - 语种标签（华语经典/粤语经典/欧美流行）
   - 来源标签（抖音热歌/翻唱）
   - 乐器标签（吉他/纯音乐/钢琴曲）

### V-A 标注策略
1. 从 raw_tags 中提取情绪信号，映射到 V-A 偏移量
2. 从归一化 GenreTag 推断基调 V-A（如 trap → 低V高A，folk → 中V低A）
3. 从标题/歌手关键词做修正（复用 `keywordEstimateVA`）
4. 多信号加权融合，置信度按信号数量递增
