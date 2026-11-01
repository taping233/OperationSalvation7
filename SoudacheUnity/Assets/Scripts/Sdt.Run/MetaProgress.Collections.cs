using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed class CollectionConversionPreview
    {
        public bool canConvert, registered, registrationOnly;
        public string reason;
        public int maxCount, perCardXp, actualXp, overflowXp, beforeLevel, afterLevel;
    }

    public sealed partial class MetaProgress
    {
        public bool IsCollectible(CardDef card) => card != null && !string.IsNullOrEmpty(card.cls)
            && CharacterTable.For(card.cls) != null && (card.rarity == "职业" || card.type == "能力卡");
        public List<CardDef> CollectionPool() => CardLibrary.All().Where(IsCollectible).GroupBy(c => c.id).Select(g => g.First()).ToList();
        public (int total, int progress) CollectionSummary()
        {
            var pool = CollectionPool();
            return (pool.Count, pool.Count(card => B.IsCollected(card)));
        }
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
                if (milestone == null || MilestoneClaimed(id)) throw new InvalidOperationException("当前尚不能领取这项奖励");
                var collection = CollectionSummary();
                if (collection.progress < (milestone.all ? collection.total : milestone.need)) throw new InvalidOperationException("当前尚不能领取这项奖励");
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
        public CollectionConversionPreview PreviewCollectionConversion(CardDef card, int availableCount, int count = 1)
        {
            var result = new CollectionConversionPreview();
            if (!IsCollectible(card)) { result.reason = "这张卡不能转化为人物经验"; return result; }
            var progress = ClsData(card.cls);
            int level = Math.Min(LevelMax, Math.Max(1, progress.lv)), xp = Math.Max(0, progress.xp);
            result.beforeLevel = result.afterLevel = level;
            result.registered = B.IsCollected(card);
            result.registrationOnly = level >= LevelMax && !result.registered;
            result.perCardXp = card.type == "能力卡" ? 50 : 10;
            int remaining = level >= LevelMax ? 0 : -xp;
            for (int next = level; next < LevelMax; next++) remaining += XpForNext(next);
            remaining = Math.Max(0, remaining);
            int needed = level >= LevelMax ? result.registered ? 0 : 1 : (remaining + result.perCardXp - 1) / result.perCardXp;
            result.maxCount = Math.Min(Math.Max(0, availableCount), needed);
            long baseXp = Math.Max(0L, count) * result.perCardXp;
            result.actualXp = (int)Math.Min(baseXp, remaining);
            result.overflowXp = result.registrationOnly ? 0 : (int)Math.Min(int.MaxValue, baseXp - result.actualXp);
            int afterXp = xp + result.actualXp;
            while (result.afterLevel < LevelMax && afterXp >= XpForNext(result.afterLevel)) afterXp -= XpForNext(result.afterLevel++);
            if (count < 1) result.reason = "转换数量必须是正整数";
            else if (count > availableCount) result.reason = "卡牌数量不足，整笔转换未执行";
            else if (level >= LevelMax && result.registered) result.reason = "人物熟练度已满且卡牌已收录，无需再消耗卡牌";
            else if (B.IsProtected(card)) result.reason = "卡牌已受保护，请先取消保护；图鉴收录会保留";
            else if (count > result.maxCount) result.reason = result.registrationOnly ? "人物熟练度已满，首次收录只需消耗 1 张" : "达到满级最多需要 " + result.maxCount + " 张，超出部分不会消耗";
            result.canConvert = result.reason == null;
            return result;
        }

        public bool TryConvertCollection(string cardId, int count, out string reason, string stackKey)
        {
            return _rt.TryPersistMutation(() =>
            {
                var stack = B.FindStoredStack(stackKey);
                if (stack == null || stack.card.id != cardId) throw new InvalidOperationException("库存已变化，请重新选择");
                var card = CardLibrary.All().FirstOrDefault(item => item.id == cardId && (item.variantKey ?? "") == (stack.variantKey ?? stack.card.variantKey ?? ""));
                var preview = PreviewCollectionConversion(card, stack.count, count);
                if (!preview.canConvert) throw new InvalidOperationException(preview.reason);
                stack.count -= count; if (stack.count == 0) B.stash.Remove(stack);
                if (!preview.registered) B.collection[cardId] = new CollectionEntry { name = card.name, rarity = card.rarity, ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
                B.collectionProtection ??= new Dictionary<string, bool>();
                B.collectionProtection[cardId] = false;
                if (preview.actualXp > 0) AddXP(card.cls, preview.actualXp);
                B.Save();
            }, out reason);
        }
    }
}
