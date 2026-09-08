using System;

namespace Soudache;

/// <summary>Base for immutable content definitions shared by runtime and editor code.</summary>
public abstract class ContentDefinition
{
    public StableId Id { get; }
    public string DisplayName { get; }

    protected ContentDefinition(StableId id, string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
            throw new ArgumentException("A content definition needs a display name.", nameof(displayName));
        Id = id;
        DisplayName = displayName.Trim();
    }
}
