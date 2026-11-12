import { describe, it, expect } from 'vitest';
import { addPair, makeTask, numberOptions, plural, adaptLevel, levelFromAssessment, kindsFor, isCorrect, MathLevel, TaskKind } from './math';

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const levels: MathLevel[] = [1, 2, 3, 4, 5];

describe('first-grade math', () => {
  it('keeps addends inside level bounds', () => {
    const rng = seeded(7);
    for (let i = 0; i < 500; i++) {
      for (const l of levels) {
        const [a, b] = addPair(l, rng);
        expect(a).toBeGreaterThanOrEqual(1); expect(b).toBeGreaterThanOrEqual(1);
        const s = a + b;
        if (l === 1) expect(s).toBeLessThanOrEqual(5);
        if (l === 2 || l === 3) expect(s).toBeLessThanOrEqual(10);
        if (l === 4) { expect(s).toBeLessThanOrEqual(19); expect((a % 10) + (b % 10)).toBeLessThan(10); expect(s).toBeGreaterThan(10); }
        if (l === 5) { expect(s).toBeGreaterThan(10); expect(s).toBeLessThanOrEqual(18); expect(Math.max(a, b)).toBeLessThan(10); }
      }
    }
  });

  it('builds solvable tasks of every kind with the answer among options', () => {
    const rng = seeded(42);
    const kinds: TaskKind[] = ['count', 'choose', 'missing', 'house', 'word', 'compare', 'subtract'];
    for (let i = 0; i < 300; i++) for (const l of levels) for (const kind of kinds) {
      const t = makeTask(l, rng, { kind });
      expect(t.options).toContain(t.answer);
      expect(new Set(t.options.map(String)).size).toBe(t.options.length);
      expect(isCorrect(t, t.answer)).toBe(true);
      if (l <= 3) t.options.forEach(o => { if (typeof o === 'number') expect(o).toBeLessThanOrEqual(10); });
      const { first, second, op } = t.beads;
      if (kind === 'subtract') expect(first - second).toBe(t.answer);
      else if (kind === 'compare') expect(['<', '=', '>']).toContain(t.answer);
      else if (kind === 'missing' || kind === 'house') expect([first, second]).toContain(t.answer);
      else if (kind === 'word') expect([first + second, second]).toContain(t.answer);
      else expect(first + second).toBe(t.answer);
      expect(op === '+' || op === '-').toBe(true);
      expect(t.solution).toMatch(/=/);
      if (t.story) expect(t.story).not.toMatch(/[{}]/);
    }
  });

  it('compare answer matches the arithmetic', () => {
    const rng = seeded(3);
    for (let i = 0; i < 200; i++) {
      const t = makeTask(2, rng, { kind: 'compare' });
      const [left, right] = t.equation!.split('◯').map(x => x.trim());
      const sum = left.split('+').map(Number).reduce((a, b) => a + b, 0);
      const r = Number(right);
      expect(t.answer).toBe(sum > r ? '>' : sum < r ? '<' : '=');
    }
  });

  it('gives four distinct options within 0..20', () => {
    const rng = seeded(11);
    for (let n = 0; n <= 20; n++) {
      const o = numberOptions(n, rng);
      expect(o).toHaveLength(4); expect(o).toContain(n);
      expect(new Set(o).size).toBe(4);
      o.forEach(x => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(20); });
    }
  });

  it('declines Ukrainian nouns after numbers', () => {
    const f: [string, string, string] = ['яблуко', 'яблука', 'яблук'];
    expect(plural(1, f)).toBe('яблуко'); expect(plural(3, f)).toBe('яблука'); expect(plural(5, f)).toBe('яблук');
    expect(plural(11, f)).toBe('яблук'); expect(plural(12, f)).toBe('яблук'); expect(plural(21, f)).toBe('яблуко'); expect(plural(14, f)).toBe('яблук');
  });

  it('moves level up after success and down after struggle', () => {
    let s = { level: 2 as MathLevel, history: [] as boolean[] };
    for (const ok of [true, true, false, true, true]) s = adaptLevel(s.level, s.history, ok);
    expect(s.level).toBe(3);
    for (const ok of [false, false, true, false]) s = adaptLevel(s.level, s.history, ok);
    expect(s.level).toBe(2);
    let top = { level: 5 as MathLevel, history: [] as boolean[] };
    for (let i = 0; i < 10; i++) top = adaptLevel(top.level, top.history, true);
    expect(top.level).toBe(5);
    let low = { level: 1 as MathLevel, history: [] as boolean[] };
    for (let i = 0; i < 10; i++) low = adaptLevel(low.level, low.history, false);
    expect(low.level).toBe(1);
  });

  it('maps assessment to a starting level and offers kinds for each level', () => {
    expect(levelFromAssessment(0)).toBe(1); expect(levelFromAssessment(4)).toBe(4);
    levels.forEach(l => expect(kindsFor(l).length).toBeGreaterThan(2));
  });
});
