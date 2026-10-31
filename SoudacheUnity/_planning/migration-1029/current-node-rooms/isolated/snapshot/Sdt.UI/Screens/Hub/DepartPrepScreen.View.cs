using System;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using D = Sdt.UI.Screens.Run.DepartureElements;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class DepartPrepScreen
    {
        void BuildFilters(Transform storage)
        {
            var row = D.Area(storage, "dep-filters", new Vector2(0, 1), Vector2.one, new Vector2(24, -120), new Vector2(-24, -82));
            Filter(row, "稀有度", _rarity, CardLibrary.Rarities, 0, .34f, value => _rarity = value);
            Filter(row, "类型", _type, B.stash.Select(stack => stack.card.type).Distinct().ToArray(), .35f, .68f, value => _type = value);
            Filter(row, "费用", _cost, B.stash.Select(stack => stack.card.cost).Distinct().OrderBy(cost => cost).Select(cost => cost.ToString()).ToArray(), .69f, 1, value => _cost = value);
            _filterCount = D.TextAt(storage, "", 15, new Vector2(0, 1), Vector2.one, new Vector2(24, -148), new Vector2(-120, -124), D.Muted);
            D.CommandAt(storage, "depFilterReset", "重置", () => { _rarity = _type = _cost = ""; Rebuild(); }, new Vector2(1, 1), Vector2.one, new Vector2(-100, -148), new Vector2(-24, -122), Color.clear, D.Muted, 15).gameObject.SetActive(_rarity != "" || _type != "" || _cost != "");
        }
        void Filter(Transform parent, string title, string current, string[] values, float x, float next, Action<string> changed)
        {
            var host = D.Area(parent, "depFilter" + title, new Vector2(x, 0), new Vector2(next, 1), Vector2.zero, new Vector2(-5, 0)); D.Surface(host, Theme.HexA("#102D3A", .5f), true);
            var dropdown = host.gameObject.AddComponent<Dropdown>(); dropdown.targetGraphic = host.GetComponent<Image>();
            var caption = D.TextAt(host, "", 16, Vector2.zero, Vector2.one, new Vector2(8, 3), new Vector2(-18, -3)); dropdown.captionText = caption;
            var choices = new[] { "" }.Concat(values.Where(value => !string.IsNullOrEmpty(value)).Distinct()).ToList();
            var template = D.Area(host, "Template", Vector2.zero, new Vector2(1, 0), new Vector2(0, -240), Vector2.zero); D.Surface(template, Theme.Hex("#1B3440"));
            var scroll = template.gameObject.AddComponent<ScrollRect>(); scroll.horizontal = false;
            var viewport = D.Area(template, "Viewport", Vector2.zero, Vector2.one); viewport.gameObject.AddComponent<RectMask2D>(); D.Surface(viewport, Color.clear);
            var content = D.Area(viewport, "Content", new Vector2(0, 1), Vector2.one, new Vector2(0, -38), Vector2.zero); content.pivot = new Vector2(.5f, 1);
            var item = D.Area(content, "Item", new Vector2(0, .5f), new Vector2(1, .5f), new Vector2(0, -19), new Vector2(0, 19));
            var image = D.Surface(item, Theme.Hex("#315D69")); var toggle = item.gameObject.AddComponent<Toggle>(); toggle.targetGraphic = image;
            dropdown.itemText = D.TextAt(item, "", 16, Vector2.zero, Vector2.one, new Vector2(8, 2), new Vector2(-8, -2));
            dropdown.template = template; scroll.viewport = viewport; scroll.content = content; template.gameObject.SetActive(false);
            dropdown.AddOptions(choices.Select(value => value == "" ? "不限" + title + " ▾" : value + (title == "费用" ? "费" : "")).ToList()); dropdown.value = Math.Max(0, choices.IndexOf(current));
            dropdown.onValueChanged.AddListener(index => { if (!Current || _submitting) return; changed(choices[index]); ApplyFilters(); });
        }
        void BuildPoolItems()
        {
            foreach (var stack in B.stash.Where(stack => stack.card != null && stack.card.rarity != "职业"))
            {
                string key = GameRuntime.DepartureStackKey(stack);
                // Duplicate explicit identities remain unavailable, as in findDepartureStack.
                var root = D.Area(_pool, "dep-card " + key, Vector2.zero, Vector2.zero); var hit = D.Surface(root, Color.clear);
                var face = D.Card(root, stack.card, 216); face.anchoredPosition = new Vector2(0, -12); var alpha = face.gameObject.AddComponent<CanvasGroup>();
                var quantity = D.TextAt(root, "", 16, new Vector2(0, 1), Vector2.one, new Vector2(8, -388), new Vector2(-8, -350)); quantity.alignment = TextAnchor.MiddleCenter;
                var button = root.gameObject.AddComponent<Button>(); button.targetGraphic = hit;
                var drag = root.gameObject.AddComponent<DepartureDragHandle>(); drag.Key = key; drag.Card = stack.card; drag.Allowed = () => Current && !_submitting && !_petSaving && CanAdd(key); drag.Removing = false;
                button.onClick.AddListener(() => { if (!drag.Dragging) AddPick(key); });
                _poolItems[key] = new PoolItem { stack = stack, root = root.gameObject, quantity = quantity, face = alpha, drag = drag };
            }
            if (_poolItems.Count == 0) D.Copy(_pool, "仓库里还没有卡牌——撤离成功后在整理界面把战利品放回仓库，下次出征就能带上了。", 17, D.Muted);
        }
        bool CanAdd(string key)
        {
            var stack = GameRuntime.I.FindDepartureStack(key); int selected = _pick.TryGetValue(key, out var n) ? n : 0;
            return stack != null && selected < stack.count && stack.card.rarity != "职业" && GameRuntime.I.ProjectDeparture(new Dictionary<string, int>(_pick) { [key] = selected + 1 }).capacity.capacityOk;
        }
        void ApplyFilters()
        {
            int visible = 0;
            foreach (var pair in _poolItems)
            {
                var card = pair.Value.stack.card;
                bool show = (_rarity == "" || CardVisual.EffectiveRarity(card) == _rarity) && (_type == "" || card.type == _type) && (_cost == "" || card.cost.ToString() == _cost);
                pair.Value.root.SetActive(show); if (show) visible++;
            }
            if (_filterCount != null) _filterCount.text = visible == 0 ? "没有匹配的卡牌" : "显示 " + visible + " / " + _poolItems.Count + " 种卡牌";
        }
        void RefreshSelection()
        {
            if (!Current) return;
            if (_poolItems.Any(pair => GameRuntime.I.FindDepartureStack(pair.Key) != null && !ReferenceEquals(pair.Value.stack, GameRuntime.I.FindDepartureStack(pair.Key)))) { Rebuild(); return; }
            var projection = GameRuntime.I.ProjectDeparture(_pick);
            foreach (var pair in _poolItems)
            {
                int count = _pick.TryGetValue(pair.Key, out var n) ? n : 0; var item = pair.Value;
                item.quantity.text = "剩余 <b>" + Math.Max(0, item.stack.count - count) + "</b>    <color=#F1CD83>已带 <b>" + count + "</b></color>";
                item.face.alpha = CanAdd(pair.Key) ? 1 : .5f;
                var mark = item.root.transform.Find("picked-mark");
                if (count > 0 && mark == null) { var check = D.TextAt(item.root.transform, "✓", 24, new Vector2(1, 1), Vector2.one, new Vector2(-40, -44), new Vector2(-12, -12), D.Accent); check.name = "picked-mark"; }
                else if (mark != null) mark.gameObject.SetActive(count > 0);
            }
            var used = new HashSet<string>(); int order = 0;
            foreach (var cell in projection.cells)
            {
                string key = cell.card.name + ":" + order; used.Add(key);
                if (!_bagItems.TryGetValue(key, out var item))
                {
                    var root = D.Area(_bag, "bag-cell " + key, Vector2.zero, Vector2.zero); var hit = D.Surface(root, Color.clear);
                    var face = D.Card(root, cell.card, 216); face.anchoredPosition = new Vector2(0, -12);
                    var text = D.TextAt(root, "", 18, new Vector2(0, 1), Vector2.one, new Vector2(10, -388), new Vector2(-10, -350), Theme.Hex("#C9E4DF")); text.alignment = TextAnchor.MiddleCenter;
                    var drag = root.gameObject.AddComponent<DepartureDragHandle>(); drag.Removing = true; drag.Card = cell.card; drag.Allowed = () => Current && !_submitting && !_petSaving && !string.IsNullOrEmpty(drag.Key);
                    var button = root.gameObject.AddComponent<Button>(); button.targetGraphic = hit;
                    item = new BagItem { root = root.gameObject, quantity = text, drag = drag, card = cell.card }; _bagItems[key] = item;
                    var captured = item; button.onClick.AddListener(() => { if (Current && !captured.drag.Dragging) { var cards = GameRuntime.I.ProjectDeparture(_pick).cells.Select(c => c.card).GroupBy(card => card.id + ":" + card.variantKey).Select(g => g.First()).ToArray(); DepartureCardZoom.Open(cards, Math.Max(0, Array.FindIndex(cards, card => card.id == captured.card.id && card.variantKey == captured.card.variantKey))); } });
                }
                item.root.transform.SetSiblingIndex(order++); item.quantity.text = "×" + cell.count + (cell.fixedCount > 0 ? " · 固定 " + cell.fixedCount : "");
                item.drag.Key = cell.sources.FirstOrDefault();
            }
            foreach (var pair in _bagItems.Where(pair => !used.Contains(pair.Key)).ToArray()) { pair.Value.root.SetActive(false); Destroy(pair.Value.root); _bagItems.Remove(pair.Key); }
            var cap = projection.capacity;
            _capacity.text = "[[icon:bag]] 背包 " + cap.used + " / " + cap.totalCap + " 格" + (cap.resourceBonus > 0 ? " · 额外 " + cap.resourceBonus + " 格仅放资源" : "") + (B.pocket.Count > 0 ? "\n待复原卡牌 " + B.pocket.Sum(stack => stack.count) + " 张 · 出发后清空" : "");
            _confirm.interactable = !_submitting && !_petSaving && cap.capacityOk; _status.text = _hint;
            foreach (var button in _petButtons) { string id = button.name.Substring("depPet-".Length); button.GetComponent<Image>().color = B.petSel == id ? Theme.Hex("#A2CEC7") : Theme.HexA("#112F3B", .4f); foreach (var t in button.GetComponentsInChildren<Text>()) t.color = B.petSel == id ? Theme.Hex("#173C42") : D.Ink; button.interactable = !_submitting && !_petSaving; }
            ApplyFilters();
        }
        void BuildPets(Transform pack)
        {
            var strip = D.Area(pack, "pet-strip", Vector2.zero, new Vector2(1, 0), new Vector2(24, _survival ? 166 : 74), new Vector2(-24, _survival ? 210 : 118));
            var label = D.Copy(strip, "[[icon:paw]] 随行宠物", 16, D.Muted); label.gameObject.GetComponent<LayoutElement>().preferredWidth = 125;
            foreach (var pet in BaseData.PetsCatalog.Where(pet => B.pets.ContainsKey(pet.id)))
            {
                string id = pet.id; var button = D.Command(strip, "depPet-" + id, "[[icon:" + pet.icon + "]] " + pet.name + " Lv." + B.PetLevel(id), () =>
                {
                    if (!Current || _submitting || _petSaving) return; _petSaving = true;
                    bool saved = B.TrySelectPet(id, out var reason); _petSaving = false;
                    Notice(saved ? "已携带" + pet.name + " · 安全格 " + B.SafeCap + " 格" : reason); RefreshSelection();
                }, null, null, 16); button.GetComponent<LayoutElement>().preferredWidth = Math.Max(145, pet.name.Length * 18 + 105); _petButtons.Add(button);
            }
            var wrap = strip.gameObject.AddComponent<DeparturePetWrap>(); wrap.Bag = (RectTransform)_bag.parent; wrap.Bottom = _survival ? 166 : 74;
        }
        string RecommendationSignature() => string.Join("|", B.stash.Select(stack => GameRuntime.DepartureStackKey(stack) + "=" + stack.count)) + ":" + B.petSel + ":" + B.BagCap + ":" + string.Join(";", _pick.OrderBy(p => p.Key).Select(p => p.Key + "=" + p.Value));
        // Current source retains these handlers without mounting a dep-recommend strip in cover-v3.
        void PreviewRecommendation() { _recommended = GameRuntime.I.RecommendDeparture(_pick); _recommendedSignature = RecommendationSignature(); Notice("推荐预览未扣仓，可应用后继续调整。"); }
        void ApplyRecommendation()
        {
            if (_recommended == null || _recommendedSignature != RecommendationSignature()) { Notice("请先预览推荐；若库存或选择有变化，请重新预览。"); return; }
            _undo = new Dictionary<string, int>(_pick); _pick = _recommended; _recommended = null; _undoSignature = RecommendationSignature(); Notice("已应用，尚未扣仓；可调整或撤销。"); RefreshSelection();
        }
        void UndoRecommendation()
        {
            if (_undo == null || _undoSignature != RecommendationSignature()) { Notice("没有可撤销的推荐，或你已继续调整；保留当前选择。"); return; }
            _pick = _undo; _undo = null; _recommended = null; Notice("已撤销推荐，恢复应用前的携带选择；仓库未扣卡。"); RefreshSelection();
        }
    }
    internal sealed class DeparturePetWrap : MonoBehaviour
    {
        public RectTransform Bag;
        public float Bottom;
        void LateUpdate()
        {
            var rect = (RectTransform)transform; float width = rect.rect.width, x = 0, y = 0;
            foreach (RectTransform child in transform)
            {
                float w = Mathf.Min(width, Math.Max(125, LayoutUtility.GetPreferredWidth(child)));
                if (x > 0 && x + w > width) { x = 0; y += 53; }
                D.Place(child, new Vector2(0, 1), new Vector2(0, 1), new Vector2(x, -y - 44), new Vector2(x + w, -y)); x += w + 9;
            }
            rect.offsetMax = new Vector2(rect.offsetMax.x, Bottom + y + 44); Bag.offsetMin = new Vector2(Bag.offsetMin.x, Bottom + y + 52);
        }
    }
}
