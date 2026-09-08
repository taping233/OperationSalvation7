using System;

namespace Soudache;

public sealed class DamageAction : IGameAction
{
    public string ActionId => "damage";
    public StableId TargetId { get; }
    public int Amount { get; }
    public DamageResult? Result { get; private set; }

    public DamageAction(StableId targetId, int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        TargetId = targetId;
        Amount = amount;
    }

    public void Execute(ActionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        Result = context.Combat.DealDamage(TargetId, Amount);
    }
}

public sealed class BlockAction : IGameAction
{
    public string ActionId => "block";
    public StableId TargetId { get; }
    public int Amount { get; }

    public BlockAction(StableId targetId, int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        TargetId = targetId;
        Amount = amount;
    }

    public void Execute(ActionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Combat.AddBlock(TargetId, Amount);
    }
}

public sealed class HealAction : IGameAction
{
    public string ActionId => "heal";
    public StableId TargetId { get; }
    public int Amount { get; }
    public int Restored { get; private set; }

    public HealAction(StableId targetId, int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        TargetId = targetId;
        Amount = amount;
    }

    public void Execute(ActionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        Restored = context.Combat.RestoreHealth(TargetId, Amount);
    }
}
