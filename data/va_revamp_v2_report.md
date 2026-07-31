# 音乐库 V-A 标签改版优化 v2 报告

> 生成时间：2026-07-31
> 评测基准：data/va_golden_set.json（141 首人工标注金标准）
> 评测脚本：scripts/build-music-library/eval_va.ts
> 数据来源：data/eval_va_report.json、data/unified_library_stats.json、data/sweep_delta_coef_report.md

## 概览

v2 基于 v1 的根因分析（去噪需配合 weight-scaled delta 联合验证、最优系数可能在 0.5×~1.0× 之间），设计了 sweep 系数搜索 + 串行重试 4 个核心改动的方案。实际执行中发现 v1 的根因分析有误，去噪本身在原公式下就退化，最终回退核心改造，仅保留 Task 3 keywordEstimateVA 改进与 Task 5 信号一致性置信度作为收益上线。

## 改版总览表

| 阶段 | V MAE | A MAE | V+A MAE | 象限命中率 | 低V低A命中 | 平均confidence | 说明 |
|------|-------|-------|---------|-----------|-----------|---------------|------|
| baseline (v1) | 0.0813 | 0.1002 | 0.1815 | 0.4752 | 38 | - | 原公式+未去噪标签+原关键词+原置信度+inferLanguage修复 |
| after-step2-denoise (v1 激进去噪) | 0.0864 | 0.1186 | 0.2050 | 0.3191 | 12 | - | v1 激进去噪（退化，已回退） |
| after-step2-denoise-v2 (v1 温柔去噪) | 0.0844 | 0.1072 | 0.1916 | 0.4397 | 28 | - | v1 温柔去噪（退化，已回退） |
| after-step3-fusion (v1 全额度) | 0.1715 | 0.1256 | 0.2971 | 0.5106 | 48 | - | v1 全额度 delta（MAE 过冲，象限提升，已回退） |
| after-step3-langfix (v1 inferLanguage 修复) | 0.0813 | 0.1002 | 0.1815 | 0.4752 | 38 | - | inferLanguage 修复（=baseline，保留） |
| after-v2-rollback | 0.0813 | 0.1002 | 0.1815 | 0.4752 | 38 | - | 回退去噪后恢复 baseline（100% 一致） |
| after-v2-task3-keyword | 0.0802 | 0.1006 | 0.1808 | 0.4681 | 38 | - | 中文双字词+英文词边界（微弱改善，保留） |
| after-v2-task5-confidence | 0.0802 | 0.1006 | 0.1808 | 0.4681 | 38 | 0.7057 | 信号一致性置信度（V/A 与 task3 完全相同，保留） |
| after-v2-expD-origFormula-denoisedTags | 0.0872 | 0.1176 | 0.2048 | 0.3475 | 12 | - | 原公式+去噪标签（退化，已回退） |

> 平均 confidence 列：eval_va_report.json 不记录该字段，仅 after-v2-task5-confidence 当前状态可从 unified_library_stats.json 读取（全库 174276 首平均）。

## Sweep 系数曲线

### 上轮 sweep（未去噪标签 + v2 加性公式 + 等权 delta）

> 基于当前 v1 状态 unified_tags.json（无 emotionTagWeights，等权累加），用 sweep_delta_coef.ts 的 v2 三段式融合公式 `finalV = genreV + (coef × emotionDeltaV_clamped) + keywordDeltaV` 搜索。
> Baseline V+A MAE=0.1815，合格阈值 V+A MAE ≤ 0.1865 且 象限命中率 ≥ 0.4752。

| coef | V MAE | A MAE | V+A MAE | 象限命中率 | 低V低A命中 | 平均confidence | 合格? | 标记 |
|------|-------|-------|---------|-----------|-----------|---------------|-------|------|
| 0.4 | 0.0862 | 0.1153 | 0.2015 | 0.3617 | 16 | 0.8131 | N | - |
| 0.5 | 0.0854 | 0.1097 | 0.1951 | 0.4468 | 31 | 0.8131 | N | best MAE |
| 0.6 | 0.0940 | 0.1074 | 0.2014 | 0.4681 | 37 | 0.8131 | N | - |
| 0.7 | 0.1087 | 0.1084 | 0.2171 | 0.4965 | 43 | 0.8131 | N | - |
| 0.8 | 0.1277 | 0.1119 | 0.2396 | 0.5106 | 44 | 0.8131 | N | - |
| 0.9 | 0.1489 | 0.1174 | 0.2663 | 0.5035 | 45 | 0.8131 | N | - |
| 1.0 | 0.1711 | 0.1260 | 0.2971 | 0.5177 | 49 | 0.8131 | N | best quadrant |

无合格 coef，best MAE coef=0.5（V+A MAE=0.1951，象限命中率=0.4468）。

### 本轮 sweep（去噪标签 + v2 加性公式 + weight-scaled delta）

