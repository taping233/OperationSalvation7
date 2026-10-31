# 旧种子与原卡序的原生重放补证

**原首候选在本轮受控重放中可正常点击，三候选均通过真实对象命中检查；没有使用显式渲染、滚动或换项补救。** 原 Journey 1 失败当帧的具体原因仍无足够数据，不能强行归因为裁剪、渲染滞后或某张卡。

Root 执行 `current-reward-transition-1`：PID 9188，退出 0，336 项输入执行前后未变。本报告另行只读核对 trace、原 profile 和最终 fresh profile；`audit.json` 中 15 项记录检查全部通过，输入 SHA 见 `inputs.json`。未修改任何产品或启动 Unity。

该入口从旧自产 profile 的只读副本加载 seed `169015024`、节点 `3,9`，保留原 large/all 三卡 → medium/one 三卡及顺序。为重放第一次领取，隔离副本中按精确 UID 移除 large 先前发放的三张，回退已收四币，复原箱回执；再经实际 `LoadRun / ResolveCell / BattleBridge` 创建 large、真实点击“全部收下”切换 medium。原证据 SHA 始终为 `7a788b8cbe4ea42117134c9c6b67ae5da7d97f60d6cbf8ca4c07b3e828c66110`。

## 三候选逐项命中

tick 5，显式补救渲染之前：

| 原 medium 候选 | 索引 | 按钮中心 | Graphic depth | cull | 实际对象接收者相等 |
| --- | --- | --- | --- | --- | --- |
| `tt2-frostsword` | 0 | `(616.0001,292)` | 20 | false | true |
| `tt12-raygun` | 1 | `(960,292)` | 37 | false | true |
| `tt12-chargeray` | 2 | `(1304,292)` | 57 | false | true |

三按钮均处于实际 mask `x56..1864 / y112..944` 内，Graphic 启用、可射线命中，首命中均为对应按钮。随后点击的仍是原第一项 `tt2-frostsword`，坐标与原失败点一致；实际 `RaycastAll + ExecuteEvents` 的首命中与接收者检查通过。

全程只有三个实际点击：“全部收下”→原首项→“继续探索”。`normalRenderRecoveryNeeded=false`，没有 after-native-render、scroll 事件或换候选补救。

## fresh profile 的结果

- seed 仍为 `169015024`，当前位置仍为 `3,9`；节点完成，`chestIndex=2`。
- large 的 taken 为 `[0,1,2]`、lost 为空；medium 的 taken 为 `[0]`、lost 为 `[1,2]`；两箱 completed 和 coinsTaken 均为 true。
- 旧三张已发 UID 被精确移除，原其余七张保留；本轮只增加原 large 三卡及 medium 首卡，共四张。最终 11 个唯一 UID，无重复增发。
- 回退四币后经两箱各收 3 / 1 币，最终 fresh profile 为原值 32 币。
- 旧证据文件的 SHA 与运行前预检、复制记录一致。

## 证据范围

本轮关闭了“原卡序/原首项在正式箱间切换后是否仍被阻挡”的当前验收疑点；没有复现旧失败。旧当帧未记录 Graphic/mask，因此原始根因仍未确定，显式渲染/滚动补救分支也没有被验证为有效修复。

受控 reset 保留了副本的基础收集历史，不用于证明平衡或历史累计数据。Root 观察到旧截图容量 25 与本次容量 16 的差异，已交独立 `capacity_reload_check` 复核；此处只记录 reset 时 `owned=7 / usedSlots=3 / capacity=16`，不解释其原因，不把本轮输入通过扩展为容量与读档等价已通过。

这些为原生程序构造输入证据，没有操作系统硬件输入声明。
