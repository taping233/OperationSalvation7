import { migrateRunCharacter } from '../core/characters.js';
import { createVersionedSlotReader } from './versioned-slot-reader.js';
const SLOT_COUNT = 5;
const RUN_KEY = index => `sdt-save-v2-slot${index}`;
const OLD_SAVE_KEY = 'sdt-save-v1';
// 坏档备份键：读档解析失败时原串转存于此，避免被下一次 write 无声覆盖
const CORRUPT_KEY = index => `sdt-run-${index}-corrupt`;
// 上一版好档备份键：write 覆盖主档前尽力转存原串（写基线只防并发不防逻辑坏档，
// 序列化成功但内容错时唯一好档会直接丢失）。尽力而为，备份失败绝不阻断主写。
// U17 读侧（2026-09-30 老板拍板）：主档读取失败时经 prev 回退自愈，见 readRun。
const PREV_KEY = index => `sdt-run-${index}-prev`;
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
// 读档异常原因存于 reader（index -> 'corrupt' | 'tooNew' | 'readFailed'），供 UI 查询展示
const writeIssues = new Map();
const loadIssueMessages = new Map();
// readIdentity 的原串→结果 memo（审计 B-1）：同 raw 直出，省重复 JSON.parse。
const identityMemo = new Map();

// 2026-09-07 留言：点「开始探索」会卡一下 = openSlotPicker 同步 readSlot×5 + Base.peek×5
// 全量 JSON.parse。对局存档大（ownedCards/eventLog），指纹缓存在 reader 内统一维护：
// 原始串被绕过 write 直写（旧版代码/另一标签页/测试）后指纹失配自动重解析，不会读到
// 脏缓存；省的是昂贵的 parse+迁移，getItem 照常执行。
const writeBaseline = new Map();
// 装载会修改卡实例与地图节点；缓存必须保留原串对应的迁移结果。
const publicRun = data => { const value = structuredClone(data); delete value._r2; return value; };
const loadCandidates = new WeakMap();
const loadFailure = (code, message) => ({ ok: false, code, message, preserveRun: true });

// 版本化读取管线唯一实现在 versioned-slot-reader.js；这里只注入对局档语义：
// E5 严格版本口径、拒数组顶层、迁移后 migrateRunCharacter 兜底、出口克隆隐藏 _r2。
const reader = createVersionedSlotReader({
  logTag: '[save]',
  maxVersion: SAVE_VERSION,
  migrations: MIGRATIONS,
  corruptKeyFor: CORRUPT_KEY,
  versionOf: (d) => {
    const v = Object.hasOwn(d, 'version') ? d.version : 0;
    return Number.isInteger(v) && v >= 0 ? v : NaN;
  },
  rejectArrays: true,
  postMigrate: migrateRunCharacter,
  toPublic: publicRun,
});

function readRaw(index, raw) {
  return readRun(index, raw).run;
}

// U17 读档失败自动回退（2026-09-30 老板拍板）：主键解析/形状失败（issue=corrupt）
// 时读 prev 备份，用与主键完全相同的校验链（parse→形状→版本门→迁移）校验；有效则把
// prev 原串逐字节写回主档自愈——不经 write()：不涨 revision、不重盖章，_r2 身份原样
// 保真——并经既有诊断通道（console.warn '[save]'）记一条。返回生效原串（自愈后即
// prev 原串，供预检候选记账），未回退返回 null。
// tooNew（档来自更新版本程序）不回退（R11 复审口径）：自愈会把过新档零备份永久覆盖，
// 与「过新拒读、原档保留」契约冲突——维持既有失败路径，等玩家回新版程序读取。
// 正常读档路径（主键有效）在首个 return 即出，不触碰 prev、零额外开销；
// 事务待恢复（txPending）时不插手，回退只发生在普通读档失败场景（恢复流程见 recovery.commands.js）。
function readRun(index, raw) {
  loadIssueMessages.delete(index);
  const run = reader.parse(index, raw);
  if (run) return { run, raw };   // 命中/成功：issue 由 parse 清除，行为与基线逐字一致
  if (raw == null) return { run: null, raw };
  if (txPending(index)) return { run: null, raw };
  const issueBefore = reader.issue(index);
  if (issueBefore === 'tooNew') return { run: null, raw };
  // 无法保留主档坏原串时不自愈覆盖；prev 仍保留，恢复存储后可重试。
  if (issueBefore === 'corrupt' && !reader.didBackUpCorrupt(index, raw)) {
    const message = '损坏原串未能备份，原档和已有备份未被覆盖；请检查存储状态后重试进入';
    loadIssueMessages.set(index, message);
    console.warn(`[save] 档位 ${index} ${message}，本次未自愈覆盖主档`);
    return { run: null, raw };
  }
  let prevRaw;
  try { prevRaw = localStorage.getItem(PREV_KEY(index)); } catch { return { run: null, raw }; }
  if (prevRaw == null || prevRaw === raw) return { run: null, raw };
  const prevRun = reader.parse(index, prevRaw, { backupCorrupt: false });
  if (!prevRun) {
    // prev 也无效：清 prev 校验残留，还原主键失败口径（corrupt/tooNew 不被 prev 污染），维持既有失败路径
    reader.invalidate(index);
    if (issueBefore) reader.markIssue(index, issueBefore);
    return { run: null, raw };
  }
  try { localStorage.setItem(RUN_KEY(index), prevRaw); }
  catch {
    reader.invalidate(index);
    if (issueBefore) reader.markIssue(index, issueBefore);
    return { run: null, raw };
  }   // 自愈写失败（配额等）：不假称已回退，仍报告主档异常
  // 自愈只修复持久原串；读者/预检不授予旧运行态写权，完整装载由 acceptLoad 采纳。
  console.warn(`[save] 档位 ${index} 主档读取失败，已回退到上一版存档（坏档原串保留于 corrupt 键）`);
  return { run: reader.parse(index, prevRaw), raw: prevRaw };
}

