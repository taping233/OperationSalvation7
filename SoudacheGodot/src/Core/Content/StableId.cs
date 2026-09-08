using System;

namespace Soudache;

/// <summary>Stable, content-owned identifier. It is never generated from a display name.</summary>
public readonly struct StableId : IEquatable<StableId>
{
    public string Value { get; }
    public bool IsValid => !string.IsNullOrEmpty(Value);

    public StableId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("A stable id cannot be empty.", nameof(value));

        var trimmed = value.Trim();
        for (var i = 0; i < trimmed.Length; i++)
        {
            var c = trimmed[i];
            if (!(char.IsLetterOrDigit(c) || c is '-' or '_' or '.' or '/'))
                throw new ArgumentException($"Stable id contains unsupported character '{c}'.", nameof(value));
        }
        Value = trimmed;
    }

    public static StableId Create(string value) => new(value);
    public bool Equals(StableId other) => string.Equals(Value, other.Value, StringComparison.Ordinal);
    public override bool Equals(object? obj) => obj is StableId other && Equals(other);
    public override int GetHashCode() => StringComparer.Ordinal.GetHashCode(Value ?? string.Empty);
    public override string ToString() => Value ?? string.Empty;
    public static bool operator ==(StableId left, StableId right) => left.Equals(right);
    public static bool operator !=(StableId left, StableId right) => !left.Equals(right);
    public static implicit operator StableId(string value) => new(value);
    public static implicit operator string(StableId id) => id.Value;
}
