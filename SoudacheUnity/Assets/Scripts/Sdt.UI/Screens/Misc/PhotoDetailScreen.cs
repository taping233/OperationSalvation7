using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>card-zoom-content photo branch: original print, paper back-sign and automatic notes.</summary>
    public sealed class PhotoDetailScreen : Panel
    {
        static readonly Dictionary<string, string> Pending = new Dictionary<string, string>();
        List<CardDef> _cards;
        int _index;
        InputField _note;
        Text _status;
        string _savedText, _sourceId;
        RectTransform _root, _layout, _paper, _info, _source;
        Action<string> _returned;
        float _saveAt = -1;
        bool _closing;
        Vector2 _paperPosition;
        public static void Open(List<CardDef> cards, string id) => Open(cards, id, null, null);
        public static void Open(List<CardDef> cards, string id, RectTransform source, Action<string> returned)
        {
            if (cards == null || cards.Count == 0) return;
            var s = ScreenMount.Show<PhotoDetailScreen>("PhotoDetail"); s._cards = cards.ToList(); s._index = Mathf.Max(0, cards.FindIndex(c => c.id == id));
            s._source = source; s._sourceId = id; s._returned = returned; s.Build();
        }
        internal static string NoteFor(string id)
        {
            if (Pending.TryGetValue(id, out var pending)) return pending.Length > 0 ? pending : HubCatalog.Current.baseNotes.TryGetValue(id, out var original) ? original : "";
            try { return GameRuntime.I.Base.PhotoNote(id); } catch { return HubCatalog.Current.baseNotes.TryGetValue(id, out var original) ? original : ""; }
        }
        public override void Build()
        {
            var card = _cards[_index]; _root = PhotoStudioElements.Node(transform, "cardZoom.cz-photo.cz-photo-atelier"); PhotoStudioElements.Fill(_root); CardLibraryScreen.BuildRoom(_root, true);
            var dismiss = PhotoStudioElements.Button(_root, "PhotoBackdropClose", "", ClosePhoto); PhotoStudioElements.Fill((RectTransform)dismiss.transform);
            _layout = PhotoStudioElements.Node(_root, "cz-photo-layout"); _paper = PhotoStudioElements.Node(_layout, "cz-photo-paper");
            PhotoStudioElements.Texture(_paper, "zoom-paper"); string mount = PhotoStudioElements.Mount(card);
            UIKit.GetOrAdd<Image>(_paper).color = new Color(0, 0, 0, .001f);
            var art = PhotoStudioElements.Node(_paper, "cz-photo-image"); PhotoStudioElements.Artwork(art, card, true); PhotoStudioElements.Frame(_paper, mount, true);
            _info = PhotoStudioElements.Node(_layout, "cz-photo-info"); PhotoStudioElements.Texture(_info, "paper");
            // This opaque hit area keeps reading controls from bubbling to the backdrop.
            UIKit.GetOrAdd<Image>(_info).color = new Color(0, 0, 0, .001f);
            var close = PhotoStudioElements.Button(_info, "PhotoClose", "×", ClosePhoto, true); var closeRect = (RectTransform)close.transform;
            closeRect.anchorMin = closeRect.anchorMax = closeRect.pivot = new Vector2(1, 1); closeRect.anchoredPosition = new Vector2(-12, -12); closeRect.sizeDelta = new Vector2(44, 44);
            var content = PhotoStudioElements.Scroll(_info, "PhotoBackSignReading", out var reading); PhotoStudioElements.Fill((RectTransform)reading.transform, 22, 24, 22, 24); PhotoStudioElements.Vertical(content, 16);
            var title = PhotoStudioElements.Flow(content, "PhotoTitle", card.name, 30, PhotoStudioElements.Ink, true); title.gameObject.GetComponent<LayoutElement>().minHeight = 48;
            PhotoStudioElements.Flow(content, "PhotoNumber", "藏品编号 № " + PhotoStudioElements.Number(card.id), 14, PhotoStudioElements.Muted);
            string rarity = CardLibrary.RarityOf(card); var details = (card.type == "能力卡" ? "能力" : card.type) + "   <color=#" + ColorUtility.ToHtmlStringRGB(PhotoStudioElements.RarityColor(rarity)) + ">" + rarity + "</color>   费用  " + card.cost;
            var creature = Regex.Match(card.desc ?? "", @"^攻击\s*(\d+)\s*/\s*生命\s*(\d+)");
            if (card.type == "生物" && creature.Success) details += "\n攻击 " + creature.Groups[1].Value + "   生命 " + creature.Groups[2].Value;
            else if (CardLibrary.DmgTypes.Contains(card.type) && ((card.dmg??0)>0||(card.dmg??0)<0&&card.dmgType=="attack")) details += "\n"+Sdt.Res.CurrentCardPresentation.DamageCaption(card)+" " + card.dmg;
            var detailText = PhotoStudioElements.Flow(content, "PhotoDetails", details, 18, PhotoStudioElements.Ink, true);
            if (rarity == "棱彩") PhotoPrismaticText.Apply(detailText, (card.type == "能力卡" ? "能力" : card.type).Length + 3, 2);
            PhotoStudioElements.DescriptionFlow(content, "PhotoRules", card, 18);
            if (PhotoStudioElements.HasDraw(card)) PhotoStudioElements.Flow(content, "DrawExplanation", PhotoStudioElements.DrawExplanation, 16, Theme.Hex("#526255"));
            PhotoStudioElements.Flow(content, "PhotoNoteLabel", "备注", 14, PhotoStudioElements.Muted);
            _savedText = Pending.TryGetValue(card.id, out var pending) ? pending : NoteFor(card.id); _note = MakeNote(content, _savedText);
            _status = PhotoStudioElements.Flow(content, "PhotoNoteStatus", Pending.ContainsKey(card.id) ? "未存档，已暂存本次会话" : string.IsNullOrEmpty(_savedText) ? "尚未撰写" : "已存档", 14, Theme.Hex("#554c38"));
            close.transform.SetAsLastSibling(); LayoutPhoto(art, card, mount); StartCoroutine(Enter());
        }
        void LayoutPhoto(RectTransform art, CardDef card, string mount)
        {
            float rootW = _root.rect.width, rootH = _root.rect.height; if (rootW <= 0) { rootW = 1920; rootH = 1080; }
            float width = Mathf.Min(1600, rootW * .94f), gap = Mathf.Clamp(rootW * .03f, 24, 52), sideW = Mathf.Max(300, (width - gap) * .8f / 2.5f), mainW = width - gap - sideW;
            float layoutH = rootH - 92; PhotoStudioElements.Place(_layout, (rootW - width) / 2, 46, width, layoutH);
            var sprite = Sdt.Res.Res.CardIllustration(card.id, card.art, card.type, card.name); float ratio = sprite == null ? 1 : sprite.rect.width / sprite.rect.height;
            float pad = Mathf.Max(33, PhotoStudioElements.Stroke(mount) * 2.5f + 5);
            float imageW = Mathf.Min(mainW - pad * 2, (rootH - 190) * ratio), imageH = imageW / ratio;
            PhotoStudioElements.Place(_paper, (mainW - imageW - pad * 2) / 2, (layoutH - imageH - pad * 2) / 2, imageW + pad * 2, imageH + pad * 2); PhotoStudioElements.Place(art, pad, pad, imageW, imageH); _paperPosition = _paper.anchoredPosition;
            float infoH = Mathf.Min(rootH - 104, 600); PhotoStudioElements.Place(_info, mainW + gap, (layoutH - infoH) / 2, sideW, infoH);
            var reading = _info.Find("PhotoBackSignReading/Content") as RectTransform;
            if (reading != null) { LayoutRebuilder.ForceRebuildLayoutImmediate(reading); infoH = Mathf.Min(rootH - 104, LayoutUtility.GetPreferredHeight(reading) + 48); PhotoStudioElements.Place(_info, mainW + gap, (layoutH - infoH) / 2, sideW, infoH); }
        }
        InputField MakeNote(RectTransform parent, string value)
        {
            var rt = PhotoStudioElements.Node(parent, "PhotoNote"); var image = UIKit.GetOrAdd<Image>(rt); image.color = Color.clear;
            var le = UIKit.GetOrAdd<LayoutElement>(rt); le.preferredHeight = 110; le.flexibleWidth = 1;
            var lines = UIKit.GetOrAdd<PhotoNoteLines>(PhotoStudioElements.Node(rt, "NoteRuling")); lines.raycastTarget = false; PhotoStudioElements.Fill(lines.rectTransform);
            var text = PhotoStudioElements.Text(rt, "NoteText", "", 17, Theme.Hex("#39352b")); text.lineSpacing = 1.5f; text.supportRichText = false; PhotoStudioElements.Fill(text.rectTransform, 2, 5, 2, 5);
            var placeholder = PhotoStudioElements.Text(rt, "NotePlaceholder", "写下这条卡的备注……", 17, Theme.Hex("#787160")); placeholder.supportRichText = false; PhotoStudioElements.Fill(placeholder.rectTransform, 2, 5, 2, 5);
            var field = UIKit.GetOrAdd<InputField>(rt); field.textComponent = text; field.placeholder = placeholder; field.lineType = InputField.LineType.MultiLineNewline; field.characterLimit = 240; field.text = value;
            field.onValueChanged.AddListener(_ => { _status.text = "保存中…"; _saveAt = Time.unscaledTime + .24f; }); field.onEndEdit.AddListener(_ => SaveNote()); return field;
        }
        void SaveNote()
        {
            _saveAt = -1; if (_note == null) return; string value = (_note.text ?? "").Trim(), id = _cards[_index].id;
            if (value == _savedText && !Pending.ContainsKey(id)) return;
            Pending[id] = value;
            bool ok; string reason;
            try { ok = GameRuntime.I.Base.TrySavePhotoNote(id, value, out reason); } catch (Exception e) { ok = false; reason = e.Message; }
            if (ok) { Pending.Remove(id); _savedText = value; }
            if (_status != null) _status.text = ok ? value.Length > 0 ? "已存档" : "尚未撰写" : "未存档，已暂存本次会话";
        }
        void Update()
        {
            if (UiStack.Top != this || _closing) return;
            if (_saveAt > 0 && Time.unscaledTime >= _saveAt && Input.compositionString.Length == 0) SaveNote();
            if (Input.compositionString.Length > 0 || Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl) || Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt)) return;
            var focused = EventSystem.current?.currentSelectedGameObject;
            if (PhotoStudioElements.Tab(_root)) return;
            if (focused != null && focused.GetComponent<InputField>() != null && focused.GetComponent<InputField>().isFocused) return;
            int delta = Input.GetKeyDown(KeyCode.LeftArrow) ? -1 : Input.GetKeyDown(KeyCode.RightArrow) ? 1 : 0;
            if (delta != 0) Navigate(delta);
        }
        void Navigate(int delta)
        {
            int next = _index + delta; if (next < 0 || next >= _cards.Count) return;
            SaveNote(); StopAllCoroutines(); _index = next;
            foreach (Transform child in transform) { child.gameObject.SetActive(false); Destroy(child.gameObject); } Build();
        }
        public override void CloseFromEscape() { if (Input.compositionString.Length == 0) ClosePhoto(); }
        void ClosePhoto() { if (_closing) return; SaveNote(); _closing = true; StopAllCoroutines(); StartCoroutine(Leave()); }
        IEnumerator Enter()
        {
            yield return null; var group = UIKit.GetOrAdd<CanvasGroup>(_info); var paperGroup = UIKit.GetOrAdd<CanvasGroup>(_paper);
            float elapsed = 0; Vector2 from = _paperPosition + new Vector2(0, -16); float scale = .92f;
            if (_source != null && _sourceId == _cards[_index].id)
            { var corners = new Vector3[4]; _source.GetWorldCorners(corners); from = _layout.InverseTransformPoint(corners[1]); scale = _source.rect.width / Mathf.Max(1, _paper.rect.width); }
            while (elapsed < .42f && !PhotoStudioElements.Reduced)
            {
                elapsed += Time.unscaledDeltaTime; float t = 1 - Mathf.Pow(1 - Mathf.Clamp01(elapsed / .42f), 3);
                _paper.anchoredPosition = Vector2.Lerp(from, _paperPosition, t); _paper.localScale = Vector3.one * Mathf.Lerp(scale, 1, t); paperGroup.alpha = Mathf.Lerp(.25f, 1, t); group.alpha = Mathf.Clamp01((elapsed - .1f) / .34f); yield return null;
            }
            _paper.anchoredPosition = _paperPosition; _paper.localScale = Vector3.one; group.alpha = paperGroup.alpha = 1;
            EventSystem.current?.SetSelectedGameObject(_info.Find("PhotoClose").gameObject);
        }
        IEnumerator Leave()
        {
            float elapsed = 0; var group = UIKit.GetOrAdd<CanvasGroup>(_root); group.interactable = group.blocksRaycasts = false;
            Vector2 to = _paperPosition + new Vector2(0, -16); float scale = .94f;
            if (_source != null && _sourceId == _cards[_index].id)
            { var corners = new Vector3[4]; _source.GetWorldCorners(corners); to = _layout.InverseTransformPoint(corners[1]); scale = _source.rect.width / Mathf.Max(1, _paper.rect.width); }
            while (elapsed < .12f && !PhotoStudioElements.Reduced)
            { elapsed += Time.unscaledDeltaTime; float t = Mathf.Clamp01(elapsed / .12f); group.alpha = 1 - t; _paper.anchoredPosition = Vector2.Lerp(_paperPosition, to, t); _paper.localScale = Vector3.one * Mathf.Lerp(1, scale, t); yield return null; }
            string id = _cards[_index].id; Close(); _returned?.Invoke(id);
        }
        protected override void OnDestroy() { SaveNote(); }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PhotoNoteLines : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear(); var r = rectTransform.rect; for (float y = r.yMax - 30; y > r.y; y -= 30)
            { int i = vh.currentVertCount; var c = Theme.HexA("#a39477", .2f); vh.AddVert(new Vector3(r.x, y, 0), c, Vector2.zero); vh.AddVert(new Vector3(r.xMax, y, 0), c, Vector2.zero); vh.AddVert(new Vector3(r.xMax, y + 1, 0), c, Vector2.zero); vh.AddVert(new Vector3(r.x, y + 1, 0), c, Vector2.zero); vh.AddTriangle(i, i + 1, i + 2); vh.AddTriangle(i, i + 2, i + 3); }
        }
    }
}
