// ported from src/ui.js registerHelp/helpBtn/showHelp（? 帮助二级弹层）
// 语义照抄：页面渲染时 registerHelp(id, {title, html, back})；页头放 helpBtn(id)（这里返回按钮构建回调）；
// 点 ? 打开帮助，点「↩ 返回」执行 back() 重绘原页面。
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    /// <summary>? 帮助弹层（ui.js helpTopics + showHelp）。</summary>
    public static class HelpSystem
    {
        public sealed class HelpDef
        {
            public string title;                                  // 标题（不含 [[icon:question]] 前缀，展示时拼上）
            public List<KeyValuePair<string, string>> items = new List<KeyValuePair<string, string>>();   // help-item <b>k</b>v
            public Action back;                                   // helpBack：返回重绘原页面
        }

        static readonly Dictionary<string, HelpDef> _topics = new Dictionary<string, HelpDef>();

        /// <summary>registerHelp(id, def)。</summary>
        public static void Register(string id, string title, IEnumerable<KeyValuePair<string, string>> items, Action back)
        {
            var def = new HelpDef { title = title, back = back };
            if (items != null) def.items.AddRange(items);
            _topics[id] = def;
        }

        /// <summary>helpBtn(id)：页头 ? 按钮（title="查看说明"）。</summary>
        public static Button HelpBtn(Transform parent, string id)
        {
            var go = new GameObject("help-btn", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = Theme.HexA("#222527", 0.9f);
            var txt = UIKit.Label(go.transform, "？", 16, Theme.AkMint);
            txt.alignment = TextAnchor.MiddleCenter;
            UiStack.Stretch((RectTransform)txt.transform);
            var le = go.AddComponent<LayoutElement>();
            le.minWidth = 28; le.minHeight = 28; le.flexibleWidth = 0; le.flexibleHeight = 0;
            ((RectTransform)go.transform).sizeDelta = new Vector2(28, 28);
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.onClick.AddListener(() => { Sdt.Run.AudioService.I.PlaySfx("click"); Show(id); });
            return btn;
        }

        /// <summary>showHelp(page)：无主题时静默返回（照抄）。</summary>
        public static void Show(string id)
        {
            if (!_topics.TryGetValue(id, out var t)) return;
            UiStack.Show<HelpPanel>("Help-" + id).Setup(t);
        }

        /// <summary>帮助二级弹层：标题 + help-item 列表 + 「↩ 返回」。</summary>
        sealed class HelpPanel : Panel
        {
            HelpDef _def;
            public void Setup(HelpDef def) { _def = def; Rebuild(); }

            public override void Build()
            {
                if (_def == null) return;
                var root = UIKit.Panel("help", transform);
                var img = root.AddComponent<Image>();
                img.color = Theme.HexA("#112530", 0.98f);
                var vl = root.AddComponent<VerticalLayoutGroup>();
                vl.spacing = 8; vl.padding = new RectOffset(40, 40, 30, 30);
                vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;

                var h2 = UIKit.IconText(root.transform, "[[icon:question]] " + _def.title);
                h2.fontSize = 24; h2.color = Theme.Txt; h2.fontStyle = FontStyle.Bold;
                h2.gameObject.AddComponent<LayoutElement>().minHeight = 32;

                var scrollGo = UIKit.Scroll(root.transform);
                scrollGo.AddComponent<LayoutElement>().flexibleHeight = 1;
                foreach (var kv in _def.items)
                {
                    var line = UIKit.Label(scrollGo.transform, "<b>" + kv.Key + "</b>" + kv.Value, 15, Theme.Sub);
                    line.gameObject.AddComponent<LayoutElement>().minHeight = 22;
                }
                var btns = UIKit.Row(root.transform);
                var hl = btns.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 10; hl.childAlignment = TextAnchor.MiddleRight;
                hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
                UIKit.Btn(btns.transform, "↩ 返回", () => { Close(); _def.back?.Invoke(); });
            }
        }
    }
}
