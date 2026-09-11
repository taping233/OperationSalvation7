using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;
using Soudache;

namespace SoudacheGodot.App;

/// Composition root joining exported Soudache content, pure C# run/combat state,
/// five-slot saves, and Godot presentation without putting rules in Control nodes.
// ported from src/characters.js（角色名/职业表）+ src/mapData.js（祭坛 BOSS affix）：
// 角色与首领元数据读 data/characters.json 与 data/map.json，不在代码里写死。
public sealed class CoreGameAdapter : ICoreUiPort
{
    private const ulong DefaultSeed = 0xC0D3_0007UL;
    private readonly StableId _playerId = "player.expedition";
    private readonly GameData _data;
    private readonly CardCatalog _catalog;
    private readonly IReadOnlyList<RunCard> _runCards;
    private readonly AtomicJsonSaveService _saves;
    private RunBaseState _base = new();
    private CardDeck _deck = new();
    private CombatState _combat = null!;
    private CardPlayEngine _cardPlay = null!;
    private RunState? _run;
    private bool _bossCombat;
    private List<RunCard> _bossDeckPool = new();
    private readonly HashSet<int> _bossDeckSelection = new();
    private readonly Dictionary<string, string> _normalCardNames = new(StringComparer.Ordinal);
    private string _runCharacterId = "";
    private string _runStatus = "请选择角色开始远征";
    private string _battleStatus = "战斗核心已就绪";
    private string _saveStatus = "五槽存档已就绪";
    private int _lastRoll;
    // 祭坛弃 3 激活：UI 逐张勾选的暂存（按卡名去重，跨名累计 3 张实例）
    private readonly List<string> _altarSacrificePicks = new();
    // 批次 5 rider [6c→A]：战斗音效信号生产器（PublishBattle 透传进 SfxRequests）
    private readonly BattleSfxTracker _battleSfx = new();
    // 批次 5：孵化/领奖等基地侧随机（网页 Random 流的确定性替身；孵化结果本身随机即可）
    private readonly DeterministicRng _baseRng = new(0x50E7_0001UL);
    // 卡牌稀有度表（rider [6c→A]：HandCardRarities 光晕信号的数据源）
    private IReadOnlyDictionary<string, string> _rarityById = new Dictionary<string, string>();

    public event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    public event Action<RunUiSnapshot>? RunSnapshotChanged;
    public event Action<SaveSlotsUiSnapshot>? SaveSlotsChanged;

    public CoreGameAdapter() : this("user://saves") { }

    /// <summary>存档根目录可注入（--smoke-7b 用独立目录跑退出落盘链路，不碰真实档位）。</summary>
    public CoreGameAdapter(string savesRoot)
    {
        var cardsJson = ReadResourceText("res://data/cards.json");
        _data = GameData.Load(cardsJson,
            ReadResourceText("res://data/characters.json"),
            ReadResourceText("res://data/map.json"),
            ReadResourceText("res://data/rules.json"),
            // 批次 4c：事件叙事唯一来源 = data/narrative-events.ink.json（批次 4a 编译产物）
            ReadResourceText("res://data/narrative-events.ink.json"),
            // 批次 5：宠物表 + 成就/收藏里程碑表
            ReadResourceText("res://data/pets.json"),
            ReadResourceText("res://data/achievements.json"));
        GameRuntime.Load(_data);
        _catalog = CardCatalog.Load(cardsJson);
        _runCards = LoadRunCards(cardsJson);
        _base.SeedStarterStash(_runCards.Where(card => card.Semantic == RunCardSemantic.Combat));
        _saves = new AtomicJsonSaveService(
            savesRoot.StartsWith("user://", StringComparison.Ordinal)
                ? ProjectSettings.GlobalizePath(savesRoot)
                : savesRoot);
        CreateCombat(new[] { new RunEnemy("training", "训练靶机", 36, 2) }, 30);
    }

    public void RequestStartRun(string characterId, int slot = -1)
    {
        // 接口需求 [7b→B]：开局即绑定游玩档位（对照网页 launch(slot)），纯新档关窗也能走退出落盘链路
        if (slot >= 0) _activeSaveSlot = slot;
        _runCharacterId = characterId;
        _run = new RunState(DefaultSeed + (ulong)Math.Max(0, CharacterIndex(characterId)), baseState: _base);
        ConfigureRunCardPools(_run);
        // 批次 5：初始牌按携带宠物生效（RunState.GrantStarterCards，网页 grantStarterSha）——
        // 先发初始牌（网页 newRun 顺序），仓库携带预留 = 初始牌总数，避免开局爆容量。
        var starters = _run.GrantStarterCards(_runCards);
        _run.TakeCardsFromBase(BuildInitialLoadout(_base, Math.Max(0, _run.BackpackCapacity - starters.StarterCount)));
        _lastRoll = 0;
        _runStatus = $"{CharacterName(characterId)} 已进入外环" + (starters.FireballConverted ? "；火焰精灵：初始攻击化为了火球" : "");
        CreateCombat(new[] { new RunEnemy("training", "训练靶机", 36, 2) }, _run.Hp);
        PublishCurrentState();
    }

    public void RequestRollDice()
    {
        if (_run == null)
        {
            _runStatus = "请先在远征准备页选择角色";
            PublishCurrentState();
            return;
        }
        if (_run.Phase != RunPhase.Ready)
        {
            _runStatus = $"请先结算当前房间：{PhaseLabel(_run.Phase)}";
            PublishCurrentState();
            return;
        }
        try
        {
            // 四层节点图没有掷骰：网页版「掷骰子移动」按钮实际是选择相邻节点前进
            // （game.boot.js chooseNextTarget）。骨架先取第一个相邻节点，6c 地图渲染
            // 接入点选移动（move:idx）后由 UI 直选。
            var neighbors = _run.ReachableNodes();
            if (neighbors.Count == 0) throw new InvalidOperationException("当前节点没有可前往的相邻节点。");
            var move = _run.MoveTo(neighbors[0]);
            _lastRoll = 0;
            _runStatus = $"移动至第 {move.Layer + 1} 层节点 {move.ToPosition + 1}";
            PrepareCurrentRoom();
        }
        catch (Exception error)
        {
            _runStatus = error.Message;
        }
        PublishCurrentState();
    }

    public void RequestRunAction(string actionId)
    {
        if (_run == null)
        {
            _runStatus = "尚未开始远征";
            PublishCurrentState();
            return;
        }
        try
        {
            var parts = actionId.Split(':', 2);
            var argument = parts.Length == 2 ? parts[1] : string.Empty;
            switch (parts[0])
            {
                case "upgrade":
                    RequestBaseAction(actionId);
                    return;
                case "roll":
                    RequestRollDice();
                    return;
                case "move":
                {
                    // 四层图移动：前往相邻节点（网页版 moveTo 原子事务，落点即结算）
                    var move = _run.MoveTo(int.Parse(argument));
                    _runStatus = $"移动至第 {move.Layer + 1} 层节点 {move.ToPosition + 1}";
                    PrepareCurrentRoom();
                    break;
                }
                case "battle":
                    _runStatus = "请切换到战斗页继续";
                    break;
                case "event":
                {
                    // 批次 4c：event:{index}=ink 选项落地；event:continue=无结点事件「继 续」/修鞋铺「继续旅程」；
                    // event:restore:{卡名}=修鞋铺从消耗口袋复原 1 张（网页 openPocketRestore restoreOne）
                    if (argument == "continue")
                    {
                        _run.LeaveEventWithoutEffect();
                        _runStatus = "事件结束";
                    }
                    else if (argument.StartsWith("restore:", StringComparison.Ordinal))
                    {
                        _runStatus = _run.RestoreEventPocketCard(argument["restore:".Length..])
                            ? "卡牌已复原，回到背包"
                            : "消耗口袋中没有可复原的这张卡，或背包已满";
                    }
                    else
                    {
                        var result = _run.ChooseEvent(int.Parse(argument));
                        _runStatus = result.Text.Length > 0 ? result.Text : "事件结束";
                        PrepareCurrentRoom();
                    }
                    break;
                }
                case "chest":
                {
                    var loot = _run.OpenNextChest(int.Parse(argument));
                    _runStatus = $"开启{loot.Kind}宝箱：{loot.Coins} 币，获得 {string.Join("、", loot.AcceptedItems ?? loot.Items)}";
                    PrepareCurrentRoom();
                    break;
                }
                case "claim":
                    _runStatus = _run.ClaimPendingReward(argument) ? $"已收取 {argument}" : "背包空间不足";
                    break;
                case "shop":
                    if (argument == "leave") { _run.LeaveShop(); _runStatus = "离开商店"; }
                    else { _run.BuyShopOffer(argument); _runStatus = "购买完成"; }
                    break;
                case "craft":
                    // 碎片/令牌合成入口（game.bag.js craftColorToken 家族的 Core 语义）
                    if (argument == "tokenA") _runStatus = _run.CraftTokenAFromB() is { Ok: true } okA ? okA.Message : "员工通行证B不足 3 张，无法合成";
                    else if (argument == "colortoken") _runStatus = _run.CraftColorTokenByFragments() is { Ok: true } okC ? okC.Message : "碎片或员工通行证A不足，无法合成彩色令牌";
                    else throw new InvalidOperationException("未知合成操作。");
                    break;
                case "campfire":
                    _run.CompleteCampfire(argument.Length == 0 ? null : new[] { argument });
                    _runStatus = $"营火休整完成，生命 {_run.Hp}/{_run.MaxHp}";
                    break;
                case "door":
                    if (argument == "enter") _run.EnterDoor();
                    else if (argument == "stay") _run.StayAtDoor();
                    else if (argument == "extract")
                    {
                        // 紧急撤离=献祭 3 张背包卡牌；终局撤离=击败首脑后无条件放行
                        _run.ExtractAtDoor(_run.CurrentRoomType == RunRoomType.EmergencyExit ? _run.DefaultEmergencySacrifice() : null);
                        _runStatus = "已抵达撤离结算";
                    }
                    else _runStatus = "门扉选择已确认";
                    break;
                case "altar":
                    HandleAltarAction(argument);
                    break;
                case "boss":
                {
                    // 首脑格挑战（须先激活祭坛；网页版 openBossGate）
                    var available = _run.OwnedCards.Where(stack => stack.Card.Semantic is RunCardSemantic.Combat or RunCardSemantic.Equipment && !stack.Card.IsInitialAttack).Sum(stack => stack.Count);
                    if (available < 15) throw new InvalidOperationException($"挑战首领需要 15 张非道具牌，当前只有 {available} 张。");
                    _run.ChallengeBoss(int.Parse(argument));
                    if (_run.Phase == RunPhase.Battle) PrepareBossDeckSelection();
                    break;
                }
                case "bossdeck":
                    if (argument == "confirm") ConfirmBossDeck();
                    else ToggleBossDeckCard(int.Parse(argument));
                    break;
                case "ration":
                    _run.ConsumeRation();
                    _runStatus = "使用 1 份口粮，恢复 3 点体力";
                    break;
                case "load":
                    if (_run.Phase != RunPhase.Ready || _run.Turns != 0) throw new InvalidOperationException("只能在出发前调整携带卡。");
                    _runStatus = _run.TakeCardsFromBase(new[] { (argument, 1) }) == 1 ? $"已携带 {argument}" : "背包已满或仓库中没有该卡";
                    break;
                case "unload":
                    if (_run.Phase != RunPhase.Ready || _run.Turns != 0) throw new InvalidOperationException("只能在出发前调整携带卡。");
                    _runStatus = _run.ReturnCardToBase(argument) ? $"已将 {argument} 放回仓库" : "仓库已满或该卡不可放回";
                    break;
                case "safeadd":
                    if (_run.Phase != RunPhase.Ready) throw new InvalidOperationException("只能在已结算节点调整安全袋。");
                    _runStatus = _run.SetCardSafe(argument) ? $"已将 {argument} 放入安全袋" : "安全袋已满或卡牌不可用";
                    break;
                case "saferemove":
                    if (_run.Phase != RunPhase.Ready) throw new InvalidOperationException("只能在已结算节点调整安全袋。");
                    _runStatus = _run.UnsetCardSafe(argument) ? $"已将 {argument} 移出安全袋" : "安全袋中没有该卡";
                    break;
                case "settle":
                    if (argument == "finish") _runStatus = _run.FinalizeSettlement() ? "撤离结算完成" : "仓库已满，请先扩容后收取剩余卡牌";
                    else _runStatus = _run.DepositSettlementCard(int.Parse(argument)) ? "战利品已存入仓库" : "仓库空间不足";
                    break;
                case "recovery":
                    _runStatus = _run.ClaimRecoveryCard(argument) ? $"已找回安全袋中的 {argument}" : "仓库空间不足";
                    break;
                default:
                    throw new InvalidOperationException("未知远征操作。");
            }
        }
        catch (Exception error)
        {
            _runStatus = error.Message;
        }
        PublishCurrentState();
    }

