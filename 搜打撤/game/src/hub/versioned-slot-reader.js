/* ============================================================
 * versioned-slot-reader.js —— 版本化档位读取管线（唯一权威实现）
 *
 * 2026-09-28 代码线收敛：hub/base.js（基地档）与 hub/game.storage.js（对局档）
 * 各自维护的 ~40 行孪生读取管线（指纹缓存 / 版本门 / 逐版迁移 / 坏档备份）合一。
 * 管线骨架只有这一份；域间**有意的语义差异**以参数注入保留，本次收敛不改变
 * 任一侧的读取行为（除已知的 base 侧粘滞 issue 缺陷按 run 侧语义修复，见下）：
 *   - versionOf：run 侧 E5 严格口径（非负整数，否则坏档）；base 侧历史宽松口径
 *     （+version||0，非数值沿用旧档；转换后仍须为非负整数）。
 *   - rejectArrays：run 侧拒数组顶层；base 侧历史放行。
 *   - postMigrate / toPublic：run 侧 migrateRunCharacter + publicRun 克隆出口；
 *     base 侧克隆出口后 adopt 再加工，持久快照不与运行态共享嵌套引用。
 * 迁移表每域一张：纯函数、fromVersion 递增盖章（同 save-systems 版本化加载契约，
 * 与 docs/save-format.md「过新拒读 / 原档保留」条款一致）。
 * ============================================================ */

export function createVersionedSlotReader({
  logTag,             // 告警前缀：'[base]' / '[save]'
  maxVersion,         // 当前 schema 版本（BASE_VERSION / SAVE_VERSION）
  migrations,         // { [fromVersion]: (data) => data } 纯函数迁移表
  corruptKeyFor,      // (index) => 坏档备份键
  versionOf,          // (data) => 非负有限整数版本；其他结果视为版本形状损坏
  rejectArrays,       // 顶层是否拒绝数组
  postMigrate = null, // 迁移后的域内兜底（run: migrateRunCharacter；base 无）
  toPublic = null,    // 出口变换（run/base: 隔离克隆；默认直返供独立消费者选择）
  backupRaw = null,   // Base injects its asynchronous, slot-locked corrupt-backup writer.
}) {
  const cache = new Map();                 // index -> { raw, value }
  const corruptBackups = new Map();        // index -> { raw, backedUp }; 仅本次坏档备份结果
  const issues = Object.create(null);      // index -> 'corrupt' | 'tooNew' | ...

  // 迁移链完整性装载校验（守卫 2026-09-29 U4）：1..maxVersion-1 任一档缺函数即在装配期显式
  // 炸出（STS2 MigrationPathGapException 思想：迁移表完整性是硬约束）。否则未来 maxVersion+1
  // 而忘补迁移函数时，旧档会在下方迁移循环沿缺口被静默跳级盖章（损档无告警）。
  // 0 号键不在校验范围：两侧迁移表按约定不设 0 号键——v0 = 未显式版本老档，0→1 仅盖章
  // （见 game.storage.js / base.js 各自 MIGRATIONS 注释）。
  for (let v = 1; v < maxVersion; v++) {
    if (typeof migrations[v] !== 'function') {
      throw new Error(`${logTag} 迁移表断链：缺少 ${v}→${v + 1} 迁移函数（maxVersion=${maxVersion}），拒绝装载，须补齐 migrations 后启动`);
    }
  }

  function clearIssue(index) { delete issues[index]; }
  function markIssue(index, kind) { issues[index] = kind; }
  function issue(index) { return issues[index] || null; }

  // 坏档处理：原串备份到 corrupt 键后返回 null（原键不动，玩家决定是否覆盖重开）。
  // 备份失败时如实告警，不声称已备份。
  function markCorrupt(index, raw, { backupCorrupt = true } = {}) {
    issues[index] = 'corrupt';
    if (!backupCorrupt) {
      console.warn(`${logTag} 档位 ${index} 存档候选数据损坏，未写入损坏备份`);
      return null;
    }
    let backedUp = false;
    try {
      if (backupRaw) {
        const result = backupRaw(index, raw);
        if (result && typeof result.then === 'function') {
          corruptBackups.set(index, { raw, backedUp: false });
          result.then(ok => {
            if (corruptBackups.get(index)?.raw === raw) corruptBackups.set(index, { raw, backedUp: ok === true });
            if (ok !== true) console.warn(`${logTag} 档位 ${index} 备份失败，原档已保留`);
          }).catch(() => {});
          console.warn(`${logTag} 档位 ${index} 存档数据损坏，原档已保留，备份等待存档锁`);
          return null;
        }
        backedUp = result === true;
      } else { localStorage.setItem(corruptKeyFor(index), raw); backedUp = true; }
    } catch { /* 原键保留 */ }
    corruptBackups.set(index, { raw, backedUp });
    console.warn(`${logTag} 档位 ${index} 存档数据损坏，${backedUp ? `原串已备份到 ${corruptKeyFor(index)}` : '备份失败，原档已保留'}`);
    return null;
  }

  // 读取管线：指纹缓存命中直出；解析→形状→版本门→逐版迁移→域内兜底→入缓存。
  // 命中与成功路径都清除旧 issue（run 侧语义）：当前原串可读即不存在读档异常，
  // 修复 base 侧「issue 粘滞、外部修复坏档后仍阻塞 save」的缺陷。
  // 仅备档候选验证可禁用损坏备份；默认读取保留既有备份行为。
  function parse(index, raw, options = {}) {
    if (raw == null) { cache.delete(index); clearIssue(index); return null; }
    const hit = cache.get(index);
    if (hit && hit.raw === raw) { clearIssue(index); return toPublic ? toPublic(hit.value) : hit.value; }
    cache.delete(index);
    let data;
    try { data = JSON.parse(raw); }
    catch { return markCorrupt(index, raw, options); }
    if (!data || typeof data !== 'object' || (rejectArrays && Array.isArray(data))) return markCorrupt(index, raw, options);
    const v = versionOf(data);
    if (!Number.isInteger(v) || v < 0) return markCorrupt(index, raw, options);
    if (v > maxVersion) {
      issues[index] = 'tooNew';
      console.warn(`${logTag} 档位 ${index} 存档版本(${v})新于当前游戏(${maxVersion})，拒绝读取`);
      return null;
    }
    let mv = v;
    while (mv < maxVersion) {
      // 缺函数只可能发生在 mv=0（v0 老档盖章步）：1..maxVersion-1
      // 的键位完整性已由上方装载校验兜死，此处不会静默跳级。
      const m = migrations[mv];
      if (m) data = m(data);
      mv++;
      data.version = mv;
    }
    if (postMigrate) data = postMigrate(data);
    cache.set(index, { raw, value: data });
    clearIssue(index);
    return toPublic ? toPublic(data) : data;
  }

  // 写穿透：写入方已持有最新原串与规范化对象时直接入缓存，省一次重解析。
  function poke(index, raw, value) { cache.set(index, { raw, value }); }
  function invalidate(index) { cache.delete(index); corruptBackups.delete(index); clearIssue(index); }
  function invalidateAll() { cache.clear(); corruptBackups.clear(); }
  function didBackUpCorrupt(index, raw) {
    const result = corruptBackups.get(index);
    return result?.raw === raw && result?.backedUp === true;
  }

  return { parse, issue, markIssue, clearIssue, markCorrupt, didBackUpCorrupt, poke, invalidate, invalidateAll };
}
