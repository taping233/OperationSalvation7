// Independent native transition probe. Root runs this in its one hidden Unity process.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Misc;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentFilmFlowValidation
    {
        const string Active = "Sdt.CurrentFilmFlow.Active";
        static readonly List<object> Records = new List<object>();
        static IEnumerator _flow;
        static FileStream _locked;
        static double _start, _next;
        static string _milestone;
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static double Now => EditorApplication.timeSinceStartup;
        static CurrentFilmFlowValidation() { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        public static void Run()
        {
            if (string.IsNullOrWhiteSpace(Output)) throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT required");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-film-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            AssetDatabase.DisallowAutoRefresh(); SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Require(bool pass, string reason) { if (!pass) throw new InvalidOperationException(reason); }
        static void Observe(string message, string stack, LogType type)
        { if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception)) Finish(new InvalidOperationException(message + "\n" + stack)); }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || App.Canvas == null || Now < _next) return;
            _next = Now + .035;
            if (_start == 0) _start = Now;
            try
            {
                Require(Now - _start < 160, "film probe timeout at " + _milestone);
                if (_flow == null) _flow = Flow().GetEnumerator();
                if (!_flow.MoveNext()) Finish(null);
            }
            catch (Exception error) { Finish(error); }
        }
        static IEnumerable<object> Wait(double seconds)
        { double until = Now + seconds; while (Now < until) yield return null; }
        static IEnumerable<object> Until(Func<bool> ready, double seconds, string reason)
        { double until = Now + seconds; while (!ready()) { Require(Now < until, reason); yield return null; } }
        static IEnumerable<object> Flow()
        {
            OffscreenCapture.PrepareReference();
            Require(Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(Output), StringComparison.OrdinalIgnoreCase), "profile escaped evidence directory");
            Require(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion", false, out var preferenceError), preferenceError);
            Clear(); App.ShowTitle();
            _milestone = "actual title photo entrance";
            foreach (var item in ClickWhenReady("btnCardLib")) yield return item;
            foreach (var item in FilmWhenStarted("photo", 1.1f, .76f)) yield return item;
            foreach (var item in Wait(.3)) yield return item; Shot("photo-develop-early");
            foreach (var item in Until(() => CurrentRunFilm.Current?.PlaybackProgress > .65f, 3, "photo playback did not advance")) yield return item;
            Shot("photo-develop-middle");
            foreach (var item in Until(() => !CurrentRunFilm.Visible, 4, "photo reveal did not finish")) yield return item;
            Require(UiStack.Top is CardLibraryScreen, "photo destination missing"); Shot("photo-destination");
            UiStack.Top.CloseFromEscape();
            foreach (var item in Until(() => UiStack.Top is TitleScreen, 3, "photo return did not restore title")) yield return item;
            _milestone = "warm photo entrance and owner cancellation";
            foreach (var item in ClickWhenReady("btnCardLib")) yield return item;
            foreach (var item in FilmWhenStarted("photo", 1.1f, .76f)) yield return item;
            foreach (var item in Wait(.15)) yield return item;
            App.ShowTitle();
            foreach (var item in Wait(.15)) yield return item;
            Require(!CurrentRunFilm.Visible && UiStack.Top is TitleScreen, "stale photo cover survived destination change");
            Record("photo-warm-owner-cancel", new { passed = true });

            _milestone = "actual boss gate arrival/return"; Fixture("boss", 3); var g = GameRuntime.I;
            g.State.altarActivated = true; g.SaveCurrent(); string random = g.Rng.SaveState(); string nodeKey = g.CurrentNodeId;
            g.ResolveCell(); Require(UiStack.Top is CurrentBossGateScreen && !g.State.battleActive && g.Rng.SaveState() == random, "boss arrival started battle or consumed RNG");
            Require(HasBanner("boss"), "boss banner absent from real gate");
            foreach (var item in ButtonWhenReady("bossGateBack")) yield return item;
            Shot("boss-gate-confirmation");
            foreach (var item in ClickWhenReady("bossGateBack")) yield return item;
            Require(g.State.Phase == "idle" && !g.State.settled.Contains(nodeKey) && !g.CurrentNodeReceipt.completed, "gate return consumed its node");
            g.ResolveCell(); Require(UiStack.Top is CurrentBossGateScreen && g.Rng.SaveState() == random, "gate reentry changed boss plan");
            foreach (var item in ButtonWhenReady("bossGateFight")) yield return item;
            string before = File.ReadAllText(SaveSystem.ProfilePath);
            _locked = new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            _milestone = "boss film full dwell and failed transaction";
            foreach (var item in ClickWhenReady("bossGateFight")) yield return item;
            double began = Now;
            foreach (var item in FilmWhenStarted("boss", 1.5f, .68f)) yield return item;
            foreach (var item in Wait(.3)) yield return item;
            Require(!g.State.battleActive && g.CurrentNodeReceipt.bossId == null, "boss plan committed before film callback");
            Shot("boss-pressure-early"); Require(ReceiverAtCenter() == CurrentRunFilm.Current.gameObject, "boss film did not intercept covered gate input");
            foreach (var item in Until(() => CurrentRunFilm.Current?.PlaybackProgress > .65f, 3, "boss playback did not advance")) yield return item;
            Shot("boss-pressure-middle");
            foreach (var item in Until(() => !CurrentRunFilm.Visible, 4, "boss failed-entry curtain did not finish")) yield return item;
            Record("boss-failed-entry-state", new { elapsed = Now - began, fullDwellAndReveal = Now - began >= 2.1,
                stack = UiStack.Names(), topIsGate = UiStack.Top is CurrentBossGateScreen, g.State.Phase,
                g.State.runActive, g.State.battleActive, g.EntrySupplyComplete, node = g.CurrentNodeId,
                g.CurrentNodeReceipt.bossId, rngUnchanged = g.Rng.SaveState() == random,
                fileUnchanged = File.ReadAllText(SaveSystem.ProfilePath) == before });
            Require(Now - began >= 2.1 && UiStack.Top is CurrentBossGateScreen && !g.State.battleActive, "failed gate did not retain confirmation after full dwell/reveal");
            Require(g.CurrentNodeReceipt.bossId == null && g.Rng.SaveState() == random && File.ReadAllText(SaveSystem.ProfilePath) == before, "failed gate changed plan/RNG/file");
            Shot("boss-gate-save-failed"); Record("boss-failed-atomic-retry", new { elapsed = Now - began, passed = true });
            _locked.Dispose(); _locked = null;
            _milestone = "actual boss retry and native pointer Skip";
            foreach (var item in ClickWhenReady("bossGateFight")) yield return item;
            foreach (var item in FilmWhenStarted("boss", 1.5f, .68f)) yield return item;
            foreach (var item in Wait(.25)) yield return item;
            var film = CurrentRunFilm.Current;
            foreach (var item in FilmWhenClickable(film)) yield return item;
            Require(film.WaitingForDestination, "boss film finished before native Skip could be exercised");
            PointerClickCenter(film.gameObject); double skipped = Now;
            foreach (var item in Until(() => g.State.battleActive, 3, "skipping boss film did not dispatch actual battle")) yield return item;
            Require(!string.IsNullOrEmpty(g.CurrentNodeReceipt.bossId), "accepted gate did not store boss identity");
            Require(new SaveSystem().ReadSlot(5).nodeRewards[nodeKey].bossId == g.CurrentNodeReceipt.bossId, "accepted boss identity was not saved");
            foreach (var item in Until(() => !CurrentRunFilm.Visible, 3, "boss skip reveal did not finish")) yield return item;
            Require(Now - skipped >= .6, "boss held-curtain skip lost its shared 680ms reveal");
            Require(Sdt.Boot.BattleViewApi.Session?.Snapshot.DeckSelection != null, "boss destination did not present actual deck selection");
            Shot("boss-deck-after-skip"); Record("boss-success-after-skip", new { revealElapsed = Now - skipped, boss = g.CurrentNodeReceipt.bossId });

            _milestone = "actual altar entrance"; Fixture("altar", 3); g.ResolveCell();
            foreach (var item in FilmWhenStarted("altar", .82f, .68f)) yield return item;
            foreach (var item in Wait(.4)) yield return item; Shot("altar-disturb-middle");
            foreach (var item in Until(() => !CurrentRunFilm.Visible, 4, "altar entrance did not complete")) yield return item;
            Require(UiStack.Top is AltarRitualScreen && HasBanner("altar"), "altar real page/banner absent"); Shot("altar-encounter");
            foreach (string id in new[] { "tt6-mystery", "tt6-chestdraw", "ev19-recode" })
            {
                _milestone = "actual event banner " + id; Fixture("event", 0); g.CurrentNodeReceipt.eventCardId = id; g.SaveCurrent();
                g.ResolveCell();
                foreach (var item in FilmWhenStarted("event", .52f, .68f)) yield return item;
                foreach (var item in Until(() => !CurrentRunFilm.Visible, 4, "event entrance did not complete")) yield return item;
                Require(UiStack.Top is EventDialogScreen && HasBanner(id), "current event banner not connected: " + id); Shot("event-encounter-" + id);
            }
            _milestone = "actual door entrance and passage"; Fixture("door", 0); g.ResolveCell();
            foreach (var item in FilmWhenStarted("door", .42f, .68f)) yield return item;
            foreach (var item in Until(() => !CurrentRunFilm.Visible, 4, "door entrance did not complete")) yield return item;
            Require(UiStack.Top is DoorModal, "actual door destination absent"); Shot("door-destination");
            Require(!UiStack.Top.GetComponentsInChildren<Text>().Any(t => t.text == "就此撤离" || t.text == "留下"), "legacy door choices survived current source migration");
            string doorKey = g.CurrentNodeId;
            foreach (var item in ClickWhenReady("doorBag")) yield return item;
            Require(UiStack.Top is Sdt.UI.Screens.Bag.BagScreen, "door inventory footer was not connected");
            Sdt.UI.Screens.Bag.BagScreen.Current.CloseBag(); Require(UiStack.Top is DoorModal, "inventory did not return to actual door owner");
            foreach (var item in ClickWhenReady("doorBack")) yield return item;
            Require(g.State.Phase == "idle" && !g.State.settled.Contains(doorKey) && !g.CurrentNodeReceipt.completed, "door return consumed the passage");
            g.ResolveCell();
            foreach (var item in FilmWhenStarted("door", .42f, .68f)) yield return item;
            foreach (var item in Wait(.1)) yield return item;
            film = CurrentRunFilm.Current;
            foreach (var item in FilmWhenClickable(film)) yield return item;
            Require(film.WaitingForDestination, "ordinary node film finished before native Skip could be exercised");
            PointerClickCenter(film.gameObject);
            foreach (var item in Until(() => !CurrentRunFilm.Visible, 2, "ordinary node Skip did not finish")) yield return item;
            Require(UiStack.Top is DoorModal, "ordinary node Skip failed to present door");
            Record("door-return-reentry-and-ordinary-skip", new { passed = true });
            foreach (var item in ClickWhenReady("goDoor")) yield return item;
            foreach (var item in FilmWhenStarted("passage", 3.6f, .7f)) yield return item;
            int layer = g.State.layerIdx; Require(layer != 0, "door did not change actual map layer");
            foreach (var item in Wait(.4)) yield return item; Shot("passage-early");
            CurrentRunFilm.Current.Skip(); Require(CurrentRunFilm.Current.WaitingForDestination, "non-skippable passage accepted Skip");
            foreach (var item in Until(() => CurrentRunFilm.Current?.PlaybackProgress > .6f, 4, "passage playback did not advance")) yield return item;
            Shot("passage-middle-caption");
            foreach (var item in Until(() => !CurrentRunFilm.Visible, 4, "passage did not finish")) yield return item;
            Require(g.State.layerIdx == layer && g.State.runActive, "passage mutated destination state");
            Record("actual-passage-completed", new { layer });
            Clear(); App.ShowTitle();
        }
        static void Fixture(string kind, int layer)
        {
            Clear(); var g = GameRuntime.I; g.ResetSlot(5); g.NewRun(5, CharacterTable.All[0].id);
            // Real travel refuses every other node until the entry cards are claimed.
            // Keep that prerequisite when positioning this fixture later in the run;
            // otherwise rollback's map rebind correctly reopens the unfinished supply.
            for (int index = 0; index < g.GetEntrySupplyCards().Count; index++)
                Require(g.ClaimEntrySupply(index, out var reason), "fixture entry supply claim failed: " + reason);
            Require(g.EntrySupplyComplete, "fixture did not complete actual entry supply commands");
            Clear();
            var node = g.Map.Snapshot.layers[layer].nodes.First(n => n.type == kind);
            g.State.layerIdx = layer; g.State.trackPos = node.idx; g.State.Phase = "idle"; g.SaveCurrent();
            Require(g.Saves.LastWriteSucceeded, "fixture save failed");
            Record("controlled-node-position", new { kind, layer, node = node.id, g.EntrySupplyComplete,
                source = "actual NewRun and entry-supply claim commands/current generated map; controlled position, not pathfinding or balance" });
        }
        static bool HasBanner(string id) => UiStack.Top.GetComponentsInChildren<CurrentEncounterEmblem>().Any(e => e.Kind == CurrentRunFilm.Encounter(id).kind);
        static void CheckFilm(string kind, float duration, float exit)
        {
            var film = CurrentRunFilm.Current;
            Require(film != null && film.Kind == kind && film.ShaderReady, "actual trigger did not produce supported shader film: " + kind);
            Require(Math.Abs(film.DurationSeconds - duration) < .001 && Math.Abs(film.ExitSeconds - exit) < .001, "source film timings differ: " + kind);
            Record("actual-film-start", new { kind, film.DurationSeconds, film.ExitSeconds, film.ShaderReady });
        }
        static GameObject ReceiverAtCenter()
        {
            var data = new PointerEventData(EventSystem.current) { position = new Vector2(960, 540), button = PointerEventData.InputButton.Left };
            var hits = new List<RaycastResult>(); EventSystem.current.RaycastAll(data, hits);
            return hits.Count == 0 ? null : ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject);
        }
        static void PointerClickCenter(GameObject target)
        {
            Require(ReceiverAtCenter() == target, "native center raycast missed film owner");
            var data = new PointerEventData(EventSystem.current) { position = new Vector2(960, 540), button = PointerEventData.InputButton.Left };
            Require(ExecuteEvents.Execute(target, data, ExecuteEvents.pointerClickHandler), "native film pointer handler rejected Skip");
            Record("constructed-native-film-pointer", new { target = target.name });
        }
        static IEnumerable<object> FilmWhenStarted(string kind, float duration, float exit)
        {
            // Home navigation first plays its real 180ms Leave coroutine. Observe the
            // destination film when that callback mounts it, without fast-forwarding it.
            foreach (var item in Until(() => CurrentRunFilm.Current != null && CurrentRunFilm.Current.Kind == kind,
                5, "actual entry never mounted source film: " + kind)) yield return item;
            CheckFilm(kind, duration, exit);
        }
        static IEnumerable<object> FilmWhenClickable(CurrentRunFilm film)
        {
            Require(film != null, "native Skip lost its film owner");
            int frame = Time.frameCount; double deadline = Now + 2;
            while (Time.frameCount <= frame || ReceiverAtCenter() != film.gameObject)
            {
                Require(film != null && CurrentRunFilm.Current == film, "film ended before native Skip became raycastable");
                Require(Now < deadline, "native film center never became raycastable");
                yield return null;
            }
        }
        static IEnumerable<object> ButtonWhenReady(string name)
        {
            // ForceUpdateCanvases alone can leave a newly mounted Graphic at depth=-1.
            // Require an actual player frame and the same raycast the click will use.
            int frame = Time.frameCount; double began = Now, deadline = Now + 5;
            while (Time.frameCount <= frame || !Ready(name))
            {
                if (Now >= deadline)
                {
                    var waiting = NamedButton(name);
                    Record("native-page-ready-timeout", new { target = name, stack = UiStack.Names(), frame, currentFrame = Time.frameCount,
                        groups = waiting == null ? null : waiting.GetComponentsInParent<CanvasGroup>().Select(group => new { group.name, group.alpha, group.interactable, group.blocksRaycasts }).ToArray(),
                        graphics = waiting == null ? null : waiting.GetComponentsInChildren<Graphic>().Select(graphic => new { graphic.name, graphic.depth, cull = graphic.canvasRenderer.cull }).ToArray() });
                    Require(false, "native target never became interactive and raycastable: " + name);
                }
                yield return null;
            }
            Record("native-page-ready", new { target = name, waited = Now - began, fromFrame = frame, toFrame = Time.frameCount });
        }
        static IEnumerable<object> ClickWhenReady(string name)
        {
            foreach (var item in ButtonWhenReady(name)) yield return item;
            Click(name);
        }
        static Button NamedButton(string name) => UiStack.Top == null ? null : UiStack.Top.GetComponentsInChildren<Button>().FirstOrDefault(button => button.name == name);
        static void Click(string name) => Click(UiStack.Top.GetComponentsInChildren<Button>().First(b => b.name == name).gameObject);
        static bool Ready(string name)
        {
            var button = NamedButton(name);
            if (button == null || !button.IsActive() || !button.IsInteractable() || EventSystem.current == null) return false;
            // Some permanent system layers intentionally use alpha=.86. Alpha is not
            // an input-readiness contract; Selectable and GraphicRaycaster own that.
            if (button.GetComponentsInParent<CanvasGroup>().Any(group => group.isActiveAndEnabled && (!group.interactable || !group.blocksRaycasts))) return false;
            Canvas.ForceUpdateCanvases();
            var rect = (RectTransform)button.transform;
            var point = RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera, rect.TransformPoint(rect.rect.center));
            var data = new PointerEventData(EventSystem.current) { position = point, button = PointerEventData.InputButton.Left };
            var hits = new List<RaycastResult>(); EventSystem.current.RaycastAll(data, hits);
            return hits.Count > 0 && ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject) == button.gameObject;
        }
        static void Click(GameObject target)
        {
            Canvas.ForceUpdateCanvases();
            var rt = (RectTransform)target.transform;
            var point = RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera, rt.TransformPoint(rt.rect.center));
            var data = new PointerEventData(EventSystem.current) { position = point, pressPosition = point,
                button = PointerEventData.InputButton.Left, eligibleForClick = true, clickCount = 1 };
            var hits = new List<RaycastResult>(); EventSystem.current.RaycastAll(data, hits);
            var receiver = hits.Count == 0 ? null : ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject);
            Record("native-pointer-diagnostics",new{target=target.name,point.x,point.y,hits=hits.Take(6).Select(hit=>hit.gameObject.name).ToArray(),receiver=receiver==null?null:receiver.name,
                graphics=target.GetComponentsInChildren<Graphic>().Select(graphic=>new{graphic.name,graphic.depth,cull=graphic.canvasRenderer.cull}).ToArray(),groups=target.GetComponentsInParent<CanvasGroup>().Select(group=>new{group.name,group.alpha,group.interactable,group.blocksRaycasts}).ToArray()});
            Require(receiver == target, "native raycast blocked " + target.name + " by " + receiver?.name);
            Require(target.GetComponent<Button>()?.IsInteractable() == true, "native target became non-interactable: " + target.name);
            data.pointerCurrentRaycast = hits[0]; data.pointerPressRaycast = hits[0];
            var down = ExecuteEvents.ExecuteHierarchy(hits[0].gameObject, data, ExecuteEvents.pointerDownHandler);
            Require(down == target, "native pointer down receiver differs: " + target.name);
            data.pointerPress = down; data.rawPointerPress = hits[0].gameObject;
            Require(ExecuteEvents.Execute(down, data, ExecuteEvents.pointerUpHandler), "native pointer up rejected " + target.name);
            Require(ExecuteEvents.Execute(receiver, data, ExecuteEvents.pointerClickHandler), "native pointer rejected " + target.name);
            Record("constructed-native-page-pointer", new { target = target.name, point.x, point.y });
        }
        static void Clear() { CurrentRunFilm.CancelActive(); while (UiStack.Count > 0) UiStack.Pop(); }
        static void Shot(string name)
        { Record("capture", new { name, film = CurrentRunFilm.Current?.Kind, progress = CurrentRunFilm.Current?.PlaybackProgress, revealing = CurrentRunFilm.Current?.IsRevealing, capture = OffscreenCapture.Write(Path.Combine(Output, name + ".png")) }); }
        static void Record(string kind, object detail)
        { Records.Add(new { elapsed = Now - _start, milestone = _milestone, kind, detail }); File.WriteAllText(Path.Combine(Output, "trace.json"), JsonConvert.SerializeObject(Records, Formatting.Indented)); }
        static void Finish(Exception error)
        {
            if (!SessionState.GetBool(Active, false)) return;
            SessionState.SetBool(Active, false); Application.logMessageReceived -= Observe; _locked?.Dispose(); _locked = null;
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = error == null, scenario = "current-source-film-independent-flow", error = error?.ToString(), milestone = _milestone,
                input = "actual production entry/commands with isolated controlled map positions; constructed uGUI raycast/pointer; owner close API", osHardwareInput = false,
                dataDirectory = SaveSystem.Dir, referenceWidth = 1920, referenceHeight = 1080, records = Records,
                limitations = new[] { "No physical key or held hardware input claim.", "Controlled positions prove production triggers, not navigation reachability or balance.", "Captured source frames still require visual review; shader presence is not fidelity approval.", "Dedicated departure, extraction, resume, camp, ordinary battle and victory/defeat remain in root full journey/review scope." } }, Formatting.Indented));
            EditorApplication.Exit(error == null ? 0 : 2);
        }
    }
}
