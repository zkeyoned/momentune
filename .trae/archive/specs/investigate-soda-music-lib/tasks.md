# Tasks

- [x] Task 1: 克隆 music-lib 仓库并阅读 soda 包源码
  - [x] SubTask 1.1: 在临时目录 `git clone https://github.com/guohuiyuan/music-lib`
  - [x] SubTask 1.2: 读取 `soda/` 包下所有 `.go` 源文件（非 `_test.go`），列出全部导出函数
  - [x] SubTask 1.3: 确认歌单搜索函数签名（函数名、入参、返回值类型）
  - [x] SubTask 1.4: 确认歌单结构体定义，检查是否含收藏量/播放量字段
  - [x] SubTask 1.5: 确认歌单歌曲解析函数签名（ParsePlaylist / GetPlaylistSongs 等）
  - [x] SubTask 1.6: 如歌单搜索函数不存在，列出 soda 包所有导出函数并标注可复用项（搜索函数存在，同时列出了全部导出函数）

- [x] Task 2: 搭建 Go 最小测试环境并运行"痛苦说唱"歌单搜索
  - [x] SubTask 2.1: 检查本机 Go 环境（`go version`），无则安装（brew install go，go1.26.5）
  - [x] SubTask 2.2: 在临时目录创建 Go module，`go get github.com/guohuiyuan/music-lib`（用 replace 指向本地克隆）
  - [x] SubTask 2.3: 编写 `main.go`，调用 soda 歌单搜索函数，关键词="痛苦说唱"，结果以 JSON 原样打印
  - [x] SubTask 2.4: `go mod tidy && go run main.go`，捕获完整输出（成功，返回 20 条歌单）
  - [x] SubTask 2.5: 若搜索成功，取第一条结果调用歌单歌曲解析函数，打印歌曲列表（成功，返回 16 首）
  - [x] SubTask 2.6: 若运行失败，记录错误信息并分析原因（未触发，测试成功无报错）

- [x] Task 3: 汇总调研结论报告
  - [x] SubTask 3.1: 回答三个问题：能否搜歌单/有无收藏量播放量字段/能否解析全部歌曲
  - [x] SubTask 3.2: 附上"痛苦说唱"搜索的原始返回结果
  - [x] SubTask 3.3: 若搜索不可用，附上 soda 包可复用接口清单（搜索可用，同时附上了全部导出函数清单）
  - [x] SubTask 3.4: 给出对 momentune 项目的接入建议

# Task Dependencies
- Task 2 依赖 Task 1（需先确认函数签名才能写测试代码）
- Task 3 依赖 Task 1 + Task 2（需源码分析 + 实测结果才能汇总）
