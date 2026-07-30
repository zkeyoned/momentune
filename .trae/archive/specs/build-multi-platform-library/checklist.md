# Checklist

## 多平台抓取架构
- [ ] `scripts/build-music-library/` 目录创建完成，包含 main.go、soda_crawler.go、netease_crawler.go、qq_crawler.go、common.go
- [ ] main.go 支持 `-platform soda|netease|qq|all` 参数分发
- [ ] common.go 包含共享的归一化去重、断点续传、歌曲合并、输出逻辑
- [ ] keywords.txt 已迁移到新目录
- [ ] go.mod 和 go.work 已更新，可从项目根 `go run ./scripts/build-music-library` 正常运行
- [ ] 旧 `scripts/build-soda-library/` 已清理或保留只读（不冲突）

## 网易云抓取
- [ ] netease_crawler.go 调用 `netease.SearchPlaylist` 和 `netease.GetPlaylistSongs`
- [ ] 过滤 track_count < 20 或 > 500 的歌单，取前 10 个
- [ ] 请求间隔 500ms
- [ ] 断点续传 `progress_netease.json` 独立维护
- [ ] 输出 `data/netease_songs.json`，字段包含 platform_id、platform、title、artist、album、duration、raw_tags、appear_count
- [ ] 3 个关键词试跑成功，返回合理数据

## QQ 音乐抓取
- [ ] qq_crawler.go 调用 `qq.SearchPlaylist` 和 `qq.GetPlaylistSongs`
- [ ] 过滤逻辑与网易云一致
- [ ] 断点续传 `progress_qq.json` 独立维护
- [ ] 输出 `data/qq_songs.json`，字段格式与 netease 一致
- [ ] 3 个关键词试跑成功，返回合理数据

## 全量抓取
- [ ] soda 用全量 88 关键词跑完（断点续传跳过已有）
- [ ] netease 用全量 88 关键词跑完
- [ ] qq 用全量 88 关键词跑完
- [ ] 三份 JSON 文件都包含合理数量的歌曲

## 标签统一归一
- [ ] unify_tags.ts 能正确读取三份原始 JSON
- [ ] 跨平台按 title+artist 归一化去重合并
- [ ] raw_tags 跨平台合并去重
- [ ] raw_tags 正确匹配 GENRE_KEYWORD_MAPPING 归一为 GenreTag[]
- [ ] 22 个缺失关键词已补充映射规则
- [ ] 非流派标签正确分类为情绪/场景/年代/语种/来源/乐器
- [ ] 输出 `data/unified_tags.json` 中间产物

## V-A 坐标标注
- [ ] assign_va.ts 定义情绪标签→V-A 偏移量映射表
- [ ] assign_va.ts 定义 GenreTag→基调 V-A 映射表
- [ ] 每首歌的 V-A 坐标由流派基调 + 情绪修正 + 标题关键词修正融合计算
- [ ] 置信度按信号数量递增
- [ ] language 通过中文字符比例检测正确推断
- [ ] layer 基于 appear_count 合理分层（hot/emotion/fallback）
- [ ] hotRecency 基于 appear_count 推断
- [ ] decade 从年代标签推断
- [ ] sceneTags 从场景标签提取
- [ ] 输出 `data/unified_library.json` 为标准 Song[] 格式

## 统计报告
- [ ] 统计包含三平台各自歌曲数和去重后总数
- [ ] 统计包含各 GenreTag 分布
- [ ] 统计包含 V-A 覆盖范围
- [ ] 统计包含 layer 分布
- [ ] 统计包含未归一化标签列表
- [ ] 输出写入 `data/unified_library_stats.json` 并打印到 stdout

## 数据格式验证
- [ ] `data/unified_library.json` 中每首歌都有 songId、va、genres、layer、source 字段
- [ ] V-A 坐标值在 [-1, 1] 范围内
- [ ] 无 genres 为空的歌曲（至少有 other）
- [ ] 跨平台同一首歌没有重复出现
