// ported from src/meta.js（局外成长：职业熟练度 / 成就 / 事件埋点）
using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;

namespace Sdt.Run
{
    /// <summary>成就定义（meta.js ACHIEVEMENTS，文案与奖励数值照抄）。</summary>
    public sealed class AchievementDef
    {
        [JsonProperty("id")] public string id;
        [JsonProperty("icon")] public string icon;
        [JsonProperty("name")] public string name;
        [JsonProperty("desc")] public string desc;
        [JsonProperty("reward")] public RewardInfo reward;
        [JsonProperty("back")] public string back;   // 领取后解锁的卡背 id
        [JsonIgnore] public Func<BaseStats, BaseData, bool> done;   // 依据基地统计判定
        [JsonIgnore] public bool _seen;   // checkUnlocks 播报去重
        public sealed class RewardInfo
        {
            [JsonProperty("wood")] public int? wood;
            [JsonProperty("rations")] public int? rations;
            [JsonProperty("keys")] public int? keys;
            [JsonProperty("card")] public string card;
        }
    }

    /// <summary>
    /// 进度/成就统计（meta.js）。原版函数 → C# 方法映射：
    /// xpForNext()→XpForNext / LEGACY_MERGE+mergeLegacyClasses()→(并入 ClsData 惰性迁移) /
    /// clsData()→ClsData / classLv()→ClassLv / classXP()→ClassXP / classList()→ClassList /
    /// perkText()→PerkText / addXP()→AddXP / ACHIEVEMENTS→Achievements / achById()→AchById /
    /// isUnlocked()→IsUnlocked / isClaimed()→IsClaimed / pendingAch()→PendingAch / claim()→Claim /
    /// checkUnlocks()→CheckUnlocks / syncBackUnlocks()→SyncBackUnlocks / track()→Track / setXpMul()→SetXpMul /
    /// classSummary()→ClassSummary。
    /// </summary>
    public sealed partial class MetaProgress
    {
        public const int LevelMax = 10;   // LEVEL_MAX
        const string LegacyMergeNew = "侠客";
        static readonly string[] LegacyMergeOlds = { "刺客", "剑客", "游侠" };   // LEGACY_MERGE

        readonly GameRuntime _rt;
        BaseData B => _rt.Base;
        internal MetaProgress(GameRuntime rt) { _rt = rt; }
        readonly Dictionary<int,HashSet<string>> _seenBySlot=new Dictionary<int,HashSet<string>>();
        HashSet<string> Seen(){int key=B.Slot??0;if(!_seenBySlot.TryGetValue(key,out var seen))_seenBySlot[key]=seen=new HashSet<string>();return seen;}
        internal bool[] CaptureNoticeState()=>_achievements.Select(a=>Seen().Contains(a.id)).ToArray();
        internal void RestoreNoticeState(bool[] values){var seen=Seen();seen.Clear();for(int i=0;i<values.Length&&i<_achievements.Count;i++)if(values[i])seen.Add(_achievements[i].id);}

        /// <summary>xpForNext(lv)：升到 lv+1 所需经验。</summary>
        public static int XpForNext(int lv) => 50 + (Math.Max(1, lv) - 1) * 40;

        /// <summary>
        /// meta.js clsData：读职业数据。含 2026-09-05 职业整合定版的惰性迁移——
        /// 旧职业熟练度并入新职业（战士/牧师/法师/降临者同名沿用；侠客取刺客/剑客/游侠最高一份），旧条目保留不清除。
        /// </summary>
        ClassProgress ClsData(string cls)
        {
            var mChars = B.characters.ToDictionary(kv => kv.Key, kv => new CharacterTable.CharProgress { lv = kv.Value.lv, xp = kv.Value.xp });
            var mOlds = B.classes.ToDictionary(kv => kv.Key, kv => new CharacterTable.CharProgress { lv = kv.Value.lv, xp = kv.Value.xp });
            var migrated = CharacterTable.MigrateCharacterProgress(mChars, mOlds);
            B.characters = migrated.ToDictionary(kv => kv.Key, kv => new ClassProgress { lv = kv.Value.lv, xp = kv.Value.xp });
            var base_ = B;
            var character = CharacterTable.CharacterFor(cls);
            if (character != null)
            {
                base_.characters.TryGetValue(character.id, out var d);
                return d;
            }
            var dict = base_.classes;
            // mergeLegacyClasses（惰性执行一次）
            if (!dict.TryGetValue(LegacyMergeNew, out var _) && LegacyMergeOlds.Any(o => dict.ContainsKey(o)))
            {
                var olds = LegacyMergeOlds.Where(o => dict.ContainsKey(o)).Select(o => dict[o]).ToList();
                if (olds.Count > 0)
                {
                    var best = olds.OrderByDescending(c => c.lv * 100000 + c.xp).First();
                    dict[LegacyMergeNew] = new ClassProgress { lv = Math.Max(1, best.lv), xp = best.xp };
                    B.Save();
                }
            }
            if (!dict.TryGetValue(cls, out var d2))
            {
                d2 = new ClassProgress { lv = 1, xp = 0 };
                dict[cls] = d2;
            }
            return d2;
        }

