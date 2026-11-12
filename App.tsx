import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TextInput, Pressable, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useVoiceInput } from './src/useVoiceInput';
import { recordAttempt, nextDifficulty } from './src/learning';
import { LEVELS, MathLevel, MathTask, TaskKind, adaptLevel, levelFromAssessment, makeTask } from './src/math';
import { STORIES, INTERESTS, nextStory, storyById, fillName, Story } from './src/stories';
import { Profile, Result, ResultKind, PROFILE_KEY, SETTINGS_KEY, migrate, newProfile, readingLevel } from './src/profile';
import { Button, Celebrate, ExitLink, MathCard, ReadingCard, Tone } from './src/components';
import { hasUkrainianVoice, playTone, unlockOnFirstTouch } from './src/webExtras';
import { StoryPlayer } from './src/StoryPlayer';
import { s } from './src/theme';

type Screen = 'home' | 'story' | 'math' | 'reading' | 'assessment' | 'result' | 'progress' | 'parents';
type Session = {
  kind: ResultKind; storyId?: string; correct: number; total: number; errors: string[];
  stars: number; mathCorrect: number; streak: number; wpm?: number; startedAt: number;
};

const PRACTICE_LENGTH = 8;
const ASSESS_PLAN: { level: MathLevel; kind: TaskKind }[] = [
  { level: 1, kind: 'count' }, { level: 2, kind: 'choose' }, { level: 3, kind: 'missing' }, { level: 4, kind: 'choose' },
];
const formatDate = (d: string) => new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
const KIND_TITLE: Record<ResultKind, string> = { adventure: 'Пригода', math: 'Математична майстерня', reading: 'Читання', assessment: 'Перше знайомство' };
const KIND_ICON: Record<ResultKind, string> = { adventure: '🗺️', math: '🔢', reading: '📖', assessment: '👋' };

