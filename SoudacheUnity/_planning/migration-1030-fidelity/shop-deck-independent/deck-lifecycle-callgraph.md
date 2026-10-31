# Boss编组：active调用链、可触发条件与最小修法

2026-10-30，独立只读分析。未改生产代码，未运行Unity/构建/浏览器。

## 结论

**已证实的是lastDeckSel实例生命周期不同，生产可达性尚未证实。** 先前把core flee(null)等同玩家按钮的复现已撤回；Boss实战界面明确禁撤退，结构化flee道具也禁Boss。当前标准玩家流程不能据此列P2。开战装备trim/recheck在Native缺失，但普通点击已有新增装备上限，同样未找到生产自然生成超额选择的路径。

## 源码真实生命周期

1. `game/src/battle/core/battle.core.js:27` 在ESM模块顶层调用一次configureBattleEngine。全src没有第二个调用点。
2. `battle.engine.js:104–111` → `createDefaultBattleContext` → `battle.default-context.js:1,18` 显式绑定 `runtime.default.js:4` 的单个defaultBattleRuntime。
3. `runtime.factory.js:56` 只在runtime创建时初始化lastDeckSel=[]；全src只有 `lifecycle.domain.js:472` 在成功beginBoss时更新它。start/resetBattleEntryState/finish均不清空它。
4. 下一次manual首脑入口 `lifecycle.domain.js:416–424` 重新生成可用池，继承仍在池的lastDeckSel UID，按装备栏裁剪，再裁剪总容量。
5. 真实地图入口 `game.run.altar.js:635` 仅传{isBoss:true,name}。directBossStart只有game/dev夹具使用，当前生产不应新增自动编组流程。

## Native调用链与可见后果

`CurrentBossGateScreen.Begin` → `GameRuntime.TryBeginBossGate` → FightBoss/BattleRequested → `Sdt.Boot/BattleBridge.OpenPreparedBattle:394` 每次new BattleSession。

`BattleSession.lastDeckSel:243` 是实例私有列表。PrepareDeckSelection:474虽读它，BeginBoss:527也写它，但下一次new Session后没有注入；Snapshot.DeckSelection只在编组时存在，CaptureCheckpoint在over后返回null，均不能直接代替旧编组导出。

**玩家复现审计更正**：`battle.view.js:654–658` 的btFlee在Boss直接拒绝；`battle.bag.domain.js:69–72` 不提供永久道具，`:107–111` 对文本/结构化flee均禁止Boss。cancelDeck发生在beginBoss前，未写lastDeckSel；Boss胜负均终局。没有找到标准玩家“已写lastDeckSel后不终局并再次进入Boss”的路径。仅用dev/core连续start-flee可构造语义差异，不当作生产复现。若后续检查Nest/扩展入口，须单独证明可达性。

## 若未来需要恢复该契约的最小方案（非当前修复建议）

- 给既有BattleSession导出只读LastDeckSelection（复制/只读视图，不暴露可变私有列表）。
- 在既有BattleStartContext增加可选previousDeckSelection，Start按输入复制到现有lastDeckSel，再复用PrepareDeckSelection已有UID过滤。Boot每次创建新Session（包括normal）前，从旧BattleViewApi.Session导出并传入，避免普通战把记忆截断。
- 注意现有Boot在RunStarted/RunLoaded/RunEnded会清Session；按上条直接导出会保留Native原有读档清记忆差异。Web没有这些清lastDeckSel操作，只有新runtime初始化。若要求严格同源，在Boot或GameRuntime保留仅UID列表的进程内transient buffer，成功Confirm更新，不随RunLoaded清；每次候选池过滤失效UID。无需新增存档字段或重用整个战斗Session。真实checkpoint恢复仍以checkpoint.selectedDeck为本场权威，不让previous覆盖它。
- 恢复旧编组时，复用现有IsBattleStartEquipment/EquipmentCapacity，按旧选择插入顺序裁剪超额开战装备；BeginBoss再检查selectedStartEquipCount>EquipmentCapacity返回拒绝，仍停留编组。不能只在UI门槛上补。

## 装备边界的真实证据限制

Source `lifecycle.domain.js:437–440` 与Native `BattleSession:497` 均在新增选择时拦装备栏超额；battleActive期间两端都拒绝普通背包，所以不能声称玩家能在编组中丢弃圣剑化身来降低容量。当前Native生产新Session不继承旧seed，正常点击也无法生成超额集合。

开战装备实际进入consumed；结算从owned移出。复原生成新UID（source newUid；Native GameRuntime.cs:986），因此“上场3装备仍原UID、丢容量卡、下场自动继承3件”也不是已证实的自然复现。缺失trim/recheck是代码契约差距和未来补carry的必要防线，当前不单独标P2。

## 定向验证建议

若未来生产存在可重复首脑入口，再验证连续Session继承、普通战夹在两Boss入口之间、旧选中UID移入stored/pouch或已消耗时过滤；seed超装备容量按顺序trim，宿主容量在准备后变化时Confirm拒绝；移出混沌之眼后总张数超max拒绝；checkpoint.selectedDeck不被旧记忆覆盖。当前不把直接Core操作记为玩家验证。
