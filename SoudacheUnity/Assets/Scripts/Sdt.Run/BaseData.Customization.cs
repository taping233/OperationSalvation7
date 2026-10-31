using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using UnityEngine;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed class HubShopGood { public string id, material, name, tip; public int price; public string Key => material ?? id; }
    public sealed class SkinOption { public string characterId, id, name, resource; }
    public sealed class CollectionReward { public int wood, rations, keys, legend, egg; }
    public sealed class CollectionMilestone { public string id; public int need; public bool all; public CollectionReward reward; }
    public sealed class HubCatalog
    {
        public List<HubShopGood> goods = new List<HubShopGood>();
        public List<SkinOption> skins = new List<SkinOption>();
        public List<CollectionMilestone> milestones = new List<CollectionMilestone>();
        public Dictionary<string, string> baseNotes = new Dictionary<string, string>();
        static HubCatalog _current;
        public static HubCatalog Current => _current ??= JsonConvert.DeserializeObject<HubCatalog>(
            Resources.Load<TextAsset>("Data/CurrentHubCatalog").text);
    }

    public sealed partial class BaseData
    {
        [JsonProperty("selectedSkins")] public Dictionary<string, string> selectedSkins = new Dictionary<string, string>();
        [JsonProperty("collClaimed")] public Dictionary<string, bool> collClaimed = new Dictionary<string, bool>();
        [JsonProperty("collectionProtection")] public Dictionary<string, bool> collectionProtection = new Dictionary<string, bool>();
        [JsonProperty("keys")] public int keys;
        void RequireCurrentBase(){if(!ReferenceEquals(this,GameRuntime.I.Base))throw new InvalidOperationException("档案已切换，请重新打开页面");}

        public string SelectedSkin(string characterId) => !string.IsNullOrEmpty(characterId) && selectedSkins != null && selectedSkins.TryGetValue(characterId, out var skin) ? skin : "default";
        public bool TrySelectSkin(string characterId, string skinId, out string reason)
        {
            return GameRuntime.I.TryPersistMutation(() =>
            {
                RequireCurrentBase();
                if (CharacterTable.For(characterId) == null || (skinId != "default" && !HubCatalog.Current.skins.Any(s => s.characterId == characterId && s.id == skinId)))
                    throw new InvalidOperationException("该人物外观暂不可用");
                selectedSkins ??= new Dictionary<string, string>();
                selectedSkins[characterId] = skinId;
                Save();
            }, out reason);
        }

        public bool TryPurchase(string key, out string reason)
        {
            return GameRuntime.I.TryPersistMutation(() =>
            {
                RequireCurrentBase();
                var good = HubCatalog.Current.goods.SingleOrDefault(item => item.Key == key);
                if (good == null || good.price < 0) throw new InvalidOperationException("商品已变化，请重新选择");
                if (coins < good.price) throw new InvalidOperationException("储备币不足");
                CardDef card = null;
                if (good.material == null)
                {
                    card = CardLibrary.FindById(good.id);
                    if (card == null) throw new InvalidOperationException("商品卡牌暂不可用");
                    if (StashRoom < 1) throw new InvalidOperationException("仓库已满，请先整理或扩建");
                }
                else if (good.material != "wood" && good.material != "rations") throw new InvalidOperationException("商品物资配置无效");
                coins -= good.price;
                if (good.material == "wood") wood++;
                else if (good.material == "rations") rations++;
                else AppendRewardCards(new[] { card });
                Save();
            }, out reason);
        }

        internal void AppendRewardCards(IEnumerable<CardDef> cards)
        {
            foreach (var card in cards)
            {
                var incoming = new StashStack { card = card, count = 1, variantKey = card.variantKey };
                var existing = stash.FirstOrDefault(stack => SameStoredCard(stack, incoming));
                if (existing == null) { incoming.card = card.Clone(); stash.Add(incoming); }
                else existing.count++;
            }
        }

        static string StoredVariant(StashStack stack) => !string.IsNullOrEmpty(stack.variantKey) ? stack.variantKey : stack.card?.variantKey ?? "";
        static bool SameStoredCard(StashStack left, StashStack right) => left?.card != null && right?.card != null
            && ((!string.IsNullOrEmpty(left.card.id) || !string.IsNullOrEmpty(right.card.id))
                ? left.card.id == right.card.id : left.card.name == right.card.name)
            && StoredVariant(left) == StoredVariant(right);

        public bool IsProtected(CardDef card) => card != null && (collectionProtection != null && collectionProtection.TryGetValue(card.id, out var flag)
            ? flag : IsCollected(card));
        public bool TrySetProtection(CardDef card, bool protect, out string reason)
        {
            return GameRuntime.I.TryPersistMutation(() =>
            {
                RequireCurrentBase();
                if (card == null || !stash.Any(stack => stack.card.id == card.id && stack.count > 0)) throw new InvalidOperationException("该卡牌已不在仓库");
                if (!collection.ContainsKey(card.id) && !string.IsNullOrEmpty(card.cls) && (card.rarity == "职业" || card.type == "能力卡"))
                    throw new InvalidOperationException("职业卡或能力卡需通过消耗卡牌转化后首次收录");
                if (!collection.ContainsKey(card.id)) collection[card.id] = new CollectionEntry { name = card.name, rarity = card.rarity, ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
                collectionProtection ??= new Dictionary<string, bool>();
                collectionProtection[card.id] = protect;
                Save();
            }, out reason);
        }

        Dictionary<string, string> ReadPhotoNotes()
        {
            var token = GameRuntime.I.Saves.Global.GetJson("sdt-card-photo-notes-v1");
            return token == null ? new Dictionary<string, string>() : token.ToObject<Dictionary<string, string>>();
        }
        public string PhotoNote(string cardId)
        {
            var notes = ReadPhotoNotes();
            return notes.TryGetValue(cardId, out var note) ? note : HubCatalog.Current.baseNotes.TryGetValue(cardId, out note) ? note : "";
        }
        public bool TrySavePhotoNote(string cardId, string text, out string reason)
        {
            return GameRuntime.I.TryPersistMutation(() =>
            {
                if (CardLibrary.FindById(cardId) == null) throw new InvalidOperationException("照片已变化，请重新选择");
                var notes = ReadPhotoNotes();
                text = (text ?? "").Trim();
                if (text.Length > 240) text = text.Substring(0, 240);
                if (text.Length == 0) notes.Remove(cardId); else notes[cardId] = text;
                GameRuntime.I.Saves.Global.SetJson("sdt-card-photo-notes-v1", notes);
            }, out reason);
        }
    }
}