    public void RequestBaseAction(string actionId)
    {
        var target = _run?.Base ?? _base;
        try
        {
            switch (actionId)
            {
                case "upgrade:bag":
                case "upgrade:stash":
                {
                    var upgraded = actionId == "upgrade:bag" ? target.UpgradeBag() : target.UpgradeStash();
                    _runStatus = upgraded ? "基地设施升级完成" : "资源不足或设施已满级";
                    break;
                }
                // —— 批次 5：宠物 + 收藏室（6b' hub 页动作；对应网页 game.hub.js）——
                case "pet:hatch":
                {
                    var result = target.HatchPet(count => (int)(_baseRng.NextDouble() * count));
                    _runStatus = result.Ok ? $"孵化成功：{result.Pet!.Name} 加入了基地！（1 张宠物蛋 + {_data.Pets.HatchCost} 储备币）"
                        : result.Why switch
                        {
                            "noegg" => "仓库里没有宠物蛋",
                            "poor" => $"储备币不足——孵化需要 {_data.Pets.HatchCost} 币",
                            _ => "已集齐全部宠物，蛋可以留着收藏"
                        };
                    break;
                }
                default:
                    if (actionId.StartsWith("pet:up:", StringComparison.Ordinal))
                    {
                        var id = actionId["pet:up:".Length..];
                        var petName = PetName(id);
                        _runStatus = target.UpgradePet(id) ? $"{petName} 升到了 Lv.{target.PetLevel(id)}！" : "口粮不足或该宠物已满级";
                    }
                    else if (actionId.StartsWith("pet:sel:", StringComparison.Ordinal))
                    {
                        var id = actionId["pet:sel:".Length..];
                        _runStatus = target.SetPet(id) ? $"已携带 {PetName(id)} 出战" : "还没有这只宠物";
                    }
                    // —— 批次 8-prep 接口 [6b'→A]：仓库页卖出/复原动作（对照网页 openStashItem sellOne/sellAll 与 restoreCard）——
                    else if (actionId.StartsWith("stash:sell:", StringComparison.Ordinal))
                    {
                        var name = actionId["stash:sell:".Length..];
                        var (ok, qty, coins, why) = target.SellCards(name, 1);
                        _runStatus = ok ? $"已卖出 {name} ×{qty}，+{coins} 币"
                            : why switch
                            {
                                "collected" => $"【{name}】收藏中受保护——取消收藏后才能卖出",
                                "material" => "材料是基地的根基，不可卖出换币",
                                "unsellable" => $"【{name}】不可出售",
                                _ => $"仓库里没有【{name}】"
                            };
                    }
                    else if (actionId.StartsWith("stash:sellall:", StringComparison.Ordinal))
                    {
                        var name = actionId["stash:sellall:".Length..];
                        var (ok, qty, coins, why) = target.SellCards(name, int.MaxValue);
                        _runStatus = ok ? $"已全部卖出 {name} ×{qty}，+{coins} 币"
                            : why switch
                            {
                                "collected" => $"【{name}】收藏中受保护——取消收藏后才能卖出",
                                "material" => "材料是基地的根基，不可卖出换币",
                                "unsellable" => $"【{name}】不可出售",
                                _ => $"仓库里没有【{name}】"
                            };
                    }
                    else if (actionId.StartsWith("pocket:restore:", StringComparison.Ordinal))
                    {
                        var name = actionId["pocket:restore:".Length..];
                        var restore = target.RestorePocketWithKeys(name);
                        _runStatus = restore.Ok && restore.Why == "" ? $"消耗 {restore.Cost} 把钥匙，【{name}】已复原，回到卡牌仓库"
                            : restore.Why == "sha" ? "初始牌「初始攻击」无需入库——每局自动携带，已直接消耗"
                            : restore.Why == "full" ? "仓库容量不足，先卖出或扩建仓库"
                            : restore.Why == "nokey" ? $"钥匙不足：复原这堆卡牌需要 {restore.Cost} 把钥匙——可在仓库把钥匙材料卡「使用」折入储备"
                            : $"消耗口袋中没有【{name}】";
                    }
                    else if (actionId.StartsWith("collect:", StringComparison.Ordinal))
                    {
                        var cardId = actionId["collect:".Length..];
                        var card = _runCards.FirstOrDefault(item => item.Id == cardId);
                        if (card is null) _runStatus = "卡牌库中没有这张卡";
                        else
                        {
                            var now = CollectionRoom.Toggle(target, card);
                            var xp = CollectionRoom.OnCollect(target, card, now, _data.CardClasses);
                            _runStatus = now
                                ? xp.Converted
                                    ? $"已收藏【{card.Name}】入职业收藏室，{xp.Cls} 获得 {xp.Amount} 点经验" + (xp.Ups > 0 ? $"（升级了 {xp.Ups} 级！）" : "")
                                    : $"已收藏【{card.Name}】"
                                : $"已取消收藏【{card.Name}】";
                        }
                    }
                    else if (actionId.StartsWith("collclaim:", StringComparison.Ordinal))
                    {
                        var msId = actionId["collclaim:".Length..];
                        var milestone = _data.Achievements.CollectionMilestones.FirstOrDefault(item => item.Id == msId);
                        if (milestone is null) _runStatus = "没有这个收藏里程碑";
                        else
                        {
                            var claim = CollectionRoom.Claim(target, milestone, _runCards, _data.Pets, _data,
                                () => _baseRng.NextDouble());
                            _runStatus = claim.Ok ? claim.Message
                                : claim.Why == "full" ? "仓库容量不足——先卖出或扩建卡牌仓库再来领取"
                                : claim.Why == "claimed" ? "该里程碑奖励已领取"
                                : "收藏进度尚未达成";
                        }
                    }
                    else
                    {
                        _runStatus = "未知基地操作。";
                    }
                    break;
            }
        }
        catch (Exception error)
        {
            _runStatus = error.Message;
        }
        PublishCurrentState();
    }

    private string PetName(string id) => _data.Pets.List.FirstOrDefault(pet => pet.Id == id)?.Name ?? id;

    public void RequestPlayCard(string cardId, string? targetId, string[] infusionFuelIds)
    {
        if (!TryCurrentEnemy(out var enemy) && string.IsNullOrWhiteSpace(targetId))
        {
            _battleStatus = "当前没有可选敌人";
            PublishCurrentState();
            return;
        }
        CardPlayResult result;
        var enemiesHpBefore = EnemyHpTotal();
        var playerHpBefore = _combat.GetCombatant(_playerId).Health;
        try
        {
            var targets = string.IsNullOrWhiteSpace(targetId) ? Array.Empty<StableId>() : new[] { new StableId(targetId) };
            result = _cardPlay.TryPlay(new StableId(cardId), targets, infusionFuelIds.Select(id => new StableId(id)));
        }
        catch (Exception error)
        {
            _battleStatus = error.Message;
            PublishCurrentState();
            return;
        }
        if (!result.Accepted)
        {
            _battleStatus = result.Reason == "Not enough energy." ? "能量不足" : result.Reason;
            PublishCurrentState();
            return;
        }
        _cardPlay.ResolveQueuedEffects();
        SyncNormalConsumedCards();
        _battleStatus = enemy == null ? "卡牌已结算" : $"卡牌已结算；{enemy.Name} 剩余 {enemy.Health} 点生命";
        // rider [6c→A]：可观测状态变化 → sound.js 同名音效键（card/hit/hurt/heal）
        _battleSfx.OnCardResolved(enemiesHpBefore, EnemyHpTotal(), playerHpBefore, _combat.GetCombatant(_playerId).Health);
        HandleCombatOutcome();
        PublishCurrentState();
    }

