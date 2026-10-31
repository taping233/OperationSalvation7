using System;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Res;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>Photo host for shared rich-description link/term spans. Geometry follows native text vertices.</summary>
    public sealed class PhotoInlineLinks : MonoBehaviour
    {
        public CurrentCardPresentation.Document Document;
        public Action<CardDef> OpenCard;
        Text _text;
        Vector2 _size;
        readonly List<GameObject> _targets = new List<GameObject>();
        RectTransform _tip;
        Panel _owner;
        void Awake() { _text = GetComponent<Text>(); _owner = GetComponentInParent<Panel>(); }
        void LateUpdate()
        {
            if (Document == null || _text == null || !gameObject.activeInHierarchy) return;
            if (UiStack.Top != _owner) { Hide(); return; }
            Vector2 size = _text.rectTransform.rect.size;
            if (_targets.Count > 0 && size == _size || _text.cachedTextGenerator.verts.Count < 4) return;
            _size = size; foreach (var target in _targets) { target.SetActive(false); Destroy(target); } _targets.Clear();
            var verts = _text.cachedTextGenerator.verts; float pixels = _text is InlineIconText inline ? inline.GlyphPixelsPerUnit : _text.pixelsPerUnit;
            foreach (var link in Document.Links)
            {
                Rect? row = null;
                for (int ch = link.Start; ch < link.Start + link.Length && ch * 4 + 3 < verts.Count; ch++)
                {
                    var a = verts[ch * 4].position / pixels; var b = verts[ch * 4 + 2].position / pixels;
                    var box = Rect.MinMaxRect(Mathf.Min(a.x, b.x), Mathf.Min(a.y, b.y), Mathf.Max(a.x, b.x), Mathf.Max(a.y, b.y));
                    if (box.width <= 0 || box.height <= 0) continue;
                    if (row.HasValue && Mathf.Abs(row.Value.center.y - box.center.y) > _text.fontSize * .4f) { Target(link, row.Value); row = null; }
                    row = row.HasValue ? Rect.MinMaxRect(Mathf.Min(row.Value.xMin, box.xMin), Mathf.Min(row.Value.yMin, box.yMin), Mathf.Max(row.Value.xMax, box.xMax), Mathf.Max(row.Value.yMax, box.yMax)) : box;
                }
                if (row.HasValue) Target(link, row.Value);
            }
        }
        void Target(CurrentCardPresentation.Link link, Rect box)
        {
            var rt = PhotoStudioElements.Node(transform, link.CardId != null ? "card-reference-" + link.CardId : "term-" + link.TermKey);
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(.5f, .5f); rt.anchoredPosition = box.center; rt.sizeDelta = box.size;
            var image = UIKit.GetOrAdd<Image>(rt); image.color = Color.clear;
            var button = UIKit.GetOrAdd<Button>(rt); button.targetGraphic = image;
            button.onClick.AddListener(() =>
            {
                if (UiStack.Top != _owner) return;
                if (link.CardId != null) { Hide(); var card = CardLibrary.FindById(link.CardId); if (card != null) OpenCard?.Invoke(card); }
                else Show(link.TermKey, rt);
            });
            var hover = UIKit.GetOrAdd<PhotoInlineTarget>(rt); hover.Host = this; hover.Key = link.TermKey;
            _targets.Add(rt.gameObject);
        }
        internal void Show(string key, RectTransform source)
        {
            if (key == null || UiStack.Top != _owner) return; Hide(); var term = CurrentCardPresentation.TermByKey(key); if (term == null) return;
            var root = (RectTransform)_owner.transform; _tip = PhotoStudioElements.Node(root, "PhotoTermTip");
            bool large = CurrentUiPreferences.ReadingLarge; float copyTop = large ? 74 : 58;
            PhotoStudioElements.Texture(_tip, "paper"); var title = PhotoStudioElements.Text(_tip, "TermName", term.name, 20, Theme.Hex("#2d6561"), true); CurrentReadingPreference.Bind(title); PhotoStudioElements.Place(title.rectTransform, 20, 18, 300, large ? 46 : 32);
            var copy = PhotoStudioElements.Text(_tip, "TermDefinition", term.text, 17, PhotoStudioElements.Ink, true); copy.lineSpacing = 1.65f; CurrentReadingPreference.Bind(copy); PhotoStudioElements.Place(copy.rectTransform, 20, copyTop, 300, 400);
            float height = copyTop + 20 + copy.preferredHeight; copy.rectTransform.sizeDelta = new Vector2(300, copy.preferredHeight);
            var position = root.InverseTransformPoint(source.position); float x = position.x - root.rect.xMin + 14, y = root.rect.yMax - position.y + 20;
            if (x + 340 > root.rect.width - 16) x -= 368; if (y + height > root.rect.height - 16) y -= height + 40;
            PhotoStudioElements.Place(_tip, Mathf.Clamp(x, 16, root.rect.width - 356), Mathf.Clamp(y, 16, Mathf.Max(16, root.rect.height - height - 16)), 340, height);
        }
        internal void Hide() { if (_tip != null) { _tip.gameObject.SetActive(false); Destroy(_tip.gameObject); _tip = null; } }
        void OnDisable() { Hide(); }
        void OnDestroy() { Hide(); }
    }
    public sealed class PhotoInlineTarget : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, ISelectHandler, IDeselectHandler
    {
        internal PhotoInlineLinks Host; internal string Key;
        public void OnPointerEnter(PointerEventData e) { Host.Show(Key, (RectTransform)transform); }
        public void OnPointerExit(PointerEventData e) { Host.Hide(); }
        public void OnSelect(BaseEventData e) { Host.Show(Key, (RectTransform)transform); }
        public void OnDeselect(BaseEventData e) { Host.Hide(); }
    }
}
