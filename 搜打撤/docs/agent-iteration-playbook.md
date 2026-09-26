# Agent 策略迭代手册（ML 式方法论）

> 2026-09-26 定版。核心思想：把"调策略"从拍脑袋改成**假设→配对实验→统计判决→早停/上位**的闭环，
> 借机器学习的固定测试集、配对显著性检验、消融、过拟合防护、实验跟踪五件套，
  解决前四轮（R1-R4）的两个痛点：**seed 方差淹没信号**（撤离率 2-4% 抖动分不清好坏）
 * 与 **在调参集上过拟合**（R4 火堆强偏好在训练分布有效、换批即回退）。

## 0. 术语与文件

| 角色 | ML 对应 | 本项目实体 |
|---|---|---|
| 样本 | 一局游戏 | 一个 seed（决定地图/掉落/战斗全链路） |
| 测试集 | held-out set | 固定 seed 底：`--seed-base N`，第 i 局 seed=N+i |
| 模型 | policy | `agent.policy.js` 的 strategic 分支（greedy=v1 冻结对照） |
| 损失 | 多指标标量 | 撤离率↑ 均层↑ 带出价值↑ 弃局率↓（弃局>5%=硬约束直接毙） |
| 显著性检验 | paired t-test | 符号检验（`agent-compare.mjs`，按 seed join 逐局胜负） |
| 实验跟踪 | MLflow/W&B | `output/agent-ledger.jsonl`（`agent-ledger.mjs add/list`） |

## 1. 两个 seed 底（T/V 分离，防过拟合）

```
T 调参集：--seed-base 77001  （假设筛选、调参、消融都在这里）
V 验收集：--seed-base <另定，迭代若干轮后轮换> （只有过 T 显著的候选才许跑）
```

- **规则：任何假设先在 T 上做配对；V 只用于终验；连续 3 个 promote 后轮换 V 的 seed 底**
  （防止策略对 V 过拟合——ML 的 test set 泄漏防护）。
- 可复现性已验证：同 seed 底三跑，**排除首局后 19/19 逐局全同**（outcome+层+行动+价值四元组）。
  **首局是冷启动噪声（19/20→三跑仅首局漂移），一律作 warm-up 丢弃，不进统计**。

## 2. 单轮迭代协议（一轮 ≈ 15-30 分钟）

```
1. 假设    从弃局 trace/死亡分桶/停因分布里来，一句话写清"改什么、为什么该有效"
2. 实现    只改一个变量（消融原则：一轮一个操作点，改多了归因就废）
3. T 配对  跑两遍同 seed 底（challenger vs 当前 champion），各 40-100 局
           npx vite-node game/tools/agent-batch.mjs --runs 40 --policy strategic \
             --seed-base 77001 --out output/agent-exp-<名>
4. 判决    node game/tools/agent-compare.mjs <challenger> <champion>
           p<0.05 且方向正 → 进 V 验收集；否则早停丢弃（省算力，ML early stopping）
           弃局率>5% → 直接毙，不看 p 值
5. V 终验  过 T 的候选换 V seed 底再配对一次，V 也显著才 promote
6. 记账    agent-ledger.mjs add --exp rN --hypothesis "..." --p ... --verdict ...
```

### 为什么配对（而不是比裸均值）

同一 seed = 同一张地图、同一批掉落、同一场战斗——**策略是唯一变量**。
裸均值下 40 局的撤离率噪声约 ±3-4%，2-4% 的改进根本看不见；
配对后逐局相减，演示实验（strategic vs greedy）**40/40 配对、赢24输3平13、p<0.0001**，
而 greedy 的 47.5% 弃局里 19 局被配对精确捕获为 `abandon→death` 转移——
信号全在逐局差里，裸均值（2.5% vs 0%）看着什么都不是。

## 3. 实验设计三原则

1. **一轮一变量（消融）**：R1-R4 的教训是 R4 一次加了火堆强偏好+扫图条件化+甲门，
   回退了说不清谁的锅。要归因就只改一个操作点。
