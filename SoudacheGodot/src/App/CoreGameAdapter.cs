using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;
using Soudache;

namespace SoudacheGodot.App;

/// Composition root joining exported Soudache content, pure C# run/combat state,
/// five-slot saves, and Godot presentation without putting rules in Control nodes.
public sealed class CoreGameAdapter : ICoreUiPort
{
    private const ulong DefaultSeed = 0xC0D3_0007UL;
    private readonly StableId _playerId = "player.expedition";
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

    public event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    public event Action<RunUiSnapshot>? RunSnapshotChanged;
    public event Action<SaveSlotsUiSnapshot>? SaveSlotsChanged;

    public CoreGameAdapter()
    {
        var cardsPath = ProjectSettings.GlobalizePath("res://data/cards.json");
        _catalog = CardCatalog.LoadFile(cardsPath);
        _runCards = LoadRunCards(cardsPath);
        _base.SeedStarterStash(_runCards.Where(card => card.Semantic == RunCardSemantic.Combat));
        _saves = new AtomicJsonSaveService(ProjectSettings.GlobalizePath("user://saves"));
        CreateCombat(new[] { new RunEnemy("training", "训练靶机", 36, 2) }, 30);
    }

    public void RequestStartRun(string characterId)
    {
        _runCharacterId = characterId;
        _run = new RunState(DefaultSeed + (ulong)Math.Max(0, CharacterIndex(characterId)), baseState: _base);
        ConfigureRunCardPools(_run);
        _run.TakeCardsFromBase(BuildInitialLoadout(_base, Math.Max(0, _run.BackpackCapacity - 5)));
        if (_runCards.FirstOrDefault(card => card.Id == "builtin-sha") is { } starterAttack)
            if (!_run.AddCard(starterAttack, 5)) throw new InvalidOperationException("背包无法装入 5 张初始攻击。");
        _lastRoll = 0;
        _runStatus = $"{CharacterName(characterId)} 已进入外环";
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
            var roll = _run.Roll();
            _lastRoll = roll.Dice;
            _runStatus = $"掷出 {roll.Dice}，移动至第 {roll.Layer + 1} 层 {roll.ToPosition + 1} 号节点";
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
                case "battle":
                    _runStatus = "请切换到战斗页继续";
                    break;
                case "event":
                {
                    var result = _run.ChooseEvent(int.Parse(argument));
                    _runStatus = result.Text;
                    PrepareCurrentRoom();
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
                case "campfire":
                    _run.CompleteCampfire(argument.Length == 0 ? null : new[] { argument });
                    _runStatus = $"营火休整完成，生命 {_run.Hp}/{_run.MaxHp}";
                    break;
                case "door":
                    if (argument == "enter") _run.EnterDoor();
                    else if (argument == "stay") _run.StayAtDoor();
                    else if (argument == "extract") _run.ExtractAtDoor();
                    _runStatus = argument == "extract" ? "已抵达撤离结算" : "门扉选择已确认";
                    break;
                case "altar":
                    if (argument == "leave") { _run.LeaveAltar(); _runStatus = "离开污染核心"; }
                    else if (argument == "extract") { _run.Extract(); _runStatus = "已抵达撤离结算"; }
                    else
                    {
                        var available = _run.OwnedCards.Where(stack => stack.Card.Semantic is RunCardSemantic.Combat or RunCardSemantic.Equipment && !stack.Card.IsInitialAttack).Sum(stack => stack.Count);
                        if (available < 15) throw new InvalidOperationException($"挑战首领需要 15 张非道具牌，当前只有 {available} 张。");
                        _run.ChallengeBoss(int.Parse(argument));
                        PrepareBossDeckSelection();
                    }
                    break;
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
        var upgraded = actionId switch
        {
            "upgrade:bag" => target.UpgradeBag(),
            "upgrade:safe" => target.UpgradeSafe(),
            "upgrade:stash" => target.UpgradeStash(),
            _ => false
        };
        _runStatus = upgraded ? "基地设施升级完成" : "资源不足或设施已满级";
        PublishCurrentState();
    }

    public void RequestPlayCard(string cardId, string? targetId, string[] infusionFuelIds)
    {
        if (!TryCurrentEnemy(out var enemy) && string.IsNullOrWhiteSpace(targetId))
        {
            _battleStatus = "当前没有可选敌人";
            PublishCurrentState();
            return;
        }
        CardPlayResult result;
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

    public void RequestSaveSlot(int slot)
    {
        try
        {
            if (_run is { Phase: not (RunPhase.Ready or RunPhase.Settlement) })
                throw new InvalidOperationException("请先完成当前房间结算，再保存远征。");
            var run = _run?.CaptureSnapshot();
            var player = _combat.GetCombatant(_playerId);
            _saves.Save(slot, new SaveGameDto
            {
                Seed = run?.Seed ?? DefaultSeed,
                RngState = run?.RngState ?? _combat.Rng.State,
                LayerIdx = run?.LayerIndex ?? 0,
                TrackPos = run?.TrackPosition ?? 0,
                Hp = run?.Hp ?? player.Health,
                MaxHp = RunRules.PlayerMaxHp,
                Coins = run?.Coins ?? 0,
                Keys = run?.Keys ?? 0,
                Wood = run?.Wood ?? 0,
                Rations = run?.Rations ?? 0,
                Stamina = run?.Stamina ?? RunRules.StaminaMax,
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
            _saveStatus = $"已保存到档位 {slot + 1}";
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
                    DeserializeSnapshots(snapshot.UsedPocket), DeserializeSnapshots(snapshot.Inventory), settlement))
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
        var player = new CombatantState(_playerId, CharacterName(_runCharacterId), RunRules.PlayerMaxHp, false) { Attack = 4 };
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
            if (_run?.Phase == RunPhase.Battle) _run.CompleteBattle(false, 0);
            _runStatus = "远征失败";
        }
    }

    private void PublishRun()
    {
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
                Actions = BuildBaseActions(_base)
            });
            return;
        }
        var layer = _run.Map.Layers[_run.LayerIndex];
        var nodes = Enumerable.Range(0, layer.RingSize).Select(index =>
        {
            var room = layer.RoomAt(index);
            if (layer.DoorAt(index) != null) room = new RunRoom(RunRoomType.Door);
            if (layer.HasAltarEntrance(index)) room = new RunRoom(RunRoomType.AltarEntrance);
            return new MapNodeUiSnapshot
            {
                Index = index,
                Type = room.Type.ToString().ToLowerInvariant(),
                Label = RoomLabel(room.Type),
                IsCurrent = index == _run.TrackPosition
            };
        }).ToArray();
        RunSnapshotChanged?.Invoke(new RunUiSnapshot
        {
            CharacterId = _runCharacterId,
            CharacterDisplayName = CharacterName(_runCharacterId),
            LayerIndex = _run.LayerIndex,
            TrackPosition = _run.TrackPosition,
            CurrentHp = _run.Phase == RunPhase.Battle ? _combat.GetCombatant(_playerId).Health : _run.Hp,
            MaxHp = _run.MaxHp,
            TrackLength = layer.RingSize,
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
            Nodes = nodes
        });
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
            HandCardLabels = _deck.Hand.Select(card =>
            {
                var definition = _catalog.GetRequired(card.DefinitionId);
                return $"{definition.DisplayName}  [{card.EffectiveCost(definition)}]";
            }).ToArray()
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

