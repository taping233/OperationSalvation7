// ported from src/game.boot.js（初始化 + bindInput 键盘分发）+ src/main.js（组装根，由 GameBoot 调 Launch）
// 职责（协调者补充 1/2）：
//   Launch() 建根 Canvas（Screen Space Overlay + CanvasScaler 1920×1080）+ EventSystem、
//   BoardViewHost.Attach、UiStack/Tooltip/AudioService/GameRuntime 预热、ShowTitle；
//   RegisterKey/UnregisterKey 全局键分发（App.Update 统一轮询）：Q/E 旋转、G 全景、
//   F 定位、B 背包、N 编号、Esc 关闭当前页；全局右键 → 留言信箱（game.menu.js contextmenu）。
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.View;

using Sdt.UI.Screens.Menu;
namespace Sdt.UI.Kit
{
    public static class App
    {
        public static Canvas Canvas { get; private set; }
        public static Transform UiRoot => Canvas != null ? Canvas.transform : null;

        // W7 挂接点：标题页「制作坊 / 收藏图鉴」入口（Screens/Misc 落位后赋值；null 时点击无操作）
        public static Action OpenCardDesigner;
        public static Action OpenCardLib;
        public static bool CardEditingEnabled => false;

        // 键注册表（W7/W9 的屏在 Build() 注册、Close() 注销）
        static readonly Dictionary<KeyCode, Action> _keys = new Dictionary<KeyCode, Action>();
        static readonly Dictionary<KeyCode, Panel> _keyOwners = new Dictionary<KeyCode, Panel>();
        public static void RegisterKey(KeyCode k, Action h) { _keys[k] = h; _keyOwners[k] = UiStack.Top; }
        public static void UnregisterKey(KeyCode k) { _keys.Remove(k); _keyOwners.Remove(k); }
        static bool OwnsKey(KeyCode key) => !_keyOwners.TryGetValue(key, out var owner) || owner == null || owner == UiStack.Top;

