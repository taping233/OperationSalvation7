using Godot;
using SoudacheGodot.UI.Fx;

namespace SoudacheGodot.UI;

/// <summary>
/// dev 演示场景（批次 6a 验收用）：集中演示 STS2 动作库、扇形手牌 scale 分段、
/// 全量中文字体（换行/省略号/粗体）与主题常量。老板与后续 agent 由此场景直观验收。
/// 运行：Godot --path . res://scenes/dev/fx-lab.tscn；录帧加 --write-movie <png 路径> --quit-after N。
/// </summary>
public partial class FxLab : Control
{
    private CardHandLayout _hand = null!;
    private Control _dummy = null!;
    private PanelContainer _popPanel = null!;
    private Label _wrapLabel = null!;
    private Label _ellipsisLabel = null!;

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        var backdrop = UiTheme.Backdrop(this, ThemeTokens.Ink);
        _ = backdrop;

        var root = ScreenChrome.Column(this, ThemeTokens.SpaceLg);
        UiTheme.FullRect(root);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 24);
        margin.AddThemeConstantOverride("margin_right", 24);
        margin.AddThemeConstantOverride("margin_top", 16);
        margin.AddThemeConstantOverride("margin_bottom", 16);
        root.AddChild(margin);
        var outer = ScreenChrome.Column(margin, 10);

        outer.AddChild(Title());

        var columns = new HBoxContainer { SizeFlagsVertical = SizeFlags.ExpandFill };
        columns.AddThemeConstantOverride("separation", ThemeTokens.SpaceLg);
        outer.AddChild(columns);

        BuildHandColumn(columns);
        BuildFeedbackColumn(columns);
        BuildTypographyColumn(columns);

        RunAutoDemo();
    }

    private Label Title()
    {
        var label = new Label { Text = "fx-lab · 批次 6a 表现基础库演示（STS2 动作参数 · 扇形手牌 · 全量中文字体）" };
        label.AddThemeFontSizeOverride("font_size", 20);
        label.AddThemeColorOverride("font_color", ThemeTokens.Amber);
        return label;
    }

    private void BuildHandColumn(Control parent)
    {
        var column = ScreenChrome.Column(parent, 8);
        column.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        column.CustomMinimumSize = new Vector2(720, 0);

        var info = UiTheme.Label("扇形手牌：hover 瞬时放大/角度归零/邻卡推挤；退出 0.5s ExpoOut 回落；\n缩放分段 ≤7→×1.0、8→×0.95、每张-0.05（0.8 基准）；新牌从右下滑入（delta*7/8/10 三通道）", 14, ThemeTokens.Sub);
        info.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        column.AddChild(info);

        var handPanel = new PanelContainer { SizeFlagsVertical = SizeFlags.ExpandFill };
        handPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(ThemeTokens.Panel, ThemeTokens.RadiusPanel));
        column.AddChild(handPanel);
        _hand = new CardHandLayout
        {
            CustomMinimumSize = new Vector2(0, 260),
            SizeFlagsHorizontal = SizeFlags.ExpandFill,
            SizeFlagsVertical = SizeFlags.ExpandFill,
        };
        handPanel.AddChild(_hand);

        var row = ScreenChrome.Row(column, 6);
        foreach (var count in new[] { 3, 5, 7, 8, 10 })
        {
            var size = count;
            var button = UiTheme.Button($"{count} 张", new Vector2(72, 40));
            button.AddThemeFontSizeOverride("font_size", 14);
            button.Pressed += () => _hand.SetCards(MakeHand(size));
            ButtonFeedback.Attach(button);
            row.AddChild(button);
        }
        var fly = UiTheme.Button("飞卡→弃牌堆", new Vector2(140, 40));
        fly.AddThemeFontSizeOverride("font_size", 14);
        fly.Pressed += () => LaunchDemoCard();
        ButtonFeedback.Attach(fly, ButtonFeedbackStyle.Pile);
        row.AddChild(fly);

        _hand.SetCards(MakeHand(5));
    }

    private void BuildFeedbackColumn(Control parent)
    {
        var column = ScreenChrome.Column(parent, 8);
        column.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        column.CustomMinimumSize = new Vector2(320, 0);

        _popPanel = new PanelContainer { SizeFlagsVertical = SizeFlags.ExpandFill };
        _popPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(ThemeTokens.Panel, ThemeTokens.RadiusPanel));
        column.AddChild(_popPanel);

        var content = ScreenChrome.Column(_popPanel, 8);
        content.AddChild(UiTheme.Label("战斗反馈（sts2-reference §2）", 16, ThemeTokens.Ok));

        _dummy = new Panel { CustomMinimumSize = new Vector2(96, 96), SizeFlagsHorizontal = SizeFlags.ShrinkCenter };
        var dummyStyle = UiTheme.Box(ThemeTokens.Panel2, 12, ThemeTokens.Line2, 1);
        _dummy.AddThemeStyleboxOverride("panel", dummyStyle);
        content.AddChild(_dummy);
        var hp = UiTheme.Label("演练木桩\n点按钮看反馈", 13, ThemeTokens.Sub);
        hp.HorizontalAlignment = HorizontalAlignment.Center;
        hp.VerticalAlignment = VerticalAlignment.Center;
        _dummy.AddChild(hp);
        hp.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);

        var actions = ScreenChrome.Row(content, 6);
        AddAction(actions, "伤害", () => FloatingText.Spawn(this, "-6", DemoFloatPoint(), FloatKind.Damage));
        AddAction(actions, "治疗", () => FloatingText.Spawn(this, "+5", DemoFloatPoint(), FloatKind.Heal));
        AddAction(actions, "格挡", () => FloatingText.Spawn(this, "盾3", DemoFloatPoint(), FloatKind.Block));
        AddAction(actions, "受击抖动", () => HitShake.Shake(_dummy));

        var fxRow = ScreenChrome.Row(content, 6);
        AddAction(fxRow, "面板弹入", () => PanelPopIn.PopIn(_popPanel));
        var breathe = UiTheme.Button("呼吸缩放", new Vector2(100, 40));
        breathe.AddThemeFontSizeOverride("font_size", 14);
        breathe.Pressed += () => BreathingFx.StartScale(_dummy);
        ButtonFeedback.Attach(breathe);
        fxRow.AddChild(breathe);
        var glow = UiTheme.Button("呼吸光", new Vector2(92, 40));
        glow.AddThemeFontSizeOverride("font_size", 14);
        glow.Pressed += () => BreathingFx.StartGlow(_dummy);
        ButtonFeedback.Attach(glow);
        fxRow.AddChild(glow);

        content.AddChild(UiTheme.Label("按钮双段反馈：Pile（1.25x/0.05s）/Sink（下沉 8px）/Standard", 13, ThemeTokens.Sub));
        var buttonRow = ScreenChrome.Row(content, 6);
        var pile = UiTheme.Button("Pile", new Vector2(84, 40));
        var sink = UiTheme.Button("Sink", new Vector2(84, 40));
        var standard = UiTheme.Button("Standard", new Vector2(104, 40));
        ButtonFeedback.Attach(pile, ButtonFeedbackStyle.Pile);
        ButtonFeedback.Attach(sink, ButtonFeedbackStyle.Sink);
        ButtonFeedback.Attach(standard);
        buttonRow.AddChild(pile);
        buttonRow.AddChild(sink);
        buttonRow.AddChild(standard);
    }

    private void BuildTypographyColumn(Control parent)
    {
        var column = ScreenChrome.Column(parent, 8);
        column.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        column.CustomMinimumSize = new Vector2(300, 0);

        var panel = new PanelContainer { SizeFlagsVertical = SizeFlags.ExpandFill };
        panel.AddThemeStyleboxOverride("panel", UiTheme.Box(ThemeTokens.Panel, ThemeTokens.RadiusPanel));
        column.AddChild(panel);

        var content = ScreenChrome.Column(panel, 8);
        content.AddChild(UiTheme.Label("字体：Noto Sans SC 全量 VF（默认主题字体）", 16, ThemeTokens.Ok));

        _wrapLabel = UiTheme.Label("中文换行验证：长文本自动折行——升格会的冬日猜想，搜索、打牌、撤离；" +
            "卡池两百四十五张，含宠物蛋孵出的驯鸦、猫、狗，以及葵田雪国地图的富文本描述段落。", 15);
        _wrapLabel.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        _wrapLabel.CustomMinimumSize = new Vector2(260, 120);
        content.AddChild(_wrapLabel);

        var bold = UiTheme.Label("粗体验证：wght=700 变量字重。", 15, ThemeTokens.Amber);
        bold.AddThemeFontOverride("font", ThemeTokens.NotoBold);
        content.AddChild(bold);

        var mono = new Label { Text = "CASCADIA 0123456789 HP:32/40" };
        mono.AddThemeFontOverride("font", ThemeTokens.Mono);
        mono.AddThemeFontSizeOverride("font_size", 13);
        mono.AddThemeColorOverride("font_color", ThemeTokens.Sub);
        content.AddChild(mono);

        _ellipsisLabel = UiTheme.Label("省略号验证：这行超长中文文本在容器尽头应当截断并显示省略号而非溢出面板边界之外。", 14, ThemeTokens.Dim);
        _ellipsisLabel.AutowrapMode = TextServer.AutowrapMode.Off; // 单行溢出才触发 TrimEllipsis
        _ellipsisLabel.TextOverrunBehavior = TextServer.OverrunBehavior.TrimEllipsis;
        _ellipsisLabel.CustomMinimumSize = new Vector2(260, 40);
        content.AddChild(_ellipsisLabel);

        content.AddChild(UiTheme.Label("主题色板（winter.css）：面板 #192e39 / 琥珀 #ddb876 / 冷青 #9bc5c0", 12, ThemeTokens.Dim));
    }

    /// <summary>demo 飘字喷点：木桩中心下移 60px，避免伤害字（STS2 初速 -800）在低矮面板里直接飞出屏顶。</summary>
    private Vector2 DemoFloatPoint() => _dummy.GetGlobalRect().GetCenter() - GlobalPosition + new Vector2(0, 60);

    private void AddAction(Control row, string text, System.Action action)
    {
        var button = UiTheme.Button(text, new Vector2(88, 40));
        button.AddThemeFontSizeOverride("font_size", 14);
        button.Pressed += action;
        ButtonFeedback.Attach(button);
        row.AddChild(button);
    }

    private static string[] MakeHand(int count)
    {
        string[] pool = { "雪国回响", "雾中灯葵", "焚卡", "战术撤离", "升格协议", "白契之约", "霜翎突袭", "栗团横扫", "玄砾壁垒", "灯葵祝祷" };
        var hand = new string[count];
        for (var i = 0; i < count; i++) hand[i] = pool[i % pool.Length] + (i >= pool.Length ? "+" : "");
        return hand;
    }

    private void LaunchDemoCard()
    {
        var ghost = UiTheme.Button("飞卡", new Vector2(100, 140));
        ghost.AddThemeStyleboxOverride("normal", UiTheme.Box(ThemeTokens.Panel2, 8, ThemeTokens.Amber, 1));
        AddChild(ghost);
        ghost.Position = _hand.GetGlobalRect().GetCenter() - GlobalPosition;
        var target = new Vector2(Size.X - 90f, Size.Y - 80f); // 模拟右下角弃牌堆
        CardFlyVfx.Launch(this, ghost, target, onArrive: () => ghost.QueueFree());
    }

    /// <summary>给 --write-movie 录帧用的自动演示时间线（无输入也能看到全部组件动起来）。</summary>
    private void RunAutoDemo()
    {
        Schedule(0.15, () => PanelPopIn.PopIn(_popPanel));
        Schedule(0.35, () => FloatingText.Spawn(this, "-6", DemoFloatPoint(), FloatKind.Damage));
        Schedule(0.70, () => FloatingText.Spawn(this, "+5", DemoFloatPoint(), FloatKind.Heal));
        Schedule(1.05, () => FloatingText.Spawn(this, "盾3", DemoFloatPoint(), FloatKind.Block));
        Schedule(1.35, () => HitShake.Shake(_dummy));
        Schedule(1.60, LaunchDemoCard);
        Schedule(1.90, () => BreathingFx.StartScale(_dummy));
        Schedule(1.95, () => BreathingFx.StartGlow(_dummy));
        Schedule(2.10, () => _hand.SetCards(MakeHand(8)));
    }

    private void Schedule(double seconds, System.Action action)
    {
        GetTree().CreateTimer(seconds).Timeout += action;
    }
}
