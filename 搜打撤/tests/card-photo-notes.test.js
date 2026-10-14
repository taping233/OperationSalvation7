import { describe, expect, it, vi } from 'vitest';
import { PHOTO_NOTE_PLACEHOLDER, exportNotes, photoNoteFor, photoNotePending, savePhotoNote, savePhotoNoteResult } from '../game/src/cards/card-photo-notes.js';

describe('卡牌备注（底稿+手写两层）', () => {
  it('非底稿卡且未手写时返回空值，不沿用旧 note 字段', () => {
    localStorage.clear();
    expect(photoNoteFor({ id: 'x', type: '道具', note: '旧自动文案' })).toBe('');
  });

  it('底稿为空时，未手写卡和清空手写后都返回空值', async () => {
    localStorage.clear();
    const card = { id: 'empty-base-card', name: '无底稿卡', type: '资源' };
    vi.doMock('../game/data/card-notes.json', () => ({
      default: { version: 1, _comment: 'isolated empty fixture', notes: {} },
    }));
    vi.resetModules();
    try {
      const { photoNoteFor: photoNoteForWithoutBase, savePhotoNote: savePhotoNoteWithoutBase } =
        await import('../game/src/cards/card-photo-notes.js');
      expect(photoNoteForWithoutBase(card)).toBe('');
      savePhotoNoteWithoutBase(card, '临时手写');
      savePhotoNoteWithoutBase(card, '   ');
      expect(photoNoteForWithoutBase(card)).toBe('');
      expect(PHOTO_NOTE_PLACEHOLDER).toContain('备注');
    } finally {
      vi.doUnmock('../game/data/card-notes.json');
      vi.resetModules();
      localStorage.clear();
    }
  });

  it('有底稿时默认展示底稿，手写优先且清空后回落底稿', async () => {
    localStorage.clear();
    const card = { id: 'pet-egg', name: '宠物蛋', type: '资源' };
    vi.doMock('../game/data/card-notes.json', () => ({
      default: { version: 1, _comment: 'isolated fixture', notes: { 'pet-egg': 'fixture 底稿' } },
    }));
    vi.resetModules();
    try {
      const { photoNoteFor: photoNoteForWithBase, savePhotoNote: savePhotoNoteWithBase } =
        await import('../game/src/cards/card-photo-notes.js');
      expect(photoNoteForWithBase(card)).toBe('fixture 底稿');
      expect(savePhotoNoteWithBase(card, '  我来写的文案  ')).toBe('我来写的文案');
      expect(photoNoteForWithBase(card)).toBe('我来写的文案');
      savePhotoNoteWithBase(card, '   ');
      expect(photoNoteForWithBase(card)).toBe('fixture 底稿');
    } finally {
      vi.doUnmock('../game/data/card-notes.json');
      vi.resetModules();
      localStorage.clear();
    }
  });

  it('不同卡牌的备注互不覆盖', () => {
    localStorage.clear();
    savePhotoNote({ id: 'a' }, '甲');
    savePhotoNote({ id: 'b' }, '乙');
    expect(photoNoteFor({ id: 'a' })).toBe('甲');
    expect(photoNoteFor({ id: 'b' })).toBe('乙');
  });

  it('写入失败如实返回未落盘，保留本次会话编辑及导出，恢复后一起保存', () => {
    localStorage.clear();
    const a = { id: 'failed-note-a' }, b = { id: 'failed-note-b' };
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    try {
      expect(savePhotoNoteResult(a, '未落盘甲')).toEqual({ ok: false, persisted: false, note: '未落盘甲', code: 'WRITE_FAILED' });
      expect(savePhotoNote(b, '未落盘乙')).toBe('未落盘乙');
      expect(photoNotePending(a)).toBe(true);
      expect(photoNoteFor(a)).toBe('未落盘甲');
      expect(photoNoteFor(b)).toBe('未落盘乙');
      expect(JSON.parse(exportNotes()).notes).toMatchObject({ 'failed-note-a': '未落盘甲', 'failed-note-b': '未落盘乙' });
      expect(localStorage.getItem('sdt-card-photo-notes-v1')).toBeNull();
    } finally { write.mockRestore(); }
    expect(savePhotoNoteResult(a, '甲已恢复')).toMatchObject({ ok: true, persisted: true });
    expect(photoNotePending(a)).toBe(false);
    expect(photoNotePending(b)).toBe(false);
    expect(JSON.parse(localStorage.getItem('sdt-card-photo-notes-v1'))).toEqual({ 'failed-note-a': '甲已恢复', 'failed-note-b': '未落盘乙' });
  });

  it('未落盘的清空不会在重开时恢复旧手写内容，重试后才删除存储', () => {
    localStorage.clear();
    const card = { id: 'failed-note-clear' };
    savePhotoNote(card, '旧手写');
    const before = localStorage.getItem('sdt-card-photo-notes-v1');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    try {
      expect(savePhotoNoteResult(card, '')).toMatchObject({ ok: false, persisted: false, note: '' });
      expect(photoNoteFor(card)).toBe('');
      expect(photoNotePending(card)).toBe(true);
      expect(JSON.parse(exportNotes()).notes['failed-note-clear']).toBeUndefined();
      expect(localStorage.getItem('sdt-card-photo-notes-v1')).toBe(before);
    } finally { write.mockRestore(); }
    expect(savePhotoNoteResult(card, '')).toMatchObject({ ok: true, persisted: true });
    expect(photoNotePending(card)).toBe(false);
    expect(JSON.parse(localStorage.getItem('sdt-card-photo-notes-v1'))['failed-note-clear']).toBeUndefined();
  });

  it.each(['{bad json', '[]', 'null', '"wrong"'])('损坏备注原串 %s 不被单条编辑覆盖', raw => {
    localStorage.setItem('sdt-card-photo-notes-v1', raw);
    const card = { id: 'corrupt-notes-probe' };
    expect(savePhotoNoteResult(card, '待恢复内容')).toMatchObject({ ok: false, persisted: false });
    expect(localStorage.getItem('sdt-card-photo-notes-v1')).toBe(raw);
    expect(photoNoteFor(card)).toBe('待恢复内容');
    localStorage.setItem('sdt-card-photo-notes-v1', '{}');
    expect(savePhotoNoteResult(card, '已恢复')).toMatchObject({ ok: true, persisted: true });
  });

  it('读取失败拒绝写入，不把读不到的其他备注覆盖掉', () => {
    localStorage.clear();
    const card = { id: 'read-failed-note' };
    localStorage.setItem('sdt-card-photo-notes-v1', '{"existing-note":"原手写"}');
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('read unavailable'); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    try {
      expect(savePhotoNoteResult(card, '暂存内容')).toMatchObject({ ok: false, persisted: false, code: 'READ_FAILED' });
      expect(write).not.toHaveBeenCalled();
      expect(photoNoteFor(card)).toBe('暂存内容');
    } finally { read.mockRestore(); write.mockRestore(); }
    expect(savePhotoNoteResult(card, '已恢复')).toMatchObject({ ok: true, persisted: true });
    expect(JSON.parse(localStorage.getItem('sdt-card-photo-notes-v1'))).toEqual({ 'existing-note': '原手写', 'read-failed-note': '已恢复' });
  });
});
