using Godot;
using SoudacheGodot.App;
using SoudacheGodot.UI.Fx;
using System.Collections.Generic;

namespace SoudacheGodot.UI;

/// <summary>
/// 标题屏（网页版 #title AK 风格主页 1:1）：壁纸 + 字牌 + ak-hud 全组件 + 雪花/余烬；
/// 子页面（选档 slot-page / 设置 settings-page / 留言库 sugin-page）与右键建议层
/// （sugLayer）均为屏内浮层，对应网页 #overlay page 模式与 #sugLayer。
/// 布局/文案/配色取自 index.html + css/winter.css + game.menu.js。
/// </summary>
public partial class MenuScreen : UiScreen
{
    private ICoreUiPort? _core;
    private GameAudio? _audio;
    private SaveSlotsUiSnapshot? _slots;

    private Control _pages = null!;
    private Control _sugLayer = null!;
    private Control? _titleGhosts; // 标题层幽灵件（退出/静音/快速参考）——子页面覆盖时整层隐藏
    private SnowLayer _snow = null!;
    private string? _currentPage;
    private string? _pendingSmokePage; // smoke 直开制作坊需等 BindCore（AppMain 在 _Ready 后才注入 ICoreUiPort）
    private Label _archiveNo = null!;
    private Label _archivePlaytime = null!;
    private Label _archiveExtracts = null!;
    private TextureButton? _muteButton;
    private HBoxContainer _slotDeck = null!;

    public override void _ExitTree()
    {
        if (_core != null) _core.SaveSlotsChanged -= ApplySaveSlots;
    }

    public override void _Ready()
    {
        base._Ready();
        // 录帧/smoke 直开子页面：--ui-slots / --ui-settings / --ui-inbox / --ui-codex / --ui-workshop
        var args = OS.GetCmdlineUserArgs();
        if (System.Array.IndexOf(args, "--ui-slots") >= 0)
            OpenPage("slots", BuildSlotPage);
        else if (System.Array.IndexOf(args, "--ui-settings") >= 0)
            OpenPage("settings", BuildSettingsPage);
        else if (System.Array.IndexOf(args, "--ui-inbox") >= 0)
            OpenInbox();
        else if (System.Array.IndexOf(args, "--ui-codex") >= 0)
            OpenCodex();
        else if (System.Array.IndexOf(args, "--ui-workshop") >= 0)
            _pendingSmokePage = "workshop"; // BindCore 后再打开（制作坊需 ICoreUiPort）
    }

    public void BindCore(ICoreUiPort core)
    {
        if (_core != null) _core.SaveSlotsChanged -= ApplySaveSlots;
        _core = core;
        _core.SaveSlotsChanged += ApplySaveSlots;
        if (_pendingSmokePage == "workshop")
        {
            _pendingSmokePage = null;
            OpenWorkshop();
        }
    }

    protected override void Build()
    {
        _audio = GetNodeOrNull<GameAudio>("../GameAudio");

        // #title .title-bg：壁纸 cover + 双层渐变压暗（winter.css #title::after）
        AssetLibrary.Background(this, AssetLibrary.Title, 1f);
        WinterUi.Linear(this, new Color("0c1d264d"), new Color("0c1d2600"), false, new Color("0b182bba"), 1f);
        WinterUi.Linear(this, new Color("0e1c24bf"), new Color("0e1c2400"), true, new Color("0e1c2400"), 0.55f);

        BuildWordmark();
        BuildHud();
        BuildFooter();

        _pages = new Control { MouseFilter = Control.MouseFilterEnum.Stop };
        _pages.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(_pages);

        _sugLayer = new Control { MouseFilter = Control.MouseFilterEnum.Stop, Visible = false };
        _sugLayer.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(_sugLayer);
    }

    // ------------------------------------------------------------------
    // 标题层
    // ------------------------------------------------------------------

    private void BuildWordmark()
    {
        // .title-heading：top calc(7% + 46px)，width clamp(430px,43vw,760px)，translateX(-8.1%)
        var heading = new TextureRect
        {
            Texture = GD.Load<Texture2D>("res://assets/images/title-wordmark.png"),
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered,
            MouseFilter = Control.MouseFilterEnum.Ignore
        };
        heading.AnchorLeft = 0f;
        heading.AnchorRight = 0f;
        heading.AnchorTop = 0.07f;
        heading.AnchorBottom = 0.07f;
        heading.OffsetTop = 46f;
        heading.OffsetLeft = -50f; // translateX(-8.1%) ≈ -50px @ 619px 宽
        heading.CustomMinimumSize = new Vector2(619, 150);
        heading.Size = new Vector2(619, 150);
        AddChild(heading);
    }

