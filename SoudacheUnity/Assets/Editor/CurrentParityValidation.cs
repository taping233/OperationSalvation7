// Explicit native checks for the 1031 source-parity batch. Uses an isolated profile and no OS input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentParityValidation
    {
        const string Active = "Sdt.Parity1031.Active";
        static IEnumerator _flow;
        static double _started;
        static readonly List<string> Checks = new List<string>();
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static CurrentParityValidation() { EditorApplication.update += Tick; }
        public static void Run()
        {
            if (string.IsNullOrEmpty(Output)) throw new InvalidOperationException("Output required");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile"));
            AssetDatabase.DisallowAutoRefresh(); SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || App.Canvas == null) return;
            if (_started == 0) _started = EditorApplication.timeSinceStartup;
            try
            {
                Require(EditorApplication.timeSinceStartup - _started < 50, "native parity timeout: " + CurrentArenaFilterChecks.Step, false);
                if (_flow == null) _flow = Flow();
                if (!_flow.MoveNext()) Finish(null);
            }
            catch (Exception error) { Finish(error); }
        }
        static void Require(bool condition, string label, bool record = true)
        { if (!condition) throw new InvalidOperationException(label); if (record) Checks.Add(label); }
        static object Field(object target, string name) => target.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic).GetValue(target);
        static object Invoke(object target, string name, params object[] arguments) => target.GetType().GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic).Invoke(target, arguments);
        static void CheckSfxShelf()
        {
            var type = typeof(AudioService).Assembly.GetType("Sdt.Run.CurrentSfxShelfKernel", true);
            object NewKernel() { var kernel = Activator.CreateInstance(type, true); type.GetMethod("SetSampleRate").Invoke(kernel, new object[] { 48000 }); return kernel; }
            void Process(object kernel, float[] data, int channels) => type.GetMethod("Process").Invoke(kernel, new object[] { data, channels });
            double ToneGain(double frequency)
            {
                var data = new float[8192]; double inputEnergy = 0;
                for (int i = 0; i < data.Length; i++) { data[i] = (float)(.5 * Math.Sin(2 * Math.PI * frequency * i / 48000)); if (i >= 512) inputEnergy += data[i] * data[i]; }
                Process(NewKernel(), data, 1); double outputEnergy = 0;
                for (int i = 512; i < data.Length; i++) outputEnergy += data[i] * data[i];
                return Math.Sqrt(outputEnergy / inputEnergy);
            }
            Require(Math.Abs(ToneGain(200) - 1) < .005, "actual SFX shelf preserves low-frequency level");
            Require(Math.Abs(20 * Math.Log10(ToneGain(18000)) + 4) < .05, "actual SFX shelf attenuates high frequencies by source 4dB");
            var whole = new float[4096];
            for (int i = 0; i < whole.Length / 2; i++) { whole[2 * i] = (float)Math.Sin(2 * Math.PI * 800 * i / 48000); whole[2 * i + 1] = (float)Math.Cos(2 * Math.PI * 9000 * i / 48000); }
            var split = (float[])whole.Clone(); var continuous = NewKernel(); var blocked = NewKernel();
            Process(continuous, whole, 2);
            for (int i = 0; i < split.Length; i += 256) { var block = new float[256]; Array.Copy(split, i, block, 0, block.Length); Process(blocked, block, 2); Array.Copy(block, 0, split, i, block.Length); }
            Require(whole.Zip(split, (left, right) => Math.Abs(left - right)).Max() < .000001, "audio buffers retain independent stereo filter history");
            type.GetMethod("RequestReset").Invoke(continuous, null); var silence = new float[512]; Process(continuous, silence, 2);
            Require(silence.All(value => value == 0), "reused SFX voice clears the previous clip filter tail");
        }
        static IEnumerator Flow()
        {
            var text = UIKit.Label(App.Canvas.transform, "生命 [[icon:heart]] 12", 20, Color.white) as InlineIconText;
            Require(text != null, "production text uses inline renderer");
            // UIKit assigns the font after text; let the normal first layout synchronize that initial document.
            yield return null;
            object document = Field(text, "_document"); text.text = text.text;
            Require(ReferenceEquals(document, Field(text, "_document")), "identical HUD text reuses parsed document");
            text.fontSize += 2; text.text = text.text;
            Require(!ReferenceEquals(document, Field(text, "_document")), "font change still refreshes identical text");
            text.text = "生命 7"; Require(text.SourceText == "生命 7", "changed text still refreshes");
            UnityEngine.Object.Destroy(text.gameObject);

            var preferences = typeof(CurrentUiPreferences).GetProperty("Performance", BindingFlags.Static | BindingFlags.NonPublic);
            Require(CurrentUiPreferences.TrySetPerformance("low", 30, out var reason), reason);
            object first = preferences.GetValue(null); Require(ReferenceEquals(first, preferences.GetValue(null)), "unchanged settings reuse parsed object");
            Require(CurrentUiPreferences.Quality == "low" && CurrentUiPreferences.FrameLimit == 30, "low30 settings consumed");
            Require(CurrentUiPreferences.TrySetPerformance("high", 120, out reason), reason);
            Require(!ReferenceEquals(first, preferences.GetValue(null)) && CurrentUiPreferences.FrameLimit == 120, "settings revision invalidates cache");
            Require(CurrentUiPreferences.TrySetPerformance("balanced", 60, out reason), reason);

            var audio = AudioService.I;
            CheckSfxShelf();
            var nativeVoices = ((Array)Field(audio, "_voices")).Cast<object>().Select(voice => (AudioSource)voice.GetType().GetField("source").GetValue(voice)).ToArray();
            var sfxBus = nativeVoices[0].outputAudioMixerGroup;
            Require(sfxBus != null && sfxBus.name == "SFX" && nativeVoices.All(voice => voice.outputAudioMixerGroup == sfxBus), "all ten native SFX voices share the formal SFX processing bus");
            Require(((AudioSource)Field(audio, "_bgm")).outputAudioMixerGroup == null && ((AudioSource)Field(audio, "_titleBgm")).outputAudioMixerGroup == null, "both BGM channels bypass the SFX compressor");
            var gain = typeof(AudioService).GetMethod("DbGain", BindingFlags.Static | BindingFlags.NonPublic);
            Require((float)gain.Invoke(null, new object[] { 0f }) == 0 && Math.Abs((float)gain.Invoke(null, new object[] { .5f }) - .17782794f) < .00001f && (float)gain.Invoke(null, new object[] { 1f }) == 1, "source decibel curve endpoints and midpoint");
            Invoke(audio, "StopSfx");
            Require((bool)Invoke(audio, "ShouldPlay", "click", 1.0), "first click admitted");
            Require(!(bool)Invoke(audio, "ShouldPlay", "click", 1.01), "source 28ms click cooldown");
            Require(!(bool)Invoke(audio, "ShouldPlay", "deny", 1.1), "source click-deny suppression");
            Require((bool)Invoke(audio, "ShouldPlay", "deny", 1.4), "deny resumes beyond suppression");
            Invoke(audio, "StopSfx");
            for (int i = 0; i < 4; i++) Require((bool)Invoke(audio, "ShouldPlay", "confirm", 2.0 + i * .001), "recent source events admitted", false);
            Require(!(bool)Invoke(audio, "ShouldPlay", "hover", 2.004), "dense settlement suppresses decorative audio");
            App.ShowTitle();
            Require(audio.IsSubpageOpen != null && !audio.IsSubpageOpen(), "source title permits generic UI audio");
            var settings = UiStack.Show<Sdt.UI.Screens.Menu.SettingsScreen>("Settings");
            Require(audio.IsSubpageOpen(), "native settings owns subpage audio suppression");
            Invoke(audio, "StopSfx"); long sequence = (long)Field(audio, "_sequence");
            audio.PlaySfx("click"); audio.PlaySfx("hover");
            Require((long)Field(audio, "_sequence") == sequence, "subpage generic sounds do not acquire native voices");
            Require(!((IDictionary)Field(audio, "_lastSfxAt")).Contains("click"), "suppressed subpage click does not enter the source cooldown history");
            audio.PlaySfx("deny");
            Require((long)Field(audio, "_sequence") == sequence + 1, "suppressed click does not suppress named deny feedback");
            Invoke(audio, "StopSfx"); audio.PlaySfx("ding");
            Require((long)Field(audio, "_sequence") == sequence + 2, "named success feedback remains audible in subpages");
            settings.CloseFromEscape(); Require(!audio.IsSubpageOpen(), "closing settings restores title audio scope");
            Invoke(audio, "StopSfx"); audio.PlaySfx("click");
            Require((long)Field(audio, "_sequence") == sequence + 3, "title generic click still acquires a native voice");
            AudioSource LastVoice() => ((Array)Field(audio, "_voices")).Cast<object>()
                .OrderByDescending(voice => (long)voice.GetType().GetField("sequence").GetValue(voice))
                .Select(voice => (AudioSource)voice.GetType().GetField("source").GetValue(voice)).First();
            Invoke(audio, "StopSfx"); audio.PlaySfx("hit", null, 1.18f);
            Require(Math.Abs(LastVoice().pitch - 1) < .00001f, "source hit ignores rateScale");
            Invoke(audio, "StopSfx"); audio.PlaySfx("foeLunge", null, .5f);
            Require(Math.Abs(LastVoice().pitch - 1) < .00001f, "source lunge rateScale lower bound");
            Invoke(audio, "StopSfx"); audio.PlaySfx("foeLunge", null, 2f);
            Require(Math.Abs(LastVoice().pitch - 1.5f) < .00001f, "source lunge rateScale upper bound");
            Invoke(audio, "StopSfx"); audio.PlaySfx("gain", null, 2f);
            Require(Math.Abs(LastVoice().pitch - 1.08f) < .00001f, "named cue retains its source rate");
            Invoke(audio, "StopSfx"); audio.PlaySfx("bossReveal"); audio.SetSfxVolume(0);
            foreach (var voice in (Array)Field(audio, "_voices")) Require(((AudioSource)voice.GetType().GetField("source").GetValue(voice)).volume == 0, "live SFX slider reaches zero", false);
            Checks.Add("live SFX slider reaches zero"); audio.SetSfxVolume(1);
            yield return null;
            audio.SetMusicVolume(.5f); audio.PlayBgm("board");
            Require(audio.MusicScene == "board" && audio.MusicAsset != null, "current exploration music loads");
            audio.PlayBgm("battle"); Require(Math.Abs((float)typeof(AudioService).GetProperty("MusicGain", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(audio) - .45f * .17782794f * .45f) < .00001f, "source battle music ducking");
            audio.Mute(true); foreach (var voice in (Array)Field(audio, "_voices")) Require(!((AudioSource)voice.GetType().GetField("source").GetValue(voice)).isPlaying, "mute stops active native SFX", false);
            Require(!((AudioSource)Field(audio, "_bgm")).isPlaying && !((AudioSource)Field(audio, "_titleBgm")).isPlaying, "mute immediately stops both music channels");
            audio.Mute(false); audio.PlayBgm("title");
            Require(audio.MusicScene == "title" && audio.MusicAsset != null, "music resumes current four-track catalog");
            yield return null;

            bool filterDone = false; Exception filterError = null;
            IEnumerator ArenaChecks()
            {
                var routine = CurrentArenaFilterChecks.Run();
                while (true)
                {
                    object next;
                    try { if (!routine.MoveNext()) break; next = routine.Current; }
                    catch (Exception error) { filterError = error; break; }
                    yield return next;
                }
                filterDone = true;
            }
            UnityEngine.Object.FindAnyObjectByType<Sdt.Boot.GameBoot>().StartCoroutine(ArenaChecks());
            while (!filterDone) yield return null;
            Require(filterError == null, "actual arena GPU alpha, child tracking and lifecycle: " + filterError);

            bool altarDone = false; Exception altarError = null;
            IEnumerator AltarChecks()
            {
                var routine = CurrentAltarRestoreFocusChecks.Run();
                while (true)
                {
                    object next;
                    try { if (!routine.MoveNext()) break; next = routine.Current; }
                    catch (Exception error) { altarError = error; break; }
                    yield return next;
                }
                altarDone = true;
            }
            UnityEngine.Object.FindAnyObjectByType<Sdt.Boot.GameBoot>().StartCoroutine(AltarChecks());
            while (!altarDone) yield return null;
            Require(altarError == null, "actual altar restore submit/focus continuity, save rollback and ownership: " + altarError);

            var game = GameRuntime.I;
            game.ResetSlot(5); game.NewRun(5, "wu"); Require(game.AbandonRun() != null, "isolated hub fixture closes current run");
            Sdt.UI.Screens.Run.CurrentRunFilm.CancelActive(); while (UiStack.Count > 0) UiStack.Pop();
            Sdt.UI.Screens.Hub.HubScreen.Open("stash"); yield return null;
            var hub = UiStack.Top as Sdt.UI.Screens.Hub.HubScreen;
            Require(hub != null, "native hub owner mounted");
            game.Bus.Emit(new ToastRequested { Text = "基地操作未完成，请重试。", Tone = "warn" }); yield return null;
            var notice = hub.transform.Find("camp-notice") as RectTransform;
            Require(notice != null && notice.parent == hub.transform && notice.anchorMin == new Vector2(1, 0) && notice.anchoredPosition == new Vector2(-32, 24), "hub notice belongs to base at source bottom/right");
            Require(!notice.GetComponent<Image>().raycastTarget, "hub notice never blocks player input");
            double until = EditorApplication.timeSinceStartup + 3.35;
            while (EditorApplication.timeSinceStartup < until) yield return null;
            Require(notice.gameObject.activeSelf, "hub warning persists until owner clears or replaces it");
            game.Bus.Emit(new ToastRequested { Text = "基地操作已完成。", Tone = "ok" });
            until = EditorApplication.timeSinceStartup + 3.35;
            while (EditorApplication.timeSinceStartup < until) yield return null;
            Require(!notice.gameObject.activeSelf, "hub success expires after source 3200ms");
            game.Bus.Emit(new ToastRequested { Text = "切页前警告", Tone = "warn" });
            var tab = hub.GetComponentsInChildren<Button>().Single(button => button.name == "hub-tab shop");
            UnityEngine.EventSystems.ExecuteEvents.Execute(tab.gameObject, new UnityEngine.EventSystems.BaseEventData(UnityEngine.EventSystems.EventSystem.current), UnityEngine.EventSystems.ExecuteEvents.submitHandler);
            yield return null;
            Require(hub.GetComponentsInChildren<Text>().All(label => label.text != "切页前警告"), "hub navigation clears its previous operation channel");
        }
        static void Finish(Exception error)
        {
            SessionState.SetBool(Active, false);
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = error == null, error = error?.ToString(), checks = Checks, scope = "Native production text, settings cache and audio policy/state; no acoustic or physical-input claim." }, Formatting.Indented));
            EditorApplication.Exit(error == null ? 0 : 2);
        }
    }
}
