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
    public int MaxHealth { get; private set; }
    public int Health { get; private set; }
    public int Block { get; private set; }
    public int Armor { get; private set; }
    public int Attack { get; set; }
    public int SpellPower { get; set; }
    public bool Guard { get; private set; }
    public bool ElementalAegis { get; private set; }
    private readonly Dictionary<CombatStatus, int> _statuses = new();
    private readonly List<(CombatStatus Status, int Amount, int Turns)> _timedStatuses = new();
    public IReadOnlyDictionary<CombatStatus, int> Statuses => _statuses;
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

    public void AddArmor(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        Armor = checked(Armor + amount);
    }

    public void Defeat() => Health = 0;

    public void IncreaseMaxHealth(int amount, bool heal = true)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        MaxHealth = checked(MaxHealth + amount);
        if (heal) Health = Math.Min(MaxHealth, Health + amount);
    }

    public void SetGuard(bool enabled) => Guard = enabled;
    public void SetElementalAegis(bool enabled) => ElementalAegis = enabled;

    public int GetStatus(CombatStatus status) => _statuses.TryGetValue(status, out var value) ? value : 0;

    public int AddStatus(CombatStatus status, int amount = 1, int duration = 0)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        if (duration < 0) throw new ArgumentOutOfRangeException(nameof(duration));
        var old = GetStatus(status);
        var stacked = status is CombatStatus.Bleed or CombatStatus.Poison or CombatStatus.DamageReduction or CombatStatus.AttackUp or CombatStatus.SpellUp;
        var next = stacked ? checked(old + amount) : Math.Max(old, duration > 0 ? duration : amount);
        _statuses[status] = next;
        if (duration > 0 && (status is CombatStatus.DamageReduction or CombatStatus.AttackUp or CombatStatus.SpellUp))
            _timedStatuses.Add((status, amount, duration));
        return next;
    }

    public bool HasStatus(CombatStatus status) => GetStatus(status) > 0;

    public void ClearStatus(CombatStatus status)
    {
        _statuses.Remove(status);
        _timedStatuses.RemoveAll(x => x.Status == status);
    }

    public int TickPoison()
    {
        var stacks = GetStatus(CombatStatus.Poison);
        if (stacks <= 0 || HasStatus(CombatStatus.Immune)) return 0;
        Health = Math.Max(0, Health - stacks);
        return stacks;
    }

    public IReadOnlyList<CombatStatus> TickDurations()
    {
        var expired = new List<CombatStatus>();
        foreach (var status in new[] { CombatStatus.Freeze, CombatStatus.Silence, CombatStatus.ArmorBreak, CombatStatus.HealingBan, CombatStatus.Stealth, CombatStatus.Immune })
        {
            if (!_statuses.TryGetValue(status, out var value) || value <= 0) continue;
            value--;
            if (value == 0) { _statuses.Remove(status); expired.Add(status); }
            else _statuses[status] = value;
        }
        for (var i = _timedStatuses.Count - 1; i >= 0; i--)
        {
            var timed = _timedStatuses[i];
            timed.Turns--;
            if (timed.Turns <= 0)
            {
                _statuses[timed.Status] = Math.Max(0, GetStatus(timed.Status) - timed.Amount);
                if (_statuses[timed.Status] == 0) _statuses.Remove(timed.Status);
                _timedStatuses.RemoveAt(i);
                expired.Add(timed.Status);
            }
            else _timedStatuses[i] = timed;
        }
        return expired;
    }

    public bool CanAct => !HasStatus(CombatStatus.Freeze);
    public bool IsStealthed => HasStatus(CombatStatus.Stealth);
    public bool BreakStealth()
    {
        if (!IsStealthed) return false;
        ClearStatus(CombatStatus.Stealth);
        return true;
    }

    public int Purify()
    {
        var count = 0;
        foreach (var status in new[] { CombatStatus.Bleed, CombatStatus.Poison, CombatStatus.Freeze, CombatStatus.Silence, CombatStatus.ArmorBreak, CombatStatus.HealingBan })
            if (HasStatus(status)) { ClearStatus(status); count++; }
        _timedStatuses.Clear();
        return count;
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

    public DamageResult ApplyDamage(int amount, DamageType type, CombatantState? source)
    {
        if (HasStatus(CombatStatus.Immune) || (ElementalAegis && !HasStatus(CombatStatus.ArmorBreak))) return new DamageResult(amount, 0, 0, Health, IsDefeated, type, true, false);
        if (IsStealthed) return new DamageResult(amount, 0, 0, Health, IsDefeated, type, false, true);
        var damage = amount;
        if (type == DamageType.Attack)
            damage += (source?.Attack ?? 0) + (source?.GetStatus(CombatStatus.AttackUp) ?? 0);
        else if (type == DamageType.Spell)
            damage += (source?.SpellPower ?? 0) + (source?.GetStatus(CombatStatus.SpellUp) ?? 0);
        if (type == DamageType.Attack) damage += GetStatus(CombatStatus.Bleed);
        damage = Math.Max(0, damage);
        var guarded = false;
        if (Guard && type != DamageType.True && !HasStatus(CombatStatus.ArmorBreak) && damage > 1)
        {
            damage = 1;
            guarded = true;
        }
        var reduced = 0;
        if (type != DamageType.True && HasStatus(CombatStatus.DamageReduction))
        {
            reduced = Math.Min(damage, GetStatus(CombatStatus.DamageReduction));
            damage -= reduced;
        }
        var absorbed = 0;
        if (type != DamageType.True && !HasStatus(CombatStatus.ArmorBreak))
        {
            var fromBlock = Math.Min(Block, damage);
            Block -= fromBlock; damage -= fromBlock; absorbed += fromBlock;
            var fromArmor = Math.Min(Armor, damage);
            Armor -= fromArmor; damage -= fromArmor; absorbed += fromArmor;
        }
        var healthDamage = Math.Min(Health, Math.Max(0, damage));
        Health -= healthDamage;
        return new DamageResult(amount, absorbed, healthDamage, Health, IsDefeated, type, false, false, guarded, reduced);
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
    public DamageType Type { get; }
    public bool Immune { get; }
    public bool Stealthed { get; }
    public bool Guarded { get; }
    public int Reduced { get; }

    public DamageResult(int attempted, int blocked, int healthDamage, int remainingHealth, bool defeated)
        : this(attempted, blocked, healthDamage, remainingHealth, defeated, DamageType.Fixed, false, false, false, 0) { }

    public DamageResult(int attempted, int blocked, int healthDamage, int remainingHealth, bool defeated,
        DamageType type, bool immune, bool stealthed, bool guarded = false, int reduced = 0)
    {
        Attempted = attempted;
        Blocked = blocked;
        HealthDamage = healthDamage;
        RemainingHealth = remainingHealth;
        Defeated = defeated;
        Type = type;
        Immune = immune;
        Stealthed = stealthed;
        Guarded = guarded;
        Reduced = reduced;
    }
}

/// <summary>Minimal deterministic combat model; presentation and Godot nodes stay outside this class.</summary>
public sealed class CombatState
{
    private readonly Dictionary<StableId, CombatantState> _combatants = new();
    private readonly List<CombatantState> _ordered = new();
    private readonly List<(int Turns, CardEffectAction Action, bool Repeat)> _scheduledEffects = new();
    private int _generatedId;
    private readonly List<StableId> _equipped = new();
    private readonly HashSet<StableId> _countedDefeats = new();
    private readonly HashSet<StableId> _killAttackSources = new();
    private readonly HashSet<StableId> _infusionRewardSources = new();

    public StableId PlayerId { get; }
    public CombatPhase Phase { get; private set; } = CombatPhase.Setup;
    public int Turn { get; private set; }
    public DeterministicRng Rng { get; } = new(0xC0D3_0007UL);
    public int Energy { get; private set; }
    public int MaxEnergy { get; private set; }
    public string? LastPlayedCardType { get; private set; }
    public int ExtraTurns { get; private set; }
    public int InfusionCount { get; private set; }
    public int NextSpellRepeat { get; private set; } = 1;
    public int SpellCastEnergyReward { get; private set; }
    public int LastDamageBatchHealth { get; private set; }
    public IReadOnlyList<StableId> EquippedCards => _equipped;
    public ActionQueue Actions { get; } = new();
    public IReadOnlyList<CombatantState> Combatants => _ordered;

    public CombatState(StableId playerId) => PlayerId = playerId;

    public int NextGeneratedId() => checked(++_generatedId);

    public void ScheduleEffect(int turns, CardEffectAction action, bool repeat = false)
    {
        if (turns < 0) throw new ArgumentOutOfRangeException(nameof(turns));
        ArgumentNullException.ThrowIfNull(action);
        _scheduledEffects.Add((turns, action, repeat));
    }

    /// <summary>Advances delayed card effects by one turn and appends due actions to the FIFO queue.</summary>
    public int AdvanceTurn()
    {
        var due = 0;
        for (var i = _scheduledEffects.Count - 1; i >= 0; i--)
        {
            var scheduled = _scheduledEffects[i];
            scheduled.Turns--;
            if (scheduled.Turns <= 0)
            {
                Actions.Enqueue(scheduled.Action);
                if (scheduled.Repeat) _scheduledEffects[i] = (1, scheduled.Action, true);
                else _scheduledEffects.RemoveAt(i);
                due++;
            }
            else _scheduledEffects[i] = scheduled;
        }
        return due;
    }

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

    public void SetEnergy(int energy, int maxEnergy)
    {
        if (energy < 0 || maxEnergy < 0 || energy > maxEnergy)
            throw new ArgumentOutOfRangeException(nameof(energy));
        Energy = energy;
        MaxEnergy = maxEnergy;
    }

    public int AddEnergy(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        var gained = Math.Min(amount, Math.Max(0, MaxEnergy - Energy));
        Energy = checked(Energy + gained);
        return gained;
    }

    public void SetLastPlayedCardType(string? type) => LastPlayedCardType = type;
    public void GrantExtraTurn() => ExtraTurns = checked(ExtraTurns + 1);
    public void IncreaseEnergyCap(int amount) { if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount)); MaxEnergy = checked(MaxEnergy + amount); Energy = checked(Energy + amount); }
    public void Equip(StableId cardId) { if (!_equipped.Contains(cardId)) _equipped.Add(cardId); }
    public void CoverWeapons(StableId cardId) { _equipped.Clear(); _equipped.Add(cardId); }
    public void RegisterKillAttackBonus(StableId sourceId) => _killAttackSources.Add(sourceId);
    public void RegisterInfusionReward(StableId sourceId) => _infusionRewardSources.Add(sourceId);
    public void RecordInfusion()
    {
        InfusionCount = checked(InfusionCount + 1);
        if (InfusionCount != 3) return;
        foreach (var sourceId in _infusionRewardSources)
            if (TryGetCombatant(sourceId, out var source) && source is not null)
                source.AddStatus(CombatStatus.SpellUp, 2);
    }
    public void SetNextSpellRepeat(int count)
    {
        if (count < 1) throw new ArgumentOutOfRangeException(nameof(count));
        NextSpellRepeat = count;
    }
    public int ConsumeNextSpellRepeat()
    {
        var count = NextSpellRepeat;
        NextSpellRepeat = 1;
        return count;
    }
    public void RegisterSpellCastEnergy(int amount = 1)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        SpellCastEnergyReward = checked(SpellCastEnergyReward + amount);
    }
    public int RecordSpellCast()
    {
        var amount = SpellCastEnergyReward;
        if (amount > 0) AddEnergy(amount);
        return amount;
    }
    public void BeginDamageBatch() => LastDamageBatchHealth = 0;

    public bool TrySpendEnergy(int amount)
    {
        if (amount < 0 || amount > Energy) return false;
        Energy -= amount;
        return true;
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
        var result = GetCombatant(targetId).ApplyDamage(amount, DamageType.Fixed, null);
        LastDamageBatchHealth = checked(LastDamageBatchHealth + result.HealthDamage);
        UpdateOutcome();
        return result;
    }

    public DamageResult DealDamage(StableId sourceId, StableId targetId, int amount, DamageType type)
    {
        var source = TryGetCombatant(sourceId, out var attacker) ? attacker : null;
        var result = GetCombatant(targetId).ApplyDamage(amount, type, source);
        LastDamageBatchHealth = checked(LastDamageBatchHealth + result.HealthDamage);
        UpdateOutcome();
        return result;
    }

    public int AddBlock(StableId targetId, int amount)
    {
        var target = GetCombatant(targetId);
        target.AddBlock(amount);
        return target.Block;
    }

    public int AddArmor(StableId targetId, int amount)
    {
        var target = GetCombatant(targetId);
        target.AddArmor(amount);
        return target.Armor;
    }

    public void SetGuard(StableId targetId, bool enabled = true) => GetCombatant(targetId).SetGuard(enabled);

    public int AddStatus(StableId targetId, CombatStatus status, int amount = 1, int duration = 0)
        => GetCombatant(targetId).AddStatus(status, amount, duration);

    public int TickPoison(StableId targetId)
    {
        var damage = GetCombatant(targetId).TickPoison();
        UpdateOutcome();
        return damage;
    }

    public IReadOnlyList<CombatStatus> TickDurations(StableId targetId) => GetCombatant(targetId).TickDurations();

    public bool CanAct(StableId targetId) => GetCombatant(targetId).CanAct;

    public bool BreakStealth(StableId targetId) => GetCombatant(targetId).BreakStealth();

    public int RestoreHealth(StableId targetId, int amount)
    {
        var target = GetCombatant(targetId);
        return target.HasStatus(CombatStatus.HealingBan) ? 0 : target.Heal(amount);
    }

    public void UpdateOutcome()
    {
        foreach (var combatant in _ordered)
            if (combatant.IsEnemy && combatant.IsDefeated && _countedDefeats.Add(combatant.Id))
                foreach (var sourceId in _killAttackSources)
                    if (TryGetCombatant(sourceId, out var source) && source is not null && !source.IsDefeated)
                        source.Attack = checked(source.Attack + 1);
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
