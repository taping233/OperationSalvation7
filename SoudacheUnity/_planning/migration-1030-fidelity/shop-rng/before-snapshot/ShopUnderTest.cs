using System;using System.Collections.Generic;using System.Linq;using Sdt.Core;using Sdt.Run;public class ShopScreen {
public sealed class ShopSlot { public CardDef card; public int price; public bool sold; public bool empty; public string label; public bool mystery; public bool free; public int? shaReplenish; }
        public static System.Collections.Generic.List<ShopSlot> GenerateStock()
        {
            var runtime = GameRuntime.I;
            var rng = runtime.Rng;
            var lib = CardLibrary.All().Where(card => !card.unrandom && CardLibrary.DropTypes.Contains(card.type) && card.id != "tt-token-color").ToList();
            var slots = new List<ShopSlot>();
            var drink = CardLibrary.FindById("tt4-woodify");
            var names = new HashSet<string>();
            if (drink != null) names.Add(drink.name);
            for (int index = 0; index < 6; index++)
            {
                var pool = lib.Where(card => !names.Contains(card.name)).ToList();
                double total = CardLibrary.ShopWeights.Values.Sum();
                double roll = rng.Random("shop", "reward") * total;
                string rarity = "古朴";
                foreach (var weight in CardLibrary.ShopWeights) { roll -= weight.Value; if (roll <= 0) { rarity = weight.Key; break; } }
                var candidates = pool.Where(card => card.rarity == rarity).ToList();
                if (candidates.Count == 0) candidates = pool;
                var groups = candidates.GroupBy(card => card.type).ToArray();
                CardDef chosen = null;
                if (groups.Length > 0)
                {
                    double typeTotal = groups.Sum(group => group.Key == "道具" ? .7 : group.Key == "装备" ? .8 : 1);
                    double typeRoll = rng.Random("shop", "reward") * typeTotal;
                    var selected = groups[groups.Length - 1];
                    foreach (var group in groups) { typeRoll -= group.Key == "道具" ? .7 : group.Key == "装备" ? .8 : 1; if (typeRoll <= 0) { selected = group; break; } }
                    var choices = selected.ToArray(); chosen = choices[(int)(rng.Random("shop", "reward") * choices.Length)];
                }
                if (chosen != null) names.Add(chosen.name);
                slots.Add(chosen == null ? new ShopSlot { empty = true, label = "卡牌库无货" } : new ShopSlot { card = chosen, price = CardLibrary.Price.TryGetValue(chosen.rarity, out var price) ? price : 2 });
            }
            slots.Add(new ShopSlot { card = drink, price = 2, empty = drink == null });
            slots.Add(new ShopSlot { card = CardLibrary.SHA, price = 1, shaReplenish = 5 });
            var remaining = lib.Where(card => !names.Contains(card.name)).ToList();
            var mystery = remaining.Count == 0 ? null : remaining[(int)(rng.Random("shop", "reward") * remaining.Count)];
            slots.Add(new ShopSlot { card = mystery, mystery = true, price = 3, empty = mystery == null });
            return slots;
        }

}