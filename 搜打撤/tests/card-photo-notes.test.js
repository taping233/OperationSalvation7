import { describe, expect, it } from 'vitest';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote } from '../game/src/card-photo-notes.js';

describe('照相馆照片背签', () => {
  it('未填写时返回空值，由界面展示统一占位文本', () => {
    localStorage.clear();
    expect(photoNoteFor({ id: 'x', type: '道具', note: '旧自动文案' })).toBe('');
    expect(PHOTO_NOTE_PLACEHOLDER).toContain('点击这里');
  });

  it('按卡牌 id 保存馆方手写记录', () => {
    localStorage.clear();
    const card = { id: 'pet-egg', name: '宠物蛋', type: '资源' };
    expect(savePhotoNote(card, '  我来写的文案  ')).toBe('我来写的文案');
    expect(photoNoteFor(card)).toBe('我来写的文案');
  });

  it('清空输入会删除该卡备注并恢复占位状态', () => {
    localStorage.clear();
    const card = { id: 'sample-spell', name: '样例法术' };
    savePhotoNote(card, '临时文案');
    savePhotoNote(card, '   ');
    expect(photoNoteFor(card)).toBe('');
  });

  it('不同卡牌的备注互不覆盖', () => {
    localStorage.clear();
    savePhotoNote({ id: 'a' }, '甲');
    savePhotoNote({ id: 'b' }, '乙');
    expect(photoNoteFor({ id: 'a' })).toBe('甲');
    expect(photoNoteFor({ id: 'b' })).toBe('乙');
  });
});
