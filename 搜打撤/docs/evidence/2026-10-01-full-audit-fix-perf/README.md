# 全量审计修复 + 性能优化（2026-10-01，WF-full-audit-fix-perf）

<!-- cleanup-status-20261019 -->
> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态](../../CLEANUP-STATUS.md)；下文历史验收结论与原始内容保持。


## 任务与授权

老板指令（10-01）：对代码仓库做一次全量审计、修复与性能优化，长任务不停，可开 ≤3 子代理。
修复授权来自本指令；**未提交**（提交须老板另行指示）。

## 输入

- 09-30 全仓深审证据：`docs/evidence/2026-09-30-full-repository-review/`（battle_cards / infrastructure / root / world_ui 四模块，28 项 confirmed 发现），本任务在其基础上实施修复。
- 新增性能专项审计（子代理 A，只读）：game/src 249 文件扫描，12 项发现（F1-F12），报告全文见本目录 `perf-audit-report.md`。

## 修复清单（28/28 全部处置）

### 战斗/卡牌（BC-01~10，主会话修，回归 tests/full-review-regressions-battle.test.js 10 例）

| ID | 文件 | 修法一句话 |
|---|---|---|
| BC-01 | battle/core/battle.enemy-phase.js | 极速符文打出最左牌后经 onResolved 续接回合结束流程（此前 action-runner 收口把阶段还原 player，敌方阶段被跳过） |
| BC-02 | battle/core/battle.draw.js | 灰烬符文满手直释的牌 push 进 discard（此前 UID 从所有牌区消失） |
| BC-03 | battle/core/battle.draw.js | BOSS 模式 deckDraw 只实抽牌库，不足少抽（此前从全卡池凭空生成装备）；普通战直授口径不变 |
| BC-04 | battle/core/battle.resolution.js | armor priceOf:'discovered' 改挂 priceArmor 旗给本卡刚排队的发现 job，pickDiscover 按所选牌价格结算（此前排队时取前次抽牌价格） |
| BC-05 | battle/core/battle.resolution.js | 搜索大宝箱牌库底三选一 n:cards.length→1（此前选 1 后又排队 2 次随机发现） |
| BC-06 | battle/core/battle.engine.js | 延迟段合成卡携带原卡 battle.target 契约 + 剥离已到期 schedule（此前 TypeError 卡死 + 永远再预约） |
| BC-07 | battle/core/battle.engine.js（两处装配）+ battle/effects/battle.discover-state.js + battle.discover-flow.js | 黑暗形态 discoverPlus 改候选数 optionsPlus +1（此前误把选择次数 +1 多获得一张） |
| BC-08 | battle/view/battle.preview.js | hits.perPlayedMoves 纳入 unstable 判定降级 unknown（此前按 1 段还标 exact，数字错一倍） |
| BC-09 | battle/bag/battle.bag.js + battle.discover-flow.js + battle.engine.js（bag 端口） | 通行证 acquire classAbility/legendary 战斗内直授（与基地同口径）、discover 面板立即消费、legendary 池谓词放行（此前道具白耗） |
| BC-10 | battle/core/battle.engine.js + battle/bag/battle.bag.js | onKill 按击杀数逐次触发且 null 来源也计数；砸击 applyKillRewards 移到 sweepDead 后（复验时发现深审未报的次生顺序 bug：击杀数恒 0） |

### 背包/整备/死亡（ROOT-01~05，主会话修，回归 tests/full-review-regressions-hub.test.js 6 例）

| ID | 文件 | 修法一句话 |
|---|---|---|
| ROOT-01 | hub/game.hub.depart.js | setDeployPick 记 fresh 旗，openDepartPrep 保留刚注入的预设选择 |
| ROOT-02 | hub/game.bag.js | 整堆移动按格数增量检查（叠放上限切格），9 张同名不再越过安全格容量；含容量内正向放行用例 |
| ROOT-03 | hub/game.bag.js | pearlTake 按增量格拒收（9 张资源需 3 格，不再只查 1 空格） |
| ROOT-04 | hub/game.bag.js | pouchPut 已有数+整叠数 >3 拒收（不再叠成 5/3） |
| ROOT-05 | run/game.session.death.js | 抢运过滤排除 pouchOf（不安全锦囊里的法术随锦囊丢，不再被珍珠盒错误带回） |

### 世界/UI（WORLD-001~005，主会话修，回归 tests/full-review-regressions-world.test.js 5 例）

