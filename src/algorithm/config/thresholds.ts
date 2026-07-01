/**
 * 算法阈值集中管理
 *
 * 设计原则:所有可调参数集中在此文件,函数中不硬编码
 * 调参时只改此文件,无需改动算法逻辑
 *
 * @module algorithm/config/thresholds
 */

// ============================================================================
// 1. 照片→V-A 映射阈值
// ============================================================================

/** 色调 hue 区间边界(度) */
export const HUE_BOUNDARIES = {
  redOrange: [0, 30, 330, 360] as const, // 红/橙
  yellowGold: [30, 60] as const, // 黄/金
  pinkMagenta: [300, 330] as const, // 粉/品红
  blueCyan: [180, 270] as const, // 蓝/青
  purple: [270, 300] as const, // 紫
  green: [60, 180] as const, // 绿
} as const;

/** 灰阶判定阈值(饱和度低于此值视为灰阶) */
export const GRAYSCALE_SAT_THRESHOLD = 0.15;

/** 亮度分级阈值 */
export const LUMINANCE_THRESHOLDS = {
  high: 0.65, // > 0.65 高调
  low: 0.35, // < 0.35 低调
} as const;

/** 饱和度分级阈值 */
export const SATURATION_THRESHOLDS = {
  high: 0.55,
  low: 0.25,
} as const;

// ============================================================================
// 2. 混合情绪判定(关键补完)
// ============================================================================

/**
 * 混合情绪判定阈值
 *
 * 当照片 V-A 坐标距最近两标签都 < MIXED_EMOTION_RADIUS 时,
 * 判定为混合情绪,匹配时同时考虑两个标签的歌
 */
export const MIXED_EMOTION_RADIUS = 0.08;

/** 锚定到最近标签时,第二近标签的附加考虑距离 */
export const SECONDARY_LABEL_RADIUS = 0.15;

/**
 * 精确命中锚点阈值
 *
 * 当 V-A 坐标距最近标签 < 此值时,视为"就是该标签",
 * 即使附近有其他标签也不判为混合情绪。
 * 用于避免标签密度增加后,锚点本身被误判为混合。
 */
export const EXACT_ANCHOR_EPSILON = 0.005;

// ============================================================================
// 3. GPS 辅助阈值
// ============================================================================

/** 视觉置信度阈值:高于此值直接用视觉结果 */
export const VISUAL_CONFIDENCE_HIGH = 0.8;

/** 视觉置信度阈值:低于此值且无 GPS 时走兜底 */
export const VISUAL_CONFIDENCE_LOW = 0.5;

/** GPS 请求超时(ms) */
export const GPS_REQUEST_TIMEOUT = 800;

/** 深夜时段(22:00-05:00)对 V/A 的修正 */
export const LATE_NIGHT_ADJUSTMENT = {
  startHour: 22,
  endHour: 5,
  vDelta: -0.08, // V 减 0.08
  aDelta: -0.10, // A 减 0.10
} as const;

/** 冲突置信度阈值:低于此值走纯兜底(色调+时段+天气) */
export const CONFLICT_CONFIDENCE_LOW = 0.4;

// ============================================================================
// 4. 匹配算法阈值
// ============================================================================

/** V-A 距离的 V/A 权重(加权欧氏) */
export const VA_DISTANCE_WEIGHTS = {
  v: 0.6, // V 不匹配比 A 不匹配更难受
  a: 0.4,
} as const;

/** 主匹配各维度权重(加性策略,总和=1.0) */
export const MATCH_WEIGHTS = {
  scoreVA: 0.40, // V-A 距离(核心,从 0.45 让渡 0.05 给偏好)
  scoreScene: 0.15, // 场景标签(从 0.17 让渡 0.02 给偏好)
  scorePref: 0.25, // 用户偏好(从 0.15 提升到 0.25,用户选择更影响结果)
  scoreSceneFit: 0.08, // 场景适配(从 0.10 让渡 0.02 给偏好)
  scoreRefSim: 0.05, // 参考歌相似度
  scoreHot: 0.07, // 热歌度(从 0.08 微降)
} as const;

