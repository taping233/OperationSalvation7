# 战斗继续对照与优化（2026-11-01）

状态：三项有源码证据的修改已实施，回归源码已补；尚未编译、运行测试或启动 Unity，等待主会话在全部分片收拢后集中验收。上一轮普通选材、真实注能、动态费用、取消/旧回调、音效/图集和原生 fake-null 修复以 `_planning/parity-1031/battle.md` 及主线最终验收为基线，本轮没有重做这些入口。

## 已实施

### 只读身份与目标锁定不构造额外整场快照

来源：`Assets/Scripts/Sdt.Boot/BattleBridge.cs` 的 `OnBattleEnd` 原先两处仅为 `BattleToken` 访问 `session.Snapshot`；`LockPendingTarget` 先读取整场快照，再调用 Core 命令。Core 的 `BattleSession.GetSnapshot` 会同步条件装备、复制手牌/抽牌堆/弃牌/墓地及状态，生成装备/道具投影并运行 `BattleTurnForecast.Estimate`。这些消费者只需要身份或同 UID 目标状态，不需要上述投影。

修改：`BattleSession.BattleToken` 直接读取本场 token；Bridge 的结果演出前后仍同时检查 session 引用与 token。Core 既有 `LockPendingTarget` 对同 UID 的最小条目复制当前待定目标，保留 Kind、BattleToken、SelectionId、ExcludedTargetIndex、支付材料及后续选择，重新读取当前有效卡面。换 UID 时仍清除旧燃料、双方互斗准备及延续；取消/结束语义保持。Bridge 直接提交 UID 条目，删除旧快照分支。

计数依据：有结果演出回调时，单纯身份检查从最多 2 次完整快照降为 0；每次锁定目标在正常渲染订阅下从“预读快照 + RequestRender 快照”2 次降为渲染所需的 1 次。未引入长期快照缓存，不存在需要新失效协议的缓存状态；没有声明实际帧率或耗时收益。

### 变形资格先读原始实体，避免同 UID 二次遍历

来源：现行 Vite `game/src/battle/core/battle.engine.factory.domain.js:645-657` 保证模仿牌从原始实体读取 handTransform，战斗覆写不污染背包。Unity 原 `ApplyHandTransforms` 对每张手牌先 `FindCard` 遍历原始来源并可能创建覆写条目，然后又从 OwnedCards / granted 遍历同 UID，只为取得原规则；即使无变形资格也做这两次查找。

修改：把原始实体查找提取为 Core 私有 `FindSourceCard`，`FindCard` 继续在其结果上应用原有覆写。变形遍历只查一次原始实体，先检查结构化/现行旧卡资格，合格后从已有覆写字典读取前一张展示名并生成独立新卡。删除不可达的 `current?.card` 原始来源回退：原 `FindCard` 也只能从同一 OwnedCards / granted 返回实体，孤立覆写从来不构成来源。

计数依据：H 张手牌的来源查找由约 2H 次降为 H 次；仍是 O(H×(N+T)) 上界（N 为宿主实体数，T 为临时实体数），没有夸大为复杂度阶数变化。原有已覆写条目的临时 OwnedCard 包装在本遍历中不再生成；真正发生的 R 张变形仍各生成一张独立 CardDef。查询没有跨命令缓存，宿主集合新增/移除仍即时可见，随机流、源 UID 和规则优先级不变。

### 真实注能合堆保留原费用，与数字键共用键

来源：Vite `game/src/battle/core/battle.hand.js:8-17` 的分堆身份包含原 `card.cost`；`game/src/battle/view/battle.infusion-material-state.js:5-12` 先按相同身份分组/排序，再展开物理 UID。Unity `BattleHandProjection.InfusionShortcuts` 已包含原费，但 HandPanel 的真实 Infusing 再合堆仅包含 id、desc、当前有效费。

