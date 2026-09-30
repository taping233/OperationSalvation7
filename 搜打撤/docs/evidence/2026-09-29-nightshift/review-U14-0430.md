# review-U14-0430 —— 复审者 R9 独立复审单（2026-09-29 夜班）

对象：fix-U14-0410.md 所述工作树未提交改动。复审方式：只读 + 一次现场摘修复实验（已完整还原）。
基线 HEAD：83a9864。

---

## 1. diff 最小性与红线

实际 diff（git diff 亲取）：
- `game/src/battle/bag/battle.bag.js`：仅 +4 行（2 行注释 + `const usability = itemUsability(card);` + `if (!usability.usable) { G.log(..., 'dim'); return; }`），位于 useItem 内 getHostedExecutionCard 之后、分流之前。无夹带。
- `game/src/run/game.run.shop.js`：仅 +1 行 `if (owned.stored) return;`，位于 sellCard 的 isSellable 拒绝块之后。无夹带。
- `tests/m3-contract.test.js`：startGame 增第三参 `startOpts = {}`（默认空对象，既有 22 处两参调用全部兼容）+ 新增 2 用例（G-1 BOSS 拒绝 + G-1 非 Boss 回归锚）。无夹带。
- 新文件 `tests/shop-sell-stored-guard.test.js`（2 用例），派单要求项。

红线文件：`winter.css`（-110 行，css-dedupe 内容）、`page-rewards-bag-help.css`（±9 行 css）、`package.json`（±4 行）在工作树确有改动，但内容均为班内他席 CSS 去重/包配置工作，无任何 bag/shop/道具逻辑，归属与本修复无关；`cards-sync.json` 零改动（git diff 空）。**结论：U14 修复本体红线零触碰。**

## 2. U14-a 语义面（核心）

itemUsability（battle.bag.js:40-48）四个拒绝分支逐一推演「复检后」影响：

1. **未知道具（!card）**：entry 来自 battleBagItems()（:36，滤 `o.card &&`），entry.card 恒真；getHostedExecutionCard（battle.hosted.js:22 `if (!card || typeof card !== 'object') return card;`）不返回空。分支不可达，纯防御，无影响。
2. **合成材料（tt-token-color）**：全库 rg，tests 中仅 m11-data.test.js:38、message-batch-0917.test.js:179 数据层引用，无任何用例依赖「战斗内 useItem 消耗合成材料」。人类路径本被视图 .off 拦截；原引擎路径反被 agent 通道白白消耗——收口方向正确，非回归。
3. **BOSS 禁逃（双查）**：文本 `ITEM_BOSS_FLEE_PATTERN`（:39，`/非\s*BOSS\s*战/`）与结构化 `rules.bag.use.some(op => op?.op === 'flee')`（:45-46）同在复检函数内，与视图层 battle.engine.js:273 `itemUsability(o.card)` 同一函数同闸。既有用例 e8「tt-jinchuangyao/tt4-woodify/starter-emergency-bandage preserves BOSS rejection」本次亲跑全绿——**未误伤既有 BOSS 口径用例**。非 BOSS 战 flee 照常 `finish(null)`（:137-141），由新增回归锚锁定。
4. **敌方道具无敌人（itemTargetSideFor==='enemy' && !alive().length）**：旧行为=进 useBattleEffectItem 后 `if (!n) { G.log('场上没有敌人可以使用', 'warn'); return; }`（:213），**return 在 queueBattleAction 与任何 splice 之前，不消耗**；新行为=提前 return，同样不消耗。仅 log 文案（'场上没有敌人可用，道具未消耗'）与级别（warn→dim）变化，**结果等价**；rg 全 tests 无用例依赖该旧行为（含「空场使用消道具演出」不存在）。usePotion 路径（:368-377）在 0 敌时自有守卫先行 return，不经过新闸，无双重 log。

**G.log/esc 可用性**：G 自 battle.runtime.js 导入（battle.bag.js:9），G.log 同函数 ：77/:81 既有调用；esc :4 导入。成立。

**usePotion→useItem 幂等**：同函数同判定，拒绝发生在任何 splice 之前，无双重消耗；合法道具 usable:true 时控制流与原路径一致（新增仅一个 if 不命中）。

