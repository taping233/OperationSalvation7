// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/data/card-notes.json', () => ({ default: { version: 1, notes: {} } }));
afterEach(() => { localStorage.clear(); vi.resetModules(); });

describe('合成备注键数据保真', () => {
  it.each(['toString', 'constructor', '__proto__'])('允许的字符串id %s 不继承对象原型且可保存、读取、导出、清空', async id => {
    vi.resetModules(); localStorage.clear();
    const { photoNoteFor, savePhotoNoteResult, exportNotes } = await import('../game/src/cards/card-photo-notes.js');
    const card = { id };
    expect(photoNoteFor(card)).toBe('');
    expect(savePhotoNoteResult(card, '合成手写备注')).toMatchObject({ ok: true, persisted: true });
    expect(photoNoteFor(card)).toBe('合成手写备注');
    expect(JSON.parse(exportNotes()).notes[id]).toBe('合成手写备注');
    expect(savePhotoNoteResult(card, '')).toMatchObject({ ok: true, persisted: true });
    expect(photoNoteFor(card)).toBe('');
  });
  it('__proto__手写内容确实落到自有JSON键，而不是仅返回已保存', async () => {
    vi.resetModules(); localStorage.clear();
    const { photoNoteFor, savePhotoNoteResult } = await import('../game/src/cards/card-photo-notes.js');
    const card = { id: '__proto__' };
    expect(savePhotoNoteResult(card, '合成内容')).toMatchObject({ ok: true, persisted: true });
    const saved = JSON.parse(localStorage.getItem('sdt-card-photo-notes-v1'));
    expect(Object.hasOwn(saved, '__proto__')).toBe(true);
    expect(photoNoteFor(card)).toBe('合成内容');
  });
});
