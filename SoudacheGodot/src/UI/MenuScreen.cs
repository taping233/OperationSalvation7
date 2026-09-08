using Godot;
using SoudacheGodot.App;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SoudacheGodot.UI;

/// Title terminal matching the original winter homepage: full-screen key art,
/// asymmetric corner navigation, and a separate archive picker for starting a run.
public partial class MenuScreen : UiScreen
{
    private readonly Dictionary<int, Label> _slotLabels = new();
    private readonly Dictionary<int, Button> _slotPrimaryButtons = new();
    private ICoreUiPort? _core;
    private SaveSlotsUiSnapshot _saveSlots = new();
    private Control? _overlay;
    private Button? _profileButton;

    public override void _Ready()
    {
        base._Ready();
        CallDeferred(nameof(StartAmbientAnimation));
    }

    public void BindCore(ICoreUiPort core)
    {
        if (_core != null) _core.SaveSlotsChanged -= ApplySaveSlots;
        _core = core;
        _core.SaveSlotsChanged += ApplySaveSlots;
    }

    public override void _ExitTree()
    {
        if (_core != null) _core.SaveSlotsChanged -= ApplySaveSlots;
    }

    protected override void Build()
    {
        // The original file is deliberately used here instead of a generated or
        // reconstructed substitute; this is the source of truth for the title art.
        AssetLibrary.Background(this, AssetLibrary.TitleOriginal, 1.0f);
        UiTheme.Backdrop(this, new Color(0.035f, 0.075f, 0.09f, 0.28f));
        AddTitleHeading();
        AddTopNavigation();
        AddSideNavigation();
        AddBottomChrome();
        AddSnowLayer();
    }

    private void AddTitleHeading()
    {
        var heading = new VBoxContainer { Name = "TitleHeading" };
        Dock(heading, Control.LayoutPreset.TopLeft, 56, 96, 500, 330);
        AddChild(heading);
        heading.AddThemeConstantOverride("separation", 8);
        var kicker = UiTheme.Label("ASCENSION COUNCIL / WINTER CONJECTURE", 11, UiTheme.Frost);
        kicker.AddThemeColorOverride("font_shadow_color", new Color(0, 0, 0, 0.72f));
        kicker.AddThemeConstantOverride("shadow_offset_x", 2);
        kicker.AddThemeConstantOverride("shadow_offset_y", 2);
        heading.AddChild(kicker);

        var title = UiTheme.Label("升格会的\n冬日猜想", 70, UiTheme.Frost);
        title.AddThemeConstantOverride("outline_size", 5);
        title.AddThemeColorOverride("font_outline_color", new Color(0.04f, 0.10f, 0.13f, 0.72f));
        title.AddThemeColorOverride("font_shadow_color", new Color(0.02f, 0.06f, 0.08f, 0.9f));
        title.AddThemeConstantOverride("shadow_offset_x", 2);
        title.AddThemeConstantOverride("shadow_offset_y", 4);
        heading.AddChild(title);
        heading.AddChild(UiTheme.Label("A WINTER CONJECTURE OF THE ASCENSION COUNCIL", 12, UiTheme.Muted));
    }

    private void AddTopNavigation()
    {
        var left = new HBoxContainer { Name = "TitleTopLeft" };
        Dock(left, Control.LayoutPreset.TopLeft, 18, 16, 386, 78);
        AddChild(left);
        left.AddThemeConstantOverride("separation", 10);
        var exit = TopButton("↤", "退出游戏");
        exit.Pressed += () => Navigate("quit");
        left.AddChild(exit);
        var mute = TopButton("◖", "音效 / 背景乐");
        mute.Pressed += () => ShowInfoOverlay("声音设置", "当前页面已接入背景音乐与按钮音效。静音切换入口将在音频设置接线后启用。\n\n按返回继续。");
        left.AddChild(mute);
        var guide = UiTheme.Button("▱  快速参考", new Vector2(164, 46));
        guide.TooltipText = "操作快速参考";
        guide.Pressed += ShowGuide;
        left.AddChild(guide);

        var right = new HBoxContainer { Name = "TitleTopRight" };
        Dock(right, Control.LayoutPreset.TopRight, -508, 16, -22, 88);
        AddChild(right);
        right.AddThemeConstantOverride("separation", 10);
        var workshop = UiTheme.Button("✎  制作坊", new Vector2(164, 56));
        workshop.TooltipText = "制作坊";
        workshop.Pressed += () => ShowInfoOverlay("制作坊", "制作坊入口已保留。卡牌编辑界面将在 Godot 卡牌编辑器完成接线后开放。\n\n当前卡牌数据与战斗牌库仍可在远征流程中使用。");
        right.AddChild(workshop);

        var archive = UiTheme.Button("档案  ›", new Vector2(148, 56));
        archive.TooltipText = "档案信息";
        archive.Pressed += () => ShowInfoOverlay("远征档案", "档案入口保留为只读信息面板。点击右下“开始探索”可选择五个独立存档档位。\n\n" + ProfileSummary());
        right.AddChild(archive);
        _profileButton = TopButton("◉", ProfileSummary());
        _profileButton.Pressed += () => ShowInfoOverlay("远征档案", ProfileSummary());
        right.AddChild(_profileButton);
    }

