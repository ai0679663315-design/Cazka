import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { C, s } from './theme';
import { Button, Celebrate, Say } from './components';
import {
  CANVAS_H, CANVAS_W, COLORS, Drawing, ERASER, IDEAS, Item, SIZES, STAMPS, TEMPLATES, newDrawingId, pathFrom,
} from './drawing';

/** Показ малюнка будь-якого розміру (і полотно, і мініатюра в альбомі). */
export function DrawingView({ items, template, width, live }: { items: Item[]; template?: string; width: number; live?: Item | null }) {
  const height = Math.round(width * CANVAS_H / CANVAS_W);
  const all = live ? [...items, live] : items;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
      <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#FFFFFF" />
      {all.map((it, i) => it.k === 'line'
        ? <Path key={i} d={pathFrom(it.p)} stroke={it.c} strokeWidth={it.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        : <SvgText key={i} x={it.x} y={it.y + it.s * 0.35} fontSize={it.s} textAnchor="middle">{it.e}</SvgText>)}
      {!!template && TEMPLATES[template] && (
        <G>{TEMPLATES[template].paths.map((d, i) => <Path key={i} d={d} stroke="#3A3A3A" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" fill="none" />)}</G>
      )}
    </Svg>
  );
}

type Tool = 'brush' | 'eraser' | 'stamp';

/**
 * Полотно з інструментами. Малюємо пальцем або мишкою.
 * onSave отримує готовий малюнок; doneLabel — текст кнопки збереження.
 */
export function DrawPad({ initial, template: initialTemplate, prompt, say, onSave, doneLabel = '💾 Зберегти в альбом', compact = false }: {
  initial?: Drawing | null; template?: string; prompt?: string; say: Say;
  onSave: (d: Drawing) => void; doneLabel?: string; compact?: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initial?.items ?? []);
  const [template, setTemplate] = useState<string | undefined>(initial?.template ?? initialTemplate);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1].w);
  const [tool, setTool] = useState<Tool>('brush');
  const [stamp, setStamp] = useState(STAMPS[0]);
  const [live, setLive] = useState<Item | null>(null);
  const [width, setWidth] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saved, setSaved] = useState(false);
  const idRef = useRef(initial?.id ?? newDrawingId());
  const points = useRef<number[]>([]);

  useEffect(() => { if (!confirmClear) return; const t = setTimeout(() => setConfirmClear(false), 4000); return () => clearTimeout(t); }, [confirmClear]);

  const toCanvas = (e: GestureResponderEvent) => {
    const k = CANVAS_W / Math.max(1, width);
    return [Math.round(Math.max(0, Math.min(CANVAS_W, e.nativeEvent.locationX * k))), Math.round(Math.max(0, Math.min(CANVAS_H, e.nativeEvent.locationY * k)))];
  };
  const start = (e: GestureResponderEvent) => {
    setSaved(false);
    const [x, y] = toCanvas(e);
    if (tool === 'stamp') { setItems(list => [...list, { k: 'stamp', e: stamp, x, y, s: 110 }]); return; }
    points.current = [x, y];
    setLive({ k: 'line', c: tool === 'eraser' ? ERASER : color, w: tool === 'eraser' ? Math.max(size, 36) : size, p: points.current });
  };
  const move = (e: GestureResponderEvent) => {
    if (tool === 'stamp' || !live) return;
    const [x, y] = toCanvas(e);
    const p = points.current;
    if (Math.abs(p[p.length - 2] - x) + Math.abs(p[p.length - 1] - y) < 4) return; // не додаємо майже однакові точки
    points.current = [...p, x, y];
    setLive({ ...(live as Extract<Item, { k: 'line' }>), p: points.current });
  };
  const end = () => { if (live) { setItems(list => [...list, live]); setLive(null); } };

  const save = () => {
    onSave({ id: idRef.current, date: new Date().toISOString(), template, items });
    setSaved(true);
  };

  const canvasWidth = width;
  return (
    <View style={{ gap: 14 }}>
      {!!prompt && <Pressable onPress={() => say(prompt)}><Text style={d.prompt}>💡 {prompt}  🔊</Text></Pressable>}

      <View style={d.frame} onLayout={e => setWidth(Math.floor(e.nativeEvent.layout.width))}>
        {canvasWidth > 0 && (
          <View
            pointerEvents="box-only"
            style={[{ width: canvasWidth, height: Math.round(canvasWidth * CANVAS_H / CANVAS_W) }, { touchAction: 'none', cursor: 'crosshair' } as object]}
            onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={start} onResponderMove={move} onResponderRelease={end} onResponderTerminate={end}
            accessibilityLabel="Полотно для малювання"
          >
            <DrawingView items={items} template={template} width={canvasWidth} live={live} />
          </View>
        )}
      </View>

      {/* Інструменти */}
      <View style={d.row}>
        {([['brush', '🖌️ Пензлик'], ['eraser', '🧽 Гумка'], ['stamp', '⭐ Штампи']] as [Tool, string][]).map(([t, l]) => (
          <Pressable key={t} accessibilityRole="button" onPress={() => setTool(t)} style={[d.tool, tool === t && d.toolOn]}><Text style={[d.toolText, tool === t && { color: '#fff' }]}>{l}</Text></Pressable>
        ))}
      </View>

      {tool !== 'stamp' && <>
        {tool === 'brush' && <View style={d.row}>
          {COLORS.map(c => (
            <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Колір ${c}`} onPress={() => setColor(c)}
              style={[d.swatch, { backgroundColor: c }, color === c && d.swatchOn]} />
          ))}
        </View>}
        <View style={d.row}>
          {SIZES.map(sz => (
            <Pressable key={sz.w} accessibilityRole="button" accessibilityLabel={sz.label} onPress={() => setSize(sz.w)} style={[d.size, size === sz.w && d.sizeOn]}>
              <View style={{ width: sz.w * 0.7 + 4, height: sz.w * 0.7 + 4, borderRadius: 40, backgroundColor: tool === 'eraser' ? '#C9CCC0' : color }} />
            </Pressable>
          ))}
        </View>
      </>}
      {tool === 'stamp' && <View style={d.row}>
        {STAMPS.map(e => (
          <Pressable key={e} accessibilityRole="button" onPress={() => setStamp(e)} style={[d.size, stamp === e && d.sizeOn]}><Text style={{ fontSize: 30 }}>{e}</Text></Pressable>
        ))}
        <Text style={[s.small, { width: '100%', textAlign: 'center' }]}>Торкнися полотна, щоб поставити штамп</Text>
      </View>}

      {!compact && <>
        <Text style={[s.label, { textAlign: 'center' }]}>Розмальовки</Text>
        <View style={d.row}>
          <Pressable accessibilityRole="button" onPress={() => setTemplate(undefined)} style={[d.tool, !template && d.toolOn]}><Text style={[d.toolText, !template && { color: '#fff' }]}>⬜ Чистий аркуш</Text></Pressable>
          {Object.entries(TEMPLATES).map(([id, t]) => (
            <Pressable key={id} accessibilityRole="button" onPress={() => setTemplate(id)} style={[d.tool, template === id && d.toolOn]}><Text style={[d.toolText, template === id && { color: '#fff' }]}>{t.emoji} {t.name}</Text></Pressable>
          ))}
        </View>
      </>}

      <View style={d.row}>
        <Pressable accessibilityRole="button" disabled={!items.length} onPress={() => setItems(list => list.slice(0, -1))} style={[d.tool, !items.length && { opacity: .4 }]}><Text style={d.toolText}>↩️ Назад</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!items.length} onPress={() => { if (!confirmClear) { setConfirmClear(true); return; } setItems([]); setConfirmClear(false); }}
          style={[d.tool, !items.length && { opacity: .4 }, confirmClear && { backgroundColor: C.badBg }]}>
          <Text style={[d.toolText, confirmClear && { color: C.bad }]}>{confirmClear ? 'Точно стерти все?' : '🗑️ Почати знову'}</Text>
        </Pressable>
      </View>

      {saved ? <Celebrate text="Малюнок у твоєму альбомі!" emoji="🎨 ⭐ 🖼️" /> : null}
      <Button big disabled={!items.length} onPress={save}>{doneLabel}</Button>
    </View>
  );
}

/** Екран «Малювалка»: полотно + альбом малюнків. */
export function DrawStudio({ drawings, say, onSave, onDelete }: {
  drawings: Drawing[]; say: Say; onSave: (d: Drawing) => void; onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Drawing | null>(null);
  const [key, setKey] = useState(0);
  const [idea, setIdea] = useState(() => IDEAS[Math.floor(Math.random() * IDEAS.length)]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const open = (dr: Drawing | null) => { setEditing(dr); setKey(k => k + 1); };
  return (
    <View style={s.lesson}>
      <Text style={s.title}>Малювалка 🎨</Text>
      <Text style={s.subtitle}>Малюй пальчиком, став штампи або розфарбуй картинку.</Text>
      <View style={d.row}>
        <Button secondary onPress={() => { const n = IDEAS[(IDEAS.indexOf(idea) + 1) % IDEAS.length]; setIdea(n); say(n); }}>🎲 Інша ідея</Button>
        <Button secondary onPress={() => open(null)}>✨ Новий малюнок</Button>
      </View>
      <DrawPad key={key} initial={editing} prompt={editing ? undefined : idea} say={say} onSave={dr => { onSave(dr); setEditing(dr); }} />

      {drawings.length > 0 && <>
        <View style={s.sectionHead}><Text style={s.sectionTitle}>Мій альбом малюнків</Text><Text style={s.muted}>{drawings.length}</Text></View>
        <ScrollView horizontal contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
          {drawings.map(dr => (
            <View key={dr.id} style={{ gap: 6, alignItems: 'center' }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Відкрити малюнок" onPress={() => open(dr)} style={[d.thumb, editing?.id === dr.id && { borderColor: C.green }]}>
                <DrawingView items={dr.items} template={dr.template} width={150} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { if (confirmDelete !== dr.id) { setConfirmDelete(dr.id); return; } onDelete(dr.id); setConfirmDelete(null); if (editing?.id === dr.id) open(null); }}>
                <Text style={[s.small, confirmDelete === dr.id && { color: C.bad, fontWeight: '700' }]}>{confirmDelete === dr.id ? 'Точно видалити?' : '🗑️ видалити'}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </>}
    </View>
  );
}

const d = StyleSheet.create({
  prompt: { fontSize: 18, lineHeight: 26, color: '#6B5B2E', backgroundColor: '#FFF6DB', padding: 14, borderRadius: 16, textAlign: 'center' },
  frame: { width: '100%', borderRadius: 20, overflow: 'hidden', borderWidth: 3, borderColor: '#E3E7D6', backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' },
  tool: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 30, backgroundColor: '#F0F3E9', borderWidth: 1, borderColor: '#E1E6D4' },
  toolOn: { backgroundColor: C.green, borderColor: C.green },
  toolText: { fontSize: 15, fontWeight: '600', color: '#5B6F48' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: .15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  swatchOn: { borderColor: '#2F3B26', transform: [{ scale: 1.15 }] },
  size: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#F6F7F1', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  sizeOn: { borderColor: C.green, backgroundColor: '#EEF2E5' },
  thumb: { borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: '#E3E7D6' },
});
