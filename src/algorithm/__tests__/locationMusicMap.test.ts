/**
 * locationMusicMap 单元测试
 *
 * 覆盖:
 * - 全球地点库完整性(亚洲/欧洲/美洲/大洋洲/非洲/中东)
 * - findLocationMusic 查询(城市/地标/场所)
 * - findSongLocationMention 歌词反向索引
 * - getLocationGenrePreferences 风格偏好向量
 * - VENUE_MUSIC_PROFILES 场所类型匹配
 * - buildGPSReverseResult 集成(locationMusic 字段)
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_LOCATION_MUSIC_ENTRIES,
  VENUE_MUSIC_PROFILES,
  LOCATION_STATS,
  EXTENDED_GENRE_TO_BASE,
  findLocationMusic,
  findSongLocationMention,
  getLocationGenrePreferences,
  getSignatureSongs,
} from '../config/locationMusicMap.js';
import { buildGPSReverseResult } from '../gpsFallback.js';
import type { LocationMusicEntry, VenueMusicProfile } from '../config/locationMusicMap.js';
import type { GPSCoordinate, POIInfo } from '../types.js';

// ============================================================================
// 1. 全球地点库完整性
// ============================================================================

describe('ALL_LOCATION_MUSIC_ENTRIES 全球地点库完整性', () => {
  it('总数 ≥ 50(覆盖全球主要城市/地标)', () => {
    expect(ALL_LOCATION_MUSIC_ENTRIES.length).toBeGreaterThanOrEqual(50);
  });

  it('LOCATION_STATS 统计正确', () => {
    expect(LOCATION_STATS.total).toBe(ALL_LOCATION_MUSIC_ENTRIES.length);
    expect(LOCATION_STATS.asia).toBeGreaterThanOrEqual(15);
    expect(LOCATION_STATS.europe).toBeGreaterThanOrEqual(15);
    expect(LOCATION_STATS.america).toBeGreaterThanOrEqual(10);
    expect(LOCATION_STATS.venues).toBeGreaterThanOrEqual(15);
  });

  it('每个条目字段完整', () => {
    for (const entry of ALL_LOCATION_MUSIC_ENTRIES) {
      expect(entry.locationId).toBeTruthy();
      expect(entry.names.length).toBeGreaterThanOrEqual(1);
      expect(entry.type).toBeTruthy();
      expect(entry.region).toBeTruthy();
      expect(entry.va).toBeDefined();
      expect(entry.va.v).toBeGreaterThanOrEqual(0);
      expect(entry.va.v).toBeLessThanOrEqual(1);
      expect(entry.va.a).toBeGreaterThanOrEqual(0);
      expect(entry.va.a).toBeLessThanOrEqual(1);
      expect(entry.genrePreferences).toBeDefined();
      expect(entry.signatureSongs.length).toBeGreaterThanOrEqual(1);
      expect(entry.sceneTag).toBeTruthy();
      expect(entry.emotionLabels.length).toBeGreaterThanOrEqual(1);
      expect(entry.description).toBeTruthy();
    }
  });

  it('locationId 唯一', () => {
    const ids = ALL_LOCATION_MUSIC_ENTRIES.map((e) => e.locationId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('names 不为空且无空字符串', () => {
    for (const entry of ALL_LOCATION_MUSIC_ENTRIES) {
      for (const name of entry.names) {
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  it('signatureSongs 的 reason 均为合法值', () => {
    const validReasons = ['lyric_mentions', 'local_hit', 'theme_match'];
    for (const entry of ALL_LOCATION_MUSIC_ENTRIES) {
      for (const song of entry.signatureSongs) {
        expect(validReasons).toContain(song.reason);
      }
    }
  });

  it('至少 60% 的条目有 lyric_mentions 或 local_hit(真实关联歌曲)', () => {
    const withRealAssoc = ALL_LOCATION_MUSIC_ENTRIES.filter((e) =>
      e.signatureSongs.some((s) => s.reason === 'lyric_mentions' || s.reason === 'local_hit'),
    );
    const ratio = withRealAssoc.length / ALL_LOCATION_MUSIC_ENTRIES.length;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
  });

  it('emotionLabels 均为合法 16 标签', () => {
    const validLabels = [
      'Exciting', 'Joyful', 'Romantic', 'Fresh', 'Healing', 'Relaxing',
      'Peaceful', 'Touching', 'Nostalgic', 'Missing', 'Lonely', 'Melancholic',
      'Tense', 'Epic', 'Dark', 'Dreamy',
    ];
    for (const entry of ALL_LOCATION_MUSIC_ENTRIES) {
      for (const label of entry.emotionLabels) {
        expect(validLabels).toContain(label);
      }
    }
  });

  it('覆盖亚洲主要城市', () => {
    const asia = ALL_LOCATION_MUSIC_ENTRIES.filter((e) => e.region === 'asia');
    const names = asia.flatMap((e) => e.names);
    expect(names.some((n) => n.includes('北京') || n === 'Beijing')).toBe(true);
    expect(names.some((n) => n.includes('上海') || n === 'Shanghai')).toBe(true);
    expect(names.some((n) => n.includes('东京') || n === 'Tokyo')).toBe(true);
    expect(names.some((n) => n.includes('首尔') || n === 'Seoul')).toBe(true);
  });

  it('覆盖欧洲主要城市', () => {
    const europe = ALL_LOCATION_MUSIC_ENTRIES.filter((e) => e.region === 'europe');
    const names = europe.flatMap((e) => e.names);
    expect(names.some((n) => n.includes('伦敦') || n === 'London')).toBe(true);
    expect(names.some((n) => n.includes('巴黎') || n === 'Paris')).toBe(true);
    expect(names.some((n) => n.includes('罗马') || n === 'Rome')).toBe(true);
  });

  it('覆盖美洲主要城市', () => {
    const america = ALL_LOCATION_MUSIC_ENTRIES.filter((e) => e.region === 'north_america' || e.region === 'south_america');
    const names = america.flatMap((e) => e.names);
    expect(names.some((n) => n.includes('纽约') || n === 'New York')).toBe(true);
    expect(names.some((n) => n.includes('洛杉矶') || n === 'Los Angeles')).toBe(true);
  });
});

// ============================================================================
// 2. findLocationMusic 查询
// ============================================================================

describe('findLocationMusic 查询', () => {
  it('精确匹配城市名(中文)', () => {
    const result = findLocationMusic('北京', '城市');
    expect(result.location).toBeDefined();
    expect(result.location!.locationId).toBe('cn_beijing');
  });

  it('精确匹配城市名(英文)', () => {
    const result = findLocationMusic('Tokyo', 'city');
    expect(result.location).toBeDefined();
    expect(result.location!.locationId).toBe('jp_tokyo');
  });

  it('包含匹配:POI 名称包含城市名', () => {
    const result = findLocationMusic('北京市朝阳区三里屯', '商圈');
    expect(result.location).toBeDefined();
    expect(result.location!.locationId).toBe('cn_beijing');
  });

  it('别名匹配:北平 → 北京', () => {
    const result = findLocationMusic('北平', 'city');
    expect(result.location).toBeDefined();
    expect(result.location!.locationId).toBe('cn_beijing');
  });

  it('匹配成都', () => {
    const result = findLocationMusic('成都', 'city');
    expect(result.location).toBeDefined();
    expect(result.location!.locationId).toBe('cn_chengdu');
  });

  it('匹配巴黎', () => {
    const result = findLocationMusic('Paris', 'city');
    expect(result.location).toBeDefined();
    expect(result.location!.locationId).toBe('fr_paris');
  });

  it('匹配纽约', () => {
    const result = findLocationMusic('New York', 'city');
    expect(result.location).toBeDefined();
    expect(result.location!.locationId).toBe('us_newyork');
  });

  it('场所类型匹配:咖啡馆', () => {
    const result = findLocationMusic('星巴克咖啡店', '餐饮');
    expect(result.venue).toBeDefined();
    expect(result.venue!.venueType).toBe('cafe');
  });

  it('场所类型匹配:书店', () => {
    const result = findLocationMusic('诚品书店', '文化');
    expect(result.venue).toBeDefined();
    expect(result.venue!.venueType).toBe('bookstore');
  });

  it('场所类型匹配:健身房', () => {
    const result = findLocationMusic('威尔仕健身房', '运动');
    expect(result.venue).toBeDefined();
    expect(result.venue!.venueType).toBe('gym');
  });

  it('场所类型匹配:夜店', () => {
    const result = findLocationMusic('M18夜店', '娱乐');
    expect(result.venue).toBeDefined();
    expect(result.venue!.venueType).toBe('club');
  });

  it('无匹配返回空对象', () => {
    const result = findLocationMusic('未知地点XYZ', '未知');
    expect(result.location).toBeUndefined();
    expect(result.venue).toBeUndefined();
  });

  it('城市优先于场所(北京不是 cafe)', () => {
    // "北京" 应该匹配城市,不是场所
    const result = findLocationMusic('北京', '城市');
    expect(result.location).toBeDefined();
  });

  it('district 参数参与匹配', () => {
    const result = findLocationMusic('外滩', '风景名胜', '上海市黄浦区');
    expect(result.location).toBeDefined();
    // 上海条目的 names 含 "上海"
    expect(result.location!.names).toContain('上海');
  });
});

// ============================================================================
// 3. findSongLocationMention 歌词反向索引
// ============================================================================

describe('findSongLocationMention 歌曲地点反向索引', () => {
  it('成都 - 赵雷 → 成都', () => {
    const results = findSongLocationMention('成都', '赵雷');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.locationId).toBe('cn_chengdu');
  });

  it('Empire State of Mind - Jay-Z → 纽约', () => {
    const results = findSongLocationMention('Empire State of Mind', 'Jay-Z');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.locationId).toBe('us_newyork');
  });

  it('北京北京 - 汪峰 → 北京', () => {
    const results = findSongLocationMention('北京北京', '汪峰');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.locationId).toBe('cn_beijing');
  });

  it('不存在的歌曲返回空', () => {
    const results = findSongLocationMention('不存在的歌', '未知歌手');
    expect(results).toHaveLength(0);
  });

  it('大小写不敏感', () => {
    const results = findSongLocationMention('tokyo flash', 'Vaundy');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.locationId).toBe('jp_tokyo');
  });
});

// ============================================================================
// 4. getLocationGenrePreferences 风格偏好向量
// ============================================================================

describe('getLocationGenrePreferences', () => {
  it('返回 60 个基础风格', () => {
    const beijing = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'cn_beijing')!;
    const prefs = getLocationGenrePreferences(beijing);
    const keys = Object.keys(prefs);
    expect(keys).toHaveLength(60);
    expect(keys).toContain('pop');
    expect(keys).toContain('folk');
    expect(keys).toContain('electronic');
    expect(keys).toContain('rap');
    expect(keys).toContain('guofeng');
    expect(keys).toContain('rock');
    expect(keys).toContain('rnb');
    expect(keys).toContain('lofi');
    // 第 2 轮新增 9 类
    expect(keys).toContain('jazz');
    expect(keys).toContain('classical');
    expect(keys).toContain('country');
    expect(keys).toContain('blues');
    expect(keys).toContain('reggae');
    expect(keys).toContain('metal');
    expect(keys).toContain('punk');
    expect(keys).toContain('indie');
    expect(keys).toContain('ambient');
    // 第 3 轮新增 8 类
    expect(keys).toContain('soul');
    expect(keys).toContain('funk');
    expect(keys).toContain('disco');
    expect(keys).toContain('kpop');
    expect(keys).toContain('jpop');
    expect(keys).toContain('acoustic');
    expect(keys).toContain('soundtrack');
    expect(keys).toContain('world');
    // 第 4 轮新增 4 类
    expect(keys).toContain('trap');
    expect(keys).toContain('house');
    expect(keys).toContain('edm');
    expect(keys).toContain('choir');
    // 第 5 轮新增 15 类
    expect(keys).toContain('phonk');
    expect(keys).toContain('driftphonk');
    expect(keys).toContain('hyperpop');
    expect(keys).toContain('bedroompop');
    expect(keys).toContain('citypop');
    expect(keys).toContain('dreamcore');
    expect(keys).toContain('drill');
    expect(keys).toContain('futurebass');
    expect(keys).toContain('synthwave');
    expect(keys).toContain('vaporwave');
    expect(keys).toContain('shoegaze');
    expect(keys).toContain('dreampop');
    expect(keys).toContain('gufeng');
    expect(keys).toContain('xiqiang');
    expect(keys).toContain('guofengrock');
    // 第 6 轮新增 15 类
    expect(keys).toContain('amapiano');
    expect(keys).toContain('afrobeats');
    expect(keys).toContain('drumandbass');
    expect(keys).toContain('ukgarage');
    expect(keys).toContain('techno');
    expect(keys).toContain('reggaeton');
    expect(keys).toContain('dembow');
    expect(keys).toContain('trance');
    expect(keys).toContain('hardwave');
    expect(keys).toContain('anime');
    expect(keys).toContain('vocaloid');
    expect(keys).toContain('bachata');
    expect(keys).toContain('emo');
    expect(keys).toContain('poppunk');
    expect(keys).toContain('postpunk');
    expect(keys).toContain('other');
  });

  it('未列出的风格默认 0.3', () => {
    const beijing = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'cn_beijing')!;
    const prefs = getLocationGenrePreferences(beijing);
    // 北京没列 lofi,应该默认 0.3
    expect(prefs.lofi).toBe(0.3);
  });

  it('列出的风格用实际值', () => {
    const beijing = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'cn_beijing')!;
    const prefs = getLocationGenrePreferences(beijing);
    expect(prefs.pop).toBe(0.9);
    expect(prefs.rock).toBe(0.6);
  });

  it('扩展风格映射到独立类(jazz → jazz)', () => {
    const nola = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'us_neworleans')!;
    // 新奥尔良有 jazz: 0.9,现在 jazz 是独立 GenreTag
    const prefs = getLocationGenrePreferences(nola);
    expect(prefs.jazz).toBeGreaterThanOrEqual(0.9);
  });

  it('扩展风格映射(classical → classical,取实际值)', () => {
    const vienna = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'at_vienna')!;
    // 维也纳有 classical: 0.9,现在 classical 是独立 GenreTag
    const prefs = getLocationGenrePreferences(vienna);
    expect(prefs.classical).toBeGreaterThanOrEqual(0.9);
  });

  it('扩展风格映射(latin → world)', () => {
    const rio = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'br_rio')!;
    // 里约有 latin: 0.9,现在映射到 world(而非 pop)
    const prefs = getLocationGenrePreferences(rio);
    expect(prefs.world).toBeGreaterThanOrEqual(0.9);
  });

  it('扩展风格映射(country → country,独立类)', () => {
    const nashville = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'us_nashville')!;
    // 纳什维尔有 country: 0.95,现在 country 是独立 GenreTag
    const prefs = getLocationGenrePreferences(nashville);
    expect(prefs.country).toBeGreaterThanOrEqual(0.95);
  });

  it('支持 VenueMusicProfile', () => {
    const cafe = VENUE_MUSIC_PROFILES.find((v) => v.venueType === 'cafe')!;
    const prefs = getLocationGenrePreferences(cafe);
    expect(prefs.lofi).toBe(0.9);
    expect(prefs.folk).toBe(0.8);
  });

  it('所有值在 [0, 1] 范围', () => {
    for (const entry of ALL_LOCATION_MUSIC_ENTRIES) {
      const prefs = getLocationGenrePreferences(entry);
      for (const val of Object.values(prefs)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ============================================================================
// 5. VENUE_MUSIC_PROFILES 场所类型
// ============================================================================

describe('VENUE_MUSIC_PROFILES 场所类型映射', () => {
  it('数量 ≥ 15', () => {
    expect(VENUE_MUSIC_PROFILES.length).toBeGreaterThanOrEqual(15);
  });

  it('venueType 唯一', () => {
    const types = VENUE_MUSIC_PROFILES.map((v) => v.venueType);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });

  it('每个条目字段完整', () => {
    for (const v of VENUE_MUSIC_PROFILES) {
      expect(v.venueType).toBeTruthy();
      expect(v.match.length).toBeGreaterThanOrEqual(1);
      expect(v.genrePreferences).toBeDefined();
      expect(v.va).toBeDefined();
      expect(v.sceneTag).toBeTruthy();
      expect(v.emotionLabels.length).toBeGreaterThanOrEqual(1);
      expect(v.description).toBeTruthy();
    }
  });

  it('包含关键场所类型', () => {
    const types = VENUE_MUSIC_PROFILES.map((v) => v.venueType);
    expect(types).toContain('cafe');
    expect(types).toContain('bookstore');
    expect(types).toContain('gym');
    expect(types).toContain('beach');
    expect(types).toContain('airport');
    expect(types).toContain('home');
  });

  it('健身房的 A 值高于咖啡馆(高能 vs 放松)', () => {
    const gym = VENUE_MUSIC_PROFILES.find((v) => v.venueType === 'gym')!;
    const cafe = VENUE_MUSIC_PROFILES.find((v) => v.venueType === 'cafe')!;
    expect(gym.va.a).toBeGreaterThan(cafe.va.a);
  });

  it('夜店的 V/A 均高于书店', () => {
    const club = VENUE_MUSIC_PROFILES.find((v) => v.venueType === 'club')!;
    const bookstore = VENUE_MUSIC_PROFILES.find((v) => v.venueType === 'bookstore')!;
    expect(club.va.v).toBeGreaterThan(bookstore.va.v);
    expect(club.va.a).toBeGreaterThan(bookstore.va.a);
  });
});

// ============================================================================
// 6. EXTENDED_GENRE_TO_BASE 扩展风格映射
// ============================================================================

describe('EXTENDED_GENRE_TO_BASE', () => {
  it('9 个原基础风格映射到自己', () => {
    expect(EXTENDED_GENRE_TO_BASE.pop).toBe('pop');
    expect(EXTENDED_GENRE_TO_BASE.folk).toBe('folk');
    expect(EXTENDED_GENRE_TO_BASE.electronic).toBe('electronic');
    expect(EXTENDED_GENRE_TO_BASE.rap).toBe('rap');
    expect(EXTENDED_GENRE_TO_BASE.guofeng).toBe('guofeng');
    expect(EXTENDED_GENRE_TO_BASE.rock).toBe('rock');
    expect(EXTENDED_GENRE_TO_BASE.rnb).toBe('rnb');
    expect(EXTENDED_GENRE_TO_BASE.lofi).toBe('lofi');
    expect(EXTENDED_GENRE_TO_BASE.other).toBe('other');
  });

  it('第 2 轮扩展风格映射到自己', () => {
    expect(EXTENDED_GENRE_TO_BASE.jazz).toBe('jazz');
    expect(EXTENDED_GENRE_TO_BASE.classical).toBe('classical');
    expect(EXTENDED_GENRE_TO_BASE.country).toBe('country');
    expect(EXTENDED_GENRE_TO_BASE.blues).toBe('blues');
    expect(EXTENDED_GENRE_TO_BASE.reggae).toBe('reggae');
    expect(EXTENDED_GENRE_TO_BASE.metal).toBe('metal');
    expect(EXTENDED_GENRE_TO_BASE.punk).toBe('punk');
    expect(EXTENDED_GENRE_TO_BASE.indie).toBe('indie');
    expect(EXTENDED_GENRE_TO_BASE.ambient).toBe('ambient');
  });

  it('第 3 轮扩展风格映射到自己', () => {
    expect(EXTENDED_GENRE_TO_BASE.soul).toBe('soul');
    expect(EXTENDED_GENRE_TO_BASE.funk).toBe('funk');
    expect(EXTENDED_GENRE_TO_BASE.disco).toBe('disco');
    expect(EXTENDED_GENRE_TO_BASE.kpop).toBe('kpop');
    expect(EXTENDED_GENRE_TO_BASE.jpop).toBe('jpop');
    expect(EXTENDED_GENRE_TO_BASE.acoustic).toBe('acoustic');
    expect(EXTENDED_GENRE_TO_BASE.soundtrack).toBe('soundtrack');
    expect(EXTENDED_GENRE_TO_BASE.world).toBe('world');
  });

  it('非 GenreTag 扩展风格映射到最近基础类', () => {
    // latin/samba/tango/bossa_nova 现在映射到 world(而非 pop)
    expect(EXTENDED_GENRE_TO_BASE.latin).toBe('world');
    expect(EXTENDED_GENRE_TO_BASE.samba).toBe('world');
    expect(EXTENDED_GENRE_TO_BASE.tango).toBe('world');
    expect(EXTENDED_GENRE_TO_BASE.bossa_nova).toBe('world');
    expect(EXTENDED_GENRE_TO_BASE.flamenco).toBe('world');
    expect(EXTENDED_GENRE_TO_BASE.celtic).toBe('world');
    // cantonese_pop 仍映射到 pop
    expect(EXTENDED_GENRE_TO_BASE.cantonese_pop).toBe('pop');
  });
});

// ============================================================================
// 7. getSignatureSongs
// ============================================================================

describe('getSignatureSongs', () => {
  it('返回代表歌曲列表', () => {
    const beijing = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'cn_beijing')!;
    const songs = getSignatureSongs(beijing);
    expect(songs.length).toBeGreaterThanOrEqual(1);
    expect(songs.some((s) => s.title.includes('北京'))).toBe(true);
  });

  it('返回副本(不修改原数据)', () => {
    const chengdu = ALL_LOCATION_MUSIC_ENTRIES.find((e) => e.locationId === 'cn_chengdu')!;
    const songs1 = getSignatureSongs(chengdu);
    const songs2 = getSignatureSongs(chengdu);
    expect(songs1).not.toBe(songs2); // 不同引用
    expect(songs1).toEqual(songs2); // 内容相同
  });
});

// ============================================================================
// 8. buildGPSReverseResult 集成测试
// ============================================================================

describe('buildGPSReverseResult 地点音乐集成', () => {
  const coord: GPSCoordinate = { lat: 39.9042, lng: 116.4074 };

  it('北京 POI → locationMusic 填充', () => {
    const poi: POIInfo = {
      name: '故宫博物院',
      typeCode: '140400',
      category: '古迹',
      district: '北京市东城区',
    };
    const result = buildGPSReverseResult(coord, poi, 'amap');
    expect(result.locationMusic).toBeDefined();
    expect(result.locationMusic!.location).toBeDefined();
    expect((result.locationMusic!.location as LocationMusicEntry).locationId).toBe('cn_beijing');
  });

  it('上海 POI → locationMusic 填充', () => {
    const poi: POIInfo = {
      name: '外滩',
      typeCode: '110100',
      category: '风景名胜',
      district: '上海市黄浦区',
    };
    const result = buildGPSReverseResult(coord, poi, 'amap');
    expect(result.locationMusic).toBeDefined();
  });

  it('咖啡馆 POI → venue 填充', () => {
    const poi: POIInfo = {
      name: '星巴克咖啡店',
      typeCode: '050500',
      category: '咖啡',
    };
    const result = buildGPSReverseResult(coord, poi, 'amap');
    expect(result.locationMusic).toBeDefined();
    expect(result.locationMusic!.venue).toBeDefined();
    expect((result.locationMusic!.venue as VenueMusicProfile).venueType).toBe('cafe');
  });

  it('未知地点 → locationMusic 为 undefined', () => {
    const poi: POIInfo = {
      name: '某不知名地点XYZ',
      typeCode: '999999',
      category: '未知',
    };
    const result = buildGPSReverseResult(coord, poi, 'amap');
    expect(result.locationMusic).toBeUndefined();
  });

  it('地点匹配优先于场所类型', () => {
    // "北京"应匹配城市,不应匹配场所
    const poi: POIInfo = {
      name: '北京',
      typeCode: '000000',
      category: '城市',
    };
    const result = buildGPSReverseResult(coord, poi, 'amap');
    expect(result.locationMusic).toBeDefined();
    expect(result.locationMusic!.location).toBeDefined();
    expect((result.locationMusic!.location as LocationMusicEntry).locationId).toBe('cn_beijing');
  });

  it('东京 POI → locationMusic 填充(英文匹配)', () => {
    const poi: POIInfo = {
      name: 'Tokyo Tower',
      typeCode: '110100',
      category: 'scenic',
    };
    const result = buildGPSReverseResult(coord, poi, 'osm');
    expect(result.locationMusic).toBeDefined();
    expect(result.locationMusic!.location).toBeDefined();
    expect((result.locationMusic!.location as LocationMusicEntry).locationId).toBe('jp_tokyo');
  });
});