| ID | 文件 | 修法一句话 |
|---|---|---|
| WORLD-001 | run/game.run.scenes.js | pickupGo 注册移入 reveal()（背包返回重入路径不再有按钮无处理器） |
| WORLD-002 | run/game.run.altar.js + game.run.scenes.js | openPocketRestore 挂背包返回钩子（保留剩余复原次数）+ openFireRest 同节点防重复发放（此前可无限回血刷职业卡） |
| WORLD-003 | run/game.run.flow.js | openEventCardChoice 自挂返回钩子重开自身（已付款二级选卡页不再被关背包吞奖励） |
| WORLD-004 | ui/game.menu.js | openInbox 包装 () => openSuggestionInbox(false)（dataset 对象不再被当成标题页来源布尔） |
| WORLD-005 | game/index.html | 启动护卫 clearInterval(this→guardTimer)（此前回调内 this=Window，失败条收不掉、就绪后 400ms 轮询永不停） |

### 基建（INFRA-01/07 主会话修；INFRA-02~06+ROOT-06 子代理 B 修，7 个测试文件）

| ID | 文件 | 修法一句话 |
|---|---|---|
| INFRA-01 | core/icons-bitmap.js | hydrate 文本节点先 esc 再 rich（自定义卡名/备注不能再注入 HTML 标签，XSS） |
| INFRA-07 | game.boot.js | pointerdown 时锁定世界坐标 downWorld（此前注释意图与实现不符，up 相机反推 down 坐标会点偏节点） |
| INFRA-02 | agent/agent.console.js | 快捷键页签跳转成功后不再 hideOverlay 清掉新页动作表 |
| INFRA-03 | agent/agent.runner.js | autoRun 先 getDriver 再 setDriver（finally 还原真正的调用前 driver） |
| INFRA-04 | game/tools/agent-batch.mjs | --policy llm 走 Agent.llm.decide（不再静默回落 greedy 误标数据） |
| INFRA-05 | game/tools/agent-batch.mjs | 单局超时先 stop 旧 autoRun 并等待收口再进下一局 |
| INFRA-06 | scripts/perf-ledger-capture.mjs | 删除按端口盲杀 taskkill 逻辑，端口被占即报错退出（不再可能杀死无主进程树） |
| ROOT-06 | game/selftest.js | GAME_PARTS 等全部适配现行域目录，node game/selftest.js 恢复可运行（退出码 0）；4 条内容已漂移的旧契约改指现行真源（详见子代理汇报披露） |

## 性能优化（按审计 F1-F12 实施 6 项无损项）

| 项 | 文件 | 改动 |
|---|---|---|
| F2 | hub/game.bag.drag.js | 背包拖拽 rAF 合帧（照 battle.aim.js 模式）+ 浮影定位改 translate3d（原 left/top 布局属性逐事件写） |
| F5① | hub/game.storage.js | write 内 currentRaw 只 JSON.parse 一次（此前存档每次双 parse） |
| F6 | ui/ui.js + css/winter.css | showCardZoom 开合挂/摘 body.zoom-open，CSS 暂停 .battle-stage 全部动画（铁律①：特写盖住战斗页不再空烧合成器） |
| F7 | css/page-hub.css | 闸门钥匙辉光呼吸从 filter:brightness 关键帧改伪元素 opacity（合成器通道；铁律②） |
| F8 | run/expedition.view.js | HUD 路线面板差分键改原始值拼接（此前每次战斗渲染对路线数组 JSON.stringify） |
| F10 | experience/pocket-strip.js | 600ms 轮询加 visibilitychange 停/启（页面隐藏不再空转） |

**审计后不实施、留档待议**（避免行为风险，见「待拍板/后续」）：
F3 双页面级 MutationObserver 收窄（title 摘除回潮风险）、
F5③ eventLog 环形截断（复查发现已由并行修复覆盖：game.run.flow.js:426-428 已有 200 条封顶，无需实施）、
F11 启动链动态 import 拆包（中长期，牵动 boot-order 契约与启动时序）。

## 性能优化第二轮（2026-10-01，WF-perf-opt-round2，老板指令「继续做全量性能优化不停」）

上轮标注需权衡的项全部处置：

