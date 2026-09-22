const FEEDBACK_KEY = 'sdt-suggestions-v1';
const fail = (code, message) => ({ ok: false, code, message });

function storageOrFailure(storage) {
  if (storage) return { ok: true, value: storage };
  try { return { ok: true, value: globalThis.localStorage }; }
  catch { return fail('READ_FAILED', '无法访问本地留言存储'); }
}
function readLocalFeedback(storage) {
  const port = storageOrFailure(storage); if (!port.ok) return port;
  let raw;
  try { raw = port.value.getItem(FEEDBACK_KEY); } catch { return fail('READ_FAILED', '无法读取本地留言'); }
  if (raw == null) return { ok: true, value: [], raw: null };
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? { ok: true, value, raw } : fail('INVALID_DATA', '留言库格式损坏，原数据已保留');
  } catch { return fail('INVALID_DATA', '留言库格式损坏，原数据已保留'); }
}

function appendLocalFeedback(entry, storage) {
  const read = readLocalFeedback(storage);
  if (!read.ok) return read;
  const port = storageOrFailure(storage); if (!port.ok) return port;
  try { port.value.setItem(FEEDBACK_KEY, JSON.stringify([...read.value, entry])); return { ok: true, value: entry }; }
  catch { return fail('WRITE_FAILED', '本地写入失败，请保留内容后重试'); }
}

function feedbackExportRecord(entry) {
  const at = entry?.at && Number.isFinite(+entry.at.x) && Number.isFinite(+entry.at.y)
    ? { x: +entry.at.x, y: +entry.at.y } : null;
  return {
    formatVersion: 1, ts: String(entry?.ts || ''), gameVersion: String(entry?.version || '未知'),
    page: { id: String(entry?.page?.id || ''), name: String(entry?.page?.name || '未知页面') },
    target: { name: String(entry?.target?.name || '') }, at,
    text: String(entry?.text || ''), steps: String(entry?.steps || ''),
    expected: String(entry?.expected || ''), actual: String(entry?.actual || ''),
  };
}

function downloadFeedbackRecord(entry, ports = {}) {
  let href = null, revoke = null;
  try {
    const blob = new Blob([JSON.stringify(feedbackExportRecord(entry), null, 2)], { type: 'application/json;charset=utf-8' });
    const create = ports.createObjectURL || URL.createObjectURL.bind(URL);
    revoke = ports.revokeObjectURL || URL.revokeObjectURL.bind(URL);
    const click = ports.click || ((url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); });
    href = create(blob);
    const safeTs = String(entry?.ts || 'unknown').replace(/[^0-9A-Za-z_-]/g, '-').slice(0, 40);
    click(href, `sdt-feedback-${safeTs || 'unknown'}.json`);
    return { ok: true };
  }
  catch { return fail('DOWNLOAD_FAILED', '导出失败，请重试'); }
  finally { if (href && revoke) setTimeout(() => revoke(href), 0); }
}

export { FEEDBACK_KEY, appendLocalFeedback, downloadFeedbackRecord, feedbackExportRecord, readLocalFeedback };
