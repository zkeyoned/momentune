# 扩充说唱组标签体系 Spec

## Why

用户反馈"汽水音乐通过抖音特别了解我，推的歌很符合"，但 Momentune 现有说唱组只有 `rap`/`trap`/`drill` 三个标签。调研发现：汽水/抖音生态中真正活跃的旋律说唱、国风说唱、emo rap、pluggnb、jersey club、memphis rap 全部缺位，导致推荐结果无法匹配用户在抖音实际听到的说唱子风格。同时现有 `emo` 标签在 rock_indie 组（Midwest Emo 复兴），与 emo rap 是两码事，存在混淆风险。

## What Changes

### 新增 8 个说唱子流派标签（GENRE_TAGS 说唱组 3→11）

| 标签 | label | desc | hot | 分组 | 依据 |
|---|---|---|---|---|---|
| `melodicrap` | 旋律说唱 | Drake/Post Malone系旋律化说唱 | 5 | rap | 中文说唱上抖音热歌榜的默认形态 |
| `guofengrap` | 国风说唱 | 说唱beat×民乐/戏腔 | 5 | rap | 抖音国风BGM核心赛道，《青衫渡》年度亚军 |
| `emorap` | 情绪说唱 | Lil Peep/Juice WRLD系抑郁旋律 | 4 | rap | Z世代情绪刚需，汽水说唱歌单常客 |
| `pluggnb` | Pluggnb | plugg×R&B融合，G-Funk合成器 | 5 | rap | Splice 2025增长最快流派，K-pop主流化 |
| `jerseyclub` | Jersey Club | 128bpm breakbeat+切碎采样 | 4 | electronic | Splice 2025三大增长流派，抖音BGM现象级 |
| `memphis` | 孟菲斯说唱 | 808+牛铃+恐怖采样，phonk源头 | 4 | rap | 抖音"土哥们/揽佬"生态，drift phonk源头 |
| `rage` | Rage | Opium系暗黑失真陷阱 | 4 | rap | 视觉系/变装向抖音易传播 |
| `newwave` | 新浪潮 | 新说唱2025主推概念 | 4 | rap | 综艺IP联动曝光足 |

> `jerseyclub` 放 electronic 组（音乐本质是 breakbeat 舞曲），其余 7 个放 rap 组。

### 新增 1 个摇滚标签

| 标签 | label | desc | hot | 分组 | 依据 |
|---|---|---|---|---|---|
| `postrock` | 后摇 | 器乐层叠叙事，荒原/公路感 | 3 | rock_indie | QQ/网易云双平台标签，照片配乐刚需 |

### 同步更新 GENRE_KEYWORD_MAPPING

为每个新标签添加关键词映射条目，注意顺序（子流派在前，避免被父流派抢匹配）：
- `emorap` 必须在 `rap` 之前（因 rap 关键词含 'emo'）
- `pluggnb` 必须在 `rap` 之前
- `memphis` 必须在 `phonk` 和 `rap` 之前
- `jerseyclub` 必须在 `electronic` 之前
- `melodicrap` / `guofengrap` / `rage` / `newwave` / `postrock` 按现有顺序规则插入

### 同步扩展 GENRE_AFFINITY 矩阵

从 60×60 扩展到 69×69，新增 9 行 9 列。关键亲和度设计：
- `melodicrap` ↔ rap=0.9, rnb=0.7, trap=0.6
- `guofengrap` ↔ guofeng=0.9, rap=0.8, xiqiang=0.7
- `emorap` ↔ rap=0.8, emo=0.5, lofi=0.5, trap=0.6
- `pluggnb` ↔ rap=0.8, rnb=0.8, trap=0.7
- `jerseyclub` ↔ electronic=0.7, house=0.6, edm=0.6
- `memphis` ↔ rap=0.8, phonk=0.9, driftphonk=0.8, trap=0.7
- `rage` ↔ rap=0.7, trap=0.7, phonk=0.5
- `newwave` ↔ rap=0.8, pop=0.5, trap=0.5
- `postrock` ↔ rock=0.8, ambient=0.6, shoegaze=0.7

### 同步更新 GENRE_DISPLAY_META

为 9 个新标签各添加一条 display meta（label/group/desc/hot）。

### 校准现有标签 hot 评分（P0，零风险）