    private void SyncNormalConsumedCards()
    {
        if (_bossCombat || _run == null) return;
        foreach (var entry in _normalCardNames.ToArray())
        {
            if (_deck.TryGetZone(entry.Key, out var zone) && zone == CardZone.Hand) continue;
            if (_run.MoveCardToPocket(entry.Value)) _normalCardNames.Remove(entry.Key);
        }
    }

    private static EnemyAffix EnemyAffixFor(StableId enemyId)
    {
        var id = enemyId.Value;
        if (id.Contains("boss_general", StringComparison.Ordinal)) return EnemyAffix.Grow;
        if (id.Contains("boss_orc", StringComparison.Ordinal)) return EnemyAffix.Frenzy;
        if (id.Contains("boss_elem", StringComparison.Ordinal)) return EnemyAffix.ElementalAegis;
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
        run.ConfigureShopCardPool(combatCards.Where(card => card.Rarity != "传说"));
        run.ConfigureClassCardPool(combatCards.Where(card => card.Type != "英雄卡" && _catalog.TryGet(card.Id, out var definition) && definition?.ClassName == className));
        run.ConfigureLootCardPool(_runCards.Where(card => card.Semantic is RunCardSemantic.Combat or RunCardSemantic.Item or RunCardSemantic.Equipment));
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

    private static RunActionUiSnapshot[] BuildBaseActions(RunBaseState state) => new[]
    {
        new RunActionUiSnapshot { Id = "upgrade:bag", Label = "扩充背包", Detail = $"2 木材 · {state.BagCapacity}/{RunRules.BagMax}", Enabled = state.Wood >= RunRules.BagUpgradeWood && state.BagCapacity < RunRules.BagMax },
        new RunActionUiSnapshot { Id = "upgrade:safe", Label = "扩充安全袋", Detail = $"2 口粮 · {state.SafeCapacity}/{RunRules.SafeMax}", Enabled = state.Rations >= RunRules.SafeUpgradeRations && state.SafeCapacity < RunRules.SafeMax },
        new RunActionUiSnapshot { Id = "upgrade:stash", Label = "扩充仓库", Detail = $"2 木材 · {state.StashCapacity}/{RunRules.StashMax}", Enabled = state.Wood >= RunRules.StashUpgradeWood && state.StashCapacity < RunRules.StashMax }
    };

    private RunActionUiSnapshot[] BuildRunActions(RunState run)
    {
        var actions = new List<RunActionUiSnapshot>();
        switch (run.Phase)
        {
            case RunPhase.Ready:
                actions.Add(new RunActionUiSnapshot { Id = "roll", Label = "掷骰前进", Detail = "消耗 1 点体力" });
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
                    Id = $"shop:{offer.Id}", Label = offer.Sold ? "已售出" : offer.Card?.Name ?? RoomLabel(offer.Resource),
                    Detail = $"{offer.Price} 金币", Enabled = !offer.Sold && run.Resources.Coins >= offer.Price
                }));
                actions.Add(new RunActionUiSnapshot { Id = "shop:leave", Label = "离开商店" });
                break;
            case RunPhase.AwaitingDoor:
                if (run.CurrentDoor?.CanEnter == true) actions.Add(new RunActionUiSnapshot { Id = "door:enter", Label = $"进入{run.CurrentDoor.Label}" });
                if (run.CurrentDoor?.CanExtract == true) actions.Add(new RunActionUiSnapshot { Id = "door:extract", Label = "立即撤离" });
                actions.Add(new RunActionUiSnapshot { Id = "door:stay", Label = "留在本层" });
                break;
            case RunPhase.Altar:
                actions.AddRange(run.Map.Bosses.Select((boss, index) => new RunActionUiSnapshot { Id = $"altar:{index}", Label = run.DefeatedBosses.Contains(index) ? $"{boss.Name}（已击败）" : $"挑战 {boss.Name}", Enabled = !run.DefeatedBosses.Contains(index) }));
                actions.Add(new RunActionUiSnapshot { Id = "altar:leave", Label = "返回环带" });
                if (run.DefeatedBosses.Count == run.Map.Bosses.Count) actions.Add(new RunActionUiSnapshot { Id = "altar:extract", Label = "完成远征" });
                break;
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

    private static IReadOnlyList<RunCard> LoadRunCards(string path)
    {
        using var document = JsonDocument.Parse(System.IO.File.ReadAllText(path));
        return document.RootElement.GetProperty("cards").EnumerateArray().Select(card =>
        {
            var id = card.GetProperty("id").GetString() ?? "unknown";
            var name = card.TryGetProperty("name", out var nameNode) ? nameNode.GetString() ?? id : id;
            var type = card.TryGetProperty("type", out var typeNode) ? typeNode.GetString() ?? "武术" : "武术";
            var rarity = card.TryGetProperty("rarity", out var rarityNode) ? rarityNode.GetString() ?? "古朴" : "古朴";
            var sellable = card.TryGetProperty("sellable", out var sellableNode) && sellableNode.ValueKind == JsonValueKind.True;
            var value = card.TryGetProperty("value", out var valueNode) && valueNode.TryGetInt32(out var parsed) ? parsed : 1;
            string? material = type == "资源" ? (name.Contains("木", StringComparison.Ordinal) ? "wood" : name.Contains("口粮", StringComparison.Ordinal) ? "rations" : name.Contains("钥匙", StringComparison.Ordinal) ? "keys" : null) : null;
            return new RunCard(id, name, type, rarity, Math.Max(1, value), sellable, id == "builtin-sha", material);
        }).ToArray();
    }

