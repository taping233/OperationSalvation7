// ported from src/random.js
// 种子随机服务：多流（gameplay/card/loot/battle/status…），快照/恢复可序列化。
// 算法逐行对齐 random.js 的 SeededRandomService（mulberry32 变体 + 流隔离）。
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Sdt.Core
{
    public sealed class Rng
    {
        private const double Uint32Range = 0x100000000;
        private const uint Step = 0x6D2B79F5;

        // 全局默认服务（对齐 random.js 的模块级 service / window.SDT.Random）
        public static Rng Default { get; set; } = new Rng(GenerateSeed());

        public uint Seed { get; private set; }
        public int Version { get; private set; } = 2;
        private readonly Dictionary<string, uint> _streams = new Dictionary<string, uint>();

        public Rng(int seed) { Reseed(seed); }
        public Rng(uint seed) { Reseed((int)seed); }
        public Rng(string seed) { Reseed((int)HashSeed(seed)); }

        public int Reseed(int seed) { Seed = (uint)NormalizeSeed(seed); Version = 2; _streams.Clear(); return (int)Seed; }

        // 生成种子（无 crypto：时间戳 + 高精度计时散列）
        public static int GenerateSeed()
        {
            return (int)HashSeed(DateTime.UtcNow.Ticks + ":" + System.Diagnostics.Stopwatch.GetTimestamp());
        }

        private static uint HashSeed(string value)
        {
            uint hash = 2166136261;
            foreach (char c in value)
            {
                hash ^= c;
                hash = unchecked((uint)Imul((int)hash, 16777619));
            }
            return hash;
        }

        private static int NormalizeSeed(int seed) { return (int)((uint)seed); }

        private static int Imul(int a, int b) { return unchecked((int)((uint)a * (uint)b)); }

        /// <summary>取 [0,1) 随机数；stream 与 random.js 各调用点一致（默认 gameplay）。</summary>
        public double Random(string stream = "gameplay", string purpose = null)
        {
            string key = Version >= 2 && (purpose == "shuffle" || purpose == "reward" || purpose == "target" || purpose == "generation" || purpose == "enemy") ? purpose : stream ?? "gameplay";
            uint state;
            if (!_streams.TryGetValue(key, out state)) state = HashSeed(Seed.ToString(CultureInfo.InvariantCulture) + ":" + key);
            state = unchecked(state + Step);
            _streams[key] = state;
            int value = (int)state;
            value = Imul(value ^ (int)((uint)value >> 15), value | 1);
            value = unchecked(value ^ (value + Imul(value ^ (int)((uint)value >> 7), value | 61)));
            uint r = unchecked((uint)(value ^ (int)((uint)value >> 14)));
            return r / (double)Uint32Range;
        }

        // —— 契约 §2 便捷 API（走 gameplay 流）——
        public int Next() { return (int)(uint)(Random() * Uint32Range); }
        public int Next(int maxExclusive) { return (int)Math.Floor(Random() * maxExclusive); }
        public double NextDouble() { return Random(); }
        public void Shuffle<T>(IList<T> list)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = (int)Math.Floor(Random() * (i + 1));
                T t = list[i]; list[i] = list[j]; list[j] = t;
            }
        }

        /// <summary>序列化状态："seed=123;s=key:456,key2:789"（对齐 snapshot()）。</summary>
        public string SaveState()
        {
            var sb = new StringBuilder();
            sb.Append("seed=").Append(Seed.ToString(CultureInfo.InvariantCulture));
            sb.Append(";v=").Append(Version);
            if (_streams.Count > 0)
            {
                sb.Append(";s=");
                bool first = true;
                foreach (var kv in _streams)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    sb.Append(kv.Key).Append(':').Append(kv.Value.ToString(CultureInfo.InvariantCulture));
                }
            }
            return sb.ToString();
        }

        /// <summary>恢复状态（对齐 restore()：流键缺失则重派生，值非法则忽略）。</summary>
        public void LoadState(string state)
        {
            if (string.IsNullOrEmpty(state)) { Reseed(GenerateSeed()); return; }
            int semi = state.IndexOf(";s=", StringComparison.Ordinal);
            int firstSemi = state.IndexOf(';');
            string seedPart = firstSemi >= 0 ? state.Substring(0, firstSemi) : state;
            uint seed = (uint)GenerateSeed();
            if (seedPart.StartsWith("seed=", StringComparison.Ordinal) &&
                uint.TryParse(seedPart.Substring(5), NumberStyles.Integer, CultureInfo.InvariantCulture, out uint s0))
                seed = s0;
            Seed = seed;
            Version = state.Contains(";v=2") ? 2 : 1;
            _streams.Clear();
            if (semi >= 0)
            {
                foreach (string entry in state.Substring(semi + 3).Split(','))
                {
                    int colon = entry.IndexOf(':');
                    if (colon <= 0) continue;
                    if (uint.TryParse(entry.Substring(colon + 1), NumberStyles.Integer, CultureInfo.InvariantCulture, out uint v))
                        _streams[entry.Substring(0, colon)] = v;
                }
            }
        }
    }
}
