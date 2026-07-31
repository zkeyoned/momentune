# QQ 音乐 / 汽水音乐扫码接入可行性报告

> 调研日期：2026-07-31
> 调研范围：官方 API、第三方库、扫码流程、歌单/播放地址能力、风险评估
> 结论摘要：QQ 音乐 ✅ 可接入（有成熟库）；汽水音乐 ⚠️ 有条件接入（有参考实现但稳定性差）

---

## 执行摘要

| 平台 | 结论 | 首选方案 | 核心风险 |
|------|------|---------|---------|
| QQ 音乐 | ✅ **可接入** | [L-1124/QQMusicApi](https://github.com/L-1124/QQMusicApi)（Python, 425★, 2026-07-25 活跃） | 法律风险中高；VIP 解密涉 DRM 绕过 |
| 汽水音乐 | ⚠️ **有条件接入** | 参考 [zzstar101/Mineradio-Tauri](https://github.com/zzstar101/Mineradio-Tauri) 的 TS 实现 | 稳定性差（sessionData 易失效）；收藏列表查询需实测 |
| 网易云 | ✅ 已接入 | 现有 `NeteaseCloudMusicApi` | 已知问题：直链几小时过期 |

**推荐接入顺序**：QQ 音乐 → 汽水音乐（若 QQ 接入顺利且仍需汽水）

---

## 一、QQ 音乐调研详情

### 1.1 官方 API 状态

**结论：❌ 腾讯未提供公开的 QQ 音乐扫码登录开放接口**

- 未找到面向第三方开发者的 QQ 音乐开放平台入口
- 扫码登录实际复用 **QQ 互联（QQ Connect）** 与 **微信开放平台** 的 OAuth2.0 流程,并非 QQ 音乐独立提供
- 个人开发者无法直接合规接入（需企业资质 + 网站备案）
- 第三方库实际是**冒充 QQ 音乐 Web 客户端**调用端点

### 1.2 主流第三方库对比

| 仓库 | Star | 最近提交 | 语言 | License | 扫码登录 | 用户歌单 | 播放 URL |
|------|------|---------|------|---------|---------|---------|---------|
| **[L-1124/QQMusicApi](https://github.com/L-1124/QQMusicApi)** | 425 | 2026-07-25（6 天前） | Python (asyncio) | **GPL v3** | ✅ 完整支持 | ✅ 完整支持 | ✅ 含 VIP 加密 |
| [jsososo/QQMusicApi](https://github.com/jsososo/QQMusicApi) | 1602 | 2022-07-09（**停更 4 年**） | Node.js | MIT | ❌ 仅手动 cookie | ✅ | ✅ |
| [Rain120/qq-music-api](https://github.com/Rain120/qq-music-api) | 1024 | 2026-05-26 | TypeScript (Koa2) | MIT | ❌ README 说"没时间做登录" | ⚠️ 仅公共歌单 | ✅ |

**首选 L-1124/QQMusicApi** 的理由：
- 6 天前刚提交,作者 `L-1124` 活跃（近期有 `refactor(core)!: 移除未支持的 JCE 协议支持` 等重大重构）
- 完整支持 3 种扫码方式（见 1.3）
- 代码结构专业（Pydantic 模型 + 分层 modules + 文档齐全）
- ⚠️ 注意 GPL v3 传染性：衍生项目必须同样开源

### 1.3 扫码登录流程（来自 L-1124 `qqmusic_api/modules/login.py`）

**3 种扫码方式**：

| 方式 | QRLoginType | 二维码端点 | 状态检查 | 鉴权 | 稳定性 |
|------|-----------|------------|---------|------|--------|
| QQ 扫码 | `QRLoginType.QQ` | `ssl.ptlogin2.qq.com/ptqrshow` | `ssl.ptlogin2.qq.com/ptqrlogin` | QQ 互联 OAuth2.0 | ⚠️ 中（复用 QQ 互联,腾讯风控严） |
| 微信扫码 | `QRLoginType.WX` | `open.weixin.qq.com/connect/qrconnect` | 长轮询 35s 超时 | 微信 OAuth → tmeLoginType=1 | ⚠️ 中 |
| **手机客户端** | `QRLoginType.MOBILE` | `music.login.LoginServer.CreateQRCode` | **MQTT over WSS 长连接推送** | tmeLoginType=6 | ✅ 最稳定（QQ 音乐 App 自有方式） |

**凭证字段**（来自 `docs/tutorial/credential.md`）：
- `musicid`（必需）：QQ 号 6-11 位 / 微信 ID 最长 19 位
- `musickey`（必需）：登录态 Key,`Q_H_L_` 前缀=QQ,`W_X_` 前缀=微信
- `refresh_key` / `refresh_token`（可选）：刷新用
- 有效期：约 90 天（从 jsososo 代码 `expired_in: 7776000` 推断）

**错误码表**（节选,完整表见 `login.py`）：
- 1000/104401/104400：鉴权参数无效或过期 → `LoginAuthExpiredError`
- 20279：登录设备数量超限 → `LoginDeviceLimitError`
- 20450：账号已封禁 → `LoginAccountRestrictedError`
- 104604：操作过于频繁 → `LoginRateLimitError`

### 1.4 歌单拉取能力

| 数据类型 | 支持 | 端点 | 说明 |
|---------|------|------|------|
| **红心歌单（我喜欢）** | ✅ | `music.srfDissInfo.DissInfo`,**dirid=201** | 代码注释明确"我喜欢"目录 ID 固定为 201 |
| **自建歌单** | ✅ | `music.musicasset.PlaylistBaseRead` / `GetPlaylistByUin` | 返回 `UserCreatedSonglistResponse` |
| **收藏的外部歌单** | ✅ | `music.musicasset.PlaylistFavRead` / `CgiGetPlaylistFavInfo` | 返回 `UserFavSonglistResponse` |
| **歌单详情** | ✅ | `music.srfDissInfo.DissInfo` | 支持分页 `song_begin`/`song_num` |
| **最近听过** | ❌ | **未找到** | 代码搜索 0 结果 |
| 音乐基因/听歌画像 | ✅（替代） | `music.recommend.UserProfileSettingSvr` / `GetProfileReport` | 可作为"最近偏好"降级 |

**注意**：大部分用户数据接口需要 `euin`（加密 UIN）而非原始 QQ 号,需先调 `user.get_euin(musicid)` 转换。

### 1.5 播放地址获取

| 能力 | 支持 | 说明 |
|------|------|------|
| 普通格式 URL（MP3/FLAC/OGG） | ✅ | `music.vkey.GetVkey` / `UrlGetVkey`,明文文件 |
| VIP 加密格式（.mflac/.mgg/.mnac） | ✅ | `music.vkey.GetEVkey`,**需 VIP musickey + 客户端解密** |
| 试听片段 | ✅ | `SpecialSongFileType.TRY`（.mp3）,**不登录也可用**,合规降级 |
| 批量限制 | - | 单次最多 100 首（`_GET_SONG_URLS_MAX_MID = 100`） |
| URL 有效期 | 未官方确认 | 推测几小时到一天（CDN 鉴权 token） |

**音质类型**：4 大类 50+ 种（普通/加密/特殊/彩铃）,详见 `SongFileType` 枚举。

### 1.6 风险评估

| 维度 | 评估 | 证据 |
|------|------|------|
| **法律风险** | ⚠️ 中高 | 冒充 QQ 音乐 Web 客户端调用 OAuth；VIP 解密涉 DRM 绕过（《著作权法》第 49 条）；L-1124 README 自述"仅供研究" |
| **稳定性** | ⚠️ 中 | API 仍在演进（L-1124 近期有破坏性重构）；QQ 互联风控策略可能调整 |
| **维护成本** | ⚠️ 较高 | MusicKey 约 90 天失效一次；签名算法不定期更新；需持续跟随上游仓库 |
| **风控封号** | ⚠️ 中 | 错误码表显示存在账号受限/设备超限/频率超限等风控 |

---

## 二、汽水音乐调研详情

### 2.1 App 形态确认

**结论：✅ 独立 App,有 PC 电脑版,API 域名 `api.qishui.com`**

| 维度 | 结论 | 证据 |
|------|------|------|
| 独立 Android App | ✅ 包名 `com.luna.music`（内部代号 Luna） | [ganlinte/GKD-subscription](https://github.com/ganlinte/GKD-subscription) `src/apps/com.luna.music.ts` |
| PC 电脑版 | ✅ UA 为 `LunaPC/3.5.1(408871041)` | [Mineradio-Tauri](https://github.com/zzstar101/Mineradio-Tauri) 源码 `SODA_QR_CHECK_USER_AGENT` |
| 网页版 | ⚠️ 仅有分享落地页 | [a1783190555/Soda_music_crawler](https://github.com/a1783190555/Soda_music_crawler) 列出 `qishui.douyin.com/s/xxxxxx` |
| API 域名 | `api.qishui.com`,路径前缀 `/luna/pc/` | Mineradio-Tauri `soda-client.ts` |
| App ID (aid) | `386088` | 所有请求参数均含 `aid=386088` |

### 2.2 官方 API 状态

**结论：❌ 未找到汽水音乐官方公开 API / 开放平台**

- GitHub 全量搜索无任何指向官方开放平台的引用,所有项目均为逆向
- 主流第三方 API 聚合服务（如 [TikHub](https://github.com/TikHub/TikHub-API-Python-SDK) 覆盖 16+ 平台、1010 端点）**不含汽水音乐**
- [Evil0ctal/Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)（19031★）不支持汽水
- ⚠️ 环境限制未能在线核验字节开放平台官网,但 GitHub 无任何引用,推断无公开 API

### 2.3 第三方库现状

**结论：⚠️ 无独立可复用的汽水音乐 API 库,但有完整参考实现**

| 仓库 | Star | 最近提交 | 语言 | 能力 | 鉴权 |
|------|------|---------|------|------|------|
| **[zzstar101/Mineradio-Tauri](https://github.com/zzstar101/Mineradio-Tauri)** | - | 2026-07 活跃 | TypeScript/Rust | **完整播放器,已实现扫码登录+歌单+搜索+歌词+播放** | 扫码登录 Cookie |
| [520Qiuyu/qishuiMusicAnalysis](https://github.com/520Qiuyu/qishuiMusicAnalysis) | 65 | 2026-07-30 | TypeScript | 解析分享链接→播放地址,含 `sodaDecryptor.ts` | 抓包 Cookie+x-helios/x-medusa |
| [jiuhunwl/music_jx](https://github.com/jiuhunwl/music_jx) | 80 | 2026-07-27 | PHP | 多平台解析含汽水 | 匿名 |
| [FearfulTomcat27/PlayListConverter](https://github.com/FearfulTomcat27/PlayListConverter) | 2 | 2024-07-24 | Python | **导出汽水歌单到其他平台**（与 Momentune 需求最接近） | 匿名 |

**关键发现**：Mineradio-Tauri 是当前唯一已验证的汽水音乐扫码登录实现,代码在 `sidecars/api/src/`,**TypeScript 编写,与 Momentune 技术栈契合**,但未抽成独立包。

### 2.4 扫码登录流程（来自 Mineradio-Tauri `soda-qr-login.ts`）

**汽水音乐复用字节 Passport 统一登录系统**,完整流程：

**第 1 步：获取二维码**
```
GET https://api.qishui.com/passport/web/get_qrcode/?aid=386088&is_new_login=1...
```
返回：`{ data: { qrcode: "<图片URL>", token: "<轮询token>" } }`

**第 2 步：轮询扫码状态**
```
POST https://api.qishui.com/passport/web/check_qrconnect/?aid=386088...
Headers: Referer: https://api.qishui.com/, User-Agent: LunaPC/3.5.1(408871041)
Body: token=<token>&is_new_login=1...
```
状态：`scanned`（已扫码,返回头像）/ `confirmed`（**从 Set-Cookie 提取 Cookie**）/ `expired`

**第 3 步：登录态存储**
- 从 `Set-Cookie` 提取 Cookie,后续所有 `/luna/pc/` 接口携带 `Cookie` 头

**鉴权特征**：
| 维度 | 结论 |
|------|------|
| 登录系统 | 字节 Passport 统一登录（`/passport/web/`）,与抖音/头条同源 |
| 扫码是否需要签名 | ❌ 不需要（`soda-qr-login.ts` 无签名头） |
| 播放接口是否需要签名 | ⚠️ `track_v2` 在 [520Qiuyu](https://github.com/520Qiuyu/qishuiMusicAnalysis) 中需要 `x-helios`/`x-medusa` 设备指纹 |
| 能否复用抖音登录态 | ⚠️ 理论同属字节 Passport,但 aid 不同（抖音 aid=1128）,Cookie 域不同,未实证 |

### 2.5 数据拉取能力

| 数据项 | 可行性 | 端点 | 说明 |
|--------|--------|------|------|
| 用户歌单列表 | ✅ 已实现 | `GET /luna/pc/me/playlist?aid=386088` | `playlistList()` |
| 歌单详情（分页） | ✅ 已实现 | `GET /luna/pc/playlist/detail?playlist_id=&cursor=&count=20` | `playlistDetail()` 支持 `has_more`/`next_cursor` |
| 歌曲搜索 | ✅ 已实现 | `GET /luna/pc/search/track?q=&aid=386088` | `search()` |
| 歌曲 ID 和元信息 | ✅ 已实现 | `GET /luna/pc/track_v2?track_id=&aid=386088` | `trackDetail()` |
| 歌词 | ✅ 已实现 | 同 `track_v2` | issue #13 确认"未加密逐字歌词" |
| 播放地址 | ⚠️ 有条件 | `track_v2` 返回,需 `sodaDecryptor.ts` 解密 | **非 VIP 可行,VIP 可能需 x-helios** |
| 收藏/取消收藏 | ✅ 已实现 | `POST /luna/pc/me/collection/media` | `collectionMedia()` |
| **收藏歌曲列表查询** | ⚠️ **需实测** | `/luna/pc/me/collection/media` 端点证实了"收藏操作",**列表查询行为未验证** | **Momentune 核心缺口** |
| 登录状态 | ✅ 已实现 | `GET /luna/pc/me` | `loginStatus()` |
| **播放历史** | ❌ 未找到 | 无任何端点证据 | - |

### 2.6 风险评估

| 维度 | 评估 | 证据 |
|------|------|------|
| **稳定性** | ⚠️ 高风险 | [Mineradio issue #323](https://github.com/XxHuberrr/Mineradio/issues/323)（2026-07-25）"汽水音乐登录状态无法读取",sessionData 失效；[520Qiuyu](https://github.com/520Qiuyu/qishuiMusicAnalysis) README 警告"凭证会过期" |
| **逆向难度** | ✅ 中低（扫码）/ ⚠️ 中（播放地址） | 扫码走标准 Passport 无需签名；播放地址可能需 x-helios/x-medusa 设备指纹 |
| **字节容忍度** | ⚠️ 中等偏严 | issue #13 作者评论"可能吃函",但 520Qiuyu(65★)、Soda_music_crawler(17★) 等项目仍在 GitHub 公开存在且持续更新 |
| **法律风险** | ⚠️ 存在 | 涉及未授权访问、绕过技术保护（音频解密）、版权音乐再分发；Momentune 作为本地导入工具风险较低 |

---

## 三、三平台横向对比

| 维度 | 网易云（已接入） | QQ 音乐 | 汽水音乐 |
|------|-----------------|---------|---------|
| 官方公开 API | ❌ | ❌ | ❌ |
| 主流第三方库 | ✅ NeteaseCloudMusicApi（成熟） | ✅ L-1124/QQMusicApi（活跃） | ❌ 无独立库,仅参考实现 |
| 扫码登录 | ✅ | ✅ 3 种方式 | ✅ 复用字节 Passport |
| 红心歌单 | ✅ | ✅（dirid=201） | ⚠️ 收藏列表查询需实测 |
| 自建歌单 | ✅ | ✅ | ✅ |
| 最近听过 | ✅ | ❌ 未找到 | ❌ 未找到 |
| 播放地址 | ✅（几小时过期） | ✅（VIP 需解密） | ⚠️ 非 VIP 可行,VIP 需签名 |
| 稳定性 | ⚠️ 中 | ⚠️ 中 | ⚠️ 差（sessionData 易失效） |
| 法律风险 | 中 | 中高（DRM 绕过） | 中 |
| 技术栈契合度 | Node.js（契合） | **Python（不契合,需桥接）** | **TypeScript（高度契合）** |
| 综合结论 | ✅ 已接入 | ✅ **可接入** | ⚠️ **有条件接入** |

---

## 四、结论与建议

### 4.1 平台级结论

- **QQ 音乐**：✅ **可接入**。L-1124/QQMusicApi 是成熟方案,扫码登录完整,歌单拉取能力强,主要风险在 VIP 解密的法律问题。
- **汽水音乐**：⚠️ **有条件接入**。Mineradio-Tauri 提供了 TypeScript 参考实现,扫码登录可行,但稳定性差（sessionData 失效问题）,且**收藏歌曲列表查询能力未验证**——这是 Momentune 的核心需求,接入前必须先实测。

### 4.2 推荐接入顺序

1. **第一步：QQ 音乐接入**
   - 原因：库成熟、扫码方式 3（MQTT 手机客户端）最稳定、风险可控
   - 工作量预估：中（需 Python↔Node 桥接或重写为 TS）
   - 关键决策：用 L-1124 起 Python 子进程 vs 用 [Rain120/qq-music-api](https://github.com/Rain120/qq-music-api)（TS 但无扫码）

2. **第二步：汽水音乐接入（视 QQ 接入效果决定）**
   - 前置：先实测 `/luna/pc/me/collection/media` 能否查询收藏列表
   - 参考：直接移植 Mineradio-Tauri 的 `soda-qr-login.ts` + `soda-client.ts`
   - 工作量预估：中高（需处理 sessionData 失效 + 可能的 x-helios 签名）

### 4.3 替代建议

- 若 QQ 音乐接入受阻,建议用户用网易云歌单迁移工具（如 [FearfulTomcat27/PlayListConverter](https://github.com/FearfulTomcat27/PlayListConverter)）把 QQ 收藏搬到网易云再导入
- 若汽水音乐接入受阻,同理建议迁移到网易云
- 这两条替代路径**规避了法律风险**,但牺牲了平台原生体验

### 4.4 关键待验证项

接入前建议先做以下验证（不在本调研范围）：

1. **QQ 音乐**：L-1124 的方式 C（MQTT 扫码）在当前网络环境是否可达 `mu.y.qq.com:443/ws/handshake`
2. **汽水音乐**：`/luna/pc/me/collection/media` 的 GET 行为能否返回收藏列表（非 POST 操作）
3. **两个平台**：播放 URL 的实际有效期（决定刷新策略）

---

## 五、证据索引

### QQ 音乐
- 主仓库：https://github.com/L-1124/QQMusicApi（425★, 2026-07-25, GPL v3, Python）
- 扫码登录源码：`qqmusic_api/modules/login.py`（27.5KB,3 种方式完整实现）
- 凭证文档：`docs/tutorial/credential.md`
- 用户歌单：`qqmusic_api/modules/user.py`（17KB）
- 播放 URL：`qqmusic_api/modules/song.py`（16KB,50+ 音质类型）
- 备选：https://github.com/jsososo/QQMusicApi（1602★, 停更 4 年, 仅 cookie 模式）

### 汽水音乐
- 主参考实现：https://github.com/zzstar101/Mineradio-Tauri（TypeScript, 2026-07 活跃）
- 扫码登录源码：`sidecars/api/src/services/soda-qr-login.ts`
- API 客户端：`sidecars/api/src/providers/soda/soda-client.ts`
- 音频解密器：[520Qiuyu/qishuiMusicAnalysis](https://github.com/520Qiuyu/qishuiMusicAnalysis) `src/utils/sodaDecryptor.ts`
- 关键 issue：https://github.com/XxHuberrr/Mineradio/issues/323（sessionData 失效）
- 关键 issue：https://github.com/zzstar101/Mineradio-Tauri/issues/13（逆向方案 completed）

### 通用
- 字节 Passport 统一登录：`/passport/web/get_qrcode` + `/passport/web/check_qrconnect`
- QQ 互联扫码：`ssl.ptlogin2.qq.com/ptqrshow` + `ssl.ptlogin2.qq.com/ptqrlogin`

---

## 六、调研局限说明

1. **未实测**：本调研基于静态代码分析,未实际运行验证 API 可达性
2. **汽水音乐官方开放平台**：环境限制未能在线核验字节开放平台官网,基于 GitHub 无任何引用推断无公开 API
3. **"最近听过"**：QQ 音乐和汽水音乐的第三方库中均未找到,但不排除 App 内部有此 API
4. **有效期数字**：QQ 音乐 musickey 的 90 天有效期来自 jsososo 代码注释推断,实际由服务端控制
5. **Mineradio-Tauri 的 star 数**：本次未获取到该仓库的 star 数指标
