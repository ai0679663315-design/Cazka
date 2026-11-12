import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useVoiceInput } from './src/useVoiceInput';
import { normalizeAnswer } from './src/learning';

type Profile = { name: string; age: string; interest: string; completed: number; reading: number; math: number };
const KEY = 'cazka.profile.v1';
const stories = [
  { title: 'Чарівний ліс', intro: 'Сьогодні ми потрапили до чарівного лісу. Білочка загубила дорогу додому. Допоможемо їй?', math: 'На дереві було три яблука, а потім виросло ще чотири. Скільки яблук стало?', answer: 7, reading: 'Білочка знайшла стежку додому.', question: 'Хто знайшов стежку?', options: ['Білочка','Лисиця','Їжак'], correct: 0 },
  { title: 'Космічна експедиція', intro: 'Ми сіли в ракету і полетіли до далекої планети. На нас чекає загадка!', math: 'На небі було п’ять зірок, а потім з’явилися ще дві. Скільки їх?', answer: 7, reading: 'Ракета прилетіла на синю планету.', question: 'Якого кольору планета?', options: ['Зеленого','Синього','Жовтого'], correct: 1 },
  { title: 'Острів скарбів', intro: 'Ми знайшли стару карту. Вона веде до скарбу на острові!', math: 'У скрині лежали шість монет. Дві забрали пірати. Скільки залишилося?', answer: 4, reading: 'Під пальмою лежала скриня зі скарбом.', question: 'Де була скриня?', options: ['Під пальмою','На кораблі','У печері'], correct: 0 }
];
const speak = (message: string) => { Speech.stop(); Speech.speak(message, { language: 'uk-UA', rate: 0.85 }); };
export default function App() {
  const voice = useVoiceInput();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState(''); const [age, setAge] = useState(''); const [interest, setInterest] = useState('');
  const [screen, setScreen] = useState<'home'|'story'|'math'|'reading'|'result'>('home');
  const [storyIndex, setStoryIndex] = useState(0); const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(''); const [mathPassed, setMathPassed] = useState(false);
  const story = stories[storyIndex % stories.length];
  useEffect(() => { AsyncStorage.getItem(KEY).then(v => { if (v) setProfile(JSON.parse(v)); }).finally(() => setReady(true)); }, []);
  const save = async (p: Profile) => { setProfile(p); await AsyncStorage.setItem(KEY, JSON.stringify(p)); };
  const start = () => { setFeedback(''); setMathPassed(false); setAnswer(''); setStoryIndex(profile?.completed || 0); setScreen('story'); speak(stories[(profile?.completed || 0) % stories.length].intro); };
  const finish = async () => { if (!profile) return; await save({...profile,completed:profile.completed+1,reading:profile.reading+1}); setScreen('result'); speak('Чудова робота! Пригоду завершено. До наступної зустрічі!'); };
  const Button = ({label,onPress,secondary=false}:{label:string;onPress:()=>void;secondary?:boolean}) => <Pressable onPress={onPress} style={[styles.button,secondary&&styles.secondary]}><Text style={[styles.buttonText,secondary&&styles.secondaryText]}>{label}</Text></Pressable>;
  if (!ready) return <SafeAreaView style={styles.page}><Text>Завантаження...</Text></SafeAreaView>;
  return <SafeAreaView style={styles.page}><StatusBar style="dark"/><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.brand}>✦ ДИТЯЧА КАЗКА</Text>
    {!profile ? <View style={styles.card}><Text style={styles.title}>Привіт, мандрівнику! 👋</Text><Text style={styles.body}>Познайомимося один раз, а потім я пам’ятатиму наші пригоди.</Text>
      <TextInput style={styles.input} placeholder="Як тебе звати?" value={name} onChangeText={setName}/><Button secondary label={voice.listening ? "🎙️ Слухаю..." : "🎙️ Назвати ім’я голосом"} onPress={()=>voice.listen(setName)}/>
      <TextInput style={styles.input} placeholder="Скільки тобі років?" value={age} onChangeText={setAge} keyboardType="number-pad"/>
      <TextInput style={styles.input} placeholder="Що тобі подобається?" value={interest} onChangeText={setInterest}/><Button secondary label="🎙️ Розповісти голосом" onPress={()=>voice.listen(setInterest)}/>
      <Button label="Почати знайомство →" onPress={async()=>{if(!name.trim())return;await save({name:name.trim(),age,interest,completed:0,reading:0,math:0});speak('Привіт, '+name+'! Рада знайомству. Вирушаймо у пригоду!');}}/>
      <Button secondary label="🔊 Послухати привітання" onPress={()=>speak('Привіт! Як тебе звати? Скільки тобі років? Що тобі подобається?')}/></View>
    : screen==='home' ? <><Text style={styles.title}>Привіт, {profile.name}! ☀️</Text><Text style={styles.body}>Я пам’ятаю тебе. Ми вже пройшли {profile.completed} пригод.</Text>
      <View style={styles.card}><Text style={styles.heading}>🌳 Наступна пригода</Text><Text style={styles.body}>Казка, у якій ти читаєш і рахуєш, щоб допомогти героям.</Text><Button label="Вирушити →" onPress={start}/></View>
      <View style={styles.card}><Text style={styles.heading}>📖 Читання: {profile.reading}</Text><Text style={styles.heading}>🔢 Арифметика: {profile.math}</Text><Text style={styles.body}>Твої результати залишаться тут після наступного запуску.</Text></View></>
    : screen==='story' ? <View style={styles.card}><Text style={styles.title}>🌲 {story.title}</Text><Text style={styles.body}>{story.intro}</Text><Button label="🔊 Послухати історію" secondary onPress={()=>speak(story.intro)}/><Button label="Допомогти герою →" onPress={()=>{setScreen('math');speak(story.math);}}/></View>
    : screen==='math' ? <View style={styles.card}><Text style={styles.heading}>🔢 Випробування на слух</Text><Text style={styles.body}>Слухай уважно, рахуй у голові й введи відповідь.</Text><Button secondary label="🔊 Прослухати приклад" onPress={()=>speak(story.math)}/>
      <TextInput style={styles.input} placeholder="Твоя відповідь" keyboardType="number-pad" value={answer} onChangeText={setAnswer}/><Button secondary label="🎙️ Сказати відповідь" onPress={()=>voice.listen(t=>{setAnswer(t);})}/>
      <Button label="Перевірити" onPress={async()=>{if(normalizeAnswer(answer)===story.answer){setMathPassed(true);setFeedback('Правильно! Ти допоміг герою.');if(profile)await save({...profile,math:profile.math+1});speak('Правильно! Молодець!');}else{setFeedback('Спробуй ще раз. Ти зможеш!');speak('Спробуй ще раз.');}}}/><Text style={styles.body}>{feedback}</Text>{mathPassed&&<Button label="Читати записку →" onPress={()=>{setScreen('reading');speak('Прочитай записку вголос.');}}/>}</View>
    : screen==='reading' ? <View style={styles.card}><Text style={styles.heading}>📖 Таємнича записка</Text><Text style={styles.reading}>{story.reading}</Text><Text style={styles.body}>{story.question}</Text>{story.options.map((o,i)=><Button key={o} secondary label={o} onPress={()=>{if(i===story.correct){finish();}else{setFeedback('Подумай і спробуй ще раз.');speak('Спробуй ще раз.');}}}/>)}<Text style={styles.body}>{feedback}</Text></View>
    : <View style={styles.card}><Text style={styles.title}>🏆 Пригоду завершено!</Text><Text style={styles.body}>Молодець, {profile.name}! Наступного разу на тебе чекатиме нова історія.</Text><Button label="На головну" onPress={()=>setScreen('home')}/></View>}
    {!!voice.error && <Text style={styles.body}>{voice.error}</Text>}
    <Text style={styles.footer}>Прогрес зберігається на цьому пристрої • Голосові відповіді — наступний етап</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({page:{flex:1,backgroundColor:'#F7F5EF'},content:{padding:22,paddingBottom:50,gap:16},brand:{fontSize:13,fontWeight:'800',letterSpacing:2,color:'#81765D',marginTop:12},title:{fontSize:30,fontWeight:'800',color:'#242E29',lineHeight:38},heading:{fontSize:21,fontWeight:'700',color:'#24372D'},body:{fontSize:17,lineHeight:26,color:'#55645B'},card:{backgroundColor:'#FFFFFF',padding:22,borderRadius:24,gap:16,borderWidth:1,borderColor:'#EAE7DF'},button:{backgroundColor:'#2D6652',borderRadius:16,paddingVertical:16,paddingHorizontal:18,alignItems:'center'},buttonText:{fontSize:17,fontWeight:'700',color:'#FFFFFF'},secondary:{backgroundColor:'#E8F0EA'},secondaryText:{color:'#285842'},input:{backgroundColor:'#F7F7F4',borderWidth:1,borderColor:'#D9DFD9',borderRadius:14,padding:15,fontSize:18,color:'#24372D'},reading:{fontSize:27,lineHeight:40,fontWeight:'600',color:'#1F3429'},footer:{fontSize:12,textAlign:'center',color:'#89948B',marginTop:20}});
