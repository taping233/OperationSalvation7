using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sdt.Run
{
    public sealed class LastLampRecord { public int segmentId; public string runId, eventInstanceId, choiceId, mementoId; }
    public sealed class LastLampRun { public int segmentId; public string eventInstanceId, choiceId; }
    public sealed class LastLampState
    {
        public int version = 1, stage;
        public string ending;
        public Dictionary<string, LastLampRecord> segments = new Dictionary<string, LastLampRecord>();
        public Dictionary<string, LastLampRun> runs = new Dictionary<string, LastLampRun>();
    }
    public sealed class LastLampInspection { public string kind; public LastLampState state; public LastLampRecord record; public int segmentId; }
    public sealed partial class BaseData
    {
        [JsonProperty("story")] public JObject story = JObject.Parse("{\"flags\":{},\"outcomes\":{}}");
        public static string LastLampEventId(string runId, int layer, int track) => string.IsNullOrEmpty(runId) || layer < 0 || track < 0 ? null : "r6:last-lamp:v1:" + runId + ":" + layer + "," + track;
        static bool LastLampIdentity(string eventId, string runId)
        {
            if (string.IsNullOrEmpty(runId) || eventId == null) return false;
            string prefix = "r6:last-lamp:v1:" + runId + ":";
            return eventId.StartsWith(prefix, StringComparison.Ordinal) && Regex.IsMatch(eventId.Substring(prefix.Length), @"^(0|[1-9]\d*),(0|[1-9]\d*)$");
        }
        static string LastLampMemento(string ending) => ending == "open_beacon" ? "last_lamp_open_beacon" : ending == "shaded_marker" ? "last_lamp_shaded_marker" : null;
        public bool TryReadLastLamp(out LastLampState state, out string reason)
        {
            state = null; reason = null;
            try
            {
                if (!(story?["flags"] is JObject) || !(story?["outcomes"] is JObject outcomes)) throw new InvalidOperationException("故事档案结构损坏，原数据已保留");
                var raw = outcomes["last-lamp"];
                if (raw == null) { state = new LastLampState(); return true; }
                if (!(raw is JObject) || raw["version"]?.Type != JTokenType.Integer || raw["stage"]?.Type != JTokenType.Integer
                    || !(raw["segments"] is JObject) || !(raw["runs"] is JObject)) throw new InvalidOperationException("北门灯标档案结构无效");
                state = raw.ToObject<LastLampState>();
                if (state.version != 1 || state.stage < 0 || state.stage > 3 || state.segments == null || state.runs == null
                    || !state.segments.Keys.OrderBy(x => x).SequenceEqual(Enumerable.Range(1, state.stage).Select(i => i.ToString())) || state.runs.Count != state.stage)
                    throw new InvalidOperationException("故事阶段与记录不一致");
                for (int segment = 1; segment <= state.stage; segment++)
                {
                    var record = state.segments[segment.ToString()];
                    if (record == null || record.segmentId != segment || !LastLampIdentity(record.eventInstanceId, record.runId)
                        || (segment < 3 ? record.choiceId != "continue" || record.mementoId != null : LastLampMemento(record.choiceId) == null || record.mementoId != LastLampMemento(record.choiceId))
                        || !state.runs.TryGetValue(record.runId, out var run) || run == null || run.segmentId != segment || run.eventInstanceId != record.eventInstanceId || run.choiceId != record.choiceId)
                        throw new InvalidOperationException("故事段落与探索身份记录不一致");
                }
                if (state.stage < 3 ? state.ending != null : LastLampMemento(state.ending) == null || state.segments["3"].choiceId != state.ending)
                    throw new InvalidOperationException("故事结局与最终选择不一致");
                return true;
            }
            catch (Exception error) { state = null; reason = error.Message; return false; }
        }
        public bool ValidateStory(out string reason) => TryReadLastLamp(out _, out reason);
        public LastLampInspection InspectLastLamp(string runId, string eventId)
        {
            if (!LastLampIdentity(eventId, runId)) throw new InvalidOperationException("缺少稳定探索身份或事件实例");
            if (!TryReadLastLamp(out var state, out var reason)) throw new InvalidOperationException(reason);
            if (state.runs.TryGetValue(runId, out var run))
            {
                var record = state.segments[run.segmentId.ToString()];
                return new LastLampInspection { kind = record.eventInstanceId == eventId ? "recover" : "already-read-this-run", state = state, record = record, segmentId = run.segmentId };
            }
            return new LastLampInspection { kind = state.stage >= 3 ? "complete" : "available", state = state, segmentId = Math.Min(3, state.stage + 1) };
        }
        public bool TryRecordLastLamp(string runId, string eventId, int segmentId, string choiceId, out string reason) => GameRuntime.I.TryPersistMutation(() =>
        {
            RequireCurrentBase(); var inspected = InspectLastLamp(runId, eventId);
            if (inspected.kind == "recover" && inspected.segmentId == segmentId && inspected.record.choiceId == choiceId) return;
            if (inspected.kind != "available") throw new InvalidOperationException("本次探索不能再次推进这条故事");
            if (inspected.segmentId != segmentId || (segmentId < 3 ? choiceId != "continue" : LastLampMemento(choiceId) == null)) throw new InvalidOperationException("故事段落或选项与进度不符");
            var state = inspected.state;
            state.stage = segmentId; state.ending = segmentId == 3 ? choiceId : null;
            state.segments[segmentId.ToString()] = new LastLampRecord { segmentId = segmentId, runId = runId, eventInstanceId = eventId, choiceId = choiceId, mementoId = segmentId == 3 ? LastLampMemento(choiceId) : null };
            state.runs[runId] = new LastLampRun { segmentId = segmentId, eventInstanceId = eventId, choiceId = choiceId };
            story["flags"]["lastLampRead" + segmentId] = true;
            story["outcomes"]["last-lamp"] = JObject.FromObject(state);
        }, out reason);
    }
}
