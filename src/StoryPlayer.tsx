import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { s } from './theme';
import { Button, ExitLink, MathCard, PathProgress, ReadingCard, Say, Tone, Voice, k } from './components';
import { Story, fillName } from './stories';
import { MathLevel, MathTask, makeTask } from './math';

const SCENE_ICON = { say: '✨', choice: '🔀', math: '🔢', read: '📖' } as const;

/** Створює задачу-розповідь для сцени пригоди з урахуванням рівня дитини. */
export function storyTask(level: MathLevel, scene: Extract<Story['scenes'][number], { type: 'math' }>, rng = Math.random): MathTask {
  const canTake = level >= 3 && !!scene.templates.take?.length;
  const kind = canTake && rng() < 0.3 ? 'subtract' : 'word';
  return makeTask(level, rng, { kind, noun: scene.noun, templates: scene.templates });
}

export function StoryPlayer({ story, childName, level, readingLevel, say, tone, voice, onMath, onRead, onFinish, onExit, onStep }: {
  story: Story; childName: string; level: MathLevel; readingLevel: 0 | 1 | 2; say: Say; tone: Tone; voice: Voice;
  onMath: (task: MathTask, firstTryOk: boolean, given: string) => void;
  onRead: (ok: boolean, label: string, wpm?: number) => void;
  onFinish: (choice: string) => void; onExit: () => void; onStep?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<{ keep: string; reply: string; emoji: string } | null>(null);
  const [task, setTask] = useState<MathTask | null>(null);
  const scene = story.scenes[index];
  const text = fillName(scene.text, childName, choice?.keep);

  useEffect(() => {
    if (scene.type === 'math') setTask(storyTask(level, scene));
    else setTask(null);
    if (scene.type === 'say' || scene.type === 'choice') say(text);
    if (scene.type === 'read') say(text);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    voice.stop();
    if (index + 1 >= story.scenes.length) onFinish(choice?.keep ?? '');
    else { setIndex(index + 1); onStep?.(); }
  };

  return (
    <View style={s.lesson}>
      <ExitLink label="← До моїх пригод" onExit={onExit} />
      <PathProgress icons={story.scenes.map(x => SCENE_ICON[x.type])} index={index} hero={story.hero} />
      <Text style={[s.eyebrow, { textAlign: 'center' }]}>{story.tag} · {story.name.toUpperCase()}</Text>
      <Text style={{ fontSize: 64, textAlign: 'center' }}>{scene.art}</Text>

      {scene.type === 'say' && <>
        <Text style={k.story}>{text}</Text>
        <Button secondary onPress={() => say(text)}>🔊 Послухати</Button>
        <Button big onPress={next}>Далі →</Button>
      </>}

      {scene.type === 'choice' && <>
        <Text style={k.story}>{text}</Text>
        {!choice ? (
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {scene.options.map(o => (
              <Pressable key={o.label} accessibilityRole="button" onPress={() => { setChoice(o); say(o.reply); }}
                style={({ pressed }) => [{ flex: 1, minWidth: 150, padding: 20, borderRadius: 22, backgroundColor: story.color, alignItems: 'center', gap: 8 }, pressed && { transform: [{ scale: .97 }] }]}>
                <Text style={{ fontSize: 52 }}>{o.emoji}</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: story.ink, textAlign: 'center' }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : <>
          <View style={[k.hint, { backgroundColor: story.color, borderColor: 'transparent' }]}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>{choice.emoji}</Text>
            <Text style={k.story}>{choice.reply}</Text>
          </View>
          <Button big onPress={next}>Далі →</Button>
        </>}
      </>}

      {scene.type === 'math' && task && <>
        <Text style={[s.subtitle, { fontSize: 18 }]}>{text}</Text>
        <MathCard key={task.id} task={task} say={say} tone={tone} voice={voice}
          onResolved={(ok, given) => onMath(task, ok, given)} onNext={next}
          nextLabel={index + 1 >= story.scenes.length ? 'Завершити пригоду 🏁' : 'Далі →'} />
      </>}

      {scene.type === 'read' && <>
        <Text style={[s.subtitle, { fontSize: 18 }]}>{text}</Text>
        <ReadingCard key={index} passage={scene.passages[readingLevel]} question={readingLevel === 0 ? scene.easy : scene.main} say={say} tone={tone}
          onResolved={(ok, wpm) => onRead(ok, `«${story.name}»: ${(readingLevel === 0 ? scene.easy : scene.main).q}`, wpm)} onNext={next} />
      </>}
    </View>
  );
}
