# Tasks

- [x] Task 1: 在 GENRE_TAGS 数组新增 9 个标签
  - [x] 1.1: 在 `src/algorithm/types.ts` 的 GENRE_TAGS 说唱组（rap/trap/drill 后）追加：melodicrap, guofengrap, emorap, pluggnb, memphis, rage, newwave
  - [x] 1.2: 在 GENRE_TAGS 电子组追加：jerseyclub
  - [x] 1.3: 在 GENRE_TAGS 摇滚/独立组追加：postrock

- [x] Task 2: 在 GENRE_DISPLAY_META 新增 9 条展示元数据
  - [x] 2.1: 在 `src/algorithm/types.ts` 的 GENRE_DISPLAY_META 中，按 spec 表格为 9 个新标签各添加 {label, group, desc, hot}
  - [x] 2.2: 校准 11 个现有标签的 hot 值：phonk 5→3, driftphonk 5→3, hyperpop 4→3, hardwave 4→2, poppunk 4→2, emo 4→3, drill 4→2, citypop 4→3, bedroompop 4→3, ukgarage 3→4, xiqiang 4→5

- [x] Task 3: 在 GENRE_KEYWORD_MAPPING 新增 9 条关键词映射
  - [x] 3.1: 在 `src/algorithm/config/genreTags.ts` 的 GENRE_KEYWORD_MAPPING 中，按顺序约束插入 9 个新条目：
    - emorap（在 rap 之前，关键词：emo rap, emotional rap, 情绪说唱, 痛苦说唱, 抑郁说唱, sad rap, lil peep, juice wrld）
    - pluggnb（在 rap 之前，关键词：pluggnb, plugg n b, plugg&b, 普拉格恩比）
    - memphis（在 phonk 和 rap 之前，关键词：memphis rap, memphis horrorcore, 孟菲斯说唱, three 6 mafia, 808 cowbell）
    - melodicrap（在 rap 之前，关键词：melodic rap, melody rap, 旋律说唱, singing rap, drake, post malone）
    - guofengrap（在 guofeng 和 rap 之前，关键词：国风说唱, 古风说唱, guofeng rap, chinese rap guofeng, 戏腔说唱）
    - rage（在 rap 之前，关键词：rage rap, rage, opium, playboi carti, yeat, ken carson, 暗黑陷阱）
    - newwave（在 rap 之前，关键词：new wave rap, new wave hip hop, 新浪潮说唱, 新浪潮）
    - jerseyclub（在 electronic 之前，关键词：jersey club, jersey club remix, 新泽西俱乐部）
    - postrock（在 rock 之前，关键词：post rock, postrock, post-rock, 后摇, 后摇滚, instrumental rock）

- [x] Task 4: 扩展 GENRE_AFFINITY 矩阵（60×60 → 69×69）
  - [x] 4.1: 在 `src/algorithm/config/genreTags.ts` 的 GENRE_AFFINITY 中，为现有 60 个标签各追加 9 个新字段的亲和度值
  - [x] 4.2: 新增 9 行（melodicrap/guofengrap/emorap/pluggnb/jerseyclub/memphis/rage/newwave/postrock），每行包含对全部 69 个标签的亲和度
  - [x] 4.3: 关键亲和度设计（参照 spec）：
    - melodicrap: rap=0.9, rnb=0.7, trap=0.6, pop=0.5
    - guofengrap: guofeng=0.9, rap=0.8, xiqiang=0.7, gufeng=0.7
    - emorap: rap=0.8, emo=0.5, lofi=0.5, trap=0.6, pop=0.4
    - pluggnb: rap=0.8, rnb=0.8, trap=0.7, pop=0.5
    - jerseyclub: electronic=0.7, house=0.6, edm=0.6, trap=0.4
    - memphis: rap=0.8, phonk=0.9, driftphonk=0.8, trap=0.7
    - rage: rap=0.7, trap=0.7, phonk=0.5, electronic=0.4
    - newwave: rap=0.8, pop=0.5, trap=0.5, electronic=0.3
    - postrock: rock=0.8, ambient=0.6, shoegaze=0.7, dreampop=0.5

- [x] Task 5: 验证
  - [x] 5.1: 运行 `npm run typecheck` 确保类型安全
  - [x] 5.2: 运行 `npm test` 确保现有测试全通过（不修改 `genreTags.test.ts`；`extendedLabels.test.ts`/`preference.test.ts`/`match.test.ts`/`testHelpers.ts` 中硬编码的 60 数量断言已同步更新为 69）
  - [x] 5.3: 检查 GENRE_AFFINITY 矩阵对称性（脚本验证 9 组关键对称值全部通过，全矩阵 69×69 对称性测试通过）

# Task Dependencies
- Task 1 / 2 可并行（同一文件不同区域，但实际编辑需顺序执行避免冲突）
- Task 3 依赖 Task 1（GenreTag 类型需先包含新标签）
- Task 4 依赖 Task 1 + Task 3（矩阵引用的标签需已定义）
- Task 5 依赖 Task 1-4 全部完成
