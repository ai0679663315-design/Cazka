import { describe, it, expect } from 'vitest';
import { keyboard, frequency, midi, noteName, parseSong, SONGS, extendSequence, SIMON_NOTES } from './piano';

describe('piano', () => {
  it('builds two octaves plus the top C', () => {
    const k = keyboard(4, 2);
    expect(k.filter(x => !x.black)).toHaveLength(15);
    expect(k.filter(x => x.black)).toHaveLength(10);
    expect(k[0].note).toBe('C4'); expect(k[k.length - 1].note).toBe('C6');
  });
  it('knows pitches and names', () => {
    expect(midi('A4')).toBe(69); expect(frequency('A4')).toBeCloseTo(440);
    expect(frequency('C4')).toBeCloseTo(261.63, 1);
    expect(noteName('G4')).toBe('соль'); expect(noteName('C#4')).toBe('до♯');
  });
  it('parses songs and keeps every note on the keyboard', () => {
    const p = parseSong('C4 D4- | E4');
    expect(p).toEqual([{ note: 'C4', long: false, pauseAfter: false }, { note: 'D4', long: true, pauseAfter: true }, { note: 'E4', long: false, pauseAfter: false }]);
    const all = new Set(keyboard(4, 2).map(k => k.note));
    for (const s of SONGS) { expect(s.notes.length).toBeGreaterThan(5); s.notes.forEach(n => expect(all.has(n.note)).toBe(true)); }
  });
  it('grows the memory game one note at a time', () => {
    let seq: string[] = [];
    for (let i = 0; i < 10; i++) seq = extendSequence(seq);
    expect(seq).toHaveLength(10);
    seq.forEach(n => expect(SIMON_NOTES).toContain(n));
  });
});
