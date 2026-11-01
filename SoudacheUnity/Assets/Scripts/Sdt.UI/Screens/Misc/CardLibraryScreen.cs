using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>Current game.cardslib.page: continuous photo wall, filter context and paper dossier.</summary>
    public sealed partial class CardLibraryScreen : Panel
    {
        static string _tab = "全部", _rar = "全部", _q = "", _cls = "全部", _sort = "rarity", _selectedId;
        static readonly string[] Types = { "全部", "武术", "法术", "生物", "道具", "装备", "事件", "能力卡", "资源" };
        static readonly CompareInfo Chinese = CultureInfo.GetCultureInfo("zh-CN").CompareInfo;
        static readonly Dictionary<string, BrowsePosition> History = new Dictionary<string, BrowsePosition>();
        sealed class BrowsePosition { public string Selected; public float Scroll; }
        readonly Dictionary<int, RectTransform> _mounted = new Dictionary<int, RectTransform>();
        readonly List<int> _unmounted = new List<int>();
        int _mountedFirst = -1, _mountedLast = -2;
        float _mountedWidth, _mountedHeight;
        readonly List<Button> _tabs = new List<Button>();
        readonly List<RectTransform> _toolbarControls = new List<RectTransform>();
        List<CardDef> _catalog, _filtered;
        RectTransform _root, _header, _main, _catalogRoot, _filterbar, _chips, _content, _inspector;
        ScrollRect _wall;
        InputField _search;
        Text _count;
        PhotoStudioChoice _choice;
        string _renderedContext, _hoverId;
        float _searchAt = -1, _hoverAt = -1, _hoverBlockUntil;
        float _tileW, _tileH, _lastWidth, _lastHeight;
        bool _layoutPending;
        RunState _state;
        int? _slot;
        string _previousPhase;
        bool _leaving;
        public static void Open()
        {
            var runtime = GameRuntime.I; string phase = runtime.State.Phase;
            if (phase != "idle" && phase != "modal" && phase != "title" || UiStack.CapturePanels().Any(p => p is CardLibraryScreen)) return;
            var s = ScreenMount.Show<CardLibraryScreen>("CardLibrary"); s._state = runtime.State; s._slot = runtime.ActiveSlot; s._previousPhase = phase; runtime.State.Phase = "modal";
            CurrentRunFilm.PageEntry(s, photo: true); s.Build();
        }
        public override void Build()
        {
            _catalog = CardLibrary.All().Where(c => c != null && c.id != "tt-token-color").ToList();
            _root = PhotoStudioElements.Node(transform, "photo-studio-v3 studio-unified studio-archive"); PhotoStudioElements.Fill(_root); BuildRoom(_root, false);
            _header = PhotoStudioElements.Node(_root, "collection-page-header");
            PhotoStudioElements.Paint(_header, "HeaderGlass", Theme.HexA("#15251d", .75f));
            var back = PhotoStudioElements.Button(_header, "closeCardPage", "‹", BeginClose); PhotoStudioElements.Place((RectTransform)back.transform, 18, 18, 64, 52);
            var title = PhotoStudioElements.Text(_header, "PhotoStudioTitle", "照相馆", 32, Theme.Hex("#f1e6d1")); PhotoStudioElements.Place(title.rectTransform, 106, 25, 250, 52);
            var total = PhotoStudioElements.Text(_header, "StudioTotal", "馆藏  <b>" + _catalog.Count + "</b>  张照片", 20, Theme.Hex("#b9b09d")); PhotoStudioElements.Place(total.rectTransform, 260, 32, 270, 40);
            var nav = PhotoStudioElements.Node(_header, "studio-category-tabs"); PhotoStudioElements.Place(nav, 106, 88, 1700, 52);
            foreach (var type in Types)
            {
                var captured = type; var button = PhotoStudioElements.Button(nav, "libType" + _tabs.Count, type, () => ChangeTab(captured)); _tabs.Add(button);
                var navigation = button.navigation; navigation.mode = Navigation.Mode.None; button.navigation = navigation;
                var icon = PhotoStudioElements.Texture(button.transform, "category-" + type, Theme.Hex("#b9b09d")); PhotoStudioElements.Place(icon.rectTransform, 12, 16, 20, 20);
                var label = button.GetComponentInChildren<Text>(); label.fontSize = 20; label.alignment = TextAnchor.MiddleLeft; PhotoStudioElements.Fill(label.rectTransform, 40, 0, 8, 0);
                var line = PhotoStudioElements.Paint(button.transform, "CategoryMarker", Theme.Hex("#d1ac78")); line.rectTransform.anchorMin = Vector2.zero; line.rectTransform.anchorMax = new Vector2(1, 0); line.rectTransform.offsetMin = Vector2.zero; line.rectTransform.offsetMax = new Vector2(0, 2);
            }
            _main = PhotoStudioElements.Node(_root, "clib-main"); _catalogRoot = PhotoStudioElements.Node(_main, "studio-catalog"); _filterbar = PhotoStudioElements.Node(_catalogRoot, "studio-filterbar");
            _search = MakeSearch(_filterbar); _toolbarControls.Add((RectTransform)_search.transform);
            MakeChoice("libRar", "稀有度", new[] { "全部" }.Concat(CardLibrary.Rarities).ToArray(), null, _rar, v => { Remember(); _rar = v; Refresh(); });
            MakeChoice("libSort", "排序", new[] { "rarity", "cost", "name" }, new[] { "稀有度", "费用", "名称" }, _sort, v => { Remember(); _sort = v; Refresh(); });
            var classes = new[] { "全部", "通用" }.Concat(_catalog.Select(c => c.cls).Where(c => !string.IsNullOrEmpty(c) && c != "通用").Distinct().OrderBy(s => s, StringComparer.Ordinal)).ToArray();
            MakeChoice("libCls", "人物", classes, classes.Select(c => c == "全部" || c == "通用" ? c : CharacterTable.Name(c)).ToArray(), _cls, v => { Remember(); _cls = v; Refresh(); });
            _count = PhotoStudioElements.Text(_filterbar, "libResultCount", "", 18, Theme.Hex("#b1a99b"));
            var reset = PhotoStudioElements.Button(_filterbar, "libClearFilter", "重置", () => { Remember(); _tab = _rar = _cls = "全部"; _q = ""; _search.SetTextWithoutNotify(""); Refresh(true); }); _toolbarControls.Add((RectTransform)reset.transform);
            _chips = PhotoStudioElements.Node(_catalogRoot, "libActiveFilters"); _content = PhotoStudioElements.Scroll(_catalogRoot, "libGrid", out _wall);
            _wall.onValueChanged.AddListener(_ => { _hoverBlockUntil = Time.unscaledTime + .14f; _hoverId = null; _hoverAt = -1; UpdateTiles(); });
            _inspector = PhotoStudioElements.Node(_main, "library-inspector"); _layoutPending = true; Refresh();
        }
        void MakeChoice(string name, string label, string[] values, string[] labels, string selected, Action<string> changed)
        {
            labels = labels ?? values; var capturedLabels = labels; var capturedValues = values;
            var button = PhotoStudioElements.Button(_filterbar, name, "", null); button.GetComponentInChildren<Text>().fontSize = 18;
            button.onClick.AddListener(() =>
            {
                if (_choice != null && _choice.IsOpen) { _choice.Close(); _choice = null; return; }
                string value = name == "libRar" ? _rar : name == "libCls" ? _cls : _sort;
                _choice = new PhotoStudioChoice(_root, button, capturedValues, capturedLabels, value, changed); _choice.Toggle();
            }); _toolbarControls.Add((RectTransform)button.transform);
        }
        InputField MakeSearch(Transform parent)
        {
            var rt = PhotoStudioElements.Node(parent, "cardSearch"); UIKit.GetOrAdd<Image>(rt).color = Theme.HexA("#1c2925", .25f);
            var viewport = PhotoStudioElements.Node(rt, "SearchViewport"); PhotoStudioElements.Fill(viewport, 34, 9, 12, 6); UIKit.GetOrAdd<RectMask2D>(viewport);
            var text = PhotoStudioElements.Text(viewport, "SearchText", "", 18, PhotoStudioElements.Light); PhotoStudioElements.Fill(text.rectTransform);
            var placeholder = PhotoStudioElements.Text(viewport, "SearchPlaceholder", "模糊搜索名称或效果，空格分隔关键词", 18, Theme.Hex("#b6ab99")); PhotoStudioElements.Fill(placeholder.rectTransform);
            text.horizontalOverflow = placeholder.horizontalOverflow = HorizontalWrapMode.Overflow; text.verticalOverflow = placeholder.verticalOverflow = VerticalWrapMode.Truncate;
            var field = UIKit.GetOrAdd<InputField>(rt); field.lineType = InputField.LineType.SingleLine; field.textComponent = text; field.placeholder = placeholder; field.text = _q;
            field.onValueChanged.AddListener(v => { _q = v; _searchAt = Time.unscaledTime + .12f; }); return field;
        }
        string Context => string.Join("\u001f", _tab, _rar, _cls, (_q ?? "").Trim().ToLowerInvariant(), _sort);
        void Remember()
        {
            if (_renderedContext == null || _content == null) return;
            History[_renderedContext] = new BrowsePosition { Selected = _selectedId, Scroll = _content.anchoredPosition.y };
            if (History.Count > 64) History.Remove(History.Keys.First());
        }
        bool Matches(CardDef card, bool skipTab = false)
        {
            if (!skipTab && _tab != "全部" && card.type != _tab || _rar != "全部" && CardLibrary.RarityOf(card) != _rar) return false;
            if (_cls != "全部" && (_cls == "通用" ? !string.IsNullOrEmpty(card.cls) : card.cls != _cls)) return false;
            return (_q ?? "").Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries).All(q => (card.name ?? "").IndexOf(q, StringComparison.CurrentCultureIgnoreCase) >= 0 || Sdt.Res.CurrentCardPresentation.Description(card).IndexOf(q, StringComparison.CurrentCultureIgnoreCase) >= 0);
        }
        int Compare(CardDef a, CardDef b)
        {
            if (_sort == "name") return Chinese.Compare(a.name, b.name);
            if (_sort == "cost") return a.cost != b.cost ? a.cost.CompareTo(b.cost) : Chinese.Compare(a.name, b.name);
            int rarity = Array.IndexOf(CardLibrary.Rarities, CardLibrary.RarityOf(b)) - Array.IndexOf(CardLibrary.Rarities, CardLibrary.RarityOf(a));
            return rarity != 0 ? rarity : a.type != b.type ? Chinese.Compare(a.type, b.type) : Chinese.Compare(a.name, b.name);
        }
        void ChangeTab(string tab) { if (_tab == tab) return; Remember(); _tab = tab; Refresh(false, true); }
        void Refresh(bool reset = false, bool restore = false)
        {
            _searchAt = _hoverAt = -1; _hoverBlockUntil = Time.unscaledTime + .24f;
            _filtered = _catalog.Where(c => Matches(c)).ToList(); _filtered.Sort(Compare);
            BrowsePosition position = null; if (restore) History.TryGetValue(Context, out position);
            string id = reset ? null : position != null ? position.Selected : _selectedId;
            _selectedId = _filtered.Any(c => c.id == id) ? id : _filtered.FirstOrDefault()?.id;
            UIKit.ClearChildren(_content); _mounted.Clear(); _mountedFirst = -1; _mountedLast = -2;
            UIKit.ClearChildren(_chips);
            AddChip("rar", _rar, () => _rar = "全部"); AddChip("cls", _cls, () => _cls = "全部"); AddChip("q", _q, () => { _q = ""; _search.SetTextWithoutNotify(""); });
            _count.text = _filtered.Count == _catalog.Count ? "" : _filtered.Count + " 张";
            _toolbarControls[4].gameObject.SetActive(_tab != "全部" || _rar != "全部" || _cls != "全部" || !string.IsNullOrWhiteSpace(_q));
            SyncChoices(); SyncTabs(); Layout(); _content.anchoredPosition = new Vector2(0, position != null ? position.Scroll : 0); _renderedContext = Context;
            UpdateTiles(); RenderDossier(); if (position == null && !reset) Locate(false);
            UIKit.GetOrAdd<PhotoStudioSurfaceMotion>(_wall).Play(.26f, -Mathf.Clamp(_wall.viewport.rect.width * .18f, 64, 160), 0);
        }
        void SyncChoices()
        {
            _toolbarControls[1].GetComponentInChildren<Text>().text = "稀有度 · " + _rar + "  ⌄";
            _toolbarControls[2].GetComponentInChildren<Text>().text = "排序 · " + (_sort == "cost" ? "费用" : _sort == "name" ? "名称" : "稀有度") + "  ⌄";
            _toolbarControls[3].GetComponentInChildren<Text>().text = "人物 · " + (_cls == "全部" || _cls == "通用" ? _cls : CharacterTable.Name(_cls)) + "  ⌄";
        }
        void AddChip(string field, string value, Action remove)
        {
            if (string.IsNullOrWhiteSpace(value) || value == "全部") return;
            var b = PhotoStudioElements.Button(_chips, "libRemoveFilter-" + field, value + " ×", () => { Remember(); remove(); Refresh(); }, true);
            b.GetComponent<Image>().color = Theme.Hex("#ded1b6"); b.GetComponentInChildren<Text>().fontSize = 15;
        }
        void SyncTabs()
        {
            float x = 0; for (int i = 0; i < Types.Length; i++)
            {
                string type = Types[i]; int count = _catalog.Count(c => Matches(c, true) && (type == "全部" || c.type == type));
                var label = _tabs[i].GetComponentInChildren<Text>(); label.text = (type == "能力卡" ? "能力" : type) + "  <size=14>" + count + "</size>";
                label.color = type == _tab ? Theme.Hex("#f1e6d1") : Theme.Hex("#b9b09d");
                float width = Mathf.Max(102, label.preferredWidth + 50); PhotoStudioElements.Place((RectTransform)_tabs[i].transform, x, 0, width, 52); x += width + 8;
                _tabs[i].transform.Find("CategoryMarker").gameObject.SetActive(type == _tab);
            }
        }
        void Update()
        {
            if (UiStack.Top != this || _leaving) return;
            if (!ReferenceEquals(GameRuntime.I.State, _state) || GameRuntime.I.ActiveSlot != _slot) { Close(); return; }
            if (_layoutPending || Mathf.Abs(_root.rect.width - _lastWidth) > 1 || Mathf.Abs(_root.rect.height - _lastHeight) > 1) { Layout(); UpdateTiles(); RenderDossier(); }
            if (_choice != null && _choice.IsOpen) { _choice.Keyboard(); return; }
            if (PhotoStudioElements.Tab(_root)) return;
            if (_searchAt > 0 && Time.unscaledTime >= _searchAt && Input.compositionString.Length == 0) { Remember(); Refresh(); }
            if (_hoverAt > 0 && Time.unscaledTime >= _hoverAt) { _hoverAt = -1; if (_hoverId != null) Select(_hoverId); }
            var active = EventSystem.current?.currentSelectedGameObject; if (active != null && active.GetComponent<InputField>() != null) return;
            if (active != null && (active.name == "libRar" || active.name == "libSort" || active.name == "libCls") && (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.DownArrow))) { active.GetComponent<Button>().onClick.Invoke(); return; }
            if (Input.GetKeyDown(KeyCode.Slash)) { _search.ActivateInputField(); return; }
            int direction = Input.GetKeyDown(KeyCode.LeftArrow) ? -1 : Input.GetKeyDown(KeyCode.RightArrow) ? 1 : Input.GetKeyDown(KeyCode.UpArrow) ? -4 : Input.GetKeyDown(KeyCode.DownArrow) ? 4 : 0;
            if (active != null && active.name.StartsWith("libType", StringComparison.Ordinal))
            {
                int i = _tabs.FindIndex(b => b.gameObject == active), next = Input.GetKeyDown(KeyCode.Home) ? 0 : Input.GetKeyDown(KeyCode.End) ? Types.Length - 1 : (i + Math.Sign(direction) + Types.Length) % Types.Length;
                if (direction != 0 || next != i) { ChangeTab(Types[next]); EventSystem.current.SetSelectedGameObject(_tabs[next].gameObject); }
            }
            else if (active != null && active.GetComponent<PhotoStudioTile>() != null && direction != 0) Step(direction, true);
        }
        public override void CloseFromEscape() { if (_choice != null && _choice.IsOpen) _choice.Close(); else if (Input.compositionString.Length == 0) BeginClose(); }
        void BeginClose() { if (this == null || _leaving || !isActiveAndEnabled || UiStack.Top != this) return; _leaving = true; Remember(); StartCoroutine(LeaveStudio()); }
        protected override void OnDestroy() { _choice?.Close(); if (ReferenceEquals(GameRuntime.I.State, _state) && GameRuntime.I.ActiveSlot == _slot && _state.Phase == "modal") _state.Phase = _previousPhase; }
        internal static void BuildRoom(RectTransform root, bool zoom)
        {
            PhotoStudioElements.Paint(root, "DarkroomBase", Theme.Hex("#151d19"));
            var room = PhotoStudioElements.Texture(root, "transition-photo-v2"); UIKit.GetOrAdd<PhotoRoomBackdrop>(room);
            PhotoStudioElements.Texture(root, zoom ? "zoom-shade" : "room-shade");
            if (!zoom) { var scene = PhotoStudioElements.Node(root, "studio-room-scene"); UIKit.GetOrAdd<PhotoStudioRoom>(scene); PhotoStudioElements.Fill(scene, 0, 140); }
        }
    }
    public sealed class PhotoStudioTile : MonoBehaviour, IPointerEnterHandler, ISelectHandler
    {
        internal CardLibraryScreen Screen; internal string Id;
        public void OnPointerEnter(PointerEventData e) { if (UiStack.Top == Screen) Screen.Hover(Id); }
        public void OnSelect(BaseEventData e) { if (UiStack.Top == Screen) Screen.Select(Id); }
    }
}
