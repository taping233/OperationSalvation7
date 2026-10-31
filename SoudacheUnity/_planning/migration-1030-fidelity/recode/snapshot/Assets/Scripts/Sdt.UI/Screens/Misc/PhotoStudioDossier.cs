using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    public sealed partial class CardLibraryScreen
    {
        void RenderDossier()
        {
            foreach (Transform child in _inspector) { child.gameObject.SetActive(false); Destroy(child.gameObject); }
            var card = _filtered.FirstOrDefault(c => c.id == _selectedId); _inspector.gameObject.SetActive(card != null); if (card == null) return;
            PhotoStudioElements.Texture(_inspector, "paper"); var content = PhotoStudioElements.Scroll(_inspector, "studio-dossier-scroll", out var scroll); PhotoStudioElements.Fill((RectTransform)scroll.transform, 28, 30, 28, 132); PhotoStudioElements.Vertical(content, 18);
            PhotoStudioElements.Flow(content, "DossierName", card.name, 28, Theme.Hex("#30382e"), true);
            var meta = PhotoStudioElements.Flow(content, "DossierMeta", (card.type == "能力卡" ? "能力" : card.type) + "   <color=#" + ColorUtility.ToHtmlStringRGB(PhotoStudioElements.RarityColor(CardLibrary.RarityOf(card))) + ">" + CardLibrary.RarityOf(card) + "</color>   费用 <color=#934529>" + card.cost + "</color>", 18, PhotoStudioElements.Ink, true);
            if (CardLibrary.RarityOf(card) == "棱彩") PhotoPrismaticText.Apply(meta, (card.type == "能力卡" ? "能力" : card.type).Length + 3, 2);
            var metrics = new List<string>(); int damage = card.dmg ?? 0;
            if (CardLibrary.DmgTypes.Contains(card.type) && (damage > 0 || damage < 0 && card.dmgType == "attack")) metrics.Add(Sdt.Res.CurrentCardPresentation.DamageCaption(card)+"  <color=#934529><size=25>" + damage + "</size></color>");
            int[] values = { CardLibrary.DeriveDraw(card), CardLibrary.DeriveInfuse(card), CardLibrary.DeriveHeal(card), CardLibrary.DeriveArmor(card) }; string[] names = { "抽卡", "注能", "回复", "护甲" };
            for (int i = 0; i < values.Length; i++) if (values[i] != 0) metrics.Add(names[i] + "  <color=#934529><size=25>" + values[i] + "</size></color>");
            if (metrics.Count > 0) PhotoStudioElements.Flow(content, "DossierMetrics", string.Join("    ", metrics), 16, Theme.Hex("#2d6561"), true);
            PhotoStudioElements.DescriptionFlow(content, "DossierDescription", card, 23, true);
            if (PhotoStudioElements.HasDraw(card)) PhotoStudioElements.Flow(content, "DrawExplanation", PhotoStudioElements.DrawExplanation, 16, Theme.Hex("#526255"));
            string note = PhotoDetailScreen.NoteFor(card.id); if (note.Length > 0) PhotoStudioElements.Flow(content, "DossierNote", "备注\n" + note, 14, PhotoStudioElements.Muted).supportRichText = false;
            var controls = PhotoStudioElements.Node(_inspector, "studio-preview-actions"); controls.anchorMin = new Vector2(0, 0); controls.anchorMax = new Vector2(1, 0); controls.pivot = new Vector2(.5f, 0); controls.offsetMin = new Vector2(28, 24); controls.offsetMax = new Vector2(-28, 124);
            int index = _filtered.IndexOf(card); float width = Mathf.Max(0, _inspector.rect.width - 56);
            var prev = PhotoStudioElements.Button(controls, "libPrev", "‹", () => Step(-1), true); PhotoStudioElements.Place((RectTransform)prev.transform, 0, 0, 56, 36); prev.interactable = index > 0;
            var locate = PhotoStudioElements.Button(controls, "libLocate", "⊙", () => Locate(true), true); PhotoStudioElements.Place((RectTransform)locate.transform, 60, 0, 40, 36);
            var position = PhotoStudioElements.Text(controls, "pv-pos", (index + 1) + " / " + _filtered.Count, 18, PhotoStudioElements.Muted); position.alignment = TextAnchor.MiddleCenter; PhotoStudioElements.Place(position.rectTransform, 100, 0, width - 156, 36);
            var next = PhotoStudioElements.Button(controls, "libNext", "›", () => Step(1), true); PhotoStudioElements.Place((RectTransform)next.transform, width - 56, 0, 56, 36); next.interactable = index < _filtered.Count - 1;
            var inspect = PhotoStudioElements.Button(controls, "libInspect", "查看照片", () => Inspect(card.id), true); inspect.GetComponent<Image>().color = Theme.Hex("#d1ac78"); PhotoStudioElements.Place((RectTransform)inspect.transform, 0, 46, width, 44);
            var shutter = PhotoStudioElements.Texture(inspect.transform, "shutter", PhotoStudioElements.Ink); PhotoStudioElements.Place(shutter.rectTransform, width - 38, 10, 24, 24);
        }
    }
}
