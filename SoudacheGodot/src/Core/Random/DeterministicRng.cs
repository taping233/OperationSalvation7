using System;
using System.Collections.Generic;

namespace Soudache;

/// <summary>
/// Small deterministic PRNG with an explicit state, suitable for replay and save files.
/// SplitMix64 is used only as an implementation detail; no engine/global RNG is consulted.
/// </summary>
public class DeterministicRng
{
    private ulong _state;

    public DeterministicRng(ulong seed) => _state = seed;
    public DeterministicRng(long seed) => _state = unchecked((ulong)seed);
    public ulong State => _state;

    public void RestoreState(ulong state) => _state = state;

    public ulong NextUInt64()
    {
        unchecked { _state += 0x9E3779B97F4A7C15UL; }
        var z = _state;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
    }

    public uint NextUInt32() => unchecked((uint)(NextUInt64() >> 32));

    public int NextInt(int maxExclusive)
    {
        if (maxExclusive <= 0) throw new ArgumentOutOfRangeException(nameof(maxExclusive));
        // Rejection sampling avoids modulo bias while remaining deterministic.
        var bound = uint.MaxValue - (uint.MaxValue % (uint)maxExclusive);
        uint sample;
        do { sample = NextUInt32(); } while (sample >= bound);
        return (int)(sample % (uint)maxExclusive);
    }

    public int NextInt(int minInclusive, int maxExclusive)
    {
        if (maxExclusive <= minInclusive) throw new ArgumentOutOfRangeException(nameof(maxExclusive));
        return minInclusive + NextInt(maxExclusive - minInclusive);
    }

    public double NextDouble() => (NextUInt64() >> 11) * (1.0 / (1UL << 53));

    public void Shuffle<T>(IList<T> values)
    {
        ArgumentNullException.ThrowIfNull(values);
        for (var i = values.Count - 1; i > 0; i--)
        {
            var j = NextInt(i + 1);
            (values[i], values[j]) = (values[j], values[i]);
        }
    }
}

/// <summary>Short compatibility name for callers that prefer Rng.</summary>
public sealed class Rng : DeterministicRng
{
    public Rng(ulong seed) : base(seed) { }
    public Rng(long seed) : base(seed) { }
}
