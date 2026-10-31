using System;using System.Collections.Generic;using System.Linq;using Sdt.Core;using Sdt.Run;public class ShopScreen {
public sealed class ShopSlot { public CardDef card; public int price; public bool sold; public bool empty; public string label; public bool mystery; public bool free; public int? shaReplenish; }
        public static System.Collections.Generic.List<ShopSlot> GenerateStock()
        {
            var runtime = GameRuntime.I;
            var rng = runtime.Rng;
            var lib = CardLibrary.All().Where(card => CardLibrary.IsRandomObtainable(card) && CardLibrary.DropTypes.Contains(card.type) && card.id != "tt-token-color").ToList();
            var slots = new List<ShopSlot>();
            var drink = lib.FirstOrDefault(card => card.id == "tt4-woodify") ?? CardLibrary.FindById("tt4-woodify");
            var names = new HashSet<string>();
            if (drink != null) names.Add(drink.name);
            double total = CardLibrary.ShopWeights.Values.Sum();
            string PickWeightedRarity()
            {
                double roll = rng.Random("shop", "reward") * total;
                foreach (var weight in CardLibrary.ShopWeights) { roll -= weight.Value; if (roll <= 0) return weight.Key; }
                return "古朴";
            }
            CardDef PickRandomCard()
            {
                for (int tries = 0; tries < 50; tries++)
                {
                    var card = CardLibrary.PickOfRarity(rng, PickWeightedRarity());
                    if (card != null && !names.Contains(card.name)) return card;
                }
                var fallback = lib.Where(card => !names.Contains(card.name)).ToList();
                return fallback.Count > 0 ? fallback[(int)(rng.Random("shop", "reward") * fallback.Count)] : null;
            }
            bool catFree = runtime.Base?.CarriedPet?.effect?.shopFree == true;
            for (int index = 0; index < 6; index++)
            {
                var chosen = PickRandomCard();
                if (chosen != null) names.Add(chosen.name);
                slots.Add(chosen == null ? new ShopSlot { empty = true, label = "卡牌库无货" } : new ShopSlot { card = chosen,
                    price = catFree && index == 0 ? 0 : CardLibrary.Price.TryGetValue(chosen.rarity, out var price) ? price : 2, free = catFree && index == 0 });
            }
            slots.Add(new ShopSlot { card = drink, price = 2 });
            slots.Add(new ShopSlot { card = CardLibrary.SHA.Clone(), price = 1, shaReplenish = 5 });
            CardDef mystery = null;
            for (int tries = 0; tries < 50; tries++)
            {
                double roll = rng.Random("shop", "reward");
                var card = lib.Count > 0 ? lib[(int)(roll * lib.Count)] : null;
                if (card != null && !names.Contains(card.name)) { mystery = card; break; }
            }
            slots.Add(mystery != null ? new ShopSlot { card = mystery, mystery = true, price = 3 }
                : new ShopSlot { empty = true, label = "卡牌库无货" });
            return slots;
        }

}