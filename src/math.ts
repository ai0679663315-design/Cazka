/**
 * Математика для першого класу: додавання (і трохи віднімання) в межах 20.
 * Усі функції чисті: випадковість передається параметром, щоб їх можна було тестувати.
 */

import { genderOf, numberWords } from './words';

export type MathLevel = 1 | 2 | 3 | 4 | 5;
export type Rng = () => number;

export const LEVELS: Record<MathLevel, { title: string; short: string; description: string }> = {
  1: { title: 'Рахуємо до 5', short: 'до 5', description: 'Додаємо предмети, сума не більша за 5.' },
  2: { title: 'Додаємо до 10', short: 'до 10', description: 'Додавання в межах 10, будиночки чисел, порівняння.' },
  3: { title: 'Склад числа до 10', short: 'склад до 10', description: 'Пропущене число, склад числа, трохи віднімання в межах 10.' },
  4: { title: 'Числа до 20', short: 'до 20', description: 'Додавання до 20 без переходу через десяток: 12 + 5, 10 + 7.' },
  5: { title: 'Через десяток', short: 'через 10', description: 'Додавання з переходом через десяток: 8 + 5 = 8 + 2 + 3.' },
};

/** Іменник у трьох формах: 1 яблуко, 2 яблука, 5 яблук. */
export type Noun = { forms: [string, string, string]; emoji: string };

export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
export const countOf = (n: number, noun: Noun) => `${n} ${plural(n, noun.forms)}`;
/** Те саме словами з правильним родом — для голосу: «дві кульки», «одне яблуко». */
export const sayCount = (n: number, noun: Noun) => `${numberWords(n, genderOf(noun.forms[0]))} ${plural(n, noun.forms)}`;

export type TaskKind = 'count' | 'choose' | 'missing' | 'house' | 'word' | 'compare' | 'subtract';

export type MathTask = {
  id: string;
  kind: TaskKind;
  level: MathLevel;
  /** Головне питання на екрані. */
  prompt: string;
  /** Текст задачі-розповіді (для kind=word). */
  story?: string;
  /** Що вимовити вголос. */
  spoken: string;
  /** Запис прикладу, наприклад «4 + ? = 7». */
  equation?: string;
  /** Повний правильний запис, показуємо після відповіді. */
  solution: string;
  answer: number | string;
  options: (number | string)[];
  /** Картинки: групи предметів (для рахунку і як підказка). */
  picture?: { emoji: string; groups: number[]; crossed?: number };
  /** Числовий будиночок: дах і два віконця, null — пропущене. */
  house?: { top: number; left: number | null; right: number | null };
  /** Підказка після першої помилки. */
  hint: string;
  /** Намистинки-підказка: скільки червоних і синіх (або закреслених). */
  beads: { first: number; second: number; op: '+' | '-'; hidden?: boolean };
  /** Короткий опис для батьків у списку помилок. */
  label: string;
};

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length];
export function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Пара доданків для рівня. Гарантує межі рівня. */
export function addPair(level: MathLevel, rng: Rng): [number, number] {
  switch (level) {
    case 1: { const s = int(rng, 2, 5); const a = int(rng, 1, s - 1); return [a, s - a]; }
    case 2: { const s = int(rng, 3, 10); const a = int(rng, 1, s - 1); return [a, s - a]; }
    case 3: { const s = int(rng, 4, 10); const a = int(rng, 1, s - 1); return [a, s - a]; }
    case 4: {
      // 10 + b або 1x + b без переходу через десяток
      if (rng() < 0.3) { const b = int(rng, 1, 9); return rng() < 0.5 ? [10, b] : [b, 10]; }
      const u = int(rng, 1, 7); const a = 10 + u; const b = int(rng, 1, 9 - u); return [a, b];
    }
    case 5: { const a = int(rng, 2, 9); const b = int(rng, Math.max(2, 11 - a), 9); return [a, b]; }
  }
}

/** Варіанти відповіді: правильна + 3 близькі, без повторів, у межах 0..20. */
export function numberOptions(answer: number, rng: Rng, count = 4, max = 20): number[] {
  const set = new Set<number>([answer]);
  const near = shuffle([answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3, answer + 10, answer - 10], rng);
  for (const n of near) { if (set.size >= count) break; if (n >= 0 && n <= max) set.add(n); }
  let k = 0; while (set.size < count) { if (!set.has(k)) set.add(k); k++; }
  return shuffle([...set], rng);
}

