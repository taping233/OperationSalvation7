using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using Sdt.Core;
using UnityEngine;

namespace Sdt.Res
{
    /// <summary>Single current card-description-text/structured-card-description presentation entry.</summary>
    public static partial class CurrentCardPresentation
    {
        [Serializable] public sealed class Revision { public string id, original, reviewed; }
        [Serializable] public sealed class Term { public string key, name, text; }
        [Serializable] public sealed class Alias { public string word, key; }
        [Serializable] public sealed class Data { public Revision[] revisions; public Term[] terms; public Alias[] aliases; public string[] words; }
        public sealed class Context { public double? Attack, SpellPower; public int? AstrolabePhase; public bool AstrolabeTriggered; }
        static readonly Dictionary<string, Revision> Revisions = new Dictionary<string, Revision>();
        static readonly Dictionary<string, Term> Terms = new Dictionary<string, Term>();
        static readonly Dictionary<string, string> Aliases = new Dictionary<string, string>();
        static string[] Words = Array.Empty<string>();
        static bool _loaded;
        public static void Configure(Data data)
        {
            Revisions.Clear(); Terms.Clear(); Aliases.Clear(); Words = data?.words ?? Array.Empty<string>();
            foreach (var item in data?.revisions ?? Array.Empty<Revision>()) Revisions[item.id] = item;
            foreach (var item in data?.terms ?? Array.Empty<Term>()) Terms[item.key] = item;
            foreach (var item in data?.aliases ?? Array.Empty<Alias>()) Aliases[item.word] = item.key;
            _loaded = true;
        }
        static void Load()
        {
            if (_loaded) return; var asset = Resources.Load<TextAsset>("Art/CurrentPhoto/descriptions");
            Configure(asset == null ? null : JsonUtility.FromJson<Data>(asset.text));
        }
        public static string Description(CardDef card, Context context = null)
        {
            if (card == null) return ""; Load(); string source = card.desc ?? "";
            if (card.id == "cc-rot-seed" && Regex.IsMatch(source, "死亡时.*中毒层数转移")) source = "对 1 名敌人附加 2 层中毒并标记。被标记的敌人死亡时，对所有敌人造成等同于其死亡时中毒层数的真实伤害。";
            source = Normalize(source); Revisions.TryGetValue(card.id ?? "", out var revision);
            string text = revision != null && source == revision.original ? revision.reviewed : source;
            if (revision != null && (source == revision.original || source == revision.reviewed)) text = Structured(card, text) ?? text;
            text = text.Replace("（不计之前战斗的消耗区或普通弃牌；仅进入墓地的牌不计）", "").Replace("本场战斗消耗牌中", "消耗牌堆中").Replace("从本场消耗牌复原", "从消耗牌堆复原").Replace("对应消耗区为空时", "对应牌区为空时").Replace("弃牌堆", "消耗牌堆").Replace("墓地", "消耗牌堆").Replace("消耗牌堆或消耗牌堆", "消耗牌堆");
            if (context != null && (context.Attack.HasValue || context.SpellPower.HasValue)) text = ApplyBattle(text, card, context);
            var alternating = card.rules?.Get("equip")?.Get("passive")?.Get("alternatingRefund");
            string[] types = alternating?.Items("types").OfType<string>().ToArray() ?? (card.id == "tt13-astrolabe" ? new[] { "武术", "法术" } : Array.Empty<string>());
            if (types.Length > 0)
            {
                int amount = alternating?.Number("amount", 1) ?? 1;
                string general = "装备后首回合为" + types[0] + "相位，之后每回合依次切换（" + string.Join("→", types) + "）。本回合首次打出相位对应的招式后，回复 " + amount + " 点能量。";
                if (context?.AstrolabePhase != null)
                { int i = Math.Abs(context.AstrolabePhase.Value) % types.Length; text = "本回合：" + types[i] + "相位，" + (context.AstrolabeTriggered ? "回能已触发" : "首次打出" + types[i] + "招式后回复 " + amount + " 点能量") + "；下回合：" + types[(i + 1) % types.Length] + "相位。" + general; }
                else text = general;
            }
            return text;
        }
        static string Normalize(string value) => (value ?? "").Replace("搜索大宝箱", "搜索军用保险柜").Replace("大、中、小宝箱", "军用保险柜、密封物资箱、小型物资箱").Replace("大，中，小宝箱", "军用保险柜、密封物资箱、小型物资箱").Replace("小宝箱", "小型物资箱").Replace("中宝箱", "密封物资箱").Replace("大宝箱", "军用保险柜").Replace("宝箱", "搜刮点").Replace("消耗口袋", "消耗区");
        static bool Only(RuleValue rule, params string[] keys) => rule != null && rule.Values.Keys.All(keys.Contains);
        static string Structured(CardDef card, string text)
        {
            if ((card.infuse ?? 0) != 0 || card.rules == null || card.rules.Number("version") != 1) return null;
            object[] operations;
            if (card.type == "道具")
            {
                if (!Only(card.rules, "version", "bag") || !Only(card.rules.Get("bag"), "use")) return null;
                operations = card.rules.Get("bag").Items("use");
                if (operations.Length != 1 || !(operations[0] is RuleValue bag) || bag.Text("op") != "heal" && bag.Text("op") != "draw") return null;
            }
            else
            {
                var target = card.rules.Get("battle")?.Get("target");
                if (!CardLibrary.DmgTypes.Contains(card.type) || !Only(card.rules, "version", "battle", "triggers") || !Only(card.rules.Get("battle"), "target") || !Only(target, "side", "area") || target.Text("side") != "self" || !(target.Value("area") is bool area) || area || !Only(card.rules.Get("triggers"), "onPlay")) return null;
                operations = card.rules.Get("triggers").Items("onPlay");
            }
            var rules = operations.OfType<RuleValue>().ToArray(); if (rules.Length != operations.Length) return null;
            string[] ops = rules.Select(r => r.Text("op")).ToArray(); string joined = string.Join(",", ops);
            foreach (string field in new[] { "dmg", "heal", "armor", "draw" }) if (!ops.Contains(field) && Field(card, field) != 0) return null;
            var amounts = new List<int>();
            foreach (var op in rules)
            {
                string key = op.Text("op"); if (key == "cleanse") { if (!Only(op, "op", "target") || op.Text("target") != "self") return null; continue; }
                int n;
                if (key == "energy" || key == "energyCap") { if (!Only(op, "op", "n")) return null; n = op.Number("n"); }
                else
                {
                    if (!Only(op, "op", "amountField", "amount")) return null;
                    if (op.Has("amountField")) { if (op.Has("amount") || op.Text("amountField") != key) return null; n = Field(card, key); }
                    else { n = op.Number("amount"); if (card.type != "道具" && Field(card, key) != 0 && Field(card, key) != n) return null; }
                }
                if (n <= 0) return null; amounts.Add(n);
            }
            string number = @"\d+(?:\.\d+)?";
            if (joined == "heal" && Regex.IsMatch(text, "^你回复 " + number + " 点生命。$")) return "你回复 " + amounts[0] + " 点生命。";
            if (joined == "draw" && Regex.IsMatch(text, "^抽 " + number + " 张牌。$")) return "抽 " + amounts[0] + " 张牌。";
            if (joined == "energy" && Regex.IsMatch(text, "^你获得 " + number + " 点能量。$")) return "你获得 " + amounts[0] + " 点能量。";
            if (joined == "energyCap" && Regex.IsMatch(text, "^本场战斗中，你的能量上限增加 " + number + " 点。$")) return "本场战斗中，你的能量上限增加 " + amounts[0] + " 点" + (card.id == "tt3-nature-form" ? "。" : "；你获得 " + amounts[0] + " 点能量。");
            if (joined == "heal,cleanse" && Regex.IsMatch(text, "^你回复 " + number + " 点生命，并净化自身。$")) return "你回复 " + amounts[0] + " 点生命，并净化自身。";
            if (joined == "heal,armor" && Regex.IsMatch(text, "^你回复 " + number + " 点生命，并获得 " + number + " 点护甲。$")) return "你回复 " + amounts[0] + " 点生命，并获得 " + amounts[1] + " 点护甲。";
            if (joined == "armor,draw" && Regex.IsMatch(text, "^你获得 " + number + " 点护甲，并抽 " + number + " 张牌。$")) return "你获得 " + amounts[0] + " 点护甲，并抽 " + amounts[1] + " 张牌。";
            return null;
        }
        static int Field(CardDef c, string field) { switch (field) { case "dmg": return c.dmg ?? 0; case "heal": return c.heal ?? 0; case "armor": return c.armor ?? 0; case "draw": return c.draw ?? 0; default: return 0; } }
        static string N(double n) => n.ToString("0.############", CultureInfo.InvariantCulture);
        static string ApplyBattle(string text, CardDef card, Context context)
        {
            double attack = context.Attack ?? 0, spell = context.SpellPower ?? 0;
            var damage = card.rules?.Get("triggers")?.Operations("onPlay").Where(op => op.Text("op") == "damage").ToArray() ?? Array.Empty<RuleValue>();
            double multiplier = damage.Length == 1 ? Convert.ToDouble(damage[0].Value("spellPowerMul") ?? 1, CultureInfo.InvariantCulture) : Regex.IsMatch(card.desc ?? "", "受(?:到的)?法伤加成翻倍") ? 2 : 1;
            spell *= multiplier;
            text = Regex.Replace(text, @"造成（你的攻击力\s*([+-])\s*(\d+)）点攻击伤害", m => "造成 " + N(Math.Max(0, attack + (m.Groups[1].Value == "-" ? -1 : 1) * int.Parse(m.Groups[2].Value))) + " 点攻击伤害");
            text = text.Replace("造成等同于你的攻击力的攻击伤害", "造成 " + N(Math.Max(0, attack)) + " 点攻击伤害");
            Func<Match, string> range = m => N(Math.Max(0, int.Parse(m.Groups[1].Value) + spell)) + (m.Groups[2].Success ? m.Groups[2].Value + N(Math.Max(0, int.Parse(m.Groups[3].Value) + spell)) : "");
            text = Regex.Replace(text, @"造成\s*(\d+)(?:\s*([-~～–—])\s*(\d+))?\s*点法术伤害", m => "造成 " + range(m) + " 点法术伤害");
            return Regex.Replace(text, @"(?<![\d′])(\d+)(?:\s*([-~～–—])\s*(\d+))?′(?!′)", m => range(m) + "′");
        }
        public static Term TermFor(string word) { Load(); return Aliases.TryGetValue(word, out var key) && Terms.TryGetValue(key, out var term) ? term : null; }
    }
}
