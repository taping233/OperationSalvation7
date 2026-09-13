using Godot;
using SoudacheGodot.UI;
using System;
using System.IO;
using System.Text.Json;
using System.Linq;

namespace SoudacheGodot.App;

/// Scene router. Core services can subscribe at this boundary without knowing about Control nodes.
/// 批次 7b：性能三铁律落点 + 退出落盘 + 设置装配。
/// - 铁律①失焦即暂停（NOTIFICATION_APPLICATION_FOCUS_OUT/IN → SceneTree.Paused，对齐网页 page-covered 全停）
/// - 铁律③启动 idle 预热（StartupWarmup 分帧，对照网页 game.boot.js 预热清单）
/// - 退出前落盘（NOTIFICATION_WM_CLOSE_REQUEST → RequestSaveActiveSlot，对齐网页 beforeunload）
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
    // 铁律①：失焦暂停状态（恢复时把暂停时长平移出 perf-smoke 计时窗）
    private bool _focusPaused;
    private ulong _focusPausedAtMs;
    // 铁律③：启动分帧预热
    private readonly StartupWarmup _warmup = new();
    // --smoke-7b：设置/失焦/退出落盘三合一自证（模板 exe 跑，日志断言）
    private bool _smoke7b;
    private double _smoke7bAtSec = -1;
    private bool _smoke7bRan;

    private static readonly string[] ScreenPaths =
    {
        "res://scenes/menu.tscn",
        "res://scenes/run.tscn",
        "res://scenes/map.tscn",
        "res://scenes/battle.tscn"
    };

    public override void _Ready()
    {
        // 设置装配必须最先：后续 UI/适配器可能读 Settings 静态属性
        GodotSettingsStorage.Install();
        Settings.Load();
        // 退出落盘前提：接管窗口关闭（对齐网页 beforeunload 的拦截点）
        GetTree().AutoAcceptQuit = false;

        _screenHost = GetNode<Control>("ScreenHost");
        _audio = new GameAudio { Name = "GameAudio" };
        AddChild(_audio);
        AttachCore(new CoreGameAdapter());
        var args = OS.GetCmdlineUserArgs();
        _perfSmoke = Array.IndexOf(args, "--perf-smoke") >= 0;
        _smoke7b = Array.IndexOf(args, "--smoke-7b") >= 0;
        _perfStartMs = Time.GetTicksMsec();
        var initialScreen = Array.IndexOf(args, "--smoke-battle") >= 0 ? "battle"
            : Array.IndexOf(args, "--smoke-map") >= 0 ? "map"
            : Array.IndexOf(args, "--smoke-run") >= 0 ? "run"
            : "menu";
        // 批次 8 取证：--boot-load-slot=N 启动即读档位 N（基地仓库/收藏/宠物证据帧的数据源；
        // 对照网页「选档续局」语义，仅装配状态，无任何游戏内操作）
        foreach (var arg in args)
            if (arg.StartsWith("--boot-load-slot=", StringComparison.Ordinal)
                && int.TryParse(arg.AsSpan("--boot-load-slot=".Length), out var bootSlot)
                && bootSlot >= 0)
                _coreUiPort?.RequestLoadSlot(bootSlot);
        ShowScreen(initialScreen);
        // 铁律③：先收集清单，之后 _Process 分帧加载（batch=4/帧，主线程让出节奏对齐网页 warmBatched）
        _warmup.Collect();
        if (_smoke7b) _smoke7bAtSec = 1.0;
    }

    public override void _Notification(int what)
    {
        base._Notification(what);
        // Godot 4.7 C# 的通知常量是 long：用相等比较而非 switch case
        if (what == NotificationApplicationFocusOut)
        {
            OnApplicationFocus(false);
        }
        else if (what == NotificationApplicationFocusIn)
        {
            OnApplicationFocus(true);
        }
        else if (what == NotificationWMCloseRequest)
        {
            // 网页 beforeunload（game.boot.js:442 window.addEventListener('beforeunload', saveGame)）
            SaveAndQuit("wm-close");
        }
    }

    /// <summary>铁律①：失焦即全停（引擎计时/动画/音频随 SceneTree.Paused 挂起，对齐网页 page-covered 停画停更新）。</summary>
    internal void OnApplicationFocus(bool focused)
    {
        if (!focused)
        {
            if (_focusPaused) return;
            _focusPaused = true;
            _focusPausedAtMs = Time.GetTicksMsec();
            GetTree().Paused = true;
            GD.Print($"FOCUS_PAUSE paused={GetTree().Paused} (engine timing/animation/audio suspended; page-covered aligned)");
        }
        else
        {
            if (!_focusPaused) return;
            _focusPaused = false;
            // 暂停时长不计入 perf-smoke 窗口（否则恢复后 elapsed 直接越界，fps 失真）
            _perfStartMs += Time.GetTicksMsec() - _focusPausedAtMs;
            GetTree().Paused = false;
            GD.Print($"FOCUS_RESUME paused={GetTree().Paused} suspended_ms={Time.GetTicksMsec() - _focusPausedAtMs}");
        }
    }

    /// <summary>退出前落盘再退出（设置页 quit 与窗口关闭共用；网页 quitGame=saveGame 后退）。</summary>
    private void SaveAndQuit(string reason)
    {
        _coreUiPort?.RequestSaveActiveSlot();
        GD.Print($"QUIT_AFTER_SAVE reason={reason}");
        GetTree().Quit();
    }

    public override void _Input(InputEvent @event)
    {
        if (@event is InputEventMouseButton mb)
            GD.PrintErr($"[dbg-input] btn={mb.ButtonIndex} pressed={mb.Pressed} pos={mb.Position} global={mb.GlobalPosition}");
        else if (@event is InputEventMouseMotion mm && (int)mm.Position.Y % 100 == 0)
            GD.PrintErr($"[dbg-input] move pos={mm.Position}");
        base._Input(@event);
    }

    public override void _Process(double delta)
    {
        _warmup.WarmStep();
        if (_smoke7bAtSec > 0)
        {
            _smoke7bAtSec -= delta;
            if (_smoke7bAtSec <= 0) { _smoke7bAtSec = -1; RunSmoke7b(); _smoke7bRan = true; }
            return;
        }
        if (_smoke7bRan)
        {
            if (_warmup.Done) GetTree().Quit(); // 等 WARMUP_OK 日志落盘再退出
            return;
        }
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
            // 网页 quitGame()：saveGame() 之后才真正退出（桌面版分支）
            SaveAndQuit("menu-quit");
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

    /// <summary>
    /// 批次 7b 自证（模板 exe --smoke-7b）：
    /// ①设置写→真文件重读（新 GodotSettingsStorage 实例模拟重启）→语义一致；
    /// ②失焦暂停/恢复切换（直接驱动 OnApplicationFocus，日志+断言 Paused 翻转）；
    /// ③退出落盘全链路（独立存档目录 user://saves-smoke-7b，不碰真实档位）：
    ///   开局→绑槽存档→移动→强制落盘→文件 RunActive=true→新实例读回续局。
    /// </summary>
    private void RunSmoke7b()
    {
        try
        {
            SmokeSettings();
            SmokeFocus();
            SmokeExitSave();
        }
        catch (Exception error)
        {
            GD.PrintErr($"SMOKE_7B_FAILED error={error.Message}");
        }
        finally
        {
            RestoreSettingsFile();
        }
    }

    /// <summary>smoke 前备份 settings.cfg，结束后还原（不污染真实用户设置）。</summary>
    private static string? _settingsBackup;

    private static void BackupSettingsFile()
    {
        var path = ProjectSettings.GlobalizePath(Settings.ConfigPath);
        _settingsBackup = File.Exists(path) ? File.ReadAllText(path) : null;
        if (File.Exists(path)) File.Delete(path);
        // 删除后重新装配一份干净存储：确认「无文件=默认值」的启动语义
        Settings.LoadFrom(GodotSettingsStorage.Fresh());
    }

    private static void RestoreSettingsFile()
    {
        var path = ProjectSettings.GlobalizePath(Settings.ConfigPath);
        if (_settingsBackup != null) File.WriteAllText(path, _settingsBackup);
        else if (File.Exists(path)) File.Delete(path);
        Settings.LoadFrom(GodotSettingsStorage.Fresh());
        GD.Print($"SETTINGS_RESTORED file_exists={File.Exists(path)}");
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        GD.Print($"  [7b] ok: {message}");
    }

    private void SmokeSettings()
    {
        BackupSettingsFile();
        Check(Settings.NodeNumbers && Settings.HintBar && Settings.LayerBanner && !Settings.DeveloperMode
              && Settings.ScreenShake && !Settings.ReduceMotion && Settings.Quality == "standard",
            "无配置文件冷启动：七项全部为网页默认值");
        // 写七项 → 用全新存储实例重读（=重启语义：只认文件，不认内存缓存）
        Settings.SetNodeNumbers(false);
        Settings.SetHintBar(false);
        Settings.SetLayerBanner(false);
        Settings.SetDeveloperMode(true);
        Settings.SetScreenShake(false);
        Settings.SetReduceMotion(true);
        Settings.SetQuality("low");
        Settings.LoadFrom(GodotSettingsStorage.Fresh());
        Check(!Settings.NodeNumbers && !Settings.HintBar && !Settings.LayerBanner,
            "重启重读：结点编号/提示条/环层横幅 关闭态保持");
        Check(Settings.DeveloperMode && Settings.ReduceMotion,
            "重启重读：开发者模式/减少动态 开启态保持");
        Check(!Settings.ScreenShake, "重启重读：屏幕震动关闭（sdt-reduce-shake 反向键方向正确）");
        Check(Settings.Quality == "low", "重启重读：画质 low 保持");
        // 表外画质回退 standard（scene/runtime.js:9 口径）
        Settings.SetQuality("ultra");
        Check(Settings.Quality == "standard", "画质表外值回退 standard");
        Settings.LoadFrom(GodotSettingsStorage.Fresh());
        Check(Settings.Quality == "standard", "重启重读：表外画质已按 standard 固化");
        GD.Print("SETTINGS_SMOKE_OK items=7 storage=user://settings.cfg");
    }

    private void SmokeFocus()
    {
        Check(!GetTree().Paused, "初始未暂停");
        OnApplicationFocus(false);
        Check(GetTree().Paused, "失焦后 SceneTree.Paused=true（计时/动画/音频随树挂起）");
        OnApplicationFocus(true);
        Check(!GetTree().Paused, "回焦后恢复运行");
        GD.Print("FOCUS_SMOKE_OK pause_resume_cycle=1");
    }

    private void SmokeExitSave()
    {
        const int slot = 0; // 档位 1（0 基；AtomicJsonSaveService 文件名 save_0.json 起）
        var root = ProjectSettings.GlobalizePath("user://saves-smoke-7b");
        if (Directory.Exists(root)) Directory.Delete(root, true);
        var savePath = Path.Combine(root, "save_0.json");
        var adapter = new CoreGameAdapter("user://saves-smoke-7b");
        string? saveStatus = null;
        adapter.SaveSlotsChanged += slots => saveStatus = slots.StatusText;
        adapter.RequestStartRun("dengkui");
        adapter.RequestSaveSlot(slot); // 绑定游玩档位（对照网页 setActiveSlot）+ 稳定落点写档
        Check(File.Exists(savePath), $"稳定落点保存产生档文件 (status={saveStatus ?? "null"}, " +
              $"dir={string.Join(",", Directory.Exists(root) ? Directory.GetFiles(root).Select(Path.GetFileName) : Array.Empty<string>())})");
        adapter.RequestRollDice();     // 前进一格：可能落战斗/事件/商店等非稳定态
        var mtimeBefore = File.GetLastWriteTimeUtc(savePath);
        adapter.RequestSaveSlot(slot);
        var guardRejected = File.GetLastWriteTimeUtc(savePath) == mtimeBefore;
        GD.Print($"EXIT_SAVE_GUARD stage={(guardRejected ? "rejected(unstable-phase)" : "allowed(ready/settlement)")}");
        adapter.RequestSaveActiveSlot(); // 强制落盘：绕过稳定落点守卫（beforeunload 语义）
        Check(File.GetLastWriteTimeUtc(savePath) > mtimeBefore, "退出强制落盘重写了档文件");
        Check(JsonContainsTrue(File.ReadAllText(savePath), "runActive"), "落盘档 runActive=true");
        var reborn = new CoreGameAdapter("user://saves-smoke-7b");
        reborn.RequestLoadSlot(slot);
        Check(reborn.HasActiveRun, "新实例读档恢复出进行中的远征（续局一致）");
        GD.Print("EXIT_SAVE_SMOKE_OK slot=1 dir=user://saves-smoke-7b");
    }

    private static bool JsonContainsTrue(string json, string property)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.True;
    }
}
