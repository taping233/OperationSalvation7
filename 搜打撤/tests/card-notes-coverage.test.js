/* 卡牌备注守卫（2026-09-20 老板定版：永久底稿允许为空）：
 *
 * 对已有条目做守卫，空对象是有效底稿：
 *   1. 备注条目的 id 都必须存在于现役卡库；
 *   2. 文案非空、≤60 字；仅保留老板已写的明确同文组，其余不重复。
 * 同步链与 battle-all-cards.test.js 同口径（ensureSha/Starters/Tabletop 含 TT11 退役替换），
 * all() 结果即实机现役卡库。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
await import('../game/src/cards/card-photo-notes.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const notesData = JSON.parse(readFileSync(path.join(ROOT, 'game', 'data', 'card-notes.json'), 'utf8'));

let allCards;
beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  allCards = C.all();
});

describe('卡牌备注守卫：已有条目 id 有效', () => {
  it('备注条目的 id 都能在现役卡库找到（退役/改名的死条目 = 红灯）', () => {
    const ids = new Set(allCards.map(c => c.id));
    const stale = Object.keys(notesData.notes).filter(id => !ids.has(id));
    expect(stale, `备注底稿里有现役卡库不存在的 id（卡退役/改名后遗留的死条目）: ` +
      stale.join(', ') + '——请删除或改成现役 id').toEqual([]);
  });
});

describe('卡牌备注守卫：文案质量底线', () => {
  it('文案非空且不超过 60 字', () => {
    const bad = Object.entries(notesData.notes)
      .filter(([, v]) => !String(v).trim() || String(v).trim().length > 60)
      .map(([k]) => k);
    expect(bad, `以下条目文案为空或超过 60 字: ${bad.join(', ')}`).toEqual([]);
  });

  it('除老板原文的明确同文组外，全库无重复文案', () => {
    const authoredGroups = [
      { text: '某位古神的肢体之一', ids: ['tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'] },
      { text: '克劳泽开发的禁术，对使用者有不可逆的影响', ids: ['tt8-curse1', 'tt8-curse2', 'tt8-curse3', 'tt8-curse4'] },
      { text: '维克斯托克藏品之一，对使用者似乎有特殊的意义', ids: ['tt2-frostsword', 'tt3-twinwater-mail'] },
    ];
    const seen = new Map();
    const dup = [];
    for (const [id, v] of Object.entries(notesData.notes)) {
      const key = String(v).trim();
      if (seen.has(key) && !authoredGroups.some(group => group.text === key && group.ids.includes(id) && group.ids.includes(seen.get(key)))) dup.push(`${seen.get(key)} ↔ ${id}`);
      else seen.set(key, id);
    }
    expect(dup, `发现重复文案（防偷懒复制）: ${dup.join(', ')}`).toEqual([]);
  });
});

it('永久底稿逐条保留老板 Edge 中提取的23条原文', () => {
  const source = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/2026-10-24-photo-notes/original-notes.json'), 'utf8'));
  expect(Object.keys(source.notes)).toHaveLength(23);
  for (const [id, text] of Object.entries(source.notes)) expect(notesData.notes[id]).toBe(text);
});

it('永久底稿逐条保留第二次同步的32条原文', () => {
  const source = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/2026-10-24-photo-notes/sync-32-notes.json'), 'utf8'));
  expect(Object.keys(source.notes)).toHaveLength(32);
  for (const [id, text] of Object.entries(source.notes)) expect(notesData.notes[id]).toBe(text);
});

describe('卡牌备注运行链：photoNoteFor 两层优先级', () => {
  it('默认读底稿；localStorage 手写优先；清空手写回落底稿', async () => {
    const { photoNoteFor, savePhotoNote } = await import('../game/src/cards/card-photo-notes.js');
    const sample = allCards[0];
    // 底稿层
    expect(photoNoteFor(sample)).toBe(String(notesData.notes[sample.id] || '').trim());
    // 手写层覆盖
    savePhotoNote(sample, '老板手写的备注');
    expect(photoNoteFor(sample)).toBe('老板手写的备注');
    // 清空 = 恢复底稿
    savePhotoNote(sample, '');
    expect(photoNoteFor(sample)).toBe(String(notesData.notes[sample.id] || '').trim());
  });
});
