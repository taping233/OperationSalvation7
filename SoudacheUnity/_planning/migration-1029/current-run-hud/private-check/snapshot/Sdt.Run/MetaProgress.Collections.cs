using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class MetaProgress
    {
        public bool IsCollectible(CardDef card) => card != null && !string.IsNullOrEmpty(card.cls)
            && CharacterTable.For(card.cls) != null && (card.rarity == "职业" || card.type == "能力卡");
        public List<CardDef> CollectionPool() => CardLibrary.All().Where(IsCollectible).GroupBy(c => c.id).Select(g => g.First()).ToList();
        public int CollectionProgress => CollectionPool().Count(card => B.collection.ContainsKey(card.id));
        public int MilestoneNeed(CollectionMilestone milestone) => milestone.all ? CollectionPool().Count : milestone.need;
        public bool MilestoneClaimed(string id) => B.collClaimed != null && B.collClaimed.TryGetValue(id, out var claimed) && claimed;
        public string CollectionRewardText(CollectionMilestone milestone)
        {
            var r = milestone.reward; var parts = new List<string>();
            if (r.wood > 0) parts.Add("木材 ×" + r.wood);
            if (r.rations > 0) parts.Add("口粮 ×" + r.rations);
            if (r.keys > 0) parts.Add("钥匙 ×" + r.keys);
            if (r.legend > 0) parts.Add("传说卡 ×" + r.legend);
            if (r.egg > 0) parts.Add("宠物蛋 ×" + r.egg);
            return string.Join(" · ", parts);
        }
        public bool TryClaimCollection(string id, out string reason)
        {
            return _rt.TryPersistMutation(() =>
            {
                var milestone = HubCatalog.Current.milestones.SingleOrDefault(item => item.id == id);
                if (milestone == null || MilestoneClaimed(id) || CollectionProgress < MilestoneNeed(milestone)) throw new InvalidOperationException("当前尚不能领取这项奖励");
                var reward = milestone.reward;
                var pool = CardLibrary.All().Where(card => card.rarity == "传说" && CardLibrary.IsRandomObtainable(card)).GroupBy(c => c.id).Select(g => g.First()).ToList();
                var egg = CardLibrary.FindById("pet-egg");
                if (pool.Count < reward.legend || (reward.egg > 0 && egg == null)) throw new InvalidOperationException("奖励卡库暂不可用，领取资格已保留");
                if (B.StashRoom < reward.legend + reward.egg) throw new InvalidOperationException("仓库容量不足，奖励尚未领取");
                var cards = new List<CardDef>();
                for (int i = 0; i < reward.legend; i++) { int index = (int)(_rt.Rng.Random("coll","reward")*pool.Count); cards.Add(pool[index]); pool.RemoveAt(index); }
                for (int i = 0; i < reward.egg; i++) cards.Add(egg);
                B.wood += reward.wood; B.rations += reward.rations; B.keys += reward.keys;
                B.AppendRewardCards(cards);
                B.collClaimed ??= new Dictionary<string, bool>(); B.collClaimed[id] = true;
                B.Save();
            }, out reason);
        }
        public bool TryConvertCollection(string cardId, int count, out string reason)
        {
            return _rt.TryPersistMutation(() =>
            {
                var matches = B.stash.Where(stack => stack.card.id == cardId && stack.count > 0).ToList();
                if (matches.Count != 1 || count <= 0 || count > matches[0].count) throw new InvalidOperationException("库存已变化，请重新选择");
                var stack = matches[0]; var card = CardLibrary.FindById(cardId);
                if (!IsCollectible(card) || B.IsProtected(card)) throw new InvalidOperationException("该卡牌不可转化或仍受收藏保护");
                var progress = ClsData(card.cls);
                bool registered = B.collection.ContainsKey(cardId);
                int xpPerCard = card.type == "能力卡" ? 50 : 10;
                int required = 0;
                for (int level = progress.lv; level < LevelMax; level++) required += XpForNext(level);
                required = Math.Max(0, required - progress.xp);
                int maximum = Math.Max(1, (required + xpPerCard - 1) / xpPerCard);
                if ((progress.lv >= LevelMax && registered) || count > maximum) throw new InvalidOperationException("已满级或转化数量超过升满级所需");
                stack.count -= count; if (stack.count == 0) B.stash.Remove(stack);
                if (!registered) B.collection[cardId] = new CollectionEntry { name = card.name, rarity = card.rarity, ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
                B.collectionProtection ??= new Dictionary<string, bool>();
                B.collectionProtection[cardId] = false;
                if (progress.lv < LevelMax) AddXP(card.cls, Math.Min(required, xpPerCard * count));
                B.Save();
            }, out reason);
        }
    }
}
