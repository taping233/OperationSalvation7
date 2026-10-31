// core/input.js: action data, saved overrides, conflict transfer, letter-only gate and native key translation.
using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using Sdt.Run;
using UnityEngine;

namespace Sdt.UI.Kit
{
    public static class CurrentInputBindings
    {
        static readonly string[] Order = { "roll", "camRotateL", "camRotateR", "camOverview", "camFocus", "backpack", "nodeNumbers", "moveConfirm", "moveCancel", "movePrev" };
        static readonly string[] Names = { "切换路线", "镜头左转", "镜头右转", "地图全景", "定位当前地点", "打开背包", "节点编号", "确认前往", "取消选择", "上一条路线" };
        static readonly string[][] Defaults = { new[] { " ", "enter" }, new[] { "q" }, new[] { "e" }, new[] { "g" }, new[] { "f" }, new[] { "b" }, new[] { "n" }, new[] { "x" }, new[] { "escape" }, new[] { "z" } };
        static Dictionary<string, string[]> _bindings;
        public static event Action Changed;
        public static IReadOnlyList<string> Actions => Order;
        public static IReadOnlyDictionary<string, string[]> Bindings { get { EnsureLoaded(); return Clone(_bindings); } }
        public static bool LettersEnabled => CurrentUiPreferences.Flag("sdt-letter-shortcuts", true);
        public static bool SuppressGameplayInput => KeyCaptureHandler != null;
        // App calls this before ordinary Escape handling or action dispatch. Owner releases it on close.
        public static Func<string, bool, bool, bool, bool> KeyCaptureHandler;
        public static bool CaptureKey(KeyCode key, bool ctrl = false, bool alt = false, bool meta = false) => TryCapture(KeyFor(key), ctrl, alt, meta);
        public static bool TryCapture(string key, bool ctrl = false, bool alt = false, bool meta = false) => KeyCaptureHandler?.Invoke(key, ctrl, alt, meta) == true;
        static Dictionary<string, string[]> DefaultMap() => Order.Select((action, index) => new { action, index }).ToDictionary(x => x.action, x => Defaults[x.index].ToArray());
        static Dictionary<string, string[]> Clone(Dictionary<string, string[]> source) => source.ToDictionary(x => x.Key, x => x.Value.ToArray());
        static void EnsureLoaded()
        {
            if (_bindings != null) return;
            _bindings = DefaultMap();
            try
            {
                var saved = GameRuntime.I.Saves.Global.GetJson("sdt-keybinds");
                if (saved?.Type == JTokenType.String) saved = JToken.Parse((string)saved);
                if (!(saved is JObject obj)) return;
                foreach (var pair in obj.Properties())
                {
                    if (!_bindings.ContainsKey(pair.Name)) continue;
                    string[] keys = pair.Value.Type == JTokenType.String ? new[] { (string)pair.Value } : pair.Value is JArray arr && arr.All(t => t.Type == JTokenType.String) ? arr.Values<string>().ToArray() : null;
                    if (keys == null || keys.Any(string.IsNullOrEmpty)) continue;
                    keys = keys.Select(k => k.ToLowerInvariant()).Distinct().ToArray();
                    foreach (string other in Order) if (other != pair.Name) _bindings[other] = _bindings[other].Where(k => !keys.Contains(k)).ToArray();
                    _bindings[pair.Name] = keys;
                }
            }
            catch { _bindings = DefaultMap(); }
        }
        public static string ActionName(string action) { int index = Array.IndexOf(Order, action); return index < 0 ? action : Names[index]; }
        public static string ActionFor(string key, bool ctrl = false, bool alt = false, bool meta = false, bool composing = false)
        {
            if (ctrl || alt || meta || composing) return null;
            EnsureLoaded(); string normalized = (key ?? "").ToLowerInvariant();
            if (!LettersEnabled && normalized.Length == 1 && normalized[0] >= 'a' && normalized[0] <= 'z') return null;
            foreach (string action in Order) if (_bindings[action].Contains(normalized)) return action;
            return null;
        }
        public static string ConflictFor(string action, string key)
        {
            EnsureLoaded(); string normalized = (key ?? "").ToLowerInvariant();
            return Order.FirstOrDefault(other => other != action && _bindings[other].Contains(normalized));
        }
        public static bool TryRebind(string action, string key, out string error)
        {
            EnsureLoaded(); if (!_bindings.ContainsKey(action) || string.IsNullOrEmpty(key)) { error = "按键无效"; return false; }
            var next = Clone(_bindings); string normalized = key.ToLowerInvariant();
            foreach (string other in Order) if (other != action) next[other] = next[other].Where(k => k != normalized).ToArray();
            next[action] = new[] { normalized };
            try { GameRuntime.I.Saves.Global.SetJson("sdt-keybinds", next); }
            catch (Exception e) { error = "键位保存失败，原绑定已保留：" + e.Message; return false; }
            _bindings = next;
            return NotifyChanged(out error);
        }
        public static bool TryReset(out string error)
        {
            try { GameRuntime.I.Saves.Global.Delete("sdt-keybinds"); }
            catch (Exception e) { error = "默认键位恢复失败：" + e.Message; return false; }
            _bindings = DefaultMap();
            return NotifyChanged(out error);
        }
        public static bool TrySetLettersEnabled(bool value, out string error)
        {
            bool saved = CurrentUiPreferences.TrySetFlag("sdt-letter-shortcuts", value, out error); return saved && NotifyChanged(out error);
        }
        static bool NotifyChanged(out string error)
        {
            try { Changed?.Invoke(); error = null; return true; }
            catch (Exception e) { error = "键位已保存，但操作提示更新未完成：" + e.Message; return false; }
        }
        public static string BindingLabel(string action)
        {
            EnsureLoaded(); return _bindings.TryGetValue(action, out var keys) && keys.Length > 0 ? string.Join(" / ", keys.Select(KeyLabel)) : "未绑定";
        }
        static string KeyLabel(string key) => key == " " ? "空格" : key == "enter" ? "Enter" : key == "escape" ? "Esc" : key == "arrowleft" ? "←" : key == "arrowright" ? "→" : key == "arrowup" ? "↑" : key == "arrowdown" ? "↓" : key.ToUpperInvariant();
        public static string KeyFor(KeyCode key)
        {
            if (key >= KeyCode.A && key <= KeyCode.Z) return key.ToString().ToLowerInvariant();
            if (key >= KeyCode.Alpha0 && key <= KeyCode.Alpha9) return ((int)key - (int)KeyCode.Alpha0).ToString();
            if (key >= KeyCode.F1 && key <= KeyCode.F15) return key.ToString().ToLowerInvariant();
            switch (key)
            {
                case KeyCode.Space: return " "; case KeyCode.Return: case KeyCode.KeypadEnter: return "enter";
                case KeyCode.Escape: return "escape"; case KeyCode.LeftArrow: return "arrowleft"; case KeyCode.RightArrow: return "arrowright";
                case KeyCode.UpArrow: return "arrowup"; case KeyCode.DownArrow: return "arrowdown"; case KeyCode.Tab: return "tab";
                case KeyCode.Backspace: return "backspace"; case KeyCode.Delete: return "delete"; case KeyCode.Insert: return "insert";
                case KeyCode.Home: return "home"; case KeyCode.End: return "end"; case KeyCode.PageUp: return "pageup"; case KeyCode.PageDown: return "pagedown";
                case KeyCode.Minus: return "-"; case KeyCode.Equals: return "="; case KeyCode.LeftBracket: return "["; case KeyCode.RightBracket: return "]";
                case KeyCode.Backslash: return "\\"; case KeyCode.Semicolon: return ";"; case KeyCode.Quote: return "'"; case KeyCode.Comma: return ",";
                case KeyCode.Period: return "."; case KeyCode.Slash: return "/"; case KeyCode.BackQuote: return "`";
                default: return null;
            }
        }
    }
}
