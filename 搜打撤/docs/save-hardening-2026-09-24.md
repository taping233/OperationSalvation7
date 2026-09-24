# 存档链路 P1 缺口加固（save-hardening 2026-09-24）

- 执行：Friday（子任务会话）
- 依据：`.tmp/audit-0924/save-compat.md` 发现 1（F1）与发现 2/3（F2/F3）及其修复任务书雏形
- HEAD 快照：开工时 `b156a22`，工作区含并行会话大量未提交改动（开工已核对：目标文件最近改动来自已收尾的 no-unused-vars 清理会话，见 `docs/lint-unused-cleanup-exec-2026-09-24.md`，与其不同行；编辑前均重读锚定）。未提交、未构建、未推送。

## 改动清单

### 任务一：基地档「JSON 合法但字段类型损坏」兜底（F1）

1. `game/src/hub/base.js` — `adopt()` 入口新增容器字段类型归一 `normalizeObjField`（+`isPlainObj` 助手）：
   - 覆盖 `stats / characters / classes / pets / home / appearance / goals / story / achClaimed` 共 9 个裸信字段（审计列出的缺口全集 + `appearance` 同类补齐）；损坏类型含 字符串/数字/null/数组，回落 `def()` 对应默认值并 `console.warn('[base] 存档字段 X 类型损坏（…），已回落默认值')` 留痕。
   - `undefined`（字段缺失）不算损坏，不告警，仍走 `mergeDef` 补齐——完好老档零噪音。
   - 口径对齐对局档读取的字段级默认值兜底（`game.session.js loadGame` 的 numOr/Array.isArray 先例）；未动既有 collection/stash/backs/_m01 等已有守卫与 122-126 行子字段守卫。
   - `migrateCharacterProgress`（characters.js）无需改动：adopt 归一后 `characters` 必为对象，meta.js `clsData` 的 `migrateCharacterProgress(B().data)` 调用点一并受益。
2. `game/src/ui/game.menu.js` — 渲染路径防整页卡死：
   - `pickLatestSlot()`：循环体对 `readSlot(i)` / `Base.peek(i)` 分别 try-catch，坏档按空档处理（标题页数据件共用此函数，一并受保护）。
   - `openSlotPicker()`：单档卡片构建包 try-catch，异常档渲染为「档案数据异常」降级卡（**无任何 data-act 入口**，不给破坏性按钮），其余档位正常渲染；页尾经既有 `#slotRestoreError`（role=alert）显示「档位 0N 存档数据异常，已保留原档未写回」+ console.warn。catch 内不写任何档。

### 任务二：卡牌库 `sdt-cards-v1` 坏档备份与并发防护（F2/F3）

全部改动在 `game/src/cards/cards.js`（存档/缓存模块），**未触碰 cards.sync.js 播种/retire 逻辑，未触碰 cards.consts.js 键定义**（备份键常量定义在 cards.js 本地，键名口径对齐 `sdt-base-N-corrupt`/`sdt-run-N-corrupt` → `sdt-cards-corrupt`）：

1. **F3 坏库备份 + 降级禁写**：
   - `all()` 解析失败时先把原串写入 `sdt-cards-corrupt`，再降级空库，并置 `_corruptNoWrite` 降级旗 + console.warn（含人工恢复命令提示，每次会话只警告一次）。
   - 同口径覆盖「JSON 合法但不是数组」（原为启动链 TypeError 黑屏，现改为备份+降级）。
   - 降级期间 `saveAll` 直接拒绝（返回 false）、`upsert` 跳过写入——即 **ensureStarters 等启动自动播种被禁止覆盖原库**（cards.sync.js 零改动：其写路径全部经 SDT.Cards.upsert/saveAll）。原键保留损坏原串，每次启动重复检测、备份幂等。
   - `clearAll()`（设置页「清空卡牌库」）复位降级旗 = 显式人工处置后恢复可写；corrupt 备份键保留供追查（与 base wipe 不清 corrupt 键同口径）。
   - 降级期间设计坊导入等用户显式写回同样被拒（warn 已给 devtools 恢复指引）——有意取舍：两种状态的人工恢复难度等同，但禁写保留现场、不掩盖事故。