2. **对照冻结（baseline）**：greedy=v1 永久冻结对照组；champion 每次 promote 后冻结进台账，
   新候选永远跟"现任"比，不跟历史最好比（防 cherry-pick）。
3. **早停（early stopping）**：T 不显著就不进 V；弃局硬约束不过直接毙。
   绝不"再跑一轮看看"——那是过拟合的开始。

## 4. 搜索策略（改哪里、按什么顺序）

优先级从高到低（R1-R4 数据支撑：新操作点 >> 调参）：

1. **补操作面**（最高杠杆）：从死亡/弃局分桶里找"有动作没用上"的场景
   ——R3 的背包回复+护甲线是先例：撤离 3%→4%、弃局 10→6 一次到位。
2. **修根因（bug 类）**：弃局 trace-lite 现场 → 修熔断/口径/死锁——这类不看 p 值，
   是正确性修复不是策略假设，修完直接换 champion。
3. **消融验证**：给 champion 加新点后，反向去掉它跑一轮——确认贡献是真收益（ML ablation study）。
4. **调参**（最低杠杆）：阈值/权重微调。R2 教训：纯保守化调参撤离 3%→2%，方向错了还费算力。
   调参只在前面三类用尽后做，且必须过配对。

### 搜索空间参考（strategic 策略的可调维度）

- 血线门：fire/shop/battle/door 各自的 hpRatio 阈值（0.45/0.5/0.75 档）
- 评分权重：各节点类型 base、fwd、backtrack、forceProgress
- 战斗：喝药威胁线（60%）、AOE 加权（1.7×）、护甲成本门（挡3/挡7）、砸击时机
- 整备/商店/事件：留位数、留币数、eventScore 权重

## 5. 数据分析系统的指标口径（已在 agent.stats 聚合）

- 结局：clear/extract/death/abandon（abandon 单列——它是质量信号不是策略失败）
- 深度：均层、死亡层分布（`deathByLayer`）
- 产出：带出价值分布与均值、`topCards`
- 效率：avgRunMs、avgStepMs、maxStepMs（**单局>1s 必查因——老板 09-26 规矩**）
- 切片：按职业/模式/驱动（driver）分组

## 6. 当前基线（2026-09-26 迭代 r1-r9 后，ledger r9v）

- **champion = strategic（R3 + 弃局修复 + 耗时优化 + 修根因①-⑦）**
- T 集（77001 起 40 局）：撤离 52.5%、弃局 2.5%、均层 2.90，vs 旧 champion p<0.0001（赢29输1）
- V 集（88001 起 40 局）：**40/40 全收局零弃局**、撤离 50%、均层 3.1，vs greedy p<0.0001（赢37输0）
- 弃局历史：55%（机制未建时）→ 6（R3）→ 0（100 局）→ 根因修复后 T 1 / V 0
- **耗时口径（r9 查因结论）**：V 集 2191ms/局，高于 r7 的 1407ms——不是单步变慢
  （分阶段步耗 map 5ms / overlay 10ms / battle 16ms 与前版持平），而是**局更深了**：
  局均步 144→185、局均战斗 6→8（赢面变大 → 打得更久更远）。按阶段分桶
  `record.phaseMs`（批跑内建）可随时复核。

### 修根因清单（r1-r7，全部走"修根因通道"非调参）
1. **intentDamage 字段错位**：引擎 intent 是 `{kind:'strike', damage, hits}`，策略读 `type!=='attack'` 恒返 0 → flee/护甲门/威胁喝药三处保命全失效（flee 0/120 局触发）
2. **fledNodes 惩罚够不着**：检查写在 base 分支，已访格 seen 行提前返回绕过 → 逃→绕回死循环；改为 seen 前判 0 分
3. **seen 短路滞环解锁**：整层踏完门也是 seen(2 分)，door 解锁/forceProgress 在 base 分支够不着 → 出口豁免（只 door/extraction 滞环时落完整打分）
4. **fled 0 分墙反噬**：唯一通路穿过 fleeing 格时死锁（血 14% 无药）→ 滞环时解锁 fled 惩罚
5. **同格连逃死循环**：extraction 被 boss 锁、boss 战必逃、逃出资源耗尽 → 决死规则（同格只逃一次，death 2 分 > abandon 0 分）
6. **extraction 锁判定**：bossKilled=false 时终局撤离点 95 分勾着反复撞门被拒 → 判 -100 让位给 boss/altar
7. **协议白名单漏砸击三件套**：bagSlam/resolveSlam/resolveDart 动作面与引擎 commands 都有，
   白名单独漏 → 334 次 BATTLE_COMMAND_UNKNOWN，砸击（省卡核心操作）整条链路走不通。
   补齐后 T 集撤离 25%→52.5%（单根因最大涨幅）——**动作面覆盖度要靠 trace 实测计数审计，
   不能只看"动作面定义了"**

