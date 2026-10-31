// review-ui.css and card-layout-selected.css: only explicitly bound reading surfaces.
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    [RequireComponent(typeof(Text))]
    public sealed class CurrentReadingPreference : MonoBehaviour
    {
        Text _text;
        int _baseSize;
        float _baseSpacing, _lastScale = -1;
        bool _body;
        public static void Bind(Text text, bool body = true)
        {
            var view = text.gameObject.AddComponent<CurrentReadingPreference>();
            view._text = text; view._baseSize = text.fontSize; view._baseSpacing = text.lineSpacing;
            view._body = body; view.Apply();
        }
        public static bool CardZoom(Transform target)
        {
            for (var at = target; at != null; at = at.parent)
                if (at.name == "cardZoom" || at.name == "inventory-zoom" || at.name == "reward-cardZoom") return true;
            return false;
        }
        void OnEnable() { CurrentUiPreferences.Changed += Apply; }
        void OnDisable() { CurrentUiPreferences.Changed -= Apply; }
        void LateUpdate()
        {
            // A card's existing zoom transform is applied after CardFace.Create.
            if (_text != null && !Mathf.Approximately(_lastScale, Scale())) Apply();
        }
        float Scale()
        {
            var canvas = GetComponentInParent<Canvas>();
            return canvas == null ? 1 : Mathf.Max(.01f, Mathf.Abs(transform.lossyScale.y / canvas.transform.lossyScale.y));
        }
        void Apply()
        {
            if (_text == null) return;
            _lastScale = Scale();
            bool large = CurrentUiPreferences.ReadingLarge;
            _text.fontSize = large ? Mathf.Max(1, Mathf.RoundToInt(26 / _lastScale)) : _baseSize;
            _text.lineSpacing = large && _body ? SourceTextLayout.LineSpacing(_text, 1.7f) : _baseSpacing;
            LayoutRebuilder.MarkLayoutForRebuild(_text.rectTransform);
        }
    }
}
