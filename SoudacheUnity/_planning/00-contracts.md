# 00 · Unity 移植总契约（所有 writer agent 必读必守）

工程：`D:\素材\代号柒\SoudacheUnity`（Unity 工程，git 独立）
源项目（只读参照）：`D:\素材\代号柒\搜打撤\game`
侦察报告：`_planning/01-architecture.md`（模块清单/依赖）、`_planning/02-data-assets.md`（数据/资产）、`_planning/03-ui-surface.md`（界面清单）。

## 0. 全局技术决策（不许改）

- **Unity 6 LTS（6000.x）**，**内置渲染管线**（Built-in，不上 URP），2D 游戏。
- **C# 9 / .NET Standard 2.1**（Unity 6 默认）。JSON 用 **Newtonsoft**（Unity 官方包 com.unity.nuget.newtonsoft-json，Sdt.Core/Sdt.Narrative 禁用 JSON 库——纯数据用生成代码）。
- **UI 全部 C# 代码运行时构建**（不写 prefab/.unity 序列化资产），由 UIKit 辅助库承担（对应原版 innerHTML 模式）。唯一场景 Bootstrap.unity 只挂一个 GameBoot。
- **静态数据用生成的 C# 类**（245 卡牌等），运行时数据（存档）用 Newtonsoft JSON 文件。
- **美术/音频放 `Assets/Resources/` 下按路径表引用**（Resources.Load），不用 Addressables。
- 相机/输入/主循环：Unity `Update` 可变步长，`dt = Mathf.Min(0.05f, Time.deltaTime)`，相机跟随 lerp 系数 `dt*5`（对齐原版 game.boot.js loop）。RenderScheduler 丢弃。
- 3D 场景（src/scene/）已停用，**不移植**。Pixi 点击粒子、sortablejs、motion 库**不移植**，效果用 C# 自写缓动/粒子。

## 1. 程序集与目录所有权（严格边界，只写自己名下目录）

```
Assets/Scripts/
  Sdt.Core/          → W1（纯逻辑，禁用 UnityEngine）
    Sdt.Core.asmdef  (name: Sdt.Core, noEngineReferences: true, 无引用)
  Sdt.Core/Data/     → W2（生成的静态数据 .cs，W1 不得改这里）
  Sdt.Run/           → W3（对局流程/存档/基地/音频服务；可用 UnityEngine/Newtonsoft）
    Sdt.Run.asmdef   (引用 Sdt.Core, Sdt.Narrative)
  Sdt.Narrative/     → W4（ink C# 运行时 + NarrativeService；禁用 UnityEngine）
    Sdt.Narrative.asmdef (引用 Sdt.Core)
  Sdt.View/          → W5（地图棋盘渲染/相机/输入/特效）
    Sdt.View.asmdef  (引用 Sdt.Core)
  Sdt.UI/            → W6 UIKit+框架+标题+Hub / W7 局内+战斗+背包+图鉴（见 §6 子目录切分）
    Sdt.UI.asmdef    (引用 Sdt.Core, Sdt.Run, Sdt.Narrative, Sdt.View)
  Sdt.Boot/          → 协调者（GameBoot 组装根 + Res 资源加载 + 场景）
    Sdt.Boot.asmdef  (引用全部)
```

- 通用规则：**不改别人文件**；发现契约缺口写到 `_planning/TODO-contracts.md`（追加，注明自己 agent 编号），等协调者裁决。**不写 .meta、不写 prefab、不建场景。**
- 命名空间 = 目录（`Sdt.Core.Battle`、`Sdt.UI.Screens`…）。文件名 PascalCase.cs，一文件可多类。

## 2. Sdt.Core 公共契约（W1 实现，全体引用）

```csharp
namespace Sdt.Core {
  // random.js → Rng.cs：可播种、可序列化状态的随机服务（mulberry32 或照抄原算法）
  public sealed class Rng {
    public Rng(int seed); public int Next(); public int Next(int maxExclusive);
    public double NextDouble(); public void Shuffle<T>(IList<T> list);
    public string SaveState(); public void LoadState(string state);
  }
  // rules.js → GameRules.cs：静态数值常量（照抄 RULES 对象所有字段，保留中文字段注释）
  // mapData.js → MapModel.cs：三环棋盘 + buildNodePositions 极坐标布局（确定性，同 seed 同布局）
  public enum NodeKind { Coin, Wood, Battle, Event, Shop, Fire, Chest, Rations, Key, EmergencyExit, Door, Altar, Boss }
  public sealed class MapNode { public string id; public NodeKind kind; public int ring; public float x, y; public int layerIdx; /* + 原版其余字段 */ }
  public sealed class MapModel { public IReadOnlyList<MapNode> Nodes; public IReadOnlyList<string> Layers; public static MapModel Build(int seed); }
  // combat.js → CombatResolver.cs：TYPES/TYPE_NAME、伤害结算（attack/spell/fixed/true 四 dmgType）
  // chests.js → ChestLoot.cs：物资箱掉落表与抽取
  // game.store.js → RunState.cs：对局状态（字段=存档 schema §5 全集）+ CreateRunState 工厂
  // characters.js → CharacterTable.cs（含 LEGACY 迁移映射）
  public sealed class CharacterDef { public string id, name, rulesetId, visualId, color, tag, bg, task, role; public int skin, hair, outfit; public float scale; }
}
namespace Sdt.Core.Battle {
  // battle.core.js → BattleSession.cs：状态机+命令，零 Unity 依赖
  public sealed class BattleSnapshot { /* 手牌/牌堆/能量/意图/单位血盾甲/阶段，对齐 getSnapshot() 全字段 */ }
  public sealed class BattleSession {
    public BattleSnapshot Snapshot { get; }
    public void Start(BattleStartContext ctx);   // ctx: 敌人组、玩家卡组/血量/遗物等（照原 start 参数）
    public CommandResult PlayCard(string cardId, int targetIndex, bool infused);
    public CommandResult EndTurn(); public CommandResult Retract(); /* 撤退 */
    public bool TryGetUnplayableReason(string cardId, out string reason); // battle.rules.js
  }
  // battle.effects.js → EffectExecutor.cs（splitEffectClauses 语义照抄）
  // battle.deck.js → DeckOps.cs（refillDrawPile/shuffleCards）
}
```
- **验收**：`csc` 纯 .NET 编译零错误零警告（协调者跑）；selftest.js 里与逻辑相关的断言翻译成 `#if SDT_SELFTEST` 静态断言方法（不强求跑）。