    public void RequestEndTurn()
    {
        if (_combat.Phase != CombatPhase.PlayerTurn)
        {
            _battleStatus = _combat.Phase == CombatPhase.Victory ? "战斗已经胜利" : "当前不能结束回合";
            PublishCurrentState();
            return;
        }
        if (_bossCombat) _deck.DiscardHand();
        var playerHpBefore = _combat.GetCombatant(_playerId).Health;
        _combat.StartEnemyTurn();
        foreach (var enemy in _combat.Combatants.Where(unit => unit.IsEnemy && !unit.IsDefeated))
        {
            EnemyTurnResolver.EnqueueTurn(_combat, enemy.Id, EnemyAffixFor(enemy.Id));
            _combat.ResolveActions();
            _combat.TickPoison(enemy.Id);
            _combat.TickDurations(enemy.Id);
        }
        _combat.TickPoison(_playerId);
        _combat.TickDurations(_playerId);
        _combat.UpdateOutcome();
        if (_combat.Phase is not (CombatPhase.Victory or CombatPhase.Defeat))
        {
            _combat.StartPlayerTurn();
            _combat.SetEnergy(2, 2);
            if (_bossCombat) _deck.Draw(Math.Min(1, Math.Max(0, 8 - _deck.Hand.Count)), _combat.Rng);
            _battleStatus = _bossCombat ? "敌方回合已结算；抽取 1 张牌" : "敌方回合已结算；未使用的随身卡仍可打出";
        }
        // rider [6c→A]：敌方回合的玩家受伤/回复 → hurt/heal 音效键
        _battleSfx.OnEnemyTurnResolved(playerHpBefore, _combat.GetCombatant(_playerId).Health);
        HandleCombatOutcome();
        PublishCurrentState();
    }

    public void RequestPileView(string pileKey)
    {
        _battleStatus = pileKey == "draw"
            ? $"牌库剩余 {_deck.DrawPile.Count} 张"
            : $"弃牌堆 {_deck.Discard.Count} 张，消耗区 {_deck.Exhaust.Count} 张";
        PublishCurrentState();
    }

    /// <summary>是否有进行中的远征（退出落盘判定，对照网页 saveGame 的 runActive 守卫）。</summary>
    public bool HasActiveRun => _run is { IsFinished: false };

    /// <summary>当前游玩档位（0 基；对照网页 session.activeSlot，由读档/手动存档绑定）。</summary>
    public int? ActiveSaveSlot => _activeSaveSlot;
    private int? _activeSaveSlot;

    public void RequestSaveSlot(int slot)
    {
        // 批次 4c 口径：稳定落点才可手动保存（事件/战斗进行中拒绝），与网页日常 saveGame 调用点一致
        if (_run is { Phase: not (RunPhase.Ready or RunPhase.Settlement) })
        {
            _saveStatus = "请先完成当前房间结算，再保存远征。";
            PublishSaveSlots();
            return;
        }
        SaveSnapshotToSlot(slot, forced: false);
    }

    /// <summary>
    /// 退出前落盘（批次 7b；对齐网页 beforeunload=game.boot.js:442 与 quitGame=game.menu.js saveGame 后退）：
    /// 有在局且已绑定档位则**强制**写档（绕过 RequestSaveSlot 的稳定落点守卫——网页关窗时
    /// state!=='moving' 即写，战斗局面一并入档 game.session.js:368-371）；无局/无槽位则跳过不产生档案
    /// （对照网页 `if (!game.runActive…) return; if (!activeSlot) return;`）。
    /// </summary>
    public void RequestSaveActiveSlot()
    {
        if (_activeSaveSlot is not int slot)
        {
            _saveStatus = "退出未落盘：本次会话未绑定存档档位";
            PublishSaveSlots();
            return;
        }
        if (!HasActiveRun)
        {
            _saveStatus = "退出未落盘：没有进行中的远征";
            PublishSaveSlots();
            return;
        }
        SaveSnapshotToSlot(slot, forced: true);
    }

    private void SaveSnapshotToSlot(int slot, bool forced)
    {
        try
        {
            _activeSaveSlot = slot;
            var run = _run?.CaptureSnapshot();
            var player = _combat.GetCombatant(_playerId);
            _saves.Save(slot, new SaveGameDto
            {
                Seed = run?.Seed ?? DefaultSeed,
                RngState = run?.RngState ?? _combat.Rng.State,
                LayerIdx = run?.LayerIndex ?? 0,
                TrackPos = run?.TrackPosition ?? 0,
                Hp = run?.Hp ?? player.Health,
                MaxHp = run?.MaxHp ?? RunRules.PlayerMaxHp,
                Coins = run?.Coins ?? 0,
                Keys = run?.Keys ?? 0,
                Wood = run?.Wood ?? 0,
                Rations = run?.Rations ?? 0,
                Stamina = run?.Stamina ?? RunRules.StaminaMax,
                Fragments = run?.Fragments ?? 0,
                AltarActivated = run?.AltarActivated ?? false,
                BossKilled = run?.BossKilled ?? false,
                VisitedNodes = run?.VisitedNodes?.ToList() ?? new List<string>(),
                Turn = run?.Turns ?? _combat.Turn,
                CharacterId = string.IsNullOrEmpty(_runCharacterId) ? null : _runCharacterId,
                RunActive = _run != null && !_run.IsFinished,
                OwnedCards = SerializeSnapshots(run?.OwnedCards),
                UsedPocket = SerializeSnapshots(run?.UsedPocket),
                Inventory = SerializeSnapshots(run?.PendingRewards),
                Flags = new Dictionary<string, string>(StringComparer.Ordinal)
                {
                    ["runPhase"] = (run?.Phase ?? RunPhase.Ready).ToString(),
                    ["settlement"] = JsonSerializer.Serialize(run?.SettlementCards ?? Array.Empty<RunSettlementSnapshot>())
                },
                Base = ToDto(run?.Base ?? _base.CaptureSnapshot()),
                Deck = CardDeckDto.FromRuntime(_deck),
                Combat = CombatStateDto.FromRuntime(_combat)
            });
            _saveStatus = (forced ? "退出已强制落盘" : "已保存") + $"到档位 {slot + 1}";
        }
        catch (Exception error)
        {
            _saveStatus = $"保存失败：{error.Message}";
        }
        PublishSaveSlots();
    }

    public void RequestLoadSlot(int slot)
    {
        try
        {
            if (!_saves.TryLoad(slot, out var snapshot, out var usedBackup) || snapshot == null)
            {
                _saveStatus = $"档位 {slot + 1} 为空";
                PublishSaveSlots();
                return;
            }
            _activeSaveSlot = slot; // 续档即绑定游玩档位（对照网页 setActiveSlot）
            _runCharacterId = snapshot.CharacterId ?? "";
            _base = FromDto(snapshot.Base);
            var savedPhase = snapshot.Flags.TryGetValue("runPhase", out var phaseText) && Enum.TryParse<RunPhase>(phaseText, out var parsedPhase)
                ? parsedPhase : RunPhase.Ready;
            var settlement = snapshot.Flags.TryGetValue("settlement", out var settlementJson)
                ? JsonSerializer.Deserialize<RunSettlementSnapshot[]>(settlementJson) ?? Array.Empty<RunSettlementSnapshot>()
                : Array.Empty<RunSettlementSnapshot>();
            _run = snapshot.RunActive
                ? RunState.FromSnapshot(new RunSnapshot(snapshot.Seed, snapshot.RngState, snapshot.LayerIdx,
                    snapshot.TrackPos, snapshot.Turn, snapshot.Stamina, snapshot.Hp, snapshot.Coins,
                    snapshot.Keys, snapshot.Wood, snapshot.Rations,
                    savedPhase == RunPhase.Settlement ? RunPhase.Settlement : RunPhase.Ready,
                    _base.CaptureSnapshot(), DeserializeSnapshots(snapshot.OwnedCards),
                    DeserializeSnapshots(snapshot.UsedPocket), DeserializeSnapshots(snapshot.Inventory), settlement,
                    Math.Max(0, snapshot.Fragments), snapshot.AltarActivated, snapshot.BossKilled,
                    snapshot.VisitedNodes))
                : null;
            if (_run != null)
            {
                _base = _run.Base;
                ConfigureRunCardPools(_run);
            }
            _deck = snapshot.Deck.ToRuntime();
            _combat = snapshot.Combat?.ToRuntime() ?? CreateCombatState(Array.Empty<RunEnemy>(), snapshot.Hp);
            if (_combat.MaxEnergy == 0) _combat.SetEnergy(2, 2);
            if (_deck.Count == 0)
            {
                _deck = BuildCombatDeck(false);
            }
            _cardPlay = new CardPlayEngine(_combat, _deck, _catalog);
            _saveStatus = $"已读取档位 {slot + 1}" + (usedBackup ? "（使用备份）" : "");
            _runStatus = _run == null ? "该档位没有进行中的远征" : "远征已恢复";
            PublishCurrentState();
        }
        catch (Exception error)
        {
            _saveStatus = $"读取失败：{error.Message}";
            PublishSaveSlots();
        }
    }

