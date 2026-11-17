import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Малюнки зберігаємо у власних координатах 1000 × 750 (полотно 4:3),
 * тому вони однаково виглядають на телефоні, планшеті й у мініатюрах.
 */
export const CANVAS_W = 1000, CANVAS_H = 750;

export type Line = { k: 'line'; c: string; w: number; p: number[] };
export type Stamp = { k: 'stamp'; e: string; x: number; y: number; s: number };
export type Item = Line | Stamp;
export type Drawing = { id: string; date: string; template?: string; items: Item[] };

export const COLORS = ['#E5484D', '#F28C28', '#F5C518', '#4CAF50', '#2BB3A3', '#3B82F6', '#8B5CF6', '#EC4899', '#8D5A3B', '#222222'];
export const SIZES = [{ w: 8, label: 'Тонкий' }, { w: 18, label: 'Середній' }, { w: 36, label: 'Товстий' }];
export const STAMPS = ['⭐', '❤️', '🌸', '🦋', '🌈', '🎵', '☀️', '🐱'];
export const ERASER = '#FFFFFF';

export const IDEAS = [
  'Намалюй свого улюбленого героя з казки.',
  'Намалюй веселку над морем.',
  'Намалюй, що ти бачиш у вікні.',
  'Намалюй свою родину.',
  'Намалюй будинок для котика.',
  'Намалюй чарівну квітку, якої немає на світі.',
  'Намалюй, як Міра грає на піаніно.',
  'Намалюй свято з кульками.',
];

/** Плавна лінія: квадратичні криві через середини відрізків. */
export function pathFrom(p: number[]): string {
  if (p.length < 2) return '';
  if (p.length === 2) return `M${p[0]} ${p[1]} L${p[0] + 0.1} ${p[1] + 0.1}`; // крапка
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = Math.round((p[i] + p[i + 2]) / 2), my = Math.round((p[i + 1] + p[i + 3]) / 2);
    d += ` Q${p[i]} ${p[i + 1]} ${mx} ${my}`;
  }
  return d + ` L${p[p.length - 2]} ${p[p.length - 1]}`;
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
function star(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    pts.push(`${Math.round(cx + rad * Math.cos(a))} ${Math.round(cy + rad * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Розмальовки: контури, які лишаються поверх фарби. */
export const TEMPLATES: Record<string, { name: string; emoji: string; paths: string[] }> = {
  star: { name: 'Зірка', emoji: '⭐', paths: [star(500, 400, 310, 130)] },
  heart: { name: 'Серце', emoji: '❤️', paths: ['M500 660 C150 430 170 120 380 135 C450 140 490 190 500 235 C510 190 550 140 620 135 C830 120 850 430 500 660 Z'] },
  house: { name: 'Будиночок', emoji: '🏠', paths: [
    'M240 380 L500 150 L760 380 Z', 'M300 380 L700 380 L700 660 L300 660 Z', 'M450 660 L450 520 L550 520 L550 660',
    'M340 430 L420 430 L420 500 L340 500 Z', 'M580 430 L660 430 L660 500 L580 500 Z', circle(860, 110, 60)] },
  flower: { name: 'Квітка', emoji: '🌸', paths: [
    ...[0, 1, 2, 3, 4, 5].map(i => circle(Math.round(500 + 140 * Math.cos(i * Math.PI / 3)), Math.round(300 + 140 * Math.sin(i * Math.PI / 3)), 85)),
    circle(500, 300, 70), 'M500 370 L500 720', 'M500 600 C430 520 360 540 330 580 C380 620 450 630 500 600'] },
  fish: { name: 'Рибка', emoji: '🐟', paths: [
    'M200 375 C300 190 610 190 710 375 C610 560 300 560 200 375 Z', 'M710 375 L860 250 L835 375 L860 500 Z',
    circle(320, 340, 28), 'M430 300 C470 360 470 400 430 450', 'M520 290 C560 360 560 400 520 460'] },
  piano: { name: 'Піаніно', emoji: '🎹', paths: [
    'M160 220 L840 220 L840 640 L160 640 Z', 'M160 420 L840 420',
    ...[1, 2, 3, 4, 5, 6, 7].map(i => `M${160 + i * 85} 420 L${160 + i * 85} 640`),
    ...[0, 1, 3, 4, 5].map(i => `M${222 + i * 85} 420 L${222 + i * 85} 540 L${268 + i * 85} 540 L${268 + i * 85} 420`)] },
};

const KEY = 'cazka.drawings';
export const MAX_DRAWINGS = 24;

export async function loadDrawings(): Promise<Drawing[]> {
  try { const v = await AsyncStorage.getItem(KEY); const list = v ? JSON.parse(v) : []; return Array.isArray(list) ? list : []; }
  catch { return []; }
}
/** Зберігає (або оновлює) малюнок; найновіші — першими, не більше MAX_DRAWINGS. */
export function upsert(list: Drawing[], d: Drawing): Drawing[] {
  return [d, ...list.filter(x => x.id !== d.id)].slice(0, MAX_DRAWINGS);
}
export async function saveDrawings(list: Drawing[]) { await AsyncStorage.setItem(KEY, JSON.stringify(list)); }
export const newDrawingId = () => `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
