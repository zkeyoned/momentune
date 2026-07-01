/**
 * POI 类型码 → 场景标签 + V-A 坐标映射
 *
 * 基于高德地图 POI 分类体系(GB/T 35652-2017)
 * 主用高德,降级腾讯,海外用 OSM
 *
 * @module algorithm/config/poiMapping
 */

import type { SceneType, VACoordinate } from '../types.js';

/** POI 映射条目 */
export interface POIMappingEntry {
  /** 高德类型码前缀或关键词 */
  match: string[];
  /** 映射到的场景类型 */
  scene: SceneType;
  /** 衍生场景标签(用于歌曲场景匹配) */
  songSceneTag?: string;
  /** GPS 给出的 V-A 坐标 */
  va: VACoordinate;
  /** 映射置信度 */
  confidence: number;
  /** 说明 */
  reason: string;
}

/**
 * 高德 POI 类型码 → 场景映射表
 * 类型码参考:https://lbs.amap.com/api/webservice/guide/api/search
 */
export const POI_MAPPING_TABLE: ReadonlyArray<POIMappingEntry> = [
  {
    // 注意:'广场'已移除 — 该词有歧义(天安门广场=景区,万达广场=商场)。
    // 商场类POI名称常含'广场',会导致误匹配到 nature。
    // 景区/公园通过 typeCode(110000/110100)、'风景名胜'、'公园' 即可覆盖。
    match: ['110000', '110100', '风景名胜', '公园'],
    scene: 'nature',
    songSceneTag: 'travel',
    va: { v: 0.55, a: 0.30 },
    confidence: 0.85,
    reason: '景区/公园 → 自然风光/旅游',
  },
  {
    match: ['060000', '060100', '商场', '商圈', '购物'],
    scene: 'city',
    songSceneTag: 'city_night',
    va: { v: 0.55, a: 0.60 },
    confidence: 0.85,
    reason: '商圈 → 城市街景',
  },
  {
    match: ['050500', '咖啡', '书店', '050300', '餐饮', '茶馆'],
    scene: 'indoor',
    songSceneTag: 'cafe_afternoon',
    va: { v: 0.58, a: 0.32 },
    confidence: 0.80,
    reason: '咖啡店/书店 → 室内休闲',
  },
  {
    match: ['海滨', '沙滩', '海', '湖', '水库'],
    scene: 'nature',
    songSceneTag: 'seaside_dusk',
    va: { v: 0.55, a: 0.28 },
    confidence: 0.85,
    reason: '海边/水域 → 自然风光',
  },
  {
    match: ['山', '山区', '峰', '岭'],
    scene: 'nature',
    songSceneTag: 'morning_sunrise',
    va: { v: 0.58, a: 0.35 },
    confidence: 0.80,
    reason: '山区 → 自然风光/日出',
  },
  {
    match: ['141200', '大学', '学院', '高校', '校园'],
    scene: 'city',
    songSceneTag: 'campus',
    va: { v: 0.62, a: 0.50 },
    confidence: 0.85,
    reason: '大学城 → 校园',
  },
  {
    match: ['150400', '机场', '航站楼'],
    scene: 'city',
    songSceneTag: 'travel',
    va: { v: 0.45, a: 0.55 },
    confidence: 0.85,
    reason: '机场 → 旅行/离别',
  },
  {
    match: ['150500', '火车站', '高铁', '动车', '地铁'],
    scene: 'city',
    songSceneTag: 'travel',
    va: { v: 0.45, a: 0.55 },
    confidence: 0.85,
    reason: '火车站 → 旅行/离别',
  },
  {
    match: ['150700', '加油站', '服务区', '高速'],
    scene: 'nature',
    songSceneTag: 'road_trip',
    va: { v: 0.55, a: 0.60 },
    confidence: 0.75,
    reason: '公路服务区 → 公路旅行',
  },
  {
    match: ['090000', '医院', '住院'],
    scene: 'indoor',
    songSceneTag: 'late_night_emo',
    va: { v: 0.35, a: 0.30 },
    confidence: 0.70,
    reason: '医院 → 忧伤/治愈',
  },
  {
    match: ['120000', '住宅', '小区', '公寓', '宿舍'],
    scene: 'indoor',
    songSceneTag: 'late_night_emo',
    va: { v: 0.28, a: 0.40 },
    confidence: 0.65,
    reason: '住宅区(深夜)→ 孤独',
  },
  {
    match: ['130000', '文化', '博物馆', '美术馆', '剧院'],
    scene: 'heritage',
    songSceneTag: 'guofeng',
    va: { v: 0.45, a: 0.35 },
    confidence: 0.80,
    reason: '文化场馆 → 古迹/人文',
  },
  {
    match: ['140400', '古迹', '文物', '遗址', '寺', '庙', '教堂'],
    scene: 'heritage',
    songSceneTag: 'guofeng',
    va: { v: 0.45, a: 0.35 },
    confidence: 0.85,
    reason: '古迹/宗教 → 文化',
  },
] as const;

/** 无法识别 POI 时的默认 V-A(不修改视觉结果) */
export const POI_UNKNOWN_VA: VACoordinate = { v: 0.50, a: 0.40 };

/** 查找 POI 类型码/名称对应的映射 */
export function findPOIMapping(
  typeCode: string,
  name: string,
  category: string,
): POIMappingEntry | null {
  const haystack = `${typeCode} ${name} ${category}`;
  for (const entry of POI_MAPPING_TABLE) {
    for (const keyword of entry.match) {
      if (haystack.includes(keyword)) {
        return entry;
      }
    }
  }
  return null;
}
