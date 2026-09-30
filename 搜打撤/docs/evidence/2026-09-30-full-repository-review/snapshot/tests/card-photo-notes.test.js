import { describe, expect, it, vi } from 'vitest';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote } from '../game/src/cards/card-photo-notes.js';

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
});
