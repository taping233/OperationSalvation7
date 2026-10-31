// Direct view of preparation.view.js/preparation.css: tracked goals followed by two parallel preset sections.
using System;
using System.Linq;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;
using D = Sdt.UI.Screens.Run.DepartureElements;

namespace Sdt.UI.Screens.Hub
{
    public sealed class PreparationScreen : Panel
    {
        BaseData _base;
        int? _slot;
        string _error, _goal = "";
        readonly HashSet<string> _editors = new HashSet<string>();
        readonly Dictionary<string, string> _addKeys = new Dictionary<string, string>();
        readonly Dictionary<string, int> _addCounts = new Dictionary<string, int>();
        bool Current => ReferenceEquals(_base, GameRuntime.I.Base) && _slot == GameRuntime.I.ActiveSlot;
        public static void Open()
        {
            var page = ScreenMount.Show<PreparationScreen>("Preparation"); page._base = GameRuntime.I.Base; page._slot = GameRuntime.I.ActiveSlot; page.Build();
        }
        public override void CloseFromEscape() => Leave();
        void Leave() { Close(); if (Current) HubScreen.Open("deploy"); }
        public override void Build()
        {
            if (!Current) { Close(); return; }
            var shell = UIKit.Panel("preparation-shell", transform).transform;
            var art = D.Area(shell, "prep-desk", Vector2.zero, Vector2.one); art.gameObject.AddComponent<RectMask2D>();
            var image = D.Area(art, "cover", Vector2.zero, Vector2.one).gameObject.AddComponent<Image>(); D.Cover(image, Sdt.Res.Res.Scene("ui-loop-0925/prep-desk"));
            var tint = D.Area(shell, "desk-overlay", Vector2.zero, Vector2.one); D.Surface(tint, Theme.HexA("#14212C", .94f));
            var header = D.Area(shell, "collection-header", new Vector2(0, 1), Vector2.one, new Vector2(0, -94), Vector2.zero); D.Surface(header, Theme.Hex("#15222B"));
            D.CommandAt(header, "preparationBack", "‹ 返回", Leave, Vector2.zero, new Vector2(0, 1), new Vector2(32, 22), new Vector2(160, -22), Color.clear);
            D.TextAt(header, "目标与预设", 30, Vector2.zero, Vector2.one, new Vector2(196, 22), new Vector2(-32, -22));
            var scroll = D.Scroll(shell, "preparationRoot", Vector2.zero, Vector2.one, new Vector2(32, 32), new Vector2(-32, -126));
            var scrollLayout = scroll.GetComponent<VerticalLayoutGroup>(); scrollLayout.childForceExpandWidth = false; scrollLayout.childAlignment = TextAnchor.UpperCenter;
            var module = D.Flow(scroll, "preparation-module", false, 24); var bounds = module.gameObject.AddComponent<LayoutElement>(); bounds.minWidth = 0; bounds.preferredWidth = 1500; bounds.flexibleWidth = 0;
            BuildGoals(module);
            var row = D.Flow(module, "prep-presets", true, 24); var layout = row.GetComponent<HorizontalLayoutGroup>(); layout.childForceExpandWidth = true; layout.childForceExpandHeight = false;
            foreach (var preset in _base.PreparationPresets()) BuildPreset(row, preset);
            if (!string.IsNullOrEmpty(_error)) D.Copy(module, _error, 20, Theme.Hex("#E8B9AE"));
        }
        void Save(PreparationPreset preset)
        { if (!Current) return; _base.TrySavePreparationPreset(preset, out _error); Rebuild(); }
        void BuildGoals(Transform parent)
        {
            var tracked = _base.PreparationTracked(); D.Copy(parent, "收藏目标                                      追踪 " + tracked.Count + "/3", 26);
            if (tracked.Count == 0) D.Copy(parent, "未追踪目标", 18, D.Muted, 64);
            else
            {
                var cards = D.Flow(parent, "prep-goals", true, 16);
                foreach (string id in tracked)
                {
                    var card = CardLibrary.FindById(id); var section = D.Flow(cards, "goal-" + id, false, 12, new RectOffset(20, 20, 18, 18)); D.Surface(section, Theme.HexA("#FFFFFF", .02f));
                    D.Copy(section, card?.name ?? id, 22); D.Copy(section, BaseData.PreparationSourceHint(card), 18, D.Muted);
                    D.Command(section, "goal-remove", "取消追踪", () => { if (!Current) return; _base.TrySetTrackedGoals(tracked.Where(target => target != id), out _error); Rebuild(); }, Theme.Hex("#1D303B"));
                }
            }
            var add = D.Flow(parent, "prep-goal-add", true, 16); var options = CardLibrary.All().GroupBy(card => card.id).Select(group => group.First()).ToArray();
            Select(add, "选择收藏目标", _goal, options.Select(card => (card.id, card.name)), id => _goal = id);
            var button = D.Command(add, "goal-add", "加入追踪", () => { if (!Current || string.IsNullOrEmpty(_goal)) return; _base.TrySetTrackedGoals(tracked.Concat(new[] { _goal }), out _error); Rebuild(); }, Theme.Hex("#1D303B")); button.interactable = tracked.Count < 3;
        }
        void BuildPreset(Transform parent, PreparationPreset preset)
        {
            var section = D.Flow(parent, "prep-preset " + preset.id, false, 20, new RectOffset(24, 24, 24, 24)); D.Surface(section, Theme.HexA("#182932", .86f));
            var preview = _base.PreviewPreparation(preset); var pet = BaseData.PetsCatalog.FirstOrDefault(p => p.id == (preset.petId ?? _base.petSel));
            D.Copy(section, preset.name, 26).fontStyle = FontStyle.Bold;
            D.Copy(section, (CharacterTable.For(preset.characterId)?.name ?? "未选择人物") + " · " + (string.IsNullOrEmpty(preset.petId) ? "沿用当前伙伴（" + pet?.name + "）" : pet?.name) + " · " + preset.picks.Count + " 种卡牌", 18, D.Muted);
            var edit = D.Command(section, "prep-preset-editor " + preset.id, (_editors.Contains(preset.id) ? "▾ " : "▸ ") + "编辑人物与卡牌", () => { if (!_editors.Add(preset.id)) _editors.Remove(preset.id); Rebuild(); }, Color.clear, Theme.Hex("#C6D5DC"), 20);
            if (_editors.Contains(preset.id))
            {
                D.Copy(section, "方案名", 18, D.Muted); Input(section, preset.name, 24, value => { preset.name = value; Save(preset); });
                var fields = D.Flow(section, "prep-fields", true, 16);
                Select(fields, "未选择人物", preset.characterId, CharacterTable.All.Select(c => (c.id, c.name)), id => { preset.characterId = id == "" ? null : id; Save(preset); });
                Select(fields, "沿用当前伙伴", preset.petId, BaseData.PetsCatalog.Select(p => (p.id, p.name)), id => { preset.petId = id == "" ? null : id; Save(preset); });
                foreach (var pick in preset.picks.ToArray())
                {
                    var result = preview.resolvedPicks.FirstOrDefault(item => item.card.cardId == pick.card.cardId && item.card.variantKey == pick.card.variantKey);
                    var row = D.Flow(section, "prep-pick", true, 12); D.Surface(row, Theme.HexA("#0B1722", .29f));
                    D.Copy(row, (result?.name ?? pick.card.cardId) + " ×" + pick.count + "\n" + (result?.status == "ready" ? "已有 " + result.availableCount : result?.status == "forbidden" ? "职业卡禁带" : "缺 " + Math.Max(0, pick.count - (result?.availableCount ?? 0))) + (string.IsNullOrEmpty(pick.card.variantKey) ? " · 基础优先" : " · 指定版本"), 18, D.Muted);
                    D.Command(row, "preset-pick-remove", "移除", () => { preset.picks.Remove(pick); Save(preset); }, Theme.Hex("#1D303B"));
                }
                if (preset.picks.Count == 0) D.Copy(section, "还没有选择带入卡牌。", 18, D.Muted);
                var add = D.Flow(section, "prep-add", true, 12);
                var stocks = _base.stash.Where(stack => stack.card?.id != null && stack.count > 0 && GameRuntime.I.FindDepartureStack(GameRuntime.DepartureStackKey(stack)) == stack).ToArray();
                _addKeys.TryGetValue(preset.id, out var selectedKey);
                Select(add, "选择仓库卡牌", selectedKey, stocks.Select(stack => (GameRuntime.DepartureStackKey(stack), stack.card.name + " · " + stack.card.rarity + " · " + stack.card.cost + "费 · 库存 " + stack.count)), key => _addKeys[preset.id] = key);
                int count = _addCounts.TryGetValue(preset.id, out var n) ? n : 1;
                Input(add, count.ToString(), 2, value => { _addCounts[preset.id] = int.TryParse(value, out var quantity) ? Math.Max(1, Math.Min(99, quantity)) : 1; }, true);
                D.Command(section, "preset-pick-add", "加入愿望清单", () =>
                {
                    if (!Current || !_addKeys.TryGetValue(preset.id, out var key)) return; var stack = GameRuntime.I.FindDepartureStack(key); if (stack == null) return;
                    string variant = stack.variantKey ?? stack.card.variantKey; var existing = preset.picks.FirstOrDefault(item => item.card.cardId == stack.card.id && item.card.variantKey == variant);
                    if (existing != null) preset.picks.Remove(existing);
                    preset.picks.Add(new PreparationPick { card = new PreparationCardRef { cardId = stack.card.id, variantKey = variant }, count = _addCounts.TryGetValue(preset.id, out var requested) ? requested : 1 }); Save(preset);
                }, Theme.Hex("#1D303B"));
            }
            D.Copy(section, preview.canStart ? "可以应用" : "需要处理", 22, preview.canStart ? D.Accent : Theme.Hex("#D6A79D"));
            D.Copy(section, "带入 " + preview.stashCards + " 张 · 占 " + (preview.capacity?.used ?? 0) + "/" + (preview.capacity?.totalCap ?? _base.BagCap) + " 格 · " + preview.resolvedPicks.Count(item => item.status == "missing") + " 缺失 · " + preview.resolvedPicks.Count(item => item.status == "forbidden") + " 禁带", 18, D.Muted);
            var actions = D.Flow(section, "prep-summary-actions", true, 12);
            D.Command(actions, "preset-preview", "重新预览", Rebuild, Theme.Hex("#1D303B"));
            var apply = D.Command(actions, "preset-apply", "应用到整备", () => { if (!Current) return; Close(); DepartPrepScreen.OpenPreset(preset); }, D.Accent, Theme.Hex("#173B42")); apply.interactable = preview.canStart;
            foreach (string error in preview.errors) D.Copy(section, error, 18, Theme.Hex("#D6A79D"));
            D.Copy(section, "应用后，在整备页确认人物、伙伴与卡牌。", 16, D.Muted);
        }
        static void Input(Transform parent, string value, int limit, Action<string> changed, bool numeric = false)
        {
            var root = new GameObject("prep-input", typeof(RectTransform), typeof(Image), typeof(InputField)); root.transform.SetParent(parent, false); root.GetComponent<Image>().color = Theme.Hex("#1D303B"); root.AddComponent<LayoutElement>().preferredHeight = 44;
            if (numeric) { var le = root.GetComponent<LayoutElement>(); le.preferredWidth = 84; le.flexibleWidth = 0; }
            var text = D.TextAt(root.transform, "", 18, Vector2.zero, Vector2.one, new Vector2(14, 6), new Vector2(-14, -6));
            var input = root.GetComponent<InputField>(); input.textComponent = text; input.characterLimit = limit; input.text = value ?? ""; if (numeric) input.contentType = InputField.ContentType.IntegerNumber;
            input.onEndEdit.AddListener(v => changed(v));
        }
        static void Select(Transform parent, string empty, string value, IEnumerable<(string id, string name)> choices, Action<string> changed)
        {
            var options = new[] { (id: "", name: empty) }.Concat(choices).ToArray();
            var root = D.Area(parent, "prep-select", Vector2.zero, Vector2.one); D.Surface(root, Theme.Hex("#1D303B")); var le = root.gameObject.AddComponent<LayoutElement>(); le.minWidth = 0; le.flexibleWidth = 1; le.preferredHeight = 44;
            var dropdown = root.gameObject.AddComponent<Dropdown>(); dropdown.targetGraphic = root.GetComponent<Image>(); dropdown.captionText = D.TextAt(root, "", 18, Vector2.zero, Vector2.one, new Vector2(14, 6), new Vector2(-24, -6));
            var template = D.Area(root, "Template", Vector2.zero, new Vector2(1, 0), new Vector2(0, -250), Vector2.zero); D.Surface(template, Theme.Hex("#1D303B"));
            var scroll = template.gameObject.AddComponent<ScrollRect>(); scroll.horizontal = false;
            var viewport = D.Area(template, "Viewport", Vector2.zero, Vector2.one); viewport.gameObject.AddComponent<RectMask2D>(); D.Surface(viewport, Color.clear);
            var content = D.Area(viewport, "Content", new Vector2(0, 1), Vector2.one, new Vector2(0, -44), Vector2.zero); content.pivot = new Vector2(.5f, 1);
            var item = D.Area(content, "Item", new Vector2(0, .5f), new Vector2(1, .5f), new Vector2(0, -22), new Vector2(0, 22)); var image = D.Surface(item, Theme.Hex("#315D69")); item.gameObject.AddComponent<Toggle>().targetGraphic = image;
            dropdown.itemText = D.TextAt(item, "", 18, Vector2.zero, Vector2.one, new Vector2(14, 4), new Vector2(-14, -4)); dropdown.template = template; scroll.viewport = viewport; scroll.content = content; template.gameObject.SetActive(false);
            dropdown.AddOptions(options.Select(option => option.name).ToList()); dropdown.value = Math.Max(0, Array.FindIndex(options, option => option.id == value)); dropdown.onValueChanged.AddListener(i => changed(options[i].id));
        }
    }
}
