// ported from src/narrative.js
using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Narrative
{
    /// <summary>
    /// 事件选项：label 为剥离 @@ 元数据后的按钮文案，Meta 为 @@key=value 全集，
    /// Effect/Detail/Tone 对应 parseChoice 的三个常用键（缺失为空串）。
    /// </summary>
    public sealed class EventChoice
    {
        public string Label = "";
        public string RawText = "";
        public int ChoiceIndex;
        public IReadOnlyDictionary<string, string> Meta = new Dictionary<string, string>();
        public string Effect = "";
        public string Detail = "";
        public string Tone = "";
    }

    /// <summary>
    /// 一次事件呈现：Paragraphs 为剧情段落（对应 inkjs ContinueMaximally 的非空行），
    /// Choices 为当前可选项。选择后由 NarrativeService.Choose 推进返回新的 EventNarrative。
    /// </summary>
    public sealed class EventNarrative
    {
        public List<string> Paragraphs = new List<string>();
        public List<EventChoice> Choices = new List<EventChoice>();
        internal Ink.Runtime.Story Story; // 携带运行态供 Choose 推进（对应原版 choose() 闭包）
    }

    /// <summary>
    /// cardId → ink knot 映射与推进，语义对齐 narrative.js 的 KNOTS/eventNarrative。
    /// </summary>
    public sealed class NarrativeService
    {
        // 照抄 narrative.js KNOTS 表
        private static readonly IReadOnlyDictionary<string, string> Knots = new Dictionary<string, string>
        {
            { "tt6-timeskip", "tt6_timeskip" },
            { "tt6-demondeal", "tt6_demondeal" },
            { "tt6-bandits", "tt6_bandits" },
            { "tt6-goldmine", "tt6_goldmine" },
            { "tt6-mystery", "tt6_mystery" },
            { "tt6-goldhammer", "tt6_goldhammer" },
            { "tt6-relief", "tt6_relief" },
            { "tt6-airdrop", "tt6_airdrop" },
            { "tt6-chestdraw", "tt6_chestdraw" },
            { "tt6-systemsupply", "tt6_systemsupply" },
        };

        private readonly string _inkJson;

        public NarrativeService(string inkJson)
        {
            _inkJson = inkJson ?? throw new ArgumentNullException(nameof(inkJson));
        }

        public bool HasEvent(string cardId)
        {
            return cardId != null && Knots.ContainsKey(cardId);
        }

        /// <summary>未知 cardId 返回 null（对齐 eventNarrative）。</summary>
        public EventNarrative OpenEvent(string cardId)
        {
            if (!HasEvent(cardId)) return null;
            var story = new Ink.Runtime.Story(_inkJson);
            story.ChoosePathString(Knots[cardId]);
            return Build(story);
        }

        public EventNarrative OpenLastLamp(int segment)
        {
            if (segment < 1 || segment > 3) return null;
            var story = new Ink.Runtime.Story(_inkJson);
            story.ChoosePathString("r6_last_lamp_" + segment);
            return Build(story);
        }

        /// <summary>
        /// 推进：对应 inkjs choose() 的 ChooseChoiceIndex(index) + ContinueMaximally()。
        /// current 必须来自本服务且未被消费；choiceIndex 越界抛 ArgumentOutOfRangeException。
        /// </summary>
        public EventNarrative Choose(EventNarrative current, int choiceIndex)
        {
            if (current == null) throw new ArgumentNullException(nameof(current));
            if (choiceIndex < 0 || choiceIndex >= current.Choices.Count)
                throw new ArgumentOutOfRangeException(nameof(choiceIndex));
            var story = current.Story ?? throw new ArgumentException("EventNarrative 已终结或来自其他来源。", nameof(current));
            current.Story = null; // 一次性消费，防止重复选择
            story.ChooseChoiceIndex(choiceIndex);
            return Build(story);
        }

        private static EventNarrative Build(Ink.Runtime.Story story)
        {
            var result = new EventNarrative { Story = story };
            while (story.canContinue)
            {
                var line = story.Continue();
                if (!string.IsNullOrWhiteSpace(line)) result.Paragraphs.Add(line.Trim());
            }
            result.Choices = story.currentChoices
                .Select(c => ParseChoice(c.text, c.index))
                .ToList();
            return result;
        }

        /// <summary>照抄 parseChoice：以 @@ 分隔，key=value（无 = 则值为空串），effect/detail/tone 提升为常用字段。</summary>
        private static EventChoice ParseChoice(string text, int index)
        {
            var parts = (text ?? "").Split(new[] { "@@" }, StringSplitOptions.None);
            var meta = new Dictionary<string, string>();
            foreach (var part in parts.Skip(1))
            {
                var at = part.IndexOf('=');
                var key = at < 0 ? part.Trim() : part.Substring(0, at).Trim();
                var val = at < 0 ? "" : part.Substring(at + 1).Trim();
                meta[key] = val;
            }
            return new EventChoice
            {
                Label = parts[0].Trim(),
                RawText = text ?? "",
                ChoiceIndex = index,
                Meta = meta,
                Effect = meta.TryGetValue("effect", out var e) ? e : "",
                Detail = meta.TryGetValue("detail", out var d) ? d : "",
                Tone = meta.TryGetValue("tone", out var t) ? t : "",
            };
        }
    }
}
