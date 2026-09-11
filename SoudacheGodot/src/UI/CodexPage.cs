using Godot;
using SoudacheGodot.App;
using System.Collections.Generic;
using System.Linq;

namespace SoudacheGodot.UI;

/// <summary>
/// 卡牌收藏页（网页 game.cardslib.js renderCardLibrary + css/cards.css「卡牌大页面」+ winter.css 覆盖层 1:1）：
/// pg-head（书图标标题 + clib-search 搜索 + pg-select 稀有度下拉 + clib-count 共 N 张）
/// → clib-tabs（「全部」+8 类型页签，带计数角标）
/// → clib-main（左 clib-preview 276px 预览面板 / 右 lib-grid 六列 × 24 张翻页 + lib-pager）。
/// 交互时序：悬停 90ms 去抖更新大图预览（cardslib.js:258 previewTimer）、翻页/筛选后回到第 1 页、
/// 预览空态「把鼠标悬停在右侧卡牌上」。收藏态标记位=lib-item 右上 ✦（数据待 [6b'→A] 收藏集合，到位即点亮）。
/// </summary>
public partial class CodexPage : Control
{
    public const int PageSize = 24; // cardslib.js:60 LIB_PAGE_SIZE

    private readonly CodexCatalog _catalog = CodexCatalog.Default;
    private GameAudio? _audio;

    private string _tab = "全部";   // cardslib.js libFilter.tab
    private string _rarity = "全部"; // libFilter.rar
    private string _query = "";      // libFilter.q
    private int _page;               // cardslib.js libPage（0 基）

    private GridContainer _tabsRow = null!;
    private Control _previewHost = null!;
    private GridContainer _grid = null!;
    private Label _countLabel = null!;
    private Label _pageInfo = null!;
    private Button _prevButton = null!;
    private Button _nextButton = null!;
    private readonly Dictionary<string, Button> _tabButtons = new();
    private readonly List<CodexCatalog.CodexCard> _filtered = new();
    private double _previewDelayLeft;      // cardslib.js:258 previewTimer 90ms 去抖
    private CodexCatalog.CodexCard? _pendingPreview;

    /// <summary>收藏态标记位数据源（[6b'→A] 收藏集合快照就绪后由宿主注入；网页 B.isCollected 口径）。</summary>
    public ISet<string> CollectedIds { get; set; } = new HashSet<string>();

    public Control Build(GameAudio? audio)
    {
        _audio = audio;
        MouseFilter = MouseFilterEnum.Stop;

        // #overlay .card.page winter 背景：linear-gradient(125deg,#1b3645,#102431)
        WinterUi.Linear(this, new Color("1b3645"), new Color("102431"), true);

        var margin = new MarginContainer();
        margin.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        margin.AddThemeConstantOverride("margin_left", 20);
        margin.AddThemeConstantOverride("margin_right", 64);
        margin.AddThemeConstantOverride("margin_top", 14);
        margin.AddThemeConstantOverride("margin_bottom", 12);
        AddChild(margin);
        var root = new VBoxContainer();
        root.SizeFlagsVertical = SizeFlags.ExpandFill;
        root.AddThemeConstantOverride("separation", 0);
        margin.AddChild(root);

        BuildHead(root);
        BuildTabs(root);
        BuildMain(root);

        RefreshFilter();
        return this;
    }

