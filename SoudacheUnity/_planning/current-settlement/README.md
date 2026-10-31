# 20/21 当前撤离整理、终局回执与离开菜单

当前源的正式入口和实际导入链已迁入；完成未提交，等待Root统一原生窗口与其他会话独立复验。未启动Unity、未操作前台、未写共享编译目录。原生运行期间先只写本目录草稿，结束且独立战斗图审查回报后才部署生产。

## 当前接线

- `game.run.altar.js` → `extraction.commands.js` → `extraction-rewards-view.js/extraction-stash-update.js`：完整整理/完成两页；原地保留卡面与滚动位置，已入库与其他去向折叠，待复原牌可查看详情。完成时剩余卡牌走同页独立确认、可滚动逐项丢失清单，失败保持页面与原候选。
- 新撤离候选按原始ID、variant与ID缺省名称生成sourceKey；同名变体分开。按稀有度与按估值分别排序，同优先级保持背包原序；按实际实时仓容部分入库，不以旧索引误写另一张。命令复核sourceKey、档位与结算身份。
- 消耗区每张精确使用 `Rng.Random("pocket")`，无purpose；成功率1/3，原始成功/失败结果固化到回执，不在刷新/重试重掷。成功但属于初始攻击/职业的牌另记规则损失。只折入散装木材与口粮，随身币和其他散装物资保留散失说明。
- 撤离开始原子发一次经验，公式 `floor((20 + 首探数×2)×xpMul + .5)`；读取现有Meta唯一发奖入口，不重复实现第二套发奖。growth固化前后等级/XP、实际可用/溢出经验与升级结果。完成前先计算真实savedCards、netTake、未入库/消耗区损失、关键散失牌与memento，再持久化最终结果；完成不会先清空候选而把所有牌误记成已入库。
- 死亡沿既有安全格/安全珍珠盒保护；死亡首探经验为0，终局熟练度+5单列。放弃排除带入牌与战斗已消耗牌，不发死亡奖励。死亡保留逐张抢运清单，放弃可视清单按身份合并、不按名称混变体。三条终局都保留持久化回执与重放，不重复扣牌/发奖。
- `menu-leave.js`：四主动作「继续游玩/设置/生存指南/保存并退出」，放弃在独立次级入口，另开确认页。保留原页面/战斗实例与焦点，设置/指南返回原系统菜单；Esc沿同一返回守卫。保存与结果跳转失败留页；标题先构建成功再释放原场景，失败不先丢弃对局或结算页。
- 撤离成功页只保留「返回基地」；死亡「回基地/再出发」分别接deploy/departure；放弃结果「回基地/回主菜单」。所有结果展示读取同一receipt，跳转不再次结算。

## Root接口

`Sdt.Run.SettlementBattleReview`：`round/isBoss/foes/hits/coverage`；foes元素 `SettlementBattleFoe{name,hp,maxHp}`，hits元素 `SettlementBattleHit{source,damage}`。`DoDeath(SettlementBattleReview review=null,string reason=null)` 深拷贝写 `DeathResult.Receipt.battleReview/endReason` 与 `SettlementRecord.receipt`。实际有摘要则显示末回合敌人和承伤归因，无摘要只显示来源规定的明确fallback；coverage未提供就空，不编造覆盖范围。Core/Boot采集与RunEnded后的战斗复位由Root接入。

## 最小共享补丁

- `MenuDialogs.cs`仅替换LeaveMenuScreen/AbandonResultScreen两个类，未修改Achievements/Settings/反馈段。
- `GameRuntime.cs`仅增加ExtractResult/DeathResult/AbandonResult必要字段。
- `SaveSystem.cs`仅追加SettlementRecord字段；读写、HasReadError和原子文件机制不归本片修改。
- 完整独占 `GameRuntime.Settlement.cs`、`ExtractScreens.cs`，新增CurrentExtraction/Settlement/Leave组件。没有引入Agent或启用研究/其他死分支。原失败横幅仅无损解码，`asset.json`记录原图/导入SHA与pixelExact。

## 验证与未核边界

私有固定副本全编译0错误、7条既有警告，日志 `private-check/latest.log`。当前JS源生成 `source-vectors.json`，实际C#命令/投影执行36条断言通过，见 `behavior-check/latest.log`；覆盖原pocket流6次逐值一致、sourceKey空variant回退、同名歧义拒绝、稳定估值序/稀有度序、部分入库、开始/入库/完成/死亡失败回滚、真实回执、重复终局、MAX经验、摘要深拷贝与无卡清单拒绝放弃。

行为执行使用正式 `GameRuntime.Settlement.cs/CurrentSettlementReceipt.cs/Rng.cs`，管理态harness提供原子失败边界和基地/存储替身；此证据不冒充本机磁盘或Unity实机验证。生产仍调用已有TryPersistMutation/SaveSystem原子事务，沿Root已有验证；本轮未另测真实磁盘写失败。

原生布局、卡牌点击/滚动/焦点、独立确认返回、失败留页、真实Boot死亡摘要与跨局重进仍交Root集中验收。Source/production冻结SHA见 `source-sha256.json` / `receipt.json`。

附：本会话独立只读审查了非本域实现的current-visual-6战斗和卡片样本，证据在 `../migration-1029/current-effect-review/review6-battle-settlementagent.json`。自己的HUD/20/21不在该独立验收范围。
