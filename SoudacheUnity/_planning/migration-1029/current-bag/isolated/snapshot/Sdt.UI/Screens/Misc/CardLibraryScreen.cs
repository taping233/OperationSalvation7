using System.Collections.Generic;
using UnityEngine.EventSystems;
// ported from src/game.cardslib.js openCardLibrary()/renderCardLibrary()/libFiltered()/libPreviewHTML()
//
// 原界面 DOM 结构 → uGUI 控件树映射：
//   button.pg-close（Esc）                     → 右上 ×
//   header.pg-head：h2 卡牌收藏 + input#cardSearch（搜索名称/效果…）
//                 + select#libRar（稀有度筛选）+ 共 n 张 + 制作新卡 / 导出 / 导入
//     → InputField（onValueChange 只重绘卡格）+ Dropdown + Label + 三按钮
//   .clib-tabs（type-tab 页签：图标+类型+计数）  → 水平按钮行（on 态高亮）
//   .clib-main > aside.clib-preview#libPreview  → 左侧大图预览（CardFace(lg) + 类型/稀有度/词条 hint + 点击进入制作坊）
//                 .lib-grid#libGrid             → 右侧卡网格：lib-item = 卡面wrap（编辑）+ 编辑/删除按钮
//   mouseover 委托 → IPointerEnterHandler：悬停卡格即切换左侧预览（炉石式）
//   删除二次确认：按钮 2.6s 内再点才执行（「删除」→「确认删除？」）
// 未解锁卡 ??? 语义：Base.collection 收藏判定——未收藏卡显示 ???（名字/描述遮蔽，预览不亮词条）。
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Misc
{
    /// <summary>卡牌收藏图鉴：筛选（页签/稀有度/搜索）+ 悬停大图预览 + 编辑入口。</summary>
    public class CardLibraryScreen : Panel
    {
        static string _tab = "全部", _rar = "全部", _q = "";
        static string _classFilter = "全部", _sort = "rarity";
        static int _page;
        const int PageSize = 36;
        Transform _gridRoot, _previewRoot, _tabsRoot;
        Transform _grid;
        Text _pageLabel;

        public static void Open()
        {
            var s = ScreenMount.Show<CardLibraryScreen>("CardLibrary");
            s.Build();
            App.RegisterKey(KeyCode.Escape, CloseFromKey);
        }

        static void CloseFromKey() { if (Current != null) Current.CloseLib(); }
        static CardLibraryScreen Current;

        void CloseLib()
        {
            Close();
        }

        protected override void OnDestroy()
        {
            if (Current == this) { Current = null; App.UnregisterKey(KeyCode.Escape); }
        }

        // TYPES（cards.js）
        static readonly string[] Types = { "武术", "法术", "生物", "道具", "装备", "事件", "能力卡", "资源" };
        static readonly string[] Rarities = { "初始", "古朴", "稀有", "史诗", "传说", "职业", "衍生" };

        static bool Discovered(CardDef c)
        {
            return c != null;
        }

        // libFiltered
        System.Collections.Generic.List<CardDef> Filtered()
        {
            var q = (_q ?? "").Trim().ToLowerInvariant();
            var lib = CardLibrary.All();
            var cards = lib.Where(c =>
                (_tab == "全部" || c.type == _tab) &&
                (_rar == "全部" || CardLibrary.RarityOf(c) == _rar) &&
                (_classFilter == "全部" || (_classFilter == "通用" ? string.IsNullOrEmpty(c.cls) || c.cls == "通用" : c.cls == _classFilter)) &&
                (q == "" || q.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries).All(term => (c.name ?? "").ToLowerInvariant().Contains(term) || (c.desc ?? "").ToLowerInvariant().Contains(term))))
                .ToList();
            cards.Sort((a, b) =>
            {
                if (_sort == "name") return string.Compare(a.name, b.name, StringComparison.CurrentCulture);
                int byCost = a.cost - b.cost;
                if (_sort == "cost" && byCost != 0) return byCost;
                int byRar = Array.IndexOf(Rarities, CardLibrary.RarityOf(b)) - Array.IndexOf(Rarities, CardLibrary.RarityOf(a));
                if (byRar != 0) return byRar;
                return string.Compare(a.name, b.name, StringComparison.CurrentCulture);
            });
            return cards;
        }

        public override void Build()
        {
            Current = this;
            var root = UIKit.Panel("clib", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.97f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 8; vl.padding = new RectOffset(20, 20, 16, 16);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            // header
            var head = UiExt.Row(root.transform);
            var hl = UIKit.Toolbar(head, 44, 10);
            UIKit.IconText(head.transform, "[[icon:book]] 照相馆").fontSize = 24;
            var search = MakeSearch(head.transform);
            UIKit.Btn(head.transform, "稀有度：" + _rar, () =>
            {
                var values = new[] { "全部" }.Concat(Rarities).ToArray();
                _rar = values[(Array.IndexOf(values, _rar) + 1) % values.Length]; _page = 0; RebuildAll();
            });
            UIKit.Btn(head.transform, "人物：" + (_classFilter == "全部" || _classFilter == "通用" ? _classFilter : CharacterTable.Name(_classFilter)), () =>
            {
                var values = new[] { "全部", "通用" }.Concat(CharacterTable.All.Select(character => character.rulesetId)).ToArray();
                _classFilter = values[(Array.IndexOf(values, _classFilter) + 1) % values.Length]; _page = 0; RebuildAll();
            });
            UIKit.Btn(head.transform, "排序：" + (_sort == "cost" ? "费用" : _sort == "name" ? "名称" : "稀有度"), () =>
            { _sort = _sort == "rarity" ? "cost" : _sort == "cost" ? "name" : "rarity"; _page = 0; RebuildAll(); });
            UIKit.Btn(head.transform, "重置", () => { _tab = _rar = _classFilter = "全部"; _q = ""; _page = 0; RebuildAll(); });
            if (App.CardEditingEnabled)
            {
                UIKit.Btn(head.transform, "＋ 制作新卡", () => { CloseLib(); CardDesignerScreen.Open(null); });
                UIKit.Btn(head.transform, "[[icon:upload]] 导出", () => { CloseLib(); ImportExportOverlay.ShowExport(); });
                UIKit.Btn(head.transform, "[[icon:download]] 导入", () => { CloseLib(); ImportExportOverlay.ShowImport(() => CardLibraryScreen.Open()); });
            }
            UIKit.Btn(head.transform, "×", () => CloseLib());

            // tabs
            var tabs = UiExt.Row(root.transform);
            var thl = UIKit.Toolbar(tabs, 42, 6);
            _tabsRoot = tabs.transform;
            var lib = CardLibrary.All();
            var counts = lib.GroupBy(c => c.type).ToDictionary(g => g.Key, g => g.Count());
            MakeTab("全部", lib.Count);
            foreach (var t in Types) if (counts.ContainsKey(t)) MakeTab(t, counts[t]);

            // main：左预览 + 右网格
            var main = UiExt.Row(root.transform);
            var mhl = main.AddComponent<HorizontalLayoutGroup>();
            mhl.spacing = 14; mhl.childForceExpandWidth = true; mhl.childForceExpandHeight = true;
            mhl.childControlWidth = true; mhl.childControlHeight = true;
            var leM = main.AddComponent<LayoutElement>(); leM.flexibleHeight = 1;

            var preview = UiExt.Col(main.transform);
            var pvl = preview.AddComponent<VerticalLayoutGroup>();
            pvl.spacing = 6; pvl.childForceExpandWidth = true; pvl.childForceExpandHeight = false;
            var leP = preview.AddComponent<LayoutElement>(); leP.flexibleWidth = 1; leP.minWidth = 260;
            _previewRoot = preview.transform;
            RenderPreview(null);

            var scroll = UIKit.Scroll(main.transform);
            var leS = scroll.AddComponent<LayoutElement>(); leS.flexibleWidth = 2.4f; leS.flexibleHeight = 1;
            var grid = UIKit.Grid(scroll.transform, 6, CardFace.SizeOf(CardSize.Sm) + new Vector2(0, 30), new Vector2(10, 10));
            _grid = grid.transform;
            _gridRoot = scroll.transform;
            RebuildGrid(grid.transform);
            var pages = UIKit.Row(root.transform); UIKit.Toolbar(pages, 42, 14);
            UIKit.Btn(pages.transform, "上一页", () => { _page = Math.Max(0, _page - 1); RefreshGrid(); });
            _pageLabel = UIKit.Label(pages.transform, "", 16, UiPalette.Dim);
            UIKit.Btn(pages.transform, "下一页", () => { _page = Math.Min(Math.Max(0, (Filtered().Count - 1) / PageSize), _page + 1); RefreshGrid(); });
            UpdatePageLabel();
        }

        void MakeTab(string t, int count)
        {
            var b = UIKit.Btn(_tabsRoot, t + " " + count, () => { _tab = t; _page = 0; RebuildAll(); });
            b.image.color = _tab == t ? UiPalette.HexA("#1F4A3C", 0.9f) : UiPalette.HexA("#0E2230", 0.9f);
        }

        InputField MakeSearch(Transform parent)
        {
            var go = new GameObject("cardSearch", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var le = go.AddComponent<LayoutElement>(); le.minWidth = 200; le.minHeight = 30;
            var img = UiExt.Box(go.transform, UiPalette.HexA("#12222E", 0.9f));
            UiExt.Stretch(img.rectTransform);
            img.raycastTarget = true;
            var inf = go.AddComponent<InputField>();
            inf.targetGraphic = img;
            var txt = UIKit.Label(go.transform, "", 14, Color.white); txt.supportRichText = false;
            var ph = UIKit.Label(go.transform, "搜索名称 / 效果…", 14, UiPalette.Dim);
            inf.textComponent = txt; inf.placeholder = ph;
            UiExt.Stretch(txt.rectTransform); UiExt.Stretch(ph.rectTransform);
            inf.SetTextWithoutNotify(_q);
            inf.onValueChanged.AddListener(v => { _q = v; _page = 0; RefreshGrid(); });
            return inf;
        }
        void UpdatePageLabel()
        {
            if (_pageLabel != null) _pageLabel.text = "第 " + (_page + 1) + "/" + Math.Max(1, (Filtered().Count + PageSize - 1) / PageSize) + " 页 · " + Filtered().Count + " 张照片";
        }
        void RefreshGrid()
        {
            if (_grid == null) return;
            for (int index = _grid.childCount - 1; index >= 0; index--) Destroy(_grid.GetChild(index).gameObject);
            RebuildGrid(_grid); UpdatePageLabel();
        }

        void RebuildAll()
        {
            for (int i = transform.childCount - 1; i >= 0; i--) Destroy(transform.GetChild(i).gameObject);
            Current = this;
            Build();
        }

        void RebuildGrid(Transform grid)
        {
            var cards = Filtered();
            if (cards.Count == 0)
            {
                var empty = UIKit.Label(_gridRoot, CardLibrary.All().Count > 0 ? "没有符合筛选条件的卡牌" : "收藏还是空的，探索并带回卡牌后查看", 15, UiPalette.Dim);
                return;
            }
            foreach (var c in cards.Skip(_page * PageSize).Take(PageSize))
            {
                var item = new GameObject("lib-item", typeof(RectTransform));
                item.transform.SetParent(grid, false);
                var ivl = item.AddComponent<VerticalLayoutGroup>();
                ivl.spacing = 3; ivl.childForceExpandWidth = false; ivl.childForceExpandHeight = false;
                ivl.childControlWidth = ivl.childControlHeight = true; ivl.childAlignment = TextAnchor.UpperLeft;
                var wrap = new GameObject("lib-cardwrap", typeof(RectTransform));
                wrap.transform.SetParent(item.transform, false);
                var size = CardFace.SizeOf(CardSize.Sm);
                var cardBounds = wrap.AddComponent<LayoutElement>();
                cardBounds.minWidth = cardBounds.preferredWidth = size.x;
                cardBounds.minHeight = cardBounds.preferredHeight = size.y;
                ((RectTransform)wrap.transform).sizeDelta = size;
                var known = Discovered(c);
                if (known) CardFace.Create(c, CardSize.Sm, wrap.transform, options: new CardFaceOptions { HideCost = false });
                else
                {
                    // 未解锁：??? 语义（卡面遮蔽）
                    var hidden = new CardDef { name = "???", cost = c.cost, rarity = c.rarity, type = c.type, desc = "???" };
                    CardFace.Create(hidden, CardSize.Sm, wrap.transform, options: new CardFaceOptions { HideCost = false });
                    var mask = UiExt.Box(wrap.transform, UiPalette.HexA("#101E27", 0.55f));
                    UiExt.Stretch(mask.rectTransform);
                }
                var hover = wrap.AddComponent<LibHover>();
                hover.card = c; hover.screen = this;
                var btnRow = UiExt.Row(item.transform);
                var bhl = btnRow.AddComponent<HorizontalLayoutGroup>();
                bhl.spacing = 4;
                if (App.CardEditingEnabled)
                {
                    UIKit.Btn(btnRow.transform, "编辑", () => { CloseLib(); CardDesignerScreen.Open(c); });
                    Button del = null;
                    del = UIKit.Btn(btnRow.transform, "删除", () => TryDelete(c, del));
                }
            }
        }

        Button _armedDel; float _armTime;
        void TryDelete(CardDef c, Button btn)
        {
            if (btn != _armedDel || Time.unscaledTime - _armTime > 2.6f)
            {
                _armedDel = btn; _armTime = Time.unscaledTime;
                btn.GetComponentInChildren<Text>().text = "确认删除？";
                return;
            }
            CardLibrary.Remove(c.id);
            RunLog.Log("[[icon:trash]] 已删除卡牌【<b>" + c.name + "</b>】", "warn");
            RebuildAll();
        }

        // libPreviewHTML
        internal void RenderPreview(CardDef c)
        {
            for (int i = _previewRoot.childCount - 1; i >= 0; i--) Destroy(_previewRoot.GetChild(i).gameObject);
            if (c == null)
            {
                var e = UIKit.IconText(_previewRoot, "[[icon:cards]]");
                e.fontSize = 48; e.alignment = TextAnchor.MiddleCenter; e.color = UiPalette.Dim;
                var le = e.gameObject.AddComponent<LayoutElement>(); le.minHeight = 200; le.flexibleHeight = 1;
                var hint = UIKit.Label(_previewRoot, "把鼠标悬停在右侧卡牌上\n这里会显示大图预览", 14, UiPalette.Dim);
                hint.alignment = TextAnchor.MiddleCenter;
                return;
            }
            var known = Discovered(c);
            CardFace.Create(known ? c : new CardDef { name = "???", type = c.type, rarity = c.rarity, desc = "???" }, CardSize.Lg, _previewRoot, options: new CardFaceOptions { HideCost = false });
            if (!known)
            {
                UIKit.Label(_previewRoot, "??? · 尚未收藏", 15, UiPalette.Dim).alignment = TextAnchor.MiddleCenter;
                return;
            }
            var dmgTxt = "";
            if (c.dmg > 0 && (c.type == "武术" || c.type == "法术"))
                dmgTxt = "\n伤害词条：<b>" + c.dmg + "</b>" + (string.IsNullOrEmpty(c.dmgType) ? "" : " · " + c.dmgType);
            var kw = new System.Collections.Generic.List<string>();
            if (c.draw > 0) kw.Add("抽卡 " + c.draw);
            if (c.infuse > 0) kw.Add("注能(" + c.infuse + ")");
            if (c.heal > 0) kw.Add("回复 " + c.heal);
            if (c.armor > 0) kw.Add("护甲 " + c.armor);
            var kwTxt = kw.Count > 0 ? "\n效果词条：<b>" + string.Join(" · ", kw) + "</b>" : "";
            UIKit.Label(_previewRoot, c.type + " · " + CardLibrary.RarityOf(c) + dmgTxt + kwTxt, 14, UiPalette.Dim)
                .alignment = TextAnchor.UpperCenter;
            UIKit.Btn(_previewRoot, "放大查看照片与备注", () => PhotoDetailScreen.Open(Filtered(), c.id));
        }

        /// <summary>mouseover 悬停委托：悬停即预览 + 点击进制作坊。</summary>
        class LibHover : MonoBehaviour, IPointerEnterHandler, IPointerClickHandler
        {
            public CardDef card; public CardLibraryScreen screen;
            public void OnPointerEnter(PointerEventData e)
            {
                if (screen != null && card != null) screen.RenderPreview(card);
                AudioService.I.PlaySfx("rollover");
            }
            public void OnPointerClick(PointerEventData e)
            {
                if (card != null && screen != null) PhotoDetailScreen.Open(screen.Filtered(), card.id);
            }
        }
    }
}
