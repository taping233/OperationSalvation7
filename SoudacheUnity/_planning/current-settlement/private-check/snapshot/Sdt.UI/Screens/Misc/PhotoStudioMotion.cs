using System.Collections;
using Sdt.UI.Kit;
using UnityEngine;

namespace Sdt.UI.Screens.Misc
{
    public sealed class PhotoStudioSurfaceMotion : MonoBehaviour
    {
        RectTransform _rect;
        CanvasGroup _group;
        Vector2 _target;
        float _time, _duration;
        Vector2 _from;
        public void Play(float duration, float x, float y)
        {
            _rect = (RectTransform)transform; _group = UIKit.GetOrAdd<CanvasGroup>(_rect); _target = _rect.anchoredPosition;
            _duration = duration; _time = 0; _from = _target + new Vector2(x, y);
            if (!PhotoStudioElements.Reduced) { _rect.anchoredPosition = _from; _group.alpha = 0; } else _group.alpha = 1;
        }
        void Update()
        {
            if (_rect == null || _group == null || _time >= _duration) return;
            _time += Time.unscaledDeltaTime; float t = PhotoStudioElements.Reduced ? 1 : 1 - Mathf.Pow(1 - Mathf.Clamp01(_time / _duration), 3);
            _rect.anchoredPosition = Vector2.Lerp(_from, _target, t); _group.alpha = t;
        }
    }
    public sealed partial class CardLibraryScreen
    {
        IEnumerator LeaveStudio()
        {
            var group = UIKit.GetOrAdd<CanvasGroup>(_root); group.interactable = false; float time = 0;
            while (time < .18f && !PhotoStudioElements.Reduced)
            { time += Time.unscaledDeltaTime; float t = Mathf.Clamp01(time / .18f); group.alpha = 1 - t; _root.anchoredPosition = new Vector2(0, -8 * t); yield return null; }
            Close();
        }
    }
}
