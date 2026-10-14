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
import notesData from '../../data/card-notes.json';

const BASE_NOTES = Object.freeze(notesData.notes || {});
const PHOTO_NOTE_KEY = 'sdt-card-photo-notes-v1';
export const PHOTO_NOTE_PLACEHOLDER = '写下这条卡的备注……';
// 未确认落盘的编辑留在本次会话，空字符串表示待保存的清空操作。
const pendingNotes = new Map();

function noteId(card) {
  return String(card?.id || card?.name || '').trim();
}

function readSavedNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PHOTO_NOTE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, code: 'INVALID_STORAGE', notes: {} };
    return { ok: true, notes: parsed };
  } catch {
    return { ok: false, code: 'READ_FAILED', notes: {} };
  }
}

function applyPendingNotes(notes) {
  const next = { ...notes };
  for (const [id, note] of pendingNotes) {
    if (note) next[id] = note;
    else delete next[id];
  }
  return next;
}

export function photoNotePending(card) {
  return pendingNotes.has(noteId(card));
}

export function savePhotoNoteResult(card, value) {
  const id = noteId(card);
  const note = String(value || '').trim().slice(0, 240);
  if (!id) return { ok: false, persisted: false, note, code: 'INVALID_CARD' };
  pendingNotes.set(id, note);
  const read = readSavedNotes();
  // 读取失败或原串损坏时保留原档，不把尚未读取的其他备注覆盖掉。
  if (!read.ok) return { ok: false, persisted: false, note, code: read.code };
  try {
    localStorage.setItem(PHOTO_NOTE_KEY, JSON.stringify(applyPendingNotes(read.notes)));
  } catch {
    return { ok: false, persisted: false, note, code: 'WRITE_FAILED' };
  }
  pendingNotes.clear();
  return { ok: true, persisted: true, note };
}

// 旧调用方的字符串返回口径保留；需要展示落盘状态的 UI 使用结果接口。
export function savePhotoNote(card, value) {
  return savePhotoNoteResult(card, value).note;
}

export function photoNoteFor(card) {
  const id = noteId(card);
  if (!id) return '';
  const own = String(applyPendingNotes(readSavedNotes().notes)[id] || '').trim();
  if (own) return own;
  return String(BASE_NOTES[id] || '').trim();
}

/* 「导出备注」：已有底稿+手写合并成 card-notes.json 内容，整文件回填即同步进数据库 */
export function exportNotes() {
  const merged = { ...BASE_NOTES, ...applyPendingNotes(readSavedNotes().notes) };
  return JSON.stringify({ version: notesData.version || 1, _comment: notesData._comment || '', notes: merged }, null, 2);
}