const RunStorage = Object.freeze({
  key: RUN_KEY,
  corruptKey: CORRUPT_KEY,
  SAVE_VERSION,
  has(index) {
    try { return !!localStorage.getItem(RUN_KEY(index)); } catch { return false; }
  },
  read(index) {
    loadIssueMessages.delete(index);
    let raw;   // 不做冗余初始化：try 内必赋值，catch 直接 return（下方 == null 判断兼容 undefined）
    try { raw = localStorage.getItem(RUN_KEY(index)); } catch { return null; }
    return readRaw(index, raw);
  },
  // 菜单/装载共用预检读取；只记录候选原串，不授予旧运行态覆盖权限。
  readForPreflight(index) {
    loadIssueMessages.delete(index);
    let raw;
    try { raw = localStorage.getItem(RUN_KEY(index)); }
    catch { reader.markIssue(index, 'readFailed'); return null; }
    const found = readRun(index, raw);
    // U17 回退自愈后主档已被换成 prev 原串：候选必须按生效原串记账，acceptLoad 才能对上
    if (found.run) loadCandidates.set(found.run, { index, raw: found.raw });
    return found.run;
  },
  // 全预检成功后，loadGame 在任何运行态副作用前采纳同一对象对应的原串。
  acceptLoad(index, run) {
    const candidate = loadCandidates.get(run);
    if (!candidate || candidate.index !== index) return loadFailure('STALE_SLOT', '档位已更新，请重新载入');
    let raw;
    try { raw = localStorage.getItem(RUN_KEY(index)); }
    catch { return loadFailure('STORAGE_READ_FAILED', '无法读取档位，请重试'); }
    if (raw !== candidate.raw) return loadFailure('STALE_SLOT', '档位已更新，请重新载入');
    writeBaseline.set(index, raw);
    writeIssues.delete(index);
    return { ok: true };
  },
  // 兼容既有显式读取调用（含空档基线）；生产恢复走预检/采纳两步。
  readForLoad(index) {
    const run = this.read(index);   // 先完成可能的 prev 自愈，再采纳显式装载的生效原串。
    try { writeBaseline.set(index, localStorage.getItem(RUN_KEY(index))); }
    catch { writeBaseline.delete(index); }
    writeIssues.delete(index);
    return run;
  },
  loadIssueMessage(index) { return loadIssueMessages.get(index) || null; },
  lastWriteIssue(index) { return writeIssues.get(index) || null; },
  // 坏档处理：原串备份到 corrupt 键后返回 null（原键不动，由玩家决定是否覆盖重开）
  _corrupt(index, raw) { return reader.markCorrupt(index, raw); },
  // 读档异常原因：null=正常；'corrupt'=坏档原键保留（备份尽力）；'tooNew'=版本过新已拒读
  issue(index) { return reader.issue(index); },
  // R6 只读身份窄口：不迁移、不写回、不为旧档创建 runId。
  // 领域模块用它关联同一探索中的永久提交；私有 _r2 不进入 publicRun。
  // identity memo（10-02 审计 B-1）：结算链一次胜利最多重复 parse 13 次大 payload 只为取 _r2；
  // 以原串为键缓存 identity 结果——同 raw 必然同 identity，语义零变化，写侧天然失效（raw 变即 miss）。
  readIdentity(index) {
    if (!Number.isInteger(index) || index < 1 || index > SLOT_COUNT) return Object.freeze({ ok: false, code: 'INVALID_ARGUMENT', message: '档位必须是 1～5' });
    if (txPending(index)) return Object.freeze({ ok: false, code: 'RECOVERY_REQUIRED', message: '该档位存在待恢复事务' });
    const raw = localStorage.getItem(RUN_KEY(index));
    const memoHit = identityMemo.get(index);
    if (raw != null && memoHit && memoHit.raw === raw) return memoHit.result;
    let data;
    try { data = JSON.parse(raw || 'null'); }
    catch { return Object.freeze({ ok: false, code: 'RUN_UNREADABLE', message: '对局存档无法读取' }); }
    if (!data || typeof data !== 'object' || !Number.isInteger(data.version) || data.version < 1 || data.version > SAVE_VERSION) {
      return Object.freeze({ ok: false, code: 'INVALID_STATE', message: '对局存档版本或结构无效' });
    }
    const identity = data._r2;
    if (!identity || typeof identity.runId !== 'string' || !identity.runId.trim() ||
        !Number.isInteger(identity.revision) || identity.revision < 0) {
      return Object.freeze({ ok: false, code: 'INVALID_STATE', message: '对局缺少稳定探索身份' });
    }
    const result = Object.freeze({ ok: true, value: Object.freeze({ runId: identity.runId, revision: identity.revision }) });
    if (raw != null) identityMemo.set(index, { raw, result });
    return result;
  },
  write(index, value) {
    if (txPending(index)) { writeIssues.set(index, 'RECOVERY_REQUIRED'); return false; }
    try {
      const hasBaseline = writeBaseline.has(index);
      const expectedRaw = writeBaseline.get(index);
      const currentRaw = localStorage.getItem(RUN_KEY(index));
      // currentRaw 只解析一次（09-30 性能审计 F5：此前无基线分支与身份读取各 parse 一遍，
      // 每次存档都白付一份大 payload 的 JSON.parse）
      let currentIdentity = null;
      if (currentRaw) {
        try { currentIdentity = JSON.parse(currentRaw)?._r2 || null; } catch { /* 损坏档保留既有显式恢复路径 */ }
      }
      if (hasBaseline && currentRaw !== expectedRaw) { writeIssues.set(index, 'STALE_SLOT'); return false; }
      if (!hasBaseline && currentRaw !== null) {
        // 新开档从列表页进入时可能没有读档基线；若现代对局已存在，
        // 不允许无基线写入把它覆盖。无身份旧档仍可由恢复流程升级。
        if (currentIdentity) { writeIssues.set(index, 'STALE_SLOT'); return false; }
      }
      const identity = currentIdentity || value?._r2 || { runId: newRunId(index), revision: -1 };
      const nextIdentity = { runId: identity.runId, revision: Math.max(-1, Number(identity.revision) || 0) + 1 };
      const nextRaw = JSON.stringify({ ...value, _r2: nextIdentity, version: SAVE_VERSION });
      // 覆盖前把当前好档原串转存 prev 键（尽力而为：失败不影响本次主写）
      if (currentRaw) { try { localStorage.setItem(PREV_KEY(index), currentRaw); } catch { /* 尽力而为 */ } }
      // 空主键表示新对局：旧终局/中断清理留下的 prev 不得成为新局的回退来源。
      else localStorage.removeItem(PREV_KEY(index));
      localStorage.setItem(RUN_KEY(index), nextRaw);
      writeBaseline.set(index, nextRaw);
      writeIssues.delete(index);
      reader.invalidate(index);
      try { localStorage.removeItem(CORRUPT_KEY(index)); } catch { /* 无关紧要 */ }
      return true;
    } catch { writeIssues.set(index, 'STORAGE'); return false; }
  },
  remove(index) {
    if (txPending(index)) return false;
    try {
      localStorage.removeItem(RUN_KEY(index));
      localStorage.removeItem(CORRUPT_KEY(index));
      try { localStorage.removeItem(PREV_KEY(index)); } catch { /* 尽力而为，不悬挂 */ }
    } catch { writeIssues.set(index, 'STORAGE'); return false; }
    reader.invalidate(index);
    writeBaseline.delete(index);
    writeIssues.delete(index);
    return true;
  },
  _invalidate(index) {
    reader.invalidate(index);
    writeIssues.delete(index);
    // 仅事务恢复会调用此入口；恢复已按事务 revision 校验并提交，
    // 因而本标签可将后续写入基线推进到事务后的持久状态。
    let raw;
    try { raw = localStorage.getItem(RUN_KEY(index)); writeBaseline.set(index, raw); }
    catch { writeBaseline.delete(index); return; }
    // 终局两键提交绕过 remove() 删除主档；同步释放它的旧局备份。
    try {
      const previous = localStorage.getItem(PREV_KEY(index));
      const currentId = raw === null ? null : JSON.parse(raw)?._r2?.runId;
      const previousId = previous === null ? null : JSON.parse(previous)?._r2?.runId;
      // A recovered departure starts a new identity; never fall back into the preceding exploration.
      if (raw === null || (currentId && previousId !== currentId)) localStorage.removeItem(PREV_KEY(index));
    } catch { /* 备份清理尽力而为，保留已确认的主档写基线 */ }
  },
  migrateLegacy() {
    try {
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old && txPending(1)) return false;
      if (old && !localStorage.getItem(RUN_KEY(1))) localStorage.setItem(RUN_KEY(1), old);
      localStorage.removeItem(OLD_SAVE_KEY);
      reader.invalidateAll();
      return true;
    } catch { return false; }
  },
});

export { RUN_KEY, RunStorage, SAVE_VERSION, SLOT_COUNT, TX_KEY, txPending };
