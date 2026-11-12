import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { C, s } from './theme';
import { MathTask, isCorrect, PRAISE, TRY_AGAIN, shuffle } from './math';
import { normalizeAnswer } from './learning';
import type { Question } from './stories';

const pickOne = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export type Say = (text: string) => void;
export type Tone = (kind: 'good' | 'soft' | 'win') => void;
const noTone: Tone = () => undefined;
export type Voice = { listening: boolean; listen: (cb: (t: string) => void) => void; stop: () => void };

export function Button({ children, onPress, secondary = false, disabled = false, big = false }:
  { children: React.ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean; big?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.button, secondary && s.secondary, big && k.bigButton, disabled && { opacity: .45 }, pressed && { opacity: .75, transform: [{ scale: .98 }] }]}>
      <Text style={[s.buttonText, secondary && s.secondaryText, big && { fontSize: 18 }]}>{children}</Text>
    </Pressable>
  );
}

/** Святковий рядок, що «вистрибує» при правильній відповіді. */
export function Celebrate({ text, emoji = '🎉 ⭐ 🎉' }: { text: string; emoji?: string }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => { Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false }).start(); }, [scale]);
  return (
    <Animated.View style={[k.celebrate, { transform: [{ scale }] }]}>
      <Text style={{ fontSize: 34 }}>{emoji}</Text>
      <Text style={k.celebrateText}>{text}</Text>
    </Animated.View>
  );
}

/**
 * Предмети для рахунку: групи з «+» між ними; закреслені — для віднімання.
 * Предмет можна торкнутися — на ньому з'явиться його номер (рахуємо пальчиком).
 */
export function Picture({ emoji, groups, crossed = 0, onCount }: { emoji: string; groups: number[]; crossed?: number; onCount?: (n: number) => void }) {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const tap = (key: string) => {
    if (marks[key]) return;
    const n = Object.keys(marks).length + 1;
    setMarks({ ...marks, [key]: n });
    onCount?.(n);
  };
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={k.picture} accessibilityLabel={`Малюнок: ${groups.join(' і ')}`}>
        {groups.map((g, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <Text style={k.plus}>+</Text>}
            <View style={k.group}>
              {Array.from({ length: g }, (_, i) => {
                const isCrossed = gi === groups.length - 1 && i >= g - crossed;
                const key = `${gi}-${i}`;
                return (
                  <Pressable key={i} onPress={() => tap(key)} accessibilityLabel="Порахувати предмет" style={k.item}>
                    <Text style={[k.itemEmoji, (isCrossed || !!marks[key]) && { opacity: isCrossed ? .3 : .55 }]}>{emoji}</Text>
                    {isCrossed && <Text style={k.cross}>✕</Text>}
                    {!!marks[key] && !isCrossed && <View style={k.mark}><Text style={k.markText}>{marks[key]}</Text></View>}
                  </Pressable>
                );
              })}
            </View>
          </React.Fragment>
        ))}
      </View>
      <Text style={s.small}>{Object.keys(marks).length ? `Порахувано: ${Object.keys(marks).length}` : '👆 Торкайся предметів, щоб рахувати'}</Text>
    </View>
  );
}

/** Намистинки по 10 у рядку (5 + 5) — наочна підказка для додавання і віднімання. */
export function Beads({ first, second, op, hidden = false }: { first: number; second: number; op: '+' | '-'; hidden?: boolean }) {
  const total = op === '+' ? first + second : first;
  const rows = Math.ceil(total / 10);
  return (
    <View style={{ gap: 8, alignItems: 'center' }} accessibilityLabel="Намистинки-підказка">
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={k.beadRow}>
          {Array.from({ length: 10 }, (_, c) => {
            const i = r * 10 + c;
            const exists = i < total;
            const isSecond = op === '+' ? i >= first : i >= first - second;
            const unknown = hidden && isSecond && exists;
            const color = !exists || unknown ? 'transparent' : op === '+' ? (isSecond ? C.blue : C.red) : C.red;
            return (
              <View key={c} style={[k.bead, { backgroundColor: color, borderColor: unknown ? C.blue : exists ? 'transparent' : '#E3E5DA', borderStyle: unknown ? 'dashed' : 'solid', marginLeft: c === 5 ? 10 : 0 }, op === '-' && isSecond && exists && { opacity: .25 }]}>
                {op === '-' && isSecond && exists && <Text style={k.beadCross}>✕</Text>}
              </View>
            );
          })}
        </View>
      ))}
      <Text style={s.small}>{op === '-' ? `Було ${first}, закреслили ${second}` : hidden ? `🔴 ${first}  +  ◌ скільки? = ${total}` : `🔴 ${first}  +  🔵 ${second}`}</Text>
    </View>
  );
}

