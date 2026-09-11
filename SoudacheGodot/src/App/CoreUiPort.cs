using System;

namespace SoudacheGodot.App;

/// Adapter seam for the future Soudache Core. UI consumes snapshots, never Core rules or card models.
public interface ICoreUiPort
{
    event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    event Action<RunUiSnapshot>? RunSnapshotChanged;
    event Action<SaveSlotsUiSnapshot>? SaveSlotsChanged;
    void RequestPlayCard(string cardId, string? targetId, string[] infusionFuelIds);
    void RequestEndTurn();
    void RequestPileView(string pileKey);
    void RequestStartRun(string characterId);
    void RequestRollDice();
    void RequestRunAction(string actionId);
    void RequestBaseAction(string actionId);
    void RequestSaveSlot(int slot);
    void RequestLoadSlot(int slot);
    /// <summary>清空存档槽（接口需求 [6b→A]：选档页「覆盖重开/删除」用；对照网页 game.menu.js clearSlot）。</summary>
    void RequestClearSlot(int slot);
    void PublishCurrentState();
}

public sealed class BattleUiSnapshot
{
    public string CharacterId { get; init; } = "shuangling";
    public int Turn { get; init; }
    public int Energy { get; init; }
    public int MaxEnergy { get; init; }
    public int DrawPileCount { get; init; }
    public int DiscardPileCount { get; init; }
    public int ExhaustPileCount { get; init; }
    public int PlayerHp { get; init; }
    public int PlayerMaxHp { get; init; }
    public int PlayerBlock { get; init; }
    public int EnemyHp { get; init; }
    public int EnemyMaxHp { get; init; }
    public int EnemyBlock { get; init; }
    public string PlayerTargetId { get; init; } = "player";
    public BattleEnemyUiSnapshot[] Enemies { get; init; } = Array.Empty<BattleEnemyUiSnapshot>();
    public string StatusText { get; init; } = "";
    public string[] HandCardLabels { get; init; } = Array.Empty<string>();
    public string[] HandCardIds { get; init; } = Array.Empty<string>();
    public int[] HandCardInfuseCounts { get; init; } = Array.Empty<int>();
    public string[] HandCardTargetKinds { get; init; } = Array.Empty<string>();
    /// <summary>
    /// 战斗音效信号（接口需求 [7a→A]，对照 _planning/audio-inventory.md §3）。
    /// 引擎在结算时产生 sound.js 同名键（parry/curse/strike/card/flee/hit/hurt/heal/victory/defeat…），
    /// UI 侧逐个 GameAudio.PlaySfx(key) 后清空；hit/hurt/heal 可继续沿用现有 HP 变化推断，二者并存。
    /// </summary>
    public string[] SfxRequests { get; init; } = Array.Empty<string>();
}

public sealed class BattleEnemyUiSnapshot
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "敌方目标";
    public int Hp { get; init; }
    public int MaxHp { get; init; }
    public int Block { get; init; }
    public int Attack { get; init; }
    public bool Defeated { get; init; }
}

public sealed class RunUiSnapshot
{
    public string CharacterId { get; init; } = "";
    public string CharacterDisplayName { get; init; } = "";
    public int LayerIndex { get; init; }
    public int TrackPosition { get; init; }
    public int CurrentHp { get; init; }
    public int MaxHp { get; init; }
    public int TrackLength { get; init; }
    public int LastRoll { get; init; }
    public int Coins { get; init; }
    public int Keys { get; init; }
    public int Wood { get; init; }
    public int Rations { get; init; }
    public int Stamina { get; init; }
    public int MaxStamina { get; init; }
    public int BackpackUsed { get; init; }
    public int BackpackCapacity { get; init; }
    public int BaseWood { get; init; }
    public int BaseRations { get; init; }
    public int BaseKeys { get; init; }
    public int BaseCoins { get; init; }
    public int SafeCapacity { get; init; }
    public int StashUsed { get; init; }
    public int StashCapacity { get; init; }
    public string Phase { get; init; } = "准备";
    public string CurrentRoom { get; init; } = "营地";
    public string StatusText { get; init; } = "请选择角色开始远征";
    // —— 接口需求 [6b→A] 对局 HUD 快照字段（批次 4b）——
    /// <summary>当前环层显示名（批次 3 LayeredMap/LayerNames：第 N 层 · 层名）。</summary>
    public string LayerName { get; init; } = "";
    /// <summary>近 8 次掷/移动记录（网页 ui.js diceHistory.slice(-8) 的 chips；掷骰停用后记录移动落点序号）。</summary>
    public int[] DiceHistory { get; init; } = Array.Empty<int>();
    /// <summary>当前攻击力（rules.json playerAtk，网页 game.atk；战斗伤害 = 卡面值 + 攻击力）。</summary>
    public int Atk { get; init; } = 4;
    /// <summary>宝藏大门钥匙需求（rules.json keyNeeded，网页 base.js KEY_NEEDED；替代 UI 硬编码 10）。</summary>
    public int KeyNeeded { get; init; } = 10;
    public string[] InventoryLabels { get; init; } = Array.Empty<string>();
    public RunActionUiSnapshot[] Actions { get; init; } = Array.Empty<RunActionUiSnapshot>();
    public MapNodeUiSnapshot[] Nodes { get; init; } = Array.Empty<MapNodeUiSnapshot>();
    /// <summary>事件面板快照（批次 4c）：仅 Phase=事件 且已抽卡时非空；UI 据此渲染事件页（intro+选项+effect 元数据）。</summary>
    public EventUiSnapshot? Event { get; init; }
}

