import { describe, it, expect, vi } from 'vitest';
vi.mock('expo-speech', () => ({ speak: vi.fn(), stop: vi.fn(), getAvailableVoicesAsync: vi.fn(async () => []) }));
import { numberWords, genderOf, speakable, sentences, pickBestVoice } from './speech';

describe('human-like speech text', () => {
  it('says numbers in words with gender agreement', () => {
    expect(numberWords(1, 'f')).toBe('одна'); expect(numberWords(1, 'n')).toBe('одне'); expect(numberWords(1)).toBe('один');
    expect(numberWords(2, 'f')).toBe('дві'); expect(numberWords(2, 'm')).toBe('два');
    expect(numberWords(15)).toBe('п’ятнадцять'); expect(numberWords(21, 'f')).toBe('двадцять одна');
    expect(genderOf('кулька')).toBe('f'); expect(genderOf('мушля')).toBe('f'); expect(genderOf('яблуко')).toBe('n');
    expect(genderOf('яйце')).toBe('n'); expect(genderOf('гриб')).toBe('m');
  });
  it('turns math symbols and emoji into words', () => {
    expect(speakable('4 + ? = 9')).toBe('чотири плюс скільки дорівнює дев’ять');
    expect(speakable('6 − 3 = ?')).toBe('шість мінус три дорівнює скільки');
    expect(speakable('? + 5 = 9')).toBe('скільки плюс п’ять дорівнює дев’ять');
    expect(speakable('Скільки разом? Молодець!')).toBe('Скільки разом? Молодець!');
    expect(speakable('«Привіт», — сказав Руді 🦊')).toBe('Привіт, сказав Руді');
    expect(speakable('У гнізді — 1 яйце, а під листям — ще 2.')).toBe('У гнізді одне яйце, а під листям ще два.');
    expect(speakable('Там 1 кулька і 1 гриб.')).toBe('Там одна кулька і один гриб.');
    expect(speakable('3 + 2 > 4')).toBe('три плюс два більше чотири');
  });
  it('splits into sentences', () => {
    expect(sentences('Привіт! Як ти? Ходімо.')).toEqual(['Привіт!', 'Як ти?', 'Ходімо.']);
  });
  it('prefers natural Ukrainian voices', () => {
    const v = pickBestVoice([
      { id: 'a', name: 'English', language: 'en-US' },
      { id: 'b', name: 'Ukrainian', language: 'uk-UA' },
      { id: 'c', name: 'Microsoft Polina Online (Natural) - Ukrainian', language: 'uk-UA' },
    ]);
    expect(v?.id).toBe('c');
    expect(pickBestVoice([{ id: 'b', name: 'Ukrainian', language: 'uk_UA' }, { id: 'c', name: 'Natural', language: 'uk-UA' }], 'b')?.id).toBe('b');
    expect(pickBestVoice([{ id: 'a', name: 'English', language: 'en-US' }])).toBeUndefined();
  });
});
