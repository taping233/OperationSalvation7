// ported from src/game.run.js openPickupPage()
//
// 原界面 DOM 结构 → uGUI 控件树映射（nodeShell 'pickup' 变体）：
//   nodeShell(tone=pickup, asset=PICKUP_BG[kind], icon, title=f.title)
//     span.sub = pick(f.lines)        → 右侧面板副标题
//     .node-main > p.gain-big        → 大字收益 Label（金色，居中）
//     .node-main > button.evt-opt.ok → 「继 续」EventOptButton
//   data-act=pickupGo → 点击后关闭并回调 onDone
using System;
using UnityEngine;
using UnityEngine.UI;

using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public class PickupScreen : NodeShellPanel
    {
        string _kind; string _gain; Action _onDone;

        // PICKUP_BG（game.run.data.js）
        static string PickupBg(string kind)
        {
            switch (kind)
            {
                case "coin": return "scene-pickup-coin";
                case "wood": return "scene-pickup-wood";
                case "rations": return "scene-pickup-rations";
                case "key": return "scene-pickup-key";
                default: return "scene-event-bg";
            }
        }

        // SceneCopy.SCENES 是 KeyValuePair 数组（无索引器）：按 kind find 取 SceneDef
        static Sdt.Core.SceneDef FindScene(string kind)
        {
            var kv = System.Linq.Enumerable.FirstOrDefault(Sdt.Core.SceneCopy.SCENES, k => k.Key == kind);
            return kv.Key != null ? kv.Value : null;
        }

        public static void Open(string kind, string gain, Action onDone)
        {
            var f = FindScene(kind);
            var s = ScreenMount.Show<PickupScreen>("Pickup");
            s.Tone = "pickup"; s.AssetKey = PickupBg(kind);
            s.TitleIcon = f.icon; s.Title = f.title;
            s._kind = kind; s._gain = gain; s._onDone = onDone;
            s.Build();
        }

        protected override void OnPrepare()
        {
            var f = FindScene(_kind);
            Sub = f.lines.Length > 0 ? f.lines[GameRuntime.I.Rng.Next(f.lines.Length)] : "";
        }

        protected override void OnBody()
        {

            var gain = UIKit.Label(BodyRoot, _gain, 46, UiPalette.Gold);
            gain.alignment = TextAnchor.MiddleCenter; gain.fontStyle = FontStyle.Bold;
            var leG = gain.gameObject.AddComponent<LayoutElement>(); leG.minHeight = 70; leG.flexibleHeight = 1;

            var go = new GameObject("col", typeof(RectTransform));
            go.transform.SetParent(BodyRoot, false);
            var vl = go.AddComponent<VerticalLayoutGroup>();
            vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            EventOptButton.Create(go.transform, "继 续", null, "ok", () =>
            {
                var cb = _onDone; _onDone = null;
                Close(); cb?.Invoke();
            });
        }
    }
}
