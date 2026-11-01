// battle.pile-view.js: a sorted display copy, never the hidden draw order.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Core.Battle;

namespace Sdt.UI.Screens.Battle
{
    public static class CurrentBattlePileData
    {
        public sealed class Entry
        {
            public string Uid;
            public CardDef Card;
            public int EffectiveCost;
            // UID-free live presentation data (for example an individual astrolabe phase).
            public JToken Presentation;
            public BattleCardPresentation State;
        }
        public sealed class Stack
        {
            public string Key;
            public CardDef Card;
            public int EffectiveCost;
            public BattleCardPresentation State;
            public readonly List<string> Uids = new List<string>();
            public int Count => Uids.Count;
        }
        public static IReadOnlyList<Stack> Build(IEnumerable<Entry> entries, bool group = true)
        {
            var grouped = new Dictionary<string, Stack>(StringComparer.Ordinal);
            foreach (var entry in entries)
            {
                if (entry?.Card == null) continue;
                string key = group ? EffectiveKey(entry) : entry.Uid;
                if (!grouped.TryGetValue(key, out var stack))
                {
                    stack = new Stack { Key = key, Card = entry.Card, EffectiveCost = entry.EffectiveCost,State=entry.State };
                    grouped.Add(key, stack);
                }
                stack.Uids.Add(entry.Uid);
            }
            var result = grouped.Values.ToList();
            var chinese = CultureInfo.GetCultureInfo("zh-CN").CompareInfo;
            int Chinese(string a, string b) => chinese.Compare(a ?? "", b ?? "", CompareOptions.None);
            result.Sort((a, b) => {
                int order = Chinese(a.Card.name, b.Card.name);
                if (order == 0) order = Chinese(a.Card.type, b.Card.type);
                if (order == 0) order = a.Card.cost.CompareTo(b.Card.cost);
                if (order == 0) order = string.Compare(a.Card.id, b.Card.id, StringComparison.InvariantCulture);
                if (order == 0) order = string.Compare(a.Key, b.Key, StringComparison.InvariantCulture);
                return order;
            });
            return result;
        }
        public static string EffectiveKey(Entry entry)
        {
            // CardDef has no ownership UID. Include every effective card/rule field,
            // plus the live cost and UID-free presentation projection used by its face.
            var card=JObject.FromObject(entry.Card);
            // Runtime clones may carry the same printed fee through different write paths.
            // A real source projection is the common identity; raw tool entries retain their field.
            if(entry.State!=null)card.Remove("_baseCost");
            else if(entry.Card._baseCost.HasValue)card["_baseCost"]=entry.Card._baseCost.Value;
            var value = new JObject {
                ["card"] = card,
                ["effectiveCost"] = entry.EffectiveCost,
                ["presentation"] = entry.Presentation?.DeepClone()??JValue.CreateNull(),
                ["source"] = entry.State==null?JValue.CreateNull():(JToken)new JObject {
                    ["temporary"]=entry.State.Temporary,["transforming"]=entry.State.Transforming,
                    ["transformed"]=entry.State.Transformed,["originName"]=entry.State.OriginName,["baseCost"]=entry.State.BaseCost }
            };
            return Canonical(value).ToString(Formatting.None);
        }
        static JToken Canonical(JToken value, string property = null)
        {
            if (value is JObject obj)
                return new JObject(obj.Properties().Where(p => property != "_presentation" || p.Name != "uid")
                    .OrderBy(p => p.Name, StringComparer.Ordinal).Select(p => new JProperty(p.Name, Canonical(p.Value, p.Name))));
            if (value is JArray array) return new JArray(array.Select(item => Canonical(item)));
            return value.DeepClone();
        }
    }
}
