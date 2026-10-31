// ported from src/ui.js showTooltip/hideTooltip（#tooltip 浮动提示）
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    /// <summary>
    /// 全局浮动提示（原 #tooltip：跟随光标、右/下溢出翻面）。
    /// </summary>
    public static class Tooltip
    {
        static GameObject _root;

        /// <summary>由 App.Launch 建顶层层（栈之上，不挡点击：raycastTarget=false）。</summary>
        public static void Init(Transform uiRoot)
        {
            _root = new GameObject("Tooltip", typeof(RectTransform));
            _root.transform.SetParent(uiRoot, false);
            var rt = (RectTransform)_root.transform;
            rt.anchorMin = rt.anchorMax = Vector2.zero;   // 左下原点，手动定位（像素对齐）
            var img = _root.AddComponent<Image>();
            img.color = Theme.HexA("#112530", 0.96f);
            var outline = _root.AddComponent<Outline>();
            outline.effectColor = Theme.Line;
            outline.effectDistance = new Vector2(1, -1);
            _root.AddComponent<VerticalLayoutGroup>() ;
            _root.SetActive(false);
        }

        /// <summary>showTooltip(clientX, clientY, title, lines)。屏幕坐标 = 原版事件坐标语义。</summary>
        public static void Show(Vector2 screenPos, string title, IReadOnlyList<string> lines)
        {
            if (_root == null) return;
            for (int i = _root.transform.childCount - 1; i >= 0; i--)
                Object.Destroy(_root.transform.GetChild(i).gameObject);
            var vl = _root.GetComponent<VerticalLayoutGroup>();
            vl.padding = new RectOffset(10, 10, 6, 6);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            var t = UIKit.IconText(_root.transform, "<b>" + (title ?? "") + "</b>");
            t.fontSize = 14; t.color = Theme.Txt;
            foreach (var l in lines ?? (IReadOnlyList<string>)new string[0])
            {
                var s = UIKit.IconText(_root.transform, l);
                s.fontSize = 13; s.color = Theme.Sub;
            }
            _root.SetActive(true);
            LayoutRebuilder.ForceRebuildLayoutImmediate((RectTransform)_root.transform);
            var rt = (RectTransform)_root.transform;
            float w = Mathf.Max(120, rt.rect.width), h = Mathf.Max(30, rt.rect.height);
            float x = screenPos.x + 14, y = screenPos.y + 14;
            var vp = new Vector2(Screen.width, Screen.height);
            if (x + w > vp.x - 8) x = screenPos.x - w - 10;
            if (y + h > vp.y - 8) y = screenPos.y - h - 10;
            // 屏幕坐标 → Canvas 1920×1080 基准（左下原点一致，按 scaleFactor 换算）
            var canvas = _root.GetComponentInParent<Canvas>();
            float scale = canvas != null && canvas.scaleFactor > 0 ? canvas.scaleFactor : 1f;
            rt.anchoredPosition = new Vector2(x / scale, y / scale);
        }

        public static void Hide() { if (_root != null) _root.SetActive(false); }
    }
}
