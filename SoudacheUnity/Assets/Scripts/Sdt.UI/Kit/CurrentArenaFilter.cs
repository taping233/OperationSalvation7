// battle-infusion.css: blur only the mounted arena, then composite it at opacity .72.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    public sealed class CurrentArenaFilter : MonoBehaviour
    {
        const int CaptureLayer = 31;
        static readonly Dictionary<RectTransform, CurrentArenaFilter> Active = new Dictionary<RectTransform, CurrentArenaFilter>();
        static readonly Dictionary<RectTransform, CurrentArenaFilter> Pending = new Dictionary<RectTransform, CurrentArenaFilter>();
        readonly Dictionary<Transform, int> _layers = new Dictionary<Transform, int>();
        readonly Dictionary<Graphic, Material> _materials = new Dictionary<Graphic, Material>();
        readonly List<Transform> _nodes = new List<Transform>();
        readonly List<Graphic> _graphics = new List<Graphic>();
        readonly HashSet<Transform> _seenNodes = new HashSet<Transform>();
        readonly HashSet<Graphic> _seenGraphics = new HashSet<Graphic>();
        readonly List<Transform> _removedNodes = new List<Transform>();
        readonly List<Graphic> _removedGraphics = new List<Graphic>();
        readonly Vector3[] _corners = new Vector3[4];
        RectTransform _arena, _surface, _captureRoot;
        Transform _parent;
        RawImage _image;
        Camera _camera;
        Material _captureMaterial, _displayMaterial, _blurMaterial;
        RenderTexture _capture, _horizontal, _result;
        RectState _original;
        int _sibling, _renderedFrame = -1;
        double _nextRender;
        bool _open, _rendering, _deferred, _reopen;
        int _deferredFrame;
        Vector2 _size;

        public static void Set(RectTransform arena, bool enabled)
        {
            if (arena == null) return;
            if (Pending.TryGetValue(arena, out var pending))
            {
                if (pending != null) { pending._reopen = enabled; return; }
                Pending.Remove(arena);
            }
            if (Active.TryGetValue(arena, out var filter))
            {
                if (filter != null) { if (!enabled) filter.Close(); return; }
                Active.Remove(arena);
            }
            if (!enabled || arena.parent == null || !arena.gameObject.activeInHierarchy) return;
            var surface = new GameObject("current-arena-filter", typeof(RectTransform), typeof(CanvasRenderer), typeof(RawImage));
            filter = surface.AddComponent<CurrentArenaFilter>();
            try { filter.Open(arena); }
            catch { filter.Close(); throw; }
        }

        void Open(RectTransform arena)
        {
            _arena = arena; _parent = arena.parent;
            _original = new RectState(arena); _sibling = arena.GetSiblingIndex();
            _surface = (RectTransform)transform; _surface.SetParent(arena.parent, false);
            _original.Apply(_surface); _surface.SetSiblingIndex(_sibling);
            _open = true; Active.Add(arena, this);
            _image = GetComponent<RawImage>(); _image.raycastTarget = false; _image.color = Color.white;
            _captureMaterial = NewMaterial("CurrentArenaUI");
            _displayMaterial = NewMaterial("CurrentArenaUI");
            _displayMaterial.SetFloat("_Premultiplied", 1); _displayMaterial.SetFloat("_SrcBlend", 1);
            _displayMaterial.SetFloat("_Opacity", .72f); _image.material = _displayMaterial;
            _blurMaterial = NewMaterial("CurrentArenaBlur");
            var root = new GameObject("current-arena-capture", typeof(RectTransform), typeof(Canvas));
            root.hideFlags = HideFlags.HideAndDontSave; root.layer = CaptureLayer;
            _captureRoot = (RectTransform)root.transform; _captureRoot.position = new Vector3(100000, 100000, 100000);
            var canvas = root.GetComponent<Canvas>(); canvas.renderMode = RenderMode.WorldSpace;
            var cameraObject = new GameObject("current-arena-camera", typeof(Camera));
            cameraObject.hideFlags = HideFlags.HideAndDontSave; cameraObject.transform.SetParent(_captureRoot, false);
            cameraObject.transform.localPosition = new Vector3(0, 0, -100);
            _camera = cameraObject.GetComponent<Camera>(); _camera.enabled = false; _camera.orthographic = true;
            _camera.clearFlags = CameraClearFlags.SolidColor; _camera.backgroundColor = Color.clear;
            _camera.cullingMask = 1 << CaptureLayer; _camera.nearClipPlane = .01f; _camera.farClipPlane = 200;
            _camera.allowHDR = false; _camera.allowMSAA = false; _camera.useOcclusionCulling = false;
            canvas.worldCamera = _camera;
            arena.SetParent(_captureRoot, false);
            arena.anchorMin = arena.anchorMax = Vector2.one * .5f;
            arena.localRotation = Quaternion.identity; arena.localScale = Vector3.one;
            Resize(); TrackMembers();
            Canvas.willRenderCanvases += RenderArena;
        }

        static Material NewMaterial(string resource) => new Material(Resources.Load<Shader>(resource)) { hideFlags = HideFlags.HideAndDontSave };

        void Resize()
        {
            Vector2 size = _surface.rect.size;
            if (size.x <= 0 || size.y <= 0) return;
            if (_size != size)
            {
                _size = size; _captureRoot.sizeDelta = size; _arena.sizeDelta = size;
                _arena.localPosition = new Vector3((_arena.pivot.x - .5f) * size.x, (_arena.pivot.y - .5f) * size.y, 0);
                _camera.orthographicSize = size.y * .5f; _camera.aspect = size.x / size.y;
            }
            _surface.GetWorldCorners(_corners);
            var canvas = _image.canvas; var root = canvas != null ? canvas.rootCanvas : null;
            var camera = root != null && root.renderMode != RenderMode.ScreenSpaceOverlay ? root.worldCamera : null;
            Vector2 bottomLeft = RectTransformUtility.WorldToScreenPoint(camera, _corners[0]);
            Vector2 topLeft = RectTransformUtility.WorldToScreenPoint(camera, _corners[1]);
            Vector2 bottomRight = RectTransformUtility.WorldToScreenPoint(camera, _corners[3]);
            int width = Mathf.Max(1, Mathf.CeilToInt(Vector2.Distance(bottomLeft, bottomRight) * .5f));
            int height = Mathf.Max(1, Mathf.CeilToInt(Vector2.Distance(bottomLeft, topLeft) * .5f));
            float limit = Mathf.Min(2048, SystemInfo.maxTextureSize) / (float)Mathf.Max(width, height);
            if (limit < 1) { width = Mathf.Max(1, Mathf.FloorToInt(width * limit)); height = Mathf.Max(1, Mathf.FloorToInt(height * limit)); }
            if (_capture != null && _capture.width == width && _capture.height == height) return;
            ReleaseTextures();
            _capture = NewTexture(width, height, 24); _horizontal = NewTexture(width, height, 0); _result = NewTexture(width, height, 0);
            _camera.targetTexture = _capture; _image.texture = _result;
        }

        static RenderTexture NewTexture(int width, int height, int depth)
        {
            var rt = new RenderTexture(width, height, depth, RenderTextureFormat.ARGB32)
            { name = "current-arena-filter", hideFlags = HideFlags.HideAndDontSave, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            rt.Create(); return rt;
        }

        void TrackMembers()
        {
            _nodes.Clear(); _arena.GetComponentsInChildren(true, _nodes); _seenNodes.Clear();
            foreach (var node in _nodes)
            {
                _seenNodes.Add(node);
                if (!_layers.ContainsKey(node) || node.gameObject.layer != CaptureLayer) _layers[node] = node.gameObject.layer;
                if (node.gameObject.layer != CaptureLayer) node.gameObject.layer = CaptureLayer;
            }
            _removedNodes.Clear();
            foreach (var entry in _layers) if (entry.Key == null || !_seenNodes.Contains(entry.Key))
            { if (entry.Key != null) entry.Key.gameObject.layer = entry.Value; _removedNodes.Add(entry.Key); }
            foreach (var node in _removedNodes) _layers.Remove(node);
            _graphics.Clear(); _arena.GetComponentsInChildren(true, _graphics); _seenGraphics.Clear();
            foreach (var graphic in _graphics)
            {
                _seenGraphics.Add(graphic);
                if (!_materials.ContainsKey(graphic) || graphic.material != _captureMaterial)
                {
                    _materials[graphic] = graphic.material; graphic.material = _captureMaterial;
                    // Only a newly assigned material needs a local rebuild after the normal canvas update.
                    if (graphic.isActiveAndEnabled) graphic.Rebuild(CanvasUpdate.PreRender);
                }
            }
            _removedGraphics.Clear();
            foreach (var entry in _materials) if (entry.Key == null || !_seenGraphics.Contains(entry.Key))
            { RestoreMaterial(entry.Key, entry.Value); _removedGraphics.Add(entry.Key); }
            foreach (var graphic in _removedGraphics) _materials.Remove(graphic);
        }

        void RenderArena()
        {
            if (!_open || _rendering || _renderedFrame == Time.frameCount) return;
            if (_arena == null || _parent == null) { Close(); return; }
            double now = Time.unscaledTimeAsDouble;
            if (now < _nextRender) return;
            _renderedFrame = Time.frameCount; _nextRender = now + 1d / Mathf.Min(60, Mathf.Max(1, CurrentUiPreferences.FrameLimit));
            _rendering = true;
            var previousTarget = RenderTexture.active;
            try
            {
                Resize(); TrackMembers();
                if (_capture == null) return;
                _camera.Render();
                if (!_open) return;
                _blurMaterial.SetVector("_Step", new Vector4(7 / _size.x, 0, 0, 0));
                Graphics.Blit(_capture, _horizontal, _blurMaterial);
                _blurMaterial.SetVector("_Step", new Vector4(0, 7 / _size.y, 0, 0));
                Graphics.Blit(_horizontal, _result, _blurMaterial);
            }
            finally { RenderTexture.active = previousTarget; _rendering = false; }
        }

        void RestoreMaterial(Graphic graphic, Material material)
        {
            if (graphic == null || graphic.material != _captureMaterial) return;
            graphic.material = material;
            if (graphic.isActiveAndEnabled) graphic.Rebuild(CanvasUpdate.PreRender);
        }

        void Close(bool deferRestore = false)
        {
            if (!_open) return;
            _open = false; Canvas.willRenderCanvases -= RenderArena; Active.Remove(_arena);
            if (_image != null) _image.enabled = false;
            if (_captureRoot != null) _captureRoot.GetComponent<Canvas>().enabled = false;
            foreach (var entry in _materials) RestoreMaterial(entry.Key, entry.Value);
            foreach (var entry in _layers) if (entry.Key != null) entry.Key.gameObject.layer = entry.Value;
            _materials.Clear(); _layers.Clear();
            ReleaseTextures(); Dispose(_captureMaterial); Dispose(_displayMaterial); Dispose(_blurMaterial);
            if (_camera != null) Dispose(_camera.gameObject);
            if (deferRestore && _arena != null && _captureRoot != null)
            {
                // Unity rejects SetParent into an ancestor while its SetActive is in progress.
                // The private canvas is already invisible and owns no live GPU resources.
                var restore = _captureRoot.gameObject.AddComponent<CurrentArenaFilter>();
                restore._arena = _arena; restore._parent = _parent; restore._original = _original; restore._sibling = _sibling;
                restore._deferred = true; restore._deferredFrame = Time.frameCount;
                Pending.Add(_arena, restore); _arena = null; _captureRoot = null;
            }
            else RestoreArena();
            if (_captureRoot != null) Dispose(_captureRoot.gameObject);
            if (gameObject != null) Dispose(gameObject);
        }

        void RestoreArena()
        {
            if (_arena == null) return;
            if (_parent != null) { _arena.SetParent(_parent, false); _original.Apply(_arena); _arena.SetSiblingIndex(_sibling); }
            else Dispose(_arena.gameObject);
        }

        void LateUpdate()
        {
            if (!_deferred || Time.frameCount <= _deferredFrame) return;
            _deferred = false; Pending.Remove(_arena);
            RestoreArena();
            var arena = _arena; _arena = null;
            Dispose(gameObject);
            if (_reopen && arena != null && _parent != null) Set(arena, true);
        }

        void ReleaseTextures()
        {
            if (_camera != null) _camera.targetTexture = null;
            if (_image != null) _image.texture = null;
            Release(ref _capture); Release(ref _horizontal); Release(ref _result);
        }
        static void Release(ref RenderTexture texture)
        { if (texture == null) return; texture.Release(); Dispose(texture); texture = null; }
        static void Dispose(Object value)
        { if (value == null) return; if (Application.isPlaying) Destroy(value); else DestroyImmediate(value); }
        void OnDisable()
        {
            Close(true);
            if (!_deferred) return;
            _deferred = false; Pending.Remove(_arena);
            if (_arena != null) Dispose(_arena.gameObject);
            Dispose(gameObject);
        }
        void OnDestroy() { OnDisable(); if (_parent == null && _arena != null) Dispose(_arena.gameObject); }

        readonly struct RectState
        {
            readonly Vector2 _min, _max, _pivot, _size;
            readonly Vector3 _position, _scale;
            readonly Quaternion _rotation;
            public RectState(RectTransform rect)
            { _min = rect.anchorMin; _max = rect.anchorMax; _pivot = rect.pivot; _size = rect.sizeDelta; _position = rect.anchoredPosition3D; _scale = rect.localScale; _rotation = rect.localRotation; }
            public void Apply(RectTransform rect)
            { rect.anchorMin = _min; rect.anchorMax = _max; rect.pivot = _pivot; rect.sizeDelta = _size; rect.anchoredPosition3D = _position; rect.localScale = _scale; rect.localRotation = _rotation; }
        }
    }
}
