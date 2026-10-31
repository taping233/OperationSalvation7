# Unity 移植交接文档（2026-09-06 凌晨，协调者 → 下一会话）

## 一、项目在哪、是什么

- **Unity 工程**：`D:\素材\代号柒\SoudacheUnity`（独立 git 仓库，尚未首提）
- **源项目（只读参照）**：`D:\素材\代号柒\搜打撤\game`（1.2 万行 JS 网页游戏）
- **环境**：Unity 6000.3.23f1 已装在 `D:\Unity\6000.3.23f1`（Unity Hub 已装）；.NET 8 SDK 8.0.424（`C:\Program Files\dotnet`）；Newtonsoft dll 在 `_thirdparty\Newtonsoft.Json.dll`
- **规划文档**（全在 `_planning\`）：`00-contracts.md`（总契约）、`01-architecture.md`、`02-data-assets.md`、`03-ui-surface.md`、`asset-map.md`（资源映射）、`TODO-contracts.md`（各 agent 缺口记录）

## 二、架构（已定，勿改）

- 7 个 asmdef：`Sdt.Core`（纯逻辑，noEngineReferences）→ `Sdt.Narrative`（ink 运行时+服务，纯逻辑）→ `Sdt.Run`（流程/存档/基地/音频）→ `Sdt.View`（棋盘）→ `Sdt.UI`（全部界面）→ `Sdt.Boot`（组装根）。另有 `Sdt.Res`（Resources.Load 封装）。
- UI 全代码构建（UIKit 生成器），唯一场景 `Assets/Scenes/Bootstrap.unity`。
- 资产已按 `00-contracts.md §7` 落位 `Assets/Resources/`（210 文件/74.3MB）；字体 4 个已入库；ink C# 运行时 34 文件在 `Sdt.Narrative/InkRuntime/`。
- 官方 ink 运行时零改动可用；W4 的 NarrativeService 冒烟 10/10 PASS。

## 三、编译验证方法（金标准脚手架）

```bash
cd /d/素材/代号柒/SoudacheUnity
python _planning/tools/compile-check.py          # 全部 8 个 csproj
python _planning/tools/compile-check.py Sdt.UI   # 单个
```
- 原理：按 asmdef 生成 net8.0 csproj（`_planning/tools/ccbuild/`），引擎 API 引 `D:\Unity\6000.3.23f1\Editor\Data\Managed\UnityEngine\*.dll`，uGUI 用源码垫片（AssemblyName=UnityEngine.UI 骗 IVT，排除 TMP/InternalBridge/AssemblyInfo，剥 [xHelpURL] 行与 `MarkDirty();` 行，补 DisplayInternal 桩——已稳定）。
- **当前状态：8/8 全绿（2026-09-06 凌晨，全部编译错清零）**。错误清单刷新方法：`dotnet build _planning/tools/ccbuild/Sdt.UI.csproj -v q --nologo -p:RestorePackages=false | grep "error CS" > _planning/tools/ccbuild/outui.txt`（注意 compile-check.py 重新生成 csproj 后才会收录新文件）。

## 四、【已完成 2026-09-06】原 84 个编译错清零

修法记录：共享 API 落地在 commit `c61738b`（PendingLoot/BattleRequest.PreDamage/CardLibrary 自定义卡存取 sdt-cards-v1/OpenHub/便签三 API/FoeSnapshot.Intent/DeckCardEntry 别名）；UI 侧按 A（卡牌 Misc）/B（Hub+Menu+DepartPrepScreen 新屏）/C（Run 屏，任务包 `_planning/tasks/C-run-screens.md`）/D（Battle/Bag/Notes/Title/BossPack）四组并行修完。

真源参照（先 grep 确认再改）：CardLibrary（Cards.cs+CardsExtras.cs：SHA/POTION/RESTORE/Price/ShopWeights/FindById/FindByName/IsSellable/RarityOf/SellPrice/ClassPool/RandomClassCard(Rng,cls)/Classes/CardBacks）；BaseData（BagCap/SafeCap/StashCap/StashRoom/StashUsed 全是属性；coins 小写；IsCollected(CardDef)；IsSha 是 static）；MetaProgress（PerkText/IsUnlocked 是 static，IsUnlocked 要 (def, Base)）；GameRules 全 static（PlayerMaxHp/DiceSides/BagMax/BagUpgradeWood/StashMax/StashUpgradeWood/SafeMax/SafeUpgradeRations）；SceneCopy 成员是 `SCENES/CLASS_STORY/EVENT_SCENE_META/PRELOAD_SCENES`（都是 KeyValuePair[] 数组，无 TryGetValue——UI 用 Find/KV 循环）；BattleRequest 字段（Foes/IsBoss/Layer/Name/Risk/Strategy/ReturnTo，**无 PreDamage——EventDialogScreen 的 goldhammer preDamage=5 要加字段或走 ApplyEventChoice**）；RunState.pendingEventLoot 是 object（W3 在 GameRuntime:1143 用了元组 `(text, chests)`——建议在 Sdt.Core.RunState.cs 定义 `PendingLoot{Text,Chests}` 类型替换）。

各簇：
1. **CardDatabase.X→CardLibrary.X**：RarityOf(2)、RandomClassCard（签名 (Rng,cls)，用 GameRuntime.I.Rng）、Potion→POTION、Upsert/Remove（**需在 CardLibrary/Sdt.Run 加自定义卡存取**——查 SaveSystem global.json 是否已有 customs 键，没有就加）
2. **GameRuntime.OpenHub(tab) 缺失**（ExtractScreens 4 处）：加 `public void OpenHub(string tab = null) => Bus.Emit(new HubOpened { Tab = tab });`
3. **BattleView API 签名**：`BattleEvents.cs` 的 AegisBlocked/AffixMeta 与 `BattleFx.cs:177 Show` 把 BattleFoe 换成 FoeSnapshot（UI 只有快照；FoeSnapshot 已有 PascalCase 别名 Dead/Name/Hp/Atk/Status）；BattleScreen 232/541 随之通过。补 FoeSnapshot.Intent 别名。
4. **DeckCardEntry.Card/Uid 别名**（BattleSubpages 3 处）：BattleSession.cs 的 DeckCardEntry 加别名（我已在同文件加了一排，照抄格式）。
5. **int?→int 实参**（CardFace 113/115、CardDesigner 197/201/202/222、ImportExport 121/125）：加 `?? 0`；CardDesigner:103 int?→byte 加 `(byte)`。
6. **bool?→bool**（BossPackCleanup 85）：`== true`。
7. **GameObject↔Transform**：UIKit 已加 GameObject 重载全套；剩余反向（MakeBtnRow(card.transform)→card；BuildPool(root.transform)→root 已改；ImportExport MakeArea 若形参 GameObject 就传 root）逐点修。
8. **MenuDialogs**：233 `var btn` Button→GameObject 类型冲突（看行改 var）；366-376 abandon 闭包自引用（照 Chk 的 `Button btn = null; btn = UIKit.Btn(...)` 模式重构）。
9. **NodeModals 102-103**：102 C#9 推断委托→显式 `Action`/`Func`；103 `.Count` 方法组（真源数组是 C# 数组用 `.Length` 或 List）。
10. **HubScreen**：190 行内联 `fcHl.wrapEnabled = true;`（HorizontalLayoutGroup 没有此属性，删除）；335/504 残留 `R.` 变量（前批已删 `var R = GameRules;`，把 R.Member 补全成 GameRules.Member）；412/419 `IsUnlocked(def)`→`IsUnlocked(def, Base)`；**205 引用 DepartPrepScreen 不存在——需新写出征整备屏**（对照源 game.hub.js renderDepartPrep：带卡 stepper +/-、selMode 三模式 standard/deep/night？照源码、调 GameRuntime 存档 selMode）。
11. **ClassChoiceScreen 122** PerkText 静态化；**ExtractScreens 53** `Base.IsSha`→`BaseData.IsSha`；72/203/209 StashCap() 属性化；210 `Base.Coins`→`Base.coins`；159/175 DepositCards 实参 PocketStack 类型转换（看 BaseData.DepositCards 签名适配）。
12. **BagCardDetail 149/158** AddItem(string)→`GameRuntime.I.AddItem(MapData.Items[名])`。
13. **CardLibraryScreen**：59 `IsCollected(c.name)`→`IsCollected(c)`；112/169 方法组 `.Count`（数组 Length）；196 `del` 闭包自引用（同 8 的模式）；209 Remove→CardLibrary.Remove（先补实现）。
14. **CardDesigner 376**：`InputField.onValueChanged.AddListener((Action<string>)h)`→`new UnityEngine.Events.UnityAction<string>(h)`；310 缺 `using Sdt.Run;`。
15. **FireRestScreen 34**：RandomClassCard 补 Rng 实参。
16. **EventDialogScreen**：45 `SceneCopy.EventSceneMeta.TryGetValue`（KVP 数组→写个本地 Find 辅助）；123 PendingLoot 未定义（见上，定义后本文件 `new PendingLoot{...}` 可用）；125/129 isBoss→Request.IsBoss。
17. **SlotPickerScreen 31/144/150**：变量作用域/闭包自引用，照 8 模式。

## 五、编译绿之后还欠的活（功能缺口，非编译）【2026-09-06 更新】

1. **~~HubScreen 5 页签移植~~ 已完成**（复查确认：BuildDeploy/Stash/Upgrade/Classes/Ach 均有完整内容，出发按钮已接 DepartPrepScreen）。唯一小缺口：BuildAch 卡背图鉴 TODO（CardLibrary.CardBacks 表已就位，缺 BaseData 卡背解锁存取）。
2. **~~战斗接线~~ 主体已完成**（2026-09-06）：`Sdt.Boot/BattleViewApi.cs`（读侧门面，E 包）+ `Sdt.Boot/BattleBridge.cs`（GameBattleHost 宿主桥 / BattleCommands 写侧 / BattleRequested 消费含 PreDamage 一击制敌 / 快照事件 Core→UI 转发），GameBoot.Awake 挂 Install()。
   **剩余 TODO(战后结算)**：真源 `game.bag.js:509 game.onBattleEnd(opts, playedUids, win, consumedUids)` 移植——流程已侦察：① toPocket：非 BOSS 战的 playedUids + (非 BOSS 或未胜) 的 consumedUids 从 ownedCards 移除进 usedPocket（战斗内临时卡自动跳过），日志文案照抄；② 撤退(win!==true)：清 bossCleanupPending/pendingEventLoot → returnTo='altar' 回祭坛 else Phase=idle+SaveCurrent；③ 胜利：日志（BOSS「首脑已击破」/普通「战斗胜利」）→ bossCleanupPending=isBoss → Meta.Track('kill',...) 逐敌 → pendingEventLoot 事件奖励（items→AddItem，chests→真宝箱）→ Chests.rollDrops(opts) 掉宝箱 → 开箱后 BOSS 走 bossCleanup 整理页、普通战 settle。GameRuntime 地基已全（usedPocket/ChestTable/AddXP/Track/OpenAltar 系），缺 Chests.rollDrops/open 的 C# 等价与 UI 开箱屏、RunState 缺 spellPower 字段（现按 0）；BattleSession 的 spellCost1/granted 未入快照（BattleViewApi 内有标注）。
3. **App.Launch 接线检查**：UI 屏的 Open/Show 入口与 Bus 事件对照（战斗已接，事件/商店/火堆等其余节点屏的开屏路径待逐一过）。
4. **AudioService 接线**：BGM 双通道淡入淡出 W3 已写，UI 各屏音效 key 对照 `asset-map.md`。
5. **W2 卡牌数勘误**：实为 228 主卡 + 14 图鉴（245 是侦察期旧数，源码为准），`02-data-assets.md` 与契约 §3 的 245 需更新。
6. **~~真编辑器冒烟~~ 已通过（2026-09-06）**：`Unity.exe -batchmode -projectPath ... -quit -logFile` 返回码 0，0 error 0 warning，7 个 Sdt 程序集全部产出（UguiShim 是脚手架垫片，真编辑器由引擎内置 uGUI 替代，符合预期）。日志存档 `_planning/tools/editor-smoke.log`。注意：本机原有 Hub 是 Unity 中国版（管团结引擎许可证），国际版 6000.3.23f1 需国际版 Unity Hub 激活 Personal 许可证后才可 batchmode。

已完结：~~notes 三 API~~（Wave 0）、~~git 首提~~（36fdaf1）、~~84 编译错~~（8/8 绿，c61738b+f60ddb1）。

## 六、经验教训（下个会话少踩坑）

- 本机 bash 写文件有静默丢字节问题：**改文件一律用 Edit 工具或 python io**，别用 bash heredoc 写含 `\` 的内容（`p.split('\\')` 在 heredoc 里必炸）。
- 子代理通道时好时坏：限额 5 小时一刷（整点）、BigModel 风控 captcha（客户端过验证码或等冷却）、start-plan 并发=1。派单前先发探针。
- 侦察 agent（Explore）是只读的，报告由主 agent 落盘。
- 编译驱动的集成顺序：先 Sdt.Core→Narrative→Res→Run→View（这些已绿，别碰坏），再 UI→Boot。
- 文案/数值移植铁律：逐字照抄源码，禁止润色；每文件头 `// ported from src/xxx.js`。
