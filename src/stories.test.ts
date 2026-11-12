import { describe, it, expect } from 'vitest';
import { STORIES, nextStory, fillName, INTERESTS } from './stories';
import { makeTask, MathLevel } from './math';

describe('stories', () => {
  it('has ten unique adventures with math, reading and a choice', () => {
    expect(STORIES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(STORIES.map(s => s.id)).size).toBe(STORIES.length);
    for (const s of STORIES) {
      const types = s.scenes.map(x => x.type);
      expect(types.filter(t => t === 'math').length).toBeGreaterThanOrEqual(3);
      expect(types).toContain('read');
      expect(types).toContain('choice');
      expect(s.ending).toContain('{choice}');
      expect(INTERESTS.map(i => i.name)).toContain(s.interest);
    }
  });

  it('reading questions have three distinct options', () => {
    for (const s of STORIES) for (const sc of s.scenes) if (sc.type === 'read') {
      expect(new Set(sc.easy.options).size).toBe(3);
      expect(new Set(sc.main.options).size).toBe(3);
      sc.passages.forEach((p, i) => { if (i) expect(p.length).toBeGreaterThan(sc.passages[i - 1].length); });
    }
  });

  it('story word problems render without placeholders on every level', () => {
    const levels: MathLevel[] = [1, 2, 3, 4, 5];
    for (const s of STORIES) for (const sc of s.scenes) if (sc.type === 'math') {
      for (const tpl of [...sc.templates.add, ...(sc.templates.missing ?? []), ...(sc.templates.take ?? [])]) expect(tpl).toMatch(/\{(a|sum)\}/);
      for (const l of levels) for (let i = 0; i < 30; i++) {
        for (const kind of ['word', 'subtract'] as const) {
          if (kind === 'subtract' && !sc.templates.take) continue;
          const t = makeTask(l, Math.random, { kind, noun: sc.noun, templates: sc.templates });
          expect(t.options).toContain(t.answer);
          if (t.story) expect(t.story).not.toMatch(/[{}]/);
        }
      }
    }
  });

  it('picks the next unfinished story by interest', () => {
    expect(nextStory('Космос', []).id).toBe('space');
    expect(nextStory('Космос', ['space']).interest).not.toBe('Космос');
    expect(nextStory('Тварини', ['forest']).id).toBe('farm');
    expect(nextStory('Море', STORIES.map(s => s.id), 3).id).toBe(STORIES[3].id);
  });

  it('fills the child name and choice', () => {
    expect(fillName('Привіт, {name}! {choice}', 'Оля', 'ура')).toBe('Привіт, Оля! ура');
  });
});