const BASIC_NOUNS: Noun[] = [
  { emoji: '🍎', forms: ['яблуко', 'яблука', 'яблук'] },
  { emoji: '🍓', forms: ['полуниця', 'полуниці', 'полуниць'] },
  { emoji: '🎈', forms: ['кулька', 'кульки', 'кульок'] },
  { emoji: '⭐', forms: ['зірочка', 'зірочки', 'зірочок'] },
  { emoji: '🐞', forms: ['сонечко', 'сонечка', 'сонечок'] },
  { emoji: '🍄', forms: ['гриб', 'гриби', 'грибів'] },
  { emoji: '🐟', forms: ['рибка', 'рибки', 'рибок'] },
  { emoji: '🌸', forms: ['квітка', 'квітки', 'квіток'] },
  { emoji: '🧁', forms: ['тістечко', 'тістечка', 'тістечок'] },
  { emoji: '🚗', forms: ['машинка', 'машинки', 'машинок'] },
];
const HEROES = [
  { gen: 'їжачка', name: 'Їжачок' }, { gen: 'зайчика', name: 'Зайчик' }, { gen: 'білочки', name: 'Білочка' },
  { gen: 'ведмежатка', name: 'Ведмежатко' }, { gen: 'котика', name: 'Котик' }, { gen: 'совеняти', name: 'Совеня' },
];

/** Шаблони задач-розповідей. {a},{b},{sum} — число з іменником, {gen} — «яблук», {who} — «їжачка». */
export type WordTemplates = { add: string[]; missing?: string[]; take?: string[] };
const GENERIC_TEMPLATES: WordTemplates = {
  add: [
    'У {who} є {a}, а в кошику — ще {b}. Скільки {gen} разом?',
    'На столі — {a}, а на полиці — ще {b}. Скільки {gen} всього?',
    'Біля хатинки — {a}, а біля річки — ще {b}. Скільки {gen} разом?',
  ],
  missing: [
    'У кошику має бути {sum}. Там уже лежить {a}. Скільки ще треба покласти?',
    'У {who} є {a}. Скільки ще треба, щоб стало {sum}?',
  ],
};

let counter = 0;
const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

const crossHint = (a: number, b: number) => {
  const big = Math.max(a, b), small = Math.min(a, b);
  const toTen = 10 - big, rest = small - toTen;
  return `Доповни до десяти: ${big} + ${toTen} = 10, а потім ще ${rest}. Виходить 10 + ${rest} = ${big + small}.`;
};
const addHint = (a: number, b: number, level: MathLevel) =>
  level === 5 && a + b > 10 ? crossHint(a, b)
    : level === 4 ? `Спочатку додай одиниці: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}, а десяток залишається. Буде ${a + b}.`
    : `Почни з більшого числа ${Math.max(a, b)} і порахуй далі ще ${Math.min(a, b)}: ${Array.from({ length: Math.min(a, b) }, (_, i) => Math.max(a, b) + i + 1).join(', ')}.`;

export type TaskOptions = { kind?: TaskKind; noun?: Noun; templates?: WordTemplates; who?: string };

/** Типи завдань, доступні на рівні. */
export function kindsFor(level: MathLevel): TaskKind[] {
  switch (level) {
    case 1: return ['count', 'count', 'choose', 'word'];
    case 2: return ['count', 'choose', 'word', 'house', 'compare'];
    case 3: return ['missing', 'house', 'word', 'subtract', 'choose', 'compare'];
    case 4: return ['choose', 'word', 'missing', 'compare', 'subtract'];
    case 5: return ['choose', 'word', 'missing', 'house', 'compare'];
  }
}

const fill = (tpl: string, v: { a: number; b: number; sum: number; noun: Noun; who: string }, forVoice = false) => {
  const c = (n: number) => (forVoice ? sayCount : countOf)(n, v.noun);
  return tpl.replace(/\{a\}/g, c(v.a)).replace(/\{b\}/g, c(v.b))
    .replace(/\{b2\}/g, c(v.b).replace(/^./, ch => ch.toUpperCase()))
    .replace(/\{sum\}/g, c(v.sum)).replace(/\{gen\}/g, v.noun.forms[2]).replace(/\{who\}/g, v.who);
};