    // pg-head：14px 64px 12px 20px 已由外层 margin 承担；行内 gap 10、底边线 #68808b（winter）
    private void BuildHead(VBoxContainer root)
    {
        var head = new HBoxContainer();
        head.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        head.SizeFlagsVertical = SizeFlags.ShrinkBegin;
        head.AddThemeConstantOverride("separation", 10);
        root.AddChild(head);

        head.AddChild(WinterUi.Icon("res://assets/images/ui/icon-book.svg", 18));
        var title = WinterUi.Heading("卡牌收藏", 20, new Color("e8eeea"), 2f);
        title.SizeFlagsVertical = SizeFlags.ShrinkCenter;
        head.AddChild(title);

        // clib-search：210px 圆角胶囊输入（winter input 底 #102b39 边 #657f89）
        var search = new LineEdit { PlaceholderText = "搜索名称 / 效果…", CustomMinimumSize = new Vector2(210, 34) };
        search.SizeFlagsVertical = SizeFlags.ShrinkCenter;
        search.AddThemeFontSizeOverride("font_size", 13);
        search.AddThemeColorOverride("font_color", new Color("e4eeea"));
        search.AddThemeColorOverride("font_placeholder_color", new Color("829fa9"));
        search.AddThemeStyleboxOverride("normal", WinterUi.Box(ThemeTokens.InputBg, 17, ThemeTokens.InputBorder, 1));
        search.AddThemeStyleboxOverride("focus", WinterUi.Box(ThemeTokens.InputBg, 17, new Color("a1a1a1"), 1));
        search.TextChanged += text =>
        {
            _query = text;
            _page = 0;
            RefreshFilter();
        };
        head.AddChild(search);

        // pg-select 稀有度下拉：全部 RARITIES（cardslib.js:177 RARITIES.map 全列，含初始/衍生）
        var raritySelect = new OptionButton { CustomMinimumSize = new Vector2(120, 34) };
        raritySelect.SizeFlagsVertical = SizeFlags.ShrinkCenter;
        raritySelect.AddThemeFontSizeOverride("font_size", 13);
        raritySelect.AddItem("全部稀有度", 0);
        foreach (var rarity in CodexCatalog.Rarities)
            raritySelect.AddItem(rarity, raritySelect.ItemCount);
        raritySelect.Select(0);
        raritySelect.ItemSelected += index =>
        {
            _rarity = index == 0 ? "全部" : raritySelect.GetItemText((int)index);
            _page = 0;
            RefreshFilter();
        };
        head.AddChild(raritySelect);

        var spacer = new Control { SizeFlagsHorizontal = SizeFlags.ExpandFill };
        head.AddChild(spacer);

        // clib-count：共 N 张
        var countWrap = new HBoxContainer();
        countWrap.SizeFlagsVertical = SizeFlags.ShrinkCenter;
        head.AddChild(countWrap);
        countWrap.AddChild(WinterUi.Label("共 ", 13, new Color("b3c9ce")));
        _countLabel = WinterUi.Label("0", 14, new Color("e5d4ae"));
        countWrap.AddChild(_countLabel);
        countWrap.AddChild(WinterUi.Label(" 张", 13, new Color("b3c9ce")));
    }

    // clib-tabs：gap 6 padding 10px 20px；type-tab 圆角 16 胶囊 + 计数 em（cards.css:205-214）
    private void BuildTabs(VBoxContainer root)
    {
        var tabsWrap = new MarginContainer();
        tabsWrap.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        tabsWrap.SizeFlagsVertical = SizeFlags.ShrinkBegin;
        tabsWrap.AddThemeConstantOverride("margin_left", 0);
        tabsWrap.AddThemeConstantOverride("margin_top", 10);
        tabsWrap.AddThemeConstantOverride("margin_bottom", 10);
        root.AddChild(tabsWrap);
        _tabsRow = new GridContainer { Columns = 5 };
        _tabsRow.AddThemeConstantOverride("h_separation", 6);
        _tabsRow.AddThemeConstantOverride("v_separation", 6);
        tabsWrap.AddChild(_tabsRow);
    }

    private Button TypeTab(string label, int count)
    {
        var tab = new Button { FocusMode = FocusModeEnum.All };
        var on = _tab == label;
        tab.AddThemeFontSizeOverride("font_size", 12);
        tab.AddThemeColorOverride("font_color", on ? new Color("eaeaea") : new Color("9db4bd"));
        tab.AddThemeColorOverride("font_hover_color", new Color("eaeaea"));
        tab.AddThemeStyleboxOverride("normal", WinterUi.Box(on ? new Color("2d4a55") : new Color("1f3340"), 16,
            on ? ThemeTokens.ModeCardOnBorder : new Color("4c6a76"), 1));
        tab.AddThemeStyleboxOverride("hover", WinterUi.Box(new Color("365b69"), 16, new Color("cadcd9"), 1));
        tab.AddThemeStyleboxOverride("pressed", tab.GetThemeStylebox("normal"));
        tab.AddThemeStyleboxOverride("focus", WinterUi.Box(on ? new Color("2d4a55") : new Color("1f3340"), 16, ThemeTokens.FocusRing, 2));
        var text = count >= 0 ? $"{label} {count}" : label;
        tab.Text = text;
        tab.Pressed += () =>
        {
            if (_tab == label) return;
            _tab = label;
            _page = 0;
            RefreshFilter();
        };
        return tab;
    }

