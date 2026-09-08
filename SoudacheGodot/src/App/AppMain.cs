using Godot;
using SoudacheGodot.UI;
using System;

namespace SoudacheGodot.App;

/// Scene router. Core services can subscribe at this boundary without knowing about Control nodes.
public partial class AppMain : Control
{
    private Control _screenHost = null!;
    private UiScreen? _activeScreen;
    private ICoreUiPort? _coreUiPort;

    private static readonly string[] ScreenPaths =
    {
        "res://scenes/menu.tscn",
        "res://scenes/run.tscn",
        "res://scenes/map.tscn",
        "res://scenes/battle.tscn"
    };

    public override void _Ready()
    {
        _screenHost = GetNode<Control>("ScreenHost");
        AttachCore(new CoreGameAdapter());
        var initialScreen = Array.IndexOf(OS.GetCmdlineUserArgs(), "--smoke-battle") >= 0 ? "battle" : "menu";
        ShowScreen(initialScreen);
    }

    public void AttachCore(ICoreUiPort coreUiPort)
    {
        _coreUiPort = coreUiPort;
        if (_activeScreen is BattleScreen battle)
            battle.BindCore(coreUiPort);
    }

    private void ShowScreen(string screenKey)
    {
        var path = screenKey switch
        {
            "run" => ScreenPaths[1],
            "map" => ScreenPaths[2],
            "battle" => ScreenPaths[3],
            _ => ScreenPaths[0]
        };

        if (_activeScreen != null)
        {
            _activeScreen.NavigateRequested -= OnNavigateRequested;
            _activeScreen.QueueFree();
            _activeScreen = null;
        }

        var packed = GD.Load<PackedScene>(path);
        if (packed == null)
        {
            GD.PrintErr($"Screen scene not found: {path}");
            return;
        }

        _activeScreen = packed.Instantiate<UiScreen>();
        _activeScreen.NavigateRequested += OnNavigateRequested;
        _screenHost.AddChild(_activeScreen);
        if (_activeScreen is BattleScreen battleScreen && _coreUiPort != null)
        {
            battleScreen.BindCore(_coreUiPort);
            _coreUiPort.PublishCurrentState();
        }
    }

    private void OnNavigateRequested(string screenKey)
    {
        if (screenKey == "quit")
        {
            GetTree().Quit();
            return;
        }
        ShowScreen(screenKey);
    }
}
