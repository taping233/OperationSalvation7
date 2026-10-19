# cd98745f cloud 修复独立审查

审查对象为当前未提交差异，不引用旧全量通过数作为本轮验收。仅只读源码、测试及文档；自有额外复现与报告存于本目录，未改生产源码、提交、构建或启动浏览器。

## 已确认问题与复验

**已修复：定时消耗的临时道具不会到期。** `battle.draw.js:addTempCard` 将道具移出手牌后，`battle.engine.js:consumeHandUids` 原先仅接受 `hand` 中的 UID。江湖救急普通战可生成道具并排 `consumeTemps`，下一回合回调会跳过栏内道具。独立最小测试通过实际 `addTempCard`、`processDelayed` 首先复现 consumed 空数组，随后 worker 扩展栏内未用临时道具判断，已转绿。已用 UID 被 battleBagItems 的 played/consumed 排除，不会重复消费。

**撤回两个错误初判。** 最初怀疑 hosted 牧师遇道具提前停止，以及 legacy 补牌全道具池无限循环。worker 复核指出 `battle.discover-candidates.js:31` 的 null-pred 通用池本就排除道具，两个生产调用均用 null-pred。初始测试分别误用随调用变化的 catalog（首轮只有道具，实为合法空池退出）和绕过真实池过滤的 stub，不能证明生产回归。已修正测试采用实际混合 catalog / 真实 buildDiscoverPool，确认无需修改 resolution/kills。`review-red.log` 与 `review-expanded-red.log` 保留为审查过程，不作为现存缺陷证据。

当前独立测试 `review-current.log`：1 文件 4 项通过（定时道具消费、真实混池牧师补至 6 且不额外给道具、legacy 全道具池安全终止、hosted 全道具池安全终止）。命令：`npx vitest run --config docs/evidence/2026-10-18-independent-review-cd98745f/review.config.js --reporter=verbose`。未重跑 worker 套件。

## 结算规则纠正

`docs/rules.md` 既有第 50 行与 `game.bag.settle.js` 一致：已用/消耗的生成牌进入局内消耗区；未用临时牌战后消散。不能因移入道具栏而排除已用临时道具的 `spentCards`。先前误将此路径视为泄漏的意见撤回。FB044 应保留 granted 以供结算，并以 played/consumed 身份排除重复使用；永久道具继续既有删除口径。本报告以最新规则为准。

## 未发现阻断问题的已审范围

- FB043：费用条件严格匹配目标回合，null/undefined 不被误视为 0 回合；选择映射按 UID，过期不生效，原优先级保持。额外 Node 断言 null/undefined/NaN × turn 0/1/3，加目标回合与缺省其它 UID，共 11 项通过。新增流程测试含存档恢复和重置；未重跑 worker 套件。
- FB040：选中 BOSS 灵符开战先标 consumed/grave，移出 hand/drawPile/discard；再次调用按 consumed 阻止重复。普通战、未选卡、其他开战装备和无 UID 边界清楚。真实结算测试含相同 UID 在 played/consumed 去重。保留 equipped 为展示沿既有规则，不据此报告缺陷。
- FB044 基础栏位与安全性：非直接施放道具不进 hand/lastDrawnUids；直接施放保留队列占位，played/grave 等不可用区屏蔽重复栏位；普通 owned 与 boss 临时范围不同；消费入口再次核 UID，没有 indexOf(-1) 误删末卡路径。定时消费已独立复验，最终代码确认保留 granted、栏内使用记 played；lifecycle 无差异，worker 的 direct/bar/unused 实结算三项已完成。
- FB004：精确作用域内三 ID 覆盖公共退出键 absolute；静态定位与 rail 居中一致，删除反馈层重复几何。CSS 结构测试不能替代当前窗口实际几何检查。
- perf-budget：按大小先分组、仅同大小候选 hash 与原 duplicateBytes 数学口径等价；完整稳定产物前提和唯一大小文件不校验读错误边界已在 performance.md 写明。
- 本轮相关源码 `git diff --check` 无输出。

## 文案与验收边界

`docs/rules.md` 的 BOSS 道具栏与灵符规则已由 parent 修订并复核，保留生成牌结算原则。发现获得道具仍固定“置入手牌”的日志，FB044 worker 已收到；若走直接发现，还应核 `battle.discover-flow.js` 中此类目的地文案。

本审查不宣称实页验收、视觉验收或全量验收。已独立复验本目录四项边界，不重复 worker 整套回归。

最终只读核对：FB044 worker 报告 13 文件 104 项通过及 lint 通过（worker 证据，非本审查重跑）；本审查独立结果仍为 4 项边界及 11 项费用断言。没有剩余已确认阻断缺陷。未使用旧全量 6065 结果作为本轮通过证据。
