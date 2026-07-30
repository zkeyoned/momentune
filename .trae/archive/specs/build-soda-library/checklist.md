# Checklist

- [x] scripts/build-soda-library/go.mod 已创建，依赖 music-lib 可正常拉取
- [x] keywords.txt 含 3 个试跑关键词（痛苦说唱、二次元说唱、城市流行）
- [x] 脚本能从 keywords.txt 正确读取关键词（跳过空行和 # 注释）
- [x] 对每个关键词调用 soda.SearchPlaylist 成功（3个关键词分别返回 20/19/18 个歌单）
- [x] 过滤逻辑正确：仅保留 20 ≤ track_count ≤ 500 的歌单（过滤后 14/13/14 个）
- [x] 取过滤后前 10 个歌单
- [x] 对每个歌单调用 soda.GetPlaylistSongs 拉取全部歌曲（30个歌单全部成功）
- [x] 歌曲记录字段完整：soda_id、title、artist、album、duration、genres、appear_count
- [x] 归一化去重正确（title+artist 转小写去空格作为 key，1758 首去重后）
- [x] genres 去重合并正确（同关键词不重复添加，不同关键词按序追加，如"1 AM"的 genres=["痛苦说唱","城市流行"]）
- [x] appear_count 累加正确（最高 10，即出现在 10 个歌单中）
- [x] 请求间隔 500ms 生效（30个歌单拉取耗时约 31 秒，符合 500ms 间隔）
- [x] progress.json 断点续传工作（跳过已完成关键词、跳过已抓歌单ID，结构正确）
- [x] 每个歌单处理后立即落盘 progress.json 和 soda_songs.json
- [x] data/soda_songs.json 输出格式正确（歌曲数组，字段齐全，按 appear_count 降序排序）
- [x] 运行结束打印统计（总歌曲数 1758、各流派歌曲数、appear_count≥3 的歌曲数 127）
- [x] .gitignore 已添加 data/soda_songs.json、progress.json、go.work、go.work.sum
- [x] 试跑 3 个关键词成功，统计结果已展示给用户
