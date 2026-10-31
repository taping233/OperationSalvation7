using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.UI.Kit;
using D = Sdt.UI.Screens.Run.DepartureElements;

namespace Sdt.UI.Screens.Run
{
    public sealed partial class ClassChoiceScreen
    {
        int _poolPage;
        string _poolFilter = "", _poolSelected;
        void BuildPool()
        {
            var root = D.Area(transform, "cls-pool-page", new Vector2(.01f, .02f), new Vector2(.99f, .98f));
            root.gameObject.AddComponent<PoolFrameBounds>();
            D.Surface(root, Theme.HexA("#141617", .93f));
            var head = D.Area(root, "pg-head", new Vector2(0, 1), Vector2.one, new Vector2(0, -92), Vector2.zero);
            D.Surface(head, Theme.HexA("#E4F4FA", .14f), false, true); D.Line(head, Theme.HexA("#E3F2F3", .30f));
            D.CommandAt(head, "clsBack", "‹ 返回", () => { _poolView = false; Rebuild(); }, Vector2.zero, new Vector2(0, 1), new Vector2(28, 22), new Vector2(145, -22), Color.clear);
            D.TextAt(head, "角色卡池", 30, Vector2.zero, Vector2.one, new Vector2(175, 10), new Vector2(-300, -10));
            var all = CardLibrary.ClassPool(CharacterTable.For(_sel).rulesetId).ToArray();
            D.TextAt(head, CharacterTable.Name(_sel) + "   " + all.Length + " 张", 20, new Vector2(1, 0), Vector2.one, new Vector2(-260, 10), new Vector2(-34, -10)).alignment = TextAnchor.MiddleRight;
            var main = D.Area(root, "pool-main", Vector2.zero, Vector2.one, new Vector2(30, 90), new Vector2(-30, -114));
            var side = D.Area(main, "pool-side", Vector2.zero, new Vector2(0, 1), Vector2.zero, new Vector2(284, 0));
            D.Surface(side, Theme.Hex("#25292D"));
            D.TextAt(side, "卡牌详情", 25, new Vector2(0, 1), Vector2.one, new Vector2(18, -62), new Vector2(-18, -20));
            var matches = all.Where(card => string.IsNullOrEmpty(_poolFilter) || card.type == _poolFilter).ToArray();
            int pages = Math.Max(1, (int)Math.Ceiling(matches.Length / 10f)), size = Math.Max(1, (int)Math.Ceiling(matches.Length / (float)pages));
            _poolPage = Mathf.Clamp(_poolPage, 0, pages - 1);
            var visible = matches.Skip(_poolPage * size).Take(size).ToArray();
            var selected = visible.FirstOrDefault(card => card.id == _poolSelected) ?? visible.FirstOrDefault(); _poolSelected = selected?.id;
            var preview = D.Scroll(side, "poolPreview", Vector2.zero, Vector2.one, new Vector2(18, 16), new Vector2(-18, -78));
            if (selected != null)
            {
                var holder = new GameObject("pv-body", typeof(RectTransform)); holder.transform.SetParent(preview, false); holder.AddComponent<LayoutElement>().preferredHeight = 385;
                D.Card(holder.transform, selected, 240);
                D.Copy(preview, Sdt.Res.CurrentCardPresentation.Description(selected), 17, D.Muted);
            }
            var catalog = D.Area(main, "pool-catalog", Vector2.zero, Vector2.one, new Vector2(306, 0), Vector2.zero); D.Surface(catalog, Theme.HexA("#121314", .35f));
            D.TextAt(catalog, "分类索引     当前档案 " + matches.Length + " 张", 18, new Vector2(0, 1), Vector2.one, new Vector2(18, -58), new Vector2(-18, -10));
            var filters = D.Area(catalog, "pool-filters", new Vector2(0, 1), Vector2.one, new Vector2(16, -108), new Vector2(-16, -62));
            var types = new[] { "" }.Concat(all.Select(card => card.type).Distinct()).ToArray();
            for (int i = 0; i < types.Length; i++)
            {
                string type = types[i]; float x = i / (float)types.Length, next = (i + 1f) / types.Length;
                D.CommandAt(filters, "poolFilter-" + type, (type == "" ? "全部档案" : type) + " " + (type == "" ? all.Length : all.Count(card => card.type == type)), () => { _poolFilter = type; _poolPage = 0; Rebuild(); }, new Vector2(x, 0), new Vector2(next, 1), new Vector2(0, 0), new Vector2(-7, 0), type == _poolFilter ? Theme.HexA("#ADAEB1", .2f) : Color.clear, D.Ink, 14);
            }
            var gridContent = D.Scroll(catalog, "pool-grid-scroll", Vector2.zero, Vector2.one, new Vector2(0, 0), new Vector2(0, -120));
            D.Grid(gridContent, 150, 270, 5);
            foreach (var card in visible)
            {
                var cell = new GameObject("pool-cell " + card.id, typeof(RectTransform)); cell.transform.SetParent(gridContent, false);
                var image = D.Surface(cell.transform, Theme.HexA("#0B0C0D", .35f));
                var face = D.Card(cell.transform, card, 150); face.anchoredPosition = new Vector2(0, -16);
                D.TextAt(cell.transform, CardVisual.EffectiveRarity(card), 13, new Vector2(0, 1), Vector2.one, new Vector2(4, -24), new Vector2(-8, 0), Theme.Hex("#D9DADB")).alignment = TextAnchor.MiddleRight;
                if (_poolSelected == card.id) { var outline = cell.AddComponent<Outline>(); outline.effectColor = Theme.Hex("#EAD386"); outline.effectDistance = new Vector2(2, -2); }
                var button = cell.AddComponent<Button>(); button.targetGraphic = image; var current = card;
                button.onClick.AddListener(() => { _poolSelected = current.id; DepartureCardZoom.Open(new[]{current},returnFocus:_=>button.gameObject); });
                var focus = cell.AddComponent<PoolFocusPreview>(); focus.Preview = () => { if (_poolSelected != current.id) { _poolSelected = current.id; PaintPoolPreview(preview, current); } };
            }
            var foot = D.Area(root, "cls-foot-pool", Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 70)); D.Surface(foot, Theme.Hex("#1B1D1F"));
            D.CommandAt(foot, "poolPrev", "‹ 上一页", () => { _poolPage--; Rebuild(); }, Vector2.zero, Vector2.zero, new Vector2(30, 14), new Vector2(150, 56), null, null, 14).interactable = _poolPage > 0;
            D.TextAt(foot, "第 " + (_poolPage + 1) + " / " + pages + " 页 · 匹配 " + matches.Length + " 张", 14, Vector2.zero, Vector2.zero, new Vector2(168, 14), new Vector2(398, 56));
            D.CommandAt(foot, "poolNext", "下一页 ›", () => { _poolPage++; Rebuild(); }, Vector2.zero, Vector2.zero, new Vector2(410, 14), new Vector2(530, 56), null, null, 14).interactable = _poolPage < pages - 1;
            D.CommandAt(foot, "pickClass", ConfirmLabel, PickClass, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-250, 12), new Vector2(-30, 58), Theme.Hex("#E9D79E"), Theme.Hex("#222427"));
        }
        void PaintPoolPreview(Transform preview, CardDef card)
        {
            for (int i = preview.childCount - 1; i >= 0; i--) Destroy(preview.GetChild(i).gameObject);
            var holder = new GameObject("pv-body", typeof(RectTransform)); holder.transform.SetParent(preview, false); holder.AddComponent<LayoutElement>().preferredHeight = 385;
            D.Card(holder.transform, card, 240); D.Copy(preview, Sdt.Res.CurrentCardPresentation.Description(card), 17, D.Muted);
        }
    }
    internal sealed class PoolFrameBounds : MonoBehaviour
    {
        void LateUpdate()
        {
            var rect = (RectTransform)transform; var size = ((RectTransform)transform.parent).rect.size;
            rect.anchorMin = rect.anchorMax = Vector2.one * .5f; rect.pivot = Vector2.one * .5f;
            rect.sizeDelta = new Vector2(Mathf.Min(1460, size.x * .98f), Mathf.Min(940, size.y * .96f)); rect.anchoredPosition = Vector2.zero;
        }
    }
    internal sealed class PoolFocusPreview : MonoBehaviour, UnityEngine.EventSystems.IPointerEnterHandler, UnityEngine.EventSystems.IPointerExitHandler, UnityEngine.EventSystems.ISelectHandler
    {
        public Action Preview;
        float _due; bool _pending;
        public void OnPointerEnter(UnityEngine.EventSystems.PointerEventData data) { _pending = true; _due = Time.unscaledTime + .09f; }
        public void OnPointerExit(UnityEngine.EventSystems.PointerEventData data) => _pending = false;
        public void OnSelect(UnityEngine.EventSystems.BaseEventData data) => Preview?.Invoke();
        void Update() { if (_pending && Time.unscaledTime >= _due) { _pending = false; Preview?.Invoke(); } }
    }
}
