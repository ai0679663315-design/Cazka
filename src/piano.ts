/** Піаніно: ноти, частоти, пісеньки (народні або давно у суспільному надбанні) і гра «Повторюй за мною». */

export const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = typeof WHITE[number];
const HAS_SHARP: Record<Letter, boolean> = { C: true, D: true, E: false, F: true, G: true, A: true, B: false };
const SEMITONE: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Українські назви нот і кольори «веселки» для кожної. */
export const SOLFEGE: Record<Letter, string> = { C: 'до', D: 'ре', E: 'мі', F: 'фа', G: 'соль', A: 'ля', B: 'сі' };
export const NOTE_COLOR: Record<Letter, string> = { C: '#E5735A', D: '#EE9B4A', E: '#E8C33E', F: '#7DB55A', G: '#4FB3B0', A: '#5B8DD6', B: '#9A73CF' };

export type Key = { note: string; letter: Letter; octave: number; black: boolean; whiteIndex: number };

/** Клавіатура від C<from> на `octaves` октав плюс завершальна «до». */
export function keyboard(from = 4, octaves = 2): Key[] {
  const keys: Key[] = [];
  let wi = 0;
  for (let o = from; o < from + octaves; o++) {
    for (const l of WHITE) {
      keys.push({ note: `${l}${o}`, letter: l, octave: o, black: false, whiteIndex: wi });
      if (HAS_SHARP[l]) keys.push({ note: `${l}#${o}`, letter: l, octave: o, black: true, whiteIndex: wi });
      wi++;
    }
  }
  keys.push({ note: `C${from + octaves}`, letter: 'C', octave: from + octaves, black: false, whiteIndex: wi });
  return keys;
}

export function midi(note: string): number {
  const m = /^([A-G])(#?)(\d)$/.exec(note);
  if (!m) throw new Error(`Bad note ${note}`);
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1] as Letter] + (m[2] ? 1 : 0);
}
export const frequency = (note: string) => 440 * Math.pow(2, (midi(note) - 69) / 12);
export const noteName = (note: string) => SOLFEGE[note[0] as Letter] + (note.includes('#') ? '♯' : '');

export type SongNote = { note: string; long: boolean; pauseAfter: boolean };
export type Song = { id: string; title: string; emoji: string; notes: SongNote[] };

/** Запис пісні: «C4 C4 G4-» (мінус — довга нота), «|» — пауза між рядками. */
export function parseSong(src: string): SongNote[] {
  const out: SongNote[] = [];
  for (const tok of src.trim().split(/\s+/)) {
    if (tok === '|') { if (out.length) out[out.length - 1].pauseAfter = true; continue; }
    const long = tok.endsWith('-');
    out.push({ note: long ? tok.slice(0, -1) : tok, long, pauseAfter: false });
  }
  return out;
}

export const SONGS: Song[] = [
  { id: 'star', title: 'Зірочка', emoji: '⭐', notes: parseSong(
    'C4 C4 G4 G4 A4 A4 G4- | F4 F4 E4 E4 D4 D4 C4- | G4 G4 F4 F4 E4 E4 D4- | G4 G4 F4 F4 E4 E4 D4- | C4 C4 G4 G4 A4 A4 G4- | F4 F4 E4 E4 D4 D4 C4-') },
  { id: 'shchedryk', title: 'Щедрик (початок)', emoji: '🔔', notes: parseSong(
    'C5 B4 C5 A4- | C5 B4 C5 A4- | C5 B4 C5 A4- | C5 B4 C5 A4-') },
  { id: 'joy', title: 'Ода до радості', emoji: '🎶', notes: parseSong(
    'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4- | E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4-') },
  { id: 'bells', title: 'Дзвіночки', emoji: '🛷', notes: parseSong(
    'E4 E4 E4- E4 E4 E4- E4 G4 C4 D4 E4- | F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4- G4-') },
  { id: 'birthday', title: 'З днем народження', emoji: '🎂', notes: parseSong(
    'G4 G4 A4- G4- C5- B4- | G4 G4 A4- G4- D5- C5- | G4 G4 G5- E5- C5- B4- A4- | F5 F5 E5- C5- D5- C5-') },
];

/** Перший рядок «Зірочки» — для пригоди Міри. */
export const MIRA_MELODY = SONGS[0].notes.slice(0, 7);

/** «Повторюй за мною»: нова випадкова нота в межах до–соль першої октави. */
export const SIMON_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4'];
export function extendSequence(seq: string[], rng: () => number = Math.random): string[] {
  let n: string;
  do { n = SIMON_NOTES[Math.floor(rng() * SIMON_NOTES.length) % SIMON_NOTES.length]; } while (seq.length > 0 && n === seq[seq.length - 1] && rng() < 0.7);
  return [...seq, n];
}
