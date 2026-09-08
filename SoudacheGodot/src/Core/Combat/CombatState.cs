using System;
using System.Collections.Generic;

namespace Soudache;

public enum CombatPhase
{
    Setup,
    PlayerTurn,
    EnemyTurn,
    Victory,
    Defeat
}

public sealed class CombatantState
{
    public StableId Id { get; }
    public string Name { get; }
    public bool IsEnemy { get; }
    public int MaxHealth { get; }
    public int Health { get; private set; }
    public int Block { get; private set; }
    public bool IsDefeated => Health <= 0;

    public CombatantState(StableId id, string name, int maxHealth, bool isEnemy)
    {
        if (maxHealth <= 0) throw new ArgumentOutOfRangeException(nameof(maxHealth));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        Id = id;
        Name = name.Trim();
        IsEnemy = isEnemy;
        MaxHealth = maxHealth;
        Health = maxHealth;
    }

    public void AddBlock(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        Block = checked(Block + amount);
    }

    public DamageResult ApplyDamage(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        var absorbed = Math.Min(Block, amount);
        Block -= absorbed;
        var healthDamage = Math.Min(Health, amount - absorbed);
        Health -= healthDamage;
        return new DamageResult(amount, absorbed, healthDamage, Health, IsDefeated);
    }

    public int Heal(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        var restored = Math.Min(amount, MaxHealth - Health);
        Health += restored;
        return restored;
    }

    public void ClearBlock() => Block = 0;
}

public readonly struct DamageResult
{
    public int Attempted { get; }
    public int Blocked { get; }
    public int HealthDamage { get; }
    public int RemainingHealth { get; }
    public bool Defeated { get; }

    public DamageResult(int attempted, int blocked, int healthDamage, int remainingHealth, bool defeated)
    {
        Attempted = attempted;
        Blocked = blocked;
        HealthDamage = healthDamage;
        RemainingHealth = remainingHealth;
        Defeated = defeated;
    }
}

/// <summary>Minimal deterministic combat model; presentation and Godot nodes stay outside this class.</summary>
public sealed class CombatState
{
    private readonly Dictionary<StableId, CombatantState> _combatants = new();
    private readonly List<CombatantState> _ordered = new();

    public StableId PlayerId { get; }
    public CombatPhase Phase { get; private set; } = CombatPhase.Setup;
    public int Turn { get; private set; }
    public ActionQueue Actions { get; } = new();
    public IReadOnlyList<CombatantState> Combatants => _ordered;

    public CombatState(StableId playerId) => PlayerId = playerId;

    public void AddCombatant(CombatantState combatant)
    {
        ArgumentNullException.ThrowIfNull(combatant);
        if (_combatants.ContainsKey(combatant.Id))
            throw new InvalidOperationException($"Combatant id '{combatant.Id}' is already present.");
        _combatants.Add(combatant.Id, combatant);
        _ordered.Add(combatant);
    }

    public CombatantState GetCombatant(StableId id) => _combatants.TryGetValue(id, out var value)
        ? value
        : throw new KeyNotFoundException($"Unknown combatant '{id}'.");

    public bool TryGetCombatant(StableId id, out CombatantState? combatant) => _combatants.TryGetValue(id, out combatant);

    public void StartPlayerTurn()
    {
        if (Phase is CombatPhase.Victory or CombatPhase.Defeat)
            throw new InvalidOperationException("A finished combat cannot start another turn.");
        Phase = CombatPhase.PlayerTurn;
        Turn = checked(Turn + 1);
        GetCombatant(PlayerId).ClearBlock();
    }

    public void StartEnemyTurn()
    {
        if (Phase is CombatPhase.Victory or CombatPhase.Defeat)
            throw new InvalidOperationException("A finished combat cannot start another turn.");
        Phase = CombatPhase.EnemyTurn;
    }

    /// <summary>Restores a validated save snapshot without replaying turn side effects.</summary>
    public void RestoreTurnState(int turn, CombatPhase phase)
    {
        if (turn < 0) throw new ArgumentOutOfRangeException(nameof(turn));
        if (phase is CombatPhase.Setup or CombatPhase.PlayerTurn or CombatPhase.EnemyTurn or CombatPhase.Victory or CombatPhase.Defeat)
        {
            Turn = turn;
            Phase = phase;
            return;
        }
        throw new ArgumentOutOfRangeException(nameof(phase));
    }

    public int ResolveActions() => Actions.Drain(new ActionContext(this));

    public DamageResult DealDamage(StableId targetId, int amount)
    {
        var result = GetCombatant(targetId).ApplyDamage(amount);
        UpdateOutcome();
        return result;
    }

    public int AddBlock(StableId targetId, int amount)
    {
        var target = GetCombatant(targetId);
        target.AddBlock(amount);
        return target.Block;
    }

    public int RestoreHealth(StableId targetId, int amount) => GetCombatant(targetId).Heal(amount);

    public void UpdateOutcome()
    {
        var player = GetCombatant(PlayerId);
        if (player.IsDefeated)
        {
            Phase = CombatPhase.Defeat;
            return;
        }
        var hasLivingEnemy = false;
        foreach (var combatant in _ordered)
            if (combatant.IsEnemy && !combatant.IsDefeated) { hasLivingEnemy = true; break; }
        if (!hasLivingEnemy && _ordered.Count > 1) Phase = CombatPhase.Victory;
    }
}
