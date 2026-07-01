/**
 * poiMapping.ts 单元测试(P1-7)
 *
 * 覆盖:POI_MAPPING_TABLE 完整性、findPOIMapping 关键词匹配(含 typeCode/name/category 三字段)、
 *       POI_UNKNOWN_VA 默认值、buildGPSReverseResult 通过 poiMapping 的端到端构建
 *
 * @module algorithm/__tests__/poiMapping.test
 */

import { describe, it, expect } from 'vitest';
import {
  POI_MAPPING_TABLE,
  POI_UNKNOWN_VA,
  findPOIMapping,
} from '../config/poiMapping.js';
import { buildGPSReverseResult } from '../gpsFallback.js';
import type { GPSCoordinate, POIInfo } from '../types.js';

// ============================================================================
// 辅助函数
// ============================================================================

function makeCoord(lat = 39.9, lng = 116.4): GPSCoordinate {
  return { lat, lng, accuracy: 10 };
}

function makePOI(overrides: Partial<POIInfo> = {}): POIInfo {
  return {
    name: '故宫博物院',
    typeCode: '140400',
    category: '风景名胜',
    district: '北京市东城区',
    ...overrides,
  };
}

// ============================================================================
// 1. POI_MAPPING_TABLE 完整性
// ============================================================================

describe('POI_MAPPING_TABLE 完整性', () => {
  it('映射表非空(≥ 10 条)', () => {
    expect(POI_MAPPING_TABLE.length).toBeGreaterThanOrEqual(10);
  });

  it('每条映射都有 match/scene/va/confidence/reason', () => {
    for (const entry of POI_MAPPING_TABLE) {
      expect(entry.match.length).toBeGreaterThan(0);
      expect(entry.scene).toBeTruthy();
      expect(entry.va).toBeDefined();
      expect(entry.confidence).toBeGreaterThan(0);
      expect(entry.confidence).toBeLessThanOrEqual(1);
      expect(entry.va.v).toBeGreaterThanOrEqual(0);
      expect(entry.va.v).toBeLessThanOrEqual(1);
      expect(entry.va.a).toBeGreaterThanOrEqual(0);
      expect(entry.va.a).toBeLessThanOrEqual(1);
    }
  });

  it('match 关键词不重复(同一条目内)', () => {
    for (const entry of POI_MAPPING_TABLE) {
      const unique = new Set(entry.match);
      expect(unique.size).toBe(entry.match.length);
    }
  });
});

// ============================================================================
// 2. findPOIMapping 关键词匹配
// ============================================================================

describe('findPOIMapping 关键词匹配', () => {
  it('typeCode 匹配:140400 → heritage', () => {
    const result = findPOIMapping('140400', '故宫', '古迹');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('heritage');
  });

  it('name 匹配:咖啡 → indoor', () => {
    const result = findPOIMapping('000000', '星巴克咖啡店', '餐饮');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('indoor');
  });

  it('category 匹配:风景名胜 → nature', () => {
    const result = findPOIMapping('110000', '北海公园', '风景名胜');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('nature');
  });

  it('商场匹配 → city', () => {
    const result = findPOIMapping('060100', '万达广场', '商场');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('city');
  });

  it('海滨/沙滩 → nature + seaside_dusk', () => {
    const result = findPOIMapping('000', '三亚海滨沙滩', '其他');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('nature');
    expect(result!.songSceneTag).toBe('seaside_dusk');
  });

  it('大学/学院 → city + campus', () => {
    const result = findPOIMapping('141200', '清华大学', '大学');
    expect(result).not.toBeNull();
    expect(result!.songSceneTag).toBe('campus');
  });

  it('机场 → city + travel', () => {
    const result = findPOIMapping('150400', '首都机场航站楼', '交通');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('city');
    expect(result!.songSceneTag).toBe('travel');
  });

  it('火车站/高铁 → city + travel', () => {
    const result = findPOIMapping('150500', '北京南站', '火车站');
    expect(result).not.toBeNull();
    expect(result!.songSceneTag).toBe('travel');
  });

  it('加油/高速服务区 → nature + road_trip', () => {
    const result = findPOIMapping('150700', '京沪高速服务区加油站', '交通');
    expect(result).not.toBeNull();
    expect(result!.songSceneTag).toBe('road_trip');
  });

  it('医院 → indoor + late_night_emo', () => {
    const result = findPOIMapping('090000', '协和医院住院部', '医院');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('indoor');
    expect(result!.songSceneTag).toBe('late_night_emo');
  });

  it('博物馆 → heritage + guofeng', () => {
    const result = findPOIMapping('130000', '国家博物馆', '文化');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('heritage');
    expect(result!.songSceneTag).toBe('guofeng');
  });

  it('寺/庙/教堂 → heritage + guofeng', () => {
    const result = findPOIMapping('140400', '雍和宫', '宗教');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('heritage');
  });

  it('无任何关键词命中 → null', () => {
    const result = findPOIMapping('999999', '完全未知的地方', '不存在分类');
    expect(result).toBeNull();
  });

  it('空字符串 → null', () => {
    const result = findPOIMapping('', '', '');
    expect(result).toBeNull();
  });

  it('匹配优先级:typeCode 命中返回对应条目', () => {
    // typeCode=140400 是古迹的强信号,name 含'古迹'也命中 heritage 条目
    // 注意:category 应为'古迹'而非'风景名胜'(后者会先命中 nature 条目)
    const result = findPOIMapping('140400', '故宫古迹', '古迹');
    expect(result).not.toBeNull();
    expect(result!.scene).toBe('heritage');
  });
});

