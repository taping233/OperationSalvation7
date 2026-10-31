// ported from src/cards.js（协调者集成补件：CLASSES 常量与 CARD_BACKS 表 + 自定义卡存取）
using System;
using System.Collections.Generic;

namespace Sdt.Core
{
    public static partial class CardLibrary
    {
        /// <summary>cards.js CLASSES（第七批职业卡的职业表，cls 字段标职业归属）。</summary>
        public static readonly string[] Classes = { "侠客", "战士", "牧师", "法师", "降临者" };

        /// <summary>卡背图案（v0.21）：默认「行囊粗布」恒解锁，其余由成就领取解锁。emblem 印在卡背中央；from 说明解锁途径。</summary>
        public sealed class CardBack { public string id, name, icon, from; }
        public static readonly CardBack[] CardBacks =
        {
            new CardBack { id = "classic", name = "行囊粗布", icon = "cards",   from = "默认卡背" },
            new CardBack { id = "wolf",    name = "猎手皮纸", icon = "swords",  from = "成就「猎手」" },
            new CardBack { id = "coin",    name = "富商锦缎", icon = "coin",    from = "成就「小有积蓄」" },
            new CardBack { id = "vault",   name = "仓廪木纹", icon = "pocket",  from = "成就「仓廪充实」" },
            new CardBack { id = "boss",    name = "弑神黑曜", icon = "demon",   from = "成就「弑神者」" },
            new CardBack { id = "altar",   name = "核心星轨", icon = "crystal", from = "成就「净化征服者」" },
            new CardBack { id = "pet",     name = "忠犬爪印", icon = "paw",     from = "成就「最忠实的伙伴」" },
        };

        // ============================================================
        // 自定义卡（cards.js Custom：localStorage 键 sdt-cards-v1 的对应物）。
        // 纯逻辑层不做文件 IO：存取委托由装配层注入（GameRuntime ctor 接 SaveSystem global.json），
        // 未注入时仅内存态生效。upsert/remove/clearAll 语义照抄源码。
        // ============================================================
        public static Func<IReadOnlyList<CardDef>> CustomsLoader;
        public static Action<IReadOnlyList<CardDef>> CustomsSaver;
        static List<CardDef> _customs;

        static List<CardDef> CustomsList()
        {
            if (_customs == null)
                _customs = CustomsLoader != null ? new List<CardDef>(CustomsLoader()) : new List<CardDef>();
            return _customs;
        }

        /// <summary>恢复出厂等场景清空内存缓存（存档键由调用方自行删除）。</summary>
        public static void ResetCustomsCache() { _customs = null; }

        /// <summary>cards.js upsert：无 id 生成 id，按 id 替换或追加，随后落盘。返回带 id 的卡。</summary>
        public static CardDef Upsert(CardDef card)
        {
            if (card == null) return null;
            if (string.IsNullOrEmpty(card.id))
            {
                // 源码：'c' + Date.now().toString(36) + rand('identity')*46656 的 36 进制尾巴；此处 ticks 十六进制等价保证唯一
                card.id = "c" + DateTime.UtcNow.Ticks.ToString("x") + (Math.Floor(new Random().NextDouble() * 46656)).ToString("x");
            }
            var cards = CustomsList();
            var i = cards.FindIndex(c => c.id == card.id);
            if (i >= 0) cards[i] = card; else cards.Add(card);
            CustomsSaver?.Invoke(cards);
            return card;
        }

        /// <summary>cards.js remove：按 id 过滤后落盘。</summary>
        public static void Remove(string id)
        {
            var cards = CustomsList();
            if (cards.RemoveAll(c => c.id == id) > 0) CustomsSaver?.Invoke(cards);
        }

        /// <summary>cards.js clearAll：清空自定义卡并落盘空表。</summary>
        public static void ClearCustoms()
        {
            CustomsList().Clear();
            CustomsSaver?.Invoke(CustomsList());
        }
    }
}
