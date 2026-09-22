import { migrateRunCharacter } from './characters.js';
const SLOT_COUNT = 5;
const RUN_KEY = index => `sdt-save-v2-slot${index}`;
const OLD_SAVE_KEY = 'sdt-save-v1';
// 坏档备份键：读档解析失败时原串转存于此，避免被下一次 write 无声覆盖
const CORRUPT_KEY = index => `sdt-run-${index}-corrupt`;
const TX_KEY = index => `sdt-tx-v1-slot${index}`;
const txPending = index => { try { return localStorage.getItem(TX_KEY(index)) !== null; } catch { return true; } };
let runIdNonce = 0;
const newRunId = index => `run-${index}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${(++runIdNonce).toString(36)}`}`;
// 对局存档 schema 版本：破坏性变更时 +1 并在 MIGRATIONS 补上一级纯函数迁移
const SAVE_VERSION = 2;
// 2026-09-19 老板令「彻底删除『杀』」：初始攻击内部 id builtin-sha → starter-attack。
// 深遍历而不是字段枚举：卡实例嵌在 ownedCards/cardBox/inventory/nestEquipped 及
// battle 序列化（牌库/手牌/检查点）多层结构里，按值改名对任意嵌套深度幂等成立。
const RENAME_CARD_IDS = { 'builtin-sha': 'starter-attack' };
const renameCardIds = (node) => {
  if (Array.isArray(node)) { node.forEach(renameCardIds); return; }
  if (node && typeof node === 'object') {
    if (typeof node.id === 'string' && RENAME_CARD_IDS[node.id]) node.id = RENAME_CARD_IDS[node.id];
    Object.values(node).forEach(renameCardIds);
  }
};
const MIGRATIONS = {
  // 0→1：首个显式版本。无 version 的旧档字段形状已由 migrateRunCharacter 兜底，盖章即可。
  // 示例：1→2 时追加 MIGRATIONS[1] = d => ({ ...d, 新字段: 默认值 })。
  // 1→2：「杀」id 统一改名（只动 id 值等于 builtin-sha 的节点，其它 id 值不受影响）。
  1: d => { renameCardIds(d); return d; },
};
// 读档异常原因（index -> 'corrupt' | 'tooNew'），供 UI 查询展示
const issues = {};

// 2026-09-07 留言：点「开始探索」会卡一下 = openSlotPicker 同步 readSlot×5 + Base.peek×5
// 全量 JSON.parse。对局存档大（ownedCards/eventLog），这里缓存解析结果。
// 缓存值带原始串指纹：localStorage 被绕过 write 直写（旧版代码/另一标签页/测试）
// 后指纹失配自动重解析，不会读到脏缓存；省的是昂贵的 parse+迁移，getItem 照常执行。
const readCache = new Map();
const publicRun = data => { const value = { ...data }; delete value._r2; return value; };

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
    if (hit && hit.raw === raw) return publicRun(hit.data);
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
    return publicRun(data);
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
  // R6 只读身份窄口：不迁移、不写回、不为旧档创建 runId。
  // 领域模块用它关联同一探索中的永久提交；私有 _r2 不进入 publicRun。
  readIdentity(index) {
    if (!Number.isInteger(index) || index < 1 || index > SLOT_COUNT) return Object.freeze({ ok: false, code: 'INVALID_ARGUMENT', message: '档位必须是 1～5' });
    if (txPending(index)) return Object.freeze({ ok: false, code: 'RECOVERY_REQUIRED', message: '该档位存在待恢复事务' });
    let data;
    try { data = JSON.parse(localStorage.getItem(RUN_KEY(index)) || 'null'); }
    catch { return Object.freeze({ ok: false, code: 'RUN_UNREADABLE', message: '对局存档无法读取' }); }
    if (!data || typeof data !== 'object' || !Number.isInteger(data.version) || data.version < 1 || data.version > SAVE_VERSION) {
      return Object.freeze({ ok: false, code: 'INVALID_STATE', message: '对局存档版本或结构无效' });
    }
    const identity = data._r2;
    if (!identity || typeof identity.runId !== 'string' || !identity.runId.trim() ||
        !Number.isInteger(identity.revision) || identity.revision < 0) {
      return Object.freeze({ ok: false, code: 'INVALID_STATE', message: '对局缺少稳定探索身份' });
    }
    return Object.freeze({ ok: true, value: Object.freeze({ runId: identity.runId, revision: identity.revision }) });
  },
  write(index, value) {
    if (txPending(index)) return false;
    try {
      let persistedIdentity = null;
      try { persistedIdentity = JSON.parse(localStorage.getItem(RUN_KEY(index)) || 'null')?._r2 || null; } catch { /* 读取失败走新身份 */ }
      const identity = persistedIdentity || value?._r2 || { runId: newRunId(index), revision: -1 };
      const nextIdentity = { runId: identity.runId, revision: Math.max(-1, Number(identity.revision) || 0) + 1 };
      localStorage.setItem(RUN_KEY(index), JSON.stringify({ ...value, _r2: nextIdentity, version: SAVE_VERSION }));
      readCache.delete(index);
      delete issues[index];
      try { localStorage.removeItem(CORRUPT_KEY(index)); } catch { /* 无关紧要 */ }
      return true;
    } catch { return false; }
  },
  remove(index) {
    if (txPending(index)) return false;
    try {
      localStorage.removeItem(RUN_KEY(index));
      localStorage.removeItem(CORRUPT_KEY(index));
    } catch { return false; }
    readCache.delete(index);
    delete issues[index];
    return true;
  },
  _invalidate(index) { readCache.delete(index); delete issues[index]; },
  migrateLegacy() {
    try {
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old && txPending(1)) return false;
      if (old && !localStorage.getItem(RUN_KEY(1))) localStorage.setItem(RUN_KEY(1), old);
      localStorage.removeItem(OLD_SAVE_KEY);
      readCache.clear();
      return true;
    } catch { return false; }
  },
});

export { OLD_SAVE_KEY, RUN_KEY, RunStorage, SAVE_VERSION, SLOT_COUNT };
