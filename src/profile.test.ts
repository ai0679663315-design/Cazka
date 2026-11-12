import { describe, it, expect } from 'vitest';
import { migrate, newProfile } from './profile';
import { newRecord, recordAttempt } from './learning';

describe('profile', () => {
  it('upgrades a profile saved by the previous version', () => {
    let record = newRecord();
    for (let i = 0; i < 6; i++) record = recordAttempt(record, 'arithmetic', true);
    const old = { name: 'Оля', age: '6', interest: 'Море', record, results: [], completed: 2, minutes: 10, onboarded: true };
    const p = migrate(old)!;
    expect(p.mathLevel).toBe(3);
    expect(p.stars).toBe(6);
    expect(p.stickers).toEqual([]);
    expect(p.completed).toBe(2);
  });
  it('rejects broken data and creates new profiles', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ name: 'x' })).toBeNull();
    expect(newProfile('Таня', '5', 'Космос').mathLevel).toBe(1);
    expect(newProfile('Таня', '7', 'Космос').mathLevel).toBe(2);
  });
});