// ============================================================================
// 3. POI_UNKNOWN_VA 默认值
// ============================================================================

describe('POI_UNKNOWN_VA 默认值', () => {
  it('默认 V/A = 0.50/0.40(中性,不偏移视觉结果)', () => {
    expect(POI_UNKNOWN_VA.v).toBe(0.50);
    expect(POI_UNKNOWN_VA.a).toBe(0.40);
  });
});

// ============================================================================
// 4. buildGPSReverseResult 端到端(通过 poiMapping)
// ============================================================================

describe('buildGPSReverseResult 端到端', () => {
  it('匹配 POI(古迹) → 返回映射场景+V-A+置信度', () => {
    const coord = makeCoord();
    const poi = makePOI({ typeCode: '140400', name: '故宫', category: '古迹' });
    const result = buildGPSReverseResult(coord, poi, 'amap');
    expect(result.coordinate).toBe(coord);
    expect(result.poi).toBe(poi);
    expect(result.provider).toBe('amap');
    expect(result.mappedScene).toBe('heritage');
    expect(result.mappedVA).toBeDefined();
    expect(result.mappedVA!.v).toBe(0.45);
    expect(result.mappedVA!.a).toBe(0.35);
    expect(result.confidence).toBe(0.85);
  });

  it('匹配 POI(咖啡店) → indoor 场景', () => {
    const result = buildGPSReverseResult(
      makeCoord(),
      makePOI({ typeCode: '050500', name: '星巴克', category: '咖啡' }),
      'tencent',
    );
    expect(result.mappedScene).toBe('indoor');
    expect(result.mappedVA!.v).toBe(0.58);
    expect(result.mappedVA!.a).toBe(0.32);
    expect(result.confidence).toBe(0.80);
    expect(result.provider).toBe('tencent');
  });

  it('匹配 POI(商场) → city 场景', () => {
    const result = buildGPSReverseResult(
      makeCoord(),
      makePOI({ typeCode: '060100', name: '万达广场', category: '商场' }),
      'amap',
    );
    expect(result.mappedScene).toBe('city');
    expect(result.mappedVA!.v).toBe(0.55);
    expect(result.mappedVA!.a).toBe(0.60);
  });

  it('未匹配 POI → mappedScene=undefined + POI_UNKNOWN_VA + confidence=0.4', () => {
    const result = buildGPSReverseResult(
      makeCoord(),
      makePOI({ typeCode: '000000', name: '未知地点', category: '其他' }),
      'osm',
    );
    expect(result.mappedScene).toBeUndefined();
    expect(result.mappedVA!.v).toBe(POI_UNKNOWN_VA.v);
    expect(result.mappedVA!.a).toBe(POI_UNKNOWN_VA.a);
    expect(result.confidence).toBe(0.4);
  });

  it('三种 provider 均可构建', () => {
    const poi = makePOI();
    for (const provider of ['amap', 'tencent', 'osm'] as const) {
      const result = buildGPSReverseResult(makeCoord(), poi, provider);
      expect(result.provider).toBe(provider);
    }
  });
});
