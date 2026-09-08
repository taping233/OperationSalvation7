using System;
using System.Collections.Generic;

namespace Soudache;

/// <summary>Deterministic registry for stable-id keyed content definitions.</summary>
public sealed class ContentRegistry<T> where T : ContentDefinition
{
    private readonly Dictionary<StableId, T> _byId = new();
    private readonly List<T> _ordered = new();

    public int Count => _ordered.Count;
    public IReadOnlyList<T> All => _ordered;

    public void Register(T definition)
    {
        ArgumentNullException.ThrowIfNull(definition);
        if (_byId.ContainsKey(definition.Id))
            throw new InvalidOperationException($"Content id '{definition.Id}' is already registered.");
        _byId.Add(definition.Id, definition);
        _ordered.Add(definition);
    }

    public void RegisterRange(IEnumerable<T> definitions)
    {
        ArgumentNullException.ThrowIfNull(definitions);
        foreach (var definition in definitions) Register(definition);
    }

    public bool Contains(StableId id) => _byId.ContainsKey(id);
    public bool TryGet(StableId id, out T? definition) => _byId.TryGetValue(id, out definition);
    public T GetRequired(StableId id) => _byId.TryGetValue(id, out var value)
        ? value
        : throw new KeyNotFoundException($"Unknown content id '{id}'.");
}
