import { sdtDefine } from './sdt-facade.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
  const KEY = 'sdt-cell-notes-v1';

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }

  function get(floorId, x, y) {
    return all()[floorId + '|' + x + ',' + y] || '';
  }

  function set(floorId, x, y, text) {
    const data = all();
    const k = floorId + '|' + x + ',' + y;
    if (text && String(text).trim()) data[k] = String(text).trim();
    else delete data[k];
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  function clearAll() { localStorage.removeItem(KEY); }

  sdtDefine('Notes', { all, get, set, clearAll });

export { KEY };
