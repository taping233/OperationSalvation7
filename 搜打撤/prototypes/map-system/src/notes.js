/* ============================================================
 * 搜打撤 v0.2.1 —— 格子备注存储（localStorage 持久化）
 * 键：`楼层id|x,y`；值：备注文字。
 * 导出 JSON 交给开发者/AI 后，可据此把备注落成正式格子事件。
 * ============================================================ */
(function () {
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

  window.SDT = window.SDT || {};
  SDT.Notes = { all, get, set, clearAll };
})();
