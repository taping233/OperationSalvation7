using System.Collections.Generic;
// ported from src/game.run.js (nodeShell/nodeOpt) + src/ui.js (showOverlay 骨架)
// W7 局内界面共享基件：nodeShell 全屏节点页外壳、evt-opt 选项条、色板、挂载器、日志桥。
//
// 原界面 DOM 结构 → uGUI 控件树映射（nodeShell）：
//   .pg.node-pg.sc-{tone}[data-asset-key]  → 全屏 Panel：底层 Image(Res.Scene(asset)) + 半透明压暗层
//   .node-panel（右侧毛玻璃面板）           → 右锚定 40% 宽 Image(rgba ink .82) + VerticalLayoutGroup
//   header.pg-head > h2 + span.sub          → IconText 标题行 + Label 副标题
//   .node-main                               → Body（子类填充，带 Scroll）
//   footer.node-foot                         → Foot（子类填充，底部水平排）
//   .evt-opt[b][span]                        → EventOptButton：Button 纵排两行 Label（主/后果说明），
//                                             tone=ok/danger/"" 决定边框强调色
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>
    /// winter.css 色表 + 源码字面色值（game.run.js PULSE_COL / doExtract 内联色）。
    /// 契约色表之外的取值一律来自源码字符串，未自创杂色；后续可由 Theme 收编。
    /// </summary>
    public static class UiPalette
    {
        public static readonly Color Ink = Hex("#101E27");      // winter --ink
        public static readonly Color AkMint = Hex("#A9EFC3");   // winter --akmint
        public static readonly Color Danger = Hex("#A02020");   // 退出朱红渐变起点
        public static readonly Color Danger2 = Hex("#701616");
        public static readonly Color Gold = Hex("#F5C542");     // 源码金币/收益大字
        public static readonly Color Ok = Hex("#7FDD9C");       // 源码 ok/回复绿
        public static readonly Color Warn = Hex("#F2854A");     // 源码 fire 橙
        public static readonly Color Dim = Hex("#8FA6B5");      // winter 雪青灰（dim 文案）
        public static readonly Color PanelGlass = HexA("#101E27", 0.86f); // 毛玻璃面板底

        public static Color Hex(string h)
        {
            ColorUtility.TryParseHtmlString(h, out var c); return c;
        }
        public static Color HexA(string h, float a) { var c = Hex(h); c.a = a; return c; }
    }

    /// <summary>UIKit 之外的纯样式补充（非交互基础件）：纯色块、chip、分区标题、行/列容器。</summary>
    public static class UiExt
    {
        /// <summary>行容器（不带布局——由调用方按需挂 HorizontalLayoutGroup 并自行配置）。</summary>
        public static GameObject Row(Transform parent) => Container("row", parent);
        /// <summary>列容器（不带布局——由调用方按需挂 VerticalLayoutGroup 并自行配置）。</summary>
        public static GameObject Col(Transform parent) => Container("col", parent);
        static GameObject Container(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go;
        }
        public static Image Box(Transform parent, Color color, float alpha = 1f)
        {
            var go = new GameObject("box", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = new Color(color.r, color.g, color.b, color.a * alpha);
            img.raycastTarget = false;
            go.AddComponent<LayoutElement>().ignoreLayout = true;
            return img;
        }

        /// <summary>res-chip / fc-chip：小底色块 + 文本（富文本 [[icon:x]] 由 IconText 降级渲染）。</summary>
        public static GameObject Chip(Transform parent, string text, Color? bg = null)
        {
            var go = new GameObject("chip", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>(); img.color = bg ?? UiPalette.HexA("#101E27", 0.6f);
            var layout = go.AddComponent<HorizontalLayoutGroup>();
            layout.padding = new RectOffset(10, 10, 4, 4);
            layout.childAlignment = TextAnchor.MiddleLeft;
            layout.childForceExpandWidth = false; layout.childForceExpandHeight = false;
            layout.childControlWidth = true; layout.childControlHeight = true;
            UIKit.IconText(go.transform, text).fontSize = 16;
            return go;
        }

        /// <summary>set-h 分区标题。</summary>
        public static Text SectionLabel(Transform parent, string text)
        {
            var t = UIKit.IconText(parent, text);
            t.fontSize = 18;
            t.color = UiPalette.AkMint;
            return t;
        }

        /// <summary>让 RectTransform 拉伸铺满父级。</summary>
        public static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
        }
    }

    /// <summary>UI.log 的桥：全部走 GameRuntime.Bus 的 ToastRequested 事件（契约 §4 事件清单）。</summary>
    public static class RunLog
    {
        public static void Log(string sdtRichText, string kind = "sys")
        {
            GameRuntime.I.Bus.Emit(new ToastRequested(sdtRichText));
        }
    }

    /// <summary>evt-opt 选项条（nodeOpt 与事件选项共用样式）：Button + 主标题 b + 后果 span。</summary>
    public static class EventOptButton
    {
        public static Button Create(Transform parent, string label, string detail, string tone, Action onClick)
        {
            var go = new GameObject("evt-opt", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = UiPalette.HexA("#0E2230", 0.92f);
            // tone: '' 默认 / 'ok' 薄荷描边 / 'danger' 朱红描边
            var accent = tone == "ok" ? UiPalette.Ok : tone == "danger" ? UiPalette.Danger : UiPalette.HexA("#2E4A5A", 1f);
            var outline = go.AddComponent<Outline>(); outline.effectColor = accent; outline.effectDistance = new Vector2(2, -2);
            var col = go.AddComponent<VerticalLayoutGroup>();
            col.spacing = 2; col.padding = new RectOffset(14, 14, 10, 10);
            col.childForceExpandWidth = true; col.childForceExpandHeight = false;
            col.childControlWidth = true; col.childControlHeight = true;
            var lb = UIKit.Label(go.transform, label, 22, Color.white);
            lb.fontStyle = FontStyle.Bold;
            var le = lb.gameObject.AddComponent<LayoutElement>(); le.minHeight = 26; le.flexibleHeight = 0;
            if (!string.IsNullOrEmpty(detail))
            {
                var ld = UIKit.Label(go.transform, detail, 15, UiPalette.Dim);
                var le2 = ld.gameObject.AddComponent<LayoutElement>(); le2.minHeight = 18; le2.flexibleHeight = 0;
            }
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.onClick.AddListener(() => { AudioService.I.PlaySfx("click"); onClick?.Invoke(); });
            var leBtn = go.AddComponent<LayoutElement>(); leBtn.minHeight = string.IsNullOrEmpty(detail) ? 48 : 72;
            leBtn.flexibleWidth = 1;
            return btn;
        }
    }

    /// <summary>
    /// nodeShell（game.run.js）：全屏场景背景 + 右侧毛玻璃面板的节点页外壳。
    /// 子类在 OnBody 里填充主体，在 OnFoot 里填充底部按钮行；Rebuild() = 整块重建（对应 innerHTML 重绘）。
    /// </summary>
    public abstract class NodeShellPanel : Panel
    {
        protected string Tone = "event";       // sc-{tone}
        protected string AssetKey = "";        // data-asset-key（缺省按 NODE_BG[tone]）
        protected string TitleIcon = "[[icon:dice]]";
        protected string Title = "";
        protected string Sub = "";             // 可空
        protected Transform BodyRoot;          // .node-main 内容根（Scroll 内容）
        protected Transform FootRoot;          // .node-foot 内容根

        // Closing a page returns control to the map; each command owns its reward receipt.
        protected new void Close()
        {
            base.Close();
        }
        internal override void OnClose()
        {
            var runtime = GameRuntime.I;
            if (runtime.State.runActive && !runtime.State.battleActive) runtime.State.Phase = "idle";
        }

        // NODE_BG（game.run.data.js）：tone → 背景图 asset key
        private static readonly System.Collections.Generic.Dictionary<string, string> NodeBg =
            new System.Collections.Generic.Dictionary<string, string>
            {
                { "door", "scene-door-bg" }, { "altar", "scene-altar-bg" }, { "fire", "scene-fire-bg" },
                { "exit", "scene-extract-bg" }, { "shop", "scene-shop-bg" }, { "event", "scene-event-bg" },
                { "battle", "scene-battle-bg" }, { "pickup", "scene-event-bg" },
            };

        public override void Build()
        {
            OnPrepare(); // 子类在这里填 Title/Sub/AssetKey 等头部数据
            var root = UIKit.Panel("node-pg", transform);
            // 背景图 + 压暗层
            var bg = UIKit.Image(root.transform, Sdt.Res.Res.Scene(string.IsNullOrEmpty(AssetKey) && NodeBg.TryGetValue(Tone, out var k) ? k : AssetKey));
            UiExt.Stretch(bg.rectTransform);
            var dim = UiExt.Box(root.transform, Color.black, 0.25f);
            UiExt.Stretch(dim.rectTransform);

            // 右侧毛玻璃面板 node-panel
            var panelGo = new GameObject("node-panel", typeof(RectTransform));
            panelGo.transform.SetParent(root.transform, false);
            var panelRt = panelGo.GetComponent<RectTransform>();
            panelRt.anchorMin = new Vector2(0.55f, 0.04f); panelRt.anchorMax = new Vector2(0.97f, 0.96f);
            panelRt.offsetMin = Vector2.zero; panelRt.offsetMax = Vector2.zero;
            var panelImg = UiExt.Box(panelGo.transform, UiPalette.PanelGlass);
            UiExt.Stretch(panelImg.rectTransform);
            var vl = panelGo.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 10; vl.padding = new RectOffset(18, 18, 16, 16);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            // header.pg-head：h2(icon+title) + span.sub
            var head = UiExt.Row(panelGo.transform);
            var headVl = head.AddComponent<VerticalLayoutGroup>();
            headVl.spacing = 4; headVl.childForceExpandWidth = true; headVl.childForceExpandHeight = false;
            headVl.childControlWidth = true; headVl.childControlHeight = true;
            var h2 = UIKit.IconText(head.transform, TitleIcon + " " + Title);
            h2.fontSize = 30; h2.color = Color.white; h2.fontStyle = FontStyle.Bold;
            var leH = h2.gameObject.AddComponent<LayoutElement>(); leH.minHeight = 36; leH.flexibleHeight = 0;
            if (!string.IsNullOrEmpty(Sub))
            {
                var sub = UIKit.IconText(head.transform, Sub);
                sub.fontSize = 15; sub.color = UiPalette.Dim;
                var leS = sub.gameObject.AddComponent<LayoutElement>(); leS.minHeight = 22; leS.flexibleHeight = 0;
                sub.supportRichText = true;
            }

            // .node-main：主体（滚动）
            var scroll = UIKit.Scroll(panelGo.transform);
            var leSc = scroll.AddComponent<LayoutElement>(); leSc.flexibleHeight = 1; leSc.flexibleWidth = 1;
            BodyRoot = scroll.transform;

            // footer.node-foot：底部按钮行
            var foot = UiExt.Row(panelGo.transform);
            var footHl = foot.AddComponent<HorizontalLayoutGroup>();
            footHl.spacing = 10; footHl.childAlignment = TextAnchor.MiddleRight;
            footHl.childForceExpandWidth = false; footHl.childForceExpandHeight = false;
            footHl.childControlWidth = true; footHl.childControlHeight = true;
            FootRoot = foot.transform;

            OnBody();
        }

        /// <summary>头部数据准备（Sub/Tone 等在 Build 渲染头部前生效）。</summary>
        protected virtual void OnPrepare() { }

        protected abstract void OnBody();

        /// <summary>整块重建（对应 showOverlay 重入）。</summary>
        protected void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
                Destroy(transform.GetChild(i).gameObject);
            Build();
        }
    }

    /// <summary>屏挂载器：建 GameObject → 挂 Panel 组件 → UiStack.Push → Build()（对应 showOverlay+act 流程）。</summary>
    public static class ScreenMount
    {
        public static T Show<T>(string name) where T : Panel
        {
            var go = new GameObject(name, typeof(RectTransform));
            UiExt.Stretch(go.GetComponent<RectTransform>());
            var p = go.AddComponent<T>();
            UiStack.Push(p);
            // 注意：此处不 Build——调用方先给面板字段赋值，再显式 p.Build()
            // （否则首次 Build 时字段为 null，EventDialog/SceneTransition 等屏会 NRE）
            return p;
        }
    }
}
