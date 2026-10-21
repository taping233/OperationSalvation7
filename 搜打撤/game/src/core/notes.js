import { sdtDefine } from './sdt-facade.js';
  const KEY = 'sdt-cell-notes-v1';
  const NODE_MIGRATION_KEY = 'sdt-notes-node-migrated';

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw == null) return {};
      const data = JSON.parse(raw);
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch { return null; }
  }

  // 展示保留空对象降级口径；编辑必须区分缺档与损坏/读取失败。
  function all() { return readAll() || {}; }

  function get(floorId, x, y) {
    return all()[floorId + '|' + x + ',' + y] || '';
  }

  function canWrite() {
    try {
      const marker = localStorage.getItem(NODE_MIGRATION_KEY);
      return marker === null || marker === '1';
    } catch { return false; }
  }

  function set(floorId, x, y, text) {
    if (!canWrite()) return false;
    const data = readAll();
    if (!data) return false; // 原串无法安全读取时不覆盖，也不把编辑误报为成功。
    const k = floorId + '|' + x + ',' + y;
    if (text && String(text).trim()) data[k] = String(text).trim();
    else delete data[k];
    // 写入失败（配额满/隐私模式）返回 false：调用方提示并保留现场。旧实现裸 setItem
    // 抛错会炸断 saveNote 回调——备注丢失且弹层卡死在 modal（2026-09-28 代码线修复）。
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch { return false; }
    return data;
  }

  function clearAll() {
    if (!canWrite()) return false;
    try { localStorage.removeItem(KEY); return true; } catch { return false; }
  }

  function decodeNotes(raw) {
    if (raw === null) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  }

  function decodePending(raw) {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'after,before,stage,version' ||
      value.version !== 1 || value.stage !== 'pending' ||
      !(value.before === null || typeof value.before === 'string') || typeof value.after !== 'string' ||
      !decodeNotes(value.before) || !decodeNotes(value.after)) return null;
    return value;
  }

  // 仅旧备注坐标迁移使用现有 marker 暂存原串；恢复不重新解释已写入的结点坐标。
  function migrateLegacyCoordinates(transform) {
    let data = {}, step = '读取备注';
    const fail = message => ({ ok: false, data, message });
    try {
      const before = localStorage.getItem(KEY);
      data = decodeNotes(before);
      if (!data) { data = {}; return fail('备注原串损坏，原内容已保留'); }
      step = '读取迁移标记';
      const marker = localStorage.getItem(NODE_MIGRATION_KEY);
      let journal, pendingRaw;
      if (marker === null || marker === '1') {
        const original = JSON.stringify(data);
        data = transform(data, marker === null) || data;
        const after = JSON.stringify(data);
        // 已迁数据没有变化时不反复写存储，F1 别名仍可安全重试。
        if (marker === '1' && after === original) return { ok: true, data };
        step = '核对迁移前原串';
        if (localStorage.getItem(KEY) !== before || localStorage.getItem(NODE_MIGRATION_KEY) !== marker) {
          data = readAll() || {};
          return fail('备注或迁移标记已被其他页面修改，原内容已保留');
        }
        if (marker === '1') {
          step = '写入楼层别名备注';
          localStorage.setItem(KEY, after);
          step = '核对楼层别名备注';
          if (localStorage.getItem(KEY) !== after || localStorage.getItem(NODE_MIGRATION_KEY) !== '1') {
            data = readAll() || {};
            return fail('楼层别名备注写入未确认，原内容已保留');
          }
          return { ok: true, data };
        }
        journal = { version: 1, stage: 'pending', before, after };
        pendingRaw = JSON.stringify(journal);
        step = '写入待完成迁移标记';
        localStorage.setItem(NODE_MIGRATION_KEY, pendingRaw);
      } else {
        step = '校验待完成迁移标记';
        journal = decodePending(marker);
        if (!journal) return fail('迁移标记损坏或未知，原内容已保留');
        pendingRaw = marker;
      }
      step = '核对待完成迁移标记';
      if (localStorage.getItem(NODE_MIGRATION_KEY) !== pendingRaw) return fail('待完成迁移标记已变化，原内容已保留');
      step = '读取待完成迁移原串';
      const current = localStorage.getItem(KEY);
      if (current !== journal.before && current !== journal.after) {
        data = decodeNotes(current) || {};
        return fail('备注与待完成迁移不匹配，原内容已保留');
      }
      if (current !== journal.after) {
        step = '写入迁移后备注';
        localStorage.setItem(KEY, journal.after);
      }
      step = '核对迁移后备注';
      if (localStorage.getItem(KEY) !== journal.after) {
        data = readAll() || {};
        return fail('迁移后备注写入未确认，待完成标记已保留');
      }
      data = decodeNotes(journal.after);
      step = '核对完成前迁移标记';
      if (localStorage.getItem(NODE_MIGRATION_KEY) !== pendingRaw) return fail('迁移标记已被其他页面修改，现场已保留');
      step = '写入完成迁移标记';
      localStorage.setItem(NODE_MIGRATION_KEY, '1');
      step = '核对完成迁移标记';
      if (localStorage.getItem(NODE_MIGRATION_KEY) !== '1' || localStorage.getItem(KEY) !== journal.after) {
        data = readAll() || {};
        return fail('迁移完成写入未确认，请重试');
      }
      return { ok: true, data };
    } catch { return fail(step + '失败，原内容与未完成现场已保留'); }
  }

  export const Notes = sdtDefine('Notes', { all, get, set, clearAll, migrateLegacyCoordinates });

export { KEY };
