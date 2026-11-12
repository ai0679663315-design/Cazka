import * as Speech from 'expo-speech';

/**
 * Людяне озвучення:
 *  1) обираємо найкращий український голос на пристрої (Natural/Neural/Online/Enhanced/Google);
 *  2) готуємо текст: цифри → слова з правильним родом, «+ = ?» → слова, без емодзі й лапок;
 *  3) читаємо по реченнях — з природними паузами, а не одним довгим потоком.
 */

import { genderOf, numberWords } from './words';
export { numberWords, genderOf } from './words';
export type { Gender } from './words';

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Готує текст до вимови. Те, що бачить дитина на екрані, не змінюється. */
export function speakable(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(/[«»"“”„]/g, '')
    .replace(/\?(?=\s*[+=−])|(?<=[+=−]\s*)\?/g, 'скільки')
    .replace(/\s*\+\s*(?=[\dс])/g, ' плюс ')
    .replace(/(\d+)\s*[−-]\s*(?=\d)/g, '$1 мінус ')
    .replace(/\s*=\s*/g, ' дорівнює ')
    .replace(/\s+>\s+/g, ' більше ').replace(/\s+<\s+/g, ' менше ')
    .replace(/◯/g, 'що')
    .replace(/,?\s+—\s+/g, (m) => (m.startsWith(',') ? ', ' : ' '))
    // «1 яйце» → «одне яйце», «1 кулька» → «одна кулька» (рід видно з наступного слова в однині)
    .replace(/\b(\d{1,2})\b(\s+)(\p{L}+)/gu, (m, d, sp, w) => Number(d) % 10 === 1 && Number(d) !== 11 ? numberWords(Number(d), genderOf(w)) + sp + w : m)
    .replace(/\b(\d{1,2})\b/g, (_, d) => numberWords(Number(d)))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?])[,]+/g, '$1')
    .trim();
}

/** Ділить текст на речення, щоб між ними були живі паузи (і довгий текст не обривався в Chrome). */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map(x => x.trim()).filter(x => /[\p{L}\d]/u.test(x));
}

export type VoiceInfo = { id: string; name: string; language: string; quality?: string; local?: boolean };

/** Оцінка голосу: чим вища, тим природніше звучить. */
export function voiceScore(v: VoiceInfo): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (/natural|neural|wavenet|studio/.test(name)) score += 10;
  if (/online/.test(name)) score += 4;
  if (/premium|enhanced|improved/.test(name) || v.quality === 'Enhanced') score += 6;
  if (/google/.test(name)) score += 3;
  if (/polina|поліна|ostap|остап|lesya|леся/.test(name)) score += 2;
  if (/compact|espeak|robot/.test(name)) score -= 8;
  return score;
}

export function pickBestVoice(voices: VoiceInfo[], preferredId?: string): VoiceInfo | undefined {
  const uk = voices.filter(v => v.language?.toLowerCase().replace('_', '-').startsWith('uk'));
  return uk.find(v => v.id === preferredId) ?? [...uk].sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

// ---------- стан озвучення ----------
export type SpeechSettings = { voiceId?: string; rate: number };
let settings: SpeechSettings = { rate: 0.95 };
let chosen: VoiceInfo | undefined;
let available: VoiceInfo[] = [];

export async function loadVoices(): Promise<VoiceInfo[]> {
  try {
    let list = await Speech.getAvailableVoicesAsync();
    if (!list.length) { await new Promise(r => setTimeout(r, 700)); list = await Speech.getAvailableVoicesAsync(); }
    available = list.map(v => ({ id: v.identifier, name: v.name, language: v.language, quality: String(v.quality) }));
  } catch { available = []; }
  chosen = pickBestVoice(available, settings.voiceId);
  return available.filter(v => v.language?.toLowerCase().replace('_', '-').startsWith('uk')).sort((a, b) => voiceScore(b) - voiceScore(a));
}

export function configureSpeech(next: Partial<SpeechSettings>) {
  settings = { ...settings, ...next };
  if (available.length) chosen = pickBestVoice(available, settings.voiceId);
}
export const currentVoice = () => chosen;

/** Головна функція: сказати текст людяно. */
export function speak(text: string, mood: 'calm' | 'happy' = 'calm') {
  Speech.stop();
  const parts = sentences(speakable(text));
  parts.forEach(part => Speech.speak(part, {
    language: chosen?.language ?? 'uk-UA',
    voice: chosen?.id,
    rate: settings.rate,
    pitch: mood === 'happy' ? 1.12 : 1.04,
  }));
}
export const stopSpeaking = () => Speech.stop();
