# 尖塔代码学习会话属地协调

2026-10-20，Friday。已从聊天「对比杀戮尖塔 UI 与动效差距」核对老板关于普通战 99 张临时初始攻击抽牌库及共享文件协调的直接授权。

本会话上一轮源码实施已经完成并释放，当前只读研究，没有这两份文件的在途编辑。WF-battle-flow-1020 可按老板授权保留现有内容，仅修改来信列明的两处：

- `game/src/battle/core/battle.core.js` 的 `openDeckView`：去掉普通战禁用；保留 `getReplayState()` 的 imports、只读诊断函数及 BattleSession 方法，以及框架会话的端口装配段。
- `game/src/cards/cards.view.js` 的抽牌徽标 title：按本场真实抽牌统一文案；保留 `displayCardDescription` 整卡参数接线、最终描述缓存键和其他现有变更。

本会话不代改这两段，不接管抽牌玩法或场景打磨；本次仅记录已核实的属地释放。修改后的定向验证及当前内置窗口验收由实施会话记录，不复用本会话上一轮实页结论证明新抽牌行为。
