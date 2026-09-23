/* 卡牌备注（2026-09-20 老板定版）：
 *
 * 两层结构：
 *   1. 永久底稿 —— data/card-notes.json，可为空；已有条目随版本分发。
 *   2. 人工改写 —— 老板在卡牌库内手写，存 localStorage；展示与导出时优先于底稿。
 *
 * 同步闭环：卡牌库「导出备注」按钮把 底稿+手写合并成 JSON 下载，
 * 整文件回填 card-notes.json 提交，即完成"改的东西进了数据库"。
 * 空白手写会删除手写层，并回落到底稿；无底稿时返回空字符串供界面显示占位。
 * 守卫测试 tests/card-notes-coverage.test.js 检查已有条目。
 */
import notesData from '../data/card-notes.json';

const BASE_NOTES = Object.freeze(notesData.notes || {});
const PHOTO_NOTE_KEY = 'sdt-card-photo-notes-v1';
export const PHOTO_NOTE_PLACEHOLDER = '写下这条卡的备注……';

function noteId(card) {
  return String(card?.id || card?.name || '').trim();
}

function readSavedNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PHOTO_NOTE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function savePhotoNote(card, value) {
  const id = noteId(card);
  const note = String(value || '').trim().slice(0, 240);
  if (!id) return note;
  const notes = readSavedNotes();
  if (note) notes[id] = note;
  else delete notes[id]; // 清空 = 回落底稿；无底稿时返回空
  try { localStorage.setItem(PHOTO_NOTE_KEY, JSON.stringify(notes)); } catch (_) {}
  return note;
}

export function photoNoteFor(card) {
  const id = noteId(card);
  if (!id) return '';
  const own = String(readSavedNotes()[id] || '').trim();
  if (own) return own;
  return String(BASE_NOTES[id] || '').trim();
}

/* 「导出备注」：已有底稿+手写合并成 card-notes.json 内容，整文件回填即同步进数据库 */
export function exportNotes() {
  const merged = { ...BASE_NOTES, ...readSavedNotes() };
  return JSON.stringify({ version: notesData.version || 1, _comment: notesData._comment || '', notes: merged }, null, 2);
}

export function hasManualNotes() {
  return Object.keys(readSavedNotes()).length > 0;
}