    /// <summary>
    /// 清空存档槽（接口需求 [6b→A]，对照网页 game.menu.js delSlot/overwriteSlot 共用的 clearSlot）：
    /// 选档页「删除」直接清档；「覆盖重开」先 RequestClearSlot 再 RequestStartRun。
    /// 槽号越界抛错（含校验），成功后刷新档位列表。
    /// </summary>
    public void RequestClearSlot(int slot)
    {
        try
        {
            var existed = _saves.ClearSlot(slot);
            if (_activeSaveSlot == slot) _activeSaveSlot = null; // 删除/覆盖重开当前游玩档后解除绑定
            _saveStatus = existed ? $"已删除档位 {slot + 1} 的存档（含基地数据）" : $"档位 {slot + 1} 本就是空档";
        }
        catch (Exception error)
        {
            _saveStatus = $"删除失败：{error.Message}";
        }
        PublishSaveSlots();
    }

    public void PublishCurrentState()
    {
        PublishRun();
        PublishBattle();
        PublishSaveSlots();
    }

    private void BeginRunCombat()
    {
        if (_run == null || _run.Encounter.Count == 0) return;
        CreateCombat(_run.Encounter, _run.Hp);
        _battleStatus = $"遭遇 {_run.Encounter.Count} 名敌人；战斗开始";
        _runStatus = "遭遇战斗，请进入战斗界面";
    }

    private void CreateCombat(IEnumerable<RunEnemy> enemies, int playerHp)
    {
        var encounter = enemies.ToArray();
        _bossCombat = _run != null && encounter.Any(enemy => _run.Map.Bosses.Any(boss => boss.Id == enemy.Id));
        _combat = CreateCombatState(encounter, playerHp);
        _deck = BuildCombatDeck(_bossCombat);
        _combat.StartPlayerTurn();
        _combat.SetEnergy(2, 2);
        if (_bossCombat) _deck.Draw(5, _combat.Rng);
        _cardPlay = new CardPlayEngine(_combat, _deck, _catalog);
    }

    private CombatState CreateCombatState(IEnumerable<RunEnemy> enemies, int playerHp)
    {
        var combat = new CombatState(_playerId);
        // 批次 5：对局生命上限随携带宠物（汪汪狗 +maxHp；网页 newRun 的 game.maxHp 同源）
        var playerMaxHp = _run?.MaxHp ?? RunRules.PlayerMaxHp;
        var player = new CombatantState(_playerId, CharacterName(_runCharacterId), playerMaxHp, false) { Attack = RunRules.PlayerAtk };
        if (playerHp < player.MaxHealth) player.ApplyDamage(player.MaxHealth - Math.Max(0, playerHp));
        combat.AddCombatant(player);
        var index = 0;
        foreach (var source in enemies)
        {
            var enemy = new CombatantState(new StableId($"enemy.{source.Id}.{index++}"), source.Name, source.Hp, true) { Attack = source.Attack };
            combat.AddCombatant(enemy);
        }
        if (index == 0)
            combat.AddCombatant(new CombatantState("enemy.training.0", "训练靶机", 36, true) { Attack = 2 });
        return combat;
    }

    private CardDeck BuildCombatDeck(bool boss)
    {
        _normalCardNames.Clear();
        var selected = new List<RunCard>();
        if (_run != null)
        {
            if (boss && _bossDeckPool.Count > 0)
                selected.AddRange(_bossDeckSelection.OrderBy(index => index).Select(index => _bossDeckPool[index]));
            else
                foreach (var stack in _run.OwnedCards.Where(stack => stack.Card.Semantic is RunCardSemantic.Combat or RunCardSemantic.Equipment))
                    selected.AddRange(Enumerable.Repeat(stack.Card, stack.Count));
        }
        if (boss && _runCards.FirstOrDefault(card => card.Id == "builtin-sha") is { } starter)
            selected.AddRange(Enumerable.Repeat(starter, 5));
        if (selected.Count == 0)
            selected.AddRange(_runCards.Where(card => card.Semantic == RunCardSemantic.Combat).Take(5));
        var deck = new CardDeck { AutoReshuffle = boss, HandCapacity = boss ? 8 : int.MaxValue };
        var instances = selected.Where(card => _catalog.TryGet(card.Id, out var definition) && definition?.Layer == CardLayer.Combat)
            .Select((card, index) => (Card: card, Instance: new CardInstance(new StableId($"battle.card.{index}"), new StableId(card.Id))))
            .ToList();
        if (instances.Count == 0) throw new InvalidOperationException("导出的卡牌目录缺少可战斗卡牌。");
        if (boss)
        {
            var shuffled = instances.Select(x => x.Instance).ToList();
            _combat?.Rng.Shuffle(shuffled);
            deck.AddToDrawPile(shuffled);
        }
        else
        {
            foreach (var entry in instances)
            {
                deck.AddToHand(entry.Instance);
                _normalCardNames[entry.Instance.InstanceId.Value] = entry.Card.Name;
            }
        }
        return deck;
    }

    private void HandleCombatOutcome()
    {
        if (_combat.Phase == CombatPhase.PlayerTurn) return;
        if (_combat.Phase == CombatPhase.Victory)
        {
            _battleStatus = "战斗胜利";
            _battleSfx.OnCombatEnded(victory: true);
            if (_run?.Phase == RunPhase.Battle)
            {
                _run.CompleteBattle(true, _combat.GetCombatant(_playerId).Health);
                _bossDeckPool.Clear();
                _bossDeckSelection.Clear();
                _runStatus = "战斗胜利，请在地图页领取战利品";
            }
        }
        else if (_combat.Phase == CombatPhase.Defeat)
        {
            _battleStatus = "战斗失败";
            _battleSfx.OnCombatEnded(victory: false);
            if (_run?.Phase == RunPhase.Battle) _run.CompleteBattle(false, 0);
            _runStatus = "远征失败";
        }
    }

    private int EnemyHpTotal() => _combat.Combatants.Where(unit => unit.IsEnemy).Sum(unit => unit.Health);

    private void PublishRun()
    {
        var baseState = _run?.Base ?? _base;
        var basePets = BuildPetSnapshot(baseState);
        var collection = BuildCollectionSnapshot(baseState);
        if (_run == null)
        {
            RunSnapshotChanged?.Invoke(new RunUiSnapshot
            {
                StatusText = _runStatus,
                BaseWood = _base.Wood,
                BaseRations = _base.Rations,
                BaseKeys = _base.Keys,
                BaseCoins = _base.Coins,
                SafeCapacity = _base.SafeCapacity,
                StashUsed = _base.StashUsed,
                StashCapacity = _base.StashCapacity,
                InventoryLabels = _base.Stash.Select(stack => $"{stack.Card.Name} ×{stack.Count}").ToArray(),
                Actions = BuildBaseActions(_base),
                BasePets = basePets,
                Collection = collection,
                // —— 批次 8-prep 接口 [6b'→A]：无局（基地）路径。令牌口径=基地仓库栈 ——
                Fragments = 0,
                TokenCounts = CoreUiSnapshots.TokenCounts(_base.Stash),
                BaseStash = CoreUiSnapshots.StashRows(_base.Stash, _base.Collection, CostOfCard),
                BasePocket = CoreUiSnapshots.PocketRows(_base.Pocket),
                BaseKeyCount = _base.KeyCount,
                BaseBagCapacity = _base.BagCapacity,
                BaseBagMax = RunRules.BagMax,
                BaseSafeMax = RunRules.SafeMax,
                BaseStashMax = RunRules.StashMax,
                CollectedIds = CoreUiSnapshots.CollectedIds(_base.Collection)
            });
            return;
        }
        var layer = _run.Map.Layers[_run.LayerIndex];
        var nodes = layer.Nodes.Select(node => new MapNodeUiSnapshot
        {
            Index = node.Idx,
            Type = NodeUiType(node.Type),
            Label = node.Name,
            IsCurrent = node.Idx == _run.TrackPosition,
            X = node.X,
            Row = node.Row,
            Neighbors = layer.NeighborsOf(node.Idx).ToArray()
        }).ToArray();
        RunSnapshotChanged?.Invoke(new RunUiSnapshot
        {
            CharacterId = _runCharacterId,
            CharacterDisplayName = CharacterName(_runCharacterId),
            LayerIndex = _run.LayerIndex,
            TrackPosition = _run.TrackPosition,
            // 接口需求 [6b→A]：环层名/骰子历史/攻击力/宝藏大门钥匙需求（对局 HUD）
            LayerName = layer.Name,
            DiceHistory = _run.DiceHistory.ToArray(),
            Atk = RunRules.PlayerAtk,
            KeyNeeded = RunRules.KeyNeeded,
            CurrentHp = _run.Phase == RunPhase.Battle ? _combat.GetCombatant(_playerId).Health : _run.Hp,
            MaxHp = _run.MaxHp,
            TrackLength = layer.NodeCount,
            LastRoll = _lastRoll,
            Coins = _run.Resources.Coins,
            Keys = _run.Resources.Keys,
            Wood = _run.Resources.Wood,
            Rations = _run.Resources.Rations,
            Stamina = _run.Stamina,
            MaxStamina = _run.MaxStamina,
            BackpackUsed = _run.BackpackUsed,
            BackpackCapacity = _run.BackpackCapacity,
            BaseWood = _run.Base.Wood,
            BaseRations = _run.Base.Rations,
            BaseKeys = _run.Base.Keys,
            BaseCoins = _run.Base.Coins,
            SafeCapacity = _run.Base.SafeCapacity,
            StashUsed = _run.Base.StashUsed,
            StashCapacity = _run.Base.StashCapacity,
            Phase = PhaseLabel(_run.Phase),
            CurrentRoom = CurrentRunRoomLabel(layer, _run.TrackPosition),
            StatusText = _runStatus,
            InventoryLabels = _run.OwnedCards.Select(stack => $"{stack.Card.Name} ×{stack.Count}" + (stack.Safe ? "（安全）" : "")).ToArray(),
            Actions = BuildRunActions(_run),
            Nodes = nodes,
            Event = BuildEventSnapshot(_run),
            BasePets = basePets,
            Collection = collection,
            // —— 批次 8-prep 接口 [6b'→A]：有局路径。令牌口径=随身背包栈（对局内合成消耗背包）——
            Fragments = _run.Fragments,
            TokenCounts = CoreUiSnapshots.TokenCounts(_run.OwnedCards),
            BaseStash = CoreUiSnapshots.StashRows(_run.Base.Stash, _run.Base.Collection, CostOfCard),
            BasePocket = CoreUiSnapshots.PocketRows(_run.Base.Pocket),
            BaseKeyCount = _run.Base.KeyCount,
            BaseBagCapacity = _run.Base.BagCapacity,
            BaseBagMax = RunRules.BagMax,
            BaseSafeMax = RunRules.SafeMax,
            BaseStashMax = RunRules.StashMax,
            CollectedIds = CoreUiSnapshots.CollectedIds(_run.Base.Collection)
        });
    }

