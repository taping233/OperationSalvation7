using System;

namespace Soudache;

public enum EnemyAffix
{
    None,
    Grow,
    Frenzy,
    ElementalAegis
}

/// <summary>Deterministic enemy action planner for the original normal and three boss affixes.</summary>
public static class EnemyTurnResolver
{
    public static int EnqueueTurn(CombatState combat, StableId enemyId, EnemyAffix affix = EnemyAffix.None)
    {
        ArgumentNullException.ThrowIfNull(combat);
        var enemy = combat.GetCombatant(enemyId);
        if (!enemy.IsEnemy || enemy.IsDefeated || !enemy.CanAct) return 0;
        enemy.SetElementalAegis(affix == EnemyAffix.ElementalAegis && combat.Turn % 2 == 0);
        var attacks = affix == EnemyAffix.Frenzy ? 2 : 1;
        for (var i = 0; i < attacks; i++)
        {
            var curse = affix == EnemyAffix.Frenzy
                ? (combat.Rng.NextInt(2) == 0 ? CombatStatus.Bleed : CombatStatus.Poison)
                : (CombatStatus?)null;
            // Enemy attack power is supplied by the attacker formula; the base card amount is zero.
            combat.Actions.Enqueue(new EnemyAttackAction(enemyId, combat.PlayerId, 0, curse));
        }
        if (affix == EnemyAffix.Grow) enemy.Attack = checked(enemy.Attack + 2);
        return attacks;
    }
}

public sealed class EnemyAttackAction : IGameAction
{
    public string ActionId => "enemy.attack";
    public StableId SourceId { get; }
    public StableId TargetId { get; }
    public int Amount { get; }
    public CombatStatus? Curse { get; }

    public EnemyAttackAction(StableId sourceId, StableId targetId, int amount, CombatStatus? curse = null)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        SourceId = sourceId; TargetId = targetId; Amount = amount; Curse = curse;
    }

    public void Execute(ActionContext context)
    {
        var result = context.Combat.DealDamage(SourceId, TargetId, Amount, DamageType.Attack);
        if (Curse is not null && !result.Immune && !result.Stealthed)
            context.Combat.AddStatus(TargetId, Curse.Value, 1);
    }
}
