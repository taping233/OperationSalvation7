using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed class SupplyPackOpening
    {
        public string cardId = "tt-econpack";
        public List<string> cardIds = new List<string>();
    }
    public sealed partial class BaseData
    {
        [JsonProperty("supplyPackOpening")] public SupplyPackOpening supplyPackOpening;
        public bool ValidateSupplyPack(out string reason)
        {
            reason = null;
            if (supplyPackOpening == null) return true;
            if (supplyPackOpening.cardId != "tt-econpack" || supplyPackOpening.cardIds == null || supplyPackOpening.cardIds.Count != 5
                || supplyPackOpening.cardIds.Any(id => CardLibrary.FindById(id) is var card && (card == null || !CardLibrary.IsRandomObtainable(card))))
            { reason = "经济卡包候选损坏，原档已保留"; return false; }
            return true;
        }
        public bool TryOpenSupplyPack(out List<CardDef> cards, out string reason)
        {
            cards = null;
            var runtime = GameRuntime.I;
            if (!runtime.TryPersistMutation(() =>
            {
                RequireCurrentBase();
                if (runtime.State.runActive) throw new InvalidOperationException("只能在基地仓库拆包");
                if (stash.Count(stack => stack.card?.id == "tt-econpack" && stack.count > 0) != 1) throw new InvalidOperationException("卡包已变化，请重新选择");
                if (StashRoom + 1 < 5) throw new InvalidOperationException("拆包需要至少4格仓库空位，卡包未消耗");
                if (supplyPackOpening == null)
                {
                    var pool = CardLibrary.All().Where(CardLibrary.IsRandomObtainable).ToList();
                    if (pool.Count == 0) throw new InvalidOperationException("当前没有可获得的卡牌");
                    supplyPackOpening = new SupplyPackOpening();
                    for (int i = 0; i < 5; i++) supplyPackOpening.cardIds.Add(pool[(int)(runtime.Rng.Random("loot", "reward") * pool.Count)].id);
                }
                if (!ValidateSupplyPack(out var invalid)) throw new InvalidOperationException(invalid);
            }, out reason)) return false;
            List<CardDef> received = null;
            bool success = runtime.TryPersistMutation(() =>
            {
                RequireCurrentBase();
                if (!ValidateSupplyPack(out var invalid) || supplyPackOpening == null) throw new InvalidOperationException(invalid ?? "卡包候选尚未准备");
                var stack = stash.SingleOrDefault(item => item.card?.id == "tt-econpack" && item.count > 0);
                if (stack == null || StashRoom + 1 < 5) throw new InvalidOperationException("卡包或仓库空间已变化，物品与候选已保留");
                received = supplyPackOpening.cardIds.Select(id => CardLibrary.FindById(id).Clone()).ToList();
                stack.count--; if (stack.count == 0) stash.Remove(stack);
                AppendRewardCards(received); supplyPackOpening = null;
            }, out reason);
            if (success) cards = received;
            return success;
        }
    }
}
