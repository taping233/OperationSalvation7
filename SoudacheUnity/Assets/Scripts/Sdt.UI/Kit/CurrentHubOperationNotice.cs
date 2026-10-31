// game.hub.runtime.js owner channel + operation-notice.js + final base-cohesion-v5.css.
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    public sealed class CurrentHubOperationNotice : MonoBehaviour
    {
        RectTransform _box;
        Text _label;
        string _text;
        bool _warning;
        float _until;
        public static void Show(Panel owner, string text, bool warning)
        {
            var notice = UIKit.GetOrAdd<CurrentHubOperationNotice>(owner);
            notice._text = text; notice._warning = warning;
            notice._until = warning ? float.PositiveInfinity : Time.unscaledTime + 3.2f;
            notice.Refresh();
        }
        public static void Clear(Panel owner)
        {
            var notice = owner.GetComponent<CurrentHubOperationNotice>();
            if (notice == null) return;
            notice._text = null; if (notice._box != null) notice._box.gameObject.SetActive(false);
        }
        void Update()
        {
            if (string.IsNullOrEmpty(_text)) return;
            if (Time.unscaledTime >= _until) { _text = null; if (_box != null) _box.gameObject.SetActive(false); return; }
            // A same-page rebuild replaces only the view; the owner retains its channel and expiry.
            if (_box == null) Refresh();
        }
        void Refresh()
        {
            if (_box == null)
            {
                _box = CurrentRunHudView.Box(transform, "camp-notice", -32, -24, 0, 56, new Vector2(1, 0), new Vector2(1, 0));
                var background = UIKit.GetOrAdd<Image>(_box); background.color = Theme.Hex("#16231c"); background.raycastTarget = false;
                var accent = CurrentRunHudView.Fill(_box, "notice-accent", 0, 0, 3, 56, "#b49a6a");
                accent.rectTransform.anchorMin = Vector2.zero; accent.rectTransform.anchorMax = new Vector2(0, 1);
                accent.rectTransform.offsetMin = Vector2.zero; accent.rectTransform.offsetMax = new Vector2(3, 0);
                _label = CurrentRunHudView.Text(_box, "operation-notice", "", 24, 16, 0, 24, 17);
                UiStack.Stretch(_label.rectTransform); _label.rectTransform.offsetMin = new Vector2(24, 16); _label.rectTransform.offsetMax = new Vector2(-24, -16);
            }
            _label.text = _text; _label.color = Theme.Hex(_warning ? "#efc58a" : "#c4ddd4");
            float width = Mathf.Min(Mathf.Max(180, _label.preferredWidth + 48), Mathf.Max(180, ((RectTransform)transform).rect.width - 64));
            _box.sizeDelta = new Vector2(width, 56);
            _box.sizeDelta = new Vector2(width, Mathf.Max(56, _label.preferredHeight + 32));
            _box.gameObject.SetActive(true); _box.SetAsLastSibling();
        }
    }
}