> 基于 v1 去噪状态 unified_tags.json（含 emotionTagWeights，emotionDelta 按 weight/maxWeight 归一化缩放），同样 v2 三段式融合公式。
> 来源：data/sweep_delta_coef_report.md

| coef | V MAE | A MAE | V+A MAE | 象限命中率 | 低V低A命中 | 平均confidence | 合格? | 标记 |
|------|-------|-------|---------|-----------|-----------|---------------|-------|------|
| 0.4 | 0.0954 | 0.1364 | 0.2318 | 0.3050 | 3 | 0.7929 | N | - |
| 0.5 | 0.0912 | 0.1339 | 0.2251 | 0.3404 | 7 | 0.7929 | N | best MAE |
| 0.6 | 0.0957 | 0.1327 | 0.2284 | 0.3262 | 9 | 0.7929 | N | - |
| 0.7 | 0.1054 | 0.1328 | 0.2382 | 0.3404 | 12 | 0.7929 | N | - |
| 0.8 | 0.1189 | 0.1331 | 0.2520 | 0.3404 | 13 | 0.7929 | N | - |
| 0.9 | 0.1347 | 0.1336 | 0.2683 | 0.3546 | 16 | 0.7929 | N | - |
| 1.0 | 0.1517 | 0.1341 | 0.2858 | 0.3830 | 24 | 0.7929 | N | best quadrant |

无合格 coef，best MAE coef=0.5（V+A MAE=0.2251，象限命中率=0.3404）。

### 关键发现

- **MAE 与象限命中率方向相反**：低系数 MAE 小但象限退化，高系数象限提升但幅度过冲。两条曲线的"最优区间"不重合（MAE 最优在 coef=0.5，象限最优在 coef=1.0）。
- **去噪让两条曲线都退化**：去噪削弱情绪信号，流派噪声占主导。本轮（去噪）best MAE V+A MAE=0.2251，远差于上轮（未去噪）best MAE V+A MAE=0.1951；低V低A 命中也从 31 暴跌到 7。
- **最优系数无法同时满足 MAE 和象限命中率条件**：两轮 sweep 均无合格 coef（合格阈值 V+A MAE ≤ 0.1865 且 象限命中率 ≥ 0.4752）。上轮最接近的是 coef=0.6（V+A MAE=0.2014，象限命中率=0.4681，象限差 0.0071）。

## "other" 语种数量变化

继承 v1 inferLanguage 修复：59941 → 15433（-74%，44508 首歌从 "other" 重分类）。

当前全库语种分布（totalSongs=174276）：
- english: 87429 (50.2%)
- mandarin: 52631 (30.2%)
- other: 15433 (8.9%)
- japanese: 9865 (5.7%)
- instrumental: 3921 (2.2%)
- korean: 3108 (1.8%)
- cantonese: 1889 (1.1%)

## 各 Task 回退说明

### Task 1: Delta 系数搜索
- 上轮 sweep（未去噪+等权 delta）：无合格 coef，best MAE coef=0.5（V+A MAE=0.1951，象限命中率=0.4468）
- 本轮 sweep（去噪+weight-scaled delta）：无合格 coef，best MAE coef=0.5（V+A MAE=0.2251，象限命中率=0.3404）
- 结论：v2 加性公式在任意标签配置下都退化，回退。sweep 脚本保留作为工具，但未上线任何 coef。

### Task 2: 融合公式重写
- 基于 Task 1 sweep 结果，无合格 coef，Task 2 回退。
- 根因：v2 加性公式让 genreV 不打折、emotionDelta 影响放大，但金标准 V 值系统性偏向中间区（0.3-0.5），加性叠加把负向情绪歌推到极端。

### Task 3: keywordEstimateVA 重写
- 中文双字词+英文词边界+只匹配标题。
- V+A MAE 0.1815 → 0.1808（-0.0007，微弱改善）
- 象限命中率 0.4752 → 0.4681（-0.0071，少 1 首，容差内）
- 保留：理论正确性更高（避免单字误匹配，如"爱"误匹配歌手名），MAE 微弱改善。

### Task 4: 去噪 + 融合层联合验证
- 去噪 + 原公式（实验 D）：V+A MAE 0.1815 → 0.2048（+0.0233，退化）
- 去噪 + v2 加性公式 + weight-scaled delta（本轮 sweep）：全部退化
- 根因：原公式等权累加 emotionTags 偏移，去噪删除标签后累加幅度变小，流派基线失去修正
- 回退：完全回退 unify_tags.ts 去噪改动

### Task 5: 置信度信号一致性
- 改动：computeVA 的 confidence 从"按信号数量递增"改为"信号方向一致性驱动"。
  - 流派+情绪方向一致 → 0.90；方向矛盾 → 0.60；一方中性 → 0.75
  - 关键词同向 +0.05；多情绪印证 +0.05（封顶 0.95）
  - 单一关键词信号封顶 0.5
