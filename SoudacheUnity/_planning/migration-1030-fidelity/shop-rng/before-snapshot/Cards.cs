// ported from src/cards.js（纯逻辑子集：类型定义 + 词条推导/爆率/判定函数）
// 245 张卡牌数据由 W2 生成的 Sdt.Core/Data/CardDatabase.cs 提供，
// 通过 CardLibrary.Init(() => CardDatabase.All) 注入（本文件不含数据）。
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Sdt.Core
{
    /// <summary>卡牌定义。字段名与契约 §2 / 原版卡对象完全一致；可空字段对齐 JS 的 undefined 语义。</summary>
    public sealed class CardDef
    {
        public string id;
        public string variantKey; // Stable departure snapshot identity, source card.variantKey.
        public string name;
        public int cost;
        public string rarity;
        public string type;
        public int? dmg;
        public string dmgType;
        public int? draw;
        public int? infuse;
        public int? heal;
        public int? armor;
        public string desc;
        public int? value;
        public bool? sellable;
        public bool unrandom;
        public string cls;
        public bool? hero;
        public string art;
        public string tokenOf;   // 衍生牌指向创造者 id（rarityOf/isHeroLine 用）
        public string tier;      // 物品档位（资源/战利品卡：C/B/A，AddItem 堆叠判定）
        public int count;        // 堆叠数量（运行时聚合，不参与卡面展示）
        public RuleValue rules;
        public int? zeroCostUntilTurn;
        public int? runtimeCost;
        public bool noInfuse;

        public CardDef Clone()
        {
            return (CardDef)MemberwiseClone();
        }
    }

    /// <summary>卡牌纯逻辑库（对齐 SDT.Cards 中无 DOM/存储的函数）。数据源需在启动时注入。</summary>
    public static partial class CardLibrary
    {
        public static readonly string[] Rarities = { "初始", "古朴", "稀有", "史诗", "传说", "衍生", "职业", "棱彩" };
        public static readonly string[] DmgTypes = { "武术", "法术" };
        public static readonly string[] DmgTypeOrder = { "attack", "spell", "fixed", "true" };

        // 内置初始牌「初始攻击」：每局开始固定携带 5 张（同名堆叠只占 1 格背包）。
        // 1 费 · 攻（+0）＝ 伤害等同于攻击力
        public static readonly CardDef SHA = new CardDef
        {
            id = "starter-attack", name = "初始攻击", cost = 1,
            rarity = "初始", type = "武术", dmg = 0, dmgType = "attack",
            desc = "攻（+0）：造成等同于攻击力的伤害。",
        };
        // 内置卡：金疮药（商店固定栏位，3 币，回复 10 血）
        public static readonly CardDef POTION = new CardDef
        {
            id = "builtin-jinchuangyao", name = "金疮药", cost = 1,
            rarity = "稀有", type = "道具", desc = "回复 10 点生命。",
        };
        // 内置卡：复原药水（商店固定栏位，3 币；背包中使用——复原消耗口袋至多 2 张卡牌）
        public static readonly CardDef RESTORE = new CardDef
        {
            id = "builtin-fuyuanyao", name = "复原药水", cost = 1,
            rarity = "稀有", type = "道具", desc = "复原至多 2 张消耗卡牌（背包中使用）。",
        };

        // 商店按稀有度定价（币；设计者 2026-09-04 定版：武术/法术/装备/道具
        // 同稀有度同价：古朴 2 / 稀有 3 / 史诗 4 / 传说 5 / 棱彩（英雄卡）8）
        public static readonly IReadOnlyDictionary<string, int> Price = CurrentBalanceData.Price;
        // 商店随机槽位的稀有度权重
        public static readonly IReadOnlyDictionary<string, int> ShopWeights = CurrentBalanceData.ShopWeights;
        // 卡牌爆率（设计者 2026-09-05 定版，宝箱掉落等「生成一张卡」场景同源）
        public static readonly IReadOnlyDictionary<string, double> DropWeights = CurrentBalanceData.DropWeights;
        public static readonly string[] DropDiscountTypes = { "道具" };
        public static readonly string[] DropTypes = { "武术", "法术", "装备", "道具", "资源" };

        private static Func<IReadOnlyList<CardDef>> _source;
        private static readonly CardDef[] Empty = new CardDef[0];

        /// <summary>启动时由装配层注入数据源（W2: () => CardDatabase.All）。未注入时返回空表。</summary>
        public static void Init(Func<IReadOnlyList<CardDef>> source) { _source = source; }

        public static IReadOnlyList<CardDef> All()
        {
            var src = _source != null ? _source() : Empty;
            // cards.js upsert: replace an existing stable ID at its current index; append new IDs.
            if (_customs == null && CustomsLoader == null) return src;
            var customs = CustomsList();
            if (customs.Count == 0) return src;
            var merged = new List<CardDef>(src);
            foreach(var card in customs)
            {
                int index=merged.FindIndex(existing=>existing?.id==card?.id);
                if(index>=0)merged[index]=card;else merged.Add(card);
            }
            return merged;
        }

        public static CardDef FindById(string id)
        {
            foreach (var c in All()) if (c.id == id) return c;
            return null;
        }
        public static CardDef FindByName(string name)
        {
            foreach (var c in All()) if (c.name == name) return c;
            return null;
        }

        public static bool IsDmgTypeValid(string dmgType)
        {
            return dmgType == "attack" || dmgType == "spell" || dmgType == "fixed" || dmgType == "true";
        }

        // 推导伤害类型词条（对齐 deriveDmgType，只读不写）：
        //   1. 已标注 dmgType → 原样
        //   2. 描述「攻 N 点」→ attack；3. 描述带 n′/n' 记号 → spell
        //   4. 「无视护甲/真实伤害」→ true；「造成 N 点伤害」句式：法术卡=spell，其余=fixed；
        //      有伤害数值但无句式线索按类型兜底。无 → null
        public static string DeriveDmgType(CardDef card)
        {
            if (IsDmgTypeValid(card.dmgType)) return card.dmgType;
            string desc = card.desc ?? string.Empty;
            if (Regex.IsMatch(desc, @"攻\s*[0-9]+\s*点") || Regex.IsMatch(desc, @"攻\s*（?\s*[+＋⁺]\s*[0-9]+")) return "attack";
            if (Regex.IsMatch(desc, @"[0-9]\s*[′']")) return "spell";
            if (Regex.IsMatch(desc, @"无视护甲|真实伤害")) return "true";
            if (Regex.IsMatch(desc, @"造成[^。；]*[0-9]+\s*点伤害")) return card.type == "法术" ? "spell" : "fixed";
            if ((card.dmg ?? 0) > 0) return card.type == "法术" ? "spell" : "fixed";
            return null;
        }

        // 伤害数值推导（对齐 deriveDmgValue）：描述「N′」开头给出伤害但 dmg 缺失的法术 → N
        public static int DeriveDmgValue(CardDef card)
        {
            if ((card.dmg ?? 0) > 0) return card.dmg.Value;
            if (Array.IndexOf(DmgTypes, card.type) < 0) return 0;
            string desc = (card.desc ?? string.Empty).Trim();
            if (Regex.IsMatch(desc, @"^注能\s*[（(]")) return 0;
            Match m = Regex.Match(desc, @"(?:^|[：:，,]\s*)?(\d+)\s*′");
            return m.Success ? int.Parse(m.Groups[1].Value) : 0;
        }

        // 抽卡词条推导：已标注 draw → 原样；描述「抽 N 张牌」→ N
        public static int DeriveDraw(CardDef card)
        {
            if ((card.draw ?? 0) > 0) return card.draw.Value;
            Match m = Regex.Match(card.desc ?? string.Empty, @"抽\s*(\d+)\s*张牌");
            return m.Success ? int.Parse(m.Groups[1].Value) : 0;
        }

        // 注能词条推导：「注能(N)」→ N；「注能(小)」→ 1
        public static int DeriveInfuse(CardDef card)
        {
            if ((card.infuse ?? 0) > 0) return card.infuse.Value;
            Match m = Regex.Match(card.desc ?? string.Empty, @"注能\s*[（(]\s*(\d+|小)\s*[)）]");
            if (!m.Success) return 0;
            return m.Groups[1].Value == "小" ? 1 : int.Parse(m.Groups[1].Value);
        }

        // 注能变体词条：描述里带「注能(N)：…」子句原文，无则 null
        public static string InfuseAlt(CardDef card)
        {
            if (!((card.infuse ?? 0) > 0)) return null;
            Match m = Regex.Match(card.desc ?? string.Empty, @"注能\s*[（(]\s*(?:\d+|小)\s*[)）]\s*[：:]?\s*[^。；;]*");
            return m.Success ? m.Value.Trim() : null;
        }

        // 回复词条推导：「回复 N 点生命/血」「+N 血」→ N
        public static int DeriveHeal(CardDef card)
        {
            if ((card.heal ?? 0) > 0) return card.heal.Value;
            string desc = card.desc ?? string.Empty;
            Match m = Regex.Match(desc, @"回复\s*(\d+)\s*(?:点\s*生命|点?血)");
            if (!m.Success) m = Regex.Match(desc, @"\+\s*(\d+)\s*血");
            return m.Success ? int.Parse(m.Groups[1].Value) : 0;
        }

        // 护甲词条推导：「获得 N 点护甲」「+N 甲」→ N
        public static int DeriveArmor(CardDef card)
        {
            if ((card.armor ?? 0) > 0) return card.armor.Value;
            string desc = card.desc ?? string.Empty;
            Match m = Regex.Match(desc, @"获得\s*(\d+)\s*点?\s*护甲");
            if (!m.Success) m = Regex.Match(desc, @"\+\s*(\d+)\s*甲");
            return m.Success ? int.Parse(m.Groups[1].Value) : 0;
        }

        // 职业卡池（cls 字段严格隔离）
        public static List<CardDef> ClassPool(string cls)
        {
            var outv = new List<CardDef>();
            foreach (var c in All()) if (c.cls == cls) outv.Add(c);
            return outv;
        }

        // 随机发放职业卡（开局选职业 / 火堆 / 事件）：只从「职业」稀有度卡中取，不含英雄卡与衍生牌
        public static CardDef RandomClassCard(Rng rng, string cls)
        {
            List<CardDef> pool;
            if (!string.IsNullOrEmpty(cls)) pool = ClassPool(cls);
            else
            {
                pool = new List<CardDef>();
                foreach (var c in All()) if (!string.IsNullOrEmpty(c.cls)) pool.Add(c);
            }
            var filtered = new List<CardDef>();
            foreach (var c in pool) if (c.rarity == "职业" && c.hero != true) filtered.Add(c);
            if (filtered.Count == 0) return null;
            return filtered[(int)Math.Floor(rng.Random("card", "reward") * filtered.Count)];
        }

        // 「无法被随机或发现」判定（设计者 2026-09-01/04/05 定版，见 cards.js 注释）
        public static bool IsRandomObtainable(CardDef card)
        {
            if (card == null || card.rarity == "初始" || card.rarity == "衍生") return false;
            if (!string.IsNullOrEmpty(card.cls) && card.type != "能力卡") return false;
            if (card.rarity == "职业") return false;
            if (card.type == "英雄卡" || card.type == "能力卡" || card.type == "生物") return false;
            if (card.rarity == "棱彩") return false;
            return !card.unrandom;
        }

        // 出售资格判定（设计者 2026-09-01 定版：默认不可出售，只有「可出售」备注的道具可卖）
        public static bool IsSellable(CardDef card)
        {
            if (card.sellable == true) return true;
            if (card.sellable == false) return false;
            string desc = card.desc ?? string.Empty;
            if (desc.Contains("不可出售")) return false;
            return desc.Contains("可出售");
        }

        // 英雄卡系判定：英雄卡本体（hero: true）或其衍生牌（tokenOf 指向英雄卡）
        public static bool IsHeroLine(CardDef card)
        {
            if (card == null) return false;
            if (card.hero == true) return true;
            if (!string.IsNullOrEmpty(card.tokenOf))
            {
                var src = FindById(card.tokenOf);
                if (src != null && src.hero == true) return true;
            }
            return false;
        }

        // 有效稀有度（展示/经济用）：英雄卡系 = 棱彩；衍生牌继承创造者稀有度
        public static string RarityOf(CardDef card)
        {
            if (IsHeroLine(card)) return "棱彩";
            if (card.rarity == "衍生" && !string.IsNullOrEmpty(card.tokenOf))
            {
                var src = FindById(card.tokenOf);
                if (src != null) return RarityOf(src);
            }
            return card.rarity;
        }

        // 商店收购价：币值优先；无币值的可出售卡按稀有度半价（至少 1 币）
        public static int SellPrice(CardDef card)
        {
            int v = card.value ?? 0;
            if (v > 0) return v;
            int p = Price.TryGetValue(RarityOf(card), out int price) ? price : 2;
            return Math.Max(1, p / 2);
        }

        // 按爆率随机抽 1 张掉落卡（对齐 randomDropCard）：先稀有度掷档（2.25:1.5:1），
        // 档内按类型权重挑卡（道具/资源 ×0.8）；taken = 同一宝箱内已开出的 id（尽量不重复）
        public static CardDef RandomDropCard(Rng rng, HashSet<string> taken, string mode = null, string typeFilter = null)
        {
            bool hasTaken = taken != null && taken.Count > 0;
            var rarities = new List<string>(DropWeights.Keys);
            double totalW = 0;
            foreach (var pair in DropWeights) totalW += mode == "elite" && pair.Key != "古朴" ? pair.Value * 1.2 : pair.Value;
            for (int tries = 0; tries < 50; tries++)
            {
                double roll = rng.Random("loot", "reward") * totalW;
                string rarity = rarities[0];
                foreach (var kv in DropWeights) { roll -= mode == "elite" && kv.Key != "古朴" ? kv.Value * 1.2 : kv.Value; if (roll <= 0) { rarity = kv.Key; break; } }
                var pool = new List<CardDef>();
                foreach (var c in All())
                {
                    if (c.rarity != rarity || Array.IndexOf(DropTypes, c.type) < 0) continue;
                    if (!IsRandomObtainable(c)) continue;
                    if (c.id == "tt-token-color" || typeFilter != null && c.type != typeFilter) continue;
                    if (hasTaken && taken.Contains(c.id)) continue;
                    pool.Add(c);
                }
                if (pool.Count == 0) continue;
                double tw = 0;
                var weighted = new List<KeyValuePair<CardDef, double>>();
                foreach (var c in pool)
                {
                    double w = Array.IndexOf(DropDiscountTypes, c.type) >= 0 ? 0.7 : c.type == "装备" ? 0.8 : 1;
                    tw += w;
                    weighted.Add(new KeyValuePair<CardDef, double>(c, w));
                }
                double roll2 = rng.Random("loot", "reward") * tw;
                foreach (var kv in weighted) { roll2 -= kv.Value; if (roll2 <= 0) return kv.Key; }
                return weighted[weighted.Count - 1].Key;
            }
            return null;
        }
    }
}
