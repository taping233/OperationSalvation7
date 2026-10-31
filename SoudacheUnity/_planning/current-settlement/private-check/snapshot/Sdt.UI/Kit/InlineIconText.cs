using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    /// <summary>Legacy Text API with source bitmap/SVG icons occupying real text advance.</summary>
    public sealed class InlineIconText : Text
    {
        string _source = "";
        InlineIconDocument _document = new InlineIconDocument { text = "" };
        readonly List<Image> _images = new List<Image>();
        readonly List<Rect> _positions = new List<Rect>();
        int _parsedSize;
        bool _parsedRich, _plainInput, _geometryReady;
        bool _rendering;
        Font _parsedFont;
        FontStyle _parsedStyle;
        float _disabledOpacity = 1;
        public string SourceText => _source;
        public string RenderedText => m_Text;
        public int RenderedIconCount => _document.icons.Count;
        public IReadOnlyList<Rect> IconRects => _positions;
        public override string text
        {
            get => _rendering ? base.text : _source;
            set { _source = value ?? ""; Reparse(); }
        }
        protected override void OnEnable()
        {
            base.OnEnable(); Canvas.willRenderCanvases += UpdateIconImages;
        }
        protected override void OnDisable()
        {
            Canvas.willRenderCanvases -= UpdateIconImages;
            foreach (var image in _images) if (image != null) image.enabled = false;
            base.OnDisable();
        }
        bool NeedsDocument => _parsedSize != fontSize || _parsedRich != supportRichText || _parsedFont != font || _parsedStyle != fontStyle || _plainInput != (GetComponentInParent<InputField>() != null);
        int AdvanceCount(int size)
        {
            if (font == null) return 2;
            if (!font.GetCharacterInfo('\u00A0', out var info, size, fontStyle) || info.advance <= 0)
            {
                bool old = m_DisableFontTextureRebuiltCallback; m_DisableFontTextureRebuiltCallback = true;
                try { font.RequestCharactersInTexture("\u00A0", size, fontStyle); }
                finally { m_DisableFontTextureRebuiltCallback = old; }
                font.GetCharacterInfo('\u00A0', out info, size, fontStyle);
            }
            return info.advance > 0 ? Mathf.Max(1, Mathf.CeilToInt(size * 1.1f / info.advance)) : 2;
        }
        void RefreshDocument()
        {
            _parsedSize = fontSize; _parsedRich = supportRichText;
            _parsedFont = font; _parsedStyle = fontStyle;
            _plainInput = GetComponentInParent<InputField>() != null;
            _document = _plainInput ? new InlineIconDocument { text = _source } : InlineIconParser.Parse(_source, fontSize, supportRichText, AdvanceCount);
            m_Text = _document.text; _geometryReady = false;
        }
        void EnsureSprites()
        {
            for (int index = 0; index < _document.icons.Count; index++)
            {
                if (index >= _images.Count)
                {
                    var child = new GameObject("inline-icon", typeof(RectTransform), typeof(Image)); child.transform.SetParent(transform, false);
                    var image = child.GetComponent<Image>(); image.raycastTarget = false; image.preserveAspect = true;
                    child.AddComponent<LayoutElement>().ignoreLayout = true; _images.Add(image);
                }
                _images[index].sprite = Sdt.Res.Res.Ui(_document.icons[index].key);
            }
        }
        void Reparse()
        {
            RefreshDocument(); EnsureSprites();
            foreach (var image in _images) if (image != null) image.enabled = false;
            SetVerticesDirty(); SetLayoutDirty();
        }
        public override float preferredWidth { get { if (NeedsDocument) RefreshDocument(); return base.preferredWidth; } }
        public override float preferredHeight { get { if (NeedsDocument) RefreshDocument(); return base.preferredHeight; } }
        void LateUpdate()
        {
            if (NeedsDocument) Reparse();
            var selectable = GetComponentInParent<Selectable>();
            float opacity = selectable != null && !selectable.IsInteractable() ? .45f : 1;
            if (_disabledOpacity != opacity) { _disabledOpacity = opacity; SetVerticesDirty(); }
            UpdateIconImages();
        }
        protected override void OnPopulateMesh(VertexHelper vertices)
        {
            if (NeedsDocument) RefreshDocument();
            var selectable = GetComponentInParent<Selectable>();
            _disabledOpacity = selectable != null && !selectable.IsInteractable() ? .45f : 1;
            _rendering = true;
            try { base.OnPopulateMesh(vertices); }
            finally { _rendering = false; }
            if (_disabledOpacity < 1)
            {
                var vertex = new UIVertex();
                for (int index = 0; index < vertices.currentVertCount; index++)
                { vertices.PopulateUIVertex(ref vertex, index); vertex.color.a = (byte)(vertex.color.a * _disabledOpacity); vertices.SetUIVertex(vertex, index); }
            }
            _positions.Clear();
            if (font == null || _document.icons.Count == 0) { _geometryReady = false; return; }
            var characters = cachedTextGenerator.characters;
            float unit = 1 / pixelsPerUnit;
            var generatedVertices = cachedTextGenerator.verts;
            var rounding = generatedVertices.Count > 0 ? (Vector2)generatedVertices[0].position * unit : Vector2.zero;
            rounding = PixelAdjustPoint(rounding) - rounding;
            foreach (var icon in _document.icons)
            {
                if (icon.characterIndex >= characters.Count) { _positions.Add(Rect.zero); continue; }
                var character = characters[icon.characterIndex];
                float advance = 0;
                for (int index = 0; index < icon.characterCount && icon.characterIndex + index < characters.Count; index++) advance += characters[icon.characterIndex + index].charWidth * unit;
                if (advance <= 0) { _positions.Add(Rect.zero); continue; }
                float extent = icon.size;
                if (resizeTextForBestFit && fontSize > 0) extent *= (float)cachedTextGenerator.fontSizeUsedForBestFit / fontSize;
                _positions.Add(new Rect(character.cursorPos.x * unit + (advance - extent) * .5f + rounding.x, character.cursorPos.y * unit - extent + rounding.y, extent, extent));
            }
            _geometryReady = true;
        }
        void UpdateIconImages()
        {
            if (!isActiveAndEnabled || CanvasUpdateRegistry.IsRebuildingGraphics()) return;
            EnsureSprites();
            for (int index = 0; index < _images.Count; index++)
            {
                var image = _images[index];
                bool show = _geometryReady && index < _positions.Count && _positions[index].width > 0;
                if (image == null) continue;
                image.enabled = show;
                if (!show) continue;
                var rect = _positions[index];
                var target = image.rectTransform;
                target.anchorMin = target.anchorMax = rectTransform.pivot;
                target.pivot = Vector2.zero;
                target.anchoredPosition = rect.position;
                target.sizeDelta = rect.size;
                var tint = Color.white;
                if (Sdt.Res.CurrentUiIcons.Tintable.Contains(_document.icons[index].key))
                {
                    tint = color;
                    if (_document.icons[index].color != null && ColorUtility.TryParseHtmlString(_document.icons[index].color, out var richColor)) tint = richColor;
                }
                tint.a = color.a * _disabledOpacity;
                image.color = tint;
            }
        }
    }
}