    private void BuildHud()
    {
        // —— 标题层幽灵件容器（批次 6c rider：子页面覆盖时整层隐藏，避免静音/退出穿透页头） ——
        _titleGhosts = new Control { MouseFilter = Control.MouseFilterEnum.Ignore };
        _titleGhosts.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(_titleGhosts);
        // —— 左上：退出 + 静音（ak-tl，透明幽灵件） ——
        var topLeft = new HBoxContainer { Position = new Vector2(18, 16) };
        topLeft.AddThemeConstantOverride("separation", 10);
        _titleGhosts.AddChild(topLeft);
        var exit = WinterUi.GhostButton("", new Vector2(58, 58),
            GD.Load<Texture2D>("res://assets/images/ui/icon-exit.svg"));
        exit.Pressed += () => Navigate("quit");
        topLeft.AddChild(exit);
        _muteButton = new TextureButton
        {
            TextureNormal = GD.Load<Texture2D>("res://assets/images/ui/icon-sound-on.svg"),
            IgnoreTextureSize = true,
            StretchMode = TextureButton.StretchModeEnum.KeepAspectCentered,
            CustomMinimumSize = new Vector2(58, 58),
            Size = new Vector2(58, 58),
            FocusMode = Control.FocusModeEnum.All
        };
        _muteButton.Pressed += OnToggleMute;
        topLeft.AddChild(_muteButton);

        // —— 快速参考（ak-quickref 幽灵件） ——
        var quickref = WinterUi.GhostButton("快速参考", new Vector2(0, 58),
            GD.Load<Texture2D>("res://assets/images/ui/icon-book.svg"));
        quickref.Position = new Vector2(186, 16);
        quickref.SizeFlagsHorizontal = Control.SizeFlags.ShrinkBegin;
        quickref.Pressed += OpenQuickReference;
        _titleGhosts.AddChild(quickref);

        // —— 制作坊横幅（ak-banner：渐变底 + 图标 + 中文/英文/箭头） ——
        var banner = new Button { FocusMode = Control.FocusModeEnum.All };
        banner.Position = new Vector2(0, 16);
        banner.CustomMinimumSize = new Vector2(230, 58);
        banner.AnchorLeft = 1f; banner.AnchorRight = 1f;
        banner.OffsetLeft = -448; banner.OffsetRight = -228; // right:228 + 宽 220
        banner.AddThemeColorOverride("font_color", new Color("eef1ec"));
        banner.AddThemeColorOverride("font_hover_color", Colors.White);
        var bannerBox = WinterUi.Box(new Color("2b2f30", 0.96f), 1, new Color("aab2ab", 0.35f), 1);
        banner.AddThemeStyleboxOverride("normal", bannerBox);
        banner.AddThemeStyleboxOverride("hover", WinterUi.Box(new Color("2b2f30", 0.99f), 1, UiTheme.AkMint, 1));
        banner.AddThemeStyleboxOverride("pressed", bannerBox);
        banner.AddThemeStyleboxOverride("focus", WinterUi.Box(new Color("2b2f30", 0.96f), 1, UiTheme.AkMint, 1));
        var bannerRow = new HBoxContainer();
        bannerRow.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        bannerRow.AddThemeConstantOverride("separation", 12);
        bannerRow.AddThemeConstantOverride("margin_left", 12);
        bannerRow.MouseFilter = Control.MouseFilterEnum.Ignore;
        banner.AddChild(bannerRow);
        var bannerIconBox = new PanelContainer();
        bannerIconBox.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("31363a"), 1, new Color("a8b0a9", 0.27f), 1));
        bannerIconBox.CustomMinimumSize = new Vector2(36, 36);
        bannerIconBox.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        bannerIconBox.MouseFilter = Control.MouseFilterEnum.Ignore;
        bannerIconBox.AddChild(WinterUi.Icon("res://assets/images/ui/icon-pen.svg", 20));
        bannerRow.AddChild(bannerIconBox);
        var bannerTexts = new HBoxContainer();
        bannerTexts.AddThemeConstantOverride("separation", 10);
        bannerTexts.MouseFilter = Control.MouseFilterEnum.Ignore;
        bannerTexts.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        bannerTexts.AddChild(WinterUi.Heading("制作坊", 17, new Color("eef1ec"), 6f));
        bannerTexts.AddChild(WinterUi.Label("Workshop", 11, new Color("9fb3a6")));
        bannerTexts.AddChild(WinterUi.Label("›", 22, new Color("cfd6cd")));
        bannerRow.AddChild(bannerTexts);
        // 入口接线（对齐网页 boot.js:423 btnCardDesigner → openCardDesigner(null)）：
        // Godot 制作坊 = 碎片合成制作界面（任务 6b' 口径 2）
        banner.Pressed += OpenWorkshop;
        AddChild(banner);

        // —— 右上档案信息（ak-user） ——
        var user = new VBoxContainer { Position = new Vector2(0, 14) };
        user.AnchorLeft = 1f; user.AnchorRight = 1f;
        user.OffsetLeft = -320; user.OffsetRight = -20;
        user.AddThemeConstantOverride("separation", 6);
        user.Alignment = BoxContainer.AlignmentMode.End;
        AddChild(user);
        var userRow = new HBoxContainer();
        userRow.SizeFlagsHorizontal = Control.SizeFlags.ShrinkEnd;
        userRow.AddThemeConstantOverride("separation", 10);
        user.AddChild(userRow);
        var ava = new TextureRect
        {
            Texture = GD.Load<Texture2D>("res://assets/brand-mark-codename7.png"),
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered,
            CustomMinimumSize = new Vector2(52, 52)
        };
        ava.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        userRow.AddChild(AvatarCircle(ava, 52));
        _archiveNo = WinterUi.Label("--", 26, Colors.White);
        _archiveNo.AddThemeFontOverride("font", ThemeTokens.MonoBold);
        userRow.AddChild(_archiveNo);
        _archivePlaytime = WinterUi.Label("暂无档案", 13, new Color("aeb8b0"));
        _archivePlaytime.SizeFlagsVertical = Control.SizeFlags.ShrinkEnd;
        userRow.AddChild(_archivePlaytime);

        // —— 圆钮组（ak-circle：成就 right:64 top:158 / 收藏图鉴 left:7% top:57% / 设置 left:12.5% top:76%） ——
        AddChild(AkCircle("res://assets/images/ui/icon-medal.svg", "成就", "Achievement",
            new Vector2(64, 158), true, true, OpenTitleAchievements));
        AddChild(AkCircle("res://assets/images/ui/icon-lib.svg", "收藏图鉴", "Collection",
            new Vector2(101, 513), false, false, OpenCodex));
        AddChild(AkCircle("res://assets/images/ui/icon-gear.svg", "设置", "Settings",
            new Vector2(180, 684), false, false, () => OpenPage("settings", BuildSettingsPage)));

        // —— 中下：撤离字条（ak-sec） + 字牌（ak-bp） ——
        var extractsRow = new HBoxContainer();
        extractsRow.AddThemeConstantOverride("separation", 8);
        extractsRow.AnchorLeft = 1f; extractsRow.AnchorRight = 1f;
        extractsRow.AnchorTop = 0.63f; extractsRow.AnchorBottom = 0.63f;
        extractsRow.OffsetLeft = -740; extractsRow.OffsetRight = -440; // .ak-sec right:26% top:63%
        extractsRow.Alignment = BoxContainer.AlignmentMode.End;
        AddChild(extractsRow);
        extractsRow.AddChild(WinterUi.Label("已成功撤离", 13, new Color("eef1ec")));
        _archiveExtracts = WinterUi.Label("0", 16, Colors.White);
        _archiveExtracts.AddThemeFontOverride("font", ThemeTokens.MonoBold);
        var extractsBadge = new PanelContainer();
        extractsBadge.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("16181a", 0.8f), 1, new Color("cfd6cd", 0.53f), 1));
        extractsBadge.AddChild(_archiveExtracts);
        extractsRow.AddChild(extractsBadge);
        extractsRow.AddChild(WinterUi.Label("次", 13, new Color("eef1ec")));

        var wordmark = new PanelContainer();
        wordmark.AnchorLeft = 1f; wordmark.AnchorRight = 1f;
        wordmark.AnchorTop = 0.63f; wordmark.AnchorBottom = 0.63f;
        wordmark.OffsetLeft = -420; wordmark.OffsetRight = -144; // .ak-bp top:63% right:10%
        wordmark.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("222527", 0.85f), 1, new Color("a8b0a9", 0.27f), 1));
        wordmark.AddChild(WinterUi.Label("ASCENSION COUNCIL", 12, new Color("d8ded6")));
        AddChild(wordmark);

        // —— 开始探索（ak-start：余烬光 + 饰纹 + 大字 + 英文） ——
        BuildStartButton();

        // —— 装饰：ak-plus ×2 + ak-line1 ——
        AddChild(WinterUi.Label("+", 14, new Color("b7bfb4", 0.4f)));
        var plus1 = (Label)GetChild(GetChildCount() - 1);
        plus1.Position = new Vector2(432, 297);
        AddChild(WinterUi.Label("+", 14, new Color("b7bfb4", 0.4f)));
        var plus2 = (Label)GetChild(GetChildCount() - 1);
        plus2.AnchorLeft = 1f; plus2.AnchorRight = 1f;
        plus2.AnchorTop = 1f; plus2.AnchorBottom = 1f;
        plus2.OffsetLeft = -456; plus2.OffsetRight = -436; // .ak-plus.p2 right:31% bottom:27%
        plus2.OffsetTop = -263; plus2.OffsetBottom = -243;
        var line = new ColorRect { Color = new Color("b7bfb4", 0.27f), CustomMinimumSize = new Vector2(0, 1) };
        line.AnchorLeft = 0f; line.AnchorRight = 1f;
        line.OffsetLeft = 380; line.OffsetRight = -360; // right:25vw
        line.OffsetTop = 44; line.OffsetBottom = 45;
        line.MouseFilter = Control.MouseFilterEnum.Ignore;
        AddChild(line);

        // —— 雪花层 ——
        _snow = new SnowLayer { MouseFilter = Control.MouseFilterEnum.Ignore };
        _snow.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(_snow);

        ApplyMuteIcon();
    }

    private void BuildStartButton()
    {
        var start = new Button { FocusMode = Control.FocusModeEnum.All };
        start.AnchorLeft = 1f; start.AnchorRight = 1f;
        start.AnchorTop = 1f; start.AnchorBottom = 1f;
        start.OffsetLeft = -404; start.OffsetRight = -40;   // right 3.2%（自适应 st-row 宽度）
        start.OffsetTop = -150; start.OffsetBottom = -45;   // bottom 5%
        start.AddThemeStyleboxOverride("normal", new StyleBoxEmpty());
        start.AddThemeStyleboxOverride("hover", new StyleBoxEmpty());
        start.AddThemeStyleboxOverride("pressed", new StyleBoxEmpty());
        start.AddThemeStyleboxOverride("focus", new StyleBoxEmpty());

        var glow = new EmberGlow();
        glow.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        glow.OffsetLeft = -80; glow.OffsetTop = -20; // ::before 右下外扩
        glow.OffsetRight = 70; glow.OffsetBottom = 60;
        start.AddChild(glow);

        var column = new VBoxContainer();
        column.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        column.Alignment = BoxContainer.AlignmentMode.Center;
        column.MouseFilter = Control.MouseFilterEnum.Ignore;
        start.AddChild(column);

        var row = new HBoxContainer();
        row.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        row.AddThemeConstantOverride("separation", 12);
        column.AddChild(row);
        row.AddChild(WinterUi.Icon("res://assets/images/ui/icon-ornament.svg", 44));
        var cn = WinterUi.Heading("开始探索", 46, Colors.White, 12f);
        cn.AddThemeColorOverride("font_shadow_color", new Color("ffb46a", 0.6f));
        cn.AddThemeConstantOverride("shadow_outline_size", 26);
        row.AddChild(cn);
        row.AddChild(WinterUi.Icon("res://assets/images/ui/icon-ornament.svg", 44));
        var en = WinterUi.Label("ExPlorAtioN", 17, new Color("d7f5a8"));
        en.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        column.AddChild(en);

        start.Pressed += () => OpenPage("slots", BuildSlotPage);
        AddChild(start);
    }

    private void BuildFooter()
    {
        // .title-quote：左下引言（竖线 + 文本）
        var quoteRow = new HBoxContainer();
        quoteRow.AnchorTop = 1f; quoteRow.AnchorBottom = 1f;
        quoteRow.OffsetTop = -88; quoteRow.OffsetBottom = -30;
        quoteRow.OffsetLeft = 65; quoteRow.OffsetRight = 620; // left 4.5%
        quoteRow.AddThemeConstantOverride("separation", 14);
        AddChild(quoteRow);
        var bar = new ColorRect { Color = new Color("bfb08e", 0.53f), CustomMinimumSize = new Vector2(2, 0) };
        quoteRow.AddChild(bar);
        quoteRow.AddChild(WinterUi.Label("WINTER ARCHIVE / TERMINAL STANDBY", 12, new Color("e2e7dc")));

        // .title-credits：右下署名（winter #26 透明隐藏层 opacity .06）
        var credits = WinterUi.Label("制作者：太平 · 创 · Tang", 10, new Color(1, 1, 1, 0.06f));
        credits.AnchorLeft = 1f; credits.AnchorRight = 1f;
        credits.AnchorTop = 1f; credits.AnchorBottom = 1f;
        credits.OffsetLeft = -280; credits.OffsetRight = -46;
        credits.OffsetTop = -40; credits.OffsetBottom = -16;
        AddChild(credits);
    }

    // ------------------------------------------------------------------
    // 组件
    // ------------------------------------------------------------------

    private static Control AvatarCircle(Control content, int size)
    {
        var circle = new PanelContainer();
        var box = WinterUi.Box(new Color("202324"), (int)(size / 2f), new Color("c9d2c6", 0.4f), 2);
        circle.AddThemeStyleboxOverride("panel", box);
        circle.CustomMinimumSize = new Vector2(size, size);
        circle.AddChild(content);
        content.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        content.OffsetLeft = 2; content.OffsetTop = 2; content.OffsetRight = -2; content.OffsetBottom = -2;
        return circle;
    }

    /// <summary>ak-circle 圆钮（c-ring 92×92 + 径向渐变 + 虚线内圈 + 中文/英文）。</summary>
    private Button AkCircle(string icon, string cn, string en, Vector2 pos, bool fromRight, bool withTag,
        System.Action? onClick)
    {
        var button = new Button { FocusMode = Control.FocusModeEnum.All };
        button.AnchorTop = 0f; button.AnchorBottom = 0f;
        button.AnchorLeft = fromRight ? 1f : 0f;
        button.AnchorRight = button.AnchorLeft;
        button.OffsetLeft = fromRight ? -pos.X - 92 : pos.X;
        button.OffsetRight = fromRight ? -pos.X : pos.X + 92;
        button.OffsetTop = pos.Y; button.OffsetBottom = pos.Y + 150;
        button.AddThemeStyleboxOverride("normal", new StyleBoxEmpty());
        button.AddThemeStyleboxOverride("hover", new StyleBoxEmpty());
        button.AddThemeStyleboxOverride("pressed", new StyleBoxEmpty());
        button.AddThemeStyleboxOverride("focus", new StyleBoxEmpty());

        var column = new VBoxContainer();
        column.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        column.Alignment = BoxContainer.AlignmentMode.Center;
        column.AddThemeConstantOverride("separation", 7);
        column.MouseFilter = Control.MouseFilterEnum.Ignore;
        button.AddChild(column);

        var ring = new PanelContainer();
        ring.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        ring.CustomMinimumSize = new Vector2(92, 92);
        var ringBox = WinterUi.Box(new Color("232628"), 46, new Color("b7bfb4", 0.33f), 1);
        ring.AddThemeStyleboxOverride("panel", ringBox);
        column.AddChild(ring);
        var ringInner = new CenterContainer();
        ringInner.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        ringInner.MouseFilter = Control.MouseFilterEnum.Ignore;
        ring.AddChild(ringInner);
        ringInner.AddChild(WinterUi.Icon(icon, 34));

        column.AddChild(WinterUi.Heading(cn, 15, new Color("eef1ec"), 4f));
        column.AddChild(WinterUi.Label(en, 9, new Color("9fb3a6")));

        if (withTag)
        {
            var tag = new PanelContainer();
            tag.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("173026", 0.94f), 9, UiTheme.AkMint, 1));
            tag.MouseFilter = Control.MouseFilterEnum.Ignore;
            tag.CustomMinimumSize = new Vector2(46, 20);
            var tagLabel = WinterUi.Label("0/13", 10, UiTheme.AkMint);
            tagLabel.AddThemeFontOverride("font", ThemeTokens.Mono);
            tagLabel.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
            tag.AddChild(tagLabel);
            button.AddChild(tag);
            // .c-tag：top:-7px right:-16px（锚定按钮右上）
            tag.AnchorLeft = 1f; tag.AnchorRight = 1f;
            tag.OffsetLeft = -66; tag.OffsetRight = -20;
            tag.OffsetTop = -7; tag.OffsetBottom = 13;
        }

        if (onClick != null) button.Pressed += onClick;
        return button;
    }

    // ------------------------------------------------------------------
    // 子页面机制
    // ------------------------------------------------------------------

    private void OpenPage(string key, System.Func<Control> builder)
    {
        ClosePage(silent: true);
        _currentPage = key;
        if (_titleGhosts != null) _titleGhosts.Visible = false; // rider：页面覆盖时标题幽灵件不穿透页头
        var page = builder();
        page.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _pages.AddChild(page);
        PageTransition.PageIn(page);
        _audio?.PlaySfx("open");
        _snow.SetRunning(false); // body.page-covered：动画不出现在画面中即暂停
        FocusFirst(page);
    }

    private void ClosePage(bool silent = false)
    {
        if (_currentPage == null) return;
        _currentPage = null;
        foreach (var child in _pages.GetChildren())
            if (child is Control page)
                page.QueueFree();
        if (_titleGhosts != null) _titleGhosts.Visible = true;
        _snow.SetRunning(true);
        if (!silent) _audio?.PlaySfx("close");
    }

    private static void FocusFirst(Control page)
    {
        var stack = new Stack<Node>();
        stack.Push(page);
        while (stack.Count > 0)
        {
            if (stack.Peek() is Button button && !button.Disabled)
            {
                button.GrabFocus();
                return;
            }
            var node = stack.Pop();
            foreach (var child in node.GetChildren())
                stack.Push(child);
        }
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        // Esc 关闭当前子页面（对齐网页 closeTopOverlayByEsc）
        if (@event.IsActionPressed("ui_cancel") && _currentPage != null)
        {
            ClosePage();
            GetViewport().SetInputAsHandled();
            return;
        }
        // 全局右键 → 写建议给 Friday（对齐网页 document contextmenu）
        if (@event is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Right })
        {
            OpenSuggestionLayer();
            GetViewport().SetInputAsHandled();
        }
    }

    // ------------------------------------------------------------------
    // 选档页（slot-page）
    // ------------------------------------------------------------------

    private Control BuildSlotPage()
    {
        var page = new Control { MouseFilter = Control.MouseFilterEnum.Stop };

        // 背景：radial-gradient(ellipse 120% 90% at 50% 30%) 蓝紫雾气
        WinterUi.Radial(page, new Color("3b4a7a"), new Color("121731"), new Vector2(0.5f, 0.3f), new Vector2(0.6f, 0.55f));
        WinterUi.Linear(page, new Color("0a0c1c6b"), new Color("080a16"), true, new Color("080a1600"), 0.26f);

        var column = PageColumn(page, 40, 76, 40, 90);

        // 页头：「选择存档」14px 细体 letter-spacing 12px + 装饰线
        var head = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter };
        head.AddThemeConstantOverride("separation", 10);
        var headWrap = new CenterContainer();
        headWrap.AddChild(head);
        column.AddChild(headWrap);
        var title = WinterUi.Heading("选择存档", 14, new Color("cfdde2"), 12f);
        title.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        head.AddChild(title);
        var rule = new ColorRect { Color = new Color("b9c2e8", 0.5f), CustomMinimumSize = new Vector2(420, 1) };
        rule.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        head.AddChild(rule);

        // 五张档位卡（slot-deck 横排）
        var deckRow = new CenterContainer();
        deckRow.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        column.AddChild(deckRow);
        _slotDeck = new HBoxContainer();
        _slotDeck.AddThemeConstantOverride("separation", 18);
        deckRow.AddChild(_slotDeck);
        RenderSlotCards();

        // 左下返回（pg-back 2026-09-10 留言 #17）
        var back = new Button { Text = "返回 BACK", FocusMode = Control.FocusModeEnum.All };
        back.AnchorTop = 1f; back.AnchorBottom = 1f;
        back.OffsetTop = -64; back.OffsetBottom = -22;
        back.OffsetLeft = 22; back.OffsetRight = 160;
        back.AddThemeColorOverride("font_color", new Color("e3eeea"));
        back.AddThemeFontSizeOverride("font_size", 14);
        var backBox = WinterUi.Box(new Color("244653"), 8, new Color("77919b"), 1);
        back.AddThemeStyleboxOverride("normal", backBox);
        back.AddThemeStyleboxOverride("hover", WinterUi.Box(new Color("325a69"), 8, new Color("cadcd9"), 1));
        back.AddThemeStyleboxOverride("pressed", backBox);
        back.AddThemeStyleboxOverride("focus", WinterUi.Box(new Color("244653"), 8, ThemeTokens.FocusRing, 2));
        back.Pressed += () => ClosePage();
        page.AddChild(back);
        return page;
    }

    private void RenderSlotCards()
    {
        foreach (var child in _slotDeck.GetChildren())
            child.QueueFree();
        var slotBg = GD.Load<Texture2D>("res://assets/images/slot-bg-knight-fantasy.webp");
        for (var slot = 1; slot <= 5; slot++)
        {
            var exists = false;
            var summary = "空档位";
            foreach (var item in _slots?.Slots ?? System.Array.Empty<SaveSlotUiSnapshot>())
            {
                if (item.Slot != slot - 1) continue;
                exists = item.Exists;
                summary = item.Summary;
            }
            _slotDeck.AddChild(SlotCard(slot, exists, summary, slotBg));
        }
    }

    private Button SlotCard(int slot, bool exists, string summary, Texture2D slotBg)
    {
        var card = new Button { FocusMode = Control.FocusModeEnum.All };
        card.CustomMinimumSize = new Vector2(236, 452);
        card.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        var idle = WinterUi.Box(new Color("14152a", 0.92f), 1, new Color("8294c8", 0.32f), 1);
        ThemeTokens.SlotDrop.Apply(idle);
        card.AddThemeStyleboxOverride("normal", idle);
        var hover = WinterUi.Box(new Color("14152a", 0.96f), 1, new Color("c8d4fa", 0.75f), 1);
        card.AddThemeStyleboxOverride("hover", hover);
        card.AddThemeStyleboxOverride("pressed", idle);
        card.AddThemeStyleboxOverride("focus", WinterUi.Box(new Color("14152a", 0.95f), 1, ThemeTokens.FocusRing, 2));

        // 卡底图：slot-bg-knight-fantasy 精灵图第 slot 格（500% 宽）
        var atlas = new AtlasTexture
        {
            Atlas = slotBg,
            Region = new Rect2((slot - 1) * slotBg.GetWidth() / 5f, 0, slotBg.GetWidth() / 5f, slotBg.GetHeight())
        };
        var art = new TextureRect
        {
            Texture = atlas,
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered,
            Modulate = new Color(1, 1, 1, exists ? 0.5f : 0.22f),
            MouseFilter = Control.MouseFilterEnum.Ignore
        };
        art.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        card.AddChild(art);

        var column = new VBoxContainer();
        column.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        column.OffsetTop = 26; column.OffsetBottom = -14; column.OffsetLeft = 14; column.OffsetRight = -14;
        column.Alignment = BoxContainer.AlignmentMode.Center;
        column.AddThemeConstantOverride("separation", 6);
        column.MouseFilter = Control.MouseFilterEnum.Ignore;
        card.AddChild(column);

        var icon = WinterUi.Icon($"res://assets/images/slots/slot-icon-{slot}.svg", 110);
        icon.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        icon.Modulate = new Color(1, 1, 1, exists ? 1f : 0.26f);
        column.AddChild(icon);

        var name = WinterUi.Heading($"档位 0{slot}", 21, new Color("f4f6fc"), 6f);
        name.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        column.AddChild(name);
        var sub = WinterUi.Label($"SLOT 0{slot}", 9, new Color("8f9cc9"));
        sub.AddThemeFontOverride("font", ThemeTokens.Mono);
        sub.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        column.AddChild(sub);
        var rule = new ColorRect { Color = new Color("c8d4fa", 0.6f), CustomMinimumSize = new Vector2(160, 1) };
        rule.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        column.AddChild(rule);

        if (exists)
        {
            var desc = WinterUi.Label(summary, 12, new Color("c2cbe4"), true);
            desc.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
            desc.CustomMinimumSize = new Vector2(200, 60);
            column.AddChild(desc);
            var cta = WinterUi.Label("继续对局 CONTINUE", 12, new Color("eaf0fd"));
            cta.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
            column.AddChild(cta);
        }
        else
        {
            var empty = WinterUi.Label("EMPTY SLOT · 空档位", 13, new Color("9cbbc5"));
            empty.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
            column.AddChild(empty);
            var cta = WinterUi.Label("开新档 NEW GAME", 12, new Color("eaf0fd"));
            cta.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
            column.AddChild(cta);
        }

        var cardSlot = slot;
        card.Pressed += () =>
        {
            if (exists) _core?.RequestLoadSlot(cardSlot - 1);
            else Navigate("run"); // 空档：先建基地再选角色出发（对齐 newSlot → openBaseHub('deploy')）
        };
        return card;
    }

    // ------------------------------------------------------------------
    // 设置页（settings-page）
    // ------------------------------------------------------------------

    private Control BuildSettingsPage()
    {
        var page = new Control { MouseFilter = Control.MouseFilterEnum.Stop };
        var settings = new ConfigFile();
        settings.Load("user://ui-settings.cfg");
        var pref = (string key, bool fallback) => settings.GetValue("ui", key, fallback).AsBool();

        // 背景：半透明深蓝渐变，透出标题壁纸（winter #overlay.opaque:has(.pg.settings-page)）
        WinterUi.Linear(page, new Color("1b3645", 0.62f), new Color("102431", 0.75f), true);

        var column = PageColumn(page, 46, 26, 46, 26);

        // pg-head
        var headRow = new HBoxContainer();
        headRow.AddThemeConstantOverride("separation", 10);
        column.AddChild(headRow);
        headRow.AddChild(WinterUi.Icon("res://assets/images/ui/icon-gear.svg", 22));
        headRow.AddChild(WinterUi.Heading("设置", 21, new Color("e8eeea"), 4f));
        column.AddChild(new ColorRect { Color = new Color("68808b"), CustomMinimumSize = new Vector2(0, 1) });

        var scroll = new ScrollContainer();
        scroll.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        scroll.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        column.AddChild(scroll);
        var body = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter };
        body.CustomMinimumSize = new Vector2(860, 0);
        body.AddThemeConstantOverride("separation", 8);
        scroll.AddChild(body);

        // —— 通用 ——
        body.AddChild(Spacer(14));
        body.AddChild(WinterUi.SetHeading("通用", "GENERAL"));
        body.AddChild(WinterUi.CheckRow("结点编号", "NODE NUMBERS", pref("node_numbers", true),
            v => SavePref(settings, "node_numbers", v), _audio));
        body.AddChild(WinterUi.CheckRow("底部操作提示条", "HINT BAR", pref("hint_bar", true),
            v => SavePref(settings, "hint_bar", v), _audio));
        body.AddChild(WinterUi.CheckRow("环层横幅", "LAYER BANNER", pref("layer_banner", true),
            v => SavePref(settings, "layer_banner", v), _audio));
        body.AddChild(WinterUi.CheckRow("开发者模式（固定骰子 / 卡牌制作）", "DEVELOPER", pref("dev_mode", false),
            v => SavePref(settings, "dev_mode", v), _audio));
        body.AddChild(WinterUi.CheckRow("屏幕震动反馈", "SCREEN SHAKE", pref("screen_shake", true),
            v => SavePref(settings, "screen_shake", v), _audio));

        // —— 音频（接 GameAudio 公开 API，即时生效由 C 线 audio.cfg 持久化） ——
        body.AddChild(Spacer(14));
        body.AddChild(WinterUi.SetHeading("音频", "AUDIO"));
        var audio = _audio;
        body.AddChild(WinterUi.CheckRow("背景音乐", "MUSIC", audio == null || !audio.MusicMuted,
            v => audio?.SetMusicMuted(!v), _audio));
        body.AddChild(VolumeRow("音乐音量", "MUSIC VOL", audio, music: true));
        body.AddChild(WinterUi.CheckRow("音效", "SOUND FX", audio == null || !audio.SfxMuted,
            v => audio?.SetSfxMuted(!v), _audio));
        body.AddChild(VolumeRow("音效音量", "SFX VOL", audio, music: false));
        body.AddChild(WinterUi.Label("侧边栏的静音按钮为全局静音；这里可分别开关音乐与音效、拖动滑条调音量（自动保存）。", 12, new Color("8fa5ad"), true));

        // —— 致谢 ——
        body.AddChild(Spacer(14));
        body.AddChild(WinterUi.SetHeading("致谢", "CREDITS"));
        body.AddChild(WinterUi.Label("图标来自 game-icons.net —— Lorc、Delapouite、Carl Olsen、Caro Asercion（CC-BY 3.0）；音效来自 Kenney.nl（CC0）。", 12, new Color("8fa5ad"), true));

        // —— 留言库 ——
        body.AddChild(Spacer(14));
        body.AddChild(WinterUi.SetHeading("留言库", "SUGGESTION BOX"));
        var inboxBtn = WinterUi.MiniButton("查看历史留言");
        inboxBtn.CustomMinimumSize = new Vector2(140, 36);
        inboxBtn.SizeFlagsHorizontal = Control.SizeFlags.ShrinkBegin;
        inboxBtn.Pressed += OpenInbox;
        body.AddChild(inboxBtn);

        // —— 危险区（两步确认；存档清理动作待 A 线接口，见 PROGRESS 接口需求 [6b→A]） ——
        body.AddChild(Spacer(14));
        body.AddChild(WinterUi.SetHeading("危险区", "DANGER ZONE"));
        var dangerRow = new HBoxContainer();
        dangerRow.AddThemeConstantOverride("separation", 12);
        body.AddChild(dangerRow);
        foreach (var (label, confirmText) in new[]
                 {
                     ("清空格子备注", "确认清空？"),
                     ("清空卡牌库", "确认清空？"),
                     ("清空全部存档", "确认清空全部？")
                 })
        {
            var danger = WinterUi.MiniButton(label, "danger");
            danger.CustomMinimumSize = new Vector2(150, 36);
            ArmConfirm(danger, confirmText);
            dangerRow.AddChild(danger);
        }

        // —— 右下返回 ——
        var back = WinterUi.OvButton("返回", "ok", new Vector2(120, 42));
        back.AnchorLeft = 1f; back.AnchorRight = 1f;
        back.AnchorTop = 1f; back.AnchorBottom = 1f;
        back.OffsetLeft = -150; back.OffsetRight = -30;
        back.OffsetTop = -64; back.OffsetBottom = -22;
        back.Pressed += () => ClosePage();
        page.AddChild(back);
        return page;
    }

    private Control VolumeRow(string cn, string en, GameAudio? audio, bool music)
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("193441", 0.33f), 8, new Color("486674", 0.2f), 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 12);
        margin.AddThemeConstantOverride("margin_right", 12);
        margin.AddThemeConstantOverride("margin_top", 12);
        margin.AddThemeConstantOverride("margin_bottom", 12);
        panel.AddChild(margin);
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 12);
        margin.AddChild(row);
        var label = WinterUi.Label(cn, 14, new Color("ceddde"));
        label.CustomMinimumSize = new Vector2(110, 0);
        row.AddChild(label);
        row.AddChild(WinterUi.Label(en, 10, new Color("9db4bd")));
        var slider = new HSlider
        {
            MinValue = 0,
            MaxValue = 100,
            Step = 1,
            Value = audio == null ? 100 : System.Math.Round((music ? audio.MusicVolume : audio.SfxVolume) * 100),
            SizeFlagsHorizontal = Control.SizeFlags.ExpandFill,
            SizeFlagsVertical = Control.SizeFlags.ShrinkCenter
        };
        slider.CustomMinimumSize = new Vector2(240, 20);
        row.AddChild(slider);
        var value = WinterUi.Label($"{slider.Value:0}", 13, new Color("e4eeea"));
        value.CustomMinimumSize = new Vector2(34, 0);
        row.AddChild(value);
        slider.ValueChanged += v =>
        {
            value.Text = $"{v:0}";
            if (audio == null) return;
            if (music) audio.SetMusicVolume(v / 100.0);
            else audio.SetSfxVolume(v / 100.0);
        };
        slider.DragEnded += changed =>
        {
            if (changed) audio?.PlaySfx("ding"); // 网页版：松手播试听音
        };
        return panel;
    }

    private static void SavePref(ConfigFile settings, string key, bool value)
    {
        settings.SetValue("ui", key, value);
        settings.Save("user://ui-settings.cfg");
    }

    private static Control Spacer(float height) => new() { CustomMinimumSize = new Vector2(0, height) };

    /// <summary>全屏页内容列：MarginContainer（margin_* 只对 MarginContainer 生效）+ VBox。</summary>
    private static VBoxContainer PageColumn(Control parent, int left, int top, int right, int bottom)
    {
        var margin = new MarginContainer();
        margin.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        margin.AddThemeConstantOverride("margin_left", left);
        margin.AddThemeConstantOverride("margin_right", right);
        margin.AddThemeConstantOverride("margin_top", top);
        margin.AddThemeConstantOverride("margin_bottom", bottom);
        parent.AddChild(margin);
        var column = new VBoxContainer();
        column.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        margin.AddChild(column);
        return column;
    }

    /// <summary>危险操作两步确认（网页 armDanger：2.6s 后还原）。</summary>
    private void ArmConfirm(Button button, string armedText)
    {
        var normalText = button.Text;
        button.Pressed += () =>
        {
            if (!button.HasMeta("armed"))
            {
                button.SetMeta("armed", true);
                button.Text = armedText;
                GetTree().CreateTimer(2.6).Timeout += () =>
                {
                    if (IsInstanceValid(button) && button.HasMeta("armed"))
                    {
                        button.RemoveMeta("armed");
                        button.Text = normalText;
                    }
                };
                return;
            }
            button.RemoveMeta("armed");
            button.Text = normalText;
            _audio?.PlaySfx("confirm");
        };
    }

    // ------------------------------------------------------------------
    // 卡牌图鉴（game.cardslib.js openCardLibrary）与制作坊（boot.js btnCardDesigner 入口）
    // ------------------------------------------------------------------

    /// <summary>收藏图鉴：全卡库浏览（245 张，类型/稀有度/搜索筛选 + 24 张翻页 + 悬停大图预览）。</summary>
    private void OpenCodex()
    {
        OpenPage("codex", () => new CodexPage().Build(_audio));
    }

    /// <summary>制作坊：碎片合成制作界面（TokenCraft/craft 语义，消费 RunUiSnapshot + RequestRunAction）。</summary>
    private void OpenWorkshop()
    {
        var page = new WorkshopPage();
        page.BindCore(_core ?? throw new System.InvalidOperationException("制作坊需要先绑定 ICoreUiPort"));
        OpenPage("workshop", () => page.Build(_audio));
    }

    // ------------------------------------------------------------------
    // 留言库（sugin-page）
    // ------------------------------------------------------------------

    private void OpenInbox()
    {
        ClosePage(silent: true);
        _currentPage = "inbox";
        var page = BuildInboxPage();
        page.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _pages.AddChild(page);
        PageTransition.PageIn(page);
        _audio?.PlaySfx("open");
        _snow.SetRunning(false);
        FocusFirst(page);
    }

    private Control BuildInboxPage()
    {
        var page = new Control { MouseFilter = Control.MouseFilterEnum.Stop };
        WinterUi.Linear(page, new Color("1b3645", 0.62f), new Color("102431", 0.75f), true);

        var column = PageColumn(page, 46, 26, 46, 72);

        var headRow = new HBoxContainer();
        headRow.AddThemeConstantOverride("separation", 10);
        column.AddChild(headRow);
        headRow.AddChild(WinterUi.Icon("res://assets/images/ui/icon-book.svg", 22));
        headRow.AddChild(WinterUi.Heading("留言库", 21, new Color("e8eeea"), 4f));
        column.AddChild(new ColorRect { Color = new Color("68808b"), CustomMinimumSize = new Vector2(0, 1) });

        var scroll = new ScrollContainer();
        scroll.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        scroll.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        column.AddChild(scroll);
        var body = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter };
        body.CustomMinimumSize = new Vector2(860, 0);
        body.AddThemeConstantOverride("separation", 8);
        scroll.AddChild(body);

        var entries = SuggestionStore.Load();
        var pending = entries.FindAll(e => !e.Done);
        var done = entries.FindAll(e => e.Done);
        if (entries.Count == 0)
        {
            body.AddChild(Spacer(20));
            body.AddChild(WinterUi.Label("还没有历史留言。在游戏任意界面右键即可写给 Friday。", 13, new Color("b6c9ce"), true));
        }
        else
        {
            body.AddChild(Spacer(8));
            body.AddChild(WinterUi.Label(
                $"共 {entries.Count} 条留言 · 待处理 {pending.Count} · 已完成 {done.Count}。已完成的留言是历史档案；未完成的可删除，删除需点两次确认。",
                12, new Color("8fa5ad"), true));
            if (pending.Count > 0)
            {
                body.AddChild(Spacer(10));
                body.AddChild(WinterUi.SetHeading($"待处理 · {pending.Count}", $"PENDING · {pending.Count}"));
                foreach (var entry in pending)
                    body.AddChild(SuggestionRow(entry, body));
            }
            body.AddChild(Spacer(10));
            body.AddChild(WinterUi.SetHeading($"已完成 · {done.Count}", $"DONE · {done.Count}"));
            if (done.Count == 0)
                body.AddChild(WinterUi.Label("还没有已完成的留言。", 13, new Color("b6c9ce")));
            foreach (var entry in done)
                body.AddChild(SuggestionRow(entry, body));
        }

        var back = WinterUi.OvButton("返回 BACK", "ok", new Vector2(130, 38));
        back.AnchorLeft = 1f; back.AnchorRight = 1f;
        back.AnchorTop = 1f; back.AnchorBottom = 1f;
        back.OffsetLeft = -160; back.OffsetRight = -30;
        back.OffsetTop = -60; back.OffsetBottom = -22;
        back.Pressed += () => { OpenPage("settings", BuildSettingsPage); }; // 网页 sugBack → openSettings
        page.AddChild(back);
        return page;
    }

    private PanelContainer SuggestionRow(SuggestionStore.Entry entry, Container listBody)
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.Modulate = entry.Done ? new Color(1, 1, 1, 0.55f) : Colors.White;
        panel.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("193441", 0.33f), 8, new Color("486674", 0.4f), 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 14);
        margin.AddThemeConstantOverride("margin_right", 14);
        margin.AddThemeConstantOverride("margin_top", 10);
        margin.AddThemeConstantOverride("margin_bottom", 10);
        panel.AddChild(margin);
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 4);
        margin.AddChild(column);

        var topRow = new HBoxContainer();
        topRow.AddThemeConstantOverride("separation", 10);
        column.AddChild(topRow);
        topRow.AddChild(WinterUi.Label(entry.Done ? "✓" : "✎", 12, entry.Done ? new Color("9bbdb7") : new Color("d8c08f")));
        var time = WinterUi.Label(SuggestionStore.FormatTime(entry.Ts), 12, new Color("9db4bd"));
        time.AddThemeFontOverride("font", ThemeTokens.Mono);
        topRow.AddChild(time);
        topRow.AddChild(WinterUi.Label(entry.Page ?? "未知位置", 12, new Color("ceddde")));
        if (!entry.Done)
        {
            var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            topRow.AddChild(spacer);
            var del = WinterUi.MiniButton("删除", "danger");
            del.CustomMinimumSize = new Vector2(72, 26);
            var normalText = del.Text;
            del.Pressed += () =>
            {
                if (!del.HasMeta("armed"))
                {
                    del.SetMeta("armed", true);
                    del.Text = "确认删除";
                    GetTree().CreateTimer(2.6).Timeout += () =>
                    {
                        if (IsInstanceValid(del) && del.HasMeta("armed"))
                        {
                            del.RemoveMeta("armed");
                            del.Text = normalText;
                        }
                    };
                    return;
                }
                if (SuggestionStore.Remove(entry.Ts))
                {
                    _audio?.PlaySfx("confirm");
                    OpenInbox(); // 重绘
                }
                else
                {
                    del.Text = "删除失败";
                    GetTree().CreateTimer(1.5).Timeout += () =>
                    {
                        if (IsInstanceValid(del)) del.Text = normalText;
                    };
                }
            };
            topRow.AddChild(del);
        }

        column.AddChild(WinterUi.Label(entry.Text, 14, new Color("e4eeea"), true));
        if (!string.IsNullOrWhiteSpace(entry.Target))
            column.AddChild(WinterUi.Label(entry.Target, 11, new Color("829fa9"), true));
        _ = listBody;
        return panel;
    }

    // ------------------------------------------------------------------
    // 右键建议层（sugLayer）
    // ------------------------------------------------------------------

    private void OpenSuggestionLayer()
    {
        if (_sugLayer.Visible) return;
        foreach (var child in _sugLayer.GetChildren())
            child.QueueFree();
        _sugLayer.Visible = true;
        _audio?.PlaySfx("open");

        var scrim = new ColorRect { Color = new Color("080a0c", 0.62f) };
        scrim.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _sugLayer.AddChild(scrim);
        scrim.GuiInput += @event =>
        {
            if (@event is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left })
                CloseSuggestionLayer(scrimParent: null);
        };

        var center = new CenterContainer();
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _sugLayer.AddChild(center);

        var panel = new PanelContainer();
        var panelBox = WinterUi.Box(new Color("171717"), 14, new Color("454545"), 1);
        panel.AddThemeStyleboxOverride("panel", panelBox);
        panel.CustomMinimumSize = new Vector2(520, 0);
        center.AddChild(panel);

        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 8);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 24);
        margin.AddThemeConstantOverride("margin_right", 24);
        margin.AddThemeConstantOverride("margin_top", 22);
        margin.AddThemeConstantOverride("margin_bottom", 18);
        margin.AddChild(column);
        panel.AddChild(margin);

        var head = WinterUi.Heading("✎ 写建议给 Friday", 16, new Color("ececec"));
        column.AddChild(head);
        var where = new PanelContainer();
        where.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color(0, 0, 0, 0.26f), 2, new Color(0, 0, 0, 0), 0));
        var whereLabel = WinterUi.Label("针对位置：标题页整体 #title", 12, new Color("c9c9c9"));
        whereLabel.CustomMinimumSize = new Vector2(0, 34);
        where.AddChild(whereLabel);
        column.AddChild(where);
        column.AddChild(WinterUi.Label("想法、手感问题、bug 都可以写；保存后 Friday 下次工作时会直接读取并知道改哪里。", 11, new Color("8b8b8b"), true));

        var inputPanel = new PanelContainer();
        inputPanel.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        inputPanel.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color(0, 0, 0, 0.32f), 8, new Color("3a3a3a"), 1));
        var input = new TextEdit
        {
            CustomMinimumSize = new Vector2(0, 150),
            WrapMode = TextEdit.LineWrappingMode.Boundary,
            ScrollFitContentHeight = false
        };
        input.AddThemeColorOverride("font_color", new Color("e4eeea"));
        input.AddThemeFontSizeOverride("font_size", 13);
        inputPanel.AddChild(input);
        column.AddChild(inputPanel);
        column.AddChild(WinterUi.Label("例如：这个按钮太小，容易误触……", 11, new Color("6b6b6b")));

        var buttons = new HBoxContainer();
        buttons.SizeFlagsHorizontal = Control.SizeFlags.ShrinkEnd;
        buttons.AddThemeConstantOverride("separation", 10);
        column.AddChild(buttons);
        var save = WinterUi.OvButton("保存 SAVE", "ok", new Vector2(120, 42));
        var cancel = WinterUi.OvButton("返回 BACK", "", new Vector2(120, 42));
        buttons.AddChild(save);
        buttons.AddChild(cancel);

        var statusLabel = whereLabel;
        save.Pressed += () =>
        {
            var text = input.Text.Trim();
            if (text.Length == 0) return;
            var ok = SuggestionStore.Append(new SuggestionStore.Entry(
                SuggestionStore.NowIso(), "标题页", "标题页整体", null, text, false));
            statusLabel.Text = ok ? "建议已记录，Friday 会看到，谢谢老板！" : "写入失败，可稍后再试。";
            if (ok) input.Text = "";
            GetTree().CreateTimer(ok ? 0.9 : 1.5).Timeout += () => CloseSuggestionLayer(null);
        };
        cancel.Pressed += () => CloseSuggestionLayer(null);
        PageTransition.CardIn(panel);
        input.GrabFocus();
    }

    private void CloseSuggestionLayer(Control? scrimParent)
    {
        _ = scrimParent;
        if (!_sugLayer.Visible) return;
        _sugLayer.Visible = false;
        foreach (var child in _sugLayer.GetChildren())
            child.QueueFree();
        _audio?.PlaySfx("close");
    }

    // ------------------------------------------------------------------
    // 标题页数据与开关
    // ------------------------------------------------------------------

    private void ApplySaveSlots(SaveSlotsUiSnapshot snapshot)
    {
        _slots = snapshot;
        // ak-user / ak-sec：最近档位真实数据（renderTitleStats 口径）
        SaveSlotUiSnapshot? latest = null;
        foreach (var slot in snapshot.Slots)
            if (slot.Exists && (latest == null || slot.Slot < latest.Slot))
                latest = slot;
        _archiveNo.Text = latest != null ? $"0{latest.Slot + 1}" : "--";
        _archivePlaytime.Text = latest != null ? latest.Summary : "暂无档案";
        _archiveExtracts.Text = "0";
        if (_currentPage == "slots" && _slotDeck != null)
            RenderSlotCards();
    }

    private void OnToggleMute()
    {
        if (_audio == null) return;
        _audio.SetMuted(!_audio.Muted);
        _audio.PlaySfx("switch"); // 开关音（接口需求 [7a→B]）
        ApplyMuteIcon();
    }

    private void ApplyMuteIcon()
    {
        if (_muteButton == null || _audio == null) return;
        var muted = _audio.Muted;
        _muteButton.TextureNormal = GD.Load<Texture2D>(muted
            ? "res://assets/images/ui/icon-sound-off.svg"
            : "res://assets/images/ui/icon-sound-on.svg");
        _muteButton.Modulate = muted ? new Color("8b9791") : Colors.White;
    }

    // 快速参考弹层（openTitleGuide）
    private void OpenQuickReference()
    {
        OpenPage("guide", () =>
        {
            var page = new Control { MouseFilter = Control.MouseFilterEnum.Stop };
            WinterUi.Linear(page, new Color("1b3645", 0.62f), new Color("102431", 0.75f), true);
            var column = PageColumn(page, 120, 60, 120, 90);
            column.AddChild(WinterUi.Heading("快速参考", 21, new Color("e8eeea"), 4f));
            column.AddChild(new ColorRect { Color = new Color("68808b"), CustomMinimumSize = new Vector2(0, 1) });
            column.AddChild(Spacer(12));
            var grid = new GridContainer { Columns = 2 };
            grid.AddThemeConstantOverride("h_separation", 18);
            grid.AddThemeConstantOverride("v_separation", 8);
            column.AddChild(grid);
            foreach (var (key, desc) in new[]
                     {
                         ("空格 / 回车", "掷骰子移动"), ("Q / E", "旋转地图视角"), ("G", "全景总览"),
                         ("F", "定位角色"), ("B", "打开 / 关闭背包"), ("N", "结点编号开关"),
                         ("Esc", "关闭卡牌库 / 制作坊页面"), ("鼠标拖拽", "平移地图"), ("滚轮", "缩放地图")
                     })
            {
                var row = new PanelContainer();
                row.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
                row.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("102733", 0.5f), 1, new Color("3f5a66", 0.33f), 1));
                var line = new HBoxContainer();
                line.AddThemeConstantOverride("separation", 12);
                row.AddChild(line);
                var keyLabel = WinterUi.Label(key, 11, new Color("d8c08f"));
                keyLabel.CustomMinimumSize = new Vector2(104, 0);
                keyLabel.AddThemeFontOverride("font", ThemeTokens.Mono);
                line.AddChild(keyLabel);
                line.AddChild(WinterUi.Label(desc, 12, new Color("b6c9ce")));
                grid.AddChild(row);
            }
            var back = WinterUi.OvButton("返回 BACK", "", new Vector2(120, 38));
            back.AnchorLeft = 1f; back.AnchorRight = 1f;
            back.AnchorTop = 1f; back.AnchorBottom = 1f;
            back.OffsetLeft = -150; back.OffsetRight = -30;
            back.OffsetTop = -58; back.OffsetBottom = -20;
            back.Pressed += () => ClosePage();
            page.AddChild(back);
            return page;
        });
    }

    // 成就总览（openTitleAchievements：只读最近档案口径）
    private void OpenTitleAchievements()
    {
        OpenPage("achievements", () =>
        {
            var page = new Control { MouseFilter = Control.MouseFilterEnum.Stop };
            WinterUi.Linear(page, new Color("1b3645", 0.62f), new Color("102431", 0.75f), true);
            var column = PageColumn(page, 120, 60, 120, 90);
            column.AddChild(WinterUi.Heading("成就总览", 21, new Color("e8eeea"), 4f));
            column.AddChild(new ColorRect { Color = new Color("68808b"), CustomMinimumSize = new Vector2(0, 1) });
            column.AddChild(Spacer(12));
            column.AddChild(WinterUi.Label("以最近游玩档位的基地档案为准；成就奖励需进入基地领取。", 13, new Color("b6c9ce")));
            var back = WinterUi.OvButton("返回 BACK", "", new Vector2(120, 38));
            back.AnchorLeft = 1f; back.AnchorRight = 1f;
            back.AnchorTop = 1f; back.AnchorBottom = 1f;
            back.OffsetLeft = -150; back.OffsetRight = -30;
            back.OffsetTop = -58; back.OffsetBottom = -20;
            back.Pressed += () => ClosePage();
            page.AddChild(back);
            return page;
        });
    }
}
