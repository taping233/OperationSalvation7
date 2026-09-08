using System;

namespace Soudache;

/// <summary>Runtime card identity. Definition ids are stable; instance ids distinguish duplicates.</summary>
public sealed class CardInstance
{
    public StableId InstanceId { get; }
    public StableId DefinitionId { get; }
    public int UpgradeLevel { get; private set; }
    public int? CostOverride { get; private set; }

    public CardInstance(StableId instanceId, StableId definitionId, int upgradeLevel = 0, int? costOverride = null)
    {
        if (!instanceId.IsValid) throw new ArgumentException("A card instance needs a stable id.", nameof(instanceId));
        if (!definitionId.IsValid) throw new ArgumentException("A card instance needs a definition id.", nameof(definitionId));
        if (upgradeLevel < 0) throw new ArgumentOutOfRangeException(nameof(upgradeLevel));
        if (costOverride is < 0) throw new ArgumentOutOfRangeException(nameof(costOverride));
        InstanceId = instanceId;
        DefinitionId = definitionId;
        UpgradeLevel = upgradeLevel;
        CostOverride = costOverride;
    }

    public int EffectiveCost(CardDefinition definition)
    {
        if (definition.Id != DefinitionId)
            throw new ArgumentException("The definition does not match this card instance.", nameof(definition));
        return Math.Max(0, CostOverride ?? definition.Cost);
    }

    public void Upgrade(int levels = 1)
    {
        if (levels < 0) throw new ArgumentOutOfRangeException(nameof(levels));
        UpgradeLevel = checked(UpgradeLevel + levels);
    }

    public void OverrideCost(int? cost)
    {
        if (cost is < 0) throw new ArgumentOutOfRangeException(nameof(cost));
        CostOverride = cost;
    }
}
