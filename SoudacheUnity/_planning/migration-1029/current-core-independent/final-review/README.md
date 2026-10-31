# 修复后独立闭环复核（当前生产快照）

结论：此前15条真实向量独立重跑 **PASS，50项对应状态比较一致**；新增轻量单卡扫描129/291卡（44.3%；129/231含rules卡，55.8%）中122卡投影完全一致，发现5组真实行为差距、影响6张卡。另1张仅状态存储位置不同，不列行为缺陷。因此当前结论为 **原修复闭环PASS，整体迁移仍有新增差异**。

生产严格只读。当前生产Core新冻入本目录snapshot；第一轮及ROUND2旧快照完全保留。JS重新加载现行Cards与真实battle.engine.instance，未复用实施者passed或旧Core快照。每个Core项目编译后显式执行对应DLL，避免同名缓存启动。

## 原修复闭环

- `source-results.json`、`core-results.json`：8条原向量，使用ConfirmRuleHandPayment及真实首脑编组入口。
- `source-round2-results.json`、`core-round2-results.json`：7条原向量，使用SelectRuleTarget与两次PlayCard选敌，保留首脑条件化手牌边界。
- `closure-comparison.json`：15向量、50项比较，pass=true，无差异。覆盖支付、消费触发、当次流血、规则费用、逆鳞反击与抽牌RNG、不朽斩留手/禁燃料、两种多目标交互。

## 扫描方法及停止边界

`scan-source.mjs`从fresh291卡按显式规则准备单卡场景：普通战、玩家HP30/Max60、Atk4/SpellPower2、敌HP1000/Atk2、seed123；能量与上限同时条件化为10，让单卡有足够支付能力。这是合法资源状态的条件化测试，不声称逐局实玩获得该资源值。Core准备相同状态。

仅进入已声明简单onPlay/装备入口，排除需注能/支付、首脑开战装备、复杂获取/发现/释放/召唤/转换/物品等需专项准备的类别；运行中拒绝或等待未准备输入的卡进入skipped，不作为缺陷。逐卡比较HP、能量及上限、甲盾防御、非零数值状态、敌HP/Atk/状态、手牌/牌库/消耗区稳定卡ID/费用/伤害；临时UID按稳定卡身份归一化。6卡另走完整EndTurn验证延迟/回合开始消费者：正午决斗、花瓣法阵、大法师之杖、诅咒之剑、剑仙形态、火焰法杖。没有从同名case推断通过。

`scan-source.json`完整保存129条输入与前后状态、162条跳过原因；`scan-core.json`是真实独立Core结果；`scan-comparison.json`保存精确字段差异。发现下列明确新P1后停止扩展准备，不穷举全部291卡状态空间。发现、卡区组合、复杂装备被动、首脑setup、特定材料和多段联动仍需专项，不能以本轮数量宣称全覆盖。

## 新差异

### F1 P1 沐愈光辉把“回复至12血”当作“回复12血”

tt7-holyglow：同样HP30/Max60，源保持30，Core变42。源 `battle/core/battle.resolution.domain.js:668-674` 根据阈值与当前HP计算差值；Core `snapshot/Battle/StructuredRules.cs:365-370` 用min(upTo, MaxHp-Hp)计算回复量。生命高于12时也能凭空回血。

### F2 P1 满月形态错误补充即时能量

tt3-nature-form：出牌前energy/maxEnergy=10/10，2费后源energy8/max11，Coreenergy9/max11。源 resolution.domain.js:636 调用 `energyCapGrantsCurrent(card)`，`cards/card-energy-policy.js:2` 明确排除本卡即时回能；Core StructuredRules energyCap分支一律同时加energy。

### F3 P1 坚冰结界给未冻结目标新增冰冻

tt3-firm-barrier：目标freeze0，源仍0、抽1牌；Corefreeze1、抽1牌。源 `battle.status-operations.domain.js:99-118` 的extend只延长已有计时诅咒；Core ApplyRuleCurse仅在已有时修改n，但无已有时仍调用AddRuleStatus。

### F4 P1 急行军在错误时点判断末手重放

tt7-marchrush：起手只有本卡，源先抽2后检查当前手牌，因此2甲、2张初始攻击；Core在出牌前缓存lastHand=true，错误再次结算，4甲、4张初始攻击。

源 `battle.exec-play.domain.js:339-359` 在主结算后用当前手牌every(keepsCardInHand)计算lastRealCard；Core BeginRuleCast提前计算lastHand，ResolveStructuredCard重放直接消费该旧值。需要沿实际检查时点迁移，不能只看卡面“最后一张”的自然语言。

### F5 P1 随机诅咒使用了另一种抽取算法和RNG流

tt3-nuke-ray、tt12-infectray，固定seed123且同输入：前者源附加组合含freeze，Core对应变silence；后者源freeze，Corehealban。造成实质控制类型差异，并改变后续随机流。

源 `battle.status-operations.domain.js:65-69` 先排除atkDown，再使用保留的 `.sort(()=>randomBattle()-0.5)` 对整个池排序并取前N；Core StructuredRules randomKinds分支逐个使用rng.Random("target")无放回抽取。此处源代码明确为保持掷骰序列保留既有算法，迁移不应换分布/随机流。具体可复现状态及差异字段在scan-comparison.json。

### 不列缺陷：黑暗形态内部存储位置

cmtn1r10xnl1的discoverPlus源存pstat.status，Core存discoverExtra，后者真实被StartStructuredDiscover使用。本轮原始status投影出现差异，属于映射位置不同；未证明发现选项行为不同，因此不报P1，也不把该卡计作原始投影完全一致。

## 命令与输入证据

本目录依序运行：

1. `node source.mjs`；`node source-round2.mjs`
2. `dotnet build r1/Audit.csproj --ignore-failed-sources -v:q`；`dotnet r1/bin/Debug/net8.0/Audit.dll`
3. `dotnet build r2/Audit.csproj --ignore-failed-sources -v:q`；`dotnet r2/bin/Debug/net8.0/Audit.dll`
4. `node compare-closure.mjs`
5. `node scan-source.mjs`；`dotnet build scan/Audit.csproj --no-restore -v:q`；`dotnet scan/bin/Debug/net8.0/Audit.dll`；`node compare-scan.mjs`

最终全部命令退出0；3个独立Core构建各0错误0警告。scanner允许记录语义差异而退出0，差异结论以scan-comparison.json为准。第一版扫描资源仅设置energy10，现已修正为energy/maxEnergy同为10并重新完成源/Core两进程，差异一致；只采用最终结果。首次未准备等待曾中断，已加入每卡等待边界并重新完整执行。

`inputs-sha256.json`列本轮fresh源677个JS/JSON输入、当前Core快照源码及结果文件SHA256。该审查不替代Root的Unity原生输入与显示验收。后续生产修复需要新快照重跑，当前snapshot是本轮审查时冻结的对象。
