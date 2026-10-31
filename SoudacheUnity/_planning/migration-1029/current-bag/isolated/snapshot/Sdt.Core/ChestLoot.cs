// ported from src/chests.js
// 物资箱掉落：内容掷骰（rollContents）与掉落表掷骰（rollDrops）+ 摘要文案。
// 开箱 UI（open/render/逐卡音效）归 W7，本文件只保留纯逻辑子集。
using System;
using System.Collections.Generic;
using System.Text;
using System.Linq;

namespace Sdt.Core
{
    /// <summary>一个宝箱的完整内容：cards=开出的卡（密封箱为 3 选 1 候选），coins=内含币。</summary>
    public sealed class ChestContents
    {
        public string kind;
        public List<CardDef> cards = new List<CardDef>();
        public int coins;
        public bool tokenHit;   // BOSS 箱 30% 掷中金色令牌
        public bool isClass, eggHit;
        public string claimMode;
        public int choiceCount;
    }

    public static class ChestLoot
    {
        // 掷一个宝箱的完整内容。随机全部走 loot 流（对齐 Random.random('loot')）。
        public static ChestKind Definition(string kind)
        {
            if (kind?.StartsWith("class:") == true) kind = kind.Substring(6);
            return kind != null && MapData.ChestKinds.TryGetValue(kind, out var entry) ? entry : MapData.ChestKinds["small"];
        }
        public static ChestContents RollContents(string kind, Rng rng, bool isClass = false, string cls = null, string mode = null, double petEggChance = 0.007)
        {
            isClass |= kind?.StartsWith("class:") == true;
            if (kind?.StartsWith("class:") == true) kind = kind.Substring(6);
            ChestKind K = Definition(kind);
            var c = new ChestContents { kind = kind, isClass = isClass, claimMode = K.pickFrom.HasValue ? "one" : "all" };
            // 随机卡池（2026-09-05 设计者定版爆率）：只开 武术/法术/装备/道具/资源 五类，
            // 传说/职业/初始不直接生成（统一走 CardLibrary.RandomDropCard）；同一宝箱内尽量不重复
            var taken = new HashSet<string>();
            var names = new HashSet<string>();
            int n = K.pickFrom ?? K.cards ?? 0;
            var classPool = isClass && kind != "boss" ? CardLibrary.ClassPool(cls).Where(card => card.rarity == "职业").ToList() : null;
            for (int i = 0; i < n; i++)
            {
                CardDef card = null;
                for (int retry = 0; retry < 40 && card == null; retry++)
                {
                    var candidate = classPool != null ? classPool.Count > 0 ? classPool[(int)(rng.Random("loot", "reward") * classPool.Count)] : null : CardLibrary.RandomDropCard(rng, taken, mode);
                    if (candidate == null) break;
                    if (taken.Contains(candidate.id) || names.Contains(candidate.name)) { taken.Add(candidate.id); continue; }
                    card = candidate;
                }
                if (card == null) break;
                taken.Add(card.id); names.Add(card.name); c.cards.Add(card);
            }
            if (c.claimMode == "one") { c.choiceCount = c.cards.Count; if (c.choiceCount == 0) c.claimMode = "all"; }
            if (classPool != null && K.coinsMin.HasValue) c.coins = RndInt(rng, K.coinsMin.Value, K.coinsMax ?? K.coinsMin.Value);
            if (rng.Random("loot", "reward") < petEggChance)
            {
                var egg = CardLibrary.FindById("pet-egg");
                if (egg != null && !taken.Contains(egg.id) && !names.Contains(egg.name)) { c.cards.Add(egg); c.eggHit = true; }
            }
            if (classPool == null && K.coinsMin.HasValue) c.coins = RndInt(rng, K.coinsMin.Value, K.coinsMax ?? K.coinsMin.Value);
            // BOSS宝箱：金币/银币/铜币其一 + 30% 金色令牌（都是卡牌，直接并入 cards）
            // 注意：币名要先取好再查库——名字先掷定，避免在库内逐卡比较时重复随机
            var lib = CardLibrary.All();
            if (K.coinCards != null && K.coinCards.Length > 0)
            {
                string cname = K.coinCards[(int)Math.Floor(rng.Random("loot", "reward") * K.coinCards.Length)];
                var coin = CardLibrary.FindByName(cname);
                if (coin != null) c.cards.Add(coin);
            }
            return c;
        }

        /// <summary>掉落掷骰：isBoss → 首脑保险柜；否则按环层掉落表随机一组 → 宝箱 kind 列表。</summary>
        public static List<string> RollDrops(bool isBoss, int layer, Rng rng, IEnumerable<string> foeNames = null, double classChance = 0.25)
        {
            var output = new List<string>();
            if (isBoss) { output.Add("boss"); return output; }
            if (foeNames != null && foeNames.Any(name => name?.Contains("巨兽") == true)) return new List<string> { "large", "large" };
            var tables = MapData.LayerChests;
            int li = layer;
            var table = li >= 0 && li < tables.Length ? tables[li] : tables[0];
            if (table.fixedDrops != null)
            {
                foreach (var part in table.fixedDrops) for (int i = 0; i < part.n; i++) output.Add(part.k);
                return output;
            }
            int count = Weighted(table.count, rng).n ?? 0;
            for (int i = 0; i < count; i++) { var kind = Weighted(table.types, rng).k; output.Add(rng.Random("loot", "reward") < classChance ? "class:" + kind : kind); }
            return output;
        }

        /// <summary>掉落摘要文案：2 个小型物资箱，1 个军用保险柜。</summary>
        public static string DropText(IEnumerable<string> chests)
        {
            var counts = new List<KeyValuePair<string, int>>(); // 保持插入顺序（对齐 Object.entries）
            foreach (var c in chests)
            {
                int i = counts.FindIndex(kv => kv.Key == c);
                if (i >= 0) counts[i] = new KeyValuePair<string, int>(c, counts[i].Value + 1);
                else counts.Add(new KeyValuePair<string, int>(c, 1));
            }
            var sb = new StringBuilder();
            for (int i = 0; i < counts.Count; i++)
            {
                if (i > 0) sb.Append('，');
                ChestKind k;
                k = Definition(counts[i].Key);
                sb.Append("<b>").Append(counts[i].Value).Append("</b>").Append(" 个").Append(counts[i].Key.StartsWith("class:") ? "职业·" : "").Append(k.name);
            }
            return sb.ToString();
        }

        private static int RndInt(Rng rng, int a, int b)
        {
            return a + (int)Math.Floor(rng.Random("loot", "reward") * (b - a + 1));
        }
        private static ChestPart Weighted(ChestPart[] entries, Rng rng)
        {
            double roll = rng.Random("loot", "reward") * entries.Sum(entry => entry.w);
            foreach (var entry in entries) { roll -= entry.w; if (roll <= 0) return entry; }
            return entries[entries.Length - 1];
        }
    }
}
