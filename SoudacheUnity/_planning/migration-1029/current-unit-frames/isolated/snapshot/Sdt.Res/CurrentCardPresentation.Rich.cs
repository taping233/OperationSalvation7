using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Sdt.Core;

namespace Sdt.Res
{
    public static partial class CurrentCardPresentation
    {
        public sealed class Link { public int Start, Length; public string CardId, TermKey; }
        public sealed class Document { public string Plain, Rich; public readonly List<Link> Links = new List<Link>(); }
        static readonly HashSet<string> Ordinary = new HashSet<string> { "攻击", "伤害", "护甲", "生命", "能量", "法伤", "回合", "装备", "牌库", "弃牌", "抽牌" };
        /// <summary>Shared final copy, source card-name ambiguity rules, terms and numeric spans.</summary>
        public static Document RichDescription(CardDef card, IReadOnlyList<CardDef> catalog = null, Context context = null, bool dossier = false)
        {
            string text = Description(card, context);
            int damage = card?.dmg ?? 0; bool showDamage = card != null && CardLibrary.DmgTypes.Contains(card.type) && (damage > 0 || damage < 0 && card.dmgType == "attack");
            if (dossier && showDamage)
            {
                var leading = Regex.Match(text, @"^([+-]?\d+(?:\.\d+)?)[ \t]*[′'][ \t]*[，,；;]?[ \t]*");
                if (leading.Success && double.Parse(leading.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) == damage) text = text.Substring(leading.Length);
                var full = Regex.Match(text, @"^造成\s*(\d+)\s*点(?:法术|固定|真实)伤害[。；，]?\s*");
                if (full.Success && int.Parse(full.Groups[1].Value) == damage) text = text.Substring(full.Length);
            }
            var result = new Document { Plain = text }; var output = new StringBuilder();
            var names = (catalog ?? Array.Empty<CardDef>()).Where(c => !string.IsNullOrEmpty(c.id) && !string.IsNullOrEmpty(c.name)).GroupBy(c => c.id).Select(g => g.First()).GroupBy(c => c.name).ToDictionary(g => g.Key, g => g.ToArray());
            string pattern = string.Join("|", names.Keys.OrderByDescending(n => n.Length).Select(Regex.Escape));
            int offset = 0;
            if (pattern.Length > 0) foreach (Match match in Regex.Matches(text, pattern))
            {
                string name = match.Value; var candidates = names[name]; int end = match.Index + match.Length;
                bool quoted = match.Index > 0 && end < text.Length && "'“‘「【《".Contains(text[match.Index - 1]) && "'”’」】》".Contains(text[end]);
                if (candidates.Length != 1 || candidates[0].id == card.id || !quoted && (name.Length < 2 || TermFor(name) != null || Ordinary.Contains(name))) continue;
                Fragment(output, text.Substring(offset, match.Index - offset), offset, result);
                output.Append("<color=#71508e>").Append(name).Append("</color>"); result.Links.Add(new Link { Start = match.Index, Length = match.Length, CardId = candidates[0].id }); offset = end;
            }
            Fragment(output, text.Substring(offset), offset, result); result.Rich = output.ToString(); return result;
        }
        static void Fragment(StringBuilder output, string value, int start, Document result)
        {
            string pattern = "(" + string.Join("|", Words.Select(Regex.Escape)) + @")|([⁺⁻+-]?[0-9]+(?:\.[0-9]+)?)";
            int offset = 0;
            foreach (Match match in Regex.Matches(value, pattern))
            {
                output.Append(value.Substring(offset, match.Index - offset));
                if (match.Groups[2].Success) output.Append("<color=#934529><b>").Append(match.Value).Append("</b></color>");
                else
                {
                    output.Append(match.Value); var term = TermFor(match.Value);
                    if (term != null) result.Links.Add(new Link { Start = start + match.Index, Length = match.Length, TermKey = term.key });
                }
                offset = match.Index + match.Length;
            }
            output.Append(value.Substring(offset));
        }
        public static Term TermByKey(string key) { Load(); return Terms.TryGetValue(key, out var term) ? term : null; }
    }
}
