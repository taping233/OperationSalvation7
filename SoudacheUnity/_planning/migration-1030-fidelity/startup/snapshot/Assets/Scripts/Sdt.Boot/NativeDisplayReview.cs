using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Boot
{
    // Explicit QA command only. This records the real standalone backbuffer and keeps
    // normal ScreenSpaceOverlay/CanvasScaler behaviour, unlike Editor offscreen fixtures.
    public sealed class NativeDisplayReview : MonoBehaviour
    {
        static readonly string[] Arguments = Environment.GetCommandLineArgs();
        static string Argument(string key)
        { int index = Array.IndexOf(Arguments, key); return index >= 0 && index + 1 < Arguments.Length ? Arguments[index + 1] : null; }
        public static bool Enabled => Array.IndexOf(Arguments, "--sdt-background-review") >= 0;
        static string Output => Path.GetFullPath(Argument("--sdt-background-review"));
        readonly List<object> _records = new List<object>();
        bool _failed;
        float _began;
        public static void ConfigureBeforeLaunch()
        {
            if (!Enabled) return;
            if (!Application.isBatchMode || string.IsNullOrWhiteSpace(Argument("-parentHWND")))
                throw new InvalidOperationException("Background display review requires batch mode and an explicit hidden parent window.");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "isolated-profile"));
            Application.runInBackground = true;
        }
        public static void Install()
        {
            if (!Enabled) return;
            var node = new GameObject("~NativeDisplayReview");
            DontDestroyOnLoad(node); node.AddComponent<NativeDisplayReview>();
        }
        void Start()
        { _began = Time.realtimeSinceStartup; Application.logMessageReceived += Observe; StartCoroutine(Run()); }
        void Update() { if (!_failed && Time.realtimeSinceStartup - _began > 120) Fail(new TimeoutException("Actual standalone review exceeded 120 seconds.")); }
        void OnDestroy() { Application.logMessageReceived -= Observe; }
        void Observe(string message, string stack, LogType type)
        { if (type == LogType.Error || type == LogType.Exception) Fail(new InvalidOperationException(message + "\n" + stack)); }
        bool Guard(Action action)
        {
            if (_failed) return false;
            try { action(); return true; }
            catch (Exception error) { Fail(error); return false; }
        }
        IEnumerator Run()
        {
            for (int frame = 0; frame < 12; frame++) yield return null;
            if (!Guard(() => _records.Add(new { kind = "actual-player-start", display = DisplayMetadata() }))) yield break;
            // Capture the real startup mid-motion, then wait for its own completion.
            // No forced resolution, input bypass or replacement curtain is involved.
            float startupWait = Time.realtimeSinceStartup;
            while (!StartupTransition.Finished && StartupTransition.Film != null
                && StartupTransition.Film.PlaybackProgress < .5f && Time.realtimeSinceStartup - startupWait < 10) yield return null;
            if (!StartupTransition.Finished)
            {
                if (!Guard(() => _records.Add(new { kind = "actual-player-startup-midpoint", stage = StartupTransition.Stage,
                    progress = StartupTransition.Film?.PlaybackProgress, shaderReady = StartupTransition.Film?.ShaderReady,
                    duration = StartupTransition.Film?.DurationSeconds, exit = StartupTransition.Film?.ExitSeconds,
                    sourceContract = "city reflection; no visible subtitle; keyboard/pointer skipping disabled", display = DisplayMetadata() }))) yield break;
                yield return Capture("player-startup", false);
            }
            while (!StartupTransition.Finished && Time.realtimeSinceStartup - startupWait < 10) yield return null;
            if (!Guard(() => {
                if (!StartupTransition.Finished) throw new TimeoutException("Desktop startup film did not finish.");
                _records.Add(new { kind = "actual-player-startup-finished", stage = StartupTransition.Stage,
                    started = StartupTransition.StartedAt, completed = StartupTransition.CompletedAt,
                    elapsed = StartupTransition.StartedAt > 0 ? StartupTransition.CompletedAt - StartupTransition.StartedAt : 0,
                    display = DisplayMetadata() });
            })) yield break;
            yield return Capture("player-title", false);
            if (!Guard(() => { Clear(); CurrentRewardCardZoom.Open(new CurrentRewardItem { Card = CardLibrary.FindById("tt7-bloodpoison"), State = "taken" }); })) yield break;
            for (int frame = 0; frame < 4; frame++) yield return null;
            yield return Capture("player-card-legacy-density", true);
            yield return Capture("player-card-native-density", false);
            if (!Guard(() => { Clear(); Sdt.UI.Screens.Misc.CardLibraryScreen.Open(); })) yield break;
            for (int frame = 0; frame < 4; frame++) yield return null;
            yield return Capture("player-photo", false);
            if (!Guard(() => { Clear(); UiStack.Show<Sdt.UI.Screens.Menu.SettingsScreen>("Settings"); })) yield break;
            for (int frame = 0; frame < 4; frame++) yield return null;
            yield return Capture("player-settings", false);
            if (_failed) yield break;
            Guard(() => File.WriteAllText(Path.Combine(Output, "result.json"), SaveJson.Stringify(new {
                passed = true, scope = "Actual standalone backbuffer; hidden parent; normal CanvasScaler and ScreenSpaceOverlay; constructed page opens; no OS input",
                display = DisplayMetadata(), records = _records
            })));
            if (!_failed) Application.Quit(0);
        }
        IEnumerator Capture(string name, bool legacy)
        {
            if (!Guard(() => {
                InlineIconText.SetLegacyDensityForBackgroundReview(legacy);
                foreach (var text in App.Canvas.GetComponentsInChildren<Text>()) text.SetAllDirty();
                Canvas.ForceUpdateCanvases();
            })) yield break;
            for (int frame = 0; frame < 3; frame++) yield return null;
            yield return new WaitForEndOfFrame();
            string path = Path.Combine(Output, name + ".png");
            if (!Guard(() => ScreenCapture.CaptureScreenshot(path))) yield break;
            float began = Time.realtimeSinceStartup;
            while (!PngReady(path) && !_failed && Time.realtimeSinceStartup - began < 15) yield return null;
            if (!Guard(() => {
                if (!PngReady(path)) throw new TimeoutException("Actual player backbuffer capture did not finish: " + name);
                _records.Add(new { kind = "actual-player-capture", name, legacyGlyphDensity = legacy,
                    frame = Time.frameCount, display = DisplayMetadata(), text = TextMetadata(), images = ImageMetadata() });
                File.WriteAllText(Path.Combine(Output, "trace.json"), SaveJson.Stringify(_records));
            })) yield break;
        }
        static void Clear() { while (UiStack.Count > 0) UiStack.Pop(); }
        static object DisplayMetadata()
        {
            var scaler = App.Canvas.GetComponent<CanvasScaler>();
            var bounds = ((RectTransform)App.Canvas.transform).rect;
            return new { screenWidth = Screen.width, screenHeight = Screen.height, Screen.dpi, fullScreenMode = Screen.fullScreenMode.ToString(),
                desktop = new { Screen.currentResolution.width, Screen.currentResolution.height },
                display = new { Display.main.renderingWidth, Display.main.renderingHeight, Display.main.systemWidth, Display.main.systemHeight },
                quality = QualitySettings.names[QualitySettings.GetQualityLevel()], Application.targetFrameRate,
                bufferWidthScale = ScalableBufferManager.widthScaleFactor, bufferHeightScale = ScalableBufferManager.heightScaleFactor,
                canvas = new { mode = App.Canvas.renderMode.ToString(), App.Canvas.scaleFactor, bounds.width, bounds.height,
                    lossyScale = Point(App.Canvas.transform.lossyScale), scaler = scaler.uiScaleMode.ToString(),
                    referenceWidth = scaler.referenceResolution.x, referenceHeight = scaler.referenceResolution.y, scaler.matchWidthOrHeight },
                windowsDpi = WindowsDpi(), graphics = SystemInfo.graphicsDeviceName, graphicsApi = SystemInfo.graphicsDeviceType.ToString(), Application.unityVersion, Application.buildGUID };
        }
        static object[] TextMetadata() => App.Canvas.GetComponentsInChildren<Text>().Select(text => {
            var inline = text as InlineIconText;
            float density = inline != null ? inline.GlyphPixelsPerUnit : text.pixelsPerUnit;
            var lines = text.cachedTextGenerator.lines;
            var characters = text.cachedTextGenerator.characters;
            return new { path = PathOf(text.transform), value = inline != null ? inline.RenderedText : text.text,
                text.fontSize, text.lineSpacing, font = text.font != null ? text.font.name : null,
                fontNativeSize = text.font != null ? text.font.fontSize : 0, fontLineHeight = text.font != null ? text.font.lineHeight : 0,
                dynamicFont = text.font != null && text.font.dynamic, insideInputField = text.GetComponentInParent<InputField>() != null, text.pixelsPerUnit, glyphPixelsPerUnit = density,
                fontTexture = FontTexture(text.font), glyphSample = GlyphSample(text, density),
                transformDensity = inline != null ? inline.TransformGlyphDensity : 1, lossyScale = Point(text.transform.lossyScale),
                width = text.rectTransform.rect.width, height = text.rectTransform.rect.height,
                screenBounds = Bounds(text.rectTransform), lines = lines.Select(line => new { line.startCharIdx, line.height, line.topY,
                    logicalTop = line.topY / Math.Max(.0001f, density), logicalCursorY = line.startCharIdx < characters.Count ? (float?)(characters[line.startCharIdx].cursorPos.y / Math.Max(.0001f, density)) : null }).ToArray(),
                vertices = text.cachedTextGenerator.verts.Take(8).Select(v => new { x = v.position.x / Math.Max(.0001f,density), y = v.position.y / Math.Max(.0001f,density) }).ToArray() };
        }).Cast<object>().ToArray();
        static object[] ImageMetadata() => App.Canvas.GetComponentsInChildren<Image>().Where(image => image.sprite != null).Select(image => new {
            path = PathOf(image.transform), sprite = image.sprite.name, texture = image.sprite.texture.name,
            width = image.sprite.texture.width, height = image.sprite.texture.height,
            spriteWidth = image.sprite.rect.width, spriteHeight = image.sprite.rect.height,
            filter = image.sprite.texture.filterMode.ToString(), mipCount = image.sprite.texture.mipmapCount,
            screenBounds = Bounds(image.rectTransform)
        }).Cast<object>().ToArray();
        static object Bounds(RectTransform rect)
        {
            var points = new Vector3[4]; rect.GetWorldCorners(points);
            var screen = points.Select(point => RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera, point)).ToArray();
            return new { minX = screen.Min(p => p.x), minY = screen.Min(p => p.y), maxX = screen.Max(p => p.x), maxY = screen.Max(p => p.y) };
        }
        static object Point(Vector3 point) => new { point.x, point.y, point.z };
        static object FontTexture(Font font)
        {
            var texture = font != null && font.material != null ? font.material.mainTexture : null;
            return texture == null ? null : new { texture.name, texture.width, texture.height, filter = texture.filterMode.ToString() };
        }
        static object GlyphSample(Text text, float density)
        {
            string content = text is InlineIconText inline ? inline.RenderedText : text.text;
            char sample = content.FirstOrDefault(character => character >= '\u4e00' && character <= '\u9fff');
            if (sample == default) sample = content.FirstOrDefault(char.IsLetterOrDigit);
            int pixels = Mathf.RoundToInt(text.fontSize * density);
            bool found = text.font != null && text.font.GetCharacterInfo(sample, out var info, pixels, text.fontStyle);
            if (!found) return new { found = false, character = sample.ToString(), requestedPixels = pixels };
            // Read only: do not request/rebuild the font atlas while taking the sample.
            text.font.GetCharacterInfo(sample, out info, pixels, text.fontStyle);
            return new { found = true, character = sample.ToString(), requestedPixels = pixels, info.glyphWidth, info.glyphHeight, info.advance };
        }
        static bool PngReady(string path)
        {
            try
            {
                if (!File.Exists(path)) return false;
                using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    if (stream.Length < 24) return false;
                    stream.Position = stream.Length - 12;
                    var tail = new byte[12]; if (stream.Read(tail, 0, 12) != 12) return false;
                    return tail[4] == 73 && tail[5] == 69 && tail[6] == 78 && tail[7] == 68;
                }
            }
            catch (IOException) { return false; }
        }
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("shcore.dll")]
        static extern int GetProcessDpiAwareness(IntPtr process, out int awareness);
#endif
        static object WindowsDpi()
        {
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
            int awareness;
            int result = GetProcessDpiAwareness(System.Diagnostics.Process.GetCurrentProcess().Handle, out awareness);
            return new { available = result == 0, processAwareness = awareness, result };
#else
            return new { available = false, reason = "Windows standalone only" };
#endif
        }
        static string PathOf(Transform transform)
        { var parts = new List<string>(); for (var node = transform; node != null; node = node.parent) parts.Add(node.name); parts.Reverse(); return string.Join("/", parts); }
        void Fail(Exception error)
        {
            if (_failed) return; _failed = true;
            File.WriteAllText(Path.Combine(Output, "result.json"), SaveJson.Stringify(new { passed = false, error = error.ToString(), records = _records }));
            Application.Quit(2);
        }
    }
}
