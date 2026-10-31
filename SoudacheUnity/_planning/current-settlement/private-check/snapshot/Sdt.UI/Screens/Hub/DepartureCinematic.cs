// departure-transition.js + departure-cinematic.css + cinematic-profiles.js: 160ms cover, 2400ms reflection, 680ms reveal.
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using D = Sdt.UI.Screens.Run.DepartureElements;

namespace Sdt.UI.Screens.Hub
{
    internal sealed class DepartureCinematic : Panel
    {
        Func<bool> _start;
        Action _done;
        CanvasGroup _cover, _artGroup;
        RectTransform _art, _wipe;
        float _age, _revealAt = float.PositiveInfinity;
        bool _started, _skipped;
        bool Reduced => GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion") == "1";
        public static void Open(Func<bool> start, Action done)
        { var page = ScreenMount.Show<DepartureCinematic>("DepartureCinematic"); page._start = start; page._done = done; page.Build(); }
        public override void CloseFromEscape() => Skip();
        void Skip() { _skipped = true; if (_started) _revealAt = Math.Min(_age, _revealAt); }
        public override void Build()
        {
            var root = UIKit.Panel("departure-handoff departure-film", transform).transform; D.Surface(root, Theme.Hex("#090B0D")); _cover = root.gameObject.AddComponent<CanvasGroup>();
            var viewport = D.Area(root, "reflection-wipe", Vector2.zero, Vector2.one); viewport.gameObject.AddComponent<RectMask2D>(); _wipe = viewport;
            _art = D.Area(viewport, "departure-film-art", Vector2.zero, Vector2.one); _artGroup = _art.gameObject.AddComponent<CanvasGroup>();
            var image = _art.gameObject.AddComponent<Image>(); image.sprite = Sdt.Res.Res.Scene("departure/city-reflection-v1"); image.preserveAspect = true; image.raycastTarget = false;
            if (image.sprite == null) image.color = Color.clear;
            D.CommandAt(root, "departure-film-skip", "↗", Skip, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-180, 64), new Vector2(-90, 118), Color.clear, Theme.Hex("#AAA9A2"), 22);
        }
        void Update()
        {
            _age += Time.unscaledDeltaTime; float cover = Reduced ? 0 : .16f;
            if (!_started && _age >= cover)
            {
                _started = true; bool started;
                try { started = _start?.Invoke() == true; } catch (Exception error) { Debug.LogException(error); started = false; }
                if (!started) { Close(); return; }
                _revealAt = Reduced || _skipped ? _age : _age + 2.4f;
            }
            float t = Mathf.Clamp01((_age - cover) / 2.4f); _cover.alpha = Reduced ? 1 : Mathf.Clamp01(_age / .16f);
            _artGroup.alpha = Reduced ? 1 : _skipped ? .55f : Mathf.Clamp01(t / .6f);
            // sfReflection's left-to-right inset reveal while its contained source image expands .96 -> 1.025.
            _wipe.anchorMax = new Vector2(Reduced || _skipped ? 1 : Mathf.Clamp01(t / .6f), 1);
            float parentWidth = ((RectTransform)_wipe.parent).rect.width; _art.offsetMax = new Vector2(parentWidth * (1 - _wipe.anchorMax.x), 0);
            _art.localScale = Vector3.one * (Reduced || _skipped ? 1 : Mathf.Lerp(.96f, 1.025f, t));
            if (_age < _revealAt) return;
            float duration = Reduced ? 0 : _skipped ? .14f : .68f, progress = duration == 0 ? 1 : Mathf.Clamp01((_age - _revealAt) / duration);
            _cover.alpha = 1 - progress; _artGroup.alpha *= 1 - progress; _art.localScale = Vector3.one * Mathf.Lerp(1.025f, 1.06f, progress);
            if (progress < 1) return;
            var done = _done; _done = null; Close(); done?.Invoke();
        }
    }
}
