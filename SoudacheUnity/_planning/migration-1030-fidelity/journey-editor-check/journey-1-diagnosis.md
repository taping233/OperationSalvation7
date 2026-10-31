# journey-1 原生失败诊断（只读）

结论：当前失败是验收自动出牌器只认旧卡ID，随后误把死亡当作可继续寻路；证据不支持修改地图或生产流程。

## 原生事实

- journey-1 / process.json：输入未变，Unity 退出2。
- journey-trace.json：tick53/104/250真实点击三处 goDoor，随后均记录 passage 3600+700ms。
- tick352：实际 BossGate 已显示，并经 EventSystem 点击 bossGateFight。drawBeforeConfirmation 为 null。
- tick353：boss 1500+680ms；tick363：实际 DeckSelectionPanel 显示囊巢母体，以及追斩、骷髅王剑、迷之匣三个可选项。
- 骷髅王剑当前界面文字明确：每张初始攻击变为不朽斩。
- tick1054：Boss在第81回合结束；tick1064：实际 DeathScreen / phase=done，囊巢母体仍45/45。
- 原生测试profile的settlements[5]：reason=dead/status=complete，runActive已经结束；run seed=205776612，layer3/track13，hp=-50/atk2000，altarActivated=true，bossDefeated=false，bossId=boss_orc。runs为空。没有失败存档写入或门路线中断证据。

## 源码与推断

- 源game/src/cards/builtin-equipment-execution.js：tt3-immortal-blade 的 battleStart 执行 transform starterAttacks into 不朽斩。
- Unity StructuredRules.cs:438 同样在 battleStart 将初始攻击的UID放入 cardOverrides，FindCard 返回覆写后的不朽斩。
- Editor CurrentMigrationFlowValidation.Journey.cs / Fight 只处理 FindCard(uid).card.id == starter-attack，其余手牌全部忽略并结束回合。
- 因而首次随机取得并选入骷髅王剑后，自动出牌器看不到可用的初始攻击。这解释了囊巢母体整场45/45、81回合被流血/中毒耗死。该因果由实际编组、源规则与测试代码共同支持；原生trace没有保存逐回合手牌，需修后原生复跑确认具体出牌。
- CountCompletedBattle 只判断 over，无胜负；Traverse 对 DeathScreen/runActive=false无终态断言，直接Clear+FinishNode，再FindPath(boss)，最终发出误导的 no current route。

## 建议（仅Editor，尚未实施）

1. 对自动出牌器使用当前 FindCard 语义，至少支持不朽斩与当前简单直伤武术；调用原有TargetSide/GetEffectiveCost/PlayCard，记录实际ID、UID、费用、目标、结果；不修改卡牌或敌人规则。
2. over 时区分胜负并记录 playerHP、foeHP；Traverse 看见DeathScreen或runActive=false立即记录失败，禁止吞掉死亡页后继续找路。
3. 保留BossGate、goDoor真实点击、四层/祭坛/首脑/撤离断言；不改寻路、不固定Boss、不跳过战斗。
4. 经root协调输入解冻后修改测试，再跑全旅程。旧passed不能代替本次原生结果。