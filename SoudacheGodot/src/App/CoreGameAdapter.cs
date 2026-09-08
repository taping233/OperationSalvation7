using System;
using System.Collections.Generic;
using System.Linq;
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
    private readonly AtomicJsonSaveService _saves;
    private CardDeck _deck = new();
    private CombatState _combat = null!;
    private CardPlayEngine _cardPlay = null!;
    private RunState? _run;
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
        _catalog = CardCatalog.LoadFile(ProjectSettings.GlobalizePath("res://data/cards.json"));
        _saves = new AtomicJsonSaveService(ProjectSettings.GlobalizePath("user://saves"));
        CreateCombat(new[] { new RunEnemy("training", "训练靶机", 36, 2) }, 30);
    }

    public void RequestStartRun(string characterId)
    {
        _runCharacterId = characterId;
        _run = new RunState(DefaultSeed + (ulong)Math.Max(0, CharacterIndex(characterId)));
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
            if (_run.Phase == RunPhase.Battle) BeginRunCombat();
        }
        catch (Exception error)
        {
            _runStatus = error.Message;
        }
        PublishCurrentState();
    }

    public void RequestResolveRoom()
    {
        if (_run == null)
        {
            _runStatus = "尚未开始远征";
            PublishCurrentState();
            return;
        }
        try
        {
            _runStatus = _run.Phase switch
            {
                RunPhase.Ready => "当前节点已结算，可以继续掷骰",
                RunPhase.Battle => "战斗尚未结束，请进入战斗界面",
                RunPhase.Event => ResolveEvent(),
                RunPhase.Chest => OpenChest(),
                RunPhase.Campfire => CompleteCampfire(),
                RunPhase.Shop => LeaveShop(),
                RunPhase.AwaitingDoor => EnterDoor(),
                RunPhase.Altar => ChallengeNextBoss(),
                RunPhase.Victory => "远征胜利，战利品已准备返还基地",
                RunPhase.Defeat => "远征失败",
                _ => PhaseLabel(_run.Phase)
            };
        }
        catch (Exception error)
        {
            _runStatus = error.Message;
        }
        PublishCurrentState();
    }

    public void RequestPlayCard(string cardId)
    {
        if (!TryCurrentEnemy(out var enemy))
        {
            _battleStatus = "当前没有可选敌人";
            PublishCurrentState();
            return;
        }
        CardPlayResult result;
        try
        {
            result = _cardPlay.TryPlay(new StableId(cardId), new[] { enemy.Id });
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
        _battleStatus = $"卡牌已结算；{enemy.Name} 剩余 {enemy.Health} 点生命";
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
        _deck.DiscardHand();
        _combat.StartEnemyTurn();
        foreach (var enemy in _combat.Combatants.Where(unit => unit.IsEnemy && !unit.IsDefeated))
        {
            if (_combat.CanAct(enemy.Id))
                _combat.DealDamage(enemy.Id, _playerId, enemy.Attack, DamageType.Attack);
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
            _deck.Draw(Math.Min(1, Math.Max(0, 8 - _deck.Hand.Count)), _combat.Rng);
            _battleStatus = "敌方回合已结算；抽取 1 张牌";
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
            if (_run is { Phase: not RunPhase.Ready })
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
            _run = snapshot.RunActive
                ? RunState.FromSnapshot(new RunSnapshot(snapshot.Seed, snapshot.RngState, snapshot.LayerIdx,
                    snapshot.TrackPos, snapshot.Turn, snapshot.Stamina, snapshot.Hp, snapshot.Coins,
                    snapshot.Keys, snapshot.Wood, snapshot.Rations, RunPhase.Ready))
                : null;
            _deck = snapshot.Deck.ToRuntime();
            _combat = snapshot.Combat?.ToRuntime() ?? CreateCombatState(Array.Empty<RunEnemy>(), snapshot.Hp);
            if (_combat.MaxEnergy == 0) _combat.SetEnergy(2, 2);
            if (_deck.Count == 0)
            {
                _deck = BuildStarterDeck();
                _deck.Draw(5, _combat.Rng);
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
        _combat = CreateCombatState(enemies, playerHp);
        _deck = BuildStarterDeck();
        _combat.StartPlayerTurn();
        _combat.SetEnergy(2, 2);
        _deck.Draw(5, _combat.Rng);
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

    private CardDeck BuildStarterDeck()
    {
        var preferredIds = new[]
        {
            "builtin-sha", "tt7-arcanebolt", "tt7-bulwark", "tt7-fullstrike",
            "tt7-energize", "tt7-ghostblade", "tt7-marchrush", "tt7-smite",
            "tt7-stealth", "tt6-relief", "cc-unmoved", "cc-chargefb"
        };
        var deck = new CardDeck();
        var instances = preferredIds.Where(id => _catalog.TryGet(id, out _))
            .Select((id, index) => new CardInstance(new StableId($"battle.card.{index}"), new StableId(id)))
            .ToList();
        if (instances.Count < 5) throw new InvalidOperationException("导出的卡牌目录缺少起始牌组。");
        _combat?.Rng.Shuffle(instances);
        deck.AddToDrawPile(instances);
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
            RunSnapshotChanged?.Invoke(new RunUiSnapshot { StatusText = _runStatus });
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
            Phase = PhaseLabel(_run.Phase),
            CurrentRoom = CurrentRunRoomLabel(layer, _run.TrackPosition),
            StatusText = _runStatus,
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
            StatusText = _battleStatus,
            HandCardIds = _deck.Hand.Select(card => card.InstanceId.Value).ToArray(),
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

    private string ResolveEvent()
    {
        var result = _run!.ResolveEvent();
        return result.Text;
    }

    private string OpenChest()
    {
        var loot = _run!.OpenNextChest();
        return $"开启{loot.Kind}宝箱：{loot.Coins} 币，{string.Join("、", loot.Items)}";
    }

    private string CompleteCampfire() { _run!.CompleteCampfire(); return $"营火休整完成，生命 {_run.Hp}/{_run.MaxHp}"; }
    private string LeaveShop() { _run!.LeaveShop(); return "离开商店"; }
    private string EnterDoor()
    {
        var room = _run!.Map.Layers[_run.LayerIndex].RoomAt(_run.TrackPosition);
        if (room.Type == RunRoomType.EmergencyExit)
        {
            _run.ExtractAtDoor();
            return "已从紧急出口撤离";
        }
        _run.EnterDoor();
        return $"进入第 {_run.LayerIndex + 1} 层";
    }

    private string ChallengeNextBoss()
    {
        int? index = Enumerable.Range(0, _run!.Map.Bosses.Count).Cast<int?>().FirstOrDefault(candidate => candidate.HasValue && !_run.DefeatedBosses.Contains(candidate.Value));
        if (!index.HasValue)
        {
            _run.Extract();
            return "所有首领均已击败，远征胜利";
        }
        _run.ChallengeBoss(index.Value);
        BeginRunCombat();
        return $"挑战 {_run.Map.Bosses[index.Value].Name}";
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