    /// <summary>卡牌费用查询（仓库明细行 meta「N费·类型」用；目录缺失=0）。</summary>
    private int CostOfCard(string cardId) => _catalog.TryGet(new StableId(cardId), out var definition) && definition is not null ? definition.Cost : 0;

    /// <summary>宠物页快照（批次 5）：pets.json 全表 + 基地档拥有/等级/携带/升级状态。</summary>
    private PetUiSnapshot[] BuildPetSnapshot(RunBaseState state)
    {
        var spec = _data.Pets;
        return spec.List.Select(pet =>
        {
            var owned = state.Pets.ContainsKey(pet.Id);
            var level = state.PetLevel(pet.Id);
            return new PetUiSnapshot
            {
                Id = pet.Id,
                Name = pet.Name,
                Desc = pet.Desc,
                Owned = owned,
                Level = level,
                Carried = owned && state.PetSel == pet.Id,
                UpgradeCost = PetSystem.UpgradeCost(spec, level),
                CanUpgrade = state.CanUpgradePet(pet.Id),
                CanCarry = owned && state.PetSel != pet.Id
            };
        }).ToArray();
    }

    /// <summary>职业收藏室快照（批次 5）：进度/里程碑/熟练度（meta.js 收藏室数据）。</summary>
    private CollectionUiSnapshot BuildCollectionSnapshot(RunBaseState state)
    {
        var pool = CollectionRoom.Pool(_runCards, _data.CardClasses);
        var progress = CollectionRoom.Progress(state, pool);
        var milestones = _data.Achievements.CollectionMilestones.Select(ms => new CollectionMilestoneUiSnapshot
        {
            Id = ms.Id,
            Need = CollectionRoom.MilestoneNeed(ms, pool.Count),
            Reached = progress >= CollectionRoom.MilestoneNeed(ms, pool.Count),
            Claimed = state.CollClaimed.Contains(ms.Id),
            Reward = RewardText(ms.Reward)
        }).ToArray();
        var classes = _data.CardClasses.Select(cls =>
        {
            var entry = state.Classes.TryGetValue(cls, out var found) ? found : ClassProgress.Fresh;
            return new ClassProgressUiSnapshot
            {
                Cls = cls,
                Lv = entry.Lv,
                Xp = entry.Xp,
                XpForNext = MetaRules.XpForNext(entry.Lv),
                Maxed = entry.Lv >= MetaRules.ClassLevelMax
            };
        }).ToArray();
        return new CollectionUiSnapshot { Progress = progress, Total = pool.Count, Milestones = milestones, Classes = classes };
    }

    /// <summary>里程碑奖励文案（meta.js collRewardText 的同构实现）。</summary>
    private static string RewardText(MilestoneRewardData reward)
    {
        var parts = new List<string>();
        if (reward.Wood > 0) parts.Add($"木材 ×{reward.Wood}");
        if (reward.Rations > 0) parts.Add($"口粮 ×{reward.Rations}");
        if (reward.Keys > 0) parts.Add($"钥匙 ×{reward.Keys}");
        if (reward.Legend > 0) parts.Add($"传说卡 ×{reward.Legend}");
        if (reward.Egg > 0) parts.Add($"宠物蛋 ×{reward.Egg}");
        return string.Join(" · ", parts);
    }

    /// <summary>事件页快照（批次 4c）：事件格已抽卡时携带 intro+选项（文本+@@effect@@ 元数据）；修鞋铺附复原列表。</summary>
    private EventUiSnapshot? BuildEventSnapshot(RunState run)
    {
        if (run.Phase != RunPhase.Event || run.PendingEventId is null) return null;
        return new EventUiSnapshot
        {
            EventId = run.PendingEventId,
            Title = run.PendingEventTitle,
            Intro = run.EventIntro,
            Choices = run.EventChoices.Select(choice => new EventChoiceUiSnapshot
            {
                Label = choice.Label,
                Detail = choice.Detail,
                Tone = choice.Tone,
                Effect = choice.Id
            }).ToArray(),
            RestorePending = run.EventRestorePending,
            RestorableCards = run.EventRestorableCards.ToArray(),
            Suspended = run.EventSuspended
        };
    }

    private void PublishBattle()
    {
        var player = _combat.GetCombatant(_playerId);
        var enemy = _combat.Combatants.FirstOrDefault(unit => unit.IsEnemy && !unit.IsDefeated)
            ?? _combat.Combatants.First(unit => unit.IsEnemy);
        BattleSnapshotChanged?.Invoke(new BattleUiSnapshot
        {
            CharacterId = string.IsNullOrEmpty(_runCharacterId) ? "shuangling" : _runCharacterId,
            Turn = _combat.Turn,
            Energy = _combat.Energy,
            MaxEnergy = _combat.MaxEnergy,
            DrawPileCount = _deck.DrawPile.Count,
            DiscardPileCount = _deck.Discard.Count,
            ExhaustPileCount = _deck.Exhaust.Count,
            PlayerHp = player.Health,
            PlayerMaxHp = player.MaxHealth,
            PlayerBlock = player.Block + player.Armor,
            EnemyHp = enemy.Health,
            EnemyMaxHp = enemy.MaxHealth,
            EnemyBlock = enemy.Block + enemy.Armor,
            PlayerTargetId = _playerId.Value,
            Enemies = _combat.Combatants.Where(unit => unit.IsEnemy).Select(unit => new BattleEnemyUiSnapshot
            {
                Id = unit.Id.Value,
                Name = unit.Name,
                Hp = unit.Health,
                MaxHp = unit.MaxHealth,
                Block = unit.Block + unit.Armor,
                Attack = unit.Attack,
                Defeated = unit.IsDefeated
            }).ToArray(),
            StatusText = _battleStatus,
            HandCardIds = _deck.Hand.Select(card => card.InstanceId.Value).ToArray(),
            HandCardInfuseCounts = _deck.Hand.Select(card => _catalog.GetRequired(card.DefinitionId).InfuseCount).ToArray(),
            HandCardTargetKinds = _deck.Hand.Select(card => TargetKind(_catalog.GetRequired(card.DefinitionId))).ToArray(),
            // rider [6c→A]：稀有度信号（与手牌同序；6c 稀有卡光晕粒子着色用）
            HandCardRarities = _deck.Hand.Select(card => _rarityById.TryGetValue(card.DefinitionId.Value, out var rarity) ? rarity : "").ToArray(),
            HandCardLabels = _deck.Hand.Select(card =>
            {
                var definition = _catalog.GetRequired(card.DefinitionId);
                return $"{definition.DisplayName}  [{card.EffectiveCost(definition)}]";
            }).ToArray(),
            // rider [6c→A]：透传待播音效键并清空（UI 逐键 PlaySfx）
            SfxRequests = _battleSfx.Drain().ToArray()
        });
    }

    private void PublishSaveSlots()
    {
        var slots = Enumerable.Range(0, SaveSchema.MaxSlots).Select(slot =>
        {
            if (!_saves.TryLoad(slot, out var save, out var backup) || save == null)
                return new SaveSlotUiSnapshot { Slot = slot, Exists = false };
            return new SaveSlotUiSnapshot
            {
                Slot = slot,
                Exists = true,
                Summary = $"{CharacterName(save.CharacterId ?? "")} · 第 {save.LayerIdx + 1} 层 · HP {save.Hp}/{save.MaxHp}" + (backup ? " · 备份" : "")
            };
        }).ToArray();
        SaveSlotsChanged?.Invoke(new SaveSlotsUiSnapshot { Slots = slots, StatusText = _saveStatus });
    }

    private bool TryCurrentEnemy(out CombatantState enemy)
    {
        enemy = _combat.Combatants.FirstOrDefault(unit => unit.IsEnemy && !unit.IsDefeated)!;
        return enemy != null;
    }

    private void PrepareCurrentRoom()
    {
        if (_run == null) return;
        if (_run.Phase == RunPhase.Battle) BeginRunCombat();
        else if (_run.Phase == RunPhase.Event && _run.EventChoices.Count == 0) _run.DrawEventChoices();
        else if (_run.Phase == RunPhase.Chest && _run.ChestPreview == null) _run.PeekNextChest();
    }

