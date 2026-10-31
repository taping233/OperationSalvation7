// Native adapter for cinematic-profiles, silent-node-film and map-passage.
// A film owns only its curtain; the caller still owns saving, battle and node state.
using System;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    [Serializable] public sealed class CurrentCinematicProfile
    {
        public string kind, art, renderer, label, background, motion, exit;
        public int duration, exitDuration;
    }
    [Serializable] public sealed class CurrentLayerFilmProfile { public string art, motion; }
    [Serializable] public sealed class CurrentEncounterSpec { public string id, kind, title, line; }
    [Serializable] sealed class CurrentCinematicCatalog
    { public CurrentCinematicProfile[] profiles=Array.Empty<CurrentCinematicProfile>(); public CurrentLayerFilmProfile[] layers=Array.Empty<CurrentLayerFilmProfile>(); public CurrentEncounterSpec[] encounters=Array.Empty<CurrentEncounterSpec>(); }

    public sealed partial class CurrentRunFilm : MonoBehaviour, IPointerClickHandler
    {
        static CurrentRunFilm _current;
        static CurrentCinematicCatalog _catalog;
        static readonly string[] Motions = { "reflection", "shelter", "develop", "raking-light", "pressure", "disturb", "breath", "scan", "stroke", "threshold", "glide", "unveil", "aperture", "beacon", "recede", "release", "layer-descent", "layer-watchline", "layer-ruins", "layer-core" };
        Material _material; RawImage _picture; CanvasGroup _canvasGroup, _caption; Canvas _surfaceCanvas;
        CurrentCinematicProfile _profile; Func<bool> _valid; Action _after, _finishedCallback;
        Panel _owner; bool _blocking, _allowOwnerChange, _continued, _skipped, _arrowOnly, _disposed, _entry, _canSkip;
        bool _navigation, _navigationCaptured;
        double _started, _reveal = double.PositiveInfinity;
        float _duration, _exitDuration; int _frames;
        public static bool Active => _current != null && _current._blocking && !_current._disposed;
        public static bool Visible => _current != null && !_current._disposed;
        public static CurrentRunFilm Current => _current;
        public string Kind => _profile?.kind;
        public float PlaybackProgress => _duration <= 0 ? 1 : Mathf.Clamp01((float)(Time.realtimeSinceStartupAsDouble - _started) / _duration);
        public bool WaitingForDestination => !_continued;
        public bool IsRevealing => !double.IsPositiveInfinity(_reveal);
        public bool ShaderReady => _material != null && _material.shader.isSupported;
        public float DurationSeconds => _duration;
        public float ExitSeconds => _exitDuration;
        // Completion means the shared reveal finished. Cancellation never executes destination work.
        public void WhenFinished(Action after) { if (!_disposed) _finishedCallback += after; }
        public static CurrentCinematicProfile Profile(string kind)
        {
            if (_catalog == null)
            {
                var source = Resources.Load<TextAsset>("Data/CurrentCinematicProfiles");
                if (source == null) throw new InvalidOperationException("Current cinematic profiles were not imported.");
                _catalog = JsonConvert.DeserializeObject<CurrentCinematicCatalog>(source.text);
                if (_catalog?.profiles?.Length != 17 || _catalog.layers?.Length != 4) throw new InvalidOperationException("Current cinematic profile catalog is incomplete.");
            }
            return _catalog.profiles.FirstOrDefault(p => p.kind == kind) ?? _catalog.profiles.First(p => p.kind == "loading");
        }
        public static CurrentEncounterSpec Encounter(string id)
        { Profile("loading"); return _catalog.encounters?.FirstOrDefault(item => item.id == id); }
        // Global App routing calls this before its keyboard/right-click dispatch.
        public static bool ConsumeGlobalInput()
        {
            if (!Active) return false;
            if (Input.GetKeyDown(KeyCode.Escape) && _current._entry)
            { var owner = _current._owner; _current.Dispose(); if (owner != null && UiStack.Top == owner) owner.CloseFromEscape(); }
            else if (Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter)) _current.Skip();
            return true;
        }
        public static void CancelActive() { if (_current != null) _current.Dispose(); }
        // page-loading facades paint feedback on every visit, including a warm module.
        // Unity has synchronous page construction; keep its exact owner under the curtain.
        public static CurrentRunFilm PageEntry(Panel owner, bool photo = false)
        {
            if (owner == null || UiStack.Top != owner) return null;
            var film = Play(photo ? "photo" : "loading", isCurrent: () => owner != null && UiStack.Top == owner,
                durationMs: photo ? 1100 : 160, exitMs: photo ? 760 : 420);
            if (film != null) { film._entry = true; film._started = double.PositiveInfinity; }
            return film;
        }
        public static bool AfterPassage(Action after)
        {
            if (_current == null || _current.Kind != "passage" || _current._disposed) return false;
            _current._finishedCallback += after; return true;
        }
        public static CurrentRunFilm Play(string kind, Action after = null, Func<bool> isCurrent = null,
            bool blocking = true, bool allowOwnerChange = false, int? durationMs = null, int? exitMs = null, bool skippable = true)
        {
            CancelActive();
            if (isCurrent != null && !isCurrent()) return null;
            if (CurrentUiPreferences.ReducedMotion) { after?.Invoke(); return null; }
            var profile = Profile(kind);
            var root = new GameObject("current-film-" + kind, typeof(RectTransform), typeof(Canvas), typeof(GraphicRaycaster), typeof(CanvasGroup));
            root.transform.SetParent(App.UiRoot, false); UiStack.Stretch((RectTransform)root.transform);
            var canvas = root.GetComponent<Canvas>(); canvas.overrideSorting = true; canvas.sortingOrder = 32767;
            var film = root.AddComponent<CurrentRunFilm>(); _current = film;
            film._surfaceCanvas=canvas;film.SyncSort();
            film._profile = profile; film._valid = isCurrent; film._after = after; film._blocking = blocking;
            film._allowOwnerChange = allowOwnerChange; film._owner = UiStack.Top;
            film._canSkip = skippable;
            film._duration = (durationMs ?? profile.duration) / 1000f;
            // Rich page curtains use the shared revealTransition minimum, not just profile.exitDuration.
            film._exitDuration = (exitMs ?? Math.Max(680, profile.exitDuration)) / 1000f;
            film._arrowOnly = kind == "extraction"; film._started = Time.realtimeSinceStartupAsDouble;
            film._canvasGroup = root.GetComponent<CanvasGroup>(); film._canvasGroup.blocksRaycasts = blocking;
            var scenery = new GameObject("silent-film-scenery", typeof(RectTransform), typeof(RawImage));
            scenery.transform.SetParent(root.transform, false); UiStack.Stretch((RectTransform)scenery.transform);
            film._picture = scenery.GetComponent<RawImage>(); film._picture.raycastTarget = blocking;
            var shader = Resources.Load<Shader>("CurrentRunFilm");
            if (shader != null) { film._material = new Material(shader) { name = "current-source-film-" + kind }; film._picture.material = film._material; }
            else Debug.LogWarning("Current film shader is unavailable; keeping the source curtain colour.");
            film.SetArtwork(profile.art, profile.renderer == "image", profile.motion);
            if (kind == "extraction") film.ExtractionCaption();
            if (kind == "extraction") film.SkipArrow();
            if (blocking && EventSystem.current != null)
            {
                film._navigation = EventSystem.current.sendNavigationEvents; film._navigationCaptured = true;
                EventSystem.current.sendNavigationEvents = false;
            }
            film.Paint(); return film;
        }
        public static CurrentRunFilm Passage(int from, int to)
        {
            var g = GameRuntime.I; int? seed = g.State.seed; var map = g.Map;
            if (from == to || CurrentUiPreferences.ReducedMotion) return null;
            var film = Play("passage", null, () => g.State.runActive && g.State.seed == seed && ReferenceEquals(g.Map, map)
                && g.State.layerIdx == to && (g.State.Phase == "idle" || g.State.Phase == "moving" || g.State.Phase == "modal"),
                allowOwnerChange: true, durationMs: 3600, exitMs: 700);
            if (film == null) return null;
            var layer = _catalog.layers[to >= 0 && to < _catalog.layers.Length ? to : 0];
            film.SetArtwork(layer.art, true, layer.motion);
            film.LayerCaption(from, to, to >= 0 && to < g.Layers.Count ? g.Layers[to].name : "");
            return film;
        }
        public void Skip()
        {
            if (_disposed || !_canSkip || _entry || Kind == "passage" || !_blocking) return;
            _skipped = true;
        }
        public void OnPointerClick(PointerEventData eventData)
        { if (!_arrowOnly && eventData.button == PointerEventData.InputButton.Left) Skip(); }
        void OnEnable()=>Canvas.willRenderCanvases+=SyncSort;
        void OnDisable()=>Canvas.willRenderCanvases-=SyncSort;
        void SyncSort(){if(_surfaceCanvas!=null&&App.Canvas!=null)_surfaceCanvas.sortingLayerID=App.Canvas.sortingLayerID;}
        void SetArtwork(string key, bool image, string motion)
        {
            _picture.texture = image ? Resources.Load<Texture2D>(key) : Texture2D.whiteTexture;
            _picture.color = _material == null ? Theme.Hex(_profile.background) : Color.white;
            if (_material == null) return;
            _material.SetFloat("_HasImage", image && _picture.texture != null ? 1 : 0);
            _material.SetFloat("_Motion", Array.IndexOf(Motions, motion));
            _material.SetColor("_Background", Theme.Hex(_profile.background));
            _material.SetFloat("_Exit", Array.IndexOf(new[] { "fade", "gate", "iris", "slash", "slide", "lift" }, _profile.exit));
            if (Kind == "passage") _material.SetFloat("_Exit", 0);
        }
        void Update()
        {
            if (_disposed) return;
            if ((_valid != null && !_valid()) || (!_allowOwnerChange && _owner != UiStack.Top)) { Dispose(); return; }
            _frames++;
            if (_blocking && EventSystem.current != null) EventSystem.current.sendNavigationEvents = false;
            double now = Time.realtimeSinceStartupAsDouble;
            if (_entry && double.IsPositiveInfinity(_started)) _started = now;
            if (!_continued && (_skipped || CurrentUiPreferences.ReducedMotion || now - _started >= _duration) && _frames >= 2)
            {
                _continued = true; var after = _after; _after = null;
                try { after?.Invoke(); } catch (Exception error) { Debug.LogException(error); Dispose(); return; }
                if (_current != this || _disposed) return;
                _owner = UiStack.Top; _reveal = now;
                if (_skipped) _exitDuration = Kind == "extraction" || Kind == "departure" ? .14f : Kind == "battle" || Kind == "boss" ? .68f : 0;
            }
            Paint();
            if (!double.IsPositiveInfinity(_reveal) && (CurrentUiPreferences.ReducedMotion || now - _reveal >= _exitDuration))
            { var finished = _finishedCallback; _finishedCallback = null; Dispose(); finished?.Invoke(); }
        }
        void Paint()
        {
            float exit = double.IsPositiveInfinity(_reveal) ? 0 : Mathf.Clamp01((float)(Time.realtimeSinceStartupAsDouble - _reveal) / Mathf.Max(.001f, _exitDuration));
            if (_material != null)
            {
                var rect = ((RectTransform)transform).rect;
                _material.SetVector("_Viewport", new Vector4(rect.width, rect.height, 0, 0));
                _material.SetFloat("_Progress", _skipped ? 1 : PlaybackProgress);
                _material.SetFloat("_Reveal", exit);
                PaintSourceMotion(_skipped ? 1 : PlaybackProgress);
            }
            if (_caption != null)
            {
                float caption = SourceEaseOut(Mathf.Clamp01((float)(Time.realtimeSinceStartupAsDouble - _started - .65) / .85f));
                _caption.alpha = Kind == "passage" ? caption * (1 - Mathf.Clamp01(exit * _exitDuration / .36f)) : 1 - exit;
                if (Kind == "passage") ((RectTransform)_caption.transform).anchoredPosition = new Vector2(0, -10 * (1 - caption));
            }
        }
        void ExtractionCaption()
        {
            var label = UIKit.Label(transform, "撤离成功", 38, Theme.Hex("#213038"));
            var rt = label.rectTransform; rt.anchorMin = new Vector2(0, .32f); rt.anchorMax = new Vector2(1, .42f); rt.offsetMin = rt.offsetMax = Vector2.zero;
            label.alignment = TextAnchor.UpperCenter; label.fontStyle = FontStyle.Bold;
            _caption = label.gameObject.AddComponent<CanvasGroup>();
        }
        void SkipArrow()
        {
            var button = UIKit.Btn(transform, "↗", Skip);
            var rt = (RectTransform)button.transform; rt.anchorMin = rt.anchorMax = new Vector2(1, 0); rt.pivot = new Vector2(1, 0);
            rt.anchoredPosition = new Vector2(-115, 65); rt.sizeDelta = new Vector2(64, 44);
            button.GetComponent<Image>().color = Color.clear;
        }
        void LayerCaption(int from, int to, string region)
        {
            var root = new GameObject("layer-passage-caption", typeof(RectTransform), typeof(CanvasGroup)); root.transform.SetParent(transform, false);
            var rt = root.GetComponent<RectTransform>(); rt.anchorMin = new Vector2(.09f, .2f); rt.anchorMax = new Vector2(.36f, .57f); rt.offsetMin = rt.offsetMax = Vector2.zero;
            _caption = root.GetComponent<CanvasGroup>(); _caption.alpha = 0;
            void Place(RectTransform item, float y, float height, float width = 0)
            {
                item.anchorMin = new Vector2(0, 1); item.anchorMax = width > 0 ? item.anchorMin : Vector2.one;
                item.pivot = new Vector2(0, 1); item.anchoredPosition = new Vector2(0, -y); item.sizeDelta = new Vector2(width, height);
            }
            var rule = new GameObject("caption-rule", typeof(RectTransform), typeof(Image)); rule.transform.SetParent(root.transform, false);
            rule.GetComponent<Image>().color = Theme.Hex("#8c5240"); rule.GetComponent<Image>().raycastTarget = false; Place((RectTransform)rule.transform, 0, 1, 36);
            var cue = UIKit.Label(root.transform, to > from ? "继续深入" : "返回上层", 12, Theme.Hex("#a49b8d")); Place(cue.rectTransform, 23, 18);
            var title = UIKit.Label(root.transform, "第 " + (to + 1) + " 层", 42, Theme.Hex("#d8d3c7")); Place(title.rectTransform, 55, 63);
            var name = UIKit.Label(root.transform, region, 14, Theme.Hex("#a9a69b")); Place(name.rectTransform, 130, 21);
        }
        void Dispose()
        {
            if (_disposed) return;
            _disposed = true; _after = _finishedCallback = null;
            if (_current == this)
            {
                _current = null;
                if (_navigationCaptured && EventSystem.current != null) EventSystem.current.sendNavigationEvents = _navigation;
            }
            gameObject.SetActive(false); Destroy(gameObject);
        }
        void OnDestroy()
        { if (!_disposed) Dispose(); if (_material != null) Destroy(_material); }
    }
}
