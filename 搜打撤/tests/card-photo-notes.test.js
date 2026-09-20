import { describe, expect, it } from 'vitest';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote } from '../game/src/card-photo-notes.js';
import notesData from '../game/data/card-notes.json';

describe('卡牌备注（底稿+手写两层）', () => {
  it('非底稿卡且未手写时返回空值，由界面展示统一占位文本', () => {
    localStorage.clear();
    expect(photoNoteFor({ id: 'x', type: '道具', note: '旧自动文案' })).toBe('');
    expect(PHOTO_NOTE_PLACEHOLDER).toContain('备注');
  });

  it('底稿卡未手写时返回 data/card-notes.json 的永久备注', () => {
    localStorage.clear();
    const card = { id: 'pet-egg', name: '宠物蛋', type: '资源' };
    expect(photoNoteFor(card)).toBe(String(notesData.notes['pet-egg']).trim());
  });

  it('按卡牌 id 保存手写记录，且优先于底稿', () => {
    localStorage.clear();
    const card = { id: 'pet-egg', name: '宠物蛋', type: '资源' };
    expect(savePhotoNote(card, '  我来写的文案  ')).toBe('我来写的文案');
    expect(photoNoteFor(card)).toBe('我来写的文案');
  });

  it('清空输入会删除手写备注并回落底稿', () => {
    localStorage.clear();
    const card = { id: 'pet-egg', name: '宠物蛋', type: '资源' };
    savePhotoNote(card, '临时文案');
    savePhotoNote(card, '   ');
    expect(photoNoteFor(card)).toBe(String(notesData.notes['pet-egg']).trim());
  });

  it('不同卡牌的备注互不覆盖', () => {
    localStorage.clear();
    savePhotoNote({ id: 'a' }, '甲');
    savePhotoNote({ id: 'b' }, '乙');
    expect(photoNoteFor({ id: 'a' })).toBe('甲');
    expect(photoNoteFor({ id: 'b' })).toBe('乙');
  });
});
