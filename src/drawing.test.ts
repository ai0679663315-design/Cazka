import { describe, it, expect, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
import { pathFrom, TEMPLATES, upsert, MAX_DRAWINGS, Drawing } from './drawing';

describe('drawing', () => {
  it('turns points into a smooth path', () => {
    expect(pathFrom([])).toBe('');
    expect(pathFrom([10, 10])).toMatch(/^M10 10 L/);
    const d = pathFrom([0, 0, 10, 10, 20, 0, 30, 10]);
    expect(d.startsWith('M0 0')).toBe(true); expect(d).toContain('Q'); expect(d.endsWith('L30 10')).toBe(true);
  });
  it('has valid coloring templates inside the canvas', () => {
    for (const t of Object.values(TEMPLATES)) {
      expect(t.paths.length).toBeGreaterThan(0);
      for (const p of t.paths) {
        expect(p).toMatch(/^M/);
        const nums = (p.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
        nums.forEach(n => expect(Math.abs(n)).toBeLessThanOrEqual(1000));
      }
    }
  });
  it('keeps newest drawings first and limits the gallery', () => {
    let list: Drawing[] = [];
    for (let i = 0; i < MAX_DRAWINGS + 5; i++) list = upsert(list, { id: String(i), date: '', items: [] });
    expect(list).toHaveLength(MAX_DRAWINGS); expect(list[0].id).toBe(String(MAX_DRAWINGS + 4));
    list = upsert(list, { id: '10', date: 'x', items: [] });
    expect(list[0]).toMatchObject({ id: '10', date: 'x' }); expect(list.filter(d => d.id === '10')).toHaveLength(1);
  });
});
