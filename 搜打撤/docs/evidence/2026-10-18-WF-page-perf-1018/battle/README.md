# 战斗页面性能优化证据（2026-10-18）

本片减少三类可复现的重复工作：稳定手牌的 DOM 属性写入、注能输入重复读取完整快照、发现候选展开期间的重复 DOM 更新。玩法判定、卡牌数值、350ms 发现输入闸门、动画时长和绘制分辨率保持原逻辑。

## 实施与计数

| 同条件受控操作 | 原字节基线 | 修改后 | 口径 |
| --- | ---: | ---: | --- |
| 9 叠手牌，相同状态调用 `updateHand` 20 次 | 3060 | 0 | 手牌子树 MutationObserver 记录数 |
| 注能页输入 20 个无关键 `a` | 80 | 0 | `getSnapshot` 调用次数 |
| 注能页一次材料数字键 | 10 | 1 | 同一次同步输入的 `getSnapshot` 调用次数 |
| 两个发现候选，展开中继续推进 20 帧 | 80 | 0 | 发现页子树 MutationObserver 记录数 |
| 发现闸门到期后的必要更新 | 4 | 4 | `aria-busy`、两张候选的可用状态、剩余提示 |

快照命中现有缓存仍会采集输入并遍历深签名，所以计数下降代表少走完整快照检查；不能据此声称同比例 CPU 时间下降。上述 DOM 计数来自 jsdom、帧时间受控；没有实机 FPS、GPU、RSS 或峰值内存结论，也没有将自然路径 code 9 定因为本片问题。

- `battle.layers.js`：每次仍重新计算当前手牌状态和布局；只有 live DOM 的值不同才写 class、dataset、aria、role、tabindex 和八项 CSS 变量。没有跨状态缓存；外部改写、原地改变能量与卡牌顺序、整卡替换都由回归覆盖。
- `battle.infusion-view.js`：无关按键不读取战斗快照；每次实际输入读取一次新快照并在该同步处理链复用，下一次输入重新读取。切换页面或关闭弹层立即解绑当前键盘监听，热更新时也清理。
- `battle.view.js`：发现展开状态只在 `opening` 改变时写入 DOM。原 rAF 入场检查、350ms 截止点和旧页面失效检查继续执行。

## 战斗页覆盖核对

下表是本片的源码审计与定向回归边界；真实窗口验收由父会话统一执行，本片未启动服务或浏览器。

| 页面/交互 | 核对位置和结果 | 定向证据 |
| --- | --- | --- |
| 战场主视图、玩家/敌人/随从 | `battle.view.js` 常驻舞台与 `battle.layers.js` 的单位分段签名；没有新增页面循环 | secondary-overlay、decision-redesign |
| 手牌、分栏、键盘、内联阅读 | 本片差分写入；布局和卡牌状态仍即时计算，卡面节点可继续复用 | page-perf-battle、hand-layout、hand-hit-input |
| 拖拽瞄准、回手与敌人预览 | `battle.aim.js` 共用活动帧，空闲无 aim/回位后停止；几何与 Canvas 现有优化保留 | hover-play-availability、hand-hit-input |
| 敌方意图展开、即时目标状态 | `battle.layers.js` 实算意图后按分段 HTML 签名写入；展开交互监听随节点持有 | decision-redesign、secondary-overlay |
| 已穿戴装备与主动技能 | `updateSelfUnit` 的装备分段签名；busy/used 按当前快照判定 | decision-redesign、secondary-overlay |
| 注能材料、详情、返回、直接打出、确认 | 本片单次快照与输入监听清理；材料上限、忙碌、换场、详情覆盖阻断保留 | page-perf-battle、infusion-action-layout |
| 发现候选与入场闸门 | 本片减少重复 DOM 更新；350ms 到期更新和原失效闸门保留 | page-perf-battle、discover-retained-feedback、discover-result-source |
| 抉择选项 | `battleChoiceBodyHTML` 只在快照渲染时生成；命令仍为选择入口 | decision-redesign、secondary-overlay |
| 手牌选择、支付代价 | `battleHandSelectBodyHTML` 与现有 eligibility 过滤；没有额外轮询 | decision-lifecycle、decision-redesign |
| BOSS 战前编组 | `renderDeckSelection` 仅选择变化重绘；保留现有卡面复用与确认规则 | decision-redesign、secondary-overlay |
| 剩余牌库、消耗牌、牌堆规则详情 | `battlePileBodyHTML` 单次分组；检查动作只替换详情区域 | decision-lifecycle、decision-redesign、secondary-overlay |
| 战斗背包、道具、安全格 | `renderBattleBag` 入口聚合、按动作刷新，没有空闲循环；保留当前安全格/道具规则 | decision-redesign、secondary-overlay |
| 发现/选牌/注能的大卡详情 | `bindBattleDecisionInspection` 与调用页存活检查，保留父 DOM 和焦点；旧独立手牌详情没有当前调用入口 | decision-lifecycle、infusion-action-layout |
| 战斗设置、BOSS 规则、致死确认 | `battle.view.js` 只在按钮操作时生成，返回复用战场；不新增计时器 | infusion-action-layout、secondary-overlay |
| 卡牌动态与战报反馈 | `showBattleCardResults` 历史最多 6 行，没有新事件时跳过 panel 重写；反馈按原生命周期清理 | card-results、discover-retained-feedback |
| 胜利反馈 | `presentVictory` 同场次复用进行中的 Promise，完成/离页解绑监听和观察器 | victory-presentation |
| 角色帧与场景资源 | 复用此前画质/Canvas/生命周期优化；角色静止位置巡检仍存在，隐藏时不执行尺寸检查。未在本片更改或声称全部空闲调度归零 | 本轮源码核对；资源实页由父会话负责 |

## 重放

原始文件逐字节保存在 `baseline/*.txt`。专用 Vite 插件只在测试加载时替换这三个模块的源文本，模块 ID 和其相对依赖保持当前路径，不改动或回滚共享工作树。

```powershell
node node_modules/vitest/vitest.mjs run tests/page-perf-battle.test.js --config docs/evidence/2026-10-18-WF-page-perf-1018/battle/baseline.vitest.config.mjs --testNamePattern='measures' --reporter=default
node node_modules/vitest/vitest.mjs run tests/page-perf-battle.test.js --maxWorkers=1 --minWorkers=1 --reporter=default
```

两次分别输出 `BATTLE_PAGE_PERF` 与 `BATTLE_DISCOVER_PERF`。基线仅跑两项计数场景，性能值断言在基线模式中关闭；正式模式同时验证行为和开销。A/B 使用相同当前依赖，父会话的公共卡面缓存变化两边均相同。

## 验证结果与未核项

- `targeted-vitest.json`：10 文件、125 项通过，覆盖手牌、注能、二级页、战报、胜利与预览；完成于发现页差分提交前。
- `discover-vitest.json`：发现页修改后，3 文件、23 项通过。
- `page-perf-vitest.json`：最终新增 9 项通过，包含三处优化的实际模块调用、原地输入变化和到期状态恢复。
- 三份报告按文件名与用例全名去重共 **12 文件、134 项通过**，当前没有失败。首次新夹具有两处断言不符合既有契约：不可变快照换场应替换快照对象、卡面内容编辑应整卡替换；已修正夹具并重跑通过。
- 三处源码已冻结；没有执行 build、删除、提交或改动共享台账。真实窗口视觉/冷资源/自然音频路径由父会话验收，不能由本片的 jsdom 计数替代。
