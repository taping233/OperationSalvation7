using System;

namespace Soudache;

/// <summary>Runtime card identity. Definition ids are stable; instance ids distinguish duplicates.</summary>
public sealed class CardInstance
{
    public StableId InstanceId { get; }
    public StableId DefinitionId { get; private set; }
    public int UpgradeLevel { get; private set; }
    public int? CostOverride { get; private set; }
    public bool Retain { get; private set; }
    public bool CanBeInfused { get; private set; } = true;

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

    public void SetRetention(bool retained = true) => Retain = retained;
    public void SetInfusable(bool infusable) => CanBeInfused = infusable;

    public void Transform(StableId definitionId, int? costOverride = null)
    {
        if (!definitionId.IsValid) throw new ArgumentException("A transformed card needs a stable id.", nameof(definitionId));
        if (costOverride is < 0) throw new ArgumentOutOfRangeException(nameof(costOverride));
        DefinitionId = definitionId;
        CostOverride = costOverride;
    }
}
