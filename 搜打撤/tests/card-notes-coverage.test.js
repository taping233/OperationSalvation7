/* 卡牌备注守卫（2026-09-20 老板定版：永久底稿允许为空）：
 *
 * 对已有条目做守卫，空对象是有效底稿：
 *   1. 备注条目的 id 都必须存在于现役卡库；
 *   2. 文案非空；草稿≤60字，老板长文原文≤240字；仅保留老板已写的明确同文组，其余不重复。
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

const latestEdgeNotes = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/2026-10-27-card-notes-sync/edge-notes.json'), 'utf8')).notes;

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
  it('文案非空；草稿不超过60字，老板长文逐字保留且不超过240字', () => {
    const bad = Object.entries(notesData.notes)
      .filter(([k, v]) => !String(v).trim() || String(v).trim().length > (latestEdgeNotes[k] === v ? 240 : 60))
      .map(([k]) => k);
    expect(bad, `以下条目文案为空或超过 60 字: ${bad.join(', ')}`).toEqual([]);
  });

  it('除老板原文的明确同文组外，全库无重复文案', () => {
    const authoredGroups = [
      { text: '第二原初的一部分碎片', ids: ['cmtn79743r2n', 'cmtn7err0a7'] },
      { text: '局长赠与无的佩剑之一', ids: ['tt8-demonslay', 'tt8-heavensword'] },
      { text: '某位古神的肢体之一', ids: ['tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'] },
      { text: '克劳泽开发的禁术，对使用者有不可逆的影响', ids: ['tt8-curse1', 'tt8-curse2', 'tt8-curse3', 'tt8-curse4'] },
      { text: '维克斯托克藏品之一，对使用者似乎有特殊的意义', ids: ['tt2-frostsword', 'tt3-twinwater-mail'] },
      { text: '我想你应该知道怎么做', ids: ['tt-keys-bunch', 'tt-key-one'] },
      { text: '装备部开发的辅助道具之一', ids: ['tt2-swiftarrow', 'tt3-blood-arrow', 'tt3-venom-arrow', 'tt3-python-potion', 'tt3-mystery-potion', 'tt3-life-arrow'] },
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
  for (const [id, text] of Object.entries(source.notes)) expect(notesData.notes[id]).toBe(latestEdgeNotes[id] ?? text);
});

it('永久底稿逐条保留第二次同步的32条原文', () => {
  const source = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/2026-10-24-photo-notes/sync-32-notes.json'), 'utf8'));
  expect(Object.keys(source.notes)).toHaveLength(32);
  for (const [id, text] of Object.entries(source.notes)) expect(notesData.notes[id]).toBe(latestEdgeNotes[id] ?? text);
});

it('永久底稿逐条保留老板在静态审阅页修改的37条原文', async () => {
  const source = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/2026-10-26-card-notes/reviewed-notes-37.json'), 'utf8'));
  const { photoNoteFor } = await import('../game/src/cards/card-photo-notes.js');
  expect(Object.keys(source.notes)).toHaveLength(37);
  for (const [id, text] of Object.entries(source.notes)) {
    expect(notesData.notes[id]).toBe(latestEdgeNotes[id] ?? text);
    expect(photoNoteFor({ id })).toBe(latestEdgeNotes[id] ?? text);
  }
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

it('本轮Edge备注逐字同步，其他底稿保持不变', async () => {
  const previous = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/2026-10-27-card-notes-sync/before-sync.json'), 'utf8'));
  const { photoNoteFor } = await import('../game/src/cards/card-photo-notes.js');
  expect(Object.keys(latestEdgeNotes)).toHaveLength(117);
  expect(notesData.notes).toEqual({ ...previous.notes, ...latestEdgeNotes });
  for (const [id, text] of Object.entries(latestEdgeNotes)) expect(photoNoteFor({ id })).toBe(text);
});