实际条件：相同 id / 卡文的卡牌原费不同，当前因同一战斗规则都为 1 费时，旧可见区把两种卡面身份合并，数字键却保留两个组。输入顺序为“原费3-A、原费1-B、原费3-C”时，正确组序应为 A/C、B，物理键序为 A/C/B；旧可见合堆成为 A/B/C。

修改：`BattleHandProjection.StackKey(CardDef,int effectiveCost)` 统一维护原始身份、原费、卡文、有效费；普通手牌分组、真实注能候选再合堆和数字 UID 投影共用。保持稳定类别顺序、组内 UID 顺序、已选 UID 原键撤回及源 UID 排除。普通 RuleHandSelection 仍逐 UID 原位展示，不使用注能合堆。

## 待集中运行的回归

入口沿用 `_planning/parity-1031/battle-check/BattleChecks.csproj`，没有新建平行测试工程。Program 新增的回归源码覆盖：

- 连续读取身份不读取宿主卡集合；同 UID 锁定保留完整选择身份和延续、使用当前有效卡且不修改旧目标对象，换 UID / 取消清除旧状态。
- 两张同 id、同当前有效费但原费不同的卡保持不同组；相同原费副本保持合堆，物理 UID 键序稳定，源卡和手牌顺序不变。
- 原始 owned 与 granted 的变形来源均生效；每 UID 一次宿主来源查找，无关卡不生成覆写；固定费用/运行时费用清理、独立副本、原卡及玩法随机流保持。

主线还应回归现有 native battle 的普通选材/真实注能、同名 UID 与分页、双方互斗/分段后续目标、战后演出 owner 及保存重试。原费分组可在真实注能中构造同 id 的 3/1/3 原费副本、统一有效费1，核对可见两组与 A/C/B 数字键。当前没有这项新原生结果或实绘结果。

## 边界与残余

本轮只处理上述可达链，没有修改 Vite，没有新增公共 Res/UI/Run 接口，没有删除文件、改变宿主存档规则或增加兼容 wrapper。`BattleToken` 是供主线公共 UI 复用的直接只读接口，Bridge 本文件由本线完成接线。

没有改为全局 UID 索引：宿主集合由外部维护，现阶段引入长期索引会增加一致性要求。本轮保留必要快照渲染及真正独立卡副本。帧动画已有帧身份去重和资源 lease，未为极小的分支清理另行触碰动画路径。编组确认等实际需要完整数据的剩余 Snapshot 调用未按单字段模式替换。

## 最终源码指纹

下表由最终工作区原字节计算；只作实施冻结记录，不代表已经通过集中验收。

| 文件 | 字节 | SHA256（原字节） |
| --- | ---: | --- |
| `Assets/Scripts/Sdt.Core/Battle/BattleSession.cs` | 77869 | `fa507df7d084702904d3f9e186548d681807e99fe822bfa2c11b86868abfe8cc` |
| `Assets/Scripts/Sdt.Core/Battle/BattleHandTransforms.cs` | 1263 | `36b0e0315081d5e57fbee18ab4ef1e73eb6859760cc32ff0d20e8764efe1b032` |
| `Assets/Scripts/Sdt.Core/Battle/BattleHandProjection.cs` | 1652 | `c47394d27519b76454fd32a70505cb6c5f1cedbb43e6ec1e0a0e136c6c9946bb` |
| `Assets/Scripts/Sdt.Boot/BattleBridge.cs` | 24336 | `95142aa2b86b826644049b1c7ba906221834f39f42e25a5eb8e24db64a2dd2f4` |
| `Assets/Scripts/Sdt.UI/Screens/Battle/HandPanel.cs` | 15629 | `a7307393b1d71e4ed36aeca9f27caf401204d367185da1426c36f9f72e363a4b` |
| `_planning/parity-1031/battle-check/Program.cs` | 16785 | `f97cc38bbdd5b031e9a8b20218de945a9fcda97f4cd61d9eb6c1953977563697` |