/// <summary>
/// 事件页快照（批次 4c，对照网页 nodeShell(tone:'event') 事件面板）：
/// intro 正文与选项全部来自 data/narrative-events.ink.json（InkEventCatalog 打开的结点），
/// Effect 为选项隐藏的 @@effect=@@ 元数据（落地映射在 RunState.ApplyEventChoice），
/// UI 只消费快照、不解析 ink。无 ink 结点的事件卡（修鞋铺等）只有单个「继 续」选项。
/// </summary>
public sealed class EventUiSnapshot
{
    /// <summary>事件卡 id（tt6-goldmine / cmtn7qttxqo4 等）。</summary>
    public string EventId { get; init; } = "";
    /// <summary>事件卡名（事件页标题，网页 nodeShell title=card.name）。</summary>
    public string Title { get; init; } = "";
    /// <summary>开场叙事（网页 narrative.intro；无结点事件为空串）。</summary>
    public string Intro { get; init; } = "";
    public EventChoiceUiSnapshot[] Choices { get; init; } = Array.Empty<EventChoiceUiSnapshot>();
    /// <summary>修鞋铺复原子流程进行中（展示消耗口袋复原列表）。</summary>
    public bool RestorePending { get; init; }
    /// <summary>消耗口袋中可复原的卡名（道具/装备除外，网页 FIRE_RESTORABLE 口径）。</summary>
    public string[] RestorableCards { get; init; } = Array.Empty<string>();
    /// <summary>事件面板是否挂起（镜像开箱挂起；挂起中拒绝选项操作）。</summary>
    public bool Suspended { get; init; }
}

public sealed class EventChoiceUiSnapshot
{
    /// <summary>玩家可见选项文本（@@ 元数据不泄漏，ChoiceMetadataParser 保证）。</summary>
    public string Label { get; init; } = "";
    /// <summary>选项说明行（@@detail=@@）。</summary>
    public string Detail { get; init; } = "";
    /// <summary>色调标记（@@tone=@@：ok/danger 等，UI 配色用）。</summary>
    public string Tone { get; init; } = "";
    /// <summary>落地效果键（@@effect=@@：goldmine_safe/bandits_fight/continue 等）。</summary>
    public string Effect { get; init; } = "";
}

public sealed class RunActionUiSnapshot
{
    public string Id { get; init; } = "";
    public string Label { get; init; } = "继续";
    public string Detail { get; init; } = "";
    public bool Enabled { get; init; } = true;
}

public sealed class MapNodeUiSnapshot
{
    public int Index { get; init; }
    public string Type { get; init; } = "unknown";
    public string Label { get; init; } = "未知";
    public bool IsCurrent { get; init; }
    public bool IsResolved { get; init; }
    // 四层节点图几何（批次 6c 地图渲染用）：网格坐标与同层相邻节点
    public int X { get; init; }
    public int Row { get; init; }
    public int[] Neighbors { get; init; } = Array.Empty<int>();
}

public sealed class SaveSlotsUiSnapshot
{
    public SaveSlotUiSnapshot[] Slots { get; init; } = Array.Empty<SaveSlotUiSnapshot>();
    public string StatusText { get; init; } = "";
}

public sealed class SaveSlotUiSnapshot
{
    public int Slot { get; init; }
    public bool Exists { get; init; }
    public string Summary { get; init; } = "空档位";
}