    // clib-main：左 clib-preview 276px + 右 lib-grid（winter 6 列 gap 0，lib-item 分隔线 #bbb8ae）
    private void BuildMain(VBoxContainer root)
    {
        var main = new HBoxContainer();
        main.SizeFlagsVertical = SizeFlags.ExpandFill;
        main.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        main.AddThemeConstantOverride("separation", 0);
        root.AddChild(main);

        var preview = new PanelContainer();
        preview.CustomMinimumSize = new Vector2(276, 0);
        preview.SizeFlagsVertical = SizeFlags.ExpandFill;
        var previewBox = WinterUi.Box(new Color("dad7cf"), 0, new Color("b7b4aa"), 1);
        preview.AddThemeStyleboxOverride("panel", previewBox);
        main.AddChild(preview);
        WinterUi.Linear(preview, new Color("e2dfd7"), new Color("d2cfc6"), true);
        _previewHost = preview;

        var gridScroll = new ScrollContainer();
        gridScroll.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        gridScroll.SizeFlagsVertical = SizeFlags.ExpandFill;
        gridScroll.HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled;
        main.AddChild(gridScroll);
        _grid = new GridContainer { Columns = 6 };
        _grid.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        gridScroll.AddChild(_grid);
    }

    /// <summary>筛选缓存重建（cardslib.js libFiltered）+ 页签计数/总数/网格/预览整体刷新。</summary>
    public void RefreshFilter()
    {
        _filtered.Clear();
        _filtered.AddRange(_catalog.Filtered(_tab, _rarity, _query));
        _countLabel.Text = _catalog.Cards.Count.ToString();

        foreach (var child in _tabsRow.GetChildren()) child.QueueFree();
        _tabButtons.Clear();
        _tabsRow.AddChild(StoreTab(TypeTab("全部", _catalog.CountByType("全部"))));
        foreach (var type in CodexCatalog.Types)
            _tabsRow.AddChild(StoreTab(TypeTab(type, _catalog.CountByType(type))));

        RenderGrid();
        RenderPreview(null);
    }

    private Button StoreTab(Button button) => button;

    // libGridHTML：一页 24 张 + lib-pager（cardslib.js:101-130）
    private void RenderGrid()
    {
        foreach (var child in _grid.GetChildren()) child.QueueFree();
        var totalPages = System.Math.Max(1, (_filtered.Count + PageSize - 1) / PageSize);
        if (_page >= totalPages) _page = totalPages - 1;
        if (_filtered.Count == 0)
        {
            var empty = WinterUi.Label(_catalog.Cards.Count > 0 ? "没有符合筛选条件的卡牌" : "卡牌库为空",
                13, new Color("6b685b"));
            empty.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            empty.HorizontalAlignment = HorizontalAlignment.Center;
            _grid.AddChild(empty);
        }
        var start = _page * PageSize;
        var end = System.Math.Min(_filtered.Count, start + PageSize);
        for (var i = start; i < end; i++)
            _grid.AddChild(LibItem(_filtered[i]));

        // lib-pager：跨满一行（‹ 上一页 / 第 N / M 页 · 共 X 张 / 下一页 ›）
        if (totalPages > 1)
        {
            var pager = new HBoxContainer { Alignment = BoxContainer.AlignmentMode.Center };
            pager.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            pager.AddThemeConstantOverride("separation", 18);
            _grid.AddChild(pager);
            _prevButton = WinterUi.MiniButton("‹ 上一页");
            _prevButton.Disabled = _page <= 0;
            _prevButton.Pressed += () =>
            {
                if (_page > 0) { _page--; RenderGrid(); }
            };
            pager.AddChild(_prevButton);
            _pageInfo = WinterUi.Label($"第 {_page + 1} / {totalPages} 页 · 共 {_filtered.Count} 张", 13, new Color("5f5c53"));
            pager.AddChild(_pageInfo);
            _nextButton = WinterUi.MiniButton("下一页 ›");
            _nextButton.Disabled = _page >= totalPages - 1;
            _nextButton.Pressed += () =>
            {
                if (_page < totalPages - 1) { _page++; RenderGrid(); }
            };
            pager.AddChild(_nextButton);
        }
    }

