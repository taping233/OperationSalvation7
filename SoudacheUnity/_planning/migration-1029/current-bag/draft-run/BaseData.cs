// ported from src/base.js（基地：背包容量/安全仓/卡牌仓库/扩建/出售/收藏/储备币/卡背）
using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;

namespace Sdt.Run
{
    /// <summary>卡牌仓库 / 基地消耗口袋的堆条目（base.js stash/pocket 元素）。</summary>
    public sealed class StashStack
    {
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)] public string stackKey, variantKey;
        [JsonProperty("card")] public CardDef card;
        [JsonProperty("count")] public int count;
    }

    /// <summary>收藏图鉴条目（base.js collection 值）。</summary>
    public sealed class CollectionEntry
    {
        [JsonProperty("name")] public string name;
        [JsonProperty("rarity")] public string rarity = "?";
        [JsonProperty("ts")] public long ts;   // Date.now() 毫秒
    }

    /// <summary>档位统计（base.js data.stats）。</summary>
    public sealed class BaseStats
    {
        [JsonProperty("extracts")] public int extracts;
        [JsonProperty("deaths")] public int deaths;
        [JsonProperty("kills")] public int kills;
        [JsonProperty("actions")] public int actions;
        [JsonProperty("playSeconds")] public double playSeconds;   // 该档累计实际对局时间
        [JsonProperty("bossKills")] public List<string> bossKills = new List<string>();
        [JsonProperty("bestRunCoins")] public int bestRunCoins;
        [JsonProperty("stashTotal")] public int stashTotal;
        [JsonProperty("turnMovesMax")] public int turnMovesMax;
        [JsonProperty("battleEquipsMax")] public int battleEquipsMax;
        [JsonProperty("reviveKills")] public int reviveKills;
        [JsonProperty("nestBossKills")] public List<string> nestBossKills=new List<string>();
        [JsonProperty("labTotalScore")] public int labTotalScore;
    }

    /// <summary>职业熟练度条目（base.js data.classes / data.characters 值）。</summary>
    public sealed class ClassProgress
    {
        [JsonProperty("lv")] public int lv = 1;
        [JsonProperty("xp")] public int xp;
    }

    /// <summary>
    /// 基地数据（base.js 全量数值照抄）。原版函数 → C# 方法映射：
    /// def()→Def / mergeDef+adopt()→Adopt / use()→Use / save()→Save / reset()→Reset(+SeedStarterStash) /
    /// peek()→Peek / wipe()→Wipe / hasSlot()→HasSlot / migrateLegacy()→MigrateLegacy /
    /// bagCap/safeCap/stashCap/stashUsed/stashRoom（属性） / canUpgradeBag/Safe/Stash + upgradeBag/Safe/Stash /
    /// deposit()→Deposit / depositCards()→DepositCards / restore()→Restore / takeStashCards()→TakeStashCards /
    /// sellStashCards()→SellStashCards / sellRaw()→SellRaw / collectToggle()→CollectToggle / isCollected()→IsCollected /
    /// takeReserveCoins()→TakeReserveCoins / keyCount（属性） / isSha()→IsSha（静态） /
    /// isBackUnlocked/unlockBack/setBack/backSel。
    /// </summary>
    public sealed partial class BaseData
    {
        public const string SlotKeyPrefix = "sdt-base-v2-slot";   // SLOT_KEY
        public const string LegacyKey = "sdt-base-v1";            // LEGACY_KEY
        public const int KeyNeeded = 10;                          // 宝藏大门 KEY_NEEDED

        // ---------- 存档字段（键名不改） ----------
        [JsonProperty("wood")] public int wood;
        [JsonProperty("rations")] public int rations;
        [JsonProperty("bagUp")] public int bagUp;
        [JsonProperty("safeUp")] public int safeUp;
        [JsonProperty("stashUp")] public int stashUp;             // 仓库扩建等级（每次 +3 张容量）
        [JsonProperty("coins")] public int coins;                 // 储备币：卖出所得，出发时带走
        [JsonProperty("stash")] public List<StashStack> stash = new List<StashStack>();
        [JsonProperty("pocket")] public List<StashStack> pocket = new List<StashStack>();
        [JsonProperty("collection")] public Dictionary<string, CollectionEntry> collection = new Dictionary<string, CollectionEntry>();
        [JsonProperty("selMode")] public string selMode = "standard";   // 上次出发的玩法
        [JsonProperty("classes")] public Dictionary<string, ClassProgress> classes = new Dictionary<string, ClassProgress>();
        [JsonProperty("characters")] public Dictionary<string, ClassProgress> characters = new Dictionary<string, ClassProgress>();
        [JsonProperty("stats")] public BaseStats stats = new BaseStats();
        [JsonProperty("achClaimed")] public Dictionary<string, bool> achClaimed = new Dictionary<string, bool>();
        [JsonProperty("backs")] public Dictionary<string, bool> backs = new Dictionary<string, bool> { { "classic", true } };
        [JsonProperty("backSel")] public string backSel = "classic";

        // ---------- 运行时（不序列化） ----------
        [JsonIgnore] public int? Slot { get; private set; }        // 当前游玩档位（1..5）；标题界面 null
        [JsonIgnore] SaveSystem _saves;

        /// <summary>def()：新档案初始值。</summary>
        public static BaseData Def() => new BaseData();

        /// <summary>base.js adopt(raw)：把原始 JSON 补齐为完整基地数据（老存档缺字段安全补齐）。</summary>
        public static BaseData Adopt(BaseData raw)
        {
            if (raw == null) return Def();
            raw.stash ??= new List<StashStack>();
            raw.pets ??= new Dictionary<string,PetProgress>();
            if(!raw.pets.ContainsKey("dog"))raw.pets["dog"]=new PetProgress();
            if(string.IsNullOrEmpty(raw.petSel)||!raw.pets.ContainsKey(raw.petSel))raw.petSel="dog";
            raw.pocket ??= new List<StashStack>();
            raw.runes ??= new List<Newtonsoft.Json.Linq.JObject>();
            raw.collection ??= new Dictionary<string, CollectionEntry>();
            raw.stats ??= new BaseStats();
            raw.stats.bossKills ??= new List<string>();
            raw.classes ??= new Dictionary<string, ClassProgress>();
            raw.characters ??= new Dictionary<string, ClassProgress>();
            raw.achClaimed ??= new Dictionary<string, bool>();
            raw.backs ??= new Dictionary<string, bool>();
            raw.backs["classic"] = true;   // 默认卡背永远可用
            if (string.IsNullOrEmpty(raw.backSel) || !raw.backs.TryGetValue(raw.backSel, out var ok) || !ok)
                raw.backSel = "classic";
            var chars = raw.characters.ToDictionary(kv => kv.Key, kv => new CharacterTable.CharProgress { lv = kv.Value.lv, xp = kv.Value.xp });
            var olds = raw.classes.ToDictionary(kv => kv.Key, kv => new CharacterTable.CharProgress { lv = kv.Value.lv, xp = kv.Value.xp });
            var migrated = CharacterTable.MigrateCharacterProgress(chars, olds);
            raw.characters = migrated.ToDictionary(kv => kv.Key, kv => new ClassProgress { lv = kv.Value.lv, xp = kv.Value.xp });
            if(!raw.ValidatePreparation(out var invalid)||!raw.ValidateSupplyPack(out invalid)||!raw.ValidateStory(out invalid))throw new System.IO.InvalidDataException(invalid);
            return raw;
        }

        static string SlotKey(int i) => SlotKeyPrefix + i;

        static BaseData ParseRaw(SaveSystem saves, int i)
        {
            try
            {
                var raw = saves.Global.GetJson(SlotKey(i));
                return raw == null ? null : Adopt(SaveJson.Read<BaseData>(raw));
            }
            catch(Exception e){saves.ReportReadError("基地档读取失败，原文件已保留："+e.Message);return null;}
        }

        /// <summary>base.js migrateLegacy：旧全局基地（sdt-base-v1）→ 各已有对局档位（无则档位 1）。</summary>
        public static void MigrateLegacy(SaveSystem saves, int[] existingSlots)
        {
            var legacy = saves.Global.GetJson(LegacyKey);
            if (legacy == null) return;
            var targets = (existingSlots != null && existingSlots.Length > 0) ? existingSlots : new[] { 1 };
            foreach (var i in targets)
                if (saves.Global.GetJson(SlotKey(i)) == null)
                    saves.Global.SetJson(SlotKey(i), legacy);
            saves.Global.Delete(LegacyKey);
        }

        /// <summary>base.js use(s)：进入档位，加载该档独立基地数据（没有则新档案）。</summary>
        public static BaseData Use(SaveSystem saves, int slot)
        {
            var d = ParseRaw(saves, slot);
            if(saves.HasReadError)throw new System.IO.IOException(saves.LastError);
            var data = d != null ? Adopt(d) : Def();
            data.Slot = slot;
            data._saves = saves;
            return data;
        }

        /// <summary>base.js save()：写回 global.json 的该档位键。</summary>
        public void Save()
        {
            if (Slot == null || _saves == null) return;   // 未选档不落盘
            if(!ValidatePreparation(out var invalid)||!ValidateSupplyPack(out invalid)||!ValidateStory(out invalid))throw new System.IO.InvalidDataException(invalid);
            try{_saves.Global.SetJson(SlotKey(Slot.Value), this);}
            catch
            {
                if(!_saves.InTransaction){var previous=_saves.Global.GetJson(SlotKey(Slot.Value));if(previous!=null)SaveJson.Populate(previous.ToString(),this);}
                throw;
            }
        }

        /// <summary>base.js reset(s) + seedStarterStash()：重开档位，仓库预置 5 张随机卡（按稀有度权重，不重复）。</summary>
        public static BaseData Reset(SaveSystem saves, Rng rng, int slot)
        {
            var data = Adopt(Def());
            data.Slot = slot;
            data._saves = saves;
            data.SeedStarterStash(rng);
            data.Save();
            return data;
        }

        /// <summary>base.js seedStarterStash（数值照抄：guard 200 / 单稀有度重试 30 / 目标 5 张）。</summary>
        public void SeedStarterStash(Rng rng)
        {
            var pool = CardDatabase.All.Where(c =>
                c.rarity != "衍生" && c.name != "初始攻击" && CardLibrary.IsRandomObtainable(c)).ToList();
            if (pool.Count == 0) return;
            var weights = CardLibrary.ShopWeights;   // [稀有度] => 权重
            double totalW = weights.Values.Sum();
            var taken = new HashSet<string>();
            int guard = 0;
            int used() => stash.Sum(s => s.count);
            while (used() < 5 && guard++ < 200)
            {
                CardDef card = null;
                if (weights != null && weights.Count > 0 && totalW > 0)
                {
                    for (int t = 0; t < 30 && card == null; t++)
                    {
                        double roll = rng.NextDouble() * totalW;
                        string rar = null;
                        foreach (var kv in weights) { roll -= kv.Value; if (roll <= 0) { rar = kv.Key; break; } }
                        if (rar == null) rar = weights.Keys.First();
                        var sub = pool.Where(c => c.rarity == rar && !taken.Contains(c.id)).ToList();
                        if (sub.Count > 0) card = sub[(int)(rng.NextDouble() * sub.Count)];
                    }
                }
                if (card == null)
                {
                    var sub = pool.Where(c => !taken.Contains(c.id)).ToList();
                    if (sub.Count == 0) break;
                    card = sub[(int)(rng.NextDouble() * sub.Count)];
                }
                taken.Add(card.id);
                stash.Add(new StashStack { card = card, count = 1 });
            }
        }

        /// <summary>base.js peek(i)：只读概览，不切档。</summary>
        public static BaseData Peek(SaveSystem saves, int i)
        {
            var raw = ParseRaw(saves, i);
            return raw != null ? Adopt(raw) : null;
        }

        /// <summary>base.js wipe(i)：删除该档位基地数据。</summary>
        public static void Wipe(SaveSystem saves, int i) { saves.Global.Delete(SlotKey(i)); }

        /// <summary>base.js hasSlot(i)</summary>
        public static bool HasSlot(SaveSystem saves, int i) => saves.Global.GetJson(SlotKey(i)) != null;

        /// <summary>base.js isSha(card)：「初始攻击」能进消耗口袋但永不入卡牌仓库。</summary>
        public static bool IsSha(CardDef card)
        {
            return card != null && (card.id == CardLibrary.SHA.id ||
                (card.id == null && card.name == "初始攻击"));
        }

        // ---------- 卡背（v0.21） ----------
        public bool IsBackUnlocked(string id) => backs != null && backs.TryGetValue(id, out var v) && v;
        public bool UnlockBack(string id)
        {
            backs ??= new Dictionary<string, bool>();
            if (backs.TryGetValue(id, out var has) && has) return false;
            backs[id] = true;
            Save();
            return true;
        }
        public bool SetBack(string id)
        {
            if (!IsBackUnlocked(id)) return false;
            backSel = id;
            Save();
            return true;
        }
        /// <summary>当前装备的卡背 id（异常时回退默认）。</summary>
        public string BackSel => IsBackUnlocked(backSel) ? backSel : "classic";

        // ---------- 容量与升级（rules.js 数值经 Sdt.Core.GameRules） ----------
        public int BagCap => Math.Min(GameRules.BagMax, GameRules.BagSize + bagUp);
        public int SafeCap => Math.Min(GameRules.SafeMax, GameRules.SafeStart + PetLevel(petSel)-1)+(CarriedPet?.effect?.safeBonus??0);
        /// <summary>卡牌仓库容量按张计（同名堆叠不省容量）。</summary>
        public int StashCap => Math.Min(GameRules.StashMax, GameRules.StashStart + stashUp * GameRules.StashUpgradeSlots);
        public int StashUsed => stash.Sum(s => s.count)+(runes?.Count??0);
        public int StashRoom => Math.Max(0, StashCap - StashUsed);

        public bool CanUpgradeBag => bagUp < GameRules.BagMax - GameRules.BagSize && wood >= GameRules.BagUpgradeWood;
        public bool CanUpgradeSafe => CanUpgradePet(petSel);
        public bool CanUpgradeStash => StashCap < GameRules.StashMax && wood >= GameRules.StashUpgradeWood&&(StashCap<50||(runes?.Count??0)>=2);

        public bool UpgradeBag()
        {
            if (!CanUpgradeBag) return false;
            return GameRuntime.I.TryPersistMutation(()=>{RequireCurrentBase();wood-=GameRules.BagUpgradeWood;bagUp++;Save();},out _);
        }
        public bool UpgradeSafe()
        {
            return TryUpgradePet(petSel,out _);
        }
        public bool UpgradeStash()
        {
            if (!CanUpgradeStash) return false;
            return GameRuntime.I.TryPersistMutation(()=>{RequireCurrentBase();wood-=GameRules.StashUpgradeWood;if(StashCap>=50)runes.RemoveRange(0,2);stashUp++;Save();},out _);
        }

        // ---------- 运回结算 ----------
        /// <summary>base.js deposit(items)：只收木材/口粮，其余物资不落库。</summary>
        public void Deposit(IEnumerable<InventorySlot> items)
        {
            foreach (var it in items ?? Enumerable.Empty<InventorySlot>())
            {
                if (it.name == "木材") wood += it.count > 0 ? it.count : 1;
                else if (it.name == "口粮") rations += it.count > 0 ? it.count : 1;
            }
            Save();
        }

        /// <summary>base.js appendCards：按 ID 与 variant 入库；职业卡不进基地消耗区，初始牌直接消散。</summary>
        public void DepositCards(IEnumerable<StashStack> cards, bool toPocket = false)
        {
            if (!GameRuntime.I.TryPersistMutation(() =>
            {
                RequireCurrentBase();
                var list = toPocket ? pocket : stash;
                foreach (var incoming in cards ?? Enumerable.Empty<StashStack>())
                {
                    if (incoming?.card == null || IsSha(incoming.card) || (toPocket && incoming.card.rarity == "职业")) continue;
                    // stored-card-identity.js ignores display names whenever either snapshot has an ID.
                    string Identity(StashStack item) => GameRuntime.DepartureStackKey(new StashStack {
                        card = item.card, variantKey = string.IsNullOrEmpty(item.variantKey) ? item.card?.variantKey : item.variantKey
                    });
                    string key = Identity(incoming);
                    var existing = list.FirstOrDefault(item => item.card != null && Identity(item) == key);
                    if (existing != null) existing.count += incoming.count > 0 ? incoming.count : 1;
                    else list.Add(new StashStack { card = incoming.card.Clone(), count = incoming.count > 0 ? incoming.count : 1,
                        stackKey = incoming.stackKey, variantKey = incoming.variantKey });
                }
                Save();
            }, out var reason)) throw new System.IO.IOException(reason);
        }

        /// <summary>
        /// base.js restore(i)：消耗口袋 → 仓库。返回 true=成功 / "sha"=初始牌销毁 / "full"=容量不足 / false=无效序号。
        /// </summary>
        public string Restore(int i)
        {
            string result="false";bool ok=GameRuntime.I.TryPersistMutation(()=>{RequireCurrentBase();result=RestoreCore(i);},out _);return ok?result:"false";
        }
        string RestoreCore(int i)
        {
            if (i < 0 || i >= pocket.Count) return "false";
            var stack = pocket[i];
            if (stack == null) return "false";
            if (IsSha(stack.card))
            {
                pocket.RemoveAt(i);   // 「初始攻击」每局自动带 5 张，无需保存
                Save();
                return "sha";
            }
            int room = StashRoom;
            int n = stack.count > 0 ? stack.count : 1;
            int keyCost=PocketKeyCost(stack);
            if(keys<keyCost)return "nokey";
            if (room < n) return "full";
            keys-=keyCost;
            pocket.RemoveAt(i);
            DepositCards(new[] { stack });
            return "true";
        }

        /// <summary>base.js takeStashCards(name, n)：按名取出 n 张，返回实际取出数。</summary>
        public int TakeStashCards(string name, int n)
        {
            int i = stash.FindIndex(x => x.card.name == name);
            if (i < 0 || n <= 0) return 0;
            var stack = stash[i];
            int take = Math.Min(n, stack.count);
            stack.count -= take;
            if (stack.count <= 0) stash.RemoveAt(i);
            Save();
            return take;
        }

        // ---------- 仓库物品操作：卖出 / 收藏 ----------
        public sealed class SellResult
        {
            [JsonProperty("ok")] public bool ok;
            [JsonProperty("why")] public string why;     // empty / collected
            [JsonProperty("qty")] public int qty;
            [JsonProperty("coins")] public int coins;
            [JsonProperty("msg")] public string msg;
        }

        /// <summary>base.js sellStashCards(name, n)：收藏中的堆受保护。返回文案逐字照抄。</summary>
        public SellResult SellStashCards(string name, int n)
        {
            int i = stash.FindIndex(x => x.card.name == name);
            if (i < 0) return new SellResult { ok = false, why = "empty" };
            var stack = stash[i];
            if (IsProtected(stack.card)) return new SellResult { ok = false, why = "collected" };
            if(MaterialInfo(stack.card)!=null)return new SellResult{ok=false,why="material"};
            int price = CardLibrary.SellPrice(stack.card);
            int qty = Math.Min(Math.Max(1, n == 0 ? 1 : n), stack.count);
            stack.count -= qty;
            if (stack.count <= 0) stash.RemoveAt(i);
            coins += price * qty;
            Save();
            return new SellResult { ok = true, qty = qty, coins = price * qty,
                msg = $"[[icon:coin]] 卖出【<b>{name}</b>】×{qty}，+ {price * qty} 币（储备 {coins}）" };
        }

        /// <summary>base.js sellRaw(kind, all)：卖出储备资源（wood/rations），价值即币。</summary>
        public SellResult SellRaw(string kind, bool all)
        {
            var item = MapData.Items[kind == "wood" ? "wood" : "rations"];
            int have = kind == "wood" ? wood : rations;
            int qty = all ? have : Math.Min(1, have);
            if (qty <= 0) return new SellResult { ok = false, why = "empty" };
            if (kind == "wood") wood -= qty; else rations -= qty;
            coins += item.value * qty;
            Save();
            return new SellResult { ok = true, qty = qty, coins = item.value * qty,
                msg = $"[[icon:coin]] 卖出【<b>{item.name}</b>】×{qty}，+ {item.value * qty} 币（储备 {coins}）" };
        }

        /// <summary>base.js collectToggle(card)：收藏 / 取消收藏，返回切换后是否已收藏。</summary>
        public bool CollectToggle(CardDef card)
        {
            if (card == null || card.id == null) return false;
            if (collection.ContainsKey(card.id))
            {
                collection.Remove(card.id);
                Save();
                return false;
            }
            collection[card.id] = new CollectionEntry { name = card.name, rarity = card.rarity ?? "?", ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
            Save();
            return true;
        }

        public bool IsCollected(CardDef card) => card != null && card.id != null && collection.ContainsKey(card.id);

        // ---------- 储备币 ----------
        /// <summary>base.js takeReserveCoins()：出发时把储备币全部带走。</summary>
        public int TakeReserveCoins()
        {
            int c = coins;
            coins = 0;
            Save();
            return c;
        }

        // ---------- 宝藏大门 ----------
        /// <summary>base.js keyCount：仓库钥匙类卡牌计数（「一串钥匙」= 2 把，其余钥匙 = 1 把）。</summary>
        public int KeyCount => keys + stash.Sum(b =>
        {
            if (string.IsNullOrEmpty(b.card.name) || !b.card.name.Contains("钥匙")) return 0;
            int per = b.card.name.Contains("一串") ? 2 : 1;
            return per * b.count;
        });
    }
}