    private void AddSideNavigation()
    {
        var collection = SideButton("◈\n收藏图鉴", "收藏图鉴");
        Dock(collection, Control.LayoutPreset.CenterLeft, 34, -70, 182, 70);
        AddChild(collection);
        collection.Pressed += () => ShowInfoOverlay("收藏图鉴", "收藏图鉴入口保留。当前 Godot 迁移已接入卡牌数据，完整收藏页将在仓库界面接线后开放。");

        var settings = SideButton("⚙\n设置", "设置");
        Dock(settings, Control.LayoutPreset.CenterLeft, 34, 92, 182, 232);
        AddChild(settings);
        settings.Pressed += () => ShowInfoOverlay("设置", "设置入口保留。当前窗口使用 1440×900 参考视口，并支持 canvas_items / expand 自适应。\n\n按返回继续。");

        var achievements = SideButton("✦\n成就", "成就总览");
        Dock(achievements, Control.LayoutPreset.CenterRight, -190, -50, -34, 90);
        AddChild(achievements);
        achievements.Pressed += () => ShowInfoOverlay("成就总览", "成就统计入口保留。完成远征后，成就状态会随对应存档记录。\n\n当前迁移核心已保留五槽独立存档。");
    }

    private void AddBottomChrome()
    {
        var quote = UiTheme.Label("「总有人，会为归途留下一盏灯。」\nWINTER ARCHIVE / TERMINAL STANDBY", 13, UiTheme.Frost);
        Dock(quote, Control.LayoutPreset.BottomLeft, 56, -104, 430, -30);
        AddChild(quote);
        quote.AddThemeColorOverride("font_shadow_color", new Color(0, 0, 0, 0.8f));
        quote.AddThemeConstantOverride("shadow_offset_x", 2);
        quote.AddThemeConstantOverride("shadow_offset_y", 2);

        var credit = UiTheme.Label("制作者：太平 · 创 · Tang", 11, UiTheme.Muted);
        Dock(credit, Control.LayoutPreset.BottomLeft, 56, -28, 360, -8);
        AddChild(credit);

        var exploration = new VBoxContainer { Name = "ExplorationEntry" };
        Dock(exploration, Control.LayoutPreset.BottomRight, -470, -190, -28, -28);
        AddChild(exploration);
        exploration.AddThemeConstantOverride("separation", 2);
        var serial = UiTheme.Label("EXPEDITION TERMINAL  /  01", 11, UiTheme.Muted);
        serial.HorizontalAlignment = HorizontalAlignment.Center;
        exploration.AddChild(serial);
        var start = UiTheme.Button("◇  开始探索  ◇", new Vector2(410, 82));
        start.Name = "StartExploration";
        start.AddThemeFontSizeOverride("font_size", 38);
        start.AddThemeColorOverride("font_color", UiTheme.Frost);
        start.AddThemeColorOverride("font_hover_color", UiTheme.Frost);
        start.AddThemeStyleboxOverride("normal", UiTheme.Box(new Color(0.05f, 0.09f, 0.10f, 0.35f), 1, new Color(0.88f, 0.78f, 0.54f, 0.56f), 1));
        start.AddThemeStyleboxOverride("hover", UiTheme.Box(new Color(0.17f, 0.23f, 0.20f, 0.70f), 1, UiTheme.AkMint, 2));
        start.AddThemeStyleboxOverride("pressed", UiTheme.Box(new Color(0.30f, 0.22f, 0.12f, 0.80f), 1, UiTheme.Accent, 2));
        start.AddThemeStyleboxOverride("focus", UiTheme.Box(new Color(0.08f, 0.15f, 0.15f, 0.65f), 1, UiTheme.AkMint, 2));
        start.Pressed += () => { UiMotion.Pop(start); ShowSlotPicker(); };
        exploration.AddChild(start);
        var english = UiTheme.Label("ExPlorAtioN", 14, UiTheme.Accent);
        english.HorizontalAlignment = HorizontalAlignment.Center;
        exploration.AddChild(english);
        CallDeferred(nameof(FocusStartButton), start);
    }

