import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, s } from './theme';
import { Button, Celebrate, Say, Tone } from './components';
import { Key, Letter, NOTE_COLOR, SONGS, Song, SongNote, extendSequence, frequency, keyboard, noteName } from './piano';
import { playPianoNote } from './webExtras';

const KEYS = keyboard(4, 2);
/** У вебверсії кнопка за замовчуванням чекає 50 мс перед «натисканням» — для клавіш піаніно це губить швидкі дотики. */
const NO_DELAY = { delayPressIn: 0 } as object;
const WHITE_COUNT = KEYS.filter(k => !k.black).length;

export const playNote = (note: string, long = false) => playPianoNote(frequency(note), long ? 2.2 : 1.5);

/** Програє мелодію, підсвічуючи клавіші. Повертає функцію зупинки. */
export function playMelody(notes: SongNote[], onFlash: (note: string | null) => void, onEnd?: () => void, beat = 430): () => void {
  let stopped = false; let t = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  notes.forEach(n => {
    timers.push(setTimeout(() => { if (stopped) return; playNote(n.note, n.long); onFlash(n.note); }, t));
    timers.push(setTimeout(() => { if (!stopped) onFlash(null); }, t + beat * (n.long ? 1.6 : 0.8)));
    t += beat * (n.long ? 2 : 1) + (n.pauseAfter ? beat * 0.6 : 0);
  });
  timers.push(setTimeout(() => { if (!stopped) onEnd?.(); }, t + 200));
  return () => { stopped = true; timers.forEach(clearTimeout); onFlash(null); };
}

/** Клавіатура на дві октави. Кольорові крапки й назви нот допомагають знайти клавішу. */
export function PianoKeys({ onKey, highlight, flash, labels = true }: { onKey: (note: string) => void; highlight?: string | null; flash?: string | null; labels?: boolean }) {
  const [width, setWidth] = useState(0);
  const [down, setDown] = useState<string | null>(null);
  const whiteW = Math.max(40, Math.min(78, Math.floor(width / WHITE_COUNT)));
  const whiteH = Math.min(260, Math.round(whiteW * 4.2));
  const blackW = Math.round(whiteW * 0.62), blackH = Math.round(whiteH * 0.6);
  const total = whiteW * WHITE_COUNT;

  const press = (k: Key) => { setDown(k.note); playNote(k.note); onKey(k.note); setTimeout(() => setDown(n => (n === k.note ? null : n)), 180); };
  const lit = (k: Key) => k.note === highlight || k.note === flash;

  const keys = (
    <View style={{ width: total, height: whiteH }}>
      <View style={{ flexDirection: 'row' }}>
        {KEYS.filter(k => !k.black).map(k => (
          <Pressable key={k.note} {...NO_DELAY} onPressIn={() => press(k)} accessibilityRole="button" accessibilityLabel={`Нота ${noteName(k.note)}`}
            style={[p.white, { width: whiteW, height: whiteH }, lit(k) && { backgroundColor: NOTE_COLOR[k.letter] + '55', borderColor: NOTE_COLOR[k.letter] }, down === k.note && { backgroundColor: '#EDEDE5' }]}>
            {k.note === highlight && <Text style={p.arrow}>⬇</Text>}
            <View style={[p.dot, { backgroundColor: NOTE_COLOR[k.letter as Letter] }]} />
            {labels && <Text style={[p.label, { fontSize: whiteW > 50 ? 14 : 11 }]}>{noteName(k.note)}</Text>}
          </Pressable>
        ))}
      </View>
      {KEYS.filter(k => k.black).map(k => (
        <Pressable key={k.note} {...NO_DELAY} onPressIn={() => press(k)} accessibilityRole="button" accessibilityLabel={`Нота ${noteName(k.note)}`}
          style={[p.black, { width: blackW, height: blackH, left: (k.whiteIndex + 1) * whiteW - blackW / 2 }, (down === k.note || lit(k)) && { backgroundColor: '#5A5A5A' }]} />
      ))}
    </View>
  );

  return (
    <View onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))} style={{ width: '100%' }}>
      {width > 0 && (total > width
        ? <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: 6 }}>{keys}</ScrollView>
        : <View style={{ alignItems: 'center' }}>{keys}</View>)}
    </View>
  );
}

