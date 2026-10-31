using System;
using System.Collections.Generic;

namespace Sdt.Core
{
    // An event owns its frozen candidates, rolls and admission receipts across save/reentry.
    [Serializable]
    public sealed class EventProgress
    {
        public string eventId, stage = "choices", route, choiceKey, message;
        public bool settled, commissionPending, commissionUsed, battleStarted;
        public int diceIndex, need = 1, price, attempts;
        public List<RuleValue> pending = new List<RuleValue>();
        public List<EventDie> dice = new List<EventDie>();
        public List<string> cardIds = new List<string>(), cardKeys = new List<string>();
        public List<EventSource> sources = new List<EventSource>();
        public List<string> drawn = new List<string>();
        public List<MonsterDef> enemies;
        public List<string> battleChests;
        public List<List<string>> drawPools;
        public List<RuleValue> drawAfter;
        public bool uniqueDraw;
        public List<int> taken = new List<int>();
        public string commissionShopKey;
        public bool commissionAnnounced;
        public List<int> commissionSlots = new List<int>();
        public List<EventDie> commissionDice = new List<EventDie>();
    }
    [Serializable]
    public sealed class EventSource
    {
        public string uid, id, name, type, rarity;
        public static EventSource Of(OwnedCard entry) => new EventSource { uid=entry.uid, id=entry.card.id, name=entry.card.name, type=entry.card.type, rarity=entry.card.rarity };
        public bool Matches(OwnedCard entry) => entry != null && entry.safe != true && !entry.stored && string.IsNullOrEmpty(entry.pouchOf)
            && entry.uid == uid && entry.card.id == id && entry.card.name == name && entry.card.type == type && entry.card.rarity == rarity;
    }
    [Serializable]
    public sealed class EventDie
    {
        public List<string> labels = new List<string>();
        public List<RuleValue> outcomes = new List<RuleValue>();
        public int? result;
    }
}
