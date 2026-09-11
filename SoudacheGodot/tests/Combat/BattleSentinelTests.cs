using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Soudache.Battle;

// ported from 搜打撤/tests/effect-verbs.test.js —— 牌效动词注册表 + 未识别子句哨兵。
//   1. 注册表卫生：id 唯一、pattern 非空、label 可读；
//   2. 覆盖度（硬断言）：全卡库 245 张每一句「有效果」的描述都必须被注册表认识
//      （已实装动词 / 外部层实装 / 设计者留白），否则构建失败——「新卡文案没实装」的报警器；
//   3. 行为等价：ELSEWHERE 表句式与门控逐条冻结（快照见 搜打撤/tests/fixtures/effect-elsewhere-frozen.json）；
//   4. 哨兵：牌面像有效果、执行器没结算、注册表也不认识 → 显式抛 UnknownClauseException（带卡 id+子句文本）。

internal static class BattleSentinelTests
{
    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    private static readonly string[] Buckets = { "Immediate", "TurnStart", "Battle", "OnInfused", "OnDraw", "Skill" };
    private static readonly string[] BattleTypes = { "武术", "法术", "装备", "道具", "能力卡" };

    private static string ClauseText(object item) => item switch
    {
        TurnStartClause t => t.Text,
        string s => s,
        _ => throw new ArgumentException("未知子句类型"),
    };

    private sealed record ClauseInfo(string Card, string Bucket, string Text, string Inner);

    /// <summary>收集全卡库所有子句（按 SplitEffectClauses 的正式分桶）。</summary>
    private static List<ClauseInfo> AllClauses()
    {
        var result = new List<ClauseInfo>();
        foreach (var card in BattleHarness.SharedCards().All)
        {
            if (!BattleTypes.Contains(card.Type)) continue;
            var parts = TextClauses.SplitEffectClauses(card.Desc);
            foreach (var bucket in Buckets)
            {
                object[] items = bucket switch
                {
                    "TurnStart" => parts.TurnStart.Cast<object>().ToArray(),
                    "Battle" => parts.Battle.Cast<object>().ToArray(),
                    "OnInfused" => parts.OnInfused.Cast<object>().ToArray(),
                    "OnDraw" => parts.OnDraw.Cast<object>().ToArray(),
                    "Skill" => parts.Skill.Cast<object>().ToArray(),
                    _ => parts.Immediate.Cast<object>().ToArray(),
                };
                foreach (var item in items)
                {
                    var text = ClauseText(item);
                    // 「本局对战内」前缀句与外层同义，检查内层（与执行器一致）
                    var inner = bucket == "Battle" ? TextClauses.BattleClauseInner(text) : text;
                    result.Add(new ClauseInfo(card.Name, bucket, text, inner));
                }
            }
        }
        return result;
    }