/** Зіграй мелодію: клавіша, яку треба натиснути, світиться. Використовується і в пригоді Міри. */
export function MelodyTask({ notes, say, tone, onDone, doneLabel = 'Далі →', title }: {
  notes: SongNote[]; say: Say; tone: Tone; onDone: () => void; doneLabel?: string; title?: string;
}) {
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);
  const stopRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => stopRef.current?.(), []);
  const finished = pos >= notes.length;

  const onKey = (note: string) => {
    if (finished) return;
    if (note === notes[pos].note) {
      setMiss(false);
      const next = pos + 1;
      setPos(next);
      if (next >= notes.length) { tone('win'); say('Браво! Мелодія звучить чудово!', 'happy'); }
    } else setMiss(true);
  };
  const listen = () => { stopRef.current?.(); stopRef.current = playMelody(notes, setFlash); };

  return (
    <View style={{ gap: 14 }}>
      {!!title && <Text style={s.sectionTitle}>{title}</Text>}
      <View style={p.progress}>
        {notes.map((n, i) => (
          <View key={i} style={[p.noteDot, { backgroundColor: i < pos ? NOTE_COLOR[n.note[0] as Letter] : '#E6E9DD' }, i === pos && p.noteDotNow]}>
            {i === pos && <Text style={p.noteDotText}>{noteName(n.note)}</Text>}
          </View>
        ))}
      </View>
      <PianoKeys onKey={onKey} highlight={finished ? null : notes[pos]?.note} flash={flash} />
      {!finished && <Text style={[s.muted, { textAlign: 'center' }]}>{miss ? '🙂 Майже! Шукай клавішу зі стрілочкою ⬇' : `Натисни «${noteName(notes[pos].note)}» — клавішу зі стрілочкою ⬇`}</Text>}
      {!finished && <Button secondary onPress={listen}>▶ Послухати мелодію</Button>}
      {finished && <Celebrate text="Браво! Мелодія звучить!" emoji="🎹 🎶 ⭐" />}
      {finished && <Button big onPress={() => { stopRef.current?.(); onDone(); }}>{doneLabel}</Button>}
    </View>
  );
}

type Mode = 'free' | 'song' | 'simon';
const SIMON_KEY = 'cazka.simonBest';

