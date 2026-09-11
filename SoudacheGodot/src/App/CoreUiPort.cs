using System;
using System.Collections.Generic;

namespace SoudacheGodot.App;

/// Adapter seam for the future Soudache Core. UI consumes snapshots, never Core rules or card models.
public interface ICoreUiPort
{
    public event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    event Action<RunUiSnapshot>? RunSnapshotChanged;
    event Action<SaveSlotsUiSnapshot>? SaveSlotsChanged;
    void RequestPlayCard(string cardId, string? targetId, string[] infusionFuelIds);
    void RequestEndTurn();
    void RequestPileView(string pileKey);
    /// <summary>
    /// 开始新远征。slot = 选档卡槽号（0 基；对照网页 launch(slot)，开局即绑定游玩档位——
    /// 接口需求 [7b→B]：补齐「开新档绑定槽位」信号，纯新档关窗也能强制落盘）。负数 = 不绑定。
    /// </summary>
    void RequestStartRun(string characterId, int slot = -1);
    void RequestRollDice();
    void RequestRunAction(string actionId);
    void RequestBaseAction(string actionId);
    void RequestSaveSlot(int slot);
    void RequestLoadSlot(int slot);
    /// <summary>清空存档槽（接口需求 [6b→A]：选档页「覆盖重开/删除」用；对照网页 game.menu.js clearSlot）。</summary>
    void RequestClearSlot(int slot);
    /// <summary>
    /// 退出前落盘（批次 7b，AppMain 在 WM_CLOSE_REQUEST/设置页退出时调）：
    /// 有在局且已绑定档位则强制写档（绕过稳定落点守卫，对齐网页 beforeunload），否则跳过。
    /// </summary>
    void RequestSaveActiveSlot();
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
    /// 每张手牌的稀有度（批次 5 rider [6c→A]：6c 稀有卡光晕粒子的着色信号，与 HandCardIds/Labels 同序）。
    /// 取自 cards.json rarity 表；目录缺失时退化为空串。
    /// </summary>
    public string[] HandCardRarities { get; init; } = Array.Empty<string>();
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
    /// <summary>宠物页快照（批次 5）：全部宠物定义 + 拥有/等级/携带/升级费用（6b' hub 宠物页消费）。</summary>
    public PetUiSnapshot[] BasePets { get; init; } = Array.Empty<PetUiSnapshot>();
    /// <summary>职业收藏室快照（批次 5）：进度/里程碑/熟练度（6b' 成就·收藏室页消费）。</summary>
    public CollectionUiSnapshot? Collection { get; init; }

    // —— 接口需求 [6b'→A] 批次 8-prep：制作坊/仓库页/图鉴/升级页快照缺口 ——

    /// <summary>彩色令牌碎片计数（game.fragments；对局内累积，制作坊「彩色令牌碎片 N/2」材料行实值；无局=0）。</summary>
    public int Fragments { get; init; }
    /// <summary>
    /// 通行证/令牌栈计数（键=卡 id：tt-token-gold 员工通行证B / tt-token-color 员工通行证A / cmtmvq6ss84l 彩色令牌）。
    /// 口径随上下文（与 6b' 制作坊过渡口径一致）：无局=基地仓库栈，有局=随身背包栈；缺该卡时无键。
    /// </summary>
    public IReadOnlyDictionary<string, int> TokenCounts { get; init; } = ReadOnlyEmptyDict();
    /// <summary>基地卡牌仓库明细行（仓库页 stash 行：meta「N费·类型·职业·收购X币/张」+ 收藏态标记）。</summary>
    public StashItemUiSnapshot[] BaseStash { get; init; } = Array.Empty<StashItemUiSnapshot>();
    /// <summary>基地消耗口袋明细行（仓库页 pocket 行：按稀有度用钥匙复原，pocketKeyCost=整堆所需钥匙）。</summary>
    public PocketItemUiSnapshot[] BasePocket { get; init; } = Array.Empty<PocketItemUiSnapshot>();
    /// <summary>折算钥匙（base.js keyCount = 裸钥匙 + 仓库钥匙卡折算「一串」×2 其余×1；宝藏大门条与物资行的钥匙显示口径）。裸钥匙仍看 BaseKeys。</summary>
    public int BaseKeyCount { get; init; }
    /// <summary>基地背包当前容量（升级页容量条分子；网页 hubUpgradeHTML 的 B.bagCap()）。</summary>
    public int BaseBagCapacity { get; init; }
    /// <summary>基地背包容量上限（升级页容量条分母；RunRules.BagMax）。</summary>
    public int BaseBagMax { get; init; }
    /// <summary>基地安全格上限（分母；当前值=SafeCapacity 随携带宠物变化）。</summary>
    public int BaseSafeMax { get; init; }
    /// <summary>仓库容量上限（升级页容量条分母；当前值=StashCapacity、已用=StashUsed）。</summary>
    public int BaseStashMax { get; init; }
    /// <summary>图鉴收藏态全集（base.js isCollected=data.collection 全量口径，含收藏池外的特殊收藏品/传说卡；排序输出保证稳定）。图鉴点亮与仓库行 ✦ 标记的信号源。</summary>
    public string[] CollectedIds { get; init; } = Array.Empty<string>();

