using System;
using System.IO;
using System.Linq;
using Sdt.Narrative;

class Program
{
    static int Main()
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "narrative-events.json"));
        var svc = new NarrativeService(json);
        string[] cardIds =
        {
            "tt6-timeskip", "tt6-demondeal", "tt6-bandits", "tt6-goldmine", "tt6-mystery",
            "tt6-goldhammer", "tt6-relief", "tt6-airdrop", "tt6-chestdraw", "tt6-systemsupply",
        };
        int fails = 0;
        foreach (var id in cardIds)
        {
            string line;
            try
            {
                if (!svc.HasEvent(id)) { line = $"FAIL {id} HasEvent=false"; fails++; Console.WriteLine(line); continue; }
                var ev = svc.OpenEvent(id);
                if (ev == null || ev.Paragraphs.Count == 0 || ev.Choices.Count == 0)
                { line = $"FAIL {id} intro paragraphs={ev?.Paragraphs.Count} choices={ev?.Choices.Count}"; fails++; Console.WriteLine(line); continue; }
                // 每个选项至少解析出 label + tone/effect 元数据之一；逐个走一步验证可推进
                int advanced = 0;
                foreach (var c in ev.Choices)
                {
                    var intro = svc.OpenEvent(id);
                    var next = svc.Choose(intro, c.ChoiceIndex);
                    if (next != null && (next.Paragraphs.Count > 0 || next.Choices.Count > 0)) advanced++;
                }
                if (advanced != ev.Choices.Count)
                { line = $"FAIL {id} choices={ev.Choices.Count} advanced={advanced}"; fails++; Console.WriteLine(line); continue; }
                line = $"PASS {id} choices={ev.Choices.Count} meta=ok";
            }
            catch (Exception ex)
            {
                line = $"FAIL {id} EX {ex.Message}"; fails++;
            }
            Console.WriteLine(line);
        }
        if (svc.HasEvent("no-such-card")) { Console.WriteLine("FAIL HasEvent false-positive"); fails++; }
        if (svc.OpenEvent("no-such-card") != null) { Console.WriteLine("FAIL OpenEvent null-check"); fails++; }
        Console.WriteLine(fails == 0 ? "ALL PASS" : $"{fails} FAILURES");
        return fails == 0 ? 0 : 1;
    }
}