    private void AddSnowLayer()
    {
        var snow = new Control { Name = "TitleSnow", MouseFilter = Control.MouseFilterEnum.Ignore };
        UiTheme.FullRect(snow);
        AddChild(snow);
        MoveChild(snow, GetChildCount() - 1);
        for (var i = 0; i < 24; i++)
        {
            var flake = UiTheme.Label(i % 3 == 0 ? "·" : "⁙", i % 3 == 0 ? 18 : 11, new Color(0.88f, 0.96f, 0.94f, 0.24f));
            flake.MouseFilter = Control.MouseFilterEnum.Ignore;
            flake.Position = new Vector2(20 + (i * 173) % 1360, -50 + (i * 97) % 900);
            snow.AddChild(flake);
        }
    }

    private void StartAmbientAnimation()
    {
        if (!IsInsideTree()) return;
        var title = GetNodeOrNull<Control>("TitleHeading");
        var topLeft = GetNodeOrNull<Control>("TitleTopLeft");
        var topRight = GetNodeOrNull<Control>("TitleTopRight");
        var exploration = GetNodeOrNull<Control>("ExplorationEntry");
        var snow = GetNodeOrNull<Control>("TitleSnow");
        var sequence = new[] { title, topLeft, topRight, exploration };
        for (var i = 0; i < sequence.Length; i++)
        {
            var node = sequence[i];
            if (node == null) continue;
            UiMotion.Enter(node, i * 0.08);
        }
        if (exploration != null)
        {
            UiMotion.Breathe(exploration, 0.88f, 1.0f, 3.2);
        }
        if (snow != null)
        {
            for (var i = 0; i < snow.GetChildCount(); i++)
            {
                if (snow.GetChild(i) is not Control flake) continue;
                var start = new Vector2(flake.Position.X, -50 - (i % 6) * 24);
                var current = flake.Position;
                var driftX = 18 + (i % 4) * 7;
                var drift = CreateTween();
                drift.TweenProperty(flake, "position", new Vector2(current.X + driftX, 950), 11.0 + (i % 7) * 1.05).SetTrans(Tween.TransitionType.Linear);
                drift.TweenCallback(Callable.From(() => flake.Position = start));
                drift.SetLoops();
            }
        }
    }