/** 场景适配度贝叶斯平滑系数 m(先验权重,越大越偏向先验) */
export const BAYESIAN_SMOOTHING_M = 5;

/** 热歌乘性 boost 上限 */
export const HOT_BOOST_MAX = 0.20; // 最多加 20%

/** 热歌新鲜度衰减系数(30 天半衰) */
export const HOT_RECENCY_DECAY_DAYS = 30;

/** 置信度惩罚阈值:低于此值的歌曲权重打折 */
export const VA_CONFIDENCE_PENALTY_THRESHOLD = 0.7;

/** 置信度惩罚公式系数 */
export const CONFIDENCE_PENALTY = {
  base: 0.7, // 0.7 + 0.3 × conf
  scale: 0.3,
} as const;

// ============================================================================
// 5. 两阶段推荐阈值
// ============================================================================

/** 阶段 1 候选池:V-A 距离上限 */
export const CANDIDATE_POOL_VA_DISTANCE = 0.45;

/** 阶段 1 候选池:冷门情绪放宽阈值 */
export const CANDIDATE_POOL_VA_DISTANCE_LOOSE = 0.60;

/** 阶段 1 候选池:最小规模(不足则放宽阈值) */
export const CANDIDATE_POOL_MIN_SIZE = 50;

/** 阶段 1 多样化:同歌手最多 */
export const CORE_MAX_SAME_ARTIST = 1;

/** 阶段 1 多样化:同情绪标签最多 */
export const CORE_MAX_SAME_LABEL = 2;

/** 阶段 1 热歌占比下限(8 首中至少 N 首) */
export const CORE_MIN_HOT_COUNT = 3;

/** 阶段 1 热歌占比上限(8 首中至多 N 首) */
export const CORE_MAX_HOT_COUNT = 6;

/** 阶段 1 兜底层最多 */
export const CORE_MAX_FALLBACK = 1;

/** 阶段 1 至少覆盖的不同情绪标签数 */
export const CORE_MIN_DISTINCT_LABELS = 3;

/** 探索曲位置(第 N 位,从 1 开始) */
export const EXPLORE_TRACK_POSITION = 6;

/** 探索概率 ε */
export const EXPLORE_EPSILON = 0.15;

// ============================================================================
// 6. 阶段 2 扩展阈值
// ============================================================================

/** 扩展相似度下限(低于此不扩展) */
export const EXTEND_SIM_THRESHOLD = 0.55;

/** 扩展 V-A 距离上限(比阶段 1 更严,防跑偏) */
export const EXTEND_VA_DISTANCE_MAX = 0.40;

/** 扩展相似度放宽阈值(数量不足时) */
export const EXTEND_SIM_THRESHOLD_LOOSE = 0.50;

/** 扩展 V-A 距离放宽阈值 */
export const EXTEND_VA_DISTANCE_LOOSE = 0.45;

/** 扩展曲 V-A 置信度下限 */
export const EXTEND_VA_CONFIDENCE_MIN = 0.6;

/** 同源扩展的 genre Jaccard 上限(防止同源扩展太雷同) */
export const EXTEND_SAME_SOURCE_GENRE_JACCARD_MAX = 0.5;

/** 全局同歌手上限(8 核心 + 扩展) */
export const GLOBAL_MAX_SAME_ARTIST = 2;

/** 全局同情绪标签上限 */
export const GLOBAL_MAX_SAME_LABEL = 3;

/** 扩展曲中热歌层占比下限 */
export const EXTEND_MIN_HOT_RATIO = 0.30;

/** 扩展曲中兜底层最多 */
export const EXTEND_MAX_FALLBACK = 2;

/** 扩展相似度权重(exp_score 中 sim 的权重) */
export const EXTEND_SCORE_SIM_WEIGHT = 0.70;

/** 扩展契合度权重(exp_score 中 photo 契合的权重) */
export const EXTEND_SCORE_PHOTO_WEIGHT = 0.30;

/** 核心曲扩展配额(按排名) */
export const EXTEND_QUOTA_BY_RANK: ReadonlyArray<number> = [2, 2, 2, 1, 1, 1, 1, 1]; // 合计 11