/** Числовий будиночок: число на даху складається з двох чисел у віконцях. */
export function House({ top, left, right, reveal }: { top: number; left: number | null; right: number | null; reveal?: number | string }) {
  const cell = (v: number | null) => (
    <View style={[k.window, v === null && k.windowEmpty]}>
      <Text style={k.windowText}>{v === null ? (reveal ?? '?') : v}</Text>
    </View>
  );
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={`Будиночок числа ${top}`}>
      <View style={k.roof}><Text style={k.roofText}>{top}</Text></View>
      <View style={k.houseBody}>{cell(left)}{cell(right)}</View>
    </View>
  );
}

const KIND_BADGE: Record<MathTask['kind'], string> = {
  count: '🍎 РАХУЄМО ПРЕДМЕТИ', choose: '➕ ДОДАЄМО', missing: '🔍 ЗАГАДКОВЕ ЧИСЛО', house: '🏠 БУДИНОЧОК ЧИСЛА',
  word: '📖 ЗАДАЧА', compare: '⚖️ ПОРІВНЯЙ', subtract: '➖ СКІЛЬКИ ЗАЛИШИЛОСЬ',
};
const COMPARE_LABEL: Record<string, string> = { '<': 'менше', '=': 'дорівнює', '>': 'більше' };

/**
 * Одне завдання. Перша помилка → підказка й друга спроба; друга помилка → показуємо розв'язок.
 * onResolved викликається один раз: ok = правильно з першої спроби.
 */