    private void ShowSlotPicker()
    {
        CloseOverlay();
        _overlay = new Control { Name = "SaveSlotPicker", MouseFilter = Control.MouseFilterEnum.Stop };
        UiTheme.FullRect(_overlay);
        AddChild(_overlay);
        UiTheme.Backdrop(_overlay, new Color(0.015f, 0.035f, 0.05f, 0.91f));

        var panel = new PanelContainer { Name = "SaveSlotPanel", CustomMinimumSize = new Vector2(1280, 650) };
        panel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.055f, 0.10f, 0.13f, 0.97f), 2, new Color(0.67f, 0.79f, 0.75f, 0.55f), 1));
        var center = new CenterContainer();
        UiTheme.FullRect(center);
        _overlay.AddChild(center);
        center.AddChild(panel);
        UiMotion.OverlayIn(panel);

        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 34);
        margin.AddThemeConstantOverride("margin_right", 34);
        margin.AddThemeConstantOverride("margin_top", 26);
        margin.AddThemeConstantOverride("margin_bottom", 26);
        panel.AddChild(margin);
        var column = ScreenChrome.Column(margin, 16);
        var header = ScreenChrome.Row(column, 18);
        var heading = ScreenChrome.Column(header, 2);
        heading.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        heading.AddChild(UiTheme.Label("选择存档", 34, UiTheme.Frost));
        heading.AddChild(UiTheme.Label("SAVE ARCHIVE  /  FIVE INDEPENDENT SLOTS", 11, UiTheme.Muted));
        var help = UiTheme.Button("说明", new Vector2(82, 42));
        help.Pressed += () => ShowInfoOverlay("存档说明", "五个档位的基地、仓库、职业、成就与进行中远征彼此独立。\n\n有档位时可进入读取；空档位会进入角色选择。覆盖重开与删除按钮保留为明确的接入提示。\n\n按返回回到选择存档。");
        header.AddChild(help);
        var back = UiTheme.Button("返回  BACK", new Vector2(130, 42));
        back.Pressed += CloseOverlay;
        header.AddChild(back);
        column.AddChild(UiTheme.Label("选择一个档位继续远征，或从空档位开始新的角色选择。", 14, UiTheme.Muted));

        var cards = new HBoxContainer { Name = "SlotCards", SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        cards.AddThemeConstantOverride("separation", 12);
        column.AddChild(cards);
        for (var slot = 0; slot < 5; slot++) AddSlotCard(cards, slot);

        var status = UiTheme.Label(_saveSlots.StatusText, 13, UiTheme.Accent);
        status.Name = "SaveStatus";
        column.AddChild(status);
        _slotLabels[-1] = status;
        if (GetSlot(0) is { } firstSlot) CallDeferred(nameof(FocusStartButton), firstSlot);
    }

    private void AddSlotCard(Control parent, int slot)
    {
        var info = _saveSlots.Slots.FirstOrDefault(item => item.Slot == slot);
        var exists = info?.Exists == true;
        var card = new PanelContainer { Name = $"Slot{slot + 1}", CustomMinimumSize = new Vector2(224, 408), SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        card.AddThemeStyleboxOverride("panel", UiTheme.Box(exists ? new Color(0.12f, 0.20f, 0.22f, 0.96f) : new Color(0.08f, 0.13f, 0.15f, 0.94f), 1, exists ? UiTheme.AkMint : new Color(0.40f, 0.54f, 0.55f, 0.65f), 1));
        parent.AddChild(card);
        UiMotion.Enter(card, slot * 0.06);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 18); margin.AddThemeConstantOverride("margin_right", 18);
        margin.AddThemeConstantOverride("margin_top", 22); margin.AddThemeConstantOverride("margin_bottom", 18);
        card.AddChild(margin);
        var column = ScreenChrome.Column(margin, 9);
        var icon = UiTheme.Label(exists ? "◈" : "◇", 56, exists ? UiTheme.AkMint : UiTheme.Muted);
        icon.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(icon);
        var name = UiTheme.Label($"档位 0{slot + 1}", 21, UiTheme.Frost);
        name.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(name);
        var slotNo = UiTheme.Label($"SLOT 0{slot + 1}", 10, UiTheme.Muted);
        slotNo.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(slotNo);
        var line = UiTheme.Label("────────────────", 10, new Color(0.55f, 0.68f, 0.67f, 0.65f));
        line.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(line);
        var summary = UiTheme.Label(exists ? info!.Summary : "EMPTY SLOT · 空档位", 13, exists ? UiTheme.Frost : UiTheme.Muted);
        summary.Name = $"SlotSummary{slot}";
        summary.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        summary.CustomMinimumSize = new Vector2(0, 72);
        column.AddChild(summary);
        _slotLabels[slot] = summary;

        var primary = UiTheme.Button(exists ? "进入存档" : "选择角色", new Vector2(0, 46));
        primary.Pressed += () => EnterSlot(slot, exists);
        column.AddChild(primary);
        _slotPrimaryButtons[slot] = primary;
        var save = UiTheme.Button("保存当前", new Vector2(0, 38));
        save.Pressed += () => _core?.RequestSaveSlot(slot);
        column.AddChild(save);
        if (exists)
        {
            var operations = ScreenChrome.Row(column, 6);
            var overwrite = UiTheme.Button("覆盖重开", new Vector2(0, 38));
            overwrite.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            overwrite.Pressed += () => ShowInfoOverlay("覆盖重开", $"档位 0{slot + 1} 的覆盖重开入口已保留。为避免误改真实存档，当前版本暂显示接入提示。\n\n你仍可通过“进入存档”读取该档位。");
            operations.AddChild(overwrite);
            var remove = UiTheme.Button("删除", new Vector2(0, 38));
            remove.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            remove.Pressed += () => ShowInfoOverlay("删除存档", $"档位 0{slot + 1} 的删除入口已保留，但当前版本不会执行删除操作。\n\n这样可以保护已有存档数据。");
            operations.AddChild(remove);
        }
        else
        {
            column.AddChild(UiTheme.Label("新档将从角色选择开始", 11, UiTheme.Muted));
        }
    }

    private void EnterSlot(int slot, bool exists)
    {
        if (exists) _core?.RequestLoadSlot(slot);
        Navigate("run");
    }

    private void ShowGuide() => ShowInfoOverlay("快速参考", "空格 / 回车    掷骰子移动\n鼠标            选择按钮与卡牌\nEsc               返回上一级页面\n\n主菜单的“开始探索”会先打开五槽存档选择。\n进入存档后可继续已保存的远征或进入远征准备页。");

    private void ShowInfoOverlay(string title, string body)
    {
        CloseOverlay();
        _overlay = new Control { Name = "InfoOverlay", MouseFilter = Control.MouseFilterEnum.Stop };
        UiTheme.FullRect(_overlay);
        AddChild(_overlay);
        UiTheme.Backdrop(_overlay, new Color(0.01f, 0.03f, 0.04f, 0.82f));
        var panel = new PanelContainer { CustomMinimumSize = new Vector2(590, 360) };
        panel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.07f, 0.13f, 0.16f, 0.98f), 2, UiTheme.AkMint, 1));
        var center = new CenterContainer();
        UiTheme.FullRect(center); _overlay.AddChild(center); center.AddChild(panel);
        UiMotion.OverlayIn(panel);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 32); margin.AddThemeConstantOverride("margin_right", 32);
        margin.AddThemeConstantOverride("margin_top", 28); margin.AddThemeConstantOverride("margin_bottom", 24);
        panel.AddChild(margin);
        var column = ScreenChrome.Column(margin, 16);
        column.AddChild(UiTheme.Label(title, 30, UiTheme.Frost));
        column.AddChild(UiTheme.Label("ASCENSION COUNCIL  /  TERMINAL", 10, UiTheme.Muted));
        var text = UiTheme.Label(body, 16, UiTheme.Frost);
        text.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        column.AddChild(text);
        var back = UiTheme.Button("返回  BACK", new Vector2(140, 46));
        back.Pressed += CloseOverlay;
        column.AddChild(back);
        back.GrabFocus();
    }

    private void CloseOverlay()
    {
        if (_overlay == null) return;
        _overlay.QueueFree();
        _overlay = null;
        _slotLabels.Clear();
        _slotPrimaryButtons.Clear();
    }

    private void FocusStartButton(Button button)
    {
        if (GodotObject.IsInstanceValid(button) && button.IsInsideTree()) button.GrabFocus();
    }

    private void ApplySaveSlots(SaveSlotsUiSnapshot snapshot)
    {
        _saveSlots = snapshot;
        if (_profileButton != null) _profileButton.TooltipText = ProfileSummary();
        foreach (var slot in snapshot.Slots)
        {
            if (_slotLabels.TryGetValue(slot.Slot, out var label))
                label.Text = slot.Exists ? slot.Summary : "EMPTY SLOT · 空档位";
            if (_slotPrimaryButtons.TryGetValue(slot.Slot, out var button))
                button.Text = slot.Exists ? "进入存档" : "选择角色";
        }
        if (_slotLabels.TryGetValue(-1, out var status)) status.Text = snapshot.StatusText;
    }

    private string ProfileSummary()
    {
        var count = _saveSlots.Slots.Count(slot => slot.Exists);
        return count == 0 ? "暂无档案" : $"档案  /  {count} 个存档";
    }

    private Button? GetSlot(int slot) => _slotPrimaryButtons.TryGetValue(slot, out var button) ? button : null;

    private static Button TopButton(string text, string tooltip)
    {
        var button = UiTheme.Button(text, new Vector2(58, 46));
        button.TooltipText = tooltip;
        return button;
    }

    private static Button SideButton(string text, string tooltip)
    {
        var button = UiTheme.Button(text, new Vector2(148, 104));
        button.TooltipText = tooltip;
        button.AddThemeFontSizeOverride("font_size", 17);
        button.AddThemeStyleboxOverride("normal", UiTheme.Box(new Color(0.035f, 0.07f, 0.08f, 0.58f), 1, new Color(0.70f, 0.78f, 0.72f, 0.42f), 1));
        button.AddThemeStyleboxOverride("hover", UiTheme.Box(new Color(0.10f, 0.18f, 0.17f, 0.82f), 1, UiTheme.AkMint, 2));
        return button;
    }

    private static void Dock(Control node, Control.LayoutPreset preset, int left, int top, int right, int bottom)
    {
        node.SetAnchorsAndOffsetsPreset(preset);
        node.OffsetLeft = left;
        node.OffsetTop = top;
        node.OffsetRight = right;
        node.OffsetBottom = bottom;
    }
}