        public int ClassLv(string cls) => ClsData(cls).lv;
        public int ClassXP(string cls) => ClsData(cls).xp;

        /// <summary>meta.js classList：职业清单来自卡牌库职业表。</summary>
        public List<string> ClassList() => CardLibrary.Classes.ToList();

        /// <summary>meta.js perkText：职业加成文本（出征时生效）。</summary>
        public static string PerkText(int lv) => $"生命上限 +{Math.Max(0, lv - 1)}";

        /// <summary>meta.js addXP(cls, amount)：加经验并升级；升级发 LevelUp 事件（文案照抄）。</summary>
        public int AddXP(string cls, int amount)
        {
            if(string.IsNullOrEmpty(cls)||amount<=0)return 0;int ups=0;return _rt.TryPersistMutation(()=>ups=AddXpCore(cls,amount),out _)?ups:0;
        }
        int AddXpCore(string cls,int amount)
        {
            if (string.IsNullOrEmpty(cls) || amount <= 0) return 0;
            var d = ClsData(cls);
            if (d.lv >= LevelMax) return 0;
            d.xp += amount;
            int ups = 0;
            while (d.lv < LevelMax && d.xp >= XpForNext(d.lv))
            {
                d.xp -= XpForNext(d.lv);
                d.lv++;
                ups++;
                B.Save();
                _rt.Bus.Emit(new LevelUp { CharacterName = CharacterTable.CharacterName(cls), Level = d.lv, PerkText = PerkText(d.lv) });
            }
            B.Save();
            return ups;
        }

        // ---------- 成就定义（文案/奖励照抄 meta.js） ----------
        static AchievementDef Def(string id, string icon, string name, string desc, int? wood, int? rations, string back, Func<BaseStats, BaseData, bool> done)
            => new AchievementDef { id = id, icon = icon, name = name, desc = desc, back = back, done = done, reward = new AchievementDef.RewardInfo { wood = wood, rations = rations } };

        static readonly List<AchievementDef> _achievements = LoadAchievements();

        public static IReadOnlyList<AchievementDef> Achievements => _achievements;

        public static AchievementDef AchById(string id) => _achievements.FirstOrDefault(a => a.id == id);

        /// <summary>meta.js isUnlocked(a, data)。</summary>
        public static bool IsUnlocked(AchievementDef a, BaseData data)
        {
            var d = data ?? throw new ArgumentNullException(nameof(data));
            try { return a.done(d.stats, d); } catch { return false; }
        }

        public bool IsClaimed(string id) => B.achClaimed.TryGetValue(id, out var v) && v;
        public List<AchievementDef> PendingAch() => _achievements.Where(a => IsUnlocked(a, B) && !IsClaimed(a.id)).ToList();

        public sealed class ClaimResult { public bool ok; public string msg; }

        /// <summary>meta.js claim(id)：领取奖励（文案照抄）。</summary>
        public ClaimResult Claim(string id)
        {
            var a = AchById(id);
            if (a == null || !IsUnlocked(a, B) || IsClaimed(id)) return new ClaimResult { ok = false };
            if(!_rt.TryPersistMutation(()=>{
                if(IsClaimed(id)||!IsUnlocked(a,B))throw new InvalidOperationException("成就领取状态已变化");
                var card=a.reward.card==null?null:CardLibrary.FindById(a.reward.card);
                if(a.reward.card!=null&&(card==null||B.StashRoom<1))throw new InvalidOperationException("奖励卡牌暂不可用或仓库已满，领取资格已保留");
                B.achClaimed[id]=true;B.wood+=a.reward.wood??0;B.rations+=a.reward.rations??0;B.keys+=a.reward.keys??0;
                if(card!=null)B.AppendRewardCards(new[]{card});if(a.back!=null)B.UnlockBack(a.back);B.Save();
            },out var reason))return new ClaimResult{ok=false,msg=reason};
            var parts = new List<string>();
            if ((a.reward.wood ?? 0) != 0) parts.Add($"[[icon:wood]] 木材 ×{a.reward.wood}");
            if ((a.reward.rations ?? 0) != 0) parts.Add($"[[icon:bread]] 口粮 ×{a.reward.rations}");
            if((a.reward.keys??0)>0)parts.Add("钥匙 ×"+a.reward.keys);
            if(a.reward.card!=null)parts.Add("【"+(CardLibrary.FindById(a.reward.card)?.name??a.reward.card)+"】");
            if (a.back != null)
            {
                var bd = CardLibrary.CardBacks.FirstOrDefault(b => b.id == a.back);
                parts.Add($"[[icon:cards]] 卡背【{(bd != null ? bd.name : a.back)}】");
            }
            var msg = $"[[icon:trophy]] 领取成就奖励【{a.name}】：{string.Join(" · ", parts)}";
            _rt.Bus.Emit(new LogRequested { Text = msg, Tone = "loot" });
            return new ClaimResult { ok = true, msg = msg };
        }

