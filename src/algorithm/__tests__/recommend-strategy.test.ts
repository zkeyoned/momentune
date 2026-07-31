/**
 * recommend.ts 库规模降级策略单元测试
 *
 * 覆盖：selectStrategyByLibrarySize 边界判定 + getStrategyConfig 各策略参数
 *
 * @module algorithm/__tests__/recommend-strategy.test
 */

import { describe, it, expect } from 'vitest';
import {
  selectStrategyByLibrarySize,
  getStrategyConfig,
  type StrategyConfig,
} from '../recommend.js';

// ============================================================================
// 1. selectStrategyByLibrarySize 边界判定
// ============================================================================

describe('selectStrategyByLibrarySize 库规模边界', () => {
  it('1000 首 → full', () => {
    expect(selectStrategyByLibrarySize(1000)).toBe('full');
  });

  it('500 首（边界 ≥500）→ full', () => {
    expect(selectStrategyByLibrarySize(500)).toBe('full');
  });

  it('499 首 → relaxed', () => {
    expect(selectStrategyByLibrarySize(499)).toBe('relaxed');
  });

  it('50 首（边界 ≥50）→ relaxed', () => {
    expect(selectStrategyByLibrarySize(50)).toBe('relaxed');
  });

  it('49 首 → no_pool', () => {
    expect(selectStrategyByLibrarySize(49)).toBe('no_pool');
  });

  it('15 首（边界 ≥15）→ no_pool', () => {
    expect(selectStrategyByLibrarySize(15)).toBe('no_pool');
  });

  it('14 首 → fallback_only', () => {
    expect(selectStrategyByLibrarySize(14)).toBe('fallback_only');
  });

  it('0 首 → fallback_only', () => {
    expect(selectStrategyByLibrarySize(0)).toBe('fallback_only');
  });
});

// ============================================================================
// 2. getStrategyConfig 各策略参数
// ============================================================================

describe('getStrategyConfig 策略参数', () => {
  it('full → 候选池不跳过、coreCount=8、extendMax=12', () => {
    const cfg: StrategyConfig = getStrategyConfig('full');
    expect(cfg.strategy).toBe('full');
    expect(cfg.skipCandidatePool).toBe(false);
    expect(cfg.candidatePoolThresholdMultiplier).toBe(1.0);
    expect(cfg.coreCount).toBe(8);
    expect(cfg.extendCountMax).toBe(12);
    expect(cfg.extendCountMin).toBe(7);
    expect(cfg.useUserPrefFallback).toBe(false);
  });

  it('relaxed → 候选池不跳过、阈值倍数=1.5、extendMax=15', () => {
    const cfg: StrategyConfig = getStrategyConfig('relaxed');
    expect(cfg.strategy).toBe('relaxed');
    expect(cfg.skipCandidatePool).toBe(false);
    expect(cfg.candidatePoolThresholdMultiplier).toBe(1.5);
    expect(cfg.coreCount).toBe(8);
    expect(cfg.extendCountMax).toBe(15);
    expect(cfg.extendCountMin).toBe(0);
    expect(cfg.useUserPrefFallback).toBe(false);
  });

  it('no_pool → skipCandidatePool=true、coreCount=8', () => {
    const cfg: StrategyConfig = getStrategyConfig('no_pool');
    expect(cfg.strategy).toBe('no_pool');
    expect(cfg.skipCandidatePool).toBe(true);
    expect(cfg.coreCount).toBe(8);
    expect(cfg.extendCountMax).toBe(12);
    expect(cfg.extendCountMin).toBe(0);
    expect(cfg.useUserPrefFallback).toBe(false);
  });

  it('fallback_only → useUserPrefFallback=true、coreCount=0', () => {
    const cfg: StrategyConfig = getStrategyConfig('fallback_only');
    expect(cfg.strategy).toBe('fallback_only');
    expect(cfg.useUserPrefFallback).toBe(true);
    expect(cfg.coreCount).toBe(0);
    expect(cfg.extendCountMax).toBe(0);
    expect(cfg.extendCountMin).toBe(0);
    expect(cfg.skipCandidatePool).toBe(true);
  });
});

// ============================================================================
// 3. 策略链路一致性（selectStrategyByLibrarySize → getStrategyConfig）
// ============================================================================

describe('selectStrategyByLibrarySize 与 getStrategyConfig 链路一致', () => {
  it.each([
    [1000, 'full' as const],
    [500, 'full' as const],
    [499, 'relaxed' as const],
    [50, 'relaxed' as const],
    [49, 'no_pool' as const],
    [15, 'no_pool' as const],
    [14, 'fallback_only' as const],
    [0, 'fallback_only' as const],
  ])('库规模 %i → 策略 %s 配置一致', (size, expectedStrategy) => {
    const strategy = selectStrategyByLibrarySize(size);
    expect(strategy).toBe(expectedStrategy);
    const cfg = getStrategyConfig(strategy);
    expect(cfg.strategy).toBe(expectedStrategy);
  });
});