## 6.5 架构升级三件套（2026-09-26 第二阶段，ledger r12+/e*）

老板拍板路线：**向量化 + ES 进化 + 2步前瞻**。落地与判决：

1. **权重向量 `game/src/agent/agent.weights.js`**（✅ 完成）
   - 打分卡 36 个标量抽成 `base/gate/geo` 三维向量 W，DEFAULT 与原字面量逐值相等
   - **γ=0 等价验证 40/40 平**（行为保持的机械重构标准：配对全平才算过）
   - v1 greedy 对照组继续用字面量冻结（否则 ES 调 W 会污染基线）
   - 注入通道：`agent-batch --weights <file|json>` → `globalThis.__SDT_AGENT_WEIGHTS` 深合并

2. **2步前瞻**（❌ 按数据判丢弃，方法论完整走了一遍）
   - 假设：`value(a) = score(a) + γ·max邻居score`，替代贪心单步
   - γ=0.5：撤离 52.5%→35%、弃局 20% → **硬约束毙**
   - γ=0.2 加样本：p=0.20 不显著 → **早停丢弃**
   - 过程中修掉 2 个真根因（前瞻放大暴露的）：①邻居视角继承滞环解锁→门虚高
     （scdbg: score=2 → value=17.8）②回浅层门滞环放行→两层门横跳（cur=1:0 连续4次）
   - 教训：**新决策规则会放大旧打分的隐性缺陷——先修放大暴露的根因，再判新规则**

3. **ES 进化器 `game/tools/agent-evolve.mjs`**（✅ 冒烟+正式跑）
   - 黑盒优化：扰动 W（σ=0.15 按叶子量级缩放）→ 固定 seed 底评估 → top2 精英均值 → σ×0.85 衰减
   - fitness = 撤离×100 + 均层×10 + 通局×50 − **弃局×200**（硬约束内化成罚项）
   - 根因常数冻结区（`FROZEN_KEYS`：geo.ban / base.extractLocked）——修根因产物不许被进化腐蚀
   - 每代个体明细自动追加 ledger（exp=e*）；产物 `best-weights.json` 可回注 batch
   - 冒烟实测：1 代 baseline 30% → 最优 50%（10局仅验机制，判决必须 T 配对+V 终验）

## 7. 实验记录与待办（2026-09-26 更新）

已完成（全在 ledger）：
- r10/r11/r11v：**断链修复**——协议补 openBackpack 开包入口 + 丢卡链
  （open→discard→close）+ 卖卡加可售门槛 + 容量口径统一 usedSlots（堆叠口径）
  + 修 runBrief 缺失 deck 投影（chest 降分/整备预算恒错分支）。
  T 40/40 平无回退、价值 113→115；V 40/40 零弃局 39平1赢。
- r12+：架构①向量化（γ=0 等价 40/40）、②2步前瞻（判丢弃，顺带修 2 根因）、
  ③ES 进化器（e* 系列）。

待办：
1. ES 世代结果需 T 配对 + V 终验才可 promote（fitness 高≠显著）
2. R9 残余的战斗 noop 卡死（VITEST 演出归零后未复现）——留观察，复发走修根因通道
3. 死亡主力层仍 2/3，下个操作点假设从死因分桶继续挖