        /// <summary>组装入口（GameBoot.Awake 调；幂等）。</summary>
        public static void Launch()
        {
            if (Canvas != null) return;

            // 根 Canvas：Screen Space Overlay + 1920×1080（03 报告 §6）
            var go = new GameObject("Sdt.UI", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            UnityEngine.Object.DontDestroyOnLoad(go);
            Canvas = go.GetComponent<Canvas>();
            Canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;

            // EventSystem（不存在时建）
            if (EventSystem.current == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
                UnityEngine.Object.DontDestroyOnLoad(es);
            }

            // 地图相机/棋盘（W5）
            BoardViewHost.Attach(go.transform);

            // UI 栈根 + 顶层层
            var stackRoot = new GameObject("Stack", typeof(RectTransform));
            stackRoot.transform.SetParent(go.transform, false);
            UiStack.Stretch(stackRoot.GetComponent<RectTransform>());
            UiStack.Init(stackRoot.transform);
            Tooltip.Init(go.transform);

            // GameRuntime / AudioService 预热
            _ = GameRuntime.I;
            _ = GameRuntime.I.Base;
            Sdt.Res.Res.SelectedSkin = id => GameRuntime.I.Base.SelectedSkin(id);
            OpenCardLib = Sdt.UI.Screens.Misc.CardLibraryScreen.Open;
            _ = AudioService.I;
            GameRuntime.I.BuildDerived();

            // 输入轮询驱动器（Update 每帧轮询键注册表与右键）
            var driver = new GameObject("Sdt.AppDriver");
            UnityEngine.Object.DontDestroyOnLoad(driver);
            driver.AddComponent<AppDriver>();

            // 全局事件桥：对局内日志/提示 → 控制台（UI 面板版日志由 W7 提供）
            GameRuntime.I.Bus.On<ToastRequested>(t => Debug.Log("[sdt] " + StripIcons(t.Text)));
            DesktopRunHud.Install();
            GameRuntime.I.Bus.On<ExtractStashChanged>(message => Sdt.UI.Screens.Run.ExtractStashScreen.Present(message.Result));

            ShowTitle();
        }

        /// <summary>回标题（showTitle）：清栈 → GameRuntime.ShowTitle → 压标题屏。</summary>
        public static void ShowTitle()
        {
            while (UiStack.Count > 0) UiStack.Pop();
            SuggestionBox.CloseIfOpen();
            GameRuntime.I.ShowTitle();
            UiStack.Show<Screens.Menu.TitleScreen>("Title");
        }

        // ============================================================
        // 每帧轮询（挂在 Launch 建的驱动器上；App 不是 MonoBehaviour，用内部代理组件）
        // ============================================================
        class AppDriver : MonoBehaviour
        {
            void Update()
            {
                PollKeys();
                PollRightClick();
            }

            // [diag] 点击链诊断（临时）：左键按下时打 EventSystem 状态与 raycast 命中栈
            static void DiagClick()
            {
                if (!Input.GetMouseButtonDown(0)) return;
                var es = EventSystem.current;
                if (es == null) { Debug.Log("[diag] click es=NULL"); return; }
                var pe = new PointerEventData(es) { position = Input.mousePosition };
                var hits = new System.Collections.Generic.List<RaycastResult>();
                es.RaycastAll(pe, hits);
                Debug.Log("[diag] click pos=" + Input.mousePosition + " module=" +
                          (es.currentInputModule != null ? es.currentInputModule.GetType().Name : "NULL") +
                          " hits=" + hits.Count + (hits.Count > 0 ? " top=" + hits[0].gameObject.name : ""));
                foreach (var r in hits) Debug.Log("[diag]   hit " + r.gameObject.name);
            }

            static readonly KeyCode[] _polled =
            {
                KeyCode.Space, KeyCode.Return, KeyCode.Q, KeyCode.E, KeyCode.G, KeyCode.F,
                KeyCode.B, KeyCode.N, KeyCode.Escape,
            };

            public static void PollKeys()
            {
                // Esc：关闭当前页（栈优先；留言层独立处理）
                if (Input.GetKeyDown(KeyCode.Escape))
                {
                    if (SuggestionBox.IsOpen) { SuggestionBox.CloseIfOpen(); return; }
                    if (_keys.TryGetValue(KeyCode.Escape, out var close) && OwnsKey(KeyCode.Escape)) { close(); return; }
                    if (UiStack.Blocked) { if (UiStack.Top.CanCloseWithEscape) UiStack.Top.CloseFromEscape(); return; }
                }
                var g = GameRuntime.I;
                bool runActive = g.State.runActive && !UiStack.Blocked;
                // 注册表键（W7/W9 屏注册的优先；屏内注册时同样受 Blocked 保护——屏本身在栈内）
                foreach (var k in _polled)
                {
                    if (k == KeyCode.Escape) continue;
                    if (!Input.GetKeyDown(k)) continue;
                    if (_keys.TryGetValue(k, out var h) && OwnsKey(k)) { h(); continue; }
                    if (!runActive) continue;
                    switch (k)
                    {
                        case KeyCode.Q: BoardViewHost.SetRotation(3); break;   // 左旋转
                        case KeyCode.E: BoardViewHost.SetRotation(1); break;   // 右旋转
                        case KeyCode.G: BoardViewHost.FitAll(); break;         // 全景
                        case KeyCode.F: BoardViewHost.FitPlayer(); break;      // 定位
                        case KeyCode.B: g.Bus.Emit(new BagOpened()); break;    // 背包（W7 接）
                        case KeyCode.N:                                   // 结点编号开关
                            g.State.togglesIndex = !g.State.togglesIndex;
                            BoardViewHost.SetNodeLabelsVisible(g.State.togglesIndex);
                            break;
                    }
                }
            }

            static void PollRightClick()
            {
                if (!Input.GetMouseButtonDown(1)) return;
                if (EventSystem.current != null && EventSystem.current.IsPointerOverGameObject()) { /* UI 上右键同样弹留言（原版 document 级） */ }
                Screens.Menu.SuggestionBox.OpenForCurrentScreen();
            }
        }

        /// <summary>剥掉 [[icon:x]] 标记（日志/无富文本场合）。</summary>
        public static string StripIcons(string sdtText) =>
            string.IsNullOrEmpty(sdtText) ? sdtText : System.Text.RegularExpressions.Regex.Replace(sdtText, @"\[\[icon:[a-z0-9\-]+\]\]", "");
    }
}