/** Головна функція: створює завдання для рівня. */
export function makeTask(level: MathLevel, rng: Rng = Math.random, opts: TaskOptions = {}): MathTask {
  const kind = opts.kind ?? pick(rng, kindsFor(level));
  const noun = opts.noun ?? pick(rng, BASIC_NOUNS);
  const hero = pick(rng, HEROES);
  const who = opts.who ?? hero.gen;
  const [a, b] = addPair(level, rng);
  const sum = a + b;
  const id = newId();
  const small = sum <= 10;
  const maxN = level === 1 ? 6 : level <= 3 ? 10 : 20;
  const picture = small ? { emoji: noun.emoji, groups: [a, b] } : undefined;
  const base = { id, level, beads: { first: a, second: b, op: '+' as const } };

  switch (kind) {
    case 'count':
      return { ...base, kind, prompt: `Скільки всього ${noun.forms[2]}?`, spoken: `Давай порахуємо! Скільки тут усього ${noun.forms[2]}?`,
        picture: { emoji: noun.emoji, groups: [Math.min(a, 10), Math.min(b, 10)] }, answer: sum, options: numberOptions(sum, rng, 4, maxN),
        solution: `${a} + ${b} = ${sum}`, hint: `Торкайся кожного предмета пальчиком і рахуй уголос: один, два, три…`, label: `Порахуй предмети ${a} + ${b}` };
    case 'choose':
      return { ...base, kind, prompt: 'Скільки буде?', equation: `${a} + ${b} = ?`, spoken: `Скільки буде ${a} плюс ${b}?`,
        answer: sum, options: numberOptions(sum, rng, 4, maxN), solution: `${a} + ${b} = ${sum}`, hint: addHint(a, b, level), label: `${a} + ${b}` };
    case 'missing': {
      const hideFirst = rng() < 0.4;
      const ans = hideFirst ? a : b;
      return { ...base, kind, prompt: 'Яке число сховалося?',
        equation: hideFirst ? `? + ${b} = ${sum}` : `${a} + ? = ${sum}`,
        spoken: hideFirst ? `Тут сховалося число. Яке число треба додати до ${b}, щоб вийшло ${sum}?` : `Тут сховалося число. ${a} плюс скільки — буде ${sum}?`,
        beads: { first: hideFirst ? b : a, second: ans, op: '+', hidden: true },
        answer: ans, options: numberOptions(ans, rng, 4, maxN), solution: `${a} + ${b} = ${sum}`,
        hint: `Рахуй від ${hideFirst ? b : a} до ${sum} і загинай пальчики: скільки пальчиків загнулося?`, label: hideFirst ? `? + ${b} = ${sum}` : `${a} + ? = ${sum}` };
    }
    case 'house': {
      const leftHidden = rng() < 0.5;
      const ans = leftHidden ? a : b;
      return { ...base, kind, prompt: 'Засели будиночок!', spoken: `У цьому будиночку живе число ${sum}. В одному віконці — ${leftHidden ? b : a}. А хто живе в другому?`,
        house: { top: sum, left: leftHidden ? null : a, right: leftHidden ? b : null },
        beads: { first: leftHidden ? b : a, second: ans, op: '+', hidden: true },
        answer: ans, options: numberOptions(ans, rng, 4, maxN), solution: `${sum} = ${a} + ${b}`,
        hint: `На даху число ${sum}. У віконцях два числа, які разом дають ${sum}.`, label: `Склад числа ${sum} = ${leftHidden ? '?' : a} + ${leftHidden ? b : '?'}` };
    }
    case 'compare': {
      const right = Math.max(0, sum + pick(rng, [-1, 0, 1, -2, 2]));
      const sign = sum > right ? '>' : sum < right ? '<' : '=';
      return { ...base, kind, prompt: 'Який знак поставити?', equation: `${a} + ${b}  ◯  ${right}`,
        spoken: `Порівняй: ${a} плюс ${b} і ${right}. Більше, менше чи дорівнює?`,
        answer: sign, options: ['<', '=', '>'], solution: `${a} + ${b} = ${sum}, тому ${a} + ${b} ${sign} ${right}`,
        hint: `Спочатку порахуй ${a} + ${b}. Потім порівняй з числом ${right}. Дзьобик знака дивиться на менше число.`, label: `${a} + ${b} ◯ ${right}` };
    }
    case 'subtract': {
      const takes = opts.templates?.take;
      const tplTake = takes?.length ? pick(rng, takes) : undefined;
      const story = tplTake ? fill(tplTake, { a, b, sum, noun, who }) : undefined;
      const storyVoice = tplTake ? fill(tplTake, { a, b, sum, noun, who }, true) : undefined;
      return { ...base, kind, prompt: 'Скільки залишилось?', story,
        equation: `${sum} − ${b} = ?`, spoken: storyVoice ?? `Було ${sum}, забрали ${b}. Скільки залишилось?`,
        picture: small ? { emoji: noun.emoji, groups: [sum], crossed: b } : undefined,
        beads: { first: sum, second: b, op: '-' },
        answer: a, options: numberOptions(a, rng, 4, maxN), solution: `${sum} − ${b} = ${a}`,
        hint: `Було ${sum}. Закресли ${b} і порахуй, скільки залишилось. Або подумай: ${b} + ? = ${sum}.`, label: `${sum} − ${b}` };
    }
    case 'word':
    default: {
      const t = opts.templates ?? GENERIC_TEMPLATES;
      const useMissing = level >= 3 && !!t.missing?.length && rng() < 0.4;
      const tpl = pick(rng, useMissing ? t.missing! : t.add);
      const story = fill(tpl, { a, b, sum, noun, who });
      const storyVoice = fill(tpl, { a, b, sum, noun, who }, true);
      const ans = useMissing ? b : sum;
      return { ...base, kind: 'word', prompt: useMissing ? 'Скільки ще треба?' : 'Скільки разом?', story, spoken: storyVoice,
        picture: level <= 2 && !useMissing ? picture : undefined,
        beads: { first: a, second: b, op: '+', hidden: useMissing },
        answer: ans, options: numberOptions(ans, rng, 4, maxN), solution: `${a} + ${b} = ${sum}`,
        hint: useMissing ? `Було ${a}, а треба ${sum}. Рахуй від ${a} до ${sum}.` : addHint(a, b, level),
        label: useMissing ? `Задача: ${a} + ? = ${sum}` : `Задача: ${a} + ${b}` };
    }
  }
}

