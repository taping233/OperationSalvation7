using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    // Native wheel routing for the shared source card-description overflow area.
    [InitializeOnLoad]
    public static class CurrentCardScrollValidation
    {
        const string Active = "Sdt.CurrentCardScroll.Active";
        static int _step;
        static double _next, _start;
        static ScrollRect _scroll;
        static readonly List<object> Records = new List<object>();
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static CurrentCardScrollValidation() { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        public static void Run()
        {
            if (string.IsNullOrWhiteSpace(Output)) throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT required");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-reading-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            AssetDatabase.DisallowAutoRefresh(); SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Require(bool passed, string reason) { if (!passed) throw new InvalidOperationException(reason); }
        static void Observe(string message, string stack, LogType type)
        { if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception)) Finish(new InvalidOperationException(message + "\n" + stack)); }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || App.Canvas == null || EditorApplication.timeSinceStartup < _next) return;
            if (_start == 0) _start = EditorApplication.timeSinceStartup;
            _next = EditorApplication.timeSinceStartup + 1;
            try
            {
                Require(EditorApplication.timeSinceStartup - _start < 40, "reading overflow validation timeout");
                switch (_step++)
                {
                    case 0:
                        OffscreenCapture.PrepareReference(); while (UiStack.Count > 0) UiStack.Pop();
                        Require(CurrentUiPreferences.TrySetFlag("sdt-reading-large", true, out var error), error);
                        CurrentRewardCardZoom.Open(new CurrentRewardItem { Card = CardLibrary.FindById("tt7-bloodpoison"), State = "taken" }); break;
                    case 1:
                        Canvas.ForceUpdateCanvases();
                        _scroll = UiStack.Top.GetComponentsInChildren<ScrollRect>().Single(s => s.name == "rules");
                        Require(_scroll.content.rect.height > _scroll.viewport.rect.height + 10, "long description did not overflow its source viewport");
                        Require(_scroll.verticalScrollbar != null && _scroll.verticalScrollbar.gameObject.activeInHierarchy, "source thin scrollbar missing");
                        Require(_scroll.verticalNormalizedPosition > .99f, "description did not initially open at its top");
                        Capture("reading-top"); Wheel(-100); break;
                    case 2:
                        Canvas.ForceUpdateCanvases();
                        Require(_scroll.verticalNormalizedPosition < .001f, "wheel did not reach description end");
                        var bottom = _scroll.viewport.InverseTransformPoint(_scroll.content.TransformPoint(new Vector3(0, _scroll.content.rect.yMin, 0))).y;
                        Require(Mathf.Abs(bottom - _scroll.viewport.rect.yMin) < 1, "last description line cannot enter viewport");
                        Capture("reading-bottom"); Wheel(100); break;
                    case 3:
                        Require(_scroll.verticalNormalizedPosition > .999f, "reverse wheel did not return to source top");
                        Capture("reading-return-top"); Finish(null); break;
                }
            }
            catch (Exception error) { Finish(error); }
        }
        static void Wheel(float delta)
        {
            var point = RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera, _scroll.viewport.TransformPoint(_scroll.viewport.rect.center));
            var data = new PointerEventData(EventSystem.current) { position = point, scrollDelta = new Vector2(0, delta) };
            var hits = new List<RaycastResult>(); EventSystem.current.RaycastAll(data, hits);
            var first = hits.FirstOrDefault().gameObject;
            var receiver = first == null ? null : ExecuteEvents.GetEventHandler<IScrollHandler>(first);
            Records.Add(new { kind = "constructed-native-wheel", delta, first = first == null ? null : first.name, receiver = receiver == null ? null : receiver.name });
            Require(receiver == _scroll.gameObject, "native raycast did not route wheel to inner description scroll");
            Require(ExecuteEvents.Execute(receiver, data, ExecuteEvents.scrollHandler), "inner native scroll handler rejected event");
        }
        static void Capture(string name)
        {
            Records.Add(new { kind = "capture", name, description = _scroll.content.GetComponent<Text>().text,
                contentHeight = _scroll.content.rect.height, viewportHeight = _scroll.viewport.rect.height,
                position = _scroll.verticalNormalizedPosition, thumbSize = _scroll.verticalScrollbar.size,
                capture = OffscreenCapture.Write(Path.Combine(Output, name + ".png")) });
        }
        static void Finish(Exception error)
        {
            if (!SessionState.GetBool(Active, false)) return;
            SessionState.SetBool(Active, false);
            File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new {
                passed = error == null, scenario = "current-large-card-native-wheel", osHardwareInput = false,
                input = "constructed uGUI RaycastAll + ExecuteEvents.scrollHandler; source shared production CardFace",
                error = error?.ToString(), records = Records
            }, Formatting.Indented));
            EditorApplication.Exit(error == null ? 0 : 2);
        }
    }
}