        /// <summary>meta.js syncBackUnlocks：已领取的带卡背成就补发卡背。</summary>
        public void SyncBackUnlocks()
        {
            foreach (var a in _achievements)
                if (a.back != null && IsClaimed(a.id)) B.UnlockBack(a.back);
        }

        /// <summary>meta.js checkUnlocks：返回本次新解锁的成就（只播报一次，发 AchievementUnlocked 事件，文案照抄）。</summary>
        public List<AchievementDef> CheckUnlocks()
        {
            SyncBackUnlocks();
            var seen=Seen();var fresh = _achievements.Where(a => IsUnlocked(a, B) && !IsClaimed(a.id) && !seen.Contains(a.id)).ToList();
            foreach (var a in fresh) seen.Add(a.id);
            foreach (var a in fresh)
                _rt.Bus.Emit(new AchievementUnlocked { Id = a.id, Name = a.name, Desc = a.desc });
            return fresh;
        }

        // ---------- 事件埋点（经验计入本局所选职业 d.cls） ----------
        public sealed class TrackData
        {
            public bool boss; public string name; public string cls;
            public int? coins; public int? actions; public int? count;
            public int? n;
        }

        /// <summary>meta.js track(type, d)：type = kill / extract / death / action / stash。</summary>
        public void Track(string type, TrackData d = null)
        {
            if(!new[]{"kill","extract","death","action","stash","turnMoves","battleEquips","reviveKill"}.Contains(type))return;
            _rt.TryPersistMutation(()=>TrackCore(type,d),out _);
        }
        void TrackCore(string type,TrackData d)
        {
            d ??= new TrackData();
            var s = B.stats;
            bool changed = true;
            switch (type)
            {
                case "turnMoves":s.turnMovesMax=Math.Max(s.turnMovesMax,d.n??0);break;
                case "battleEquips":s.battleEquipsMax=Math.Max(s.battleEquipsMax,d.n??0);break;
                case "reviveKill":s.reviveKills++;break;
                case "kill":
                    if (d.boss)
                    {
                        if (!s.bossKills.Contains(d.name)) s.bossKills.Add(d.name);
                        s.kills++;
                        AddXP(d.cls, (int)Math.Floor(40 * _xpMul+.5));
                    }
                    else
                    {
                        s.kills++;
                        AddXP(d.cls, (int)Math.Floor(6 * _xpMul+.5));
                    }
                    break;
                case "extract":
                    s.extracts++;
                    s.bestRunCoins = Math.Max(s.bestRunCoins, d.coins ?? 0);
                    AddXP(d.cls, (int)Math.Floor((20 + (d.actions ?? 0) * 2) * _xpMul+.5));
                    break;
                case "death":
                    s.deaths++;
                    AddXP(d.cls, 5);
                    break;
                case "action":
                    s.actions++;
                    break;
                case "stash":
                    s.stashTotal += d.count ?? 0;
                    break;
                default:
                    changed = false;
                    break;
            }
            if (changed) B.Save();
            CheckUnlocks();
        }

        double _xpMul = 1;
        /// <summary>meta.js setXpMul：经验倍率随本局玩法模式（开局时设置）。</summary>
        public void SetXpMul(double m) { _xpMul = m > 0 ? m : 1; }

        /// <summary>meta.js classSummary：职业页汇总（基地 UI 用）。</summary>
        public sealed class ClassSummaryRow
        {
            public string cls; public int lv, xp, need, pool; public bool maxed;
        }
        public List<ClassSummaryRow> ClassSummary()
        {
            return ClassList().Select(cls =>
            {
                int lv = ClassLv(cls), xp = ClassXP(cls);
                int pool = 0;
                try { pool = CardLibrary.ClassPool(cls).Count; } catch { }
                return new ClassSummaryRow { cls = cls, lv = lv, xp = xp, need = XpForNext(lv), maxed = lv >= LevelMax, pool = pool };
            }).ToList();
        }
    }
}