**一处口径注记（非缺陷）**：视图快照对**原始卡**算 itemUsability（battle.engine.js:273 `o.card`），引擎新闸对 **getHostedExecutionCard 规范化卡**算。hosted 结构化卡（含 rules.bag）原样返回（battle.hosted.js:26）不分叉；hosted 文本卡 desc 被规范化为 canonical（battle.hosted.js:29），若存量自定义 desc 与 canonical 在 flee 文案上不一致，理论上视图与引擎判定可分叉——但分叉方向恒为「引擎更严」（按权威规则文本拒绝并 log），不产生放行漏洞，仅修复单「完全同源」表述略过头。

实施者称 117 全绿：**亲跑复现（见第 5 条）**。

## 3. U14-b stored 语义与检查顺序

- **stored 语义核实**（rg 全库）：`o.stored = 1` 由珍珠盒存入侧写入（hub/game.bag.drag.js:172、hub/game.bag.js:389/:455），消费侧统一按「珍珠盒存放中、不占背包格」处理（game.session.bag.js:39、battle.overlays.js:140、game.session.js:67）。语义=珍珠盒存放，成立。
- **同口径锚点**：收购台渲染过滤 shop.js:276 `isSellable(owned.card) && !owned.stored`（注释「珍珠盒中存放的资源卡不在此列出（2026-09-10 #29）」）——新闸与渲染过滤逐字对齐。
- **入口唯一性**：rg sellCard 全 game/src 仅 shop.js:412 `UI.act('sellCard', ...)` 一处引擎入口（:283 渲染按钮、agent.policy.js:839 仅从渲染动作挑选项，stored 卡 :276 已滤不渲染）。无旁路。
- **检查顺序**：isSellable 先行→不可售卡保留既有 `UI.log(...'不可出售', 'warn')` + return 原样（亲核 ：415-419 未动）；stored 后置仅拦截「可售且存放」条目，早退在 splice/加币/saveGame 之前。合理。注记：stored 早退为静默 return（无 log）——与「渲染层本就不显示、直调属作弊通道」的定位相称，不计缺陷。

## 4. 测试敏感性（现场实验，已还原）

操作：git hash-object 记指纹 `ab6e291` → Edit 摘除 battle.bag.js:55-58 四行守卫（还原至基线形态）→ `npx vitest run tests/m3-contract.test.js -t "G-1"` → **BOSS 用例红**（`expected false to be true`，:222 battleActive——摘守卫后烟雾弹把 BOSS 战逃掉了，缺陷真实复现；回归锚 `still ends battle outside boss` 绿）→ Edit 复原守卫 → 指纹复核 `ab6e2911716097ffbd9fb0835cc896ef65d17b32` 与摘除前逐字节一致，git diff 回到 +4。**用例抓得住缺陷，实验闭环。**

## 5. 亲跑复验

- `rg -l "useItem|battle.bag|sellCard" tests/`（含 run.shop 变体）命中 11 文件，与修复单所列完全一致。
- `npx vitest run`（上列 11 文件）：**11 files passed，117 passed | 1 skipped（预存在跳过），无 fail**；另对 shop-sell-stored-guard + m3-contract 复扫输出，无 Unhandled、无 error。EXIT=0。

## 6. make-work 检查

四个改动文件逐一对应派单目标：两个守卫行、两个测试载体；startGame 签名扩展为透传 isBoss/nest 所必需且向后兼容；无多余文件、无顺手重构、无未要求功能。**无 make-work。**

---

## verdict

**PASS WITH NOTES**

- N1（文档表述）：修复单「与视图层完全同源、口径不会分叉」略过头——视图对原始卡、引擎新闸对 hosted 规范化卡；实际分叉方向恒为引擎更严（按 canonical 规则文本拒绝），无放行漏洞，建议后续如改 itemUsability 时留意两处入参来源。
- N2（风格注记）：sellCard 的 stored 早退为静默 return（无 warn log），与 isSellable 分支风格不一；直调属非渲染通道，可接受，不作整改要求。
