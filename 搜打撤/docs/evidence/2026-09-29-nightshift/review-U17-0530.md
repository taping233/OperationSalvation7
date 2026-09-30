# review-U17-0530 —— R11 第三方独立复审（读档失败回退 prev 自愈）

- 时间：2026-09-30 09:40 班次（R11，只读复审，唯一写入本单）
- 对象：`game/src/hub/game.storage.js`（+36/-4）+ `tests/save-prev-fallback.test.js`（7 例），对照 `docs/evidence/2026-09-29-nightshift/fix-U17-0500.md`
- 实况：HEAD ba5b40d；工作树 U16/U17/U18 三面并行，本面改动仅 `game.storage.js`（git status 证实 `versioned-slot-reader.js` 未改，修复单「共享管线零触碰」属实）

## 逐条复审

### 1. 回退链正确性（核心）——通过，但发现 F1 数据安全边界

触发条件原文（game.storage.js L75-82）：

```js
function readRun(index, raw) {
  const run = reader.parse(index, raw);
  if (run) return { run, raw };   // 命中/成功：issue 由 parse 清除，行为与基线逐字一致
  if (raw == null) return { run: null, raw };
  if (txPending(index)) return { run: null, raw };
```

- 触发面核实：仅 `parse` 失败且 raw 非 null 且非 txPending。逐 code 对照 versioned-slot-reader.js `parse`：JSON.parse 失败/形状坏/数组顶层/版本形状 NaN → `markCorrupt`（issue='corrupt'）→ 触发；`v > maxVersion`（issue='tooNew'，L69-73 **不走 markCorrupt**）→ 同样触发；`raw == null`（空档）与 `readFailed`（getItem 抛异常，在 read/readForPreflight 外层已 return）均不进回退。隔离精确。
- txPending 隔离核实：L79 在任何 prev 触碰之前；`readIdentity` L148 既有 RECOVERY_REQUIRED 闸门不动；recovery.commands.js 全程 `storage.getItem`+`parseVersioned`（rg 核实 L8/L86/L99/L123-126），无 readRun 交叉。测试④覆盖「清除事务日志后恢复回退语义」。
- **F1（数据安全，建议登记 PENDING）：tooNew 回退会在无任何备份的情况下用 prev 原串覆盖过新主档。** 推演：① 玩家在新版构建（SAVE_VERSION=3）写档——write L182 覆盖前把旧 v2 原串转存 prev，主档=v3；② 回到旧构建（SAVE_VERSION=2，同 localStorage origin）读档；③ parse(v3) → tooNew，**corrupt 键无备份**（tooNew 不走 markCorrupt）；④ prev=v2 有效 → L91 `localStorage.setItem(RUN_KEY(index), prevRaw)` → **v3 原串从存储永久消失，零备份**。且 L94 告警文案「坏档原串保留于 corrupt 键」在该场景不实，与 versioned-slot-reader.js L14 引用的 docs/save-format.md「过新拒读 / **原档保留**」契约冲突（corrupt 场景因 markCorrupt 先行而满足，tooNew 场景不满足）。概率低（需版本回滚且 prev 在场）但属数据丢失类。建议修法：自愈 setItem 前，若主档原串未经 markCorrupt 留证（issueBefore !== 'corrupt'）先尽力转存 corrupt 键，或 tooNew 不自动回退。实施者按任务书「corrupt/tooNew 均触发」执行无误，属任务书口径缺口而非实现走样。

### 2. 自愈写回安全性——通过

原文 L91-95：

```js
try { localStorage.setItem(RUN_KEY(index), prevRaw); }
catch { reader.invalidate(index); return { run: null, raw }; }
writeBaseline.set(index, prevRaw);
console.warn(`[save] 档位 ${index} 主档读取失败，已回退到上一版存档（坏档原串保留于 corrupt 键）`);
return { run: reader.parse(index, prevRaw), raw: prevRaw };
```

