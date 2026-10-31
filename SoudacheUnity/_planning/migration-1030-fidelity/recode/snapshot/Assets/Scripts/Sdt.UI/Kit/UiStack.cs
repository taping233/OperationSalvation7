// ported from src/ui.js showOverlay/hideOverlay + game.state 模态语义（UI 栈化）
// UiStack 为静态类（W7 已按 UiStack.Push(p) 静态调用编码，契约 §6 的实例签名据此调整，见 TODO-contracts）。
// Push = showOverlay（含模态遮罩）；Pop/Close = hideOverlay；Blocked = 有面板打开（对应 game.state==='modal'）。
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    /// <summary>
    /// 全屏页面基类（对应 showOverlay(title, bodyHtml, mode) 的一次灌入）。
    /// 子类 Build() 代码化构建（对应 innerHTML 模板），Rebuild 清空子物体后重建；
    /// Close() = hideOverlay（销毁面板并出栈），关闭前回调 OnClose()（注销键盘等）。
    /// </summary>
    public abstract class Panel : MonoBehaviour
    {
        public abstract void Build();
        public virtual bool CanCloseWithEscape => true;
        public virtual void CloseFromEscape() => UiStack.Close(this);
        internal virtual void OnClose() { }
        protected virtual void OnDestroy() { }

        /// <summary>关闭（hideOverlay 等价）。</summary>
        protected void Close() => UiStack.Close(this);

        /// <summary>整块重建（innerHTML 重绘等价）。</summary>
        protected void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
                Destroy(transform.GetChild(i).gameObject);
            Build();
        }
    }

    /// <summary>模态面板栈：Push 加遮罩 + 置顶；Pop/Close 弹出；Blocked 表示模态中。</summary>
    public static class UiStack
    {
        static readonly List<Panel> _stack = new List<Panel>();
        static Transform _root;

        /// <summary>当前栈内面板名（诊断用，"a|b|c" 栈底到栈顶）。</summary>
        public static string Names()
        {
            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < _stack.Count; i++) { if (i > 0) sb.Append('|'); sb.Append(_stack[i] != null ? _stack[i].name : "null"); }
            return sb.ToString();
        }

        public static int Count => _stack.Count;
        public static bool Blocked => _stack.Count > 0;
        public static Panel Top => _stack.Count > 0 ? _stack[_stack.Count - 1] : null;
        public static IReadOnlyList<Panel> CapturePanels() => _stack.ToArray();
        public static bool SetMaskColor(Panel owner, Color color)
        {
            if(owner==null)return false;
            foreach(var entry in _masks)
                if(entry.panel==owner&&entry.mask!=null)
                {entry.mask.GetComponent<Image>().color=color;return true;}
            return false;
        }

        /// <summary>由 App.Launch 建栈根（Canvas 下层），面板与遮罩都挂这里。</summary>
        public static void Init(Transform root) => _root = root;

        /// <summary>建 GameObject → 挂 Panel → 入栈 → Build()（showOverlay+act 流程等价）。</summary>
        public static T Show<T>(string name) where T : Panel
        {
            var go = new GameObject(name, typeof(RectTransform));
            Stretch(go.GetComponent<RectTransform>());
            var p = go.AddComponent<T>();
            Push(p);
            p.Build();
            return p;
        }

        public static void Push(Panel p)
        {
            if (p == null) return;
            if (_root == null) throw new InvalidOperationException("UiStack 未初始化（App.Launch 先行）");
            // 模态遮罩（对应 #overlay 背景）
            var maskGo = new GameObject("mask", typeof(RectTransform));
            Stretch(maskGo.GetComponent<RectTransform>());
            maskGo.transform.SetParent(_root, false);
            var img = maskGo.AddComponent<Image>();
            img.color = Theme.HexA("#000000", 0.55f);
            var btn = maskGo.AddComponent<Button>();   // 拦截点击穿透
            btn.transition = Button.Transition.None;
            var mask = new MaskEntry { panel = p, mask = maskGo };
            _masks.Add(mask);
            p.transform.SetParent(_root, false);
            _stack.Add(p);
            // Current prepared menu facades use the same brief entry on every visit.
            if (p is Screens.Menu.GuideScreen || p is Screens.Menu.SettingsScreen || p is Screens.Menu.SlotPickerScreen
                || p is Screens.Run.ClassChoiceScreen || p is Screens.Menu.HomeInboxScreen)
                Screens.Run.CurrentRunFilm.PageEntry(p);
        }

        /// <summary>弹出最上面板（Esc 关闭当前页）。</summary>
        public static void Pop() { if (_stack.Count > 0) Close(_stack[_stack.Count - 1]); }

        public static void Close(Panel p)
        {
            if (p == null) return;
            _stack.Remove(p);
            for (int i = _masks.Count - 1; i >= 0; i--)
                if (_masks[i].panel == p)
                {
                    if (_masks[i].mask != null) UnityEngine.Object.Destroy(_masks[i].mask);
                    _masks.RemoveAt(i);
                }
            try { p.OnClose(); } catch (Exception e) { Debug.LogException(e); }
            if (p != null) UnityEngine.Object.Destroy(p.gameObject);
        }

        /// <summary>清空到根（回标题等整栈退出）。</summary>
        static void CloseAll() { while (_stack.Count > 0) Close(_stack[_stack.Count - 1]); }

        /// <summary>仅保留指定面板（其下全关）。</summary>
        public static void CollapseTo(Panel keep)
        {
            for (int i = _stack.Count - 1; i >= 0; i--)
                if (_stack[i] != keep) Close(_stack[i]);
        }

        sealed class MaskEntry { public Panel panel; public GameObject mask; }
        static readonly List<MaskEntry> _masks = new List<MaskEntry>();

        /// <summary>铺满父级的 RectTransform 工具。</summary>
        public static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
        }
    }
}
