import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Browser speech recognition for prototype.
 * Android/iOS native recognition requires a development build and a native speech module.
 * Never upload or persist raw audio here.
 */
export function useVoiceInput() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<any>(null);
  useEffect(() => () => recognition.current?.abort(), []);
  const supported = Platform.OS === 'web' && typeof (globalThis as any).SpeechRecognition !== 'undefined' ||
    Platform.OS === 'web' && typeof (globalThis as any).webkitSpeechRecognition !== 'undefined';
  const listen = (onResult: (text: string) => void) => {
    setError('');
    if (!supported) { setError('На цьому пристрої голосове введення поки недоступне. Введи відповідь текстом.'); return; }
    try {
      recognition.current?.abort();
      const SpeechRecognition = (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
      const r = new SpeechRecognition();
      r.lang = 'uk-UA'; r.interimResults = false; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = (event: any) => { const text = event.results?.[0]?.[0]?.transcript || ''; onResult(text); };
      r.onerror = (event: any) => { setError('Не вдалося розпізнати голос: ' + (event.error || 'невідома помилка')); setListening(false); };
      r.onend = () => setListening(false);
      recognition.current = r; r.start(); setListening(true);
    } catch { setListening(false); setError('Мікрофон недоступний. Перевір дозвіл браузера.'); }
  };
  const stop = () => { recognition.current?.stop(); setListening(false); };
  return { listening, error, supported, listen, stop };
}
