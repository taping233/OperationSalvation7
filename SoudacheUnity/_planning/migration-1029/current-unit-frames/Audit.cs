using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Collections.Generic;
using Sdt.Res;
using Sdt.UI.Screens.Battle;

static class Audit
{
    static void Main()
    {
        string here = Path.GetFullPath("_planning/migration-1029/current-unit-frames");
        var options = new JsonSerializerOptions { IncludeFields = true };
        var manifest = JsonNode.Parse(File.ReadAllText("Assets/Resources/Data/CurrentUnitFrames.json"));
        var roles = manifest["roles"].AsArray().Select(r => r.Deserialize<UnitFrameCatalog>(options)).ToDictionary(r=>r.id);
        var oracle = JsonNode.Parse(File.ReadAllText(Path.Combine(here, "source-vectors.json")));
        var results = new List<object>(); int failed = 0;
        foreach (var vector in oracle["vectors"].AsArray())
        {
            string role = (string)vector["role"], action = (string)vector["action"];
            var catalog = roles[role]; var clock = new BattleActorClock();
            clock.Play(catalog.Find(action), (float)vector["pace"]);
            clock.Advance((double)vector["time"], catalog.Find("idle"));
            var actual = new { action = clock.Action, frame = clock.Frame, index = clock.Index, running = clock.Running };
            var expected = vector["expected"];
            bool pass = clock.Action == (string)expected["action"] && clock.Frame == (string)expected["frame"]
                && clock.Index == (int)expected["index"] && clock.Running == (bool)expected["running"];
            double? remaining=clock.ImpactRemaining(catalog.contactFrame);double? sourceImpact=(double?)expected["impact"];
            pass=pass&&(remaining==null?sourceImpact==null:sourceImpact!=null&&Math.Abs(remaining.Value-sourceImpact.Value)<.001);
            if (!pass) failed++;
            results.Add(new { role, action, pace = (int)vector["pace"], time = (double)vector["time"], pass, actual, expected });
        }
        foreach(var v in oracle["timingVectors"].AsArray())
        {
            var cue=new Sdt.Core.Battle.BattleActorCue{ReplayAttacker=(bool)v["replay"],WindupMs=(int)v["windupMs"]};
            Check(Math.Abs(BattlePresentationTiming.Windup(cue,(double?)v["contact"],(int)v["pace"],false)-(double)v["expected"])<.001,"staged-windup:"+v.ToJsonString(),results,ref failed);
        }
        foreach(var v in oracle["stops"].AsArray())
        {
            var cue=new Sdt.Core.Battle.BattleActorCue{Profile=(string)v["profile"],HpBefore=(int)v["amount"],HpAfter=0,Dead=(bool)v["kill"]};
            Check(BattlePresentationTiming.Stop(cue,(bool)v["reduced"])==(double)v["expected"],"hit-stop:"+v.ToJsonString(),results,ref failed);
        }
        // Source action priorities: active combo continues; hurt replaces attack; death locks and holds.
        foreach (var catalog in roles.Values)
        {
            var clock = new BattleActorClock(); var atk = catalog.Find("atk"); var idle = catalog.Find("idle");
            clock.Play(atk); clock.Advance(atk.milliseconds[0] + 1, idle); int previous = clock.Index;
            clock.Play(atk, 1, true); Check(clock.Index == previous, catalog.id+" combo continues", results, ref failed);
            clock.Play(catalog.Find("hurt")); Check(clock.Action == "hurt" && clock.Index == 0, catalog.id+" hurt overrides", results, ref failed);
            clock.Play(catalog.Find("death")); Check(!clock.Play(atk), catalog.id+" death locks", results, ref failed);
            clock.Advance(10000, idle); Check(clock.DeathComplete && clock.Frame == catalog.Find("death").frames.Last(), catalog.id+" death holds", results, ref failed);
            float visibleFoot = -catalog.FootInset + catalog.FigureHeight * (catalog.height - catalog.neutralBounds[3]) / catalog.height;
            Check(Math.Abs(visibleFoot) < .0001, catalog.id+" fixed foot", results, ref failed);
        }
        File.WriteAllText(Path.Combine(here,"unity-results.json"), JsonSerializer.Serialize(new { total = results.Count, failed, results }, new JsonSerializerOptions { WriteIndented=true }));
        Console.WriteLine($"actor clock/source comparison: {results.Count-failed}/{results.Count}");
        if (failed > 0) Environment.Exit(1);
        BeatAudit.Run();
    }
    static void Check(bool pass, string name, List<object> results, ref int failed)
    { if (!pass) failed++; results.Add(new { name, pass }); }
}
