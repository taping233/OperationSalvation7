// ported from src/ui.js + css/overlays.css（ov-btn）/css/base.css（#tooltip 骨架）
// 代码化 UI 生成器：全部运行时构建，不写 prefab（契约 §0）。
// 控件 → uGUI 映射：
//   .ov-btn   → Button + Image(#262626) + Outline(line2) + IconText 子文本
//   文本节点  → legacy Text（Theme.Mono，富文本开启：<b> 生效；[[icon:x]] 降级为图标 Image + 文本组合，
//               协调者补充 2：legacy Text 不支持 sprite 内嵌）
//   .pg       → UIKit.Panel 全屏锚满
//   行/列     → Row/Column 仅建 RectTransform（布局组由调用方按需挂，避免与调用方自带布局冲突）
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    public static class UIKit
    {
        // Unity missing-component handles use the engine null operator, not CLR ?? semantics.
        public static T GetOrAdd<T>(GameObject target) where T : Component
        {
            if (typeof(Graphic).IsAssignableFrom(typeof(T)) && target.GetComponent<CanvasRenderer>() == null) target.AddComponent<CanvasRenderer>();
            var component = target.GetComponent<T>();
            return (UnityEngine.Object)component != null ? component : target.AddComponent<T>();
        }
        public static T GetOrAdd<T>(Component target) where T : Component => GetOrAdd<T>(target.gameObject);
        /// <summary>全屏 Panel（.pg / showOverlay 卡片本体），锚满 parent。</summary>
        public static GameObject Panel(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            UiStack.Stretch(go.GetComponent<RectTransform>());
            return go;
        }

        /// <summary>ov-btn 风按钮（label 支持 [[icon:x]] 与 &lt;b&gt; 富文本）。</summary>
        public static Button Btn(Transform parent, string label, Action onClick)
        {
            var go = new GameObject("ov-btn", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = Theme.BtnBg;
            var outline = go.AddComponent<Outline>();
            outline.effectColor = Theme.Line2;
            outline.effectDistance = new Vector2(1, -1);
            var txt = IconText(go.transform, label);
            txt.fontSize = 17;
            txt.color = Theme.Txt;
            txt.alignment = TextAnchor.MiddleCenter;
            UiStack.Stretch(txt.rectTransform);
            txt.rectTransform.offsetMin = new Vector2(10, 3);
            txt.rectTransform.offsetMax = new Vector2(-10, -3);
            var le = go.AddComponent<LayoutElement>();
            le.minHeight = 42; le.flexibleWidth = 1;
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(0, 42);
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.onClick.AddListener(() => { Sdt.Run.AudioService.I.PlaySfx("click"); onClick?.Invoke(); });
            return btn;
        }

        /// <summary>ov-btn.ok（winter #D8BC86 底深字）。</summary>
        public static Button BtnOk(Transform parent, string label, Action onClick)
        {
            var b = Btn(parent, label, onClick);
            var img = b.GetComponent<Image>();
            img.color = Theme.BtnOkBg;
            var outl = b.GetComponent<Outline>(); outl.effectColor = Theme.BtnOkBg;
            SetBtnTextColor(b, Theme.BtnOkText);
            return b;
        }

        /// <summary>ov-btn.danger（退出朱红渐变 #A02020→#701616，唯一功能色例外）。</summary>
        public static Button BtnDanger(Transform parent, string label, Action onClick)
        {
            var b = Btn(parent, label, onClick);
            var img = b.GetComponent<Image>();
            img.color = Theme.ExitRed;   // 渐变终点 #701616 以描边/暗角近似
            var outl = b.GetComponent<Outline>(); outl.effectColor = Theme.ExitRed2;
            SetBtnTextColor(b, Hex("#F3EAE8"));   // winter #btnHome color
            return b;
        }

        static void SetBtnTextColor(Button b, Color c)
        {
            foreach (var t in b.GetComponentsInChildren<Text>()) t.color = c;
        }

        /// <summary>mini-btn（小号操作钮：覆盖重开/删除/领取/复原）。</summary>
        public static Button MiniBtn(Transform parent, string label, Action onClick, bool danger = false)
        {
            var b = Btn(parent, label, onClick);
            foreach (var t in b.GetComponentsInChildren<Text>()) { t.fontSize = 13; t.color = danger ? Theme.Hex("#C4C4C4") : Theme.Txt; }
            var le = b.GetComponent<LayoutElement>(); le.minHeight = 28;
            ((RectTransform)b.transform).sizeDelta = new Vector2(0, 28);
            var img = b.GetComponent<Image>();
            img.color = danger ? Theme.Hex("#1C1C1C") : Theme.Hex("#1C2530");
            return b;
        }

        /// <summary>文本（Cascadia Mono，富文本开）。</summary>
        public static Text Label(Transform parent, string txt, int size, Color? c = null)
        {
            var go = new GameObject("label", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var t = go.AddComponent<InlineIconText>();
            t.font = Theme.Sans;
            t.text = txt ?? "";
            t.fontSize = size;
            t.color = c ?? Theme.Txt;
            t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        /// <summary>Image（sprite null 时透明占位不报错）。</summary>
        public static Image Image(Transform parent, Sprite s)
        {
            var go = new GameObject("img", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.sprite = s;
            img.raycastTarget = false;
            if (s != null) img.SetNativeSize();
            return img;
        }

        /// <summary>行容器（仅 RectTransform；布局组由调用方追加）。</summary>
        public static GameObject Row(Transform parent) => Box("row", parent);

        /// <summary>列容器（仅 RectTransform）。</summary>
        public static GameObject Column(Transform parent) => Box("col", parent);

        /// <summary>工具栏占固定高度，子项按实际内容测宽，内部尺寸不抬高整页的最小宽度。</summary>
        public static HorizontalLayoutGroup Toolbar(GameObject row, float height, float spacing = 8, bool expandWidth = false)
        {
            var layout = row.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = spacing; layout.childAlignment = TextAnchor.MiddleLeft;
            layout.childControlWidth = layout.childControlHeight = true;
            layout.childForceExpandWidth = expandWidth; layout.childForceExpandHeight = false;
            var bounds = row.AddComponent<LayoutElement>();
            bounds.minWidth = bounds.preferredWidth = 0; bounds.flexibleWidth = 1;
            bounds.minHeight = bounds.preferredHeight = height; bounds.flexibleHeight = 0;
            return layout;
        }

        static GameObject Box(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return go;
        }

        /// <summary>网格（GridLayoutGroup，FixedColumnCount）。</summary>
        public static GameObject Grid(Transform parent, int cols, Vector2 cell, Vector2 gap)
        {
            var go = new GameObject("grid", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var g = go.AddComponent<GridLayoutGroup>();
            g.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            g.constraintCount = cols;
            g.cellSize = cell;
            g.spacing = gap;
            return go;
        }

        /// <summary>竖向滚动（ScrollRect）；返回内容根，可继续挂子物体。</summary>
        public static GameObject Scroll(Transform parent)
        {
            var go = new GameObject("scroll", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            UiStack.Stretch(go.GetComponent<RectTransform>());
            var img = go.AddComponent<Image>();   // 滚动视口底
            img.color = new Color(0, 0, 0, 0.01f);
            var sr = go.AddComponent<ScrollRect>();
            sr.horizontal = false; sr.vertical = true;
            go.AddComponent<RectMask2D>();
            var viewportLayout = go.AddComponent<LayoutElement>();
            viewportLayout.flexibleWidth = 1;
            viewportLayout.flexibleHeight = 1;
            viewportLayout.minWidth = 0;
            viewportLayout.minHeight = 48;
            var content = new GameObject("content", typeof(RectTransform));
            content.transform.SetParent(go.transform, false);
            var crt = (RectTransform)content.transform;
            crt.anchorMin = new Vector2(0, 1); crt.anchorMax = new Vector2(1, 1);
            crt.pivot = new Vector2(0.5f, 1f);
            crt.offsetMin = Vector2.zero; crt.offsetMax = Vector2.zero;
            var vl = content.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 6; vl.padding = new RectOffset(4, 4, 4, 4);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            var csf = content.AddComponent<ContentSizeFitter>();
            csf.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.content = crt;
            sr.viewport = (RectTransform)go.transform;
            return content;
        }

        /// <summary>Same Text API; all labels and buttons share source image icons.</summary>
        public static Text IconText(Transform parent, string sdtText) => Label(parent, sdtText, 16);

        static Color Hex(string h) => Theme.Hex(h);

        // ---- GameObject 重载（集成桥：调用方持有 GameObject 时免去 .transform） ----
        public static GameObject Panel(string name, GameObject parent) => Panel(name, parent.transform);
        public static Button Btn(GameObject parent, string label, Action onClick) => Btn(parent.transform, label, onClick);
        public static Button BtnOk(GameObject parent, string label, Action onClick) => BtnOk(parent.transform, label, onClick);
        public static Button BtnDanger(GameObject parent, string label, Action onClick) => BtnDanger(parent.transform, label, onClick);
        public static Button MiniBtn(GameObject parent, string label, Action onClick, bool danger = false) => MiniBtn(parent.transform, label, onClick, danger);
        public static Text Label(GameObject parent, string txt, int size, Color? c = null) => Label(parent.transform, txt, size, c);
        public static Image Image(GameObject parent, Sprite s) => Image(parent.transform, s);
        public static GameObject Row(GameObject parent) => Row(parent.transform);
        public static GameObject Column(GameObject parent) => Column(parent.transform);
        public static GameObject Grid(GameObject parent, int cols, Vector2 cell, Vector2 gap) => Grid(parent.transform, cols, cell, gap);
        public static GameObject Scroll(GameObject parent) => Scroll(parent.transform);
        public static Text IconText(GameObject parent, string sdtText) => IconText(parent.transform, sdtText);
}
}
