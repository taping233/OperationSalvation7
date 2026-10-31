using System;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    public sealed partial class CardLibraryScreen
    {
        void Layout()
        {
            if (_root == null || _root.rect.width <= 0) return;
            float w = _root.rect.width, h = _root.rect.height; _lastWidth = w; _lastHeight = h;
            PhotoStudioElements.Place(_header, 0, 0, w, 140); PhotoStudioElements.Place(_main, 56, 172, w - 112, h - 208);
            float catalog = (_main.rect.width - 40) * 7 / 9.6f, side = (_main.rect.width - 40) * 2.6f / 9.6f;
            PhotoStudioElements.Place(_catalogRoot, 0, 0, catalog, _main.rect.height); PhotoStudioElements.Place(_inspector, catalog + 40, 0, side, Mathf.Min(396, _main.rect.height));
            float searchWidth = Mathf.Min(420, Mathf.Max(200, catalog - 180 - 200 - 180 - 60 - 52 - 96));
            float[] widths = { searchWidth, 180, 200, 180, 60 }; float x = 0, y = 0;
            for (int i = 0; i < _toolbarControls.Count; i++)
            { if (x + widths[i] > catalog) { x = 0; y += 54; } PhotoStudioElements.Place(_toolbarControls[i], x, y, widths[i], 44); x += widths[i] + 16; }
            PhotoStudioElements.Place(_count.rectTransform, Mathf.Max(0, catalog - 68), y + 12, 68, 28); PhotoStudioElements.Place(_filterbar, 0, 0, catalog, y + 64);
            float chipX = 0; foreach (RectTransform chip in _chips) if (chip.gameObject.activeSelf)
            { float width = Mathf.Min(280, chip.GetComponentInChildren<Text>().preferredWidth + 20); PhotoStudioElements.Place(chip, chipX, 0, width, 30); chipX += width + 8; }
            float chipH = chipX > 0 ? 40 : 0; PhotoStudioElements.Place(_chips, 0, y + 64, catalog, chipH);
            PhotoStudioElements.Place((RectTransform)_wall.transform, 0, y + 64 + chipH + 20, catalog + 24, _main.rect.height - y - 84 - chipH);
            _tileW = Mathf.Max(80, (catalog - 3 * 48) / 4); _tileH = _tileW + 82;
            _content.sizeDelta = new Vector2(0, Mathf.CeilToInt(_filtered.Count / 4f) * (_tileH + 56) + 40); _layoutPending = false;
        }
        void UpdateTiles()
        {
            if (_content == null || _filtered == null || _tileH <= 0) return;
            float scroll = _content.anchoredPosition.y, view = ((RectTransform)_wall.transform).rect.height;
            int first = Mathf.Max(0, Mathf.FloorToInt((scroll - view * 2 - 24) / (_tileH + 56)) * 4);
            int last = Mathf.Min(_filtered.Count - 1, Mathf.CeilToInt((scroll + view * 3) / (_tileH + 56)) * 4 + 3);
            foreach (int key in _mounted.Keys.Where(k => k < first || k > last).ToArray()) { _mounted[key].gameObject.SetActive(false); Destroy(_mounted[key].gameObject); _mounted.Remove(key); }
            for (int i = first; i <= last; i++) if (!_mounted.ContainsKey(i)) _mounted[i] = BuildTile(i);
            foreach (var pair in _mounted) PhotoStudioElements.Place(pair.Value, pair.Key % 4 * (_tileW + 48), 24 + pair.Key / 4 * (_tileH + 56), _tileW, _tileH);
            if (_filtered.Count == 0 && !_content.GetComponentsInChildren<Text>().Any(t => t.name == "StudioEmpty" && t.gameObject.activeSelf))
            { var empty = PhotoStudioElements.Text(_content, "StudioEmpty", "暂无符合条件的照片\n试试其他关键词或重置筛选", 24, PhotoStudioElements.Light, true); PhotoStudioElements.Place(empty.rectTransform, 30, 100, 700, 180); }
        }
        RectTransform BuildTile(int index)
        {
            var card = _filtered[index]; var button = PhotoStudioElements.Button(_content, "Photo-" + card.id, "", () => Inspect(card.id));
            var rt = (RectTransform)button.transform; PhotoStudioElements.Place(rt, 0, 0, _tileW, _tileH); var oldLabel = button.GetComponentInChildren<Text>(); oldLabel.gameObject.SetActive(false); Destroy(oldLabel.gameObject);
            var paper = PhotoStudioElements.Texture(rt, "paper"); paper.name = "studio-photo-paper";
            var shadow = UIKit.GetOrAdd<Shadow>(paper); shadow.effectColor = Theme.HexA("#020503", .63f); shadow.effectDistance = new Vector2(1 + PhotoStudioElements.Stable(card.id, 23) * 2, -(3 + PhotoStudioElements.Stable(card.id, 37) * 3));
            string mount = PhotoStudioElements.Mount(card); float pad = Mathf.Max(12, PhotoStudioElements.Stroke(mount) * .85f + 4);
            var art = PhotoStudioElements.Node(paper.transform, "studio-photo-art"); PhotoStudioElements.Place(art, pad, pad, _tileW - pad * 2, _tileW - pad * 2); PhotoStudioElements.Artwork(art, card, false);
            var name = PhotoStudioElements.Text(paper.transform, "PhotoName", card.name, 21, PhotoStudioElements.Ink, true); PhotoStudioElements.Place(name.rectTransform, pad + 4, _tileW - pad + 12, _tileW - pad * 2 - 8, 31); name.horizontalOverflow = HorizontalWrapMode.Overflow;
            var type = PhotoStudioElements.Text(paper.transform, "PhotoType", card.type == "能力卡" ? "能力" : card.type, 19, PhotoStudioElements.Muted); PhotoStudioElements.Place(type.rectTransform, pad + 4, _tileW - pad + 45, _tileW - pad * 2, 25);
            var rar = PhotoStudioElements.Text(paper.transform, "PhotoRarity", CardLibrary.RarityOf(card), 17, PhotoStudioElements.RarityColor(CardLibrary.RarityOf(card))); rar.alignment = TextAnchor.UpperRight; PhotoStudioElements.Place(rar.rectTransform, pad + 4, _tileW - pad + 47, _tileW - pad * 2 - 8, 25);
            if (CardLibrary.RarityOf(card) == "棱彩") PhotoPrismaticText.Apply(rar);
            PhotoStudioElements.Frame(paper.rectTransform, mount, false);
            var select = PhotoStudioElements.Node(rt, "Selected"); PhotoStudioElements.Fill(select, -5, -5, -5, -5);
            var graphic = UIKit.GetOrAdd<PhotoSelectionBorder>(select); graphic.color = Theme.Hex("#d1ac78"); graphic.raycastTarget = false; select.gameObject.SetActive(card.id == _selectedId);
            var target = UIKit.GetOrAdd<PhotoStudioTile>(rt); target.Screen = this; target.Id = card.id;
            var nav = button.navigation; nav.mode = Navigation.Mode.None; button.navigation = nav; return rt;
        }
        internal void Hover(string id) { if (Time.unscaledTime < _hoverBlockUntil || _hoverId == id) return; _hoverId = id; _hoverAt = Time.unscaledTime + .09f; }
        internal void Select(string id)
        { if (_selectedId == id) return; _selectedId = id; foreach (var p in _mounted) p.Value.Find("Selected").gameObject.SetActive(_filtered[p.Key].id == id); RenderDossier(); }
        void Locate(bool focus)
        {
            int i = _filtered.FindIndex(c => c.id == _selectedId); if (i < 0) return;
            float top = 24 + i / 4 * (_tileH + 56), scroll = _content.anchoredPosition.y, height = ((RectTransform)_wall.transform).rect.height;
            if (top < scroll || top + _tileH > scroll + height) _content.anchoredPosition = new Vector2(0, Mathf.Clamp(top - (height - _tileH) / 2, 0, Mathf.Max(0, _content.rect.height - height)));
            UpdateTiles(); if (focus && _mounted.TryGetValue(i, out var tile)) EventSystem.current?.SetSelectedGameObject(tile.gameObject);
        }
        void Step(int delta, bool focus = false)
        { int i = _filtered.FindIndex(c => c.id == _selectedId), next = Mathf.Clamp(i + delta, 0, _filtered.Count - 1); if (i < 0 || next == i) return; Select(_filtered[next].id); Locate(focus); }
        void Inspect(string id)
        {
            Select(id); Remember(); var i = _filtered.FindIndex(c => c.id == id); RectTransform source = null; if (_mounted.TryGetValue(i, out var tile)) source = tile.Find("studio-photo-paper") as RectTransform;
            AudioService.I.PlaySfx("shutter"); PhotoDetailScreen.Open(_filtered, id, source, current => { Select(current); RenderDossier(); Locate(true); });
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PhotoSelectionBorder : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear(); var r = rectTransform.rect; Quad(vh, new Rect(r.x, r.y, r.width, 3)); Quad(vh, new Rect(r.x, r.yMax - 3, r.width, 3)); Quad(vh, new Rect(r.x, r.y, 3, r.height)); Quad(vh, new Rect(r.xMax - 3, r.y, 3, r.height));
        }
        void Quad(VertexHelper vh, Rect r)
        { int i = vh.currentVertCount; vh.AddVert(new Vector3(r.x, r.y, 0), color, Vector2.zero); vh.AddVert(new Vector3(r.xMax, r.y, 0), color, Vector2.zero); vh.AddVert(new Vector3(r.xMax, r.yMax, 0), color, Vector2.zero); vh.AddVert(new Vector3(r.x, r.yMax, 0), color, Vector2.zero); vh.AddTriangle(i, i + 1, i + 2); vh.AddTriangle(i, i + 2, i + 3); }
    }
}