/** Екран «Піаніно»: вільна гра, вчимо пісню, «Повторюй за мною». */
export function PianoStudio({ say, tone, onStar }: { say: Say; tone: Tone; onStar: (n: number) => void }) {
  const [mode, setMode] = useState<Mode>('free');
  const [last, setLast] = useState<string | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [songRun, setSongRun] = useState(0);

  // «Повторюй за мною»
  const [seq, setSeq] = useState<string[]>([]);
  const [input, setInput] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'listen' | 'play' | 'oops'>('idle');
  const [flash, setFlash] = useState<string | null>(null);
  const [best, setBest] = useState(0);
  const stopRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => { AsyncStorage.getItem(SIMON_KEY).then(v => setBest(Number(v) || 0)).catch(() => undefined); return () => stopRef.current?.(); }, []);

  const playSeq = (notes: string[]) => {
    setPhase('listen'); setInput(0);
    stopRef.current?.();
    stopRef.current = playMelody(notes.map(n => ({ note: n, long: false, pauseAfter: false })), setFlash, () => setPhase('play'), 600);
  };
  const startSimon = () => { const first = extendSequence([]); setSeq(first); say('Слухай уважно і повтори!'); setTimeout(() => playSeq(first), 900); };
  const simonKey = (note: string) => {
    if (phase !== 'play') return;
    if (note !== seq[input]) { setPhase('oops'); tone('soft'); say('Ой! Послухай ще раз.'); setTimeout(() => playSeq(seq), 1600); return; }
    const next = input + 1;
    if (next < seq.length) { setInput(next); return; }
    const level = seq.length;
    if (level > best) { setBest(level); AsyncStorage.setItem(SIMON_KEY, String(level)).catch(() => undefined); }
    if (level >= 3) onStar(1);
    tone('good');
    const longer = extendSequence(seq);
    setSeq(longer); setPhase('listen');
    setTimeout(() => playSeq(longer), 1100);
  };

  const switchMode = (m: Mode) => { stopRef.current?.(); setFlash(null); setPhase('idle'); setSeq([]); setSong(null); setMode(m); };

  return (
    <View style={[s.lesson, { maxWidth: 1100 }]}>
      <Text style={s.title}>Піаніно 🎹</Text>
      <Text style={s.subtitle}>Грай що хочеш, вчи пісеньки або тренуй пам’ять.</Text>
      <View style={p.tabs}>
        {([['free', '🎹 Вільна гра'], ['song', '🎵 Вчимо пісню'], ['simon', '🧠 Повторюй за мною']] as [Mode, string][]).map(([m, l]) => (
          <Pressable key={m} accessibilityRole="button" onPress={() => switchMode(m)} style={[p.tab, mode === m && p.tabOn]}><Text style={[p.tabText, mode === m && { color: '#fff' }]}>{l}</Text></Pressable>
        ))}
      </View>

      {mode === 'free' && <>
        <View style={[p.bigNote, last ? { backgroundColor: NOTE_COLOR[last[0] as Letter] + '33' } : null]}>
          <Text style={[p.bigNoteText, last ? { color: NOTE_COLOR[last[0] as Letter] } : null]}>{last ? noteName(last) : '🎵'}</Text>
        </View>
        <PianoKeys onKey={setLast} />
        <Text style={[s.small, { textAlign: 'center' }]}>Кольорова крапка — це «веселка нот»: до, ре, мі, фа, соль, ля, сі.</Text>
      </>}

      {mode === 'song' && (!song ? (
        <View style={p.tabs}>
          {SONGS.map(sg => (
            <Pressable key={sg.id} accessibilityRole="button" onPress={() => { setSong(sg); setSongRun(r => r + 1); }} style={p.songCard}>
              <Text style={{ fontSize: 40 }}>{sg.emoji}</Text>
              <Text style={p.songTitle}>{sg.title}</Text>
              <Text style={s.small}>{sg.notes.length} нот</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Pressable onPress={() => setSong(null)}><Text style={s.back}>← Інші пісеньки</Text></Pressable>
          <MelodyTask key={song.id + songRun} notes={song.notes} title={`${song.emoji} ${song.title}`} say={say} tone={tone}
            doneLabel="Ще одну пісеньку 🎵" onDone={() => { onStar(1); setSong(null); }} />
        </>
      ))}

      {mode === 'simon' && <>
        <View style={p.simonInfo}>
          <Text style={p.simonText}>Рівень: {seq.length || '—'}</Text>
          <Text style={p.simonText}>🏆 Рекорд: {best}</Text>
        </View>
        <Text style={[s.sectionTitle, { textAlign: 'center' }]}>
          {phase === 'idle' ? 'Піаніно зіграє ноти — повтори їх так само!' : phase === 'listen' ? '👂 Слухай…' : phase === 'oops' ? '🙂 Ой, ще разок!' : `🎹 Твоя черга: ${input} з ${seq.length}`}
        </Text>
        <PianoKeys onKey={simonKey} flash={flash} labels={false} />
        {phase === 'idle' && <Button big onPress={startSimon}>▶ Почати гру</Button>}
        {phase !== 'idle' && <Button secondary onPress={() => switchMode('simon')}>⏹ Завершити гру</Button>}
      </>}
    </View>
  );
}

const p = StyleSheet.create({
  white: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D9DCCF', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12, gap: 6 },
  black: { position: 'absolute', top: 0, backgroundColor: '#262626', borderBottomLeftRadius: 7, borderBottomRightRadius: 7, zIndex: 2 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  label: { color: '#5E6655', fontWeight: '700' },
  arrow: { position: 'absolute', top: '45%', fontSize: 26, color: '#2F3B26' },
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  noteDot: { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  noteDotNow: { minWidth: 46, height: 26, borderRadius: 13, backgroundColor: '#FFF3CF', borderWidth: 2, borderColor: '#E8C766', paddingHorizontal: 6 },
  noteDotText: { fontSize: 12, fontWeight: '800', color: '#8A6A1E' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  tab: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 30, backgroundColor: '#F0F3E9', borderWidth: 1, borderColor: '#E1E6D4' },
  tabOn: { backgroundColor: C.green, borderColor: C.green },
  tabText: { fontSize: 15, fontWeight: '600', color: '#5B6F48' },
  bigNote: { alignSelf: 'center', minWidth: 160, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 24, backgroundColor: '#F4F1E4', alignItems: 'center' },
  bigNoteText: { fontSize: 48, fontWeight: '800', color: '#8A917C' },
  songCard: { width: 150, padding: 18, borderRadius: 22, backgroundColor: '#F6EEFA', alignItems: 'center', gap: 6 },
  songTitle: { fontSize: 16, fontWeight: '700', color: '#5C4479', textAlign: 'center' },
  simonInfo: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  simonText: { fontSize: 18, fontWeight: '700', color: '#5B6F48' },
});
