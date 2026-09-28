/* ============================================================
 * versioned-slot-reader.js —— 版本化档位读取管线（唯一权威实现）
 *
 * 2026-09-28 代码线收敛：hub/base.js（基地档）与 hub/game.storage.js（对局档）
 * 各自维护的 ~40 行孪生读取管线（指纹缓存 / 版本门 / 逐版迁移 / 坏档备份）合一。
 * 管线骨架只有这一份；域间**有意的语义差异**以参数注入保留，本次收敛不改变
 * 任一侧的读取行为（除已知的 base 侧粘滞 issue 缺陷按 run 侧语义修复，见下）：
 *   - versionOf：run 侧 E5 严格口径（非负整数，否则坏档）；base 侧历史宽松口径
 *     （+version||0，永不因版本形状判坏）。
 *   - rejectArrays：run 侧拒数组顶层；base 侧历史放行。
 *   - postMigrate / toPublic：run 侧 migrateRunCharacter + publicRun 克隆出口；
 *     base 侧直返（调用方 adopt 再加工，缓存对象允许被就地规范化）。
 * 迁移表每域一张：纯函数、fromVersion 递增盖章（同 save-systems 版本化加载契约，
 * 与 docs/save-format.md「过新拒读 / 原档保留」条款一致）。
 * ============================================================ */

export function createVersionedSlotReader({
  logTag,             // 告警前缀：'[base]' / '[save]'
  maxVersion,         // 当前 schema 版本（BASE_VERSION / SAVE_VERSION）
  migrations,         // { [fromVersion]: (data) => data } 纯函数迁移表
  corruptKeyFor,      // (index) => 坏档备份键
  versionOf,          // (data) => 整数版本；返回 NaN 视为版本形状损坏
  rejectArrays,       // 顶层是否拒绝数组
  postMigrate = null, // 迁移后的域内兜底（run: migrateRunCharacter；base 无）
  toPublic = null,    // 出口变换（run: publicRun 克隆；base 直返同一引用）
}) {
  const cache = new Map();                 // index -> { raw, value }
  const issues = Object.create(null);      // index -> 'corrupt' | 'tooNew' | ...

  function clearIssue(index) { delete issues[index]; }
  function markIssue(index, kind) { issues[index] = kind; }
  function issue(index) { return issues[index] || null; }

  // 坏档处理：原串备份到 corrupt 键后返回 null（原键不动，玩家决定是否覆盖重开）。
  // 备份失败时如实告警，不声称已备份。
  function markCorrupt(index, raw) {
    issues[index] = 'corrupt';
    let backedUp = false;
    try { localStorage.setItem(corruptKeyFor(index), raw); backedUp = true; } catch { /* 原键保留 */ }
    console.warn(`${logTag} 档位 ${index} 存档数据损坏，${backedUp ? `原串已备份到 ${corruptKeyFor(index)}` : '备份失败，原档已保留'}`);
    return null;
  }

  // 读取管线：指纹缓存命中直出；解析→形状→版本门→逐版迁移→域内兜底→入缓存。
  // 命中与成功路径都清除旧 issue（run 侧语义）：当前原串可读即不存在读档异常，
  // 修复 base 侧「issue 粘滞、外部修复坏档后仍阻塞 save」的缺陷。
  function parse(index, raw) {
    if (raw == null) { cache.delete(index); clearIssue(index); return null; }
    const hit = cache.get(index);
    if (hit && hit.raw === raw) { clearIssue(index); return toPublic ? toPublic(hit.value) : hit.value; }
    cache.delete(index);
    let data;
    try { data = JSON.parse(raw); }
    catch { return markCorrupt(index, raw); }
    if (!data || typeof data !== 'object' || (rejectArrays && Array.isArray(data))) return markCorrupt(index, raw);
    const v = versionOf(data);
    if (Number.isNaN(v)) return markCorrupt(index, raw);
    if (v > maxVersion) {
      issues[index] = 'tooNew';
      console.warn(`${logTag} 档位 ${index} 存档版本(${v})新于当前游戏(${maxVersion})，拒绝读取`);
      return null;
    }
    let mv = v;
    while (mv < maxVersion) {
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
  function invalidate(index) { cache.delete(index); clearIssue(index); }
  function invalidateAll() { cache.clear(); }

  return { parse, issue, markIssue, clearIssue, markCorrupt, poke, invalidate, invalidateAll };
}
