// Native projection of menu-settings.js and core/performance-settings.js. Shared keys stay in Saves.Global.
using System;
using Newtonsoft.Json.Linq;
using Sdt.Run;
using UnityEngine;

namespace Sdt.UI.Kit
{
    public static class CurrentUiPreferences
    {
        public static event Action Changed;
        public static bool Flag(string key, bool defaultValue = false)
        {
            string raw = GameRuntime.I.Saves.Global.GetString(key);
            return raw == null ? defaultValue : defaultValue ? raw != "0" : raw == "1";
        }
        public static bool ReducedMotion => Flag("sdt-reduce-motion");
        public static bool ReduceShake => Flag("sdt-reduce-shake");
        public static bool ReadingLarge => Flag("sdt-reading-large");
        public static bool EndTurnHold => Flag("sdt-end-turn-hold");
        public static bool HintBar => Flag("sdt-hintbar", true);
        public static bool LayerBanner => Flag("sdt-banner", true);
        public static float BattlePace => GameRuntime.I.Saves.Global.GetString("sdt-battle-pace") == "2" ? 2 : 1;
        public static bool TrySetFlag(string key, bool value, out string error) => TrySetString(key, value ? "1" : "0", out error);
        public static bool TrySetString(string key, string value, out string error)
        {
            try { GameRuntime.I.Saves.Global.SetString(key, value); }
            catch (Exception e) { error = "保存失败，原设置已保留：" + e.Message; return false; }
            try { Changed?.Invoke(); error = null; return true; }
            catch (Exception e) { error = "已保存，但界面更新未完成：" + e.Message; return false; }
        }
        public static string Quality
        {
            get { string value = (string)Performance["quality"]; return value == "low" || value == "high" ? value : "balanced"; }
        }
        public static int FrameLimit
        {
            get { int value = (int?)Performance["fps"] ?? 60; return value == 30 || value == 120 ? value : 60; }
        }
        static JObject Performance
        {
            get { try { return GameRuntime.I.Saves.Global.GetJson("sdt-performance") as JObject ?? new JObject(); } catch { return new JObject(); } }
        }
        public static bool TrySetPerformance(string quality, int fps, out string error)
        {
            if (quality != "low" && quality != "balanced" && quality != "high") quality = "balanced";
            if (fps != 30 && fps != 60 && fps != 120) fps = 60;
            try
            {
                GameRuntime.I.Saves.Global.SetJson("sdt-performance", new JObject { { "quality", quality }, { "fps", fps } });
            }
            catch (Exception e) { error = "保存失败，原设置已保留：" + e.Message; return false; }
            try { ApplyNativePerformance(); Changed?.Invoke(); error = null; return true; }
            catch (Exception e) { error = "已保存，但画面更新未完成：" + e.Message; return false; }
        }
        // Unity's render cap is independent of game state, RNG, and battle pacing.
        public static void ApplyNativePerformance() { QualitySettings.vSyncCount = 0; Application.targetFrameRate = FrameLimit; }
    }
}
