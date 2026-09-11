using System.Text.Json;
using Ink.Runtime;
using Soudache;

// Ink.Runtime 也有一个 Path 类型，与 System.IO.Path 冲突，此处显式别名。
using IoPath = System.IO.Path;

// Godot 批次 4a ink spike 测试（模式照 tests/Combat）：
// 行为规格 = 网页版 vitest：搜打撤/tests/narrative.test.js + narrative-coverage.test.js。
// 口径：
// ① parseChoice 语义（隐藏 @@key=value@@ 元数据，不泄漏进 label）；
// ② 10 个事件结点的 intro / 选项数 / label+effect+detail+tone 与网页版实跑值逐项一致
//    （预期值由 tools/ink/ 用与网页版同源的 inkjs 2.4.0 从 events.ink 提取）；
// ③ 选项推进（choose → 后果文本）；
// ④ 未知 cardId 走 null 兜底；
// ⑤ 全分支 BFS 走查：无死路、深度收敛（无循环分支）、每结点至少一条可达终点路径。
internal static class NarrativeTests
{
    private const int MaxDepth = 8; // 与 narrative-coverage.test.js 一致

    private static int _checks;
    private static string _storyJson = null!;
    private static InkEventCatalog _catalog = null!;

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        _checks++;
    }

    public static int Main()
    {
        _storyJson = LoadStoryJson();
        _catalog = new InkEventCatalog(_storyJson);
        StoryJsonIsInkVersion21();
        ParseChoiceMetadata();
        KnotTableMatchesWebSource();
        AllTenEventsMatchWebSource();
        ChoiceAdvancesSelectedBranch();
        UnknownCardFallsBackToNull();
        WalkAllBranches();
        Console.WriteLine($"NARRATIVE_TESTS_OK checks={_checks}");
        return 0;
    }

    // 兼容三种工作目录：仓库根（SoudacheGodot/data/...）、SoudacheGodot 根（data/...）、测试 bin 目录（上溯 5 层到 SoudacheGodot）。
    private static string LoadStoryJson()
    {
        foreach (var path in new[]
        {
            IoPath.Combine("SoudacheGodot", "data", "narrative-events.ink.json"),
            IoPath.Combine("data", "narrative-events.ink.json"),
            IoPath.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "data", "narrative-events.ink.json"),
        })
        {
            if (File.Exists(path)) return File.ReadAllText(path);
        }
        throw new InvalidOperationException("data/narrative-events.ink.json not found (run tools/ink/compile-narrative.mjs first)");
    }

    private static void StoryJsonIsInkVersion21()
    {
        using var doc = JsonDocument.Parse(_storyJson);
        Check(doc.RootElement.TryGetProperty("inkVersion", out var version), "story json has inkVersion");
        // inkjs 2.4.0（与网页版编译器同源同版本）产出 v21。
        Check(version.GetInt32() == 21, $"inkVersion should be 21, got {version.GetInt32()}");
    }

    // 规格来源：narrative.test.js「parses hidden choice metadata without leaking it into the label」。
    private static void ParseChoiceMetadata()
    {
        var parsed = ChoiceMetadataParser.Parse("冒险挖深@@effect=deep@@detail=高风险@@tone=danger");
        Check(parsed == new NarrativeChoice("冒险挖深", "deep", "高风险", "danger"), "parseChoice reference case");

        var bare = ChoiceMetadataParser.Parse("应 战");
        Check(bare == new NarrativeChoice("应 战", "", "", ""), "parseChoice without metadata");

        var empty = ChoiceMetadataParser.Parse("");
        Check(empty == new NarrativeChoice("", "", "", ""), "parseChoice empty string");
        Check(ChoiceMetadataParser.Parse(null) == empty, "parseChoice null treated as empty");

        // 无 '=' 的段 = 空值键；重复键后者覆盖（JS Object.fromEntries 语义）。
        var odd = ChoiceMetadataParser.Parse("选项@@flagged@@tone=ok@@tone=danger");
        Check(odd == new NarrativeChoice("选项", "", "", "danger"), "parseChoice bare key and last-wins duplicate");

        // value 里允许出现 '='（indexOf 只切第一个）。
        var eq = ChoiceMetadataParser.Parse("选@@detail=a=b=c");
        Check(eq.Detail == "a=b=c", "parseChoice value keeps '='");
    }

    private static void KnotTableMatchesWebSource()
    {
        Check(InkEventCatalog.Knots.Count == 10, "KNOTS covers 10 events");
        foreach (var (cardId, knot) in InkEventCatalog.Knots)
            Check(cardId.StartsWith("tt6-") && knot == cardId.Replace('-', '_'), $"knot naming convention: {cardId} -> {knot}");
    }

    // 预期值 = 网页版同源编译器（inkjs 2.4.0）+ 同一 events.ink 的实跑结果
    //（tools/ink/expected-events.tmp.json，与 narrative.js eventNarrative 同逻辑提取）。
    private static readonly (string CardId, string Intro, (string Label, string Effect, string Detail, string Tone)[] Choices)[] Expected =
    {
        ("tt6-timeskip",
            "体育馆地板的裂缝里渗出冷青色的光，尘埃绕开它落下，仿佛那里不属于这间屋子。",
            new[] { ("踏入裂隙", "timeskip_move", "向前 6 格，落点照常结算", "ok") }),
        ("tt6-demondeal",
            "维修隧道的尽头亮着一盏不该存在的灯。交易台后的影子看不清脸，只把一只手掌摊在你面前，掌心朝上。",
            new[] { ("以血换物", "demondeal_trade", "-1 血，获得一件传说物品", "danger") }),
        ("tt6-bandits",
            "暴雨把走廊浇成了铁灰色。五道剪影从课桌残骸后站起，撬棍在积水里拖出一串火星。",
            new[] { ("应 战", "bandits_fight", "反抗组织拾荒者 ×5，战胜后密封物资箱 ×2", "") }),
        ("tt6-goldmine",
            "塌陷的矿井里仍有金属反光，但支撑梁正在呻吟。",
            new[] { ("收下 3 币", "goldmine_safe", "稳定收益", "ok"), ("冒险挖深", "goldmine_deep", "+6 币，但损失 3 血", "danger") }),
        ("tt6-mystery",
            "半塌的实验准备室里，应急补给柜竟还亮着待机灯。柜门封条早已失效，屏幕只剩一行提示：请取用。",
            new[] { ("翻找补给柜", "mystery_supply", "员工通行证A + 2 币", "") }),
        ("tt6-goldhammer",
            "校工机房里，一把动力锤还挂在充电架上，电量意外地满。锤头的警示贴纸卷了边，像在招手。",
            new[] { ("抡起动力锤", "goldhammer_strike", "先造成 5 点伤害，一击制敌再 +2 币", "") }),
        ("tt6-relief",
            "校医室的门歪斜着，屋内的救济台却被整理过：绷带、温水，还有一张手写的「愿你好运」。",
            new[] { ("接受处理", "relief_heal", "回复 6 血", "ok") }),
        ("tt6-airdrop",
            "空投箱的隔层只能保住一类物资，其余部分已经污染。",
            new[] { ("木材 ×1", "airdrop_wood", "扩建与仓储路线", ""), ("口粮 ×1", "airdrop_rations", "为安全格与续航准备", ""), ("应急处理", "airdrop_heal", "回复 3 血", "ok") }),
        ("tt6-chestdraw",
            "两只物资箱共用一枚即将熔断的解锁芯片，你只能选择一个。",
            new[] { ("撬开小型物资箱", "chest_small", "低风险：1 张卡 + 1~2 币", ""), ("赌一把密封物资箱", "chest_medium", "高回报：三选一 + 2~3 币", "ok") }),
        ("tt6-systemsupply",
            "废弃控制室的补给终端还剩最后一点电量，配送无人机挂在充电架上，货舱里躺着最后的库存。",
            new[] { ("对接终端", "systemsupply_restock", "员工通行证A + 木材 ×1", "") }),
    };

    // 规格来源：narrative.test.js「covers every tt6 event with an ink knot whose choices all carry effects」
    // + 网页版实跑期望值逐项比对。
    private static void AllTenEventsMatchWebSource()
    {
        Check(Expected.Length == 10, "expected table covers 10 events");
        foreach (var (cardId, intro, choices) in Expected)
        {
            var session = _catalog.OpenEvent(cardId);
            Check(session != null, $"{cardId} 应有 ink 剧情潜文本");
            Check(session!.Intro.Length > 0, $"{cardId} 开场叙事不应为空");
            Check(session.Intro == intro, $"{cardId} intro 与网页版一致");
            Check(session.Choices.Count == choices.Length, $"{cardId} 选项数 {session.Choices.Count} == {choices.Length}");
            Check(session.Choices.Count > 0, $"{cardId} 至少有一个选项");
            for (var i = 0; i < choices.Length; i++)
            {
                var c = session.Choices[i];
                Check(c.Label == choices[i].Label && c.Effect == choices[i].Effect
                    && c.Detail == choices[i].Detail && c.Tone == choices[i].Tone,
                    $"{cardId} 选项[{i}] ({c.Label}|{c.Effect}|{c.Detail}|{c.Tone}) != ({choices[i].Label}|{choices[i].Effect}|{choices[i].Detail}|{choices[i].Tone})");
                Check(c.Effect.Length > 0, $"{cardId} 选项「{c.Label}」应绑定效果端口");
                Check(!c.Label.Contains("@@"), $"{cardId} 选项「{c.Label}」不应泄漏隐藏标记");
            }
        }
    }

    // 规格来源：narrative.test.js「loads a branching event and advances the selected branch」。
    private static void ChoiceAdvancesSelectedBranch()
    {
        var session = _catalog.OpenEvent("tt6-goldmine")!;
        Check(session.Intro.Contains("矿井"), "goldmine intro contains 矿井");
        Check(session.Choices.Select(c => c.Label).SequenceEqual(new[] { "收下 3 币", "冒险挖深" }), "goldmine choice labels");
        Check(session.Choose(1).Contains("富矿"), "goldmine branch 2 outcome contains 富矿");

        // 每个结点每条选项都能推进出非空后果文本（选项→后果端口全通）。
        // 注意：ink story 选中一个选项后 currentChoices 即清空（网页版每事件也只选一次），
        // 因此每个选项都用独立 session 验证。
        foreach (var (cardId, _, choices) in Expected)
        {
            for (var i = 0; i < choices.Length; i++)
            {
                var s = _catalog.OpenEvent(cardId)!;
                Check(s.Choose(i).Length > 0, $"{cardId} 选项[{i}] 推进后应有后果文本");
            }
        }
    }

    // 规格来源：narrative.test.js「keeps unsupported legacy events on the existing fallback path」。
    private static void UnknownCardFallsBackToNull()
    {
        Check(_catalog.OpenEvent("legacy-custom-event") == null, "unknown cardId returns null (fallback path)");
    }

    // 规格来源：narrative-coverage.test.js「ink 事件分支全量走查」——
    // 对每个事件 knot 按选择序列 BFS 展开全部路径：
    // ① 每条路径都到达终点（无死路：没有内容也没有选项）；
    // ② 路径数在深度上限内收敛（无无限循环分支）；
    // ③ 每结点至少一条可达终点路径。
    private static void WalkAllBranches()
    {
        foreach (var (cardId, knot) in InkEventCatalog.Knots)
        {
            var paths = new List<int[]> { Array.Empty<int>() };
            var terminals = 0;
            var deadPaths = new List<string>();
            for (var depth = 0; depth <= MaxDepth; depth++)
            {
                var next = new List<int[]>();
                foreach (var path in paths)
                {
                    var (dead, terminal, choiceCount) = Walk(knot, path);
                    if (dead) { deadPaths.Add(string.Join('>', path)); continue; }
                    if (terminal) { terminals++; continue; }
                    for (var i = 0; i < choiceCount; i++)
                    {
                        var extended = new int[path.Length + 1];
                        path.CopyTo(extended, 0);
                        extended[path.Length] = i;
                        next.Add(extended);
                    }
                }
                if (deadPaths.Count > 0) break;
                if (next.Count == 0) break; // 全部路径已到终点
                paths = next;
                Check(depth < MaxDepth, $"{cardId} 分支深度超过 {MaxDepth}（疑似循环分支）");
            }
            Check(deadPaths.Count == 0, $"{cardId} 存在死分支：{string.Join(" / ", deadPaths)}");
            Check(terminals > 0, $"{cardId} 至少应有一条可达终点路径");
        }
    }

    // 照 narrative-coverage.test.js walk()：沿选择序列走一个 knot，
    // 选项下标越界或运行时报错 = 死路；无内容且无选项 = 终点。
    private static (bool Dead, bool Terminal, int ChoiceCount) Walk(string knot, int[] path)
    {
        var story = new Story(_storyJson);
        story.ChoosePathString(knot);
        story.ContinueMaximally();
        foreach (var idx in path)
        {
            if (idx >= story.currentChoices.Count) return (true, false, 0);
            story.ChooseChoiceIndex(idx);
            story.ContinueMaximally();
            if (story.hasError) return (true, false, 0);
        }
        var terminal = !story.canContinue && story.currentChoices.Count == 0;
        return (false, terminal, story.currentChoices.Count);
    }
}