/** 最终总数下限 */
export const FINAL_TOTAL_MIN = 15;

/** 最终总数上限 */
export const FINAL_TOTAL_MAX = 20;

/** 默认目标总数(8 核心 + 10 扩展) */
export const FINAL_TOTAL_TARGET = 18;

// ============================================================================
// 7. 用户偏好阈值
// ============================================================================

/** 偏好中心初始融合权重(参考歌 vs 情绪偏好) */
export const PREF_CENTER_INIT_WEIGHTS = {
  reference: 0.5,
  mood: 0.5,
} as const;

/** 未选风格默认权重(保留探索) */
export const PREF_DEFAULT_GENRE_WEIGHT = 0.3;

/** 选中风格默认权重 */
export const PREF_SELECTED_GENRE_WEIGHT = 1.0;

/** "不限"风格的默认权重 */
export const PREF_ANY_GENRE_WEIGHT = 0.7;

/** EMA 学习率(权重更新) */
export const PREF_EMA_LAMBDA = 0.1;

/** 偏好中心漂移率 μ */
export const PREF_CENTER_DRIFT_MU = 0.05;

/** 信号强度系数 */
export const PREF_SIGNAL_STRENGTH = {
  skip: -1,
  complete: 0.3,
  loop: 1,
  save_diary: 1.5,
} as const;

/** 权重更新系数(按信号类型) */
export const PREF_UPDATE_RATES = {
  skip: 0.05, // α_skip
  complete: 0.03,
  loop: 0.10, // β_loop
  save_diary: 0.20, // γ_save
} as const;

/** 权重钳制范围 */
export const PREF_WEIGHT_CLAMP = {
  min: 0.1,
  max: 3.0,
} as const;

/** 冷启动期前 N 次推荐 */
export const COLD_START_INTERACTIONS = 5;

/** 冷启动期 score_pref 权重降为 */
export const COLD_START_PREF_WEIGHT = 0.08;

/** 冷启动期释放给 score_hot 的权重 */
export const COLD_START_HOT_WEIGHT_BOOST = 0.07;

/** 时段偏好显著阈值(某情绪占比超过此值则触发加成) */
export const HOURLY_EMOTION_BIAS_THRESHOLD = 0.60;

/** 时段情绪加成分值 */
export const HOURLY_EMOTION_BONUS = 0.10;

/** 时段偏好最少样本数(不足不统计) */
export const HOURLY_MIN_SAMPLES = 3;

// ============================================================================
// 8. 无标签歌曲估算阈值
// ============================================================================

/** 方法 A(音频回归)默认置信度 */
export const METHOD_A_CONFIDENCE = 0.9;

/** 方法 B(启发式公式)默认置信度 */
export const METHOD_B_CONFIDENCE = 0.7;

/** 方法 C(元数据关键词)默认置信度 */
export const METHOD_C_CONFIDENCE = 0.4;

/** BPM 归一化范围 */
export const TEMPO_NORM_RANGE = { min: 60, max: 180 } as const;

/** 响度归一化范围(dB) */
export const LOUDNESS_NORM_RANGE = { min: -30, max: 0 } as const;

/** 小调修正:V 降低 */
export const MINOR_KEY_V_PENALTY = 0.08;

/** 小调修正触发条件:valence > 此值 */
export const MINOR_KEY_PENALTY_THRESHOLD = 0.6;

/** 原声修正:A 降低 */
export const ACOUSTIC_A_PENALTY = 0.05;

/** 原声修正触发条件 */
export const ACOUSTIC_PENALTY_THRESHOLD = 0.7;

/** 启发式公式默认 V(无歌词时) */
export const HEURISTIC_DEFAULT_V = 0.50;

/** 启发式公式各项权重 */
export const HEURISTIC_V_WEIGHTS = {
  base: 0.50,
  mode: 0.25,
  centroid: 0.15,
  lyrics: 0.35,
} as const;

/** 启发式公式各项权重(A) */
export const HEURISTIC_A_WEIGHTS = {
  tempo: 0.50,
  rms: 0.30,
  loudness: 0.20,
} as const;