    private static string CharacterClass(string id) => id switch { "shuangling" => "侠客", "baiqi" => "降临者", "lituan" => "法师", "xuanli" => "战士", "dengkui" => "牧师", _ => string.Empty };

    private static List<JsonElement> SerializeSnapshots(IReadOnlyList<RunCardSnapshot>? snapshots)
        => snapshots?.Select(snapshot => JsonSerializer.SerializeToElement(snapshot)).ToList() ?? new List<JsonElement>();

    private static RunCardSnapshot[] DeserializeSnapshots(IEnumerable<JsonElement> elements)
        => elements.Select(element => element.Deserialize<RunCardSnapshot>() ?? throw new SaveFormatException("存档卡牌数据无效。")).ToArray();

    private static BaseStateDto ToDto(RunBaseSnapshot snapshot) => new()
    {
        Wood = snapshot.Wood, Rations = snapshot.Rations, Keys = snapshot.Keys, Coins = snapshot.Coins,
        BagUp = snapshot.BagUpgrade, SafeUp = snapshot.SafeUpgrade, StashUp = snapshot.StashUpgrade,
        Stash = snapshot.Stash.Select(ToStackDto).ToList(), Pocket = snapshot.Pocket.Select(ToStackDto).ToList(),
        Collection = snapshot.Collection.ToDictionary(name => name, name => new CollectionEntryDto { Name = name }, StringComparer.Ordinal)
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
            dto.Stash.Select(ReadStack).ToArray(), dto.Pocket.Select(ReadStack).ToArray(), new HashSet<string>(dto.Collection.Keys, StringComparer.Ordinal)));
        return state;
    }

    private static string TargetKind(CardDefinition definition)
    {
        if (definition.Effects.Any(effect => effect.Target is EffectTarget.SelectedEnemy or EffectTarget.SelectedAny)) return "enemy";
        if (definition.Effects.Any(effect => effect.Target == EffectTarget.Self && effect.Kind is CardEffectKind.Heal or CardEffectKind.Armor or CardEffectKind.Block or CardEffectKind.Guard or CardEffectKind.Purify or CardEffectKind.ApplyStatus)) return "self";
        return "none";
    }

    private static int CharacterIndex(string id) => id switch { "shuangling" => 0, "baiqi" => 1, "lituan" => 2, "xuanli" => 3, "dengkui" => 4, _ => -1 };
    private static string CharacterName(string id) => id switch { "shuangling" => "霜翎", "baiqi" => "白契", "lituan" => "栗团", "xuanli" => "玄砾", "dengkui" => "灯葵", _ => "未选择角色" };
    private static string PhaseLabel(RunPhase phase) => phase switch { RunPhase.Ready => "探索", RunPhase.Battle => "战斗", RunPhase.Shop => "商店", RunPhase.Campfire => "营火", RunPhase.Chest => "宝箱", RunPhase.Event => "事件", RunPhase.AwaitingDoor => "门扉", RunPhase.Altar => "祭坛", RunPhase.Victory => "胜利", RunPhase.Defeat => "失败", _ => phase.ToString() };
    private static string RoomLabel(RunRoomType type) => type switch { RunRoomType.Coin => "金币", RunRoomType.Wood => "木材", RunRoomType.Rations => "口粮", RunRoomType.Key => "钥匙", RunRoomType.Battle => "战斗", RunRoomType.Event => "事件", RunRoomType.Shop => "商店", RunRoomType.Campfire => "营火", RunRoomType.Chest => "宝箱", RunRoomType.EmergencyExit => "撤离", RunRoomType.Door => "门", RunRoomType.AltarEntrance => "祭坛入口", _ => "荒径" };

    private static string CurrentRunRoomLabel(RunLayer layer, int position)
    {
        if (layer.HasAltarEntrance(position)) return RoomLabel(RunRoomType.AltarEntrance);
        if (layer.DoorAt(position) != null) return RoomLabel(RunRoomType.Door);
        return RoomLabel(layer.RoomAt(position).Type);
    }
}
