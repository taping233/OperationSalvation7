# 战斗回合续接：集中验收复核

2026-11-01，Battle 作者只读复核 Root 已执行的领域/原生证据；本次只写本说明，没有修改生产或检查源码，没有重跑、启动 Unity 或播放器。

本片可用的集中证据已经通过：

- `../搜打撤/docs/evidence/2026-11-01-unity-parity-round4/domain/battle.log` 记录 **PASS 232**；同目录 `processes.json` 的 battle 进程 exitCode=0。这是既有及本片领域断言的合计，不是232种独立玩家旅程。
- `native-round4-5/result.json` passed=true、error=null、Battle **30**；`process.json` exitCode=0、timedOut=false、inputsUnchanged=true。源码前后映射各796项、差异0；本片原生检查 SHA 均为 `77dd538633f0668050ae7bce1656c47c10f9daa3b7038d71f34d3e6ecb93e3a9`。
- 该新驱动其余项为 Preparation31/Photo25/Inbox12/Run29，共127。本审只直接复核战斗领域、Battle原生及其输入守卫，没有将 Root 汇总的旧554项逐一重新审查，也不把总数当全场穷举证明。

## 实际诊断与前置边界

`native-round4-5/unity.log:514,526,538,550` 显示两个合法装备夹具：双逆鳞及单逆鳞+丝袋。命令前 ready=true、beats=0、窗口 focused=false、hold=false，回合1/player/busy=false，尚无 owner/choice；会话与游戏 RNG 同引用且同为 seed=7。两张真实 granted 神灯 UID 在牌库，普通手牌不含它们。

正式 `BattleView.Commands.EndTurn()` 后，实际快照仍为回合1/player/busy=false，但 TurnEndPending=true 并出现神灯三项抉择；双逆鳞已抽走两副本，单逆鳞还剩一张牌库副本。此时展示队列分别有9/7个 beat，所以 ready 暂为 false，随后使用原 Ready 等待完成。RNG 两引用仍相同、实际随机状态一起推进。本轮没有靠放宽 Ready 通过，也没有修改焦点守卫或生产随机规则。

回合前置由正式命令构造，并立即要求 owner、choice、回合1、HP997；原生通过意味着这些实际前置成立。后续当前抉择仍通过真实 ISubmitHandler 提交，验证等待文字、独立控件不可用而当前选择可用、同标签第二抉择重绑、旧 UnityEvent 不消费新抉择、冻结后只恢复一次、跨场旧事件和强制退出清理。**不宣称后台结束按钮成功点击、长按设置、真实鼠标射线或物理键盘已验。**

旧 `native-round4-3` 缺少实际焦点/随机引用日志，仅报 reactive choice 等待超时，不能追补成成功。本轮 focused=false 与现役 CurrentEndTurnHold 的焦点条件解释了为什么“ISubmitHandler存在/返回成功”不足以证明回合已开始；此前的具体焦点值仍未观测。

## 作废结果与未穷举边界

`native-round4-4/result.json` 虽为 passed=true/Battle30，但其 process.inputsUnchanged=false，唯一变化为 `Assets/Editor/CurrentBattleRound4Checks.cs`，运行前 SHA `3873db35…`、运行后 `77dd5386…`。该次因在途源码变化作废，不能并入通过数或替代 native-round4-5。

领域针对完整现役池的合法性、受控候选的正式星辰链、同敌多hit/多敌、同批响应RNG、死亡/冰冻、满手副本、花瓣draw→heal、嵌套发现/二段目标与取消、毒伤、终局/旧token等指定条件。原生只构造合法星辰操作的两个副本结果来核当前UI接线，没有自然重现整个获取/随机发现/洗牌旅程；choice Submit也不是OS输入。

本简报不将这些证据扩大到所有自定义/旧文本触发组合、所有敌人/卡牌、所有帧序、其它尺寸/硬件、性能数字或全玩家流程。本轮 Desktop构建与正常Player实绘由 Root 随后执行，此处尚未核读其结果或绑定新构建GUID。