export function MathCard({ task, say, voice, onResolved, onNext, nextLabel = 'Далі →', tone = noTone }:
  { task: MathTask; say: Say; voice: Voice; tone?: Tone; onResolved: (firstTryOk: boolean, given: string, solvedLater: boolean) => void; onNext: () => void; nextLabel?: string }) {
  const [wrong, setWrong] = useState<(number | string)[]>([]);
  const [done, setDone] = useState<null | 'first' | 'second' | 'shown'>(null);
  const [message, setMessage] = useState('');
  const [voiceMsg, setVoiceMsg] = useState('');
  const shake = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const tile = Math.max(64, Math.min(width > 600 ? 112 : 92, Math.floor((width - 80) / 4)));
  const praise = useMemo(() => pickOne(PRAISE), [task.id]);

  useEffect(() => { say(task.spoken); }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doShake = () => Animated.sequence([10, -10, 7, -7, 0].map(v => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: false }))).start();

  const choose = (opt: number | string) => {
    if (done || wrong.includes(opt)) return;
    if (isCorrect(task, opt)) {
      const first = wrong.length === 0;
      setDone(first ? 'first' : 'second');
      tone('good');
      say(first ? praise : 'Так! Тепер правильно!');
      onResolved(first, String(opt), !first);
      return;
    }
    doShake();
    tone('soft');
    const nextWrong = [...wrong, opt];
    setWrong(nextWrong);
    if (nextWrong.length >= 2) {
      setDone('shown');
      setMessage(`Правильна відповідь — ${task.kind === 'compare' ? `«${task.answer}» (${COMPARE_LABEL[task.answer]})` : task.answer}. ${task.solution}.`);
      say(`Правильна відповідь ${task.kind === 'compare' ? COMPARE_LABEL[task.answer] : task.answer}. Наступного разу вийде!`);
      onResolved(false, wrong.concat(opt).join(' / '), false);
    } else {
      const t = pickOne(TRY_AGAIN);
      setMessage(t);
      say(`${t} ${task.hint}`);
    }
  };

  const listenAnswer = () => {
    setVoiceMsg('');
    if (voice.listening) { voice.stop(); return; }
    voice.listen(text => {
      const n = normalizeAnswer(text);
      const lowered = text.toLowerCase();
      const cmp = /більш/.test(lowered) ? '>' : /менш/.test(lowered) ? '<' : /дорівн|рівн/.test(lowered) ? '=' : null;
      const value = task.kind === 'compare' ? cmp : n;
      if (value === null || !task.options.map(String).includes(String(value))) { setVoiceMsg(`Чую: «${text}». Натисни на картку з відповіддю.`); return; }
      choose(task.options.find(o => String(o) === String(value))!);
    });
  };

  const showHint = wrong.length > 0;
  const reveal = done ? task.answer : undefined;
  const hasPicture = !!task.picture && (task.kind === 'count' || task.kind === 'word' || task.kind === 'subtract');

  return (
    <View style={{ gap: 18 }}>
      <Text style={k.badge}>{KIND_BADGE[task.kind]}</Text>
      {!!task.story && <Text style={k.story}>{task.story}</Text>}
      <Text style={s.title}>{task.prompt}</Text>

      {(hasPicture || !!task.house || !!task.equation) && <View style={k.board}>
        {hasPicture && <Picture {...task.picture!} onCount={n => say(String(n))} />}
        {task.house && <House {...task.house} reveal={reveal} />}
        {!!task.equation && !task.house && (
          <Text style={s.equation}>{reveal !== undefined ? task.equation.replace('?', String(reveal)).replace('◯', String(reveal)) : task.equation}</Text>
        )}
      </View>}

      <Animated.View style={[k.options, { transform: [{ translateX: shake }] }]}>
        {task.options.map(o => {
          const isWrong = wrong.includes(o);
          const isRight = !!done && isCorrect(task, o);
          return (
            <Pressable key={String(o)} accessibilityRole="button" accessibilityLabel={`Відповідь ${task.kind === 'compare' ? COMPARE_LABEL[o] : o}`}
              disabled={!!done || isWrong} onPress={() => choose(o)}
              style={({ pressed }) => [k.option, { width: tile, height: tile + 4 }, isWrong && k.optionWrong, isRight && k.optionRight, pressed && { transform: [{ scale: .95 }] }]}>
              <Text style={[k.optionText, { fontSize: Math.round(tile * .42) }, isWrong && { color: C.bad }, isRight && { color: C.good }]}>{o}</Text>
              {task.kind === 'compare' && <Text style={k.optionSub}>{COMPARE_LABEL[o]}</Text>}
              {isWrong && <Text style={k.optionMark}>✗</Text>}
              {isRight && <Text style={k.optionMark}>✓</Text>}
            </Pressable>
          );
        })}
      </Animated.View>

      {!done && (
        <View style={k.tools}>
          <Pressable accessibilityRole="button" onPress={() => say(task.spoken)} style={k.tool}><Text style={k.toolText}>🔊 Послухати</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={listenAnswer} style={k.tool}><Text style={k.toolText}>{voice.listening ? '◼ Зупинити' : '🎤 Сказати'}</Text></Pressable>
        </View>
      )}
      {!!voiceMsg && !done && <Text style={s.muted}>{voiceMsg}</Text>}

      {showHint && !done && (
        <View style={k.hint}>
          <Text style={k.hintTitle}>💡 {message}</Text>
          <Text style={s.muted}>{task.hint}</Text>
          {task.kind !== 'count' && task.beads.first + (task.beads.op === '+' ? task.beads.second : 0) <= 20 && <Beads {...task.beads} />}
        </View>
      )}

      {done === 'first' && <Celebrate text={`${praise} +1 ⭐`} />}
      {done === 'second' && <Celebrate text="Вийшло з другої спроби! Молодець!" emoji="💪 ✨" />}
      {done === 'shown' && (
        <View style={k.hint}>
          <Text style={k.hintTitle}>🤗 Нічого страшного!</Text>
          <Text style={s.muted}>{message}</Text>
          <Beads {...task.beads} hidden={false} />
        </View>
      )}
      {done && done !== 'shown' && (task.kind === 'word' || task.kind === 'count' || done === 'second') && <Text style={k.solution}>{task.solution}</Text>}
      {done && <Button big onPress={onNext}>{nextLabel}</Button>}
    </View>
  );
}

