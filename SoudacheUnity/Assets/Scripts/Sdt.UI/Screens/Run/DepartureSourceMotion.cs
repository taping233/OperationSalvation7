using UnityEngine;
using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    // character-view-motion feedback/regionEnter and baseNavigationTiming.detail; no idle animation (source removed it).
    internal sealed class DepartureSourceMotion : MonoBehaviour
    {
        float _age, _duration;
        Vector2 _position, _offset;
        CanvasGroup _group;
        public static void Enter(Transform node, float duration, Vector2 offset)
        {
            if (GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion") == "1") return;
            var motion = node.gameObject.AddComponent<DepartureSourceMotion>(); motion._duration = duration; motion._offset = offset; motion._position = ((RectTransform)node).anchoredPosition; motion._group = Sdt.UI.Kit.UIKit.GetOrAdd<CanvasGroup>(node);
        }
        void Update()
        {
            _age += Time.unscaledDeltaTime; float t = Mathf.Clamp01(_age / _duration), ease = 1 - Mathf.Pow(1 - t, 3);
            ((RectTransform)transform).anchoredPosition = _position + _offset * (1 - ease); _group.alpha = Mathf.Lerp(.4f, 1, ease);
            if (t >= 1) Destroy(this);
        }
    }
}
