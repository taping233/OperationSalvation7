// Source: hub/base-departure.commands.js + departure.summary.js. Draft derivation never draws or saves.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed class DepartureCell
    {
        public CardDef card;
        public int count, fixedCount;
        public readonly List<string> sources = new List<string>();
    }
    public sealed class DepartureProjection
    {
        public BagCapacityQuery capacity;
        public CardDef starter;
        public int starterCount, extraCount;
        public readonly List<DepartureCell> cells = new List<DepartureCell>();
    }
    public sealed partial class GameRuntime
    {
        public static string DepartureStackKey(StashStack stack) => !string.IsNullOrEmpty(stack?.stackKey) ? stack.stackKey
            : !string.IsNullOrEmpty(stack?.card?.id) ? "card:" + stack.card.id +
                (string.IsNullOrEmpty(stack.variantKey ?? stack.card.variantKey) ? "" : ":" + (stack.variantKey ?? stack.card.variantKey))
            : stack?.card?.name ?? "";
        public StashStack FindDepartureStack(string key)
        {
            var matches = Base.stash.Where(stack => DepartureStackKey(stack) == key).ToList();
            if (matches.Count > 0) return matches.Count == 1 || matches.All(stack => string.IsNullOrEmpty(stack.stackKey) && string.IsNullOrEmpty(stack.card?.id)) ? matches[0] : null;
            // Legacy name callers retain the source's first-match semantics.
            return Base.stash.FirstOrDefault(stack => stack.card?.name == key);
        }
        public Dictionary<string, int> NormalizeDeparturePicks(IDictionary<string, int> picks, bool strict = false)
        {
            var normalized = new Dictionary<string, int>();
            foreach (var entry in picks ?? new Dictionary<string, int>())
            {
                if (entry.Value == 0) continue;
                var stack = FindDepartureStack(entry.Key);
                if (strict && (entry.Value < 0 || stack == null || stack.card.rarity == "职业"))
                    throw new InvalidOperationException("仓库库存或卡堆身份已变化，请重新检查携带选择后出发。");
                if (stack?.card == null || stack.card.rarity == "职业" || entry.Value < 0) continue;
                string key = DepartureStackKey(stack);
                int count = (normalized.TryGetValue(key, out var old) ? old : 0) + entry.Value;
                if (strict && count > stack.count) throw new InvalidOperationException("仓库携带卡牌已变化，请重新选择");
                normalized[key] = Math.Min(count, Math.Max(0, stack.count));
            }
            return normalized;
        }
        CardDef DepartureCardSnapshot(StashStack stack)
        {
            var card = stack.card.Clone();
            if (!string.IsNullOrEmpty(stack.variantKey)) card.variantKey = stack.variantKey;
            return card;
        }
        public DepartureProjection ProjectDeparture(IDictionary<string, int> picks, string petId = null)
        {
            var result = new DepartureProjection { starter = DepartureStarterCardForPet(petId), starterCount = DepartureStarterCountForPet(petId) };
            var cards = new List<(CardDef card, string source, bool fixedCard)>();
            for (int i = 0; i < result.starterCount; i++) cards.Add((result.starter, null, true));
            foreach (var entry in NormalizeDeparturePicks(picks))
            {
                var stack = FindDepartureStack(entry.Key); var card = DepartureCardSnapshot(stack);
                result.extraCount += entry.Value;
                for (int i = 0; i < entry.Value; i++) cards.Add((card, entry.Key, false));
            }
            var owned = cards.Select(row => new OwnedCard { card = row.card }).ToList();
            result.capacity = CardContainerCommands.Query(this, owned, Enumerable.Empty<InvSlot>());
            // Like departure.summary: merge display cells by name while retaining each source stack identity.
            foreach (var group in cards.GroupBy(row => row.card.name))
            {
                var entries = group.ToList(); int cap = CardContainerCommands.StackCap(entries[0].card);
                for (int i = 0; i < entries.Count; i += cap)
                {
                    var slice = entries.Skip(i).Take(cap).ToList();
                    var cell = new DepartureCell { card = slice[0].card, count = slice.Count, fixedCount = slice.Count(row => row.fixedCard) };
                    cell.sources.AddRange(slice.Where(row => row.source != null).Select(row => row.source).Distinct());
                    result.cells.Add(cell);
                }
            }
            return result;
        }
        public Dictionary<string, int> RecommendDeparture(IDictionary<string, int> current)
        {
            var picks = NormalizeDeparturePicks(current); int added = 0;
            var candidates = Base.stash.Where(stack => stack.count > 0 && !string.IsNullOrEmpty(stack.card?.id) && stack.card.rarity != "职业" &&
                (new[] { "武术", "法术", "生物", "装备" }.Contains(stack.card.type) || stack.card.type == "道具" && Regex.IsMatch(stack.card.desc ?? "", "回复|治疗|复原")))
                .OrderBy(stack => Regex.IsMatch(stack.card.desc ?? "", "护甲|护盾|格挡|破甲|回复|治疗") ? 0 : 1).ThenBy(stack => stack.card.cost);
            foreach (var stack in candidates)
            {
                if (added >= 3) break;
                string key = DepartureStackKey(stack);
                if (FindDepartureStack(key) != stack || picks.Any(entry => entry.Value > 0 && FindDepartureStack(entry.Key)?.card.name == stack.card.name)) continue;
                var next = new Dictionary<string, int>(picks) { [key] = 1 }; var projected = ProjectDeparture(next);
                if (!projected.capacity.capacityOk || projected.capacity.used > Math.Max(0, projected.capacity.baseCap - 3)) continue;
                picks[key] = 1; added++;
            }
            return picks;
        }
        void ApplyStableDeparturePicks(IDictionary<string, int> picks)
        {
            var plan = NormalizeDeparturePicks(picks, true); int loaded = 0;
            foreach (var entry in plan)
            {
                var stack = FindDepartureStack(entry.Key); var card = DepartureCardSnapshot(stack);
                stack.count -= entry.Value;
                if (stack.count <= 0) Base.stash.Remove(stack);
                for (int i = 0; i < entry.Value; i++) State.ownedCards.Add(new OwnedCard { uid = NewUid(), card = card.Clone(), brought = 1 });
                loaded += entry.Value;
            }
            if (loaded > 0) { Base.Save(); Log($"[[icon:archive]] 从基地仓库携带 <b>{loaded}</b> 张卡牌出征", "loot"); }
        }
    }
}