## 3. Sdt.Core/Data 生成物（W2）

用 node 脚本（放 `_planning/tools/`，源项目可 `npm ci`）在 **源项目目录** 里 stub `window/localStorage` 后 import `src/cards.js`、`characters.js`、`game.run.data.js`、`mapData.js`、`generated/narrative-events.js`，dump 生成：
- `CardDatabase.cs`：`public static readonly IReadOnlyList<CardDef> All`（245 条全字段；CardDef 字段=原版：id,name,cost,rarity,type,dmg,dmgType,draw,infuse,heal,armor,desc,value,sellable,unrandom,cls,hero,art；含 BESTIARY 14 条单独列表 `Bestiary`）。另导出 `HeroArt`/`ArtKey` 常量映射（卡面图 key）。
- `SceneCopy.cs`：SCENES（13 节点类型的 icon/title/tone/btn/lines）、CLASS_STORY、EVENT_SCENE_META、PRELOAD_SCENES。
- `Resources/Data/NarrativeEvents.json`：ink JSON 原文（从 generated/narrative-events.js 的 `export default` 后剥出）。
- **验收**：生成脚本可重复运行（幂等）；CardDatabase.cs 条数=245+14；json 以 `{"inkVersion":21` 开头。

## 4. Sdt.Run 契约（W3 实现）

```csharp
namespace Sdt.Run {
  public sealed class GameRuntime {           // 全局单例（替代 game.session 的 game + configureGameRuntime hooks）
    public static GameRuntime I { get; }
    public RunState State { get; }            // null = 无对局
    public BaseData Base { get; }             // base.js：背包/安全仓/出售/扩建数据
    public MetaProgress Meta { get; }         // meta.js：统计/成就
    public EventBus Bus { get; }
    public Rng Rng { get; }
    public SaveSystem Saves { get; }          // 5 槽位
    public void NewRun(int slot, string characterId); public bool LoadRun(int slot);
    public void SaveCurrent();                // 快照对齐 §5 schema
    // session.js/run.js 非视觉流程：掷骰/移动/进格结算/撤离/死亡（返回结构化结果给 UI 呈现，不碰 UI）
    public RollResult Roll(); public NodeResult EnterNode(NodeKind kind);
    public ExtractResult DoExtract(); public DeathResult DoDeath();
  }
  public sealed class EventBus { public void On<T>(Action<T> h); public void Emit<T>(T e); }
  // 音频：sound.js → AudioService（Bus 之外也允许 UI 直接调用）
  public sealed class AudioService { public static AudioService I;
    public void PlayBgm(string key); public void PlaySfx(string key); // key 表见 §7 路径
    public void SetMusicVolume(float v01); public void SetSfxVolume(float v01); public void Mute(bool m); }
}
```
- 事件清单（Bus 用，UI/View 订阅）：`RunStarted, NodeEntered(kind,id), BattleRequested(BattleStartContext), ShopOpened, ClassChoiceOpened, HubOpened(tab), BagOpened, SaveCompleted(slot), RunEnded(win/dead/abandon), ToastRequested(text)` 等——按源码实际 hook 点补全，新事件记入 TODO-contracts.md。
- **验收**：对 game.session.js 逐函数核对：掷骰移动、trackPos/layerIdx 推进、撤离入库、死亡清档、elapsed 计时语义一致；存档 JSON 字段与 §5 完全一致。

## 5. 存档 schema（与网页版键对齐，写进 `Application.persistentDataPath/sdt/slot{n}.json`）

