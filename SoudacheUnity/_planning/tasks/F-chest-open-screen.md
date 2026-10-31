# 任务包 F：开宝箱 UI 屏（ChestOpenScreen，全新文件零冲突）

> 2026-09-06 主会话（Friday）签发。与所有在途任务零冲突（只新建一个文件）。
> 前置契约 `Sdt.Core/Chests.cs` 由主会话**同轮实现**（见下），你直接调即可；若调用时提示类不存在，说明主会话还没提交该文件，先写你的屏幕、编译自查时跳过 Chests 相关行或用 TODO 占位，主会话合并时统一验证。

## 背景

- 战后掉落/事件奖励会产生宝箱列表（kind 串），需要逐个开箱的浮层 UI。真源：`D:\素材\代号柒\搜打撤\game\src\chests.js`（150 行，`render()/next()/takeAll/chestPick/scheduleRevealSfx`）。
- 数据契约已在 Core：`MapData.ChestKinds`（字典：small 小型物资箱 / medium 密封物资箱(3选1) / large 军用保险柜 / boss 首脑保险柜；字段 name/icon/cards/pickFrom/coinsMin/coinsMax/coinCards/tokenChance）、`MapData.LayerChests`（掉落表，主会话的 RollDrops 用，你不用管）。
- 收下动作的 C# 门面：`GameRuntime.I.GrantCard(CardDef)`（返回 bool）、`GameRuntime.I.GainCoins(int)`、`RunLog.Log(text, tone)`。

## 主会话提供的调用契约（已落地：`Sdt.Core/ChestLoot.cs`，直接调）

```csharp
namespace Sdt.Core
{
    public sealed class ChestContents { public string kind; public List<CardDef> cards; public int coins; public bool tokenHit; }
    public static class ChestLoot
    {
        public static ChestContents RollContents(string kind, Rng rng);       // 掷一个宝箱的完整内容
        public static List<string> RollDrops(bool isBoss, int layer, Rng rng); // 掉落 kind 列表（主会话 BattleBridge 已接）
        public static string DropText(IEnumerable<string> chests);             // 掉落摘要富文本
    }
}
```

## 交付物（唯一）

新文件 `Assets/Scripts/Sdt.UI/Screens/Run/ChestOpenScreen.cs`，头注释 `// ported from src/chests.js open()/render()/next()/takeAll()`，要点：

1. 入口签名：`public static void Open(System.Collections.Generic.List<string> kinds, Action onDone)`
   - 逐箱流程：`Chests.RollContents(GameRuntime.I.Rng, kind)` → 展示 → 收下 → 下一箱；全部开完 `onDone?.Invoke()`（对应真源 next()/onDone 链）。
2. 浮层视觉（照 UIKit 现有模态风格，参考 `Sdt.UI/Screens/Menu/MenuDialogs.cs` 的 MakeOverlayCard 与 `BagCardDetail` 布局；真源是「悬在当前画面上的紧凑面板」，不要整屏黑底）：
   - 标题：`[[icon:archive]] 搜刮！{ChestKinds[kind].name} · 第 {i} / {N}`
   - 摘要行（文案照抄 lootLine 语义）：普通箱 `开出 <b>N</b> 张卡牌 · [[icon:coin]] <b>X</b> 币`；tokenHit 追加 `· <color=金色>[[icon:sparkles]] 金色令牌！</color>`；中宝箱（pickFrom）改为 `从随机 <b>3</b> 张卡牌中选择 <b>1</b> 张 · 另含 [[icon:coin]] <b>X</b> 币`
   - 卡面：`CardFace.Create(card, CardSize.Sm, ...)` 网格（参考 CardLibraryScreen 的网格用法）
3. 交互：
   - 普通箱：按钮 `[[icon:archive]] 全部收下（含 X 币）` → 逐张 GrantCard + GainCoins → 下一箱；空箱文案照抄 `（空的——早被别的拾荒者搬空了……）`（tone dim）
   - 中宝箱：点击一张卡收下（GrantCard + GainCoins），其余两张丢弃 → 下一箱（真源 chestPick 语义，提示行照抄 `点击一张卡牌收下，其余两张散落在风中……`）
4. 音效：开出时 `AudioService.I.PlaySfx("reveal")`，传说卡再 `legend`、史诗卡再 `ding`（对照 `asset-map.md` 确认 key，key 不存在就只播 reveal 或跳过，勿报错）
5. Esc 关闭 = 视为全部收下当前箱剩余卡后继续（或等价合理语义，注释说明）

## 硬性约束

1. **只新建上述一个文件**，不改任何现有文件（CardFace/UIKit/MapData/Chests 都只许调用不许改）
2. 文案/数值逐字照抄源码，禁止润色；中文行尾注释与现有风格一致
3. 编译自查：`python _planning/tools/compile-check.py Sdt.UI` 会重新生成 csproj 收录你的新文件（**跑之前先跟主会话打招呼避免撞车**，或者改完直接汇报、由主会话统一验证）
4. 禁止 git 操作

## 完成标准

1. ChestOpenScreen 编译 0 错（新文件无报错）
2. 逐箱流程完整：标题计数、摘要行、卡面展示、收下（GrantCard/GainCoins）、onDone 续流
3. 完工向老板汇报：文件路径 + 交互摘要 + 任何语义取舍