/** Читання з таймером і питанням на розуміння (дві спроби). */
export function ReadingCard({ passage, question, say, onResolved, onNext, nextLabel = 'Далі →', tone = noTone }:
  { passage: string; question: Question; say: Say; tone?: Tone; onResolved: (firstTryOk: boolean, wpm: number | undefined) => void; onNext: () => void; nextLabel?: string }) {
  const [phase, setPhase] = useState<'ready' | 'reading' | 'question'>('ready');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [wpm, setWpm] = useState<number | undefined>();
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState<null | 'first' | 'second' | 'shown'>(null);
  const order = useMemo(() => shuffle([0, 1, 2], Math.random), [passage]);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const stop = () => {
    const elapsed = Math.max(1, (Date.now() - (startedAt ?? Date.now())) / 1000);
    const words = passage.split(/\s+/).filter(w => /[\p{L}\d]/u.test(w)).length;
    const value = Math.round(words * 60 / elapsed);
    setSeconds(Math.round(elapsed)); setWpm(value); setStartedAt(null); setPhase('question');
    say(question.q);
  };
  const answer = (i: number) => {
    if (done) return;
    const opt = question.options[i];
    if (i === 0) {
      const first = wrong.length === 0;
      setDone(first ? 'first' : 'second'); tone('good'); say(first ? pickOne(PRAISE) : 'Так, правильно!');
      onResolved(first, wpm);
    } else {
      const w = [...wrong, opt]; setWrong(w); tone('soft');
      if (w.length >= 2) { setDone('shown'); say(`Правильна відповідь: ${question.options[0]}`); onResolved(false, wpm); }
      else say('Подивись у текст ще раз. Там є відповідь!');
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <Text style={k.badge}>📖 ЧИТАЄМО</Text>
      <View style={s.readingBoard}><Text style={s.readingText}>{passage}</Text></View>
      {phase !== 'question' && <Text style={s.timer}>◷ {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text>}
      {phase === 'ready' && <><Text style={s.muted}>Натисни «Почати», прочитай текст уголос, а потім натисни «Прочитано!».</Text>
        <Button big onPress={() => { const now = Date.now(); setStartedAt(now); setSeconds(0); setPhase('reading'); }}>▶ Почати читання</Button></>}
      {phase === 'reading' && <Button big onPress={stop}>✓ Прочитано!</Button>}
      {phase === 'question' && <>
        <Text style={s.sectionTitle}>{question.q}</Text>
        <View style={{ gap: 10 }}>
          {order.map(i => {
            const o = question.options[i];
            const isWrong = wrong.includes(o), isRight = !!done && i === 0;
            return (
              <Pressable key={o} accessibilityRole="button" disabled={!!done || isWrong} onPress={() => answer(i)}
                style={({ pressed }) => [k.readOption, isWrong && k.optionWrong, isRight && k.optionRight, pressed && { opacity: .8 }]}>
                <Text style={[k.readOptionText, isWrong && { color: C.bad }, isRight && { color: C.good }]}>{isRight ? '✓ ' : isWrong ? '✗ ' : ''}{o}</Text>
              </Pressable>
            );
          })}
        </View>
        {wrong.length === 1 && !done && <Text style={k.hintTitle}>💡 Подивись у текст ще раз — відповідь там є!</Text>}
        {done === 'first' && <Celebrate text="Уважне читання! +1 ⭐" emoji="📚 ⭐ 📚" />}
        {done === 'second' && <Celebrate text="Знайшли відповідь у тексті!" emoji="🔎 ✨" />}
        {done === 'shown' && <Text style={s.feedback}>Правильна відповідь — «{question.options[0]}». Прочитаймо ще раз разом!</Text>}
        {wpm !== undefined && <Text style={s.small}>Час читання: {seconds} с · близько {wpm} слів за хвилину. Правильність вимови перевіряє дорослий.</Text>}
        {!!done && <Button secondary onPress={() => say(passage)}>🔊 Послухати текст</Button>}
        {!!done && <Button big onPress={onNext}>{nextLabel}</Button>}
      </>}
    </View>
  );
}

/** Вихід із заняття з підтвердженням, щоб дитина випадково не загубила пригоду. */
export function ExitLink({ label, onExit }: { label: string; onExit: () => void }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 4000); return () => clearTimeout(t); }, [ask]);
  return (
    <Pressable accessibilityRole="button" onPress={() => (ask ? onExit() : setAsk(true))} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
      <Text style={[s.back, ask && { color: C.bad, fontWeight: '700' }]}>{ask ? 'Точно вийти? Натисни ще раз' : label}</Text>
    </Pressable>
  );
}