2. **F2 写前并发校验**（任务书「放弃回写」与「合并」二选一 → 两者按层各取最小安全方案）：
   - `saveAll()`：写前重读 `KEY` 与本页快照 `_cardsCacheRaw` 指纹比对（`null` 与 `'[]'` 统一按空库指纹，避免全新环境误判）；失配 = 另一标签页/外部已改库 → **放弃本次回写**（返回 false + warn）并失效内存缓存（下次 `all()` 自动读到最新库，自愈）。选「放弃」而非合并的理由：saveAll 收到的是调用方改过的全量数组，安全合并需按 id 做三方差异且删除语义不明；放弃零风险，与审计验收「saveAll 返回 false 且库串不变」一致。
   - `upsert()`：单卡写入语义明确，失配被拒后**重读最新库重放本次单卡 upsert**（任务书认可的「marker+upsert 幂等允许重放」合并口径）——不回滚他人刚播入的批次（如 TT12），也不丢本次写入。重放仍失败（如配额满）按原口径静默。

## 验证

- 新增 `tests/base-corrupt-field.test.js`（4 用例）：损坏容器字段 peek 不抛+回落默认+逐字段留痕+原档未写回；完好老档零误报；损坏档存在时选档页五档全渲染；单档 peek 抛 TypeError 时选档页照常渲染+可见错误+降级卡无入口。
- 新增 `tests/cards-storage-guard.test.js`（7 用例）：解析失败备份+原键不动+自动播种被禁；非数组同口径；clearAll 恢复可写且备份键保留；空库指纹不误判全新环境；旧缓存写回不回滚新批次+自愈；upsert 失配重放两头保全；单标签连续写回不受影响。
- 任务点名定向回归全绿：`save-compat`(11) / `terminal-recovery-matrix`(3) / `m01-base-commit` / `cards-replay`(2) / `cards-catalog`(5) / `cards-sync-snapshot-guard`(3) — 6 文件 30 用例通过。
- 相邻风险群全绿（直接改库串/选档页/base 使用方）：class-consolidation、tt3-effect-baseline、bag-structured-rule-migration、cards-rules-runtime-boundary、cards、custom-cards、base-meta、menu-recovery-entry、terminal-settlement、r5a-session-menu、r7b-feedback、boot — 12 文件 97 用例通过。
- 全量 `vitest run --no-file-parallelism`：见文末补记。
- 未做：真实浏览器双标签页手工复现 F2（沿用审计报告口径，按硬边界规避实机存档；代码路径已由 jsdom 用例覆盖）。

## 未完成 / 遗留

- F1 中 stats 的纯数值子字段（extracts/deaths/kills/actions/playSeconds 等）损坏不抛错（JS 弱类型），按最小侵入未加 numOr 守卫，如需可后续按同口径补。
- 降级期间设计坊导入被禁（见上取舍）；如需 UI 级恢复入口（如「从备份还原卡库」按钮），属新功能，未擅自加。
- F2 的 rev 版本戳方案（审计任务书雏形之一）未采用：需新增非常量键且涉 consts 敏感区，指纹快照方案以更小改动达成同等防护。

## 全量测试补记

- `vitest run --no-file-parallelism` 全量：**144 文件 / 811 用例全部通过**（245s）。
- 说明：首次全量（693s，与并行会话高负载重叠）曾报 7 文件 8 用例红 + 1 个 potion-tip 卸载后定时器噪音；同工作区代码立即复跑全绿（0 改动），判定为时序 flake 非本批引入。本批改动的定向域（save/base/menu/cards 及全部直接写卡库键的测试）在两次运行中均稳定全绿。