    /// <summary>
    /// 祭坛动作（ported from game.run.altar.js openAltarRitual/openAltarReward）：
    /// pick/activate=弃 3 激活；reward:0|1=二选一奖励；frag=2 碎片兑换；
    /// itemrestore=献祭道具复原；leave=离开（未激活可再来）。
    /// </summary>
    private void HandleAltarAction(string argument)
    {
        if (argument == "leave") { _run!.LeaveAltar(); _altarSacrificePicks.Clear(); _runStatus = "离开祭坛——它保持沉睡"; return; }
        if (argument.StartsWith("pick:", StringComparison.Ordinal))
        {
            var name = argument["pick:".Length..];
            if (_altarSacrificePicks.Contains(name)) _altarSacrificePicks.Remove(name);
            else if (_altarSacrificePicks.Count < RunRules.AltarDiscardCards) _altarSacrificePicks.Add(name);
            _runStatus = $"已选 {_altarSacrificePicks.Count}/{RunRules.AltarDiscardCards} 张献祭卡";
            return;
        }
        if (argument == "activate")
        {
            _run!.ActivateAltarByDiscard(_altarSacrificePicks);
            _altarSacrificePicks.Clear();
            _runStatus = "祭坛苏醒了——请选择一项奖励";
            return;
        }
        if (argument.StartsWith("reward:", StringComparison.Ordinal))
        {
            _run!.ChooseAltarReward(int.Parse(argument["reward:".Length..]));
            _runStatus = "祭坛回赠已领取";
            return;
        }
        if (argument == "frag")
        {
            _runStatus = _run!.ActivateAltarByFragments()
                ? "献上 2 枚彩色令牌碎片——获得职业卡，祭坛苏醒了"
                : "碎片兑换暂不可用（职业卡池为空或背包已满）——碎片已原样保留";
            return;
        }
        if (argument.StartsWith("itemrestore:", StringComparison.Ordinal))
        {
            _runStatus = _run!.SacrificeItemAtAltar(argument["itemrestore:".Length..])
                ? "献上道具——从消耗口袋复原了卡牌"
                : "背包里没有这张道具卡可供献祭";
            return;
        }
        throw new InvalidOperationException("未知祭坛操作。");
    }

    private void SyncNormalConsumedCards()
    {
        if (_bossCombat || _run == null) return;
        foreach (var entry in _normalCardNames.ToArray())
        {
            if (_deck.TryGetZone(entry.Key, out var zone) && zone == CardZone.Hand) continue;
            if (_run.MoveCardToPocket(entry.Value)) _normalCardNames.Remove(entry.Key);
        }
    }

    private EnemyAffix EnemyAffixFor(StableId enemyId)
    {
        // map.json altar.bosses.affix：grow/frenzy/aegis → 战斗词缀枚举
        var id = enemyId.Value;
        foreach (var boss in _data.Bosses)
            if (id.Contains(boss.Id, StringComparison.Ordinal))
                return boss.Affix switch
                {
                    "grow" => EnemyAffix.Grow,
                    "frenzy" => EnemyAffix.Frenzy,
                    "aegis" => EnemyAffix.ElementalAegis,
                    _ => EnemyAffix.None
                };
        return EnemyAffix.None;
    }

    private void PrepareBossDeckSelection()
    {
        if (_run == null) return;
        _bossDeckPool = _run.OwnedCards
            .Where(stack => stack.Card.Semantic is RunCardSemantic.Combat or RunCardSemantic.Equipment && !stack.Card.IsInitialAttack)
            .SelectMany(stack => Enumerable.Repeat(stack.Card, stack.Count))
            .ToList();
        if (_bossDeckPool.Count < 15)
            throw new InvalidOperationException($"挑战首领需要 15 张非道具牌，当前只有 {_bossDeckPool.Count} 张。");
        _bossDeckSelection.Clear();
        const int required = 15;
        for (var index = 0; index < required; index++) _bossDeckSelection.Add(index);
        _runStatus = $"请选择 {required} 张非道具牌组成首领牌库；另自动加入 5 张初始攻击";
    }

    private void ToggleBossDeckCard(int index)
    {
        if (index < 0 || index >= _bossDeckPool.Count) throw new ArgumentOutOfRangeException(nameof(index));
        const int required = 15;
        if (!_bossDeckSelection.Remove(index) && _bossDeckSelection.Count < required) _bossDeckSelection.Add(index);
        _runStatus = $"首领牌库已选择 {_bossDeckSelection.Count}/{required} 张";
    }

    private void ConfirmBossDeck()
    {
        const int required = 15;
        if (_bossDeckSelection.Count != required) throw new InvalidOperationException($"需要选择 {required} 张牌。 ");
        BeginRunCombat();
    }

    private void ConfigureRunCardPools(RunState run)
    {
        var className = CharacterClass(_runCharacterId);
        var combatCards = _runCards.Where(card => card.Semantic == RunCardSemantic.Combat).ToArray();
        // 商店池 = 网页 generateShopStock 的 lib：滤 衍生 稀有度与 unrandom（weight 掷档/pickOfRarity
        // 在 RunState 侧再做 isRandomObtainable 过滤）；掉落池 = DROP_TYPES 五类（武术/法术/装备/道具/资源，
        // 含 unrandom 卡——宠物蛋/钻石不进随机挑选，但宝箱按 id 直取时需要找到卡对象）。
        run.ConfigureShopCardPool(_runCards.Where(card => card.Rarity != "衍生" && !card.Unrandom));
        run.ConfigureClassCardPool(combatCards.Where(card => card.Type != "能力卡" && _catalog.TryGet(card.Id, out var definition) && definition?.ClassName == className));
        run.ConfigureLootCardPool(_runCards.Where(card => card.Semantic is RunCardSemantic.Combat or RunCardSemantic.Item or RunCardSemantic.Equipment or RunCardSemantic.Resource));
        // 事件卡池 = 卡牌库中类型「事件」的卡（网页 runEventDeck 的 deck；10 个 tt6 + 修鞋铺）
        run.ConfigureEventCardPool(_runCards.Where(card => card.Type == "事件"));
    }

    private static IReadOnlyList<(string Name, int Count)> BuildInitialLoadout(RunBaseState state, int capacity)
    {
        var selections = new List<(string Name, int Count)>();
        var remaining = capacity;
        foreach (var stack in state.Stash)
        {
            if (remaining <= 0) break;
            var count = Math.Min(stack.Count, remaining);
            selections.Add((stack.Card.Name, count));
            remaining -= count;
        }
        return selections;
    }

    private RunActionUiSnapshot[] BuildBaseActions(RunBaseState state)
    {
        // 批次 5：网页基地「升级」页 = 背包升级 + 宠物升级（保险升级已移除，base.js BASE_MIGRATIONS 1→2）。
        // 安全格容量随携带宠物等级与 safeBonus（RunBaseState.SafeCapacity），不再走口粮升级。
        var actions = new List<RunActionUiSnapshot>
        {
            new() { Id = "upgrade:bag", Label = "扩充背包", Detail = $"2 木材 · {state.BagCapacity}/{RunRules.BagMax}", Enabled = state.Wood >= RunRules.BagUpgradeWood && state.BagCapacity < RunRules.BagMax },
            new() { Id = "upgrade:stash", Label = "扩充仓库", Detail = $"2 木材 · {state.StashCapacity}/{RunRules.StashMax}", Enabled = state.Wood >= RunRules.StashUpgradeWood && state.StashCapacity < RunRules.StashMax },
            new() { Id = "pet:hatch", Label = "孵化宠物", Detail = $"1 张宠物蛋 + {_data.Pets.HatchCost} 币（随机、不重复）", Enabled = state.Stash.Any(x => x.Card.Id == _data.Pets.EggId) && state.Coins >= _data.Pets.HatchCost && state.Pets.Count < _data.Pets.List.Count }
        };
        foreach (var pet in _data.Pets.List)
        {
            if (!state.Pets.ContainsKey(pet.Id)) continue;
            var level = state.PetLevel(pet.Id);
            actions.Add(new RunActionUiSnapshot
            {
                Id = $"pet:up:{pet.Id}",
                Label = $"升级宠物：{pet.Name}",
                Detail = $"Lv.{level} · {PetSystem.UpgradeCost(_data.Pets, level)} 口粮 → Lv.{level + 1}",
                Enabled = state.CanUpgradePet(pet.Id)
            });
            actions.Add(new RunActionUiSnapshot
            {
                Id = $"pet:sel:{pet.Id}",
                Label = state.PetSel == pet.Id ? $"已携带：{pet.Name}" : $"携带：{pet.Name}",
                Detail = pet.Desc,
                Enabled = state.PetSel != pet.Id
            });
        }
        return actions.ToArray();
    }

