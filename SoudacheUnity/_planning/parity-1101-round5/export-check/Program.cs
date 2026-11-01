using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;

static class PhotoStudioExportChecks
{
    static int assertions;
    static void Check(bool value, string message)
    { assertions++; if (!value) throw new InvalidOperationException(message); }
    static void Reject(Action action, string message)
    {
        bool rejected = false;
        try { action(); }
        catch (InvalidDataException) { rejected = true; }
        catch (JsonException) { rejected = true; }
        Check(rejected, message);
    }
    static void Main()
    {
        string output = Path.GetFullPath("_planning/parity-1101-round5/export-check/output-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));
        Directory.CreateDirectory(output); Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(output, "profile"));
        var saves = new SaveSystem(); saves.Global.SetString("round5-export-control", "preserve");
        Rng.Default = new Rng(1105); string random = Rng.Default.SaveState();
        IReadOnlyList<CardDef> source = CardDatabase.All;
        CardLibrary.CustomsLoader = () => SaveSystem.LoadCustomCards(saves);
        CardLibrary.CustomsSaver = cards => SaveSystem.SaveCustomCards(saves, cards);
        CardLibrary.ResetCustomsCache(); CardLibrary.Init(() => source);
        var replacement = source.Single(card => card.id == "tt3-fireball").Clone();
        replacement.name = "导出覆盖<&\""; replacement.variantKey = "round5-definition-variant";
        replacement.runtimeCost = 2; replacement.zeroCostUntilTurn = 99; replacement.noInfuse = true; replacement.count = 7;
        replacement.rules = RuleValue.Obj("version", 1, "triggers", RuleValue.Obj("onPlay", RuleValue.Arr(RuleValue.Obj("op", "armor", "n", 2))));
        var extra = replacement.Clone(); extra.id = "round5-export-custom"; extra.name = "新增自定义定义";
        CardLibrary.Upsert(replacement); CardLibrary.Upsert(extra);
        string profile = File.ReadAllText(SaveSystem.ProfilePath), catalog = SaveJson.Stringify(CardLibrary.All());
        var payload = JObject.Parse(PhotoStudioExport.CardsJson()); var cards = (JArray)payload["cards"];
        Check((string)payload["game"] == "sdt" && (string)payload["format"] == "cards" && (int)payload["version"] == 2, "current cards envelope");
        Check(cards.Count == source.Count + 1 && cards.Select(card => (string)card["id"]).SequenceEqual(source.Select(card => card.id).Concat(new[] { extra.id })), "whole catalog order includes every source and appended custom ID");
        int index = source.ToList().FindIndex(card => card.id == replacement.id); var exported = cards[index];
        Check((string)exported["name"] == replacement.name && cards.Count(card => (string)card["id"] == replacement.id) == 1, "custom override stays at source index without duplicate");
        Check((string)cards.Last["id"] == extra.id, "new custom stays at end");
        Check((int)exported["rules"]["version"] == 1 && exported["rules"]["Values"] == null && (string)exported["rules"]["triggers"]["onPlay"][0]["op"] == "armor", "RuleValue is a plain nested rule object");
        Check((string)exported["variantKey"] == replacement.variantKey && (int)exported["runtimeCost"] == 2 && (int)exported["zeroCostUntilTurn"] == 99 && (bool)exported["noInfuse"] && (int)exported["count"] == 7, "export preserves current definition fields without an invented stripping pass");
        exported["rules"]["triggers"]["onPlay"][0]["n"] = 999;
        Check(SaveJson.Stringify(CardLibrary.All()) == catalog, "payload edits cannot mutate shared definitions or rules");
        Check(File.ReadAllText(SaveSystem.ProfilePath) == profile, "card export does not rewrite profile");

        var originals = HubCatalog.Current.baseNotes;
        var baseOnly = JObject.Parse(PhotoStudioExport.NotesJson(saves, new Dictionary<string, string>()));
        Check(JToken.DeepEquals(baseOnly["notes"], SaveJson.Token(originals)), "absent handwriting exports complete base notes");
        var baseIds = originals.Keys.Take(4).ToArray();
        Check(baseIds.Length == 4, "real source note fixture");
        var saved = new Dictionary<string, string>
        {
            [baseIds[1]] = "持久手写覆盖底稿", [baseIds[2]] = "待清空旧手写", [baseIds[3]] = "待覆盖旧手写",
            ["round5-historical-note"] = "不在当前卡库的历史备注", ["round5-clear-no-base"] = "待删除"
        };
        saves.Global.SetJson(BaseData.PhotoNotesKey, saved);
        var pending = new Dictionary<string, string>
        {
            [baseIds[2]] = "", [baseIds[3]] = "未落盘覆盖手写", ["round5-clear-no-base"] = "",
            ["round5-unsaved-note"] = "失败暂存<&\"", ["__proto__"] = "普通备注键"
        };
        profile = File.ReadAllText(SaveSystem.ProfilePath); long revision = saves.Global.Revision;
        string pendingBefore = SaveJson.Stringify(pending), baseBefore = SaveJson.Stringify(originals);
        JObject notesPayload;
        using (var locked = new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            notesPayload = JObject.Parse(PhotoStudioExport.NotesJson(saves, pending));
        var notes = (JObject)notesPayload["notes"];
        Check((int)notesPayload["version"] == 1 && ((string)notesPayload["_comment"]).Contains("Unity"), "v1 notes envelope uses explicit Native metadata");
        Check((string)notes[baseIds[0]] == originals[baseIds[0]], "unmodified base note retained");
        Check((string)notes[baseIds[1]] == saved[baseIds[1]], "persisted handwriting overrides base");
        Check((string)notes[baseIds[2]] == originals[baseIds[2]], "pending clear removes old handwriting and restores base");
        Check((string)notes[baseIds[3]] == pending[baseIds[3]], "pending text overrides persisted handwriting");
        Check(notes["round5-clear-no-base"] == null, "pending clear without a base removes exported key");
        Check((string)notes["round5-historical-note"] == saved["round5-historical-note"] && (string)notes["round5-unsaved-note"] == pending["round5-unsaved-note"], "export retains noncatalog and unsaved note IDs");
        Check((string)notes["__proto__"] == pending["__proto__"], "data-only note key is preserved");
        Check(File.ReadAllText(SaveSystem.ProfilePath) == profile && saves.Global.Revision == revision, "notes export under a read lock does not persist or revise profile");
        Check(SaveJson.Stringify(pending) == pendingBefore && SaveJson.Stringify(originals) == baseBefore, "export does not clear pending or change source notes");
        foreach (var bad in new JToken[] { JValue.CreateNull(), new JArray(1), new JValue("not a note map") })
        {
            saves.Global.SetJson(BaseData.PhotoNotesKey, bad); profile = File.ReadAllText(SaveSystem.ProfilePath); revision = saves.Global.Revision;
            Reject(() => PhotoStudioExport.NotesJson(saves, pending), "invalid stored note map is rejected");
            Check(File.ReadAllText(SaveSystem.ProfilePath) == profile && saves.Global.Revision == revision && SaveJson.Stringify(pending) == pendingBefore, "rejected note export leaves archive and pending unchanged");
        }
        saves.Global.SetJson(BaseData.PhotoNotesKey, saved); profile = File.ReadAllText(SaveSystem.ProfilePath);
        File.WriteAllText(SaveSystem.ProfilePath, "{broken isolated export profile");
        try
        {
            var broken = new SaveSystem(); string invalid = File.ReadAllText(SaveSystem.ProfilePath);
            Reject(() => PhotoStudioExport.NotesJson(broken, pending), "whole-profile read error cannot masquerade as complete notes");
            Check(broken.HasReadError && File.ReadAllText(SaveSystem.ProfilePath) == invalid && SaveJson.Stringify(pending) == pendingBefore, "export preserves corrupt original and unsaved notes");
        }
        finally { File.WriteAllText(SaveSystem.ProfilePath, profile); }
        Check(Rng.Default.SaveState() == random, "exports do not consume default RNG");
        var result = new { passed = true, assertions, scope = "Production Core/Run payloads with existing Hub Unity resource/audio stubs; isolated real profile, no UI, file-export, clipboard or OS-input claim." };
        File.WriteAllText(Path.Combine(output, "result.json"), JsonConvert.SerializeObject(result, Formatting.Indented));
        Console.WriteLine(JsonConvert.SerializeObject(result));
    }
}
