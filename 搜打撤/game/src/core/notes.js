import { sdtDefine } from './sdt-facade.js';
  const KEY = 'sdt-cell-notes-v1';

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

  function set(floorId, x, y, text) {
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

  function clearAll() { try { localStorage.removeItem(KEY); } catch { /* 存储不可用 */ } }

  sdtDefine('Notes', { all, get, set, clearAll });

export { KEY };
