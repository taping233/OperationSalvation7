using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.Res;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using OwnedCard = Sdt.Core.OwnedCard;

namespace Sdt.Editor
{
    /// <summary>Actual native actor painting. Synthetic Play/OnApplicationPause are labelled presentation fixtures.</summary>
    [InitializeOnLoad]
    public static class CurrentUnitFrameValidation
    {
        const string Active = "Sdt.CurrentUnitFrame.Active";
        static readonly string[] Roles = { "wu", "changwuyu", "baita", "heixiang", "xingyue" };
        static readonly string[] Actions = { "idle", "atk", "cast", "hurt", "death" };
        static readonly List<object> Records = new List<object>();
        static readonly List<object> Cues = new List<object>();
        static readonly HashSet<string> Imported = new HashSet<string>();
        static readonly Dictionary<int, int> RateIntervals = new Dictionary<int, int>();
        static readonly Dictionary<int, int> FasterLoopFrames = new Dictionary<int, int>();
        static BattleUnitFrames _actor;
        static Image _image;
        static Camera _camera;
        static RenderTexture _target;
        static int _role, _action, _stage, _lastIndex = -1, _heldIndex;
        static double _start, _since;
        static bool _captured, _trueAtk, _trueHurt;
        static string _lastAction, _heldFrame;
        static string _paintSprite, _paintAction;
        static double _paintAt;
        static bool _rateSampling;
        static bool _primeRateSample;
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static CurrentUnitFrameValidation() { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        public static void Run()
        {
            if (string.IsNullOrWhiteSpace(Output)) throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT required");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-frames-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            AssetDatabase.DisallowAutoRefresh(); SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Observe(string message, string stack, LogType type)
        { if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception)) Fail(new InvalidOperationException(message + "\n" + stack)); }
        static void Require(bool passed, string reason) { if (!passed) throw new InvalidOperationException(reason); }
        static void Cue(BattleActorCue cue)
        { Cues.Add(new { cue.BattleToken, cue.Sequence, cue.Kind, cue.Action, cue.HpBefore, cue.HpAfter, cue.IsSelf }); }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || App.Canvas == null) return;
            if (CurrentRunFilm.Active) return;
            if (_start == 0) { _start = EditorApplication.timeSinceStartup; BattleSession.ActorPresentation += Cue; Configure(); }
            try
            {
                Require(EditorApplication.timeSinceStartup - _start < 175, "native frame scenario exceeded 175 seconds");
                if (_actor != null && (_lastIndex != _actor.FrameIndex || _lastAction != _actor.CurrentAction))
                { _lastIndex = _actor.FrameIndex; _lastAction = _actor.CurrentAction; Record("actor-clock-transition", _role != 0 || _stage < 2 || _stage > 3); }
                Step();
            }
            catch (Exception error) { Fail(error); }
        }
        static void Configure()
        {
            OffscreenCapture.PrepareReference();
            _camera = Sdt.View.BoardViewHost.BoardCamera; Require(_camera != null, "board camera missing");
            _target = _camera.targetTexture;
            var canvas = App.Canvas; var scaler = canvas.GetComponent<CanvasScaler>(); if (scaler != null) scaler.enabled = false;
            canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = _camera; canvas.planeDistance = 1; canvas.scaleFactor = 1;
            canvas.overrideSorting = true; canvas.sortingOrder = 32767; Canvas.ForceUpdateCanvases();
            var rect = ((RectTransform)canvas.transform).rect; Require(Math.Abs(rect.width - 1920) < 2 && Math.Abs(rect.height - 1080) < 2, "native reference canvas mismatch");
            canvas.gameObject.AddComponent<CurrentUnitPaintObserver>();
        }
        static void BeginRole()
        {
            var g = GameRuntime.I; while (UiStack.Count > 0) UiStack.Pop();
            g.ResetSlot(5); g.NewRun(5, Roles[_role]); while (UiStack.Count > 0) UiStack.Pop();
            g.State.ownedCards.Clear(); g.State.usedPocket.Clear(); g.State.hp = g.State.maxHp = 1000; g.State.atk = 4;
            g.State.ownedCards.Add(new OwnedCard { uid = "native-frame-attack", card = CardLibrary.FindById("starter-attack").Clone() });
            g.State.ownedCards.Add(new OwnedCard { uid = "native-frame-cast", card = CardLibrary.FindById("tt3-fireball").Clone() });
            g.State.Phase = "idle"; g.Saves.Global.SetString("sdt-reduce-motion", "0"); g.Saves.Global.SetString("sdt-battle-pace", _role == 1 ? "2" : "1"); g.SaveCurrent();
            Require(CurrentUiPreferences.TrySetPerformance(CurrentUiPreferences.Quality, _role == 0 ? 30 : _role == 1 ? 120 : 60, out var performanceError), performanceError);
            // Presentation fixture: a faster native loop gives the actor's own cap an opportunity to operate.
            Application.targetFrameRate = 120; _rateSampling = false; ResetPaintSample();
            Record("local-cap-stress-loop-fixture", true);
            g.Bus.Emit(new BattleRequested { Request = new BattleRequest { Name = "五角色原生帧验收", Foes = new List<EnemyStats> { new EnemyStats { id = "native-frame-foe", name = "受控敌人", hp = 10000, atk = 2 } } } });
            _action = 0; _actor = null; _image = null; _lastAction = null; _lastIndex = -1; _since = EditorApplication.timeSinceStartup;
        }
        static void Step()
        {
            var g = GameRuntime.I;
            switch (_stage)
            {
                case 0: BeginRole(); _stage = 1; break;
                case 1:
                    if (!(UiStack.Top is BattleScreen) || EditorApplication.timeSinceStartup - _since < .3) return;
                    _actor = UiStack.Top.GetComponentsInChildren<BattleUnitFrames>().Single();
                    _image = _actor.GetComponentsInChildren<Image>().Single(i => i.name == "sts-portrait");
                    Require(_actor.Role == Roles[_role], "BattleRequested mounted wrong role"); CheckCatalog();
                    if (_role == 0)
                    {
                        Require(Sdt.Boot.BattleViewApi.Session.PlayCard("native-frame-attack", 0, false).Ok, "real attack command rejected");
                        _stage = 2; _since = EditorApplication.timeSinceStartup;
                    }
                    else _stage = 4;
                    break;
                case 2:
                    if (_actor.CurrentAction == "atk" && _actor.FrameIndex > 0 && !_trueAtk && PaintedCurrent()) { _trueAtk = true; Sample("real-card-command-atk", false); }
                    if (QueueBusy() || _actor.Running) return;
                    Require(_trueAtk && Cues.Any(), "actual card command did not drive actor/queue");
                    Sdt.Boot.BattleViewApi.Session.EndTurn(); _stage = 3; _since = EditorApplication.timeSinceStartup; break;
                case 3:
                    if (_actor.CurrentAction == "hurt" && _actor.FrameIndex > 0 && !_trueHurt && PaintedCurrent()) { _trueHurt = true; Sample("real-EndTurn-hurt", false); }
                    if (QueueBusy() || _actor.Running) return;
                    Require(_trueHurt && Cues.Count > 1, "actual enemy turn did not drive hurt actor/queue"); _stage = 4; break;
                case 4:
                    Require(!_actor.IsPaused, "actor unexpectedly paused");
                    _rateSampling = false; ResetPaintSample();
                    Require(_actor.Play(Actions[_action]), "presentation Play refused " + Actions[_action]);
                    // The immediate action-start paint is intentionally excluded from continuous drawing intervals.
                    _rateSampling = true;
                    _captured = false; _since = EditorApplication.timeSinceStartup; _stage = 5;
                    if (Actions[_action] == "idle" || _actor.Catalog.Find(Actions[_action]).frames.Length == 1)
                    { Sample(Actions[_action] + "-mid", true); _captured = true; }
                    break;
                case 5:
                    var sequence = _actor.Catalog.Find(Actions[_action]);
                    if (!_captured && _actor.CurrentAction == Actions[_action] && _actor.FrameIndex >= Math.Max(1, sequence.frames.Length / 3) && PaintedCurrent())
                    {
                        Sample(Actions[_action] + "-mid", true); _captured = true;
                        if (_role == 0 && Actions[_action] == "atk")
                        { _heldIndex = _actor.FrameIndex; _heldFrame = _actor.CurrentFrame; _actor.SendMessage("OnApplicationPause", true); _since = EditorApplication.timeSinceStartup; _stage = 6; return; }
                    }
                    if (Actions[_action] == "death")
                    {
                        if (!_actor.DeathComplete) return; Require(_captured, "death midpoint was never painted");
                        _heldIndex = _actor.FrameIndex; _heldFrame = _actor.CurrentFrame; _since = EditorApplication.timeSinceStartup; _stage = 8; return;
                    }
                    if (_actor.Running && Actions[_action] != "idle") return;
                    Require(_captured, "action completed without midpoint: " + Actions[_action]);
                    NextAction(); break;
                case 6:
                    if (EditorApplication.timeSinceStartup - _since < .2) return;
                    Require(_actor.IsPaused && _actor.FrameIndex == _heldIndex && _actor.CurrentFrame == _heldFrame, "simulated app pause advanced actor");
                    Record("presentation-fixture-application-pause-retains-frame", true); _actor.SendMessage("OnApplicationPause", false); _stage = 7; break;
                case 7:
                    if (_actor.CurrentAction == "atk" && _actor.FrameIndex <= _heldIndex) return;
                    Require(!_actor.IsPaused, "actor did not resume"); Record("presentation-fixture-application-resume", true); _stage = 5; break;
                case 8:
                    if (EditorApplication.timeSinceStartup - _since < .25) return;
                    Require(_actor.DeathComplete && !_actor.Running && _actor.CurrentFrame == _heldFrame && _actor.FrameIndex == _heldIndex, "death last frame not held");
                    Require(_actor.FrameIndex == _actor.Catalog.Find("death").frames.Length - 1, "death did not reach last catalog slot");
                    Sample("death-last-hold", true); _role++;
                    if (_role < Roles.Length) _stage = 0; else Finish(); break;
            }
        }
        static bool QueueBusy() => UiStack.Top.GetComponentsInChildren<BattlePresentationQueue>().Any(q => q.Busy);
        static void NextAction() { _rateSampling = false; _action++; _stage = 4; }
        static bool PaintedCurrent() => _image != null && _image.sprite != null && _actor != null && _image.sprite.name == _actor.Catalog.id + "/" + _actor.CurrentFrame;
        static void ResetPaintSample() { _paintSprite = _paintAction = null; _paintAt = 0;_primeRateSample=true; }
        // Called from real player LateUpdate, after actor Update. Observe the actual Image, not a mirrored scheduler.
        internal static void ObservePaint()
        {
            if (!SessionState.GetBool(Active, false) || !_rateSampling || _actor == null || _image?.sprite == null) return;
            int cap = Math.Min(60, CurrentUiPreferences.FrameLimit);
            if (Time.unscaledDeltaTime > 0 && Time.unscaledDeltaTime < 1d / cap - .001)
                FasterLoopFrames[cap] = FasterLoopFrames.TryGetValue(cap, out int loopFrames) ? loopFrames + 1 : 1;
            string sprite = _image.sprite.name, action = _actor.CurrentAction;
            if (_paintSprite == sprite) return;
            double now = Time.unscaledTimeAsDouble, interval = now - _paintAt;
            bool continuous = _paintSprite != null && _paintAction == action;
            // Play is invoked from EditorApplication.update, outside the player frame.
            // Its first observed image may already have been present before Play (shared
            // neutral sprite), so establish a native-to-native baseline before measuring.
            bool measured=continuous&&!_primeRateSample;
            Records.Add(new { kind = "actual-native-image-change", role = _actor.Role, action, sprite, clockFrame = _actor.CurrentFrame, cap, continuous, measured, seconds = now, interval, stage = _stage });
            if (measured)
            {
                Require(interval >= 1d / cap - .001, "native sprite changed faster than continuous local cap " + cap + ": " + interval);
                RateIntervals[cap] = RateIntervals.TryGetValue(cap, out int intervals) ? intervals + 1 : 1;
            }
            _primeRateSample=!continuous;
            _paintSprite = sprite; _paintAction = action; _paintAt = now;
        }
        static void CheckCatalog()
        {
            var c = _actor.Catalog; Require(c != null && c.id == Roles[_role], "catalog role mismatch");
            using (var lease = CurrentUnitFrames.Acquire(c.id))
                foreach (string name in c.actions.SelectMany(a => a.frames).Distinct())
                {
                    var sprite = lease.Frame(name); Require(sprite != null, "missing imported frame " + c.id + "/" + name);
                    Require(sprite.rect.width == c.width && sprite.rect.height == c.height && sprite.pivot.y == 0, "sprite canvas/pivot differs " + name);
                    Require(sprite.texture.width == c.width && sprite.texture.height == c.height, "texture import resized frame " + name);
                    Imported.Add(c.id + "/" + name);
                }
            Records.Add(new { kind = "native-resource-catalog", role = c.id, c.catalogSha256, c.width, c.height, c.bodyHeight, c.bodyFill, c.neutralBounds, c.contactFrame, uniqueImported = c.actions.SelectMany(a => a.frames).Distinct().Count(), pace = CurrentUiPreferences.BattlePace }); Flush();
        }
        static void Sample(string label, bool fixture)
        {
            Require(_image != null && _image.sprite != null, "actor painted no sprite"); var c = _actor.Catalog; var rt = _image.rectTransform;
            Require(_image.sprite.name == c.id + "/" + _actor.CurrentFrame, "painted sprite differs from actual actor frame");
            Require(rt.pivot == new Vector2(.5f, 0) && rt.anchorMin == new Vector2(.5f, 0) && rt.anchorMax == new Vector2(.5f, 0) && rt.anchoredPosition == Vector2.zero, "fixed foot anchor drift");
            Require(Math.Abs(rt.rect.height - c.FigureHeight) < .1f && Math.Abs(rt.rect.width - c.FigureHeight * c.width / c.height) < .1f, "painting canvas geometry differs from catalog");
            Require(_image.color.a > 0 && _image.isActiveAndEnabled, "actor image transparent/disabled");
            var alpha = ReadAlpha(_image.sprite.texture); Require(alpha.opaque > 0 && alpha.transparent > 0, "native frame alpha lost");
            Record(label, fixture);
            Records.Add(new { kind = "native-frame-sample", role = _actor.Role, action = _actor.CurrentAction, frame = _actor.CurrentFrame, index = _actor.FrameIndex, fixture, alpha, sprite = _image.sprite.name, width = rt.rect.width, height = rt.rect.height, footY = RectTransformUtility.WorldToScreenPoint(_camera, rt.TransformPoint(new Vector2(rt.rect.center.x, rt.rect.yMin))).y, catalogFootInset = c.FootInset, capture = OffscreenCapture.Write(Path.Combine(Output, "frames-" + _actor.Role + "-" + label + ".png")) }); Flush();
        }
        struct AlphaSummary { public int opaque, transparent; public byte minimum, maximum; }
        static AlphaSummary ReadAlpha(Texture2D source)
        {
            var previous = RenderTexture.active; var target = RenderTexture.GetTemporary(source.width, source.height, 0, RenderTextureFormat.ARGB32);
            var copy = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false);
            try
            {
                Graphics.Blit(source, target); RenderTexture.active = target; copy.ReadPixels(new Rect(0, 0, source.width, source.height), 0, 0); copy.Apply();
                var summary = new AlphaSummary { minimum = 255 };
                foreach (var pixel in copy.GetPixels32()) { summary.minimum = Math.Min(summary.minimum, pixel.a); summary.maximum = Math.Max(summary.maximum, pixel.a); if (pixel.a == 0) summary.transparent++; if (pixel.a >= 8) summary.opaque++; }
                return summary;
            }
            finally { RenderTexture.active = previous; RenderTexture.ReleaseTemporary(target); UnityEngine.Object.DestroyImmediate(copy); }
        }
        static void Record(string kind, bool fixture)
        { Records.Add(new { kind, fixture, stage = _stage, role = _actor == null ? Roles[Math.Min(_role, Roles.Length - 1)] : _actor.Role, action = _actor?.CurrentAction, frame = _actor?.CurrentFrame, index = _actor?.FrameIndex, deathComplete = _actor?.DeathComplete, paused = _actor?.IsPaused, pace = CurrentUiPreferences.BattlePace, frameLimit = CurrentUiPreferences.FrameLimit, targetFrameRate = Application.targetFrameRate, seconds = EditorApplication.timeSinceStartup - _start }); Flush(); }
        static void Flush() => File.WriteAllText(Path.Combine(Output, "frames-trace.json"), JsonConvert.SerializeObject(new { records = Records, cues = Cues }, Formatting.Indented));
        static void Finish()
        {
            Require(Imported.Count == 264, "expected 264 unique imported source frames, actual " + Imported.Count);
            Require(RateIntervals.TryGetValue(30, out int at30) && at30 >= 4 && RateIntervals.TryGetValue(60, out int at60) && at60 >= 4, "continuous native sprite updates did not exercise both local caps");
            SessionState.SetBool(Active, false); BattleSession.ActorPresentation -= Cue;
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = true, scenario = "current-unit-frames-native", roles = Roles, imported = Imported.Count, trueCardCommandAtk = _trueAtk, trueEndTurnHurt = _trueHurt, presentationFixtures = true, osHardwareInput = false, referenceWidth = 1920, referenceHeight = 1080, dataDirectory = SaveSystem.Dir, localCapIntervals = RateIntervals, fasterLoopFrames = FasterLoopFrames, limitations = new[] { "120fps loop override is an isolated stress fixture; this does not validate the global render limit.", "Continuous cap samples exclude forced action-start paints. Faster-loop counts show whether local throttling had a real opportunity to run.", "Reference offscreen captures prove actor geometry and painting, not standalone display clarity." }, records = Records, cues = Cues }, Formatting.Indented)); EditorApplication.Exit(0);
        }
        static void Fail(Exception error)
        {
            SessionState.SetBool(Active, false); BattleSession.ActorPresentation -= Cue; Application.logMessageReceived -= Observe;
            File.WriteAllText(Path.Combine(Output, "failure.txt"), "role=" + _actor?.Role + " action=" + _actor?.CurrentAction + " frame=" + _actor?.CurrentFrame + " index=" + _actor?.FrameIndex + " stage=" + _stage + "\n" + error);
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = false, stage = _stage, role = _actor?.Role, action = _actor?.CurrentAction, frame = _actor?.CurrentFrame, error = error.ToString() }, Formatting.Indented)); EditorApplication.Exit(2);
        }
    }
    // Runtime sampling attached only by the Editor validation method; never included in a desktop player.
    public sealed class CurrentUnitPaintObserver : MonoBehaviour
    {
        void LateUpdate() => CurrentUnitFrameValidation.ObservePaint();
    }
}