    private RunActionUiSnapshot[] BuildRunActions(RunState run)
    {
        var actions = new List<RunActionUiSnapshot>();
        switch (run.Phase)
        {
            case RunPhase.Ready:
            {
                var mapLayer = run.Map.Layers[run.LayerIndex];
                foreach (var neighbor in mapLayer.NeighborsOf(run.TrackPosition))
                    actions.Add(new RunActionUiSnapshot { Id = $"move:{neighbor}", Label = $"前往：{mapLayer.NameAt(neighbor)}", Detail = $"{neighbor + 1} 号节点 · {RoomLabel(mapLayer.TypeAt(neighbor))}" });
                actions.Add(new RunActionUiSnapshot { Id = "roll", Label = "前往相邻节点", Detail = "直选移动：默认取第一个相邻节点" });
                if (mapLayer.TypeAt(run.TrackPosition) == RunRoomType.Boss)
                {
                    // 首脑格（网页版 openBossGate）：未激活祭坛时封印，激活后可挑战
                    if (!run.AltarActivated)
                        actions.Add(new RunActionUiSnapshot { Id = "boss:sealed", Label = "首脑巢穴 · 封印中", Detail = Soudache.RunState.AltarLockedMessage, Enabled = false });
                    else
                        actions.AddRange(run.Map.Bosses.Select((boss, index) => new RunActionUiSnapshot
                        {
                            Id = $"boss:{index}",
                            Label = run.BossKilled ? $"{boss.Name}（已击败）" : $"挑战 {boss.Name}",
                            Detail = $"{boss.Attack}-{boss.Hp} · 胜利后终局撤离点放行",
                            Enabled = !run.BossKilled
                        }));
                }
                if (run.Resources.Rations > 0 && run.Stamina < run.MaxStamina)
                    actions.Add(new RunActionUiSnapshot { Id = "ration", Label = "使用口粮", Detail = "恢复 3 点体力" });
                actions.AddRange(run.OwnedCards.Where(stack => !stack.Safe).Select(stack => new RunActionUiSnapshot { Id = $"safeadd:{stack.Card.Name}", Label = $"放入安全袋：{stack.Card.Name}", Detail = $"×{stack.Count}", Enabled = run.OwnedCards.Where(x => x.Safe).Sum(x => x.Count) < run.Base.SafeCapacity }));
                actions.AddRange(run.OwnedCards.Where(stack => stack.Safe).Select(stack => new RunActionUiSnapshot { Id = $"saferemove:{stack.Card.Name}", Label = $"移出安全袋：{stack.Card.Name}", Detail = $"×{stack.Count}" }));
                if (run.Turns == 0)
                {
                    actions.AddRange(run.Base.Stash.Select(stack => new RunActionUiSnapshot { Id = $"load:{stack.Card.Name}", Label = $"从仓库携带：{stack.Card.Name}", Detail = $"仓库 ×{stack.Count}", Enabled = run.BackpackUsed < run.BackpackCapacity }));
                    actions.AddRange(run.OwnedCards.Where(stack => !stack.Safe && !stack.Card.IsInitialAttack).Select(stack => new RunActionUiSnapshot { Id = $"unload:{stack.Card.Name}", Label = $"放回仓库：{stack.Card.Name}", Detail = $"×{stack.Count}", Enabled = run.Base.StashRoom > 0 }));
                }
                break;
            }
            case RunPhase.Battle:
                if (_bossDeckPool.Count > 0)
                {
                    actions.AddRange(_bossDeckPool.Select((card, index) => new RunActionUiSnapshot
                    {
                        Id = $"bossdeck:{index}",
                        Label = (_bossDeckSelection.Contains(index) ? "✓ " : "") + card.Name,
                        Detail = card.Rarity,
                        Enabled = _bossDeckSelection.Contains(index) || _bossDeckSelection.Count < Math.Min(15, _bossDeckPool.Count)
                    }));
                    actions.Add(new RunActionUiSnapshot { Id = "bossdeck:confirm", Label = "确认首领牌库", Detail = $"已选 {_bossDeckSelection.Count}/{Math.Min(15, _bossDeckPool.Count)} + 初始攻击 5", Enabled = _bossDeckSelection.Count == Math.Min(15, _bossDeckPool.Count) });
                }
                else actions.Add(new RunActionUiSnapshot { Id = "battle", Label = "进入战斗", Detail = $"敌人 {run.Encounter.Count} 名" });
                break;
            case RunPhase.Event:
                // 事件页（批次 4c）：ink 选项 event:{index}；修鞋铺复原子流程改列口袋卡 event:restore:{名}+继续
                if (run.EventRestorePending)
                {
                    foreach (var name in run.EventRestorableCards)
                        actions.Add(new RunActionUiSnapshot { Id = $"event:restore:{name}", Label = $"复原：{name}", Detail = "修鞋铺 · 从消耗口袋复原 1 张回背包" });
                    actions.Add(new RunActionUiSnapshot { Id = "event:continue", Label = "继 续", Detail = "完成事件（消耗口袋没有可复原的卡牌时）" });
                }
                else
                    actions.AddRange(run.EventChoices.Select((choice, index) => new RunActionUiSnapshot { Id = $"event:{index}", Label = choice.Label, Detail = choice.Detail }));
                break;
            case RunPhase.Chest:
            {
                var preview = run.ChestPreview ?? run.PeekNextChest();
                actions.AddRange(preview.Candidates.Select((name, index) => new RunActionUiSnapshot { Id = $"chest:{index}", Label = preview.Kind == "medium" ? $"选择 {name}" : "开启宝箱", Detail = preview.Kind }));
                break;
            }
            case RunPhase.Campfire:
                if (run.UsedPocket.Count == 0) actions.Add(new RunActionUiSnapshot { Id = "campfire:", Label = "完成休整", Detail = "+8 生命" });
                else actions.AddRange(run.UsedPocket.Take(RunRules.CampfireRestorePocket).Select(stack => new RunActionUiSnapshot { Id = $"campfire:{stack.Card.Name}", Label = $"恢复 {stack.Card.Name}", Detail = "+8 生命" }));
                break;
            case RunPhase.Shop:
                actions.AddRange(run.Shop.Select(offer => new RunActionUiSnapshot
                {
                    Id = $"shop:{offer.Id}",
                    Label = offer.Sold
                        ? (offer.ShaReplenish is { } spent && spent <= 0 ? "初始攻击已补满" : "已售出")
                        : offer.Card?.Name ?? "无货",
                    Detail = !offer.Sold && offer.ShaReplenish is { } left
                        ? $"{offer.Price} 币 · 初始攻击 · 本站余 {Math.Max(0, left)}/5"
                        : !offer.Sold && offer.IsMystery ? $"{offer.Price} 币 · 神秘货箱：开出随机卡牌"
                        : $"{offer.Price} 币",
                    Enabled = !offer.Sold && run.Resources.Coins >= offer.Price
                }));
                actions.Add(new RunActionUiSnapshot { Id = "shop:leave", Label = "离开商店" });
                break;
            case RunPhase.AwaitingDoor:
                if (run.CurrentDoor?.CanEnter == true) actions.Add(new RunActionUiSnapshot { Id = "door:enter", Label = $"进入{run.CurrentDoor.Label}" });
                if (run.CurrentDoor?.CanExtract == true) actions.Add(new RunActionUiSnapshot { Id = "door:extract", Label = "立即撤离" });
                actions.Add(new RunActionUiSnapshot { Id = "door:stay", Label = "留在本层" });
                break;
            case RunPhase.Altar:
            {
                // 祭坛仪式（网页版 openAltarRitual/openAltarReward）
                if (run.PendingAltarReward)
                {
                    actions.Add(new RunActionUiSnapshot { Id = "altar:reward:0", Label = "① 复原 3 张消耗卡 + 回复 10 血", Detail = "从消耗口袋复原卡牌回背包，并回复 10 点生命", Enabled = run.UsedPocket.Any(x => x.Card.Semantic is not (RunCardSemantic.Item or RunCardSemantic.Equipment)) });
                    actions.Add(new RunActionUiSnapshot { Id = "altar:reward:1", Label = "② 传说卡 + 装备卡", Detail = "随机获取 1 张传说卡和 1 张装备卡" });
                }
                else if (!run.AltarActivated)
                {
                    foreach (var stack in run.OwnedCards)
                        actions.Add(new RunActionUiSnapshot
                        {
                            Id = $"altar:pick:{stack.Card.Name}",
                            Label = $"{(_altarSacrificePicks.Contains(stack.Card.Name) ? "✓ " : "")}献祭：{stack.Card.Name}",
                            Detail = $"×{stack.Count} · 弃 {RunRules.AltarDiscardCards} 张激活祭坛"
                        });
                    actions.Add(new RunActionUiSnapshot { Id = "altar:activate", Label = "弃 3 张 · 激活祭坛", Detail = "激活后二选一：① 复原 3 张消耗卡 + 回复 10 血；② 随机传说卡 + 装备卡", Enabled = _altarSacrificePicks.Count == RunRules.AltarDiscardCards });
                    actions.Add(new RunActionUiSnapshot { Id = "altar:frag", Label = "献上 2 枚彩色令牌碎片（不弃牌）", Detail = $"现有碎片 {run.Fragments}/2 · 获得本职业随机卡并激活", Enabled = run.Fragments >= RunRules.AltarFragmentCost });
                    foreach (var stack in run.OwnedCards.Where(x => x.Card.Semantic == RunCardSemantic.Item))
                        actions.Add(new RunActionUiSnapshot { Id = $"altar:itemrestore:{stack.Card.Name}", Label = $"献祭道具：{stack.Card.Name}", Detail = "献祭 1 张道具卡，从消耗口袋复原 2 张（可重复）" });
                }
                actions.Add(new RunActionUiSnapshot { Id = "altar:leave", Label = run.AltarActivated ? "离开祭坛" : "离开", Detail = run.AltarActivated ? "" : "祭坛保持沉睡——稍后再来" });
                break;
            }
            case RunPhase.Settlement:
                actions.AddRange(run.SettlementCards.Select((entry, index) => new RunActionUiSnapshot { Id = $"settle:{index}", Label = entry.Deposited ? $"{entry.Card.Name}（已入库）" : $"存入 {entry.Card.Name} ×{entry.Count}", Enabled = !entry.Deposited }));
                actions.AddRange(BuildBaseActions(run.Base));
                actions.Add(new RunActionUiSnapshot { Id = "settle:finish", Label = "完成结算", Enabled = run.SettlementCards.All(entry => entry.Deposited) });
                break;
        }
        actions.AddRange(run.PendingRewards.Select(stack => new RunActionUiSnapshot { Id = $"claim:{stack.Card.Name}", Label = $"收取 {stack.Card.Name}", Detail = $"待收取 ×{stack.Count}" }));
        actions.AddRange(run.RecoveryCards.Select(stack => new RunActionUiSnapshot { Id = $"recovery:{stack.Card.Name}", Label = $"找回 {stack.Card.Name}", Detail = "安全袋保留" }));
        return actions.ToArray();
    }

    private static string ReadResourceText(string path)
    {
        using var file = Godot.FileAccess.Open(path, Godot.FileAccess.ModeFlags.Read);
        if (file == null)
            throw new System.IO.FileNotFoundException($"无法读取 Godot 资源：{path}（{Godot.FileAccess.GetOpenError()}）", path);
        return file.GetAsText();
    }

