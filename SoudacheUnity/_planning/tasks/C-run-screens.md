# 任务包 C：Sdt.Run 屏 7 文件编译错清零（给并行会话）

> 2026-09-05 由主会话（Friday）签发。主会话同时在改 Sdt.UI 其他文件，**你只许动本包列出的 7 个文件**。
> 前置依赖（CardLibrary/OpenHub/PendingLoot/便签 API 等）已在 commit `c61738b` 落地并推送工作区，直接用即可。

## 背景速览

- 工程：`D:\素材\代号柒\SoudacheUnity`（Unity 6000.3.23f1 移植，源参照 `D:\素材\代号柒\搜打撤\game\src\`，12k 行 JS）
- 目标：Sdt.UI 的 Run 目录 7 个文件编译错清零（当前全工程 6/8 绿，仅 Sdt.UI/Sdt.Boot 挂）
- 编译验证由**主会话统一跑** `python _planning/tools/compile-check.py`（并发跑会撞 ccbuild 的 obj 目录，你**禁止**跑它，也**禁止**任何 git 写操作）
- 改文件一律用 Edit 工具（本机 bash 写文件有静默丢字节坑）
- 文案/数值铁律：逐字照抄源码，禁止润色；不要顺手重构/格式化

## 你拥有的文件（只许改这些）

```
Assets/Scripts/Sdt.UI/Screens/Run/ShopScreen.cs
Assets/Scripts/Sdt.UI/Screens/Run/ExtractScreens.cs
Assets/Scripts/Sdt.UI/Screens/Run/EventDialogScreen.cs
Assets/Scripts/Sdt.UI/Screens/Run/NodeModals.cs
Assets/Scripts/Sdt.UI/Screens/Run/SceneTransitionScreen.cs
Assets/Scripts/Sdt.UI/Screens/Run/PickupScreen.cs
Assets/Scripts/Sdt.UI/Screens/Run/ClassChoiceScreen.cs
```

## 已就位的 API（Wave 0，勿重复造）

- `CardLibrary`（Sdt.Core 静态类）：`POTION`（CardDef）/`RarityOf(card)`/`RandomClassCard(Rng rng, string cls)`/`Upsert(CardDef)`/`Remove(string id)`/`All()/FindById/FindByName`
- `GameRuntime.I.OpenHub(string tab = null)`：已存在，发 HubOpened 事件（ExtractScreens 的 4 处 OpenHub 报错应已消失，不用再修）
- `PendingLoot { public string text; public string[] chests; }`：已在 Sdt.Core.RunState.cs 定义（小写字段，EventDialogScreen 里 `new PendingLoot{...}` 原样能编译）
- `BattleRequest` 新增字段 `public int PreDamage;`
- `GameRuntime.I.Rng`：`Sdt.Core.Rng` 实例（RandomClassCard 第一实参用它）
- `GameRuntime.I.AddItem(ItemDef tpl, int n = 1)`：只收 ItemDef，不收 string
- `MapData.Items`：`Dictionary<string, ItemDef>`，键 wood/rations/key，`ItemDef.name` 是中文名（"木材"等）

## 逐文件修法（编译错 → 期望写法）

### ShopScreen.cs（2 处）
- 73 行 `CardDatabase.Potion` → `CardLibrary.POTION`
- 214 行 `!o.safe`（OwnedCard.safe 是 `bool?`）→ `o.safe != true`

### ExtractScreens.cs（8 处）
- 53 行 `B.IsSha(o.card)` → `BaseData.IsSha(o.card)`（static，Sdt.Run 内直接类名调用）
- 72/203/209 行 `B.StashCap()` → `B.StashCap`（属性，去掉括号）
- 209 行 `B.CollectionCount` → `B.collection.Count`（collection 是 `Dictionary<string,CollectionEntry>`，图鉴数）
- 210 行 `B.Coins` → `B.coins`（小写）
- 159/175 行 `B.DepositCards(new[]{ new PocketStack{...} })` → 形参是 `IEnumerable<StashStack>`，改 `new StashStack{ card = s.card, count = take }`（StashStack 字段同名 card/count，Sdt.Run.BaseData.cs:11）

### EventDialogScreen.cs（6 处编译错 + 1 处语义）
- 45 行 `SceneCopy.EventSceneMeta.TryGetValue(card.id, out var m)`：SceneCopy 的成员全是 `KeyValuePair<>` 数组、没有 TryGetValue。写本地小辅助或内联：`SceneCopy.EVENT_SCENE_META`（类型 `KeyValuePair<string,string>[]`），find `kv.Key == card.id` 取 `kv.Value[2]`，找不到回落 `"scene-event-custom"`。注意成员名大小写：真名是 `EVENT_SCENE_META`（全大写）
- 125/129 行 `new BattleRequested { isBoss = ..., name = ..., preDamage = ... }` → 嵌套写法：
  ```csharp
  new BattleRequested { Request = new BattleRequest { IsBoss = false, Name = "掠夺者" } }
  ```
  goldhammer 那条带 `PreDamage = 5`。**语义补强**：Foes 别留空——参照 GameRuntime.cs 的 bandits_fight 分支（约 1145-1156 行）用 `MapData.Monsters["bandit"]` + `GameRuntime.I.ScaledEnemy(...)` 构建 5 人 gang 赋给 `Foes`；goldhammer 用其分支同款敌人构建（该分支约 1157-1180 行）。不懂就保持 Foes 默认空表（编译优先，行为由接线层兜）
- 147 行 `void AddItem(string name, int n) { GameRuntime.I.AddItem(name, n); }` → GameRuntime.AddItem 只收 ItemDef：
  ```csharp
  void AddItem(string name, int n)
  {
      var tpl = System.Linq.Enumerable.FirstOrDefault(MapData.Items.Values, v => v.name == name);
      if (tpl != null) GameRuntime.I.AddItem(tpl, n);
  }
  ```

### NodeModals.cs（5 处）
- 102 行 `var bosses = GameRuntime.I.AltarBosses;` → `AltarBosses()` 是**方法**，补括号
- 103 行随 102 修复自然消失（`.Count` 报错是方法组连锁）
- 132 行 `new BattleRequested { isBoss = true, returnTo = "altar", name = b.name }` → `new BattleRequested { Request = new BattleRequest { IsBoss = true, ReturnTo = "altar", Name = b.name } }`（祭坛 BOSS 的 Foes 由接线层按 bossIndex 构建，留空即可）

### SceneTransitionScreen.cs（4 处）
- 40/50 行 `SceneCopy.Scenes` → 真名 `SceneCopy.SCENES`，且是 `KeyValuePair<string,SceneDef>[]` 数组，没有索引器/ContainsKey：
  - 40 行 `if (!SceneCopy.Scenes.ContainsKey(kind))` → find `SCENES` 里 `kv.Key == kind`，找不到才 `onDone?.Invoke(); return;`
  - 50 行 `var f = SceneCopy.Scenes[_kind];` → 同样 find 取 `kv.Value`（可复用一个本地静态辅助方法）
- 55 行 `SceneCopy.SceneMeta.TryGetValue(_kind, out var meta)` → 成员不存在。用 `SceneCopy.PRELOAD_SCENES`（`KeyValuePair<string,string>[]`，key=场景 kind，value=Art/Scenes/ 下文件名）find `_kind` 取 value 赋给 `asset`

### PickupScreen.cs（2 处）
- 36/46 行 `SceneCopy.Scenes[kind]` → 同上，`SCENES` 数组 find 取 `SceneDef`（36 行取 `f.icon/f.title`，46 行取 `f.lines`——`lines` 是 `string[]`，用 `.Length`）

### ClassChoiceScreen.cs（2 处）
- 122 行 `GameRuntime.I.Meta.PerkText(lv)` → `MetaProgress.PerkText(lv)`（static）
- 185 行 `CardDatabase.RandomClassCard(cl)` → `CardLibrary.RandomClassCard(GameRuntime.I.Rng, cl)`

## 完成标准（验收）

1. 上述 7 文件的全部编译错按本包修法处理完，未引入新错误、未动任何其他文件
2. 改动语义对齐真源（`src/game.hub.js`/`src/game.run.js` 等对应用法），文案一字未改
3. 每处改动如需注释，用中文行尾注释、与文件现有风格一致
4. 完成后向老板汇报：改动文件清单 + 每处一行摘要；**不要**自己跑编译、不要 git 操作（主会话统一验证后反馈残错，若有残错你再修第二轮）
