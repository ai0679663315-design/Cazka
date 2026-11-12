import { Platform } from 'react-native';

/**
 * Дрібниці для вебверсії на планшеті: звуки-нагороди без файлів (Web Audio),
 * «розблокування» озвучення після першого дотику (iPad/Android вимагають жест користувача)
 * та перевірка, чи є на пристрої український голос.
 */
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!isWeb) return null;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx!.state === 'suspended') ctx!.resume().catch(() => undefined);
    return ctx;
  } catch { return null; }
}

function note(c: AudioContext, freq: number, start: number, length: number, type: OscillatorType = 'sine', volume = 0.18) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(volume, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + length);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + length + 0.05);
}

/** good — «дзинь» за правильну відповідь, soft — м'який звук помилки, win — фанфари за фінал. */
export function playTone(kind: 'good' | 'soft' | 'win') {
  const c = audio(); if (!c) return;
  try {
    if (kind === 'good') { note(c, 784, 0, .18); note(c, 1047, .1, .3); }
    else if (kind === 'soft') { note(c, 330, 0, .25, 'triangle', .1); }
    else { [523, 659, 784, 1047].forEach((f, i) => note(c, f, i * .12, .35)); }
  } catch { /* звук — лише приємний бонус */ }
}

/** Після першого дотику до екрана озвучення й звуки працюватимуть і на планшетах. */
export function unlockOnFirstTouch() {
  if (!isWeb) return;
  const unlock = () => {
    audio();
    try {
      const synth = window.speechSynthesis;
      if (synth && !synth.speaking) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }
    } catch { /* ignore */ }
    window.removeEventListener('pointerdown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
}

/** true/false — чи знайдено український голос; null — перевірити неможливо (нативний застосунок або старий браузер). */
export function hasUkrainianVoice(): Promise<boolean | null> {
  if (!isWeb || !window.speechSynthesis) return Promise.resolve(null);
  const check = () => window.speechSynthesis.getVoices().some(v => v.lang?.toLowerCase().startsWith('uk'));
  if (window.speechSynthesis.getVoices().length) return Promise.resolve(check());
  return new Promise(resolve => {
    const done = () => resolve(window.speechSynthesis.getVoices().length ? check() : null);
    window.speechSynthesis.addEventListener?.('voiceschanged', done, { once: true } as any);
    setTimeout(done, 1500);
  });
}
