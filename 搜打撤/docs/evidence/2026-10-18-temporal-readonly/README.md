# 邪能护体临时免疫窄域审查与修复

确认并修复现役缺陷：同回合两次邪能护体让临时诅咒免疫永久化；临时期间施放深渊主宰时，永久免疫也会被旧恢复任务清除。

- 真实卡 `tt12-felguard`，卡文为本回合免疫伤害和诅咒。使用真实卡表初始化、真实 BattleSession、真实手牌与注能燃料、正常结束回合；没有替换卡池或规则过滤。
- `game/src/battle/core/battle.exec-play.js:335–339` 每次保存当时的免疫前值：第一次 false，第二次 true。
- `game/src/battle/core/battle.engine.js:445–447` 下一回合依次恢复 false、true，并清除两条任务。最终永久停留 true。
- 影响：之后的诅咒持续被抵抗，且提示错误地变为深渊主宰的永久免疫措辞。不是卡文允许的延长。
- 最小修复建议：同一个临时免疫窗口只登记一个恢复任务，保留最早基值。若期间再获得真正永久免疫，必须保留该永久来源，不能让旧恢复覆盖它。不要机械改变回合比较符。

## 复现

Node 22，本地 Vitest/jsdom，无网络、无浏览器/headless：

`node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-18-temporal-readonly/vitest.config.mjs --reporter=verbose`

红测见 `red.log`。初次只读阶段仅新增此目录文件，未改生产；随后按明确授权完成下列最小修复。此为引擎复现，非实页验收。

## 范围及排除

读过当前相关 diff、AGENTS 与限定 battle handoff；检查了 zeroFeeUntil 的已修复精确回合、delayed 特殊任务、nextTurnStart 的排队和消费、额外回合/普通回合入口、piles 读档与重置。未展开全卡审计。急救合剂的 repeat triggerOps 分支存在疑点，但卡已退役，因此不计现役问题、不加人工合成卡测试。自然法杖、灵符和临时道具已有修复未覆盖或改动。

## 已授权修复与验证

生产变更仅 `battle.exec-play.js` 两处授予入口及 `battle.engine.js` 永久 setter / 到期恢复小段：

- 临时窗口只登记一次任务，保留最早恢复基值。
- 真实永久来源深渊主宰（hosted sovereign）授予后，将现有临时恢复任务改为恢复 true；结构化 registerRule playerCurseImmune 同步。
- 已核对结构化 setter 唯一调用者 `effect-steps.m2.js` 始终传 true；保留 false 分支原赋值语义，不引入撤销规则。
- 旧存档含多个恢复任务时只兑现第一条，并清除重复任务。不新增持久状态，不改变存档格式。
- 保留另一个会话在 engine consumeTemps 的已有修改。

`tests/battle-curse-immunity-lifetime.test.js` 六项覆盖：单次、同回合重复、连续回合、永久来源先获得、临时期间获得永久来源、旧重复队列还原。前五项均使用真实卡表与真实燃料；第六项在真实施放后通过正式 restorePilesBookkeeping 入口还原旧序列化队列。扩展修复前3过2红见 expanded-red.log；修复后与语义反馈、M2契约、contracts和architecture-boundaries共5文件88项全过，见green.log。定向ESLint与git diff --check通过。

兼容边界：若旧存档已经永久漏免疫且恢复任务已消失，或旧记录在临时期间得到永久免疫却仍保存 restore:false，现有布尔状态没有足够来源信息，不能可靠区分并自动回填。此次只修可证明的队列和新授予路径，不凭布尔值猜测历史来源。

无浏览器启动、无build/commit/push。当前实页环境由主线程确认为阻塞，以上仅引擎与静态验证，不宣称实页通过。主规则说明和登记由主线程集中处理。
