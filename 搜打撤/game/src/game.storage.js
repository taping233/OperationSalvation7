import { migrateRunCharacter } from './characters.js';
const SLOT_COUNT = 5;
const RUN_KEY = index => `sdt-save-v2-slot${index}`;
const OLD_SAVE_KEY = 'sdt-save-v1';
// 坏档备份键：读档解析失败时原串转存于此，避免被下一次 write 无声覆盖
const CORRUPT_KEY = index => `sdt-run-${index}-corrupt`;
// 对局存档 schema 版本：破坏性变更时 +1 并在 MIGRATIONS 补上一级纯函数迁移
const SAVE_VERSION = 1;
const MIGRATIONS = {
  // 0→1：首个显式版本。无 version 的旧档字段形状已由 migrateRunCharacter 兜底，盖章即可。
  // 示例：1→2 时追加 MIGRATIONS[1] = d => ({ ...d, 新字段: 默认值 })。
};
// 读档异常原因（index -> 'corrupt' | 'tooNew'），供 UI 查询展示
const issues = {};

// 2026-09-07 留言：点「开始探索」会卡一下 = openSlotPicker 同步 readSlot×5 + Base.peek×5
// 全量 JSON.parse。对局存档大（ownedCards/eventLog），这里缓存解析结果。
// 缓存值带原始串指纹：localStorage 被绕过 write 直写（旧版代码/另一标签页/测试）
// 后指纹失配自动重解析，不会读到脏缓存；省的是昂贵的 parse+迁移，getItem 照常执行。
const readCache = new Map();

const RunStorage = Object.freeze({
  key: RUN_KEY,
  corruptKey: CORRUPT_KEY,
  SAVE_VERSION,
  has(index) {
    try { return !!localStorage.getItem(RUN_KEY(index)); } catch { return false; }
  },
  read(index) {
    let raw = null;
    try { raw = localStorage.getItem(RUN_KEY(index)); } catch { return null; }
    if (raw == null) { readCache.delete(index); return null; }
    const hit = readCache.get(index);
    if (hit && hit.raw === raw) return hit.data;
    let data;
    try { data = JSON.parse(raw); } catch { return this._corrupt(index, raw); }
    if (!data || typeof data !== 'object') return this._corrupt(index, raw);
    const v = +data.version || 0;
    if (v > SAVE_VERSION) {
      // 存档本身完好，只是来自更新的游戏版本：原样保留不碰，拒绝读取
      issues[index] = 'tooNew';
      console.warn(`[save] 档位 ${index} 存档版本(${v})新于当前游戏(${SAVE_VERSION})，拒绝读取`);
      return null;
    }
    let mv = v;
    while (mv < SAVE_VERSION) {
      const m = MIGRATIONS[mv];
      if (m) data = m(data);
      mv++;
      data.version = mv;
    }
    data = migrateRunCharacter(data);
    readCache.set(index, { raw, data });
    return data;
  },
  // 坏档处理：原串备份到 corrupt 键后返回 null（原键不动，由玩家决定是否覆盖重开）
  _corrupt(index, raw) {
    issues[index] = 'corrupt';
    try { localStorage.setItem(CORRUPT_KEY(index), raw); } catch { /* 存储不可用 */ }
    console.warn(`[save] 档位 ${index} 存档损坏，原串已备份到 ${CORRUPT_KEY(index)}`);
    return null;
  },
  // 读档异常原因：null=正常；'corrupt'=坏档已备份；'tooNew'=版本过新已拒读
  issue(index) { return issues[index] || null; },
  write(index, value) {
    try {
      localStorage.setItem(RUN_KEY(index), JSON.stringify({ ...value, version: SAVE_VERSION }));
      readCache.delete(index);
      delete issues[index];
      try { localStorage.removeItem(CORRUPT_KEY(index)); } catch { /* 无关紧要 */ }
      return true;
    } catch { return false; }
  },
  remove(index) {
    try {
      localStorage.removeItem(RUN_KEY(index));
      localStorage.removeItem(CORRUPT_KEY(index));
    } catch { /* 存储不可用 */ }
    readCache.delete(index);
    delete issues[index];
  },
  migrateLegacy() {
    try {
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old && !localStorage.getItem(RUN_KEY(1))) localStorage.setItem(RUN_KEY(1), old);
      localStorage.removeItem(OLD_SAVE_KEY);
      readCache.clear();
    } catch { /* 存储不可用 */ }
  },
});

export { OLD_SAVE_KEY, RUN_KEY, RunStorage, SAVE_VERSION, SLOT_COUNT };