顶层字段（原样保留键名）：`seed, rngState, layerIdx, trackPos, hp, maxHp, coins, turn, atk, mode, myClass, characterId, inventory, ownedCards, cardOrder, usedPocket, eventLog, discovered, diceHistory, elapsed, slot, savedAt`。
另全局文件 `sdt/global.json`：卡库改动 `sdt-cards-v1`、基地 `SDT.Base.data`、成就/统计、设置（音量/静音/横幅/便签 sdt-cell-notes-v1）、留言 `sdt-suggestions-v1`。**键名不改**，方便日后从网页版迁移存档。

## 6. Sdt.UI 契约（W6/W7，目录切分）

```
Sdt.UI/
  Kit/          → W6：UIKit、Theme、Res 绑定、UiStack、Panel、Tooltip、HelpSystem、IconText([[icon:]])
  Screens/Menu/ → W6：标题/选档/设置/快速参考/成就/留言箱/退出告别
  Screens/Hub/  → W6：基地 5 页签 + 出征整备
  Screens/Run/  → W7：选角/节点过场/转场/拾取/事件对话(ink)/门·祭坛·撤离弹窗/营火/商店
  Screens/Battle/ → W7：战斗全 UI（含 BOSS 编组/发现/墓地子页）
  Screens/Bag/  → W7：背包（拖拽/翻面/安全格）+ 详情/丢弃/BOSS 整理
  Screens/Misc/ → W7：notes 编辑器、卡牌图鉴、制作坊、导入导出
```
```csharp
namespace Sdt.UI.Kit {
  public static class UIKit {
    public static GameObject Panel(string name, Transform parent);                 // 全屏 Panel，锚满
    public static Button Btn(Transform parent, string label, Action onClick);     // ov-btn 风格
    public static Text Label(Transform parent, string txt, int size, Color? c=null);
    public static Image Image(Transform parent, Sprite s);                        // slice/cover 按 Theme
    public static GameObject Row(Transform parent);  public static GameObject Column(Transform parent);
    public static GameObject Grid(Transform parent, int cols, Vector2 cell, Vector2 gap);
    public static GameObject Scroll(Transform parent);                             // 内容根可继续挂
    public static Text IconText(Transform parent, string sdtRichText);            // 解析 [[icon:x]] → 图文混排
  }
  public static class Theme { /* winter.css 色表：Ink #101E27、AkMint #A9EFC3、退出朱红 #A02020→#701616、血条蓝金红… */ public static Font Mono; public static Font Sans; }
  public abstract class Panel : MonoBehaviour { public abstract void Build(); protected void Close(); }
  public sealed class UiStack { public void Push(Panel p); public void Pop(); public bool Blocked { get; } }
}
```
- 每个 Screen 一个类、一个 `Build()` 重建（对应 innerHTML 重绘），按钮回调走方法路由（对应 data-act）。
- **验收**：对照 03 报告逐界面核对元素/文案/交互/键盘快捷键（Space 掷骰、B 背包、N 编号、Esc 关闭、G/F/Q/E 镜头）；样式按 Theme 色表，不写死杂色。

## 7. Resources 路径表（W8 落位，全体按此引用）

```
Art/Portraits/Cut/{id}.png        11 职业抠图立绘（cut/classes；expedition-roster 合影切条，x 区间见 art.js/asset-map.md）
Art/Portraits/CutEnemies/{id}.png 14 敌人抠图立绘（cut/enemies，含 dragon）
Art/Scenes/{key}.png|.webp        17 场景图（12 webp + 5 png；Resources.Load 去扩展名）
Art/Cards/{key}.png               类型大图 + hero-* + resource- 前缀 12 张（共 36）
Art/Icons/{node}.png              12 结点图标
Art/Ui/{name}.png                 60 小图标（与 icons-bitmap.js NAMES 一一对应）
Art/Title/…、Art/Hub/…            标题背景/杂项（wallpaper、hub-bg、icon-council 等）
Audio/Bgm/bgm-black-stream-sea.mp3、bgm-sour-orange-earth.mp3
Audio/Sfx/{click|rollover|switch}{n}.wav；Audio/Sfx/Battle/{27 个 ogg}（sfx 键 camelCase 如 chestShake，文件名全小写；详见 asset-map.md）
Fonts/CascadiaMono.ttf、CascadiaMono-Bold.ttf、NotoSansSC-Regular.ttf、NotoSansSC-Bold.ttf（已落位）
Data/NarrativeEvents.json
```
命名冲突时在文件名前加目录语义（如 `Art/Cards/resource-key.png`），并记入 TODO-contracts.md 供引用方对齐。

## 8. 写作规范

- 禁止：`UnityEngine` 进 Sdt.Core/Sdt.Narrative；`PlayerPrefs`（存档一律文件 JSON）；协程做流程控制（用 async/await 或事件）；反射。
- 注释只写行为约束（对齐原版哪个文件哪个函数），中文，不写"我改了什么"。
- 每个移植文件顶部一行：`// ported from src/xxx.js`。
- 文案（中文台词/按钮/提示）必须逐字照抄源码，不得润色。

## 9. 越界与求助

- 契约缺口/歧义 → 追加 `_planning/TODO-contracts.md`（格式：`## W{n}: 问题 | 建议方案`），继续做不阻塞的部分。
- 绝不修改：源项目任何文件、他人目录、Assets/Scripts/Sdt.Boot/、_planning/00-contracts.md。