    private static IReadOnlyDictionary<string, int> ReadOnlyEmptyDict() => new Dictionary<string, int>();
}

/// <summary>基地仓库明细行（批次 8-prep [6b'→A]；对应网页 hubStashHTML 的 stash-row）。</summary>
public sealed class StashItemUiSnapshot
{
    public string CardId { get; init; } = "";
    public string Name { get; init; } = "";
    public int Count { get; init; }
    /// <summary>出牌费用（cards.json cost；道具/资源等无费用卡=0）。</summary>
    public int Cost { get; init; }
    public string Type { get; init; } = "";
    public string Rarity { get; init; } = "";
    /// <summary>收藏归属职业（无归属=null）。</summary>
    public string? Cls { get; init; }
    /// <summary>收购价（币/张）。</summary>
    public int SellPrice { get; init; }
    /// <summary>可售判定（cards.json sellable 四级口径；材料卡另有 material 拒卖语义）。</summary>
    public bool Sellable { get; init; }
    /// <summary>已收藏（图鉴 ✦/sparkles 标记；收藏期间卖出被拒）。</summary>
    public bool Collected { get; init; }
    /// <summary>材料种类（wood/rations/keys；null=非材料卡。材料卡 meta=「可使用·每张折入」且不可卖币）。</summary>
    public string? MaterialKind { get; init; }
}

/// <summary>基地消耗口袋明细行（批次 8-prep [6b'→A]；对应网页 hubStashHTML 的 pocket 行）。</summary>
public sealed class PocketItemUiSnapshot
{
    public string CardId { get; init; } = "";
    public string Name { get; init; } = "";
    public int Count { get; init; }
    public string Rarity { get; init; } = "";
    /// <summary>整堆复原钥匙价（base.js pocketKeyCost=稀有度价 古朴1/稀有2/史诗3/传说4 ×张数；动作为 pocket:restore:{名}）。</summary>
    public int PocketKeyCost { get; init; }
}

/// <summary>宠物页条目（批次 5；数据源 data/pets.json + 基地档 pets/petSel）。</summary>
public sealed class PetUiSnapshot
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Desc { get; init; } = "";
    /// <summary>宠物图标名（pets.json icon：paw/runner/coin/tools/fire/crystal；网页 SDT.Art 图标名，批次 8 只读透出）。</summary>
    public string Icon { get; init; } = "paw";
    public bool Owned { get; init; }
    public int Level { get; init; } = 1;
    /// <summary>等级上限（pets.json levelMax=5，网页 PET_LEVEL_MAX；批次 8 只读透出，替代 UI 常量）。</summary>
    public int LevelMax { get; init; } = 5;
    public bool Carried { get; init; }
    /// <summary>升到下一级所需口粮（满级时无意义）；upCosts 递增 2-3-4-5。</summary>
    public int UpgradeCost { get; init; }
    /// <summary>可升级（已拥有、未满级、口粮足够）。</summary>
    public bool CanUpgrade { get; init; }
    /// <summary>已拥有且未携带（可切换携带）。</summary>
    public bool CanCarry { get; init; }
}

/// <summary>职业收藏室快照（批次 5；meta.js collProgress/pendingColl/classSummary 的 UI 视图）。</summary>
public sealed class CollectionUiSnapshot
{
    /// <summary>收藏进度 =「不同」的职业卡 + 能力卡张数。</summary>
    public int Progress { get; init; }
    /// <summary>收藏池总数（职业卡+能力卡，入池=有 cls 且归属五职业）。</summary>
    public int Total { get; init; }
    public CollectionMilestoneUiSnapshot[] Milestones { get; init; } = Array.Empty<CollectionMilestoneUiSnapshot>();
    /// <summary>职业熟练度（收藏转化 +10/+50 的去处；meta.js classSummary）。</summary>
    public ClassProgressUiSnapshot[] Classes { get; init; } = Array.Empty<ClassProgressUiSnapshot>();
}

public sealed class CollectionMilestoneUiSnapshot
{
    public string Id { get; init; } = "";
    /// <summary>达成所需收藏张数（need='all' 时=Total）。</summary>
    public int Need { get; init; }
    public bool Reached { get; init; }
    public bool Claimed { get; init; }
    /// <summary>奖励文案（木材/口粮/钥匙/传说卡/宠物蛋）。</summary>
    public string Reward { get; init; } = "";
}

public sealed class ClassProgressUiSnapshot
{
    public string Cls { get; init; } = "";
    public int Lv { get; init; } = 1;
    public int Xp { get; init; }
    /// <summary>升到下一级所需经验（meta.js xpForNext；满级时无意义）。</summary>
    public int XpForNext { get; init; }
    public bool Maxed { get; init; }
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
