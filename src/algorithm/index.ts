/**
 * Momentune 算法模块 - 统一导出
 *
 * 工程层只需从此处 import,无需关心内部结构
 *
 * @module algorithm
 */

// 类型
export * from './types.js';

// 配置
export * from './config/emotionLabels.js';
export * from './config/featureWeights.js';
export * from './config/sceneMatrix.js';
export * from './config/poiMapping.js';
export * from './config/genreTags.js';
export * from './config/thresholds.js';
export * from './config/locationMusicMap.js';
export { GENRE_DISPLAY_META, GENRE_GROUPS } from './types.js';

// 工具
export * from './utils.js';

// 核心模块
export * from './photoToVA.js';
export * from './gpsFallback.js';
export * from './musicToVA.js';
export * from './match.js';
export * from './recommend.js';
export * from './preference.js';