| 项 | 文件 | 改动 | 备注 |
|---|---|---|---|
| F1（最终形态） | battle/core/battle.engine.js + battle.core.js + view/battle.aim.js + tests/battle-engine-facade.test.js | 新增 core 轻查询 `getBattleLiveness()`（只读 battleState.token/phase），aim 瞄准会话的存活判定（拖拽期每帧 2+ 次）改走它，不再全量组装快照+深签名 | **第一版同步链缓存方案被测试契约否决**：battle-snapshot-integration 明确要求同步链内嵌套规则变异后快照必须重投影，链级缓存前提不成立，已完整回滚改道轻查询；导出面守卫基线 64→65 同步更新 |
| F3 | game.boot.js | title 观察器 childList 分支改收集去重 + rAF 合帧（每根子树一次 strip，attributes 分支保持即时）；此前整页重建时逐节点即时 querySelectorAll | 无损：title 只在悬停可见，一帧延迟无感知 |
| F4 | battle/view/battle.view.js | 舞台模板 html 字符串精确相等签名：与上一帧一致时跳过 rich 宏替换+整舞台解析+12 槽 outerHTML 比对 | 字符串相等是零误判签名；模板含随机内容时永不命中=退化为原行为 |
| F5② | battle/runtime/battle.action-runner.js | 8s 节流落盘改 requestIdleCallback（2s 超时兜底；页面隐藏或 ric 不可用保持同步直写） | 崩溃安全窗口最多放宽 2s，关窗仍由 beforeunload 全量保存兜底；vitest 无 ric 走同步分支，测试行为不变 |
| F5③ | — | 复查发现 eventLog 200 条封顶已存在（game.run.flow.js:426-428），销账 | |
| F9 | battle/view/battle.aim.js | 敌矩形会话缓存（拖拽期免逐帧 getBoundingClientRect；resumeAimAfterRender 失效）+ 箭头重绘坐标/颜色/画布尺寸全等跳过 | idle 演出走 transform 不动布局，缓存安全 |
| F12 | hub/game.hub.pages.js + experience/pocket-strip.js | 成就页奖励卡 id→card Map 一次建表（此前逐成就全库扫）；收藏池 collectPool 提出职业循环；pocket-strip 层元数据按 MAP WeakMap 记忆化 | 全部纯函数缓存，无损 |
| F8 补充 | ui/hud.js | battle 模式下跳过路线面板渲染（面板被整页盖住） | `_lastMode==='battle'` 信号与 overlay.js page-covered 既有判断同源 |

**F1 全量代际缓存与 F11 仍不实施**（风险评估）：战斗状态写入通道无统一信号（set$ 赋值与数组原位变异并存，签名代际会漏事件→陈旧快照）；启动链动态 import 牵动 boot-order 契约与全局初始化时序，收益（几十 ms 解析）不抵回归风险。F3 的收窄版（监听范围收 attributes-only）同样不实施——合帧版已消除其主要成本且零行为风险。

### 第二轮验证

- 语法门 289 文件通过；eslint 0 错误；typecheck 通过。
- **全量 vitest（第二轮后，01:39）：266 文件全过，2131 passed | 2 skipped | 0 failed，81s**——第一轮后为 2127/2 既有失败，本轮后既有失败也归零（game-store-types 为并行时序 flake、hub-flow 断言随 e8dad75 落库对齐）。
- 过程波折记录：F1 第一版（同步链缓存）被 battle-snapshot-integration 的重投影契约当场否决（`expect(refreshed).not.toBe(first)`），完整回滚后改道 getBattleLiveness 轻查询；导出面守卫基线 64→65 显式更新；boot 启动链 3 例因 core re-export 缺失一度红，补 export 后绿。

## 验证

- 新增回归 5 文件 28 例（battle 10 + hub 6 + world 5 + 子代理 7）全部通过。
- 定向：战斗卡牌/发现/道具/快照/预览/背包/存档兼容组共 200+ 例通过。
- 语法门 check-syntax 289 文件通过；eslint 0 错误；typecheck 通过。
- **全量 vitest（修复后，01:08）：266 文件 = 2 failed | 264 passed，2131 用例 = 2 failed | 2127 passed | 2 skipped，81s**。
  基线（修复前）：2 failed | 2092 passed | 2 skipped。净增 35 例全绿；2 个失败为**既有**（见下节），本轮零新增失败。
  BC-07 回归在首轮全量下暴露过一次并行串扰（候选池受前序文件全局状态影响），断言已改为确定性核心（n=1，旧 bug 为 n=2）后稳定。

## 基线与既有失败（非本轮引入）

全量基线（修复前，HEAD fd38468 + 各会话未提交改动）：2 failed——
`tests/game-store-types.test.js`（TS 契约）与 `tests/hub-flow-regression.test.js > 出征整备写盘失败`（源码文本断言）。
归属：工作树内其他会话（音效班/流程班等）未提交改动的既有状态，本轮不处置。

## 待拍板/后续

1. 子代理 B 披露（已修，2 行）：`game/tools/agent-batch.mjs` fetch 桥回落 Node 原生 fetch——jsdom 无 window.fetch，不改则 INFRA-04/05 桩验收不成立（旧回落恒拒绝、llm 批跑静默退化贪心）。老板认为越权可 2 行回退。
2. 性能审计 F1/F3/F4/F5②③/F11 与「跳过项」是否排期，归路线图决策。
3. 深审 battle_cards 的 BC-U01~U03 未计缺陷疑点（queueBattleAction 返回值注释、旧战斗档 restore 矩阵、perFuelCost 卖价口径漂移）维持深审原判：不单报，改到相关代码时需复评。
4. 本轮全部改动**未提交**；提交/推送须老板明确指示。
