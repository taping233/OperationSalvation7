using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Hub;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Bag;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    /// <summary>单一后台参考环境的 uGUI 射线与事件派发探针；不模拟操作系统输入。</summary>
    [InitializeOnLoad]
    public static class BackgroundInputProbe
    {
        const string Active = "Sdt.BackgroundInput.Active";
        const string DiagnosticsOnly = "Sdt.BackgroundInput.DiagnosticsOnly";
        static int _step, _sampleClicks;
        static double _next, _started;
        static Camera _camera;
        static RenderTexture _target;
        static readonly List<object> Checks = new List<object>();
        static readonly List<string> Findings = new List<string>();
        static string _dragUid;
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static BackgroundInputProbe()
        { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        public static void Run() => Start(false);
        public static void RunDiagnostics() => Start(true);
        static void Start(bool diagnosticsOnly)
        {
            if (string.IsNullOrEmpty(Output)) throw new InvalidOperationException("缺少 SDT_UNITY_CHECK_OUTPUT 隔离证据目录");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-" + Guid.NewGuid().ToString("N")));
            AssetDatabase.DisallowAutoRefresh();
            SessionState.SetBool(DiagnosticsOnly, diagnosticsOnly);
            SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");
            EditorApplication.EnterPlaymode();
        }
        static void Observe(string message, string stack, LogType type)
        {
            if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception))
                Fail(new InvalidOperationException(message + "\n" + stack));
        }
        static void Require(bool value, string message)
        { if (!value) throw new InvalidOperationException(message); }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || EditorApplication.timeSinceStartup < _next) return;
            _next = EditorApplication.timeSinceStartup + .6;
            if (_started == 0) _started = EditorApplication.timeSinceStartup;
            try
            {
                Require(EditorApplication.timeSinceStartup - _started < 120, "后台输入探针超时");
                switch (_step)
                {
                    case 0:
                        if (App.Canvas == null || Sdt.View.BoardViewHost.BoardCamera == null) return;
                        ConfigureReference();
                        if (SessionState.GetBool(DiagnosticsOnly, false)) _step = 15;
                        break;
                    case 1:
                        Expect<TitleScreen>(1); Click(Named("ak-start")); break;
                    case 2:
                        Expect<SlotPickerScreen>(2);
                        var slot = UiStack.Top.transform.Find("slot-page/slot-deck/slot-card-5");
                        Require(slot != null, "第五档卡片不存在");
                        Click(Labelled("开新档 NEW GAME", slot)); break;
                    case 3:
                        Expect<HubScreen>(1); Click(Labelled("整备预设与追踪目标")); break;
                    case 4:
                        Expect<PreparationScreen>(2); Click(Labelled("返回基地")); break;
                    case 5:
                        Expect<HubScreen>(1); Click(Named("pg-close")); break;
                    case 6:
                        Expect<TitleScreen>(1); Click(Named("ak-start")); break;
                    case 7:
                        Expect<SlotPickerScreen>(2);
                        slot = UiStack.Top.transform.Find("slot-page/slot-deck/slot-card-5");
                        Click(Labelled("进入存档 ENTER", slot)); break;
                    case 8:
                        Expect<HubScreen>(1); Click(Labelled("整备预设与追踪目标")); break;
                    case 9:
                        Expect<PreparationScreen>(2); Click(Labelled("返回基地")); break;
                    case 10:
                        Expect<HubScreen>(1); Click(Named("pg-close")); break;
                    case 11:
                        Expect<TitleScreen>(1);
                        var sample = UiStack.Show<BackgroundInputSample>("InputProbeSample");
                        sample.Clicked = () => _sampleClicks++;
                        break;
                    case 12:
                        Expect<BackgroundInputSample>(2);
                        var panel = (BackgroundInputSample)UiStack.Top;
                        InspectIcons(panel.Target); Click(panel.Target); Require(_sampleClicks == 1, "初始图标按钮未收到单次点击");
                        panel.Target.GetComponentInChildren<Text>().text = "动态 [[icon:coin]] 123\n换行 [[icon:heart]] 48/50　[[icon:shield]] 8";
                        panel.Target.GetComponentInChildren<Text>().fontSize = 25;
                        break;
                    case 13:
                        panel = (BackgroundInputSample)UiStack.Top;
                        InspectIcons(panel.Target); Click(panel.Target); Require(_sampleClicks == 2, "动态换行后按钮点击次数异常");
                        UiStack.Pop(); break;
                    case 14:
                        Expect<TitleScreen>(1); Click(Named("ak-start")); break;
                    case 15:
                        Expect<SlotPickerScreen>(2); Click(Named("pg-close")); break;
                    case 16:
                        Expect<TitleScreen>(1);
                        InspectTitleCircles(); break;
                    case 17:
                        PrepareBag(); break;
                    case 18:
                        InspectAndDragSafe(); break;
                    case 19:
                        while (UiStack.Count > 0) UiStack.Pop();
                        GameRuntime.I.State.ownedCards.Single(o => o.uid == _dragUid).safe = false;
                        GameRuntime.I.SaveCurrent();
                        BagScreen.Open(); break;
                    case 20:
                        ClickCardAndClose(); break;
                    case 21:
                        bool reopened = UiStack.CapturePanels().Any(p => p is BagCardDetail);
                        Checks.Add(new { stage = _step, assertion = "delayed-card-detail-after-bag-close", reopened,
                            bagCurrent = BagScreen.Current != null, stack = UiStack.Names(), waitSeconds = .6 });
                        Soft(!reopened && BagScreen.Current == null, "单击卡牌同帧关闭背包后，延迟详情重新弹出");
                        while (UiStack.Count > 0) UiStack.Pop();
                        BagScreen.Open(); break;
                    case 22:
                        DragAndClose(); break;
                    case 23:
                        var ghosts = App.Canvas.GetComponentsInChildren<RectTransform>(true).Where(t => t.name == "bag-ghost").ToArray();
                        Checks.Add(new { stage = _step, assertion = "drag-ghost-after-bag-close", count = ghosts.Length,
                            paths = ghosts.Select(t => PathOf(t)).ToArray(), bagCurrent = BagScreen.Current != null, stack = UiStack.Names() });
                        Soft(ghosts.Length == 0 && BagScreen.Current == null, "拖拽卡牌期间关闭背包，浮影未清理");
                        Complete(); break;
                }
                _step++;
            }
            catch (Exception exception) { Fail(exception); }
        }
        static void ConfigureReference()
        {
            _camera = Sdt.View.BoardViewHost.BoardCamera;
            _target = new RenderTexture(1920, 1080, 24);
            _target.Create(); _camera.targetTexture = _target; _camera.aspect = 1920f / 1080;
            var canvas = App.Canvas;
            var scaler = canvas.GetComponent<CanvasScaler>(); if (scaler != null) scaler.enabled = false;
            canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = _camera;
            canvas.planeDistance = 1; canvas.scaleFactor = 1;
            canvas.overrideSorting = true; canvas.sortingOrder = 32767;
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            var rect = ((RectTransform)canvas.transform).rect;
            Require(Mathf.Abs(rect.width - 1920) < 2 && Mathf.Abs(rect.height - 1080) < 2, "后台参考画布尺寸不符 " + rect);
            Require(EventSystem.current != null, "正式 EventSystem 缺失");
        }
        static void Expect<T>(int count) where T : Panel
        {
            Require(UiStack.Top is T && UiStack.Count == count,
                "页面/叠层错误，期望 " + typeof(T).Name + " count=" + count + " 实际 " + UiStack.Names());
            var root = UiStack.Top.transform.parent;
            int masks = root.Cast<Transform>().Count(t => t.gameObject.activeInHierarchy && t.name == "mask");
            int pages = root.GetComponentsInChildren<Panel>().Length;
            Checks.Add(new { stage = _step, assertion = "page-and-mask-count", expected = count, actual = UiStack.Count, masks, pages, stack = UiStack.Names() });
            Require(masks == count && pages == count, "返回/重开后残留页面或遮罩");
            Flush();
        }
        static Button Named(string name) => UiStack.Top.GetComponentsInChildren<Button>().Single(b => b.name == name);
        static Button Labelled(string label, Transform root = null)
        {
            return (root != null ? root : UiStack.Top.transform).GetComponentsInChildren<Button>()
                .Single(b => b.GetComponentsInChildren<Text>().Any(t => t.text == label));
        }
        static Vector2 Point(RectTransform rect, Vector2 normalized)
        {
            var local = rect.rect.min + Vector2.Scale(rect.rect.size, normalized);
            return RectTransformUtility.WorldToScreenPoint(_camera, rect.TransformPoint(local));
        }
        static GameObject Hit(Button button, Vector2 position)
        {
            var data = new PointerEventData(EventSystem.current) { position = position, button = PointerEventData.InputButton.Left };
            var results = new List<RaycastResult>(); EventSystem.current.RaycastAll(data, results);
            var first = results.Count > 0 ? results[0].gameObject : null;
            var receiver = first != null ? ExecuteEvents.GetEventHandler<IPointerClickHandler>(first) : null;
            Checks.Add(new { stage = _step, assertion = "raycast-first-hit", button = PathOf(button.transform), position = new { position.x, position.y },
                first = first != null ? PathOf(first.transform) : null, receiver = receiver != null ? PathOf(receiver.transform) : null,
                hits = results.Take(8).Select(r => PathOf(r.gameObject.transform)).ToArray(), passed = receiver == button.gameObject });
            if (receiver != button.gameObject) InspectLayoutChain(button.transform);
            Flush(); Require(receiver == button.gameObject, "目标被遮挡/无命中 " + PathOf(button.transform));
            return first;
        }
        static void InspectLayoutChain(Transform target)
        {
            var chain = new List<object>();
            for (var current = target; current != null; current = current.parent)
            {
                var rect = current as RectTransform;
                if (rect == null) continue;
                var corners = new Vector3[4]; rect.GetWorldCorners(corners);
                var points = corners.Select(p => RectTransformUtility.WorldToScreenPoint(_camera, p)).ToArray();
                var anchor = rect.anchoredPosition; var size = rect.rect.size;
                var minimum = rect.anchorMin; var maximum = rect.anchorMax; var pivot = rect.pivot;
                chain.Add(new { path = PathOf(rect), anchor = new { anchor.x, anchor.y }, size = new { size.x, size.y },
                    anchorMin = new { minimum.x, minimum.y }, anchorMax = new { maximum.x, maximum.y }, pivot = new { pivot.x, pivot.y },
                    screen = new { minX = points.Min(p => p.x), minY = points.Min(p => p.y), maxX = points.Max(p => p.x), maxY = points.Max(p => p.y) },
                    drivenBy = rect.drivenByObject != null ? rect.drivenByObject.GetType().Name : null,
                    components = current.GetComponents<MonoBehaviour>().Where(c => c != null).Select(c => c.GetType().Name).ToArray() });
            }
            var viewport = _camera.pixelRect;
            Checks.Add(new { stage = _step, assertion = "failed-hit-layout-chain", chain, playTime = Time.time, deltaTime = Time.deltaTime,
                canvasMode = App.Canvas.renderMode.ToString(), canvasScale = App.Canvas.scaleFactor,
                camera = new { _camera.name, viewport.x, viewport.y, viewport.width, viewport.height, _camera.cullingMask },
                raycasters = App.Canvas.GetComponents<GraphicRaycaster>().Select(r => new { r.enabled,
                    eventCamera = r.eventCamera != null ? r.eventCamera.name : null }).ToArray() });
        }
        static string PathOf(Transform transform)
        {
            var names = new List<string>();
            while (transform != null) { names.Add(transform.name); transform = transform.parent; }
            names.Reverse(); return string.Join("/", names);
        }
        static void Click(Button button)
        {
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            Require(button != null && button.isActiveAndEnabled && button.IsInteractable(), "按钮不可交互");
            Require(button.targetGraphic != null && button.targetGraphic.raycastTarget, "按钮 targetGraphic 未接收射线 " + button.name);
            var point = Point((RectTransform)button.transform, new Vector2(.5f, .5f));
            var hit = Hit(button, point);
            var data = new PointerEventData(EventSystem.current) { position = point, pressPosition = point,
                button = PointerEventData.InputButton.Left, eligibleForClick = true, clickCount = 1 };
            var down = ExecuteEvents.ExecuteHierarchy(hit, data, ExecuteEvents.pointerDownHandler);
            data.pointerPress = down; data.rawPointerPress = hit;
            ExecuteEvents.Execute(down, data, ExecuteEvents.pointerUpHandler);
            var click = ExecuteEvents.GetEventHandler<IPointerClickHandler>(hit);
            Require(down == button.gameObject && click == down, "按下/点击处理器不一致");
            ExecuteEvents.Execute(click, data, ExecuteEvents.pointerClickHandler);
        }
        static void InspectIcons(Button button)
        {
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            var text = button.GetComponentInChildren<InlineIconText>();
            Require(text != null && !text.raycastTarget, "按钮装饰文本拦截射线");
            var images = text.GetComponentsInChildren<Image>().Where(i => i.isActiveAndEnabled).ToArray();
            Require(images.Length == text.RenderedIconCount && images.Length > 0, "图标实例数与文本不一致");
            foreach (var image in images)
            {
                Require(!image.raycastTarget, "图标装饰拦截射线");
                Hit(button, Point(image.rectTransform, new Vector2(.5f, .5f)));
            }
            foreach (var point in new[] { new Vector2(.1f, .2f), new Vector2(.9f, .8f) })
                Hit(button, Point((RectTransform)button.transform, point));
        }
        static void Flush() => File.WriteAllText(Path.Combine(Output, "checks.json"), JsonConvert.SerializeObject(Checks, Formatting.Indented));
        static void Soft(bool passed, string message)
        { if (!passed) Findings.Add(message); Flush(); }
        static GameObject Trace(Vector2 position, string assertion)
        {
            var data = new PointerEventData(EventSystem.current) { position = position };
            var results = new List<RaycastResult>(); EventSystem.current.RaycastAll(data, results);
            Checks.Add(new { stage = _step, assertion, position = new { position.x, position.y },
                hits = results.Take(8).Select(r => PathOf(r.gameObject.transform)).ToArray() });
            Flush(); return results.Count > 0 ? results[0].gameObject : null;
        }
        static void InspectTitleCircles()
        {
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            foreach (var name in new[] { "mAch", "btnCardLib", "mSettings" })
            {
                var button = Named(name);
                var targets = new List<RectTransform> { button.targetGraphic.rectTransform };
                targets.AddRange(button.GetComponentsInChildren<Text>().Where(t => t.transform.parent == button.transform).Select(t => t.rectTransform));
                foreach (var rect in targets)
                {
                    var hit = Trace(Point(rect, new Vector2(.5f, .5f)), "title-circle-label-center " + name + " " + rect.name);
                    var receiver = hit != null ? ExecuteEvents.GetEventHandler<IPointerClickHandler>(hit) : null;
                    bool passed = receiver == button.gameObject;
                    Checks.Add(new { stage = _step, assertion = "title-circle-handler", name, label = rect.GetComponent<Text>()?.text,
                        expected = PathOf(button.transform), actual = receiver != null ? PathOf(receiver.transform) : null, passed });
                    Soft(passed, "标题入口 " + name + " 的 " + (rect.GetComponent<Text>()?.text ?? "圆环") + " 中心未命中其Button");
                }
            }
        }
        static void PrepareBag()
        {
            while (UiStack.Count > 0) UiStack.Pop();
            var game = GameRuntime.I;
            game.NewRun(5, CharacterTable.All[0].id);
            for (int i = 0; i < game.GetEntrySupplyCards().Count; i++) game.ClaimEntrySupply(i, out _);
            while (UiStack.Count > 0) UiStack.Pop();
            game.State.Phase = "idle";
            game.State.inventory.Clear(); game.State.ownedCards.Clear();
            _dragUid = "input-probe-" + Guid.NewGuid().ToString("N");
            var card = CardLibrary.FindById("tt3-fireball"); Require(card != null, "普通卡测试夹具缺失");
            game.State.ownedCards.Add(new OwnedCard { uid = _dragUid, card = card, safe = false });
            game.SaveCurrent(); BagScreen.Open();
        }
        static void InspectAndDragSafe()
        {
            Require(UiStack.Top is BagScreen, "新Run未进入正式背包");
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            var bag = (BagScreen)UiStack.Top;
            var empty = bag.GetComponentsInChildren<RectTransform>().FirstOrDefault(t => t.name == "safe-slot.empty");
            Require(empty != null, "新档空安全格缺失");
            var to = Point(empty, new Vector2(.5f, .5f));
            var target = Trace(to, "empty-safe-slot-center");
            var zone = target != null ? target.GetComponentInParent<DropZone>() : null;
            bool validZone = zone != null && zone.kind == DropZoneKind.Safe;
            Checks.Add(new { stage = _step, assertion = "empty-safe-slot-drop-zone-ancestor", passed = validZone,
                slot = PathOf(empty), first = target != null ? PathOf(target.transform) : null,
                ancestor = zone != null ? PathOf(zone.transform) : null, kind = zone?.kind.ToString() });
            Soft(validZone, "空安全格中心射线祖先未带Safe DropZone");
            var cell = bag.GetComponentsInChildren<BagCell>().Single();
            var from = Point((RectTransform)cell.transform, new Vector2(.5f, .5f));
            var source = Trace(from, "ordinary-card-drag-source");
            var press = source != null ? ExecuteEvents.GetEventHandler<IPointerDownHandler>(source) : null;
            Soft(press == cell.gameObject, "普通卡中心射线未命中BagCell，跳过射线拖拽");
            if (press != cell.gameObject) return;
            BagCell.BagCellHover.Current = null; DropZoneHover.Current = null;
            var data = new PointerEventData(EventSystem.current) { position = from, pressPosition = from,
                button = PointerEventData.InputButton.Left, pointerPress = press, rawPointerPress = source };
            ExecuteEvents.Execute(press, data, ExecuteEvents.pointerDownHandler);
            data.position = to; ExecuteEvents.Execute(press, data, ExecuteEvents.dragHandler);
            target = Trace(to, "empty-safe-slot-during-drag");
            for (var ancestor = target != null ? target.transform : null; ancestor != null; ancestor = ancestor.parent)
                ExecuteEvents.Execute(ancestor.gameObject, data, ExecuteEvents.pointerEnterHandler);
            var hover = DropZoneHover.Current;
            ExecuteEvents.Execute(press, data, ExecuteEvents.pointerUpHandler);
            bool moved = GameRuntime.I.State.ownedCards.Single(o => o.uid == _dragUid).safe == true;
            bool discard = UiStack.CapturePanels().Any(p => p.name == "DiscardConfirm");
            Checks.Add(new { stage = _step, assertion = "formal-card-drag-to-empty-safe-slot", hover = hover?.ToString(), moved, discard, stack = UiStack.Names() });
            Soft(moved && !discard, "普通卡拖至空安全格未转入安全格或错误弹出丢弃确认");
        }
        static void ClickCardAndClose()
        {
            Require(UiStack.Top is BagScreen, "详情延迟夹具未打开背包");
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            var bag = (BagScreen)UiStack.Top;
            var cell = bag.GetComponentsInChildren<BagCell>().Single();
            var position = Point((RectTransform)cell.transform, new Vector2(.5f, .5f));
            var hit = Trace(position, "delayed-detail-card-source");
            var receiver = hit != null ? ExecuteEvents.GetEventHandler<IPointerClickHandler>(hit) : null;
            bool hitCard = receiver == cell.gameObject;
            Soft(hitCard, "卡牌中心射线未命中BagCell；延迟生命周期另以正式处理器构造事件诊断");
            // A separate lifecycle diagnostic remains reproducible if unrelated raycast geometry is broken.
            var data = new PointerEventData(EventSystem.current) { position = position, button = PointerEventData.InputButton.Left, clickCount = 1 };
            ExecuteEvents.Execute(cell.gameObject, data, ExecuteEvents.pointerDownHandler);
            ExecuteEvents.Execute(cell.gameObject, data, ExecuteEvents.pointerUpHandler);
            ExecuteEvents.Execute(cell.gameObject, data, ExecuteEvents.pointerClickHandler);
            bag.CloseBag();
            Checks.Add(new { stage = _step, assertion = "single-click-and-close-same-tick", raycastReachedCard = hitCard, stack = UiStack.Names() });
            Flush();
        }
        static void DragAndClose()
        {
            Require(UiStack.Top is BagScreen, "拖拽关闭夹具未打开背包");
            Canvas.ForceUpdateCanvases(); Canvas.ForceUpdateCanvases();
            var bag = (BagScreen)UiStack.Top;
            var cell = bag.GetComponentsInChildren<BagCell>().Single();
            var position = Point((RectTransform)cell.transform, new Vector2(.5f, .5f));
            var hit = Trace(position, "drag-and-close-card-source");
            var receiver = hit != null ? ExecuteEvents.GetEventHandler<IPointerDownHandler>(hit) : null;
            bool hitCard = receiver == cell.gameObject;
            Soft(hitCard, "拖拽关闭夹具的卡牌中心射线未命中BagCell");
            var data = new PointerEventData(EventSystem.current) { position = position, pressPosition = position,
                button = PointerEventData.InputButton.Left, pointerPress = cell.gameObject, rawPointerPress = hit };
            ExecuteEvents.Execute(cell.gameObject, data, ExecuteEvents.pointerDownHandler);
            data.position += new Vector2(24, 20);
            ExecuteEvents.Execute(cell.gameObject, data, ExecuteEvents.dragHandler);
            int beforeClose = App.Canvas.GetComponentsInChildren<RectTransform>(true).Count(t => t.name == "bag-ghost");
            Require(beforeClose == 1, "拖拽未生成唯一浮影，关闭诊断无效");
            bag.CloseBag();
            Checks.Add(new { stage = _step, assertion = "close-bag-during-drag", raycastReachedCard = hitCard, beforeClose, stack = UiStack.Names() });
            Flush();
        }
        static void Complete()
        {
            SessionState.SetBool(Active, false); Flush();
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = Findings.Count == 0, findings = Findings,
                input = "background-native-ugui-raycast-and-execute-events", operatingSystemInput = false, width = 1920, height = 1080,
                stage = _step, checks = Checks.Count, sampleClicks = _sampleClicks, dataDirectory = SaveSystem.Dir }, Formatting.Indented));
            EditorApplication.Exit(Findings.Count == 0 ? 0 : 2);
        }
        static void Fail(Exception exception)
        {
            SessionState.SetBool(Active, false); Directory.CreateDirectory(Output); Flush();
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = false, stage = _step,
                input = "background-native-ugui-raycast-and-execute-events", stack = UiStack.Names(), findings = Findings, error = exception.ToString() }, Formatting.Indented));
            Debug.LogException(exception); EditorApplication.Exit(2);
        }
    }

    public sealed class BackgroundInputSample : Panel
    {
        public Button Target;
        public Action Clicked;
        public override void Build()
        {
            Target = UIKit.BtnOk(transform, "[[icon:save]] 保存　[[icon:bag]] 背包 16/30", () => Clicked?.Invoke());
            var rect = (RectTransform)Target.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(.5f, .5f);
            rect.anchoredPosition = Vector2.zero; rect.sizeDelta = new Vector2(620, 120);
        }
    }
}
