# R7-a 两组混编交付

## 玩家行为

L2 新增固定双人组：联邦射手（5攻3血）+联邦机动兵（5攻6血）。两者不增加新AI；差异来自低血快速减员与厚血目标投入。L2/L3 原来暗示蓄力、冲锋、防守的 strategy 已改为玩家实际可感知的攻击、生命与减员取舍。

L4 新增固定双人组：灼热异变体（10攻7血，实际造成伤害后附2回合灼烧）+滋生异变体（5攻12血，实际造成伤害后附1层随机诅咒）。没有穿透伤害时不附状态，未修改原状态时钟。

Elite 仍先判定（L3 3%、L4 10%）。非精英只选择一次旧entry或新group；group固定2只，旧entry原数量区间不变。非法、重复ID或坏形状group用同一次choice索引稳定回退旧entry，不重掷。

## 真实战斗证据

固定50HP/4攻/两张初始攻击：L2只打一张后结束回合，先杀射手为45HP，先压机动兵为40HP。L4两张都打灼热后为45HP且没有灼热敌人施加的burn；两张都打滋生后为35HP且下一玩家回合仍可见至少1回合burn。灼热命中时刚施加burn=2，`afterEnemies`末尾原状态钟递减后快照为1；滋生的随机诅咒若抽到计时burn会从1递减消失，若抽到stack型流血/中毒则保留1层。本包未改该时钟。

完全防住测试通过BattleSession正式旧检查点恢复入口注入明确的15点初始护甲fixture，再用真实 `endTurn` 命令进入敌方回合；10点与5点攻击实际伤害均为0，玩家仍为50HP、护甲恰好耗尽，且没有burn/bleed/poison。测试把下一次status随机固定到流血或中毒分支，确保错误施加的诅咒不会因计时burn立即递减而假绿。该fixture只验证既有 `dealt > 0` 门，不修改敌人AI。

Checkpoint测试真实执行 `serialize → restore`，恢复同序enemyDefs和encounterId，不重新选择阵容。真实 `buildEncounter → openBattleCell → battle opts` 链也覆盖group身份、elite先行和奖励种类元数据；选择器不提交奖励。

## 隔离QA

打开：`/@fs/D:/素材/代号柒/搜打撤/docs/previews/r7a-encounters/index.html`。页面只加载真实Cards、BattleSession、BattleView及白名单ports，不加载main或经济订阅者。两个按钮各从固定50HP/4攻/两张初始攻击重开样本；点击/拖动初始攻击到目标，再点“结束回合”。“退出样本”后可重新选择同组测试另一顺序。背包、奖励和玩家档未接入；页面在加载 Cards/Battle 模块前采集真实 localStorage 基线，状态栏只报告“存储快照未变化/检测到变化”，不把前后相等冒充写入次数。

QA宿主会把正式BattleView渲染出的“背包”“设置”按钮明确置灰，并在UI action注册层将两个回调替换为隔离提示，避免点击或程序触发进入未接线入口；正式BattleView未修改。

这不是普通出征平衡样本，也不覆盖玩家档。正式随机选取由buildEncounter集成测试证明，QA只验真实战斗UI和两种击杀顺序。

## Friday根验收

IAB四种顺序均已操作：L2先射手45HP/无状态，先机动兵40HP/无状态；L4先灼热45HP/毒1/burn0，先滋生35HP/burn1。截图与日志取自第二玩家回合；各次重开/退出正常，存储快照均未变化。QA素材为占位，仅证真实view输入和规则后果，不作为正式美术验收。

根亲跑首轮7文件51/51；最终补丁两文件5/5，IAB另复核未接线按钮确实disabled。护甲全挡使用旧检查点恢复的明确15甲fixture，固定status随机为非burn分支，真实敌方回合后HP50/甲0、没有附加状态。未改AI，不把该fixture当普通2能量出牌流程。

## 验证命令

```powershell
npx vitest run tests/r7a-encounter-selector.test.js tests/r7a-scenes-integration.test.js tests/r7a-battle-orders.test.js tests/r7a-qa-host.test.js tests/r7a-qa-live.test.js tests/r3-a-preview.test.js tests/r3-0-command-guards.test.js
```

