using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Hub;
using Sdt.UI.Screens.Run;
using Sdt.UI.Screens.Misc;
using Sdt.UI.Screens.Bag;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    /// <summary>Current production pages, isolated profiles, constructed uGUI input. Never claims OS hardware input.</summary>
    [InitializeOnLoad]
    public static partial class CurrentMigrationFlowValidation
    {
        const string Active = "Sdt.CurrentFlow.Active", Mode = "Sdt.CurrentFlow.Mode";
        static int _step, _ticks, _navigation;
        static bool _baseReturnChecked;
        static double _next, _start;
        static Camera _camera;
        static RenderTexture _target;
        static FileStream _locked;
        static string _before, _uid, _photo;
        static int _shotStep = -1, _shotFrame;
        static string _shotName;
        static Panel _shotOwner;
        static readonly List<object> Records = new List<object>();
        static readonly string[] Destinations = { "classes", "stash", "shop", "ach", "upgrade", "courtyard", "deploy" };
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static string Scenario => SessionState.GetString(Mode, "entry");
        static CurrentMigrationFlowValidation() { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        public static void Run() => Start("entry");
        public static void RunJourney() => Start("journey");
        public static void RunReceipts() => Start("receipts");
        public static void RunRewardTransition() => Start("rewardTransition");
        static void Start(string mode)
        {
            if (string.IsNullOrWhiteSpace(Output)) throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT is required");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-" + mode + "-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            if(mode=="rewardTransition")PrepareRewardTransitionProfile();
            AssetDatabase.DisallowAutoRefresh(); SessionState.SetString(Mode, mode); SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Observe(string message, string stack, LogType type)
        {
            if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception))
                Fail(new InvalidOperationException(message + "\n" + stack));
        }
        static void Require(bool ok, string message) { if (!ok) throw new InvalidOperationException(message); }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || EditorApplication.timeSinceStartup < _next) return;
            _next = EditorApplication.timeSinceStartup + (Scenario == "journey" || Scenario=="rewardTransition" ? .22 : .65);
            if (_start == 0) _start = EditorApplication.timeSinceStartup;
            try
            {
                Require(EditorApplication.timeSinceStartup - _start < (Scenario == "journey" ? 310 : 180), "scenario timeout at step " + _step);
                Require(++_ticks < 1600, "action budget exceeded");
                if (App.Canvas == null) return;
                if (AwaitSourceCurtain()) return;
                if (_camera == null) { Configure(); return; }
                if (UiStack.Top is TitleScreen && !TitleReady()) return;
                // Reward geometry and the retained HUD are updated by real Update/LateUpdate before input or page shots.
                if (!RewardPageReady()) return;
                Record("tick", new { stack = UiStack.Names(), phase = GameRuntime.I.State.Phase });
                if (Scenario == "entry") Entry(); else if (Scenario == "journey") Journey(); else if(Scenario=="rewardTransition")RewardTransition();else Receipts();
            }
            catch (Exception error) { Fail(error); }
        }
        static void Configure()
        {
            OffscreenCapture.PrepareReference();
            _camera = Sdt.View.BoardViewHost.BoardCamera; Require(_camera != null, "native board camera missing");
            _target = _camera.targetTexture;
            var canvas = App.Canvas; var scaler = canvas.GetComponent<CanvasScaler>(); if (scaler != null) scaler.enabled = false;
            canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = _camera; canvas.planeDistance = 1; canvas.scaleFactor = 1;
            canvas.overrideSorting = true; canvas.sortingOrder = 32767; Canvas.ForceUpdateCanvases();
            var rect = ((RectTransform)canvas.transform).rect;
            Require(Math.Abs(rect.width - 1920) < 2 && Math.Abs(rect.height - 1080) < 2, "reference canvas differs: " + rect);
            Require(EventSystem.current != null, "production EventSystem missing");
            Require(Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(Output), StringComparison.OrdinalIgnoreCase), "profile escaped evidence directory");
            if (Scenario == "journey") Sdt.Core.Battle.BattleSession.BattleEnded += ObserveJourneyBattleEnd;
            Clear(); App.ShowTitle();
        }
        static void Entry()
        {
            var g = GameRuntime.I;
            switch (_step)
            {
                case 0: Expect<TitleScreen>(); Shot("title"); Click("mSettings"); Next(); break;
                case 1: Expect<SettingsScreen>(); Click("settings-tab-1"); Next(); break;
                case 2: Click("settings-tab-2"); Next(); break;
                case 3: Click("settings-tab-3"); Next(); break;
                case 4: Shot("settings-input"); Click("rebind-roll"); Next(); break;
                case 5:
                    Require(CurrentInputBindings.SuppressGameplayInput, "rebind did not capture input");
                    Require(CurrentInputBindings.CaptureKey(KeyCode.F8), "constructed F8 capture rejected");
                    Require(CurrentInputBindings.ActionFor("f8") == "roll" && CurrentInputBindings.ActionFor("f8", ctrl: true) == null, "saved action resolution/modifier gate failed");
                    Require(new SaveSystem().Global.GetJson("sdt-keybinds")["roll"].ToObject<string[]>().Single() == "f8", "fresh profile did not reload mapping");
                    Require(!CurrentInputBindings.SuppressGameplayInput, "capture leaked after save");
                    Click("closeSettings"); Next(); break;
                case 6: Expect<TitleScreen>(); Require(g.ActiveSlot == null, "title unexpectedly owns slot"); Click("btnCardLib"); Next(); break;
                case 7:
                    var photo = Buttons().First(b => b.name.StartsWith("Photo-", StringComparison.Ordinal)); _photo = photo.name.Substring(6); Click(photo.gameObject); Next(); break;
                case 8:
                    Expect<PhotoDetailScreen>(); Shot("photo-no-slot"); Lock(); Note("current-native-note");
                    Require(TextNamed("PhotoNoteStatus").Contains("未存档"), "locked photo note not retained as pending"); Unlock(); Click("PhotoClose"); Next(); break;
                case 9: Click("libInspect"); Next(); break;
                case 10:
                    Require(UiStack.Top.GetComponentsInChildren<InputField>().Single(f => f.name == "PhotoNote").text == "current-native-note", "photo reopen lost pending note");
                    Note("current-native-note"); Require(new SaveSystem().Global.GetJson("sdt-card-photo-notes-v1")[_photo].ToString() == "current-native-note", "no-slot note retry not persisted");
                    Click("PhotoClose"); Next(); break;
                case 11: UiStack.Top.CloseFromEscape(); Next(); break;
                case 12: Expect<TitleScreen>(); Click("mStart"); Next(); break;
                case 13: Expect<SlotPickerScreen>(); Shot("slots"); Click("slot-enter-5"); Next(); break;
                case 14:
                    Expect<HubScreen>(); Require(g.ActiveSlot == 5 && !g.State.runActive, "new slot prematurely started run");
                    if (!_baseReturnChecked) { _baseReturnChecked = true; UiStack.Top.CloseFromEscape(); _step = 140; break; }
                    if (_navigation < Destinations.Length) { Click("hub-tab " + Destinations[_navigation++]); break; }
                    Shot("base"); ClickLabel("出征整备"); Next(); break;
                case 15: Expect<ClassChoiceScreen>(); Require(!g.State.runActive, "character page starts run"); Shot("character"); Click("pickClass"); Next(); break;
                case 16:
                    Expect<DepartPrepScreen>(); Require(DepartPrepScreen.HasDraft && !g.State.runActive, "draft absent or premature run");
                    Shot("departure"); Lock(); Click("btnDeploy"); Next(); break;
                case 17:
                    if (!(UiStack.Top is DepartPrepScreen)) return;
                    Require(!g.State.runActive && DepartPrepScreen.HasDraft && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed departure lost draft or wrote profile");
                    Shot("departure-save-failed"); Unlock(); Click("btnDeploy"); Next(); break;
                case 18:
                    if (!(UiStack.Top is EntrySupplyScreen)) return;
                    Require(g.State.runActive && new SaveSystem().ReadSlot(5) != null, "departure retry did not persist run"); Shot("entry-supply"); Next(); break;
                case 19:
                    if (!g.EntrySupplyComplete) { ClickReward(); break; }
                    Click("继续探索"); Next(); break;
                case 20:
                    Require(g.State.Phase == "idle", "entry supply did not release map");
                    var card = CardLibrary.All().First(c => c.rarity != "职业" && !BaseData.IsSha(c) && c.id != "starter-attack" && !g.State.ownedCards.Any(o => o.card.id == c.id));
                    Require(g.GrantCard(card), "fixture card did not fit"); _uid = g.State.ownedCards.Last(o => o.card.id == card.id).uid;
                    g.SaveCurrent(); BagScreen.Open(); Next(); break;
                case 21: Expect<BagScreen>(); Shot("bag"); Click(Cell(_uid).gameObject); Next(); break;
                case 22: Expect<BagCardDetail>(); Lock(); Click("zoomMoveToSafe"); Next(); break;
                case 23:
                    Require(g.State.ownedCards.Single(o => o.uid == _uid).safe != true && File.ReadAllText(SaveSystem.ProfilePath) == _before, "failed bag move changed original");
                    Unlock(); Click(Cell(_uid).gameObject); Next(); break;
                case 24: Click("zoomMoveToSafe"); Next(); break;
                case 25:
                    Require(g.State.ownedCards.Single(o => o.uid == _uid).safe == true && new SaveSystem().ReadSlot(5).ownedCards.Single(o => o.uid == _uid).safe == true, "safe move failed persistence");
                    BagScreen.Current.SelectZone("safe"); Shot("bag-safe"); Next(); break;
                case 26: BagScreen.Current.SelectZone("pocket"); Shot("bag-pocket"); BagScreen.Current.CloseBag(); LeaveMenuScreen.Open(); Next(); break;
                case 27: Click("leaveSave"); Next(); break;
                case 28: Expect<TitleScreen>(); Click("mStart"); Next(); break;
                case 29: Expect<SlotPickerScreen>(); Click("slot-enter-5"); Next(); break;
                case 30:
                    Require(g.State.runActive && g.State.ownedCards.Single(o => o.uid == _uid).safe == true, "slot resume lost safe card");
                    Require(CurrentInputBindings.ActionFor("f8") == "roll", "mapping lost across page reopen"); Shot("resumed-map"); Finish(); break;
                case 140: Expect<SlotPickerScreen>(); Click("slot-enter-5"); _step = 14; break;
            }
        }
        static void Next() { _step++; }
        static void Note(string text)
        {
            var field = UiStack.Top.GetComponentsInChildren<InputField>().Single(f => f.name == "PhotoNote");
            field.text = text; field.onEndEdit.Invoke(text); Record("constructed-inputfield-end-edit", new { field = field.name, text });
        }
        static string TextNamed(string name) => UiStack.Top.GetComponentsInChildren<Text>().Single(t => t.name == name).text;
        static BagCell Cell(string uid) => UiStack.Top.GetComponentsInChildren<BagCell>().First(c => c.Entry.uids.Contains(uid));
        static IEnumerable<Button> Buttons() => UiStack.Top.GetComponentsInChildren<Button>().Where(b => b.isActiveAndEnabled && b.IsInteractable());
        static Button Named(string name) => Buttons().First(b => b.name == name);
        static void Click(string name) => Click(Named(name).gameObject);
        static void ClickLabel(string label) => Click(Buttons().First(b => b.GetComponentsInChildren<Text>().Any(t => t.text == label)).gameObject);
        static void ClickReward()
        { ClaimCurrentVisibleReward(); }
        static void Click(GameObject target)
        {
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            var point = RectTransformUtility.WorldToScreenPoint(_camera, ((RectTransform)target.transform).TransformPoint(((RectTransform)target.transform).rect.center));
            var data = new PointerEventData(EventSystem.current) { position = point, pressPosition = point, button = PointerEventData.InputButton.Left, eligibleForClick = true, clickCount = 1 };
            var hits = new List<RaycastResult>(); EventSystem.current.RaycastAll(data, hits);
            var first = hits.FirstOrDefault().gameObject;
            var receiver = first == null ? null : ExecuteEvents.GetEventHandler<IPointerClickHandler>(first);
            Record("ugui-raycast", new { target = target.name, x = point.x, y = point.y, first = first == null ? null : first.name, receiver = receiver == null ? null : receiver.name, hits = hits.Take(8).Select(h => h.gameObject.name).ToArray() });
            Require(receiver == target, "raycast blocked target " + target.name);
            var down = ExecuteEvents.ExecuteHierarchy(first, data, ExecuteEvents.pointerDownHandler);
            data.pointerPress = down; data.rawPointerPress = first;
            ExecuteEvents.Execute(down, data, ExecuteEvents.pointerUpHandler);
            Require(down == target, "pointer down receiver differs: " + target.name);
            ExecuteEvents.Execute(receiver, data, ExecuteEvents.pointerClickHandler);
        }
        static void Expect<T>() where T : Panel { Require(UiStack.Top is T, "expected " + typeof(T).Name + " got " + UiStack.Names()); }
        static void Clear() { while (UiStack.Count > 0) UiStack.Pop(); }
        static void Lock() { _before = File.ReadAllText(SaveSystem.ProfilePath); _locked = new FileStream(SaveSystem.ProfilePath, FileMode.Open, FileAccess.Read, FileShare.Read); }
        static void Unlock() { _locked?.Dispose(); _locked = null; }
        static void Shot(string name) { Record("capture", new { name, capture = OffscreenCapture.Write(Path.Combine(Output, Scenario + "-" + name + ".png")) }); }
        static bool ShotReady(string name)
        {
            var owner = UiStack.Top;
            if (_shotStep != _step || _shotName != name || !ReferenceEquals(_shotOwner, owner))
            {
                Shot(name); _shotStep = _step; _shotName = name; _shotOwner = owner; _shotFrame = Time.frameCount;
                Record("wait-after-capture-frame", new { name, frame = _shotFrame }); return false;
            }
            // Capture restores the live camera projection; allow one complete native frame before input.
            if (Time.frameCount < _shotFrame + 2) return false;
            Record("after-capture-frame-ready", new { name, capturedFrame = _shotFrame, frame = Time.frameCount }); return true;
        }
        static void Record(string kind, object detail)
        {
            Records.Add(new { step = _step, tick = _ticks, kind, detail });
            File.WriteAllText(Path.Combine(Output, Scenario + "-trace.json"), JsonConvert.SerializeObject(Records, Formatting.Indented));
        }
        static void Finish()
        {
            Sdt.Core.Battle.BattleSession.BattleEnded -= ObserveJourneyBattleEnd;
            Unlock(); SessionState.SetBool(Active, false);
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = true, scenario = Scenario, input = "constructed-uGUI-RaycastAll-and-ExecuteEvents; constructed-InputField-endEdit; runtime-commands-where-recorded", osHardwareInput = false, referenceWidth = 1920, referenceHeight = 1080, dataDirectory = SaveSystem.Dir, ticks = _ticks, records = Records, limitations = new[] { "Controlled fixtures prove flow and persistence, not balance or original RNG equivalence.", "Hidden batch does not prove physical Input.GetKeyDown or sustained mouse/keyboard hold.", "CurrentEndTurnHold requires focus and hardware-held input; no 650ms success claim." } }, Formatting.Indented));
            EditorApplication.Exit(0);
        }
        static void Fail(Exception error)
        {
            Sdt.Core.Battle.BattleSession.BattleEnded -= ObserveJourneyBattleEnd;
            SessionState.SetBool(Active, false); Application.logMessageReceived -= Observe; Unlock();
            Directory.CreateDirectory(Output);
            File.WriteAllText(Path.Combine(Output, "failure.txt"), "scenario=" + Scenario + " step=" + _step + " stack=" + UiStack.Names() + "\n" + error);
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = false, scenario = Scenario, step = _step, error = error.ToString(), stack = UiStack.Names(), dataDirectory = SaveSystem.Dir }, Formatting.Indented));
            EditorApplication.Exit(2);
        }
    }
}
