using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Godot;
using Soudache;

namespace SoudacheGodot.App;

/// Minimal composition root proving that exported Soudache data, the pure C# core,
/// and the Godot hand UI can run together. Unsupported card effects remain data-only.
public sealed class CoreGameAdapter : ICoreUiPort
{
    private readonly Dictionary<StableId, CardDefinition> _definitions = new();
    private readonly CardDeck _deck = new();
    private readonly DeterministicRng _rng = new(0xC0D3_0007UL);
    private readonly CombatState _combat;
    private readonly StableId _playerId = "player.frostwing";
    private readonly StableId _enemyId = "enemy.training-dummy";
    private int _energy = 3;
    private string _status = "已接入搜打撤 Core：请选择一张牌";

    public event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    public event Action<RunUiSnapshot>? RunSnapshotChanged;

    public CoreGameAdapter()
    {
        _combat = new CombatState(_playerId);
        _combat.AddCombatant(new CombatantState(_playerId, "霜翎", 30, false));
        _combat.AddCombatant(new CombatantState(_enemyId, "训练靶机", 36, true));
        LoadStarterDeck();
        _combat.StartPlayerTurn();
        _deck.Draw(5, _rng);
    }

    public void RequestPlayCard(string cardId)
    {
        var instance = _deck.Hand.FirstOrDefault(card => card.InstanceId.Value == cardId);
        if (instance is null || !_definitions.TryGetValue(instance.DefinitionId, out var definition))
        {
            _status = "该卡牌实例已不在手牌中";
            PublishCurrentState();
            return;
        }

        var cost = instance.EffectiveCost(definition);
        if (cost > _energy)
        {
            _status = $"能量不足：{definition.DisplayName} 需要 {cost}";
            PublishCurrentState();
            return;
        }

        _energy -= cost;
        if (definition.Damage > 0) _combat.Actions.Enqueue(new DamageAction(_enemyId, definition.Damage));
        if (definition.Block > 0) _combat.Actions.Enqueue(new BlockAction(_playerId, definition.Block));
        if (definition.Heal > 0) _combat.Actions.Enqueue(new HealAction(_playerId, definition.Heal));
        _combat.ResolveActions();
        _deck.TryPlay(instance.InstanceId, definition);
        if (definition.Draw > 0) _deck.Draw(definition.Draw, _rng);
        _status = $"已打出 {definition.DisplayName}；目标生命 {_combat.GetCombatant(_enemyId).Health}";
        PublishCurrentState();
    }

    public void RequestEndTurn()
    {
        _deck.DiscardHand();
        _combat.StartEnemyTurn();
        if (_combat.Phase != CombatPhase.Victory)
        {
            _combat.Actions.Enqueue(new DamageAction(_playerId, 2));
            _combat.ResolveActions();
        }
        if (_combat.Phase is not (CombatPhase.Victory or CombatPhase.Defeat))
        {
            _combat.StartPlayerTurn();
            _energy = 3;
            _deck.Draw(5, _rng);
            _status = "新回合：敌方造成 2 点伤害";
        }
        else
        {
            _status = _combat.Phase == CombatPhase.Victory ? "战斗胜利" : "战斗失败";
        }
        PublishCurrentState();
    }

    public void RequestPileView(string pileKey)
    {
        _status = pileKey == "draw"
            ? $"牌库剩余 {_deck.DrawPile.Count} 张"
            : $"弃牌堆 {_deck.Discard.Count} 张";
        PublishCurrentState();
    }

    public void PublishCurrentState()
    {
        var player = _combat.GetCombatant(_playerId);
        RunSnapshotChanged?.Invoke(new RunUiSnapshot
        {
            CharacterId = "shuangling",
            CharacterDisplayName = "霜翎",
            LayerIndex = 0,
            TrackPosition = 0,
            CurrentHp = player.Health,
            MaxHp = player.MaxHealth
        });
        BattleSnapshotChanged?.Invoke(new BattleUiSnapshot
        {
            Turn = _combat.Turn,
            Energy = _energy,
            MaxEnergy = 3,
            DrawPileCount = _deck.DrawPile.Count,
            DiscardPileCount = _deck.Discard.Count,
            StatusText = _status,
            HandCardIds = _deck.Hand.Select(card => card.InstanceId.Value).ToArray(),
            HandCardLabels = _deck.Hand.Select(card => _definitions[card.DefinitionId].DisplayName).ToArray()
        });
    }

    private void LoadStarterDeck()
    {
        var jsonPath = ProjectSettings.GlobalizePath("res://data/cards.json");
        using var document = JsonDocument.Parse(System.IO.File.ReadAllText(jsonPath));
        var preferredIds = new HashSet<string>(StringComparer.Ordinal)
        {
            "builtin-sha", "tt7-arcanebolt", "tt7-bulwark", "tt7-fullstrike",
            "tt7-energize", "tt7-ghostblade", "tt7-marchrush", "tt7-smite",
            "tt7-stealth", "tt6-relief", "cc-unmoved", "cc-chargefb"
        };

        var cards = document.RootElement.GetProperty("cards").EnumerateArray()
            .Where(card => preferredIds.Contains(card.GetProperty("id").GetString() ?? string.Empty))
            .Take(12)
            .ToArray();
        if (cards.Length < 5)
            throw new System.IO.InvalidDataException("The exported Soudache card catalog does not contain enough starter cards.");

        var instances = new List<CardInstance>();
        for (var index = 0; index < cards.Length; index++)
        {
            var card = cards[index];
            var definitionId = new StableId(card.GetProperty("id").GetString()!);
            var definition = new CardDefinition(
                definitionId,
                card.GetProperty("name").GetString() ?? definitionId.Value,
                MapCardType(card.GetProperty("type").GetString()),
                Math.Max(0, ReadInt(card, "cost")),
                Math.Max(0, ReadInt(card, "dmg")),
                Math.Max(0, ReadInt(card, "armor")),
                Math.Max(0, ReadInt(card, "heal")),
                Math.Max(0, ReadInt(card, "draw")));
            _definitions.Add(definitionId, definition);
            instances.Add(new CardInstance(new StableId($"battle.card.{index}"), definitionId));
        }
        _rng.Shuffle(instances);
        _deck.AddToDrawPile(instances);
    }

    private static int ReadInt(JsonElement card, string propertyName)
        => card.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.Number
            ? property.GetInt32()
            : 0;

    private static CardType MapCardType(string? type) => type switch
    {
        "武术" => CardType.Attack,
        "法术" => CardType.Skill,
        "装备" => CardType.Equipment,
        "资源" => CardType.Resource,
        "事件" => CardType.Event,
        _ => CardType.Skill
    };
}