    public static int Run()
    {
        var checkedCount = 0;

        // ---- 注册表卫生 ----
        {
            var tables = new (string Name, VerbEntry[] Table)[] { ("VERBS", EffectVerbs.Verbs), ("ELSEWHERE", EffectVerbs.Elsewhere), ("DESIGNER_BLANKS", EffectVerbs.DesignerBlanks) };
            var ids = new List<string>();
            foreach (var (name, table) in tables)
            {
                Check(table.Length > 0, $"{name} 不应为空");
                foreach (var v in table)
                {
                    Check(!string.IsNullOrEmpty(v.Id), $"{name} 条目缺 id");
                    Check(v.Source.Length > 0, $"{name}.{v.Id} 的 pattern 不应为空");
                    Check(!string.IsNullOrEmpty(v.Label), $"{name}.{v.Id} 缺可读 label");
                    ids.Add($"{name}:{v.Id}");
                }
            }
            Check(new HashSet<string>(ids).Count == ids.Count, $"注册表 id 有重复：{string.Join(",", ids)}");
            Check(EffectVerbs.DesignerBlanks.Length <= 3, "留白只应显式存在少量");
            checkedCount += ids.Count;
        }

        // ---- 覆盖度：全卡库每一句有效果的描述都被注册表认识 ----
        {
            var unknowns = AllClauses()
                .Where(c => EffectVerbs.LooksLikeEffect(c.Inner)
                    && !EffectVerbs.IsRecognized(c.Inner, structuredHit: true, infusedLead: Regex.IsMatch(c.Text, @"^\s*注能")))
                .Select(c => $"{c.Card} [{c.Bucket}] {c.Inner}")
                .ToList();
            Check(unknowns.Count == 0,
                "以下描述既没被注册表认识，也没有实现：\n" + string.Join("\n", unknowns));
            var totalClauses = AllClauses().Count;
            Console.WriteLine($"哨兵覆盖度：{totalClauses} 条子句全部被注册表覆盖（0 未识别）");
            checkedCount += 2;
        }

        // ---- 覆盖度不是靠宽泛正则糊过去的：风味句不进覆盖范围 ----
        Check(!EffectVerbs.LooksLikeEffect("向深渊献上敬意"), "风味句不报警（是）");
        Check(EffectVerbs.LooksLikeEffect("抽 1 张牌"), "风味句不报警（否）");
        Check(!EffectVerbs.IsRecognized("向深渊献上敬意"), "风味句不被识别");
        checkedCount += 3;

        // ---- 识别面冻结：ELSEWHERE 与网页版快照逐条一致 ----
        {
            var fixturePath = FindElsewhereFixture();
            if (fixturePath is null)
            {
                Console.WriteLine("（跳过 ELSEWHERE 冻结快照：未找到 搜打撤/tests/fixtures/effect-elsewhere-frozen.json）");
            }
            else
            {
                using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(fixturePath));
                var frozen = new List<string>();
                foreach (var entry in doc.RootElement.GetProperty("entries").EnumerateArray())
                {
                    var gate = entry.TryGetProperty("gate", out var g) && g.ValueKind == System.Text.Json.JsonValueKind.String ? g.GetString() : null;
                    var source = entry.GetProperty("source").GetString();
                    frozen.Add($"{(string.IsNullOrEmpty(gate) ? "-" : gate)}:{source}");
                }
                var actual = EffectVerbs.Elsewhere.Select(v => $"{v.Gate ?? "-"}:{v.Source}").ToList();
                Check(actual.Count == frozen.Count,
                    $"ELSEWHERE 条目数与冻结快照不一致（actual={actual.Count}, frozen={frozen.Count}）");
                for (var i = 0; i < Math.Min(actual.Count, frozen.Count); i++)
                    Check(actual[i] == frozen[i], $"ELSEWHERE[{i}] 识别面被改动：\n  actual={actual[i]}\n  frozen={frozen[i]}");
                checkedCount += 2;
            }
        }

        // ---- 哨兵：负向测试（人为注入未知子句 → 显式抛错并带卡 id+子句文本） ----
        var previousStrict = EffectVerbs.StrictMode;
        EffectVerbs.StrictMode = true;
        try
        {
            var depPorts = new EffectPorts { AllCards = () => BattleHarness.SharedCards().All };
            var apply = EffectStepsFactory.CreatePipeline(depPorts);
            var card = new CardRecord { Id = "test-unknown-card", Name = "测试卡", Type = "法术", Desc = "" };
            Exception? caught = null;
            try
            {
                apply(card, "对敌人造成 3 点诡异伤害", null, new EffectFlags());
            }
            catch (Exception e) { caught = e; }
            Check(caught is UnknownClauseException, $"人为注入的未知子句应显式抛错（got {caught?.GetType().Name ?? "无异常"}）");
            var ex = (UnknownClauseException)caught!;
            Check(ex.CardId == "test-unknown-card" && ex.ClauseText == "对敌人造成 3 点诡异伤害",
                $"哨兵异常应带卡 id+子句文本（id={ex.CardId}, text={ex.ClauseText}）");
            checkedCount += 2;

            // 已实装句式不报警
            var res = apply(card, "抽 1 张牌", null, new EffectFlags());
            Check(res.Did, "已实装句式正常结算");
            checkedCount += 1;
        }
        finally
        {
            EffectVerbs.StrictMode = previousStrict;
        }

        Console.WriteLine($"哨兵/注册表检查完成 checks={checkedCount}");
        return checkedCount;
    }

    private static string? FindElsewhereFixture()
    {
        foreach (var path in new[]
        {
            Path.Combine("搜打撤", "tests", "fixtures", "effect-elsewhere-frozen.json"),
            Path.Combine("..", "搜打撤", "tests", "fixtures", "effect-elsewhere-frozen.json"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", "搜打撤", "tests", "fixtures", "effect-elsewhere-frozen.json"),
        })
        {
            if (File.Exists(path)) return path;
        }
        return null;
    }
}
