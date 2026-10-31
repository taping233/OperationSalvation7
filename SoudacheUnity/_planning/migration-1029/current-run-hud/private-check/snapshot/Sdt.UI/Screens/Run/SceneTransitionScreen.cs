// ported from src/game.run.js openScene()/finishScene()/showRunTransition()/enterNode()
//
// 原界面 DOM 结构 → uGUI 控件树映射：
// 【openScene .scene.sc-{tone}[data-asset-key]】
//   背景图 data-asset-key            → 全屏 Image(Res.Scene(meta[2])) + 压暗
//   .scene-foes/.scene-foe-art       → 敌人立绘横排（Res.EnemyPortrait(foe.id)）
//   .scene-art > span(icon)          → 无敌人时的大图标占位（IconText）
//   h2.scene-title                   → 居中大标题（f.title）
//   .scene-gain > b                  → 大字收益（opts.gain，金色）
//   .scene-line > p                  → 随机台词（pick(f.lines)，{name} 替换）
//   .scene-ops > button.ov-btn.ok    → 「继 续」按钮（auto 场景无按钮）
//   p.scene-hint                     → 「[[icon:sparkles]] 点击任意处继续 [[icon:sparkles]]」
//   整页 data-act=sceneNext          → 全屏透明 Button（点击任意处继续）
//【showRunTransition .scene.flow-transition】
//   .flow-eyebrow/.flow-title/.flow-detail/.flow-hint + .flow-line
//   → 居中竖排四行 + 分隔线；duration(默认900ms) 后自动关（async/await，不用协程）；
//     全屏透明 Button data-act=flowContinue = 点击跳过。
using System;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>
    /// 节点过场页：openScene（场景演出，点击任意处继续后回调 onDone）。
    /// kind = SCENES 键；opts.name 替换台词 {name}，opts.gain 大字收益，opts.foes 敌人立绘，opts.btn 覆盖按钮字。
    /// </summary>
    public class SceneTransitionScreen : Panel
    {
        string _kind; string _name; string _gain; string _btn; UnityEngine.Sprite[] _foeArts; string[] _foeNames;
        Action _onDone;

        // SceneCopy.SCENES 是 KeyValuePair 数组（无 ContainsKey/索引器）：按 kind find 取 SceneDef
        static SceneDef FindScene(string kind)
        {
            var kv = System.Linq.Enumerable.FirstOrDefault(SceneCopy.SCENES, k => k.Key == kind);
            return kv.Key != null ? kv.Value : null;
        }

        public static void OpenScene(string kind, Action onDone = null, string name = null, string gain = null,
            string btn = null, UnityEngine.Sprite[] foeArts = null, string[] foeNames = null)
        {
            if (FindScene(kind) == null) { onDone?.Invoke(); return; }
            AudioService.I.PlaySfx("scene");
            var s = ScreenMount.Show<SceneTransitionScreen>("Scene");
            s._kind = kind; s._onDone = onDone; s._name = name; s._gain = gain; s._btn = btn;
            s._foeArts = foeArts; s._foeNames = foeNames;
            s.Build();
        }

        public override void Build()
        {
            var f = FindScene(_kind);
            var root = UIKit.Panel("scene", transform);

            // data-asset-key：SCENE_META[kind][2]（SceneCopy.PRELOAD_SCENES：key=场景 kind，value=Art/Scenes/ 文件名）
            string asset = null;
            var pkv = System.Linq.Enumerable.FirstOrDefault(SceneCopy.PRELOAD_SCENES, k => k.Key == _kind);
            if (pkv.Key != null) asset = pkv.Value;
            var bg = UIKit.Image(root.transform, Sdt.Res.Res.Scene(asset));
            UiExt.Stretch(bg.rectTransform);
            var dim = UiExt.Box(root.transform, Color.black, 0.3f);
            UiExt.Stretch(dim.rectTransform);

            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 14; vl.padding = new RectOffset(80, 80, 60, 60);
            vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            // 敌人立绘 / 大图标
            if (_foeArts != null && _foeArts.Length > 0)
            {
                var foes = UiExt.Row(root.transform);
                var fHl = foes.AddComponent<HorizontalLayoutGroup>();
                fHl.spacing = 18; fHl.childAlignment = TextAnchor.MiddleCenter;
                fHl.childForceExpandWidth = false; fHl.childForceExpandHeight = false;
                foreach (var art in _foeArts)
                {
                    var a = UIKit.Image(foes.transform, art);
                    ((RectTransform)a.transform).sizeDelta = new Vector2(200, 260);
                }
            }
            else
            {
                var icon = UIKit.IconText(root.transform, f.icon ?? "");
                if (icon == null)
                {
                    // IconText 理论不返 null（有兜底 Text）；出现即记现场并用纯 Label 兜底，不让过场屏崩掉
                    Debug.LogError("[diag] IconText null, icon=" + (f.icon ?? "NULL"));
                    icon = UIKit.Label(root.transform, "?", 64, UiPalette.AkMint);
                }
                icon.fontSize = 64; icon.alignment = TextAnchor.MiddleCenter; icon.color = UiPalette.AkMint;
                var le = icon.gameObject.AddComponent<LayoutElement>(); le.minHeight = 80; le.flexibleHeight = 0;
            }

            var title = UIKit.Label(root.transform, f.title, 42, Color.white);
            title.alignment = TextAnchor.MiddleCenter; title.fontStyle = FontStyle.Bold;
            var leT = title.gameObject.AddComponent<LayoutElement>(); leT.minHeight = 52; leT.flexibleHeight = 0;

            if (!string.IsNullOrEmpty(_gain))
            {
                var g = UIKit.Label(root.transform, _gain, 46, UiPalette.Gold);
                g.alignment = TextAnchor.MiddleCenter; g.fontStyle = FontStyle.Bold;
                var leG = g.gameObject.AddComponent<LayoutElement>(); leG.minHeight = 58; leG.flexibleHeight = 0;
            }

            // 台词：pick(f.lines) 并替换 {name}
            var text = f.lines.Length > 0 ? f.lines[GameRuntime.I.Rng.Next(f.lines.Length)] : "";
            text = text.Replace("{name}", string.IsNullOrEmpty(_name) ? "不速之客" : _name);
            var line = UIKit.Label(root.transform, text, 20, UiPalette.Hex("#D8E4EC"));
            line.alignment = TextAnchor.MiddleCenter;
            var leL = line.gameObject.AddComponent<LayoutElement>(); leL.minHeight = 56; leL.flexibleHeight = 0;

            // .scene-ops：auto 场景（拾取类）无按钮，点击任意处继续
            if (!f.auto)
            {
                var ok = UIKit.Btn(root.transform, string.IsNullOrEmpty(_btn) ? (string.IsNullOrEmpty(f.btn) ? "继 续" : f.btn) : _btn,
                    () => Finish());
                ((RectTransform)ok.transform).sizeDelta = new Vector2(220, 44);
            }

            var hint = UIKit.IconText(root.transform, "[[icon:sparkles]] 点击任意处继续 [[icon:sparkles]]");
            hint.fontSize = 14; hint.alignment = TextAnchor.MiddleCenter; hint.color = UiPalette.Dim;
            var leHint = hint.gameObject.AddComponent<LayoutElement>(); leHint.minHeight = 22; leHint.flexibleHeight = 0;

            // data-act="sceneNext"：全屏透明按钮
            var clickCatcher = new GameObject("sceneNext", typeof(RectTransform));
            clickCatcher.transform.SetParent(root.transform, false);
            clickCatcher.transform.SetAsFirstSibling();
            UiExt.Stretch(clickCatcher.GetComponent<RectTransform>());
            var cImg = clickCatcher.AddComponent<Image>(); cImg.color = Color.clear;
            var cBtn = clickCatcher.AddComponent<Button>(); cBtn.targetGraphic = cImg;
            cBtn.onClick.AddListener(() => Finish());
        }

        bool _finished;
        void Finish()
        {
            if (_finished) return;
            _finished = true;
            var cb = _onDone; _onDone = null;
            Close();
            cb?.Invoke();
        }
    }

    /// <summary>区域短过场（enterNode/showRunTransition）：900ms 自动关，点击跳过；完成后 resolve。</summary>
    public class RunTransitionScreen : Panel
    {
        string _eyebrow, _titleText, _detail, _asset;
        TaskCompletionSource<bool> _tcs;
        float _duration;
        bool _finished;

        // enterNode transitions 表（game.run.js）
        public static Task EnterNode(string kind)
        {
            switch (kind)
            {
                case "battle": return Open("HOSTILE CONTACT", "遭遇敌袭", "武器解锁 · 准备接敌", "scene-battle-bg", 900, "battle");
                case "door": return Open("GATE SIGNAL", "抵达大门", "环层通路正在响应", "scene-door-bg", 900, "door");
                case "altar": return Open("CONTAMINATION DETECTED", "污染核心", "高危生命信号逼近", "scene-altar-bg", 900, "altar");
                case "emergencyExit": return Open("EXTRACTION POINT", "紧急撤离点", "撤离信标已经接通", "scene-extract-bg", 900, "exit");
                case "shop": return Open("CARAVAN SIGNAL", "拾荒商队", "交易频道已经开放", "scene-shop-bg", 900, "shop");
                default: return Open("", "进入节点", "", "scene-battle-bg", 900, "battle");
            }
        }

        public static Task Open(string eyebrow, string title, string detail, string asset, float durationMs, string tone = "battle")
        {
            var s = ScreenMount.Show<RunTransitionScreen>("RunTransition");
            s._eyebrow = eyebrow; s._titleText = title; s._detail = detail; s._asset = asset;
            s._duration = durationMs / 1000f;
            s._tcs = new TaskCompletionSource<bool>();
            s.Build();
            s.StartTimer();
            return s._tcs.Task;
        }

        async void StartTimer()
        {
            var t = _duration;
            while (t > 0 && !_finished)
            {
                await Task.Delay(50);
                t -= 0.05f;
            }
            Finish();
        }

        public override void Build()
        {
            var root = UIKit.Panel("flow-transition", transform);
            var bg = UIKit.Image(root.transform, Sdt.Res.Res.Scene(_asset));
            UiExt.Stretch(bg.rectTransform);
            var dim = UiExt.Box(root.transform, Color.black, 0.45f);
            UiExt.Stretch(dim.rectTransform);

            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 12; vl.padding = new RectOffset(120, 120, 0, 40);
            vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            if (!string.IsNullOrEmpty(_eyebrow))
            {
                var eb = UIKit.Label(root.transform, _eyebrow, 16, UiPalette.AkMint);
                eb.alignment = TextAnchor.MiddleCenter;
                var le = eb.gameObject.AddComponent<LayoutElement>(); le.minHeight = 24; le.flexibleHeight = 0;
            }
            var tt = UIKit.Label(root.transform, string.IsNullOrEmpty(_titleText) ? "未知区域" : _titleText, 44, Color.white);
            tt.alignment = TextAnchor.MiddleCenter; tt.fontStyle = FontStyle.Bold;
            var leT = tt.gameObject.AddComponent<LayoutElement>(); leT.minHeight = 56; leT.flexibleHeight = 0;
            if (!string.IsNullOrEmpty(_detail))
            {
                var dt = UIKit.Label(root.transform, _detail, 18, UiPalette.Hex("#D8E4EC"));
                dt.alignment = TextAnchor.MiddleCenter;
                var leD = dt.gameObject.AddComponent<LayoutElement>(); leD.minHeight = 26; leD.flexibleHeight = 0;
            }
            // .flow-line 分隔线
            var line = UiExt.Box(root.transform, UiPalette.AkMint, 0.7f);
            var leL = line.gameObject.AddComponent<LayoutElement>(); leL.minHeight = 2; leL.flexibleWidth = 0.4f; leL.flexibleHeight = 0;
            var hint = UIKit.Label(root.transform, "点击跳过", 14, UiPalette.Dim);
            hint.alignment = TextAnchor.MiddleCenter;
            var leH = hint.gameObject.AddComponent<LayoutElement>(); leH.minHeight = 20; leH.flexibleHeight = 0;

            var catcher = new GameObject("flowContinue", typeof(RectTransform));
            catcher.transform.SetParent(root.transform, false);
            catcher.transform.SetAsFirstSibling();
            UiExt.Stretch(catcher.GetComponent<RectTransform>());
            var cImg = catcher.AddComponent<Image>(); cImg.color = Color.clear;
            var cBtn = catcher.AddComponent<Button>(); cBtn.targetGraphic = cImg;
            cBtn.onClick.AddListener(() => Finish());
        }

        void Finish()
        {
            if (_finished) return;
            _finished = true;
            Close();
            _tcs?.TrySetResult(true);
        }
    }
}