    // lib-item：卡面（lib 简卡）+ 收藏态标记位（右上 ✦，[6b'→A] 数据到位即点亮）
    private Control LibItem(CodexCatalog.CodexCard card)
    {
        var wrap = new VBoxContainer();
        wrap.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        wrap.AddThemeConstantOverride("separation", 7);
        // lib-item 分隔线（winter:339）：border-right/bottom 1px #bbb8ae + padding 16px 12px 14px
        var pad = new MarginContainer();
        pad.AddThemeConstantOverride("margin_left", 12);
        pad.AddThemeConstantOverride("margin_right", 12);
        pad.AddThemeConstantOverride("margin_top", 16);
        pad.AddThemeConstantOverride("margin_bottom", 14);
        wrap.AddChild(pad);
        var center = new CenterContainer();
        pad.AddChild(center);
        var face = CardFace.Create(_catalog, card, CardFace.FaceMode.Lib, 14);
        center.AddChild(face);
        var collected = CollectedIds.Contains(card.Id);
        if (collected)
        {
            var mark = WinterUi.Label("✦", 14, new Color("b8934c"));
            mark.Position = new Vector2(6, 6);
            wrap.AddChild(mark);
        }
        face.MouseEntered += () =>
        {
            _pendingPreview = card;       // 悬停 90ms 去抖（cardslib.js previewTimer）
            _previewDelayLeft = 0.09;
        };
        face.GuiInput += @event =>
        {
            if (@event is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left })
            {
                RenderPreview(card);
                _audio?.PlaySfx("switch");
            }
        };
        face.TooltipText = $"{card.Name} · 点击查看完整卡面与描述";
        return wrap;
    }

    // libPreviewHTML：空态图标+提示；有卡=lg 全卡面 + type·稀有度 + 伤害/效果词条（cardslib.js:88-99）
    private void RenderPreview(CodexCatalog.CodexCard? card)
    {
        foreach (var child in _previewHost.GetChildren())
            if (child is TextureRect) continue; // 渐变底保留
            else child.QueueFree();
        var column = new VBoxContainer();
        column.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        column.OffsetLeft = 14; column.OffsetTop = 14; column.OffsetRight = -14; column.OffsetBottom = -14;
        column.Alignment = BoxContainer.AlignmentMode.Center;
        column.AddThemeConstantOverride("separation", 14);
        _previewHost.AddChild(column);

        if (card == null)
        {
            var icon = WinterUi.Icon("res://assets/images/ui/icon-lib.svg", 54);
            icon.Modulate = new Color(0.45f, 0.45f, 0.45f, 0.45f);
            icon.SizeFlagsHorizontal = SizeFlags.ShrinkCenter;
            column.AddChild(icon);
            var hint = WinterUi.Label("把鼠标悬停在右侧卡牌上\n这里会显示大图预览", 12, new Color("5f5c53"), wrap: true);
            hint.HorizontalAlignment = HorizontalAlignment.Center;
            column.AddChild(hint);
            return;
        }

        var faceHost = new CenterContainer();
        faceHost.SizeFlagsVertical = SizeFlags.ExpandFill;
        column.AddChild(faceHost);
        faceHost.AddChild(CardFace.Create(_catalog, card, CardFace.FaceMode.Full, 22));

        var effectiveRarity = _catalog.RarityOf(card);
        var meta = WinterUi.Label($"{card.Type} · {effectiveRarity}", 12, new Color("3c3a33"));
        meta.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(meta);
        if (CodexCatalog.DmgTypes.Contains(card.Type) && card.Dmg != 0)
        {
            var dmg = WinterUi.Label($"伤害词条：{card.Dmg}{(card.DmgType.Length > 0 ? " · " + DmgTypeName(card.DmgType) : "")}", 12, new Color("3c3a33"));
            dmg.HorizontalAlignment = HorizontalAlignment.Center;
            column.AddChild(dmg);
        }
        var kwParts = new List<string>();
        if (card.Draw > 0) kwParts.Add($"抽卡 {card.Draw}");
        if (card.Infuse > 0) kwParts.Add($"注能({card.Infuse})");
        if (card.Heal > 0) kwParts.Add($"回复 {card.Heal}");
        if (card.Armor > 0) kwParts.Add($"护甲 {card.Armor}");
        if (kwParts.Count > 0)
        {
            var kw = WinterUi.Label($"效果词条：{string.Join(" · ", kwParts)}", 12, new Color("3c3a33"));
            kw.HorizontalAlignment = HorizontalAlignment.Center;
            column.AddChild(kw);
        }
    }

    private static string DmgTypeName(string dmgType) => dmgType switch
    {
        "attack" => "攻击", "spell" => "法术", "true" => "真实", "fixed" => "固定", _ => dmgType
    };

    public override void _Process(double delta)
    {
        if (_previewDelayLeft <= 0) return;
        _previewDelayLeft -= delta;
        if (_previewDelayLeft > 0) return;
        if (_pendingPreview != null)
        {
            RenderPreview(_pendingPreview);
            _pendingPreview = null;
        }
    }
}