- 写基线同步：`writeBaseline.set(index, prevRaw)` 与新主档逐字节一致 → 下次 write `currentRaw === expectedRaw`，无 STALE_SLOT 误判（测试①末三行「随后 write 直接成功」机械证明；测试⑤ acceptLoad→write 贯通复证）。`readForPreflight` L116-117 改记生效原串是必要配套，否则 acceptLoad L127 `raw !== candidate.raw` 必误报。
- reader 缓存同步：`parse(prevRaw)`（L84）已将 {prevRaw→值} 入缓存，末行再 parse 命中缓存，缓存 raw 与新主档内容一致；采纳路径 issue 被 parse 成功清除（测试① `issue(1)` 为 null）。内存状态与新主档一致，核实成立。
- 绕过 write() 的动机核实成立：write L178-180 会换/涨 _r2 身份并重盖 version，prev 原串直写保真 runId/revision。

### 3. prev 生命周期——通过（保留是正确选择）

回退采纳后 prev 键保留（代码无清除）。推演：采纳后主档==prev 逐字节相同；下次 write L182 覆盖前把 currentRaw（=旧 prev）再转存 prev 后才写新主档 → prev 恒为「上一版好档」不变式成立；若此后主档再坏，回退目标仍是最近好档，非同一失败串循环（采纳后主档即 prev，读档立成功，无死循环）。`remove` L196 清 prev、write 成功清 corrupt（L187）既有语义未动。

### 4. 正常路径零开销——通过

原文 L76-77：`const run = reader.parse(index, raw); if (run) return { run, raw };` 成功路径与基线同样只做一次 parse+缓存查找，随后立即 return，不触碰 prev。测试③以 `Storage.prototype.getItem` 间谍断言 prev 键读取次数 0，真实生效。

### 5. CORRUPT_KEY 既有机制与新回退分工——通过，附轻微观察 F2

markCorrupt 在 parse 内部先于回退发生：回退采纳后坏串仍留 corrupt 键（测试① L34 断言 `'{broken json'` 在键）；prev 无效时 L86-88 `invalidate`+`markIssue(issueBefore)` 还原主键失败口径，不被 prev 的 tooNew 污染（测试②b）。分工清晰。轻微观察 F2：
- **F2a**：自愈 setItem 失败分支（L92）只 `invalidate` 未还原 issueBefore → issue() 由 tooNew/corrupt 变 null，game.session.js L249-250 的 UI 口径退化为通用 RUN_UNREADABLE（对比 prev-无效分支有还原）。纯展示口径，主键未动，无数据影响。
- **F2b**：主/prev 双解析坏时，parse(prevRaw) 内部 markCorrupt 会把 corrupt 键从主档原串改写为 prev 原串；因主键未动，坏主档原串仍在主键，无真损失，仅取证键内容混替（测试②未断言 corrupt 键内容，故未暴露）。

### 6. 亲跑验证——通过

- `npx vitest run tests/save-prev-fallback.test.js`：7/7 绿（9ms）。
- `rg -l "game.storage|versioned-slot|save-compat|recovery" tests/` = 30 文件，与修复单口径一致；`npx vitest run`（30 文件）= **295 passed，EXIT=0，grep Unhandled = 0**（2026-09-30 09:40 亲跑）。

### 7. make-work 检查——通过

改动是真实功能（读侧消费 prev、自愈写回、候选记账修正），7 例均为行为断言（逐字节自愈、身份保真、间谍计数、txPending 隔离、装载链贯通、readIdentity 契约），非凑数用例；diff 规模与修复单相符；未触 css×2/package.json/lock/cards-sync.json（lock 为他人未提交改动，原样未动）。

## 结论

核心回退链、自愈一致性、零开销声明、测试全绿均验证成立；F1 为 tooNew 场景数据丢失边界（低概率、任务书口径缺口），F2a/F2b 为轻微观察，均不阻塞本单元。

建议：F1 由下一班登记 `docs/PENDING.md`（修法二选一：自愈前补 corrupt 留证 / tooNew 不自动回退）。

verdict: PASS-WITH-RESERVATIONS（通过，有保留——F1 tooNew 自愈无备份覆盖过新主档须登记跟进）
