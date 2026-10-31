// Desktop startup-transition.js: title is ready underneath one unskippable city film.
using System;
using System.Runtime.InteropServices;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;

namespace Sdt.Boot
{
    public sealed class StartupTransition : MonoBehaviour
    {
        static StartupTransition _instance;
        public static string Stage { get; private set; } = "not-installed";
        public static double StartedAt { get; private set; }
        public static double CompletedAt { get; private set; }
        public static bool Finished => Stage == "complete" || Stage == "cancelled" || Stage == "reduced" || Stage == "fallback";
        public static CurrentRunFilm Film { get; private set; }
        public static void Install()
        {
            // Application startup only; returning to the title must not replay it.
            if (Stage != "not-installed") return;
            var node = new GameObject("~StartupTransition");
            DontDestroyOnLoad(node); _instance = node.AddComponent<StartupTransition>();
            SetStage("preparing");
            if (CurrentUiPreferences.ReducedMotion || SystemReducedMotion()) { SetStage("reduced"); return; }
            var previous = CurrentRunFilm.Current;
            try
            {
                var title = UiStack.Top;
                // Resources are loaded synchronously by the shared film before its first paint.
                var profile = CurrentRunFilm.Profile("departure");
                bool artworkReady = Resources.Load<Texture2D>(profile.art) != null;
                Film = CurrentRunFilm.Play("departure", isCurrent: () => title != null && UiStack.Top == title,
                    durationMs: artworkReady ? (int?)null : 0, skippable: false);
                if (Film == null) { SetStage("fallback"); return; }
                Film.WhenFinished(() => { Film = null; SetStage("complete"); });
                SetStage("playing");
            }
            catch (Exception error)
            {
                // Play may have created its curtain before a resource failed.
                if (CurrentRunFilm.Current != previous && CurrentRunFilm.Current != null
                    && CurrentRunFilm.Current.Kind == "departure") CurrentRunFilm.CancelActive();
                Cancel(); SetStage("fallback");
                // Decorative failure leaves the already-built title usable.
                Debug.LogWarning("Desktop startup film unavailable: " + error.Message);
            }
        }
        public static void Cancel()
        {
            if (Finished || Stage == "not-installed") return;
            // A later page film owns its own lifetime and must not be cancelled here.
            if (Film != null && CurrentRunFilm.Current == Film) CurrentRunFilm.CancelActive();
            Film = null; SetStage("cancelled");
        }
        void Update()
        {
            if (Stage != "playing") return;
            if (Film == null || CurrentRunFilm.Current != Film || !Film.gameObject.activeSelf) Cancel();
        }
        void OnApplicationQuit() => Cancel();
        void OnDestroy() { if (_instance == this) { Cancel(); _instance = null; } }
        static void SetStage(string stage)
        {
            Stage = stage;
            if (stage == "playing") StartedAt = Time.realtimeSinceStartupAsDouble;
            if (Finished) CompletedAt = Time.realtimeSinceStartupAsDouble;
            Debug.Log("[startup] " + stage + " frame=" + Time.frameCount + " backbuffer=" + Screen.width + "x" + Screen.height);
        }
        // Windows' client-area animation preference is the native equivalent of the
        // desktop renderer's prefers-reduced-motion query; it does not change saves.
        static bool SystemReducedMotion()
        {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            try { return SystemParametersInfo(0x1042, 0, out bool enabled, 0) && !enabled; }
            catch (DllNotFoundException) { return false; }
            catch (EntryPointNotFoundException) { return false; }
#else
            return false;
#endif
        }
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
        [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool SystemParametersInfo(uint action, uint parameter, [MarshalAs(UnmanagedType.Bool)] out bool value, uint flags);
#endif
    }
}
