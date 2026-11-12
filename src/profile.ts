import { LearningRecord, newRecord, nextDifficulty } from './learning';
import { MathLevel } from './math';

export type ResultKind = 'adventure' | 'math' | 'reading' | 'assessment';
export type Result = {
  date: string; kind: ResultKind; correct: number; total: number; wpm?: number; errors: string[];
  stars?: number; storyId?: string;
};
export type Profile = {
  name: string; age: string; interest: string;
  record: LearningRecord; results: Result[];
  completed: number; minutes: number; onboarded: boolean;
  mathLevel: MathLevel; mathHistory: boolean[];
  stars: number; stickers: string[]; bestStreak: number;
};

export const PROFILE_KEY = 'cazka.profile.v2';
export const SETTINGS_KEY = 'cazka.settings';

const levelFromAge = (age: string): MathLevel => (Number(age) <= 5 ? 1 : 2);

export function newProfile(name: string, age: string, interest: string): Profile {
  return {
    name, age, interest, record: newRecord(), results: [], completed: 0, minutes: 0, onboarded: false,
    mathLevel: levelFromAge(age), mathHistory: [], stars: 0, stickers: [], bestStreak: 0,
  };
}

/** Читає збережений профіль, у тому числі старої версії застосунку (без зірок і наліпок). */
export function migrate(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<Profile>;
  if (!a.name || !a.record || !Array.isArray(a.results)) return null;
  const legacyLevel: MathLevel = { easy: 1, medium: 2, hard: 3 }[nextDifficulty(a.record.arithmetic)] as MathLevel;
  const level = [1, 2, 3, 4, 5].includes(Number(a.mathLevel)) ? (Number(a.mathLevel) as MathLevel) : legacyLevel;
  return {
    name: a.name, age: a.age ?? '6', interest: a.interest ?? 'Тварини', record: a.record, results: a.results,
    completed: a.completed ?? 0, minutes: a.minutes ?? 0, onboarded: !!a.onboarded,
    mathLevel: level, mathHistory: Array.isArray(a.mathHistory) ? a.mathHistory : [],
    stars: a.stars ?? a.record.arithmetic.correct + a.record.reading.correct,
    stickers: Array.isArray(a.stickers) ? a.stickers : [], bestStreak: a.bestStreak ?? 0,
  };
}

/** Рівень читання 0/1/2 за точністю відповідей. */
export const readingLevel = (p: Profile): 0 | 1 | 2 => ({ easy: 0, medium: 1, hard: 2 } as const)[nextDifficulty(p.record.reading)];
