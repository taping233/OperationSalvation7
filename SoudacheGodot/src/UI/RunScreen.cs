using Godot;
using SoudacheGodot.App;

namespace SoudacheGodot.UI;

/// Run preparation placeholder. The Core RunState can later feed this screen through a snapshot.
public partial class RunScreen : UiScreen
{
    private Label _summary = null!;
    private Label _status = null!;
    private ICoreUiPort? _core;

    public void BindCore(ICoreUiPort core)
    {
        if (_core != null) _core.RunSnapshotChanged -= ApplySnapshot;
        _core = core;
        _core.RunSnapshotChanged += ApplySnapshot;
    }

    public override void _ExitTree()
    {
        if (_core != null) _core.RunSnapshotChanged -= ApplySnapshot;
    }

    protected override void Build()
    {
        UiTheme.Backdrop(this, new Color("0B171E"));
        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 56);
        margin.AddThemeConstantOverride("margin_right", 56);
        margin.AddThemeConstantOverride("margin_top", 42);
        margin.AddThemeConstantOverride("margin_bottom", 42);
        AddChild(margin);

        var root = ScreenChrome.Column(margin, 20);
        root.AddChild(UiTheme.Label("远征准备", 32, UiTheme.Frost));
        root.AddChild(UiTheme.Label("RUN PREPARATION  /  PLACEHOLDER", 14, UiTheme.Accent));

        var body = ScreenChrome.Row(root, 20);
        var roster = ScreenChrome.PanelContent(body, "选择远征角色", UiTheme.PanelSurface);
        roster.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        roster.AddChild(UiTheme.Label("选择角色会创建新的确定性远征状态。", 16, UiTheme.Muted));
        foreach (var entry in new[] { ("shuangling", "霜翎"), ("baiqi", "白契"), ("lituan", "栗团"), ("xuanli", "玄砾"), ("dengkui", "灯葵") })
        {
            var characterId = entry.Item1;
            var choice = UiTheme.Button(entry.Item2, new Vector2(320, 44));
            choice.Pressed += () => _core?.RequestStartRun(characterId);
            roster.AddChild(choice);
        }

        var brief = ScreenChrome.PanelContent(body, "运行状态", UiTheme.PanelRaised);
        brief.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _summary = ScreenChrome.AddBody(brief, "尚未开始远征");
        _status = ScreenChrome.AddBody(brief, "请选择角色");
        var map = ScreenChrome.AddNav(brief, this, "查看地图", "map");
        map.GrabFocus();
        ScreenChrome.AddNav(brief, this, "直接打开战斗竖切", "battle");

        var footer = ScreenChrome.Row(root, 14);
        ScreenChrome.AddNav(footer, this, "返回主菜单", "menu");
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        if (_summary == null) return;
        _summary.Text = $"角色：{snapshot.CharacterDisplayName}  层级：{snapshot.LayerIndex + 1}  位置：{snapshot.TrackPosition + 1}/{snapshot.TrackLength}\n生命：{snapshot.CurrentHp}/{snapshot.MaxHp}  体力：{snapshot.Stamina}/{snapshot.MaxStamina}\n币：{snapshot.Coins}  钥匙：{snapshot.Keys}  木材：{snapshot.Wood}  口粮：{snapshot.Rations}";
        _status.Text = snapshot.StatusText;
    }
}