/** Доріжка пригоди: кружечки сцен і герой, що йде вперед. */
export function PathProgress({ icons, index, hero }: { icons: string[]; index: number; hero: string }) {
  return (
    <View style={k.path} accessibilityLabel={`Крок ${index + 1} з ${icons.length}`}>
      {icons.map((ic, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={[k.pathLine, i <= index && { backgroundColor: '#9DB27E' }]} />}
          <View style={[k.pathDot, i < index && k.pathDone, i === index && k.pathNow]}>
            <Text style={{ fontSize: i === index ? 22 : 14 }}>{i === index ? hero : i < index ? '✓' : ic}</Text>
          </View>
        </React.Fragment>
      ))}
      <View style={[k.pathLine, index >= icons.length && { backgroundColor: '#9DB27E' }]} />
      <View style={k.pathDot}><Text style={{ fontSize: 16 }}>🏁</Text></View>
    </View>
  );
}

export const k = StyleSheet.create({
  bigButton: { paddingVertical: 20, borderRadius: 18 },
  badge: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#8A917C' },
  story: { fontSize: 22, lineHeight: 34, color: '#4E5F44' },
  board: { padding: 22, borderRadius: 24, backgroundColor: '#F4F1E4', gap: 16, alignItems: 'center', minHeight: 110, justifyContent: 'center' },
  picture: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10 },
  group: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: 260, justifyContent: 'center', padding: 8, borderRadius: 16, backgroundColor: '#FFFFFFAA', gap: 2 },
  item: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', top: 2, right: 0, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  markText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  itemEmoji: { fontSize: 34 },
  cross: { position: 'absolute', fontSize: 34, color: C.bad, fontWeight: '800' },
  plus: { fontSize: 34, fontWeight: '700', color: '#7A8A62' },
  solution: { fontSize: 26, fontWeight: '700', color: C.good, textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  option: { width: 92, height: 92, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#E3E7D6', alignItems: 'center', justifyContent: 'center', shadowColor: '#5B6B45', shadowOpacity: .12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  optionText: { fontSize: 38, fontWeight: '800', color: '#4A6239' },
  optionSub: { fontSize: 11, color: C.muted, marginTop: -2 },
  optionWrong: { backgroundColor: C.badBg, borderColor: '#EBC2B2', opacity: .8 },
  optionRight: { backgroundColor: C.goodBg, borderColor: '#9BC98A' },
  optionMark: { position: 'absolute', top: 4, right: 10, fontSize: 16, fontWeight: '800', color: '#7A8A62' },
  tools: { flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  tool: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 30, backgroundColor: '#F0F3E9', borderWidth: 1, borderColor: '#E1E6D4' },
  toolText: { fontSize: 15, color: '#5B6F48', fontWeight: '600' },
  hint: { backgroundColor: '#FFF7E3', borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: '#F1E2B8' },
  hintTitle: { fontSize: 17, fontWeight: '700', color: '#8A6A1E', lineHeight: 25 },
  beadRow: { flexDirection: 'row', gap: 4 },
  bead: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  beadCross: { fontSize: 12, fontWeight: '900', color: '#7A2E1C' },
  roof: { width: 0, height: 0, borderLeftWidth: 90, borderRightWidth: 90, borderBottomWidth: 64, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#D9805F', alignItems: 'center' },
  roofText: { position: 'absolute', top: 26, width: 80, textAlign: 'center', fontSize: 30, fontWeight: '800', color: '#FFFFFF' },
  houseBody: { width: 150, flexDirection: 'row', backgroundColor: '#F5DDB0', padding: 12, gap: 12, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  window: { flex: 1, height: 62, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#B98B5A' },
  windowEmpty: { backgroundColor: '#FFF7DF', borderStyle: 'dashed' },
  windowText: { fontSize: 30, fontWeight: '800', color: '#5B4428' },
  celebrate: { alignItems: 'center', gap: 6, padding: 16, borderRadius: 22, backgroundColor: C.goodBg },
  celebrateText: { fontSize: 22, fontWeight: '800', color: C.good, textAlign: 'center' },
  readOption: { padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E3E7D6' },
  readOptionText: { fontSize: 20, fontWeight: '600', color: '#4A6239', textAlign: 'center' },
  path: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' },
  pathDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1E6', alignItems: 'center', justifyContent: 'center' },
  pathDone: { backgroundColor: '#CFE0BA' },
  pathNow: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3CF', borderWidth: 2, borderColor: '#E8C766' },
  pathLine: { height: 4, flex: 1, maxWidth: 40, minWidth: 6, backgroundColor: '#E5E9DA' },
});
