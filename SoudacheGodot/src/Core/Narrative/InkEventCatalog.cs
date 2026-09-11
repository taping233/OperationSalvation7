using System.Collections.Generic;
using System.Linq;
using Ink.Runtime;

namespace Soudache;

// ported from 搜打撤/game/src/narrative.js eventNarrative + KNOTS（Godot 批次 4a）。
// 与网页版同语义：每个事件打开时新建 Story 实例（状态独立），ChoosePathString(knot)
// 后 ContinueMaximally() 取开场叙事，currentChoices 经 parseChoice 产出「选项文本+效果元数据」。
// KNOTS：卡牌 id（连字符）→ ink 结点名（下划线），与网页版逐条一致。
public sealed class InkEventCatalog
{
    public static IReadOnlyDictionary<string, string> Knots { get; } = new Dictionary<string, string>
    {
        ["tt6-timeskip"] = "tt6_timeskip",
        ["tt6-demondeal"] = "tt6_demondeal",
        ["tt6-bandits"] = "tt6_bandits",
        ["tt6-goldmine"] = "tt6_goldmine",
        ["tt6-mystery"] = "tt6_mystery",
        ["tt6-goldhammer"] = "tt6_goldhammer",
        ["tt6-relief"] = "tt6_relief",
        ["tt6-airdrop"] = "tt6_airdrop",
        ["tt6-chestdraw"] = "tt6_chestdraw",
        ["tt6-systemsupply"] = "tt6_systemsupply",
    };

    private readonly string _storyJson;

    public InkEventCatalog(string storyJson)
    {
        _storyJson = storyJson;
    }

    // 网页版：KNOTS 无此 cardId 时返回 null（legacy 事件走卡面 desc 的兜底路径）。
    public InkEventSession? OpenEvent(string cardId)
    {
        if (!Knots.TryGetValue(cardId, out var knot)) return null;
        var story = new Story(_storyJson);
        story.ChoosePathString(knot);
        var intro = story.ContinueMaximally().Trim();
        var choices = story.currentChoices
            .Select(choice => ChoiceMetadataParser.Parse(choice.text))
            .ToArray();
        return new InkEventSession(story, intro, choices);
    }
}

// 对应网页版 eventNarrative 返回值 { intro, choices[{ label, effect, detail, tone, choose }] }；
// choose() 闭包语义在 C# 侧表达为 session.Choose(index)。
public sealed class InkEventSession
{
    private readonly Story _story;

    public string Intro { get; }
    public IReadOnlyList<NarrativeChoice> Choices { get; }

    internal InkEventSession(Story story, string intro, NarrativeChoice[] choices)
    {
        _story = story;
        Intro = intro;
        Choices = choices;
    }

    public string Choose(int index)
    {
        _story.ChooseChoiceIndex(index);
        return _story.ContinueMaximally().Trim();
    }
}