export default function App() {
  const { width } = useWindowDimensions();
  const wide = width > 850;
  const roomy = width > 600; // планшет: картки в рядок
  const voice = useVoiceInput();

  const [p, setP] = useState<Profile | null>(null);
  const pRef = useRef<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [sound, setSound] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [ukVoice, setUkVoice] = useState<boolean | null>(null);

  const [name, setName] = useState(''), [age, setAge] = useState('6'), [interest, setInterest] = useState('Тварини'), [formError, setFormError] = useState('');
  const [limit, setLimit] = useState('15'), [pin, setPin] = useState(''), [savedPin, setSavedPin] = useState('');
  const [unlocked, setUnlocked] = useState(false), [parentMsg, setParentMsg] = useState(''), [resetConfirm, setResetConfirm] = useState(false);

  const [session, setSessionState] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [story, setStory] = useState<Story>(STORIES[0]);
  const [task, setTask] = useState<MathTask | null>(null);
  const [step, setStep] = useState(0);
  const [assessPhase, setAssessPhase] = useState<'math' | 'read'>('math');
  const [readingStory, setReadingStory] = useState<Story>(STORIES[0]);
  const [levelUp, setLevelUp] = useState('');
  const [last, setLast] = useState<{ result: Result; ending?: string; sticker?: Story['sticker']; newSticker?: boolean } | null>(null);
  const finishing = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });

  const setSession = (next: Session | null) => { sessionRef.current = next; setSessionState(next); };

  const update = async (fn: (old: Profile) => Profile) => {
    if (!pRef.current) return;
    const next = fn(pRef.current);
    pRef.current = next; setP(next);
    try { await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('Не вдалося зберегти прогрес. Перевір вільне місце та дозволи браузера.'); }
  };
  const saveSettings = (extra: Partial<{ limit: number; pin: string; sound: boolean }> = {}) =>
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ limit: Number(limit), pin: savedPin, sound, ...extra }));

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(PROFILE_KEY);
        if (v) { const m = migrate(JSON.parse(v)); if (m) { pRef.current = m; setP(m); } }
        const config = await AsyncStorage.getItem(SETTINGS_KEY);
        if (config) { const c = JSON.parse(config); setLimit(String(c.limit || 15)); setSavedPin(c.pin || ''); setSound(c.sound !== false); }
      } catch { setStorageError('Не вдалося прочитати збережені дані.'); }
      setLoaded(true);
    })();
    unlockOnFirstTouch();
    hasUkrainianVoice().then(setUkVoice).catch(() => setUkVoice(null));
    return () => { Speech.stop(); };
  }, []);

  const say = (text: string) => { if (!sound) return; voice.stop(); Speech.stop(); Speech.speak(text, { language: 'uk-UA', rate: 0.85 }); };
  const tone: Tone = kind => { if (sound) playTone(kind); };
  const navigate = (next: Screen) => { Speech.stop(); voice.stop(); setScreen(next); scrollTop(); };

  // ---------- заняття ----------
  const begin = (kind: ResultKind, chosen?: Story) => {
    const prof = pRef.current; if (!prof) return;
    finishing.current = false; setLevelUp(''); setStep(0);
    setSession({ kind, storyId: chosen?.id, correct: 0, total: 0, errors: [], stars: 0, mathCorrect: 0, streak: 0, startedAt: Date.now() });
    if (kind === 'adventure') { setStory(chosen ?? nextStory(prof.interest, prof.stickers, prof.completed)); navigate('story'); }
    if (kind === 'math') { setTask(makeTask(prof.mathLevel)); navigate('math'); }
    if (kind === 'assessment') { setAssessPhase('math'); setTask(makeTask(ASSESS_PLAN[0].level, Math.random, { kind: ASSESS_PLAN[0].kind })); navigate('assessment'); }
    if (kind === 'reading') {
      const count = prof.results.filter(r => r.kind === 'reading').length;
      setReadingStory(STORIES[(count + prof.completed) % STORIES.length]); navigate('reading');
    }
  };

  const recordMath = (t: MathTask, ok: boolean, given: string) => {
    const ses = sessionRef.current; if (!ses) return;
    const streak = ok ? ses.streak + 1 : 0;
    setSession({ ...ses, total: ses.total + 1, correct: ses.correct + (ok ? 1 : 0), mathCorrect: ses.mathCorrect + (ok ? 1 : 0), stars: ses.stars + (ok ? 1 : 0), streak,
      errors: ok ? ses.errors : [...ses.errors, `${t.label}: відповідь ${given}, правильно ${t.answer}`] });
    update(old => {
      const adapted = ses.kind === 'assessment' ? { level: old.mathLevel, history: old.mathHistory } : adaptLevel(old.mathLevel, old.mathHistory, ok);
      if (adapted.level > old.mathLevel) setLevelUp(`🚀 Новий рівень: ${LEVELS[adapted.level].title}!`);
      else if (adapted.level < old.mathLevel) setLevelUp(`🌱 Трохи потренуємось: ${LEVELS[adapted.level].title}`);
      return { ...old, record: recordAttempt(old.record, 'arithmetic', ok), mathLevel: adapted.level, mathHistory: adapted.history,
        stars: old.stars + (ok ? 1 : 0), bestStreak: Math.max(old.bestStreak, streak) };
    });
  };

  const recordReading = (ok: boolean, label: string, wpm?: number) => {
    const ses = sessionRef.current; if (!ses) return;
    setSession({ ...ses, total: ses.total + 1, correct: ses.correct + (ok ? 1 : 0), stars: ses.stars + (ok ? 1 : 0), wpm: wpm ?? ses.wpm,
      errors: ok ? ses.errors : [...ses.errors, `Розуміння тексту — ${label}`] });
    update(old => ({ ...old, record: recordAttempt(old.record, 'reading', ok), stars: old.stars + (ok ? 1 : 0) }));
  };

  const finish = async (choice = '') => {
    const ses = sessionRef.current, prof = pRef.current;
    if (!ses || !prof || finishing.current) return;
    finishing.current = true;
    const result: Result = { date: new Date().toISOString(), kind: ses.kind, correct: ses.correct, total: ses.total, errors: ses.errors, wpm: ses.wpm, stars: ses.stars, storyId: ses.storyId ?? (ses.kind === 'adventure' ? story.id : undefined) };
    const isAdventure = ses.kind === 'adventure';
    const newSticker = isAdventure && !prof.stickers.includes(story.id);
    await update(old => ({
      ...old,
      results: [result, ...old.results].slice(0, 100),
      completed: old.completed + (isAdventure ? 1 : 0),
      stickers: newSticker ? [...old.stickers, story.id] : old.stickers,
      minutes: old.minutes + Math.max(1, Math.round((Date.now() - ses.startedAt) / 60000)),
      onboarded: old.onboarded || ses.kind === 'assessment',
      mathLevel: ses.kind === 'assessment' ? levelFromAssessment(ses.mathCorrect) : old.mathLevel,
      mathHistory: ses.kind === 'assessment' ? [] : old.mathHistory,
    }));
    const ending = isAdventure ? fillName(story.ending, prof.name, choice) : undefined;
    setLast({ result, ending, sticker: isAdventure ? story.sticker : undefined, newSticker });
    navigate('result');
    tone('win');
    say(ending ?? `Готово! Сьогодні ти заробляєш ${ses.stars} зірочок. Дякую за старання!`);
  };

  const back = () => { setSession(null); navigate('home'); };

  // ---------- маленькі частини інтерфейсу ----------
  const VoiceButton = ({ onResult }: { onResult: (t: string) => void }) =>
    <Button secondary onPress={() => { Speech.stop(); voice.listening ? voice.stop() : voice.listen(onResult); }}>{voice.listening ? '◼ Зупинити запис' : '🎤 Сказати голосом'}</Button>;
  const Nav = ({ id, label, icon }: { id: Screen; label: string; icon: string }) =>
    <Pressable accessibilityRole="button" onPress={() => { if (id === 'parents') { setUnlocked(false); setPin(''); setParentMsg(''); } navigate(id); }} style={[s.navItem, screen === id && s.navActive]}>
      <Text style={s.navIcon}>{icon}</Text><Text style={[s.navLabel, screen === id && { color: '#3B533D' }]}>{label}</Text>
    </Pressable>;
  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) =>
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.chip, active && s.chipSelected]}><Text style={active ? { color: 'white' } : { color: '#515C4B' }}>{label}</Text></Pressable>;
  const Pill = ({ children }: { children: React.ReactNode }) =>
    <View style={{ backgroundColor: '#FFF6DB', borderRadius: 30, paddingVertical: 8, paddingHorizontal: 14 }}><Text style={{ fontSize: 15, fontWeight: '700', color: '#8A6A1E' }}>{children}</Text></View>;
  const SessionBar = ({ total, label }: { total: number; label: string }) => {
    const ses = session;
    const done = ses?.total ?? 0;
    return <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text style={s.eyebrow}>{label} · {Math.min(done + 1, total)} / {total}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!!ses && ses.streak >= 2 && <Pill>🔥 {ses.streak} поспіль</Pill>}
          <Pill>⭐ {ses?.stars ?? 0}</Pill>
        </View>
      </View>
      <View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.min(100, done / total * 100)}%` }]} /></View>
    </View>;
  };

  if (!loaded) return <SafeAreaView style={s.page}><Text style={s.loading}>Відкриваємо Казку…</Text></SafeAreaView>;
  const learning = ['story', 'math', 'reading', 'assessment'].includes(screen);
  const next = p ? nextStory(p.interest, p.stickers, p.completed) : STORIES[0];
  const rLevel = p ? readingLevel(p) : 0;

  // ---------- екрани ----------
  const renderOnboarding = () => <>
    <Text style={s.title}>Кожна пригода{'\n'}починається з тебе.</Text>
    <Text style={s.subtitle}>Читай, рахуй і відкривай нові світи разом із Руді.</Text>
    <View style={[s.row, { flexDirection: roomy ? 'row' : 'column' }]}>
      <View style={[s.card, { flex: 1 }]}>
        <Text style={s.sectionTitle}>Познайомимось? 👋</Text>
        <Text style={s.muted}>Я запам’ятаю твоє ім’я та наші відкриття на цьому пристрої.</Text>
        <Text style={s.label}>Як тебе звати?</Text>
        <TextInput accessibilityLabel="Ім’я дитини" style={s.input} value={name} onChangeText={setName} placeholder="Твоє ім’я" maxLength={30} />
        <VoiceButton onResult={setName} />
        <Text style={s.label}>Скільки тобі років?</Text>
        <View style={s.chips}>{['5', '6', '7', '8', '9'].map(a => <Chip key={a} label={a} active={age === a} onPress={() => setAge(a)} />)}</View>
        <Text style={s.label}>Що тобі найцікавіше?</Text>
        <View style={s.chips}>{INTERESTS.map(i => <Chip key={i.name} label={`${i.emoji} ${i.name}`} active={interest === i.name} onPress={() => setInterest(i.name)} />)}</View>
        {!!formError && <Text style={s.error}>{formError}</Text>}
        <Button big onPress={async () => {
          if (!name.trim()) { setFormError('Напиши, будь ласка, своє ім’я.'); return; }
          const prof = newProfile(name.trim(), age, interest);
          pRef.current = prof; setP(prof); setFormError('');
          try { await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(prof)); } catch { setStorageError('Не вдалося зберегти профіль.'); }
        }}>Знайомитися з Руді →</Button>
        <Text style={s.small}>Мікрофон вмикається лише після натискання. Аудіозаписи не зберігаються застосунком.</Text>
      </View>
      <View style={[s.welcomeArt, { flex: 1 }]}>
        <Text style={s.artStars}>✧         ·         ✦</Text>
        <Text style={{ fontSize: 110 }}>🦊</Text>
        <Text style={s.artTitle}>Привіт! Я Руді.</Text>
        <Text style={s.artCopy}>Я поруч, коли складно.{'\n'}І радію кожному твоєму відкриттю.</Text>
        <Text style={{ fontSize: 40, marginTop: 24 }}>🪐 🦕 🐙 🐉 🚂</Text>
      </View>
    </View>
  </>;

  const renderHome = (prof: Profile) => <>
    <View style={[s.greeting, { flexWrap: 'wrap', gap: 12 }]}>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.title}>Привіт, {prof.name} <Text style={{ fontSize: 30 }}>☀</Text></Text>
        <Text style={s.subtitle}>Світ повний історій. Яку відкриємо сьогодні?</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pill>⭐ {prof.stars}</Pill>
        <Pill>🏅 {prof.stickers.length}/{STORIES.length}</Pill>
      </View>
    </View>

    {!prof.onboarded && <View style={s.assessment}>
      <View style={{ flex: 1, minWidth: 180 }}><Text style={s.sectionTitle}>Спершу — маленьке знайомство</Text><Text style={s.muted}>4 приклади й короткий текст допоможуть обрати твій рівень.</Text></View>
      <Button onPress={() => begin('assessment')}>Спробувати · 3 хв →</Button>
    </View>}

    <Pressable accessibilityRole="button" onPress={() => begin('adventure', next)} style={[s.hero, { flexDirection: roomy ? 'row' : 'column', backgroundColor: next.color }]}>
      <View style={{ flex: 1, gap: 16 }}>
        <Text style={[s.heroBadge, { color: next.ink }]}>✦  {prof.stickers.includes(next.id) ? 'ПРОЙДИ ЗНОВУ' : 'ТВОЯ НАСТУПНА ПРИГОДА'}</Text>
        <Text style={s.heroTitle}>{next.name}</Text>
        <Text style={s.heroCopy}>{next.blurb} Тебе чекають вибір шляху, задачки й таємна записка.</Text>
        <View style={s.heroCTA}><Text style={s.heroCTAText}>Вирушити у пригоду   →</Text></View>
        <Text style={s.heroMeta}>◷  7–10 хвилин   ·   7 кроків   ·   нагорода: наліпка {next.sticker.emoji}</Text>
      </View>
      <View style={s.heroArt}>
        <Text style={s.heroMoon}>✧</Text>
        <Text style={{ fontSize: 112 }}>{next.hero}</Text>
        <Text style={{ fontSize: 46, marginTop: -6 }}>{next.icon}</Text>
        <View style={s.artBubble}><Text style={{ color: '#52624A' }}>Ходімо зі мною!</Text></View>
      </View>
    </Pressable>

    <View style={s.sectionHead}><Text style={s.sectionTitle}>Маленька практика</Text><Text style={s.muted}>У своєму темпі</Text></View>
    <View style={[s.row, { flexDirection: roomy ? 'row' : 'column' }]}>
      <Pressable accessibilityRole="button" onPress={() => begin('math')} style={[s.practice, { backgroundColor: '#F7EBDD' }]}>
        <View style={s.practiceTop}><Text style={{ fontSize: 38 }}>🔢</Text><Text style={{ fontSize: 24, color: '#6B735F' }}>↗</Text></View>
        <Text style={s.practiceTitle}>Математична майстерня</Text>
        <Text style={s.muted}>Будиночки чисел, загадкові числа, задачі й порівняння.</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map(l => <View key={l} style={{ width: 22, height: 8, borderRadius: 4, backgroundColor: l <= prof.mathLevel ? '#D99A4E' : '#EAD9C2' }} />)}
          <Text style={[s.small, { marginLeft: 6 }]}>Рівень {prof.mathLevel} · {LEVELS[prof.mathLevel].title}</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => begin('reading')} style={[s.practice, { backgroundColor: '#EAF0E5' }]}>
        <View style={s.practiceTop}><Text style={{ fontSize: 38 }}>📖</Text><Text style={{ fontSize: 24, color: '#6B735F' }}>↗</Text></View>
        <Text style={s.practiceTitle}>Прочитай історію</Text>
        <Text style={s.muted}>Короткі записки від героїв казок і питання до них.</Text>
        <Text style={s.practiceMeta}>БЛИЗЬКО 3 ХВИЛИН</Text>
      </Pressable>
    </View>

    <View style={s.sectionHead}><Text style={s.sectionTitle}>Твоя поличка пригод</Text><Text style={s.muted}>{prof.stickers.length} з {STORIES.length} пройдено</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {STORIES.map(w => {
        const done = prof.stickers.includes(w.id);
        return <Pressable key={w.id} accessibilityRole="button" onPress={() => begin('adventure', w)}
          style={({ pressed }) => [s.world, { backgroundColor: w.color, flexBasis: roomy ? '30%' : '46%', flexGrow: 1, minHeight: 170 }, pressed && { opacity: .85 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 40 }}>{w.icon}</Text>
            {done && <Text style={{ fontSize: 26 }}>{w.sticker.emoji}</Text>}
          </View>
          <Text style={[s.worldTag, { color: w.ink }]}>{w.tag}</Text>
          <Text style={s.worldTitle}>{w.name}</Text>
          <Text style={[s.small, { color: w.ink }]}>{done ? '✓ Пройдено · ще раз →' : 'Відкрити історію →'}</Text>
        </Pressable>;
      })}
    </View>
    <View style={s.daily}><Text style={{ fontSize: 30 }}>✧</Text><Text style={[s.muted, { flex: 1 }]}>Пройдено пригод: <Text style={s.bold}>{prof.completed}</Text>, хвилин практики: <Text style={s.bold}>{prof.minutes}</Text>, найдовша серія правильних відповідей: <Text style={s.bold}>{prof.bestStreak}</Text>. Кожен крок має значення.</Text></View>
  </>;

  const renderMath = (prof: Profile) => task && <View style={s.lesson}>
    <ExitLink label="← Завершити заняття" onExit={back} />
    <SessionBar total={PRACTICE_LENGTH} label={`МАЙСТЕРНЯ · РІВЕНЬ ${prof.mathLevel}`} />
    {!!levelUp && <Celebrate text={levelUp} emoji="🏆" />}
    <MathCard key={task.id} task={task} say={say} tone={tone} voice={voice}
      onResolved={(ok, given) => recordMath(task, ok, given)}
      nextLabel={(session?.total ?? 0) >= PRACTICE_LENGTH ? 'Завершити 🏁' : 'Далі →'}
      onNext={() => { setLevelUp(''); if ((sessionRef.current?.total ?? 0) >= PRACTICE_LENGTH) finish(); else { setTask(makeTask(pRef.current!.mathLevel)); scrollTop(); } }} />
  </View>;

  const renderAssessment = () => {
    const read = STORIES[0].scenes.find(x => x.type === 'read');
    return <View style={s.lesson}>
      <ExitLink label="← Завершити знайомство" onExit={back} />
      <SessionBar total={ASSESS_PLAN.length + 1} label="ЗНАЙОМСТВО" />
      {assessPhase === 'math' && task && <MathCard key={task.id} task={task} say={say} tone={tone} voice={voice}
        onResolved={(ok, given) => recordMath(task, ok, given)}
        onNext={() => {
          const n = step + 1;
          if (n >= ASSESS_PLAN.length) { setAssessPhase('read'); scrollTop(); return; }
          setStep(n); setTask(makeTask(ASSESS_PLAN[n].level, Math.random, { kind: ASSESS_PLAN[n].kind })); scrollTop();
        }} />}
      {assessPhase === 'read' && read?.type === 'read' && <ReadingCard passage={read.passages[1]} question={read.main} say={say} tone={tone}
        onResolved={(ok, wpm) => recordReading(ok, read.main.q, wpm)} onNext={() => finish()} nextLabel="Завершити знайомство 🏁" />}
    </View>;
  };

  const renderReading = () => {
    const read = readingStory.scenes.find(x => x.type === 'read');
    if (!read || read.type !== 'read') return null;
    const q = rLevel === 0 ? read.easy : read.main;
    return <View style={s.lesson}>
      <ExitLink label="← Завершити заняття" onExit={back} />
      <Text style={s.eyebrow}>ЧИТАННЯ · {readingStory.tag}</Text>
      <Text style={{ fontSize: 60, textAlign: 'center' }}>{read.art}</Text>
      <Text style={[s.subtitle, { fontSize: 18 }]}>{read.text}</Text>
      <ReadingCard passage={read.passages[rLevel]} question={q} say={say} tone={tone}
        onResolved={(ok, wpm) => recordReading(ok, `«${readingStory.name}»: ${q.q}`, wpm)} onNext={() => finish()} nextLabel="Завершити 🏁" />
    </View>;
  };

  const renderResult = (prof: Profile) => last && <View style={s.lesson}>
    {last.sticker ? <>
      <Celebrate text={last.newSticker ? 'Нова наліпка в альбомі!' : 'Пригоду пройдено ще раз!'} emoji={`🎉 ${last.sticker.emoji} 🎉`} />
      <Text style={{ fontSize: 110, textAlign: 'center' }}>{last.sticker.emoji}</Text>
      <Text style={[s.title, { textAlign: 'center' }]}>{last.sticker.name}</Text>
      <Text style={s.storyText}>{last.ending}</Text>
    </> : <>
      <Text style={{ fontSize: 82, textAlign: 'center' }}>🌟</Text>
      <Text style={[s.title, { textAlign: 'center' }]}>Ще одне відкриття!</Text>
      <Text style={s.storyText}>{prof.name}, дякую за старання. {last.result.kind === 'assessment' ? `Твій рівень математики: «${LEVELS[prof.mathLevel].title}».` : 'Наступні завдання врахують твої відповіді.'}</Text>
    </>}
    <View style={s.stats}>
      <View><Text style={s.statNumber}>⭐ {last.result.stars ?? 0}</Text><Text style={s.muted}>зірочок за заняття</Text></View>
      <View><Text style={s.statNumber}>{last.result.correct}/{last.result.total}</Text><Text style={s.muted}>з першої спроби</Text></View>
      {last.result.wpm !== undefined && <View><Text style={s.statNumber}>{last.result.wpm}</Text><Text style={s.muted}>слів / хв · за таймером</Text></View>}
    </View>
    {last.result.kind === 'adventure' && <Button big onPress={() => begin('adventure', nextStory(prof.interest, prof.stickers, prof.completed))}>Наступна пригода →</Button>}
    <Button secondary={last.result.kind === 'adventure'} onPress={back}>До моїх пригод</Button>
    <Button secondary onPress={() => navigate('progress')}>Мій альбом наліпок 🏅</Button>
  </View>;

  const renderProgress = (prof: Profile) => <>
    <Text style={s.title}>Твої відкриття ✧</Text>
    <Text style={s.subtitle}>Тут живуть твої зірочки, наліпки й маленькі кроки.</Text>
    <View style={s.stats}>
      {[{ n: `⭐ ${prof.stars}`, t: 'зірочок' }, { n: prof.completed, t: 'пригод завершено' }, { n: prof.record.arithmetic.correct, t: 'прикладів розв’язано' }, { n: prof.record.reading.correct, t: 'текстів зрозуміло' }]
        .map(x => <View key={x.t}><Text style={s.statNumber}>{x.n}</Text><Text style={s.muted}>{x.t}</Text></View>)}
    </View>
    <View style={s.sectionHead}><Text style={s.sectionTitle}>Альбом наліпок 🏅</Text><Text style={s.muted}>{prof.stickers.length} з {STORIES.length}</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {STORIES.map(st => {
        const got = prof.stickers.includes(st.id);
        return <Pressable key={st.id} accessibilityRole="button" onPress={() => begin('adventure', st)}
          style={{ width: 120, padding: 14, borderRadius: 20, alignItems: 'center', gap: 6, backgroundColor: got ? st.color : '#F1F2EC', borderWidth: 2, borderColor: got ? 'transparent' : '#E3E5DA', borderStyle: got ? 'solid' : 'dashed' }}>
          <Text style={{ fontSize: 46, opacity: got ? 1 : .25 }}>{got ? st.sticker.emoji : '❔'}</Text>
          <Text style={[s.small, { textAlign: 'center', color: got ? st.ink : '#A3A897' }]}>{got ? st.sticker.name : st.name}</Text>
        </Pressable>;
      })}
    </View>
    <View style={s.card}>
      <Text style={s.sectionTitle}>Математика: рівень {prof.mathLevel} з 5</Text>
      <View style={{ gap: 8 }}>
        {([1, 2, 3, 4, 5] as MathLevel[]).map(l => <Text key={l} style={[s.muted, l === prof.mathLevel && s.bold]}>{l < prof.mathLevel ? '✅' : l === prof.mathLevel ? '👉' : '🔒'}  {LEVELS[l].title}</Text>)}
      </View>
    </View>
    <Text style={s.sectionTitle}>Історія занять</Text>
    {!prof.results.length ? <View style={s.card}><Text style={s.muted}>Твоя перша історія ще попереду.</Text><Button onPress={() => begin('assessment')}>Почати знайомство →</Button></View>
      : prof.results.slice(0, 30).map((r, i) => <View key={i} style={s.history}>
        <Text style={{ fontSize: 28 }}>{r.storyId ? storyById(r.storyId).icon : KIND_ICON[r.kind]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.historyTitle}>{r.storyId ? storyById(r.storyId).name : KIND_TITLE[r.kind] || 'Заняття'}</Text>
          <Text style={s.muted}>{formatDate(r.date)} · {r.correct} із {r.total} з першої спроби{r.stars !== undefined ? ` · ⭐ ${r.stars}` : ''}{r.wpm !== undefined ? ` · ${r.wpm} слів/хв` : ''}</Text>
        </View>
      </View>)}
  </>;

  const renderParents = (prof: Profile) => <>
    <Text style={s.title}>Для батьків</Text>
    <Text style={s.subtitle}>Прогрес, рівень і налаштування вашої дитини.</Text>
    {!unlocked ? <View style={s.card}>
      <Text style={s.sectionTitle}>{savedPin ? 'Введіть батьківський PIN' : 'Встановіть батьківський PIN'}</Text>
      <Text style={s.muted}>{savedPin ? 'Він відкриває результати та налаштування.' : '4 цифри, щоб дитина випадково не змінила налаштування. PIN діє на цьому пристрої.'}</Text>
      <TextInput accessibilityLabel="Батьківський PIN" secureTextEntry keyboardType="number-pad" maxLength={4} value={pin} onChangeText={setPin} style={s.input} placeholder="4 цифри" />
      <Button onPress={async () => {
        if (!/^\d{4}$/.test(pin)) { setParentMsg('Введіть рівно 4 цифри.'); return; }
        if (savedPin && savedPin !== pin) { setParentMsg('PIN не збігається.'); return; }
        try { if (!savedPin) { await saveSettings({ pin }); setSavedPin(pin); } setUnlocked(true); setParentMsg(''); } catch { setParentMsg('Не вдалося зберегти PIN.'); }
      }}>{savedPin ? 'Відкрити' : 'Зберегти PIN і відкрити'}</Button>
      <Text style={s.error}>{parentMsg}</Text>
    </View> : <>
      <View style={s.card}>
        <Text style={s.sectionTitle}>{prof.name} · {prof.age} років</Text>
        <Text style={s.muted}>Інтерес: {prof.interest}. Пригод: {prof.completed}. Наліпок: {prof.stickers.length}/{STORIES.length}. Зірочок: {prof.stars}.</Text>
        {(['reading', 'arithmetic'] as const).map(key => <View key={key} style={s.setting}>
          <Text style={s.label}>{key === 'reading' ? 'Читання (розуміння)' : 'Математика (з першої спроби)'}</Text>
          <Text style={s.muted}>{prof.record[key].correct} / {prof.record[key].attempts}{key === 'reading' ? ` · ${{ easy: 'Початковий', medium: 'Середній', hard: 'Складніший' }[nextDifficulty(prof.record.reading)]}` : ''}</Text>
        </View>)}
      </View>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Рівень математики</Text>
        <Text style={s.muted}>Рівень змінюється автоматично: 4 правильні з 5 — вище, 3 помилки з 4 — нижче. Можна обрати вручну.</Text>
        {([1, 2, 3, 4, 5] as MathLevel[]).map(l => <Pressable key={l} accessibilityRole="button" onPress={() => update(old => ({ ...old, mathLevel: l, mathHistory: [] }))}
          style={[s.setting, { alignItems: 'center' }, prof.mathLevel === l && { backgroundColor: '#EEF2E5', borderRadius: 12, paddingHorizontal: 10 }]}>
          <View style={{ flex: 1, minWidth: 200 }}><Text style={s.label}>{prof.mathLevel === l ? '● ' : '○ '}{l}. {LEVELS[l].title}</Text><Text style={s.small}>{LEVELS[l].description}</Text></View>
        </Pressable>)}
      </View>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Комфортне заняття</Text>
        <Text style={s.label}>Нагадати про перерву після</Text>
        <View style={s.chips}>{['10', '15', '20'].map(v => <Chip key={v} label={`${v} хв`} active={limit === v} onPress={() => setLimit(v)} />)}</View>
        <Text style={s.label}>Озвучення завдань</Text>
        <View style={s.chips}><Chip label="Увімкнено" active={sound} onPress={() => setSound(true)} /><Chip label="Вимкнено" active={!sound} onPress={() => setSound(false)} /></View>
        <Button onPress={async () => { try { await saveSettings(); setParentMsg('Налаштування збережено.'); } catch { setParentMsg('Не вдалося зберегти.'); } }}>Зберегти налаштування</Button>
        <Text style={s.muted}>{parentMsg}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Що варто повторити</Text>
        {prof.results.flatMap(r => r.errors).slice(0, 12).map((e, i) => <Text key={i} style={s.muted}>• {e}</Text>)}
        {!prof.results.some(r => r.errors.length > 0) && <Text style={s.muted}>Помилок у завершених заняттях поки немає.</Text>}
        <Button secondary onPress={() => begin('assessment')}>Пройти перевірку ще раз</Button>
      </View>
      <View style={s.card}>
        <Text style={s.sectionTitle}>Пам’ять і голос</Text>
        <Text style={s.muted}>Профіль та результати зберігаються лише на цьому пристрої. Це навчальні пригоди за готовими сюжетами. Вільний AI-діалог і синхронізація ще не підключені.</Text>
        <Text style={s.muted}>{ukVoice === true ? '✅ Український голос для озвучення на цьому пристрої знайдено.' : ukVoice === false ? '⚠️ Українського голосу для озвучення не знайдено: текст може читатися з акцентом. Додайте українську мову синтезу мовлення в налаштуваннях планшета (Мова → Синтез мовлення) або відкрийте сторінку в Chrome.' : 'Перевірити наявність українського голосу на цьому пристрої не вдалося.'}</Text>
        <Text style={s.muted}>Голосове розпізнавання працює у сумісному браузері та може використовувати сервіс виробника браузера. Застосунок не зберігає аудіозаписи.</Text>
        <Button secondary onPress={() => {
          if (!resetConfirm) { setResetConfirm(true); return; }
          AsyncStorage.removeItem(PROFILE_KEY).then(() => { pRef.current = null; setP(null); setResetConfirm(false); navigate('home'); }).catch(() => setParentMsg('Не вдалося видалити профіль.'));
        }}>{resetConfirm ? 'Підтвердити видалення профілю та результатів' : 'Очистити профіль на цьому пристрої'}</Button>
        {resetConfirm && <Button secondary onPress={() => setResetConfirm(false)}>Скасувати</Button>}
      </View>
    </>}
  </>;

  const body = () => {
    if (!p) return renderOnboarding();
    switch (screen) {
      case 'home': return renderHome(p);
      case 'story': return <StoryPlayer key={story.id + (session?.startedAt ?? 0)} story={story} childName={p.name} level={p.mathLevel} readingLevel={rLevel} say={say} tone={tone} voice={voice}
        onMath={recordMath} onRead={recordReading} onFinish={finish} onExit={back} onStep={scrollTop} />;
      case 'math': return renderMath(p);
      case 'assessment': return renderAssessment();
      case 'reading': return renderReading();
      case 'result': return renderResult(p);
      case 'progress': return renderProgress(p);
      case 'parents': return renderParents(p);
    }
  };

  return <SafeAreaView style={s.page}><StatusBar style="dark" />
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      <View style={[s.sidebar, !wide && s.mobileBar]}>
        <View style={s.logo}><Text style={s.logoMark}>✦</Text><View><Text style={s.logoText}>казка</Text><Text style={s.logoSub}>ТВОЯ МАЛЕНЬКА ПРИГОДА</Text></View></View>
        {wide && <>
          <Text style={s.menuCaption}>ТВІЙ СВІТ</Text>
          <Nav id="home" label="Мої пригоди" icon="⌂" />
          <Nav id="progress" label="Мої відкриття" icon="✧" />
          <View style={{ flex: 1 }} />
          <View style={s.sideNote}><Text style={{ fontSize: 30 }}>🌱</Text><Text style={s.sideNoteTitle}>Маленькі кроки.</Text><Text style={s.muted}>Щодня дізнавайся щось нове, у своєму темпі.</Text></View>
          <Nav id="parents" label="Для батьків" icon="⚙" />
        </>}
        {!wide && <Pressable accessibilityLabel="Для батьків" onPress={() => { setUnlocked(false); setPin(''); navigate('parents'); }}><Text style={{ fontSize: 24 }}>⚙</Text></Pressable>}
      </View>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={[s.content, { padding: wide ? 42 : 18 }]}>
        <View style={s.topline}>
          <Text style={s.eyebrow}>{learning ? 'ЧАС ДЛЯ ВІДКРИТТІВ' : 'МАЛЕНЬКІ ПРИГОДИ, ВЕЛИКІ ВІДКРИТТЯ'}</Text>
          <Pressable accessibilityRole="button" onPress={() => { const v = !sound; setSound(v); Speech.stop(); saveSettings({ sound: v }).catch(() => undefined); }}>
            <Text style={s.sound}>{sound ? '🔊 Звук увімкнено' : '🔈 Без звуку'}</Text>
          </Pressable>
        </View>
        {body()}
        {learning && session && Date.now() - session.startedAt > Number(limit) * 60000 && <View style={s.assessment}>
          <Text style={[s.muted, { flex: 1 }]}>Час трохи відпочити. Збережені відповіді залишаться у твоєму прогресі.</Text>
          <Button onPress={back}>Зробити перерву</Button>
        </View>}
        {!!voice.error && <Text accessibilityLiveRegion="polite" style={s.error}>{voice.error}</Text>}
        {!!storageError && <Text style={s.error}>{storageError}</Text>}
        <View style={s.footer}><Text style={s.footerLogo}>✦ казка</Text><Text style={s.small}>Тут можна помилятися. І пробувати знову.</Text></View>
      </ScrollView>
      {!wide && p && <View style={s.bottomNav}><Nav id="home" label="Пригоди" icon="⌂" /><Nav id="progress" label="Відкриття" icon="✧" /></View>}
    </View>
  </SafeAreaView>;
}
