# Tasks

- [x] Task 1: 创建多平台抓取脚本目录结构（已完成，脚本已就位）
- [x] Task 2: 实现网易云抓取逻辑（已完成，netease_songs.json 已输出约 74 万行）
- [x] Task 3: 实现 QQ 音乐抓取逻辑（已完成，qq_songs.json 已输出约 74 万行）
- [x] Task 4: 全量抓取三平台（已完成，三份原始 JSON 均已就位）

- [x] Task 5: 重做标签统一归一（首版产物标签爆炸，需去噪+多维度分层）
  - [x] SubTask 5.1: 备份现有 unified_tags.json → unified_tags.bak.json
  - [x] SubTask 5.2: 重写 unify_tags.ts 的流派归一逻辑：主类合并 + 多关键词印证
  - [x] SubTask 5.3: 标签分层输出：primaryGenres + subGenres + emotionTags + sceneTags + eraTags + languageTags + sourceTags + instrumentTags
  - [x] SubTask 5.4: 非流派标签精细分类
  - [x] SubTask 5.5: 运行脚本输出 unified_tags.json，抽检 5 首歌曲确认标签合理

- [x] Task 6: 重做 V-A 坐标全量重算（修复字段映射 bug + 改进融合权重）
  - [x] SubTask 6.1: 备份现有 unified_library.json → unified_library.bak.json
  - [x] SubTask 6.2: 修复字段映射：对齐 unify_tags.ts 输出（primaryGenres/subGenres/eraTags/languageTags）
  - [x] SubTask 6.3: 扩充情绪标签→V-A 偏移量映射表（覆盖所有 20 个情绪标签）
  - [x] SubTask 6.4: 三层融合：流派基调（0.35）+ 情绪修正（0.50）+ 标题关键词（0.15）。情绪偏移量累加（限幅 ±0.4）
  - [x] SubTask 6.5: 置信度按信号数量递增：3 信号 0.85，2 信号 0.75，1 信号 0.60，0 信号 0.40
  - [x] SubTask 6.6: 推断 language/layer/hotRecency/decade/sceneTags
  - [x] SubTask 6.7: 输出 unified_library.json，source 100% feature_fusion，V-A 区分度验证通过

- [x] Task 7: 生成统计报告
  - [x] SubTask 7.1: 统计三平台各自歌曲数、去重后总数（174,276 首）
  - [x] SubTask 7.2: 各 GenreTag 分布、V-A 覆盖范围、layer 分布、置信度分布
  - [x] SubTask 7.3: 未归一化标签列表（无未归一化标签）
  - [x] SubTask 7.4: 写入 data/unified_library_stats.json 并打印到 stdout

# Task Dependencies
- Task 1-7 全部完成