    private IReadOnlyList<RunCard> LoadRunCards(string json)
    {
        // ported from cards.js isSellable / sellPrice / rarityOf + data-loader 契约：
        //   isSellable：sellable 字段优先（true/false 原样）；无字段时描述「不可出售」→否
        //   （优先于「可出售」），「可出售」→是，其余一律不可出售。
        //   sellPrice：币值 value 优先；无币值按稀有度半价（至少 1），能力卡系（hero/tokenOf 链）
        //   展示稀有度按「棱彩」（rarityOf）。
        using var document = JsonDocument.Parse(json);
        var nodes = document.RootElement.GetProperty("cards").EnumerateArray().ToList();
        var result = new List<RunCard>(nodes.Count);
        var rarityById = new Dictionary<string, string>(StringComparer.Ordinal);
        var tokenOfById = new Dictionary<string, string>(StringComparer.Ordinal);
        var heroIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var card in nodes)
        {
            var id = card.GetProperty("id").GetString() ?? "unknown";
            var name = card.TryGetProperty("name", out var nameNode) ? nameNode.GetString() ?? id : id;
            var type = card.TryGetProperty("type", out var typeNode) ? typeNode.GetString() ?? "武术" : "武术";
            var rarity = card.TryGetProperty("rarity", out var rarityNode) ? rarityNode.GetString() ?? "古朴" : "古朴";
            var cls = card.TryGetProperty("cls", out var clsNode) ? clsNode.GetString() : null;
            var desc = card.TryGetProperty("desc", out var descNode) && descNode.ValueKind == JsonValueKind.String ? descNode.GetString() ?? "" : "";
            var value = card.TryGetProperty("value", out var valueNode) && valueNode.TryGetInt32(out var parsed) ? parsed : 0;
            var unrandom = card.TryGetProperty("unrandom", out var unrandomNode) && unrandomNode.ValueKind == JsonValueKind.True;
            rarityById[id] = rarity;
            if (card.TryGetProperty("tokenOf", out var tokenNode) && tokenNode.ValueKind == JsonValueKind.String)
                tokenOfById[id] = tokenNode.GetString() ?? "";
            if (card.TryGetProperty("hero", out var heroNode) && heroNode.ValueKind == JsonValueKind.True) heroIds.Add(id);
            bool sellable;
            if (card.TryGetProperty("sellable", out var sellableNode) && sellableNode.ValueKind is JsonValueKind.True or JsonValueKind.False)
                sellable = sellableNode.ValueKind == JsonValueKind.True;
            else if (desc.Contains("不可出售", StringComparison.Ordinal)) sellable = false;
            else sellable = desc.Contains("可出售", StringComparison.Ordinal);
            string? material = type == "资源" ? (name.Contains("木", StringComparison.Ordinal) ? "wood" : name.Contains("口粮", StringComparison.Ordinal) ? "rations" : name.Contains("钥匙", StringComparison.Ordinal) ? "keys" : null) : null;
            result.Add(new RunCard(id, name, type, rarity, value, sellable, id == "builtin-sha", material) { Unrandom = unrandom, Cls = cls });
        }
        // 第二遍：无币值卡按 rarityOf 半价回填（cards.js sellPrice 的兜底公式）
        string RarityOf(string id)
        {
            for (var depth = 0; depth < 8 && rarityById.ContainsKey(id); depth++)
            {
                if (heroIds.Contains(id)) return "棱彩";
                if (tokenOfById.TryGetValue(id, out var source) && rarityById.ContainsKey(source)) { id = source; continue; }
                return rarityById[id];
            }
            return "古朴";
        }
        for (var index = 0; index < result.Count; index++)
        {
            var card = result[index];
            if (card.SellPrice > 0) continue;
            result[index] = card with { SellPrice = Math.Max(1, _data.CardPrice(RarityOf(card.Id)) / 2) };
        }
        _rarityById = rarityById;   // rider [6c→A]：PublishBattle 的 HandCardRarities 信号源
        return result;
    }

    private string CharacterClass(string id) => _data.Character(id)?.Class ?? string.Empty;

    private static List<JsonElement> SerializeSnapshots(IReadOnlyList<RunCardSnapshot>? snapshots)
        => snapshots?.Select(snapshot => JsonSerializer.SerializeToElement(snapshot)).ToList() ?? new List<JsonElement>();

    private static RunCardSnapshot[] DeserializeSnapshots(IEnumerable<JsonElement> elements)
        => elements.Select(element => element.Deserialize<RunCardSnapshot>() ?? throw new SaveFormatException("存档卡牌数据无效。")).ToArray();

    private static BaseStateDto ToDto(RunBaseSnapshot snapshot) => new()
    {
        Wood = snapshot.Wood, Rations = snapshot.Rations, Keys = snapshot.Keys, Coins = snapshot.Coins,
        BagUp = snapshot.BagUpgrade, SafeUp = snapshot.SafeUpgrade, StashUp = snapshot.StashUpgrade,
        Stash = snapshot.Stash.Select(ToStackDto).ToList(), Pocket = snapshot.Pocket.Select(ToStackDto).ToList(),
        Collection = snapshot.Collection.ToDictionary(name => name, name => new CollectionEntryDto { Name = name }, StringComparer.Ordinal),
        // 批次 5：宠物 + 收藏室（对齐网页基地档 pets/petSel/collClaimed/collXp）
        Pets = (snapshot.Pets ?? Array.Empty<PetSnapshot>()).ToDictionary(pet => pet.Id,
            pet => new PetStateDto { Lv = pet.Lv, Ts = pet.Ts }, StringComparer.Ordinal),
        PetSel = snapshot.PetSel,
        CollClaimed = (snapshot.CollClaimed ?? (IReadOnlySet<string>)new HashSet<string>()).ToDictionary(id => id, _ => true, StringComparer.Ordinal),
        CollXp = (snapshot.CollXp ?? (IReadOnlySet<string>)new HashSet<string>()).ToDictionary(id => id, _ => true, StringComparer.Ordinal)
    };

    private static CardStackDto ToStackDto(RunCardSnapshot snapshot) => new() { Card = JsonSerializer.SerializeToElement(snapshot), Count = snapshot.Count };

    private static RunBaseState FromDto(BaseStateDto dto)
    {
        var state = new RunBaseState();
        RunCardSnapshot ReadStack(CardStackDto stack)
        {
            var value = stack.Card.Deserialize<RunCardSnapshot>() ?? throw new SaveFormatException("基地卡牌数据无效。");
            return value with { Count = stack.Count };
        }
        state.RestoreSnapshot(new RunBaseSnapshot(dto.Wood, dto.Rations, dto.Keys, dto.Coins, dto.BagUp, dto.SafeUp, dto.StashUp,
            dto.Stash.Select(ReadStack).ToArray(), dto.Pocket.Select(ReadStack).ToArray(), new HashSet<string>(dto.Collection.Keys, StringComparer.Ordinal),
            dto.Pets.Select(pair => new PetSnapshot(pair.Key, pair.Value.Lv, pair.Value.Ts)).ToArray(), dto.PetSel,
            new HashSet<string>(dto.CollClaimed.Where(pair => pair.Value).Select(pair => pair.Key), StringComparer.Ordinal),
            new HashSet<string>(dto.CollXp.Where(pair => pair.Value).Select(pair => pair.Key), StringComparer.Ordinal),
            new Dictionary<string, ClassProgress>(dto.Classes.Select(pair => KeyValuePair.Create(pair.Key,
                new ClassProgress(Math.Max(1, pair.Value.Lv), Math.Max(0, pair.Value.Xp)))), StringComparer.Ordinal)));
        return state;
    }

    private static string TargetKind(CardDefinition definition)
    {
        if (definition.Effects.Any(effect => effect.Target is EffectTarget.SelectedEnemy or EffectTarget.SelectedAny)) return "enemy";
        if (definition.Effects.Any(effect => effect.Target == EffectTarget.Self && effect.Kind is CardEffectKind.Heal or CardEffectKind.Armor or CardEffectKind.Block or CardEffectKind.Guard or CardEffectKind.Purify or CardEffectKind.ApplyStatus)) return "self";
        return "none";
    }

    private int CharacterIndex(string id) => _data.Character(id)?.Index ?? -1;
    private string CharacterName(string id) => _data.Character(id)?.Name ?? "未选择角色";
    private static string PhaseLabel(RunPhase phase) => phase switch { RunPhase.Ready => "探索", RunPhase.Battle => "战斗", RunPhase.Shop => "商店", RunPhase.Campfire => "营火", RunPhase.Chest => "宝箱", RunPhase.Event => "事件", RunPhase.AwaitingDoor => "门扉", RunPhase.Altar => "祭坛", RunPhase.Victory => "胜利", RunPhase.Defeat => "失败", _ => phase.ToString() };
    private static string RoomLabel(RunRoomType type) => type switch { RunRoomType.Entrance => "入口", RunRoomType.Battle => "战斗", RunRoomType.Event => "事件", RunRoomType.Shop => "补给站", RunRoomType.Campfire => "火堆", RunRoomType.Chest => "搜刮点", RunRoomType.EmergencyExit => "紧急撤离", RunRoomType.Door => "层间门", RunRoomType.Altar => "祭坛", RunRoomType.Boss => "首脑", RunRoomType.Extraction => "终局撤离", RunRoomType.Coin => "金币", RunRoomType.Wood => "木材", RunRoomType.Rations => "口粮", RunRoomType.Key => "钥匙", _ => "荒径" };

    /// <summary>节点类型字符串（对齐网页版 map-generator 的 def.type，供 6c 地图渲染着色）。</summary>
    private static string NodeUiType(RunRoomType type) => type switch
    {
        RunRoomType.Entrance => "entrance", RunRoomType.Battle => "battle", RunRoomType.Event => "event",
        RunRoomType.Shop => "shop", RunRoomType.Campfire => "fire", RunRoomType.Chest => "chest",
        RunRoomType.EmergencyExit => "emergencyExit", RunRoomType.Door => "door", RunRoomType.Altar => "altar",
        RunRoomType.Boss => "boss", RunRoomType.Extraction => "extraction", _ => "unknown"
    };

    private static string CurrentRunRoomLabel(RunLayer layer, int position) => RoomLabel(layer.TypeAt(position));
}