| 标签 | 当前 hot | 新 hot | 依据 |
|---|---|---|---|
| phonk | 5 | 3 | 爆发期过，转存量BGM |
| driftphonk | 5 | 3 | 同上 |
| hyperpop | 4 | 3 | 狭义场景退潮，美学被吸收 |
| hardwave | 4 | 2 | 2026讨论度归零 |
| poppunk | 4 | 2 | MGK时代复兴峰值已过 |
| emo | 4 | 3 | 略高于poppunk |
| drill | 4 | 2 | UK drill峰值过，中文drill稀缺 |
| citypop | 4 | 3 | 内化为复古流行底色 |
| bedroompop | 4 | 3 | 媒体用过去时描述 |
| ukgarage | 3 | 4 | Billboard 2025舞曲年榜多首入选 |
| xiqiang | 4 | 5 | 全平台320亿播放，抖音年度亚军 |

## Impact

- Affected specs: 无（这是首个针对标签体系的 spec）
- Affected code:
  - `src/algorithm/types.ts`：GENRE_TAGS 数组（+9）、GENRE_DISPLAY_META（+9 条 + 11 条 hot 修改）、GENRE_GROUPS（说唱组标签数变化）
  - `src/algorithm/config/genreTags.ts`：GENRE_KEYWORD_MAPPING（+9 条目）、GENRE_AFFINITY（60×60→69×69）
  - `src/algorithm/__tests__/genreTags.test.ts`：**不允许修改**（硬约束），需确认现有测试仍通过
- 不修改 `src/algorithm/match.ts` / `preference.ts`（算法逻辑不变，只是标签池扩充）

## ADDED Requirements

### Requirement: 说唱组子流派标签扩充

系统 SHALL 在 GENRE_TAGS 的说唱组中新增 8 个子流派标签（melodicrap/guofengrap/emorap/pluggnb/jerseyclub/memphis/rage/newwave），覆盖汽水音乐/抖音生态中活跃但现有体系缺失的说唱子风格。

#### Scenario: 用户选择"说唱"偏好后推荐命中子风格
- **WHEN** 用户在 onboarding 选择"说唱"风格偏好
- **AND** 用户导入的红心歌包含 pluggnb 风格歌曲
- **THEN** 推荐结果应能匹配到 pluggnb 标签的歌曲
- **AND** 不应因缺少该标签而将 pluggnb 歌曲错误归入 rap 或 trap

#### Scenario: emo rap 与 rock emo 不混淆
- **WHEN** 歌曲原始标签含 "emo rap"
- **THEN** 应归一化到 `emorap`（说唱组）
- **AND** 不应归一化到 `emo`（摇滚组 Midwest Emo）

### Requirement: 后摇标签补全

系统 SHALL 在 GENRE_TAGS 的摇滚/独立组新增 `postrock` 标签，覆盖 QQ音乐和网易云音乐双平台均有的后摇分类。

#### Scenario: 荒原/公路照片推荐后摇配乐
- **WHEN** 用户上传荒原/公路类照片
- **AND** 照片情绪被分析为"倔强的孤独"
- **THEN** 推荐列表可包含 postrock 标签歌曲

### Requirement: hot 评分校准

系统 SHALL 根据 2026 年趋势验证结果，校准 11 个现有标签的 hot 评分，使其与当前实际热度一致。

#### Scenario: phonk 热度降级
- **WHEN** 前端按 hot 评分排序标签
- **THEN** phonk 和 driftphonk 的 hot 应为 3（而非 5）
- **AND** xiqiang 的 hot 应为 5（而非 4）

## MODIFIED Requirements

### Requirement: GENRE_KEYWORD_MAPPING 顺序

GENRE_KEYWORD_MAPPING 的关键词匹配顺序 SHALL 保证子流派在父流派之前匹配，新增标签的插入位置必须遵循此规则。具体新增顺序约束：
- `emorap` 在 `rap` 之前
- `pluggnb` 在 `rap` 之前
- `memphis` 在 `phonk` 和 `rap` 之前
- `jerseyclub` 在 `electronic` 之前
- `melodicrap` / `guofengrap` / `rage` / `newwave` / `postrock` 按各自冲突点插入

## REMOVED Requirements

无删除。
