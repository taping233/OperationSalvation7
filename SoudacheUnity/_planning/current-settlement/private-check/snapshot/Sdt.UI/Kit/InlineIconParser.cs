using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Sdt.Res;

namespace Sdt.UI.Kit
{
    public sealed class InlineIconRun
    {
        public string key;
        public string color;
        public int characterIndex, characterCount, size;
    }
    public sealed class InlineIconDocument
    {
        public string text;
        public List<InlineIconRun> icons = new List<InlineIconRun>();
    }
    public static class InlineIconParser
    {
        static readonly Regex Token = new Regex(@"\G\[\[icon:([a-z0-9-]+)\]\]", RegexOptions.Compiled);
        static readonly Regex RichTag = new Regex(@"\G</?(b|i|size|color|material|quad)(?:[= ][^>]*)?>", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        static readonly Dictionary<string, string> LegacyIconAliases = new Dictionary<string, string>
        {
            { "\u279C", "arrow" }, { "\u21BB", "recycle" }, { "\u2611", "check" }
        };
        public static InlineIconDocument Parse(string source, int fontSize, bool richText, Func<int, int> advanceCount = null)
        {
            source = source ?? "";
            var result = new InlineIconDocument(); var text = new StringBuilder();
            var sizes = new Stack<int>(); var colors = new Stack<string>();
            for (int index = 0; index < source.Length;)
            {
                if (richText && source[index] == '<')
                {
                    var tag = RichTag.Match(source, index);
                    if (tag.Success)
                    {
                        if (tag.Groups[1].Value.Equals("size", StringComparison.OrdinalIgnoreCase))
                        {
                            if (tag.Value.StartsWith("</", StringComparison.Ordinal)) { if (sizes.Count > 0) sizes.Pop(); }
                            else
                            {
                                var value = tag.Value.Substring(tag.Value.IndexOf('=') + 1).TrimEnd('>').Trim(' ', '\'', '"');
                                if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var size)) sizes.Push(size);
                            }
                        }
                        if (tag.Groups[1].Value.Equals("color", StringComparison.OrdinalIgnoreCase))
                        {
                            if (tag.Value.StartsWith("</", StringComparison.Ordinal)) { if (colors.Count > 0) colors.Pop(); }
                            else colors.Push(tag.Value.Substring(tag.Value.IndexOf('=') + 1).TrimEnd('>').Trim(' ', '\'', '"'));
                        }
                        text.Append(tag.Value); index += tag.Length; continue;
                    }
                }
                string key = null; int length = 1;
                if (source[index] == '[')
                {
                    var token = Token.Match(source, index);
                    if (token.Success) { key = token.Groups[1].Value; length = token.Length; }
                }
                if (key == null)
                {
                    length = char.IsSurrogatePair(source, index) ? 2 : 1;
                    string symbol = source.Substring(index, length);
                    if (symbol == "\u2610")
                    {
                        // The shipped fonts have this empty square; keep unchecked distinct from a cross.
                        text.Append('\u25A1');
                        index += length;
                        if (index < source.Length && source[index] == '\uFE0F') index++;
                        continue;
                    }
                    if (CurrentUiIcons.Emoji.TryGetValue(symbol, out var mapped) || LegacyIconAliases.TryGetValue(symbol, out mapped)) key = mapped;
                    else if (length == 2 && source[index] >= '\uD83C') key = "question";
                    if (key != null && index + length < source.Length)
                    {
                        if (source[index + length] == '\uFE0F') length++;
                        else if (source[index + length] == '\u200D' && index + length + 1 < source.Length) { length += 2; key = "question"; }
                    }
                }
                if (key != null)
                {
                    if (!CurrentUiIcons.Paths.ContainsKey(key)) key = "question";
                    int effectiveSize = Math.Max(1, sizes.Count > 0 ? sizes.Peek() : fontSize);
                    int size = (int)Math.Ceiling(effectiveSize * 1.1);
                    int count = Math.Max(1, advanceCount?.Invoke(effectiveSize) ?? 1);
                    // Native TextGenerator.characters includes zero-width entries for rich-text markup.
                    result.icons.Add(new InlineIconRun { key = key, characterIndex = text.Length, characterCount = count, size = size, color = colors.Count > 0 ? colors.Peek() : null });
                    // NBSP exists in every shipped font; repeated advance is measured from that actual font.
                    text.Append('\u00A0', count);
                    index += length; continue;
                }
                text.Append(source, index, length); index += length;
            }
            result.text = text.ToString();
            return result;
        }
    }
}
