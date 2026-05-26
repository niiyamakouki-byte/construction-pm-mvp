/**
 * phase-state-machine.test.ts — Phase 2.0
 * 全遷移パターン・禁止遷移・終端ステータスのユニットテスト
 */
import { describe, it, expect } from 'vitest';
import {
  PHASE_TRANSITIONS,
  canTransition,
  assertTransition,
  isTerminal,
  type PhaseStatus,
} from './phase-state-machine.js';

describe('PHASE_TRANSITIONS テーブル', () => {
  it('planned から in_progress へ遷移できる', () => {
    expect(canTransition('planned', 'in_progress')).toBe(true);
  });

  it('planned から canceled へ遷移できる', () => {
    expect(canTransition('planned', 'canceled')).toBe(true);
  });

  it('in_progress から blocked へ遷移できる', () => {
    expect(canTransition('in_progress', 'blocked')).toBe(true);
  });

  it('in_progress から done へ遷移できる', () => {
    expect(canTransition('in_progress', 'done')).toBe(true);
  });

  it('in_progress から canceled へ遷移できる', () => {
    expect(canTransition('in_progress', 'canceled')).toBe(true);
  });

  it('blocked から in_progress へ遷移できる', () => {
    expect(canTransition('blocked', 'in_progress')).toBe(true);
  });

  it('blocked から canceled へ遷移できる', () => {
    expect(canTransition('blocked', 'canceled')).toBe(true);
  });
});

describe('禁止遷移', () => {
  it('planned から blocked への直接遷移は禁止', () => {
    expect(canTransition('planned', 'blocked')).toBe(false);
  });

  it('planned から done への直接遷移は禁止', () => {
    expect(canTransition('planned', 'done')).toBe(false);
  });

  it('done から他への遷移はすべて禁止', () => {
    const targets: PhaseStatus[] = ['planned', 'in_progress', 'blocked', 'canceled'];
    targets.forEach((t) => {
      expect(canTransition('done', t)).toBe(false);
    });
  });

  it('canceled から他への遷移はすべて禁止', () => {
    const targets: PhaseStatus[] = ['planned', 'in_progress', 'blocked', 'done'];
    targets.forEach((t) => {
      expect(canTransition('canceled', t)).toBe(false);
    });
  });
});

describe('assertTransition', () => {
  it('許可遷移では例外を投げない', () => {
    expect(() => assertTransition('planned', 'in_progress')).not.toThrow();
  });

  it('禁止遷移では "invalid phase status transition" を含む例外を投げる', () => {
    expect(() => assertTransition('done', 'planned')).toThrow(
      'invalid phase status transition: done -> planned',
    );
  });

  it('blocked から done は禁止', () => {
    expect(() => assertTransition('blocked', 'done')).toThrow('invalid phase status transition');
  });
});

describe('isTerminal', () => {
  it('done は終端', () => {
    expect(isTerminal('done')).toBe(true);
  });

  it('canceled は終端', () => {
    expect(isTerminal('canceled')).toBe(true);
  });

  it('planned は非終端', () => {
    expect(isTerminal('planned')).toBe(false);
  });

  it('in_progress は非終端', () => {
    expect(isTerminal('in_progress')).toBe(false);
  });

  it('blocked は非終端', () => {
    expect(isTerminal('blocked')).toBe(false);
  });
});

describe('PHASE_TRANSITIONS 完全性チェック', () => {
  it('全 5 ステータスがキーとして存在する', () => {
    const expected: PhaseStatus[] = ['planned', 'in_progress', 'blocked', 'done', 'canceled'];
    expected.forEach((s) => {
      expect(PHASE_TRANSITIONS).toHaveProperty(s);
    });
  });
});