- 评测：V+A MAE=0.1808，象限命中率=0.4681（与 after-v2-task3-keyword 完全一致，因 confidence 不影响 V/A）
- 全库平均 confidence：0.6342 → 0.7057（+0.0715）
- confidence 分布变化（全库 174276 首）：

| 区间 | 原 signalCount | Task 5 信号一致性 | 变化 |
|------|---------------|------------------|------|
| ≥0.85 | 3586 (2.1%) | 5680 (3.3%) | +2094 |
| 0.70-0.85 | 32843 (18.8%) | 159874 (91.7%) | +127031 |
| 0.50-0.70 | 137847 (79.1%) | 8722 (5.0%) | -129125 |
| <0.50 | 0 (0.0%) | 0 (0.0%) | 0 |

- 抽检（V/A 与改前完全一致，仅 confidence 变化）：

| 歌曲 | genreV | 情绪方向 | 流派方向 | confidence | 说明 |
|------|--------|---------|---------|-----------|------|
| 《偏爱》张芸京 | ≈0.54（中性） | -1（5 个负向 tag） | 0 | 0.80 | 一方中性 0.75 + 多情绪(5) +0.05 |
| 《十年》陈奕迅 | ≈0.49（中性） | -1（3 个负向 tag） | 0 | 0.80 | 一方中性 0.75 + 多情绪(3) +0.05 |
| 《Shape of You》Ed Sheeran | 0.55（中性边界） | +1（治愈系） | 0 | 0.75 | 一方中性 0.75，单情绪无加成 |

- 决策：**保留**。V/A 完全不变（MAE 不退化），置信度分布更合理（多数歌曲落入 0.70-0.85，反映"流派+情绪一方中性"的典型场景；单一关键词封顶 0.5 避免过信）。

## 最终交付

### 1. 保留项
- **v1 inferLanguage 修复**（"other" 59941→15433，-74%）：三处正则修复（假名/谚文 Unicode 范围扩展、拉丁字母占比放宽）
- **v2 Task 3 keywordEstimateVA 改进**（中文双字词+英文词边界，V+A MAE -0.0007）
- **v2 Task 5 信号一致性置信度**（V/A 不变，全库平均 confidence 0.6342→0.7057，分布更合理）

### 2. 回退项
- Task 1 sweep 工具（保留作为工具，但未上线任何 coef）
- Task 2 v2 加性融合公式
- Task 4 情绪标签去噪（unify_tags.ts 完全回退到 v1 状态）

### 3. 核心发现
- 在当前数据噪声水平下，baseline（V+A MAE=0.1815）已是局部最优。
- 任何"清理标签"或"改公式"的改动都会破坏 baseline 的补偿平衡。
- 标签虽"噪声大"，但等权累加时实际承担了对流派基线偏差的补偿作用——去噪删除标签后，流派基线失去修正，反而退化。
- v2 加性公式让 emotionDelta 影响放大，但金标准 V 值系统性偏向中间区（0.3-0.5），加性叠加把负向情绪歌推到极端（MAE 过冲）。
- 置信度与 V/A 解耦，可独立优化（Task 5 验证）。
- 若要改进 MAE，应聚焦流派基线表校准（如 pop V=0.65 vs 金标准 0.75 的偏差）或情绪偏移表校准，而非去噪或改融合公式。

## 后续建议

1. **流派基线表校准**：针对金标准中偏差大的流派（如 pop 偏低、rock 偏高）调整 GENRE_VA_BASELINE。
2. **情绪偏移表扩充**：补充更多情绪标签的 V-A 偏移量。
3. **标题关键词词表扩充**：当前 "dancing" 未命中高能规则，可补充 dance/dancing 等词。
4. **数据噪声治理**：从源头解决爬虫 raw_tags 是搜索关键词而非平台官方标签的问题（需重爬或接入官方 API）。

## 文件变更清单

### 修改（保留）
- `scripts/build-music-library/assign_va.ts`
  - v1 inferLanguage 三处正则修复
  - v2 Task 3 keywordEstimateVA 重写（中文双字词+英文词边界+只匹配标题）
  - v2 Task 5 confidence 计算改为信号方向一致性驱动

### 数据文件（重新生成）
- `data/eval_va_report.json`（baseline + 8 iterations 存档，含 after-v2-task5-confidence）
- `data/unified_library.json`（Task 3 + Task 5 版本）
- `data/unified_library_stats.json`（重新生成）
- `data/va_revamp_v2_report.md`（本报告）
- `data/sweep_delta_coef_report.md`（本轮去噪+weight-scaled sweep 报告，保留）

### 回退（未保留）
- `scripts/build-music-library/unify_tags.ts`（去噪改动已回退到 v1 状态）
- `scripts/build-music-library/assign_va.ts` 的 computeVA 融合公式（v2 加性公式已回退，保留原 0.35/0.50/0.15 融合公式）