/** Чи правильна відповідь (приймає числа і рядки). */
export const isCorrect = (task: MathTask, given: number | string) => String(task.answer) === String(given);

/**
 * Адаптація рівня за останніми відповідями з першої спроби.
 * 4 з 5 останніх правильно → рівень вище; 3 з 4 останніх неправильно → рівень нижче.
 */
export function adaptLevel(level: MathLevel, history: boolean[], firstTryOk: boolean): { level: MathLevel; history: boolean[] } {
  const h = [...history, firstTryOk].slice(-6);
  const last5 = h.slice(-5), last4 = h.slice(-4);
  if (last5.length === 5 && last5.filter(Boolean).length >= 4 && level < 5) return { level: (level + 1) as MathLevel, history: [] };
  if (last4.length === 4 && last4.filter(x => !x).length >= 3 && level > 1) return { level: (level - 1) as MathLevel, history: [] };
  return { level, history: h };
}

/** Рівень після стартової перевірки: скільки завдань розв'язано з першої спроби. */
export const levelFromAssessment = (firstTryCorrect: number): MathLevel => Math.max(1, Math.min(4, firstTryCorrect)) as MathLevel;

export const PRAISE = ['Чудово!', 'Так тримати!', 'Супер!', 'Правильно!', 'Ти молодець!', 'Блискуче!', 'Ура, вийшло!', 'Точно в ціль!'];
export const TRY_AGAIN = ['Майже! Подивись на підказку й спробуй ще раз.', 'Ще одна спроба! Підказка вже тут.', 'Не біда! Давай разом подумаємо.'];
