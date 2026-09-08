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
    private GameAudio _audio = null!;
    private bool _perfSmoke;
    private int _perfFrames;
    private ulong _perfStartMs;
    private double _peakStaticMemory;
    private bool _perfAudioStopped;

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
        _audio = new GameAudio { Name = "GameAudio" };
        AddChild(_audio);
        AttachCore(new CoreGameAdapter());
        var args = OS.GetCmdlineUserArgs();
        _perfSmoke = Array.IndexOf(args, "--perf-smoke") >= 0;
        _perfStartMs = Time.GetTicksMsec();
        var initialScreen = Array.IndexOf(args, "--smoke-battle") >= 0 ? "battle"
            : Array.IndexOf(args, "--smoke-map") >= 0 ? "map"
            : Array.IndexOf(args, "--smoke-run") >= 0 ? "run"
            : "menu";
        ShowScreen(initialScreen);
    }

    public override void _Process(double delta)
    {
        if (!_perfSmoke) return;
        _perfFrames++;
        var elapsed = (Time.GetTicksMsec() - _perfStartMs) / 1000.0;
        _peakStaticMemory = Math.Max(_peakStaticMemory, Performance.GetMonitor(Performance.Monitor.MemoryStatic));
        if (elapsed >= 7.5 && !_perfAudioStopped) { _perfAudioStopped = true; _audio.StopAll(); }
        if (elapsed < 8.0) return;
        GD.Print($"PERF_SMOKE frames={_perfFrames} elapsed={elapsed:F2}s avg_fps={_perfFrames / elapsed:F1} peak_static_mb={_peakStaticMemory / 1048576.0:F1}");
        GetTree().Quit();
    }

    public void AttachCore(ICoreUiPort coreUiPort)
    {
        _coreUiPort = coreUiPort;
        _audio?.BindCore(coreUiPort);
        BindActiveScreen();
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
        _audio.BindButtons(_activeScreen);
        _audio.SetContext(screenKey);
        BindActiveScreen();
    }

    private void OnNavigateRequested(string screenKey)
    {
        if (screenKey == "quit")
        {
            _audio.StopAll();
            GetTree().CreateTimer(0.12).Timeout += () => GetTree().Quit();
            return;
        }
        ShowScreen(screenKey);
    }

    private void BindActiveScreen()
    {
        if (_coreUiPort == null || _activeScreen == null)
            return;
        switch (_activeScreen)
        {
            case BattleScreen battle:
                battle.BindCore(_coreUiPort);
                break;
            case RunScreen run:
                run.BindCore(_coreUiPort);
                break;
            case MapScreen map:
                map.BindCore(_coreUiPort);
                break;
            case MenuScreen menu:
                menu.BindCore(_coreUiPort);
                break;
        }
        _coreUiPort.PublishCurrentState();
    }
}
