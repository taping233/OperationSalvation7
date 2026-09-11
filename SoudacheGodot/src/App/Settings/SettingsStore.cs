using System;
using System.Collections.Generic;

namespace SoudacheGodot.App;

/// <summary>
/// 设置项存储后端抽象（批次 7b）。生产实现 = <see cref="GodotSettingsStorage"/>（user://settings.cfg，
/// 与 GameAudioSettings 的 user://audio.cfg 同风格）；测试注入内存/临时文件实现（tests/App），
/// 让 SettingsStore.cs 保持纯 C#、不携带 Godot 依赖。
/// 写入即时落盘（Set 内部 Save），镜像网页 localStorage.setItem 的同步语义。
/// </summary>
public interface ISettingsStorage
{
    bool GetBool(string key, bool fallback);
    string GetString(string key, string fallback);
    void Set(string key, bool value);
    void Set(string key, string value);
}

/// <summary>
/// 网页版设置页「通用」区的全部非音频项（批次 7b）。静态查询 API 供 B 线 Fx/地图等后续消费
/// （消费点清单见 _planning/PROGRESS.md「接口需求」[7b→B]）。
///
/// 键名与取值映射（对照 搜打撤/game/src，只读参照）：
/// ─────────────────────────────────────────────────────────────────────────────
/// cfg 键(user://settings.cfg [settings]) | 网页 localStorage / 会话态          | 默认
/// ─────────────────────────────────────────────────────────────────────────────
/// quality                                | sdt-quality（scene/runtime.js:8）    | "standard"
///   取值 "low"|"standard"|"high"，渲染倍率 QUALITY={low:.7,standard:1,high:1.25}；
///   读到表外值回退 standard（runtime.js:9 `if(!QUALITY[quality])quality='standard'`）。
/// reduce_motion                          | sdt-reduce-motion（同向：'1'=减少动态）| false
///   网页读取口 game.run.flow.js:26（再并 matchMedia prefers-reduced-motion，桌面版无此项）。
/// screen_shake                           | sdt-reduce-shake（反向！）            | true
///   网页键存「减少震动」：'1'=禁震动（renderer.fx.js:15）；设置页勾选「屏幕震动反馈」checked =
///   键≠'1'（game.menu.js:661/728）。Godot 存启用语义（true=震动开），映射 ScreenShake = 网页键 != '1'。
/// hint_bar                               | sdt-hintbar（'0'=隐藏）              | true
///   网页默认显示、仅存 '0' 关（game.boot.js:478 no-hintbar；game.menu.js:658/714）。Godot 存启用语义。
/// layer_banner                           | sdt-banner（'0'=隐藏）               | true
///   环层横幅，同上口径（game.boot.js:479；game.menu.js:659/718）。
/// node_numbers                           | （网页为会话态 game.toggles.index，  | true
///   结点编号                               | store.js:6 默认 true，不落 localStorage；
///                                          renderer.js:587 消费）——批次 7b 口径要求持久化，默认与网页一致。
/// dev_mode                               | sdt-dev（'1'=开发者模式）            | false
///   game.notes.js:203 读取；设置页 game.menu.js:722-725 写入。
/// ─────────────────────────────────────────────────────────────────────────────
/// 音频项不在此处（sdt-muted/sdt-music-off/sdt-sfx-off/sdt-music-vol/sdt-sfx-vol →
/// GameAudioSettings，user://audio.cfg）；sdt-dev-dice（开发者固定骰子）不在本批清单。
/// </summary>
public static class Settings
{
    public const string ConfigPath = "user://settings.cfg";
    public const string Section = "settings";

    private const string KeyQuality = "quality";
    private const string KeyReduceMotion = "reduce_motion";
    private const string KeyScreenShake = "screen_shake";
    private const string KeyHintBar = "hint_bar";
    private const string KeyLayerBanner = "layer_banner";
    private const string KeyNodeNumbers = "node_numbers";
    private const string KeyDevMode = "dev_mode";

    /// <summary>合法画质值（scene/runtime.js QUALITY 表的键）。</summary>
    public static readonly IReadOnlyList<string> ValidQualities = new[] { "low", "standard", "high" };

    private static ISettingsStorage? _testStorage;   // tests/App 注入点（不触 Godot）
    private static Func<ISettingsStorage>? _factory; // GodotSettingsStorage.Install() 装配
    private static ISettingsStorage? _storage;

    /// <summary>生产装配点：AppMain._Ready 最先调 GodotSettingsStorage.Install()。</summary>
    internal static Func<ISettingsStorage>? StorageFactory
    {
        get => _factory;
        set => _factory = value;
    }

    /// <summary>测试注入点：注入后所有读写走该实现，永不触发 Godot 装配。</summary>
    internal static ISettingsStorage? TestStorage
    {
        get => _testStorage;
        set { _testStorage = value; _storage = null; }
    }

    private static ISettingsStorage Storage
    {
        get
        {
            if (_testStorage != null) return _testStorage;
            if (_storage == null)
            {
                var factory = _factory;
                if (factory == null) return UninstalledFallbackStorage.Instance; // 未装配：退默认值（消费方安全）
                _storage = factory();
            }
            return _storage;
        }
    }

    /// <summary>结点编号（地图节点上叠 01/02 序号；网页 game.toggles.index，默认开）。</summary>
    public static bool NodeNumbers { get; private set; } = true;

    /// <summary>底部操作提示条（网页 body.no-hintbar，默认显示）。</summary>
    public static bool HintBar { get; private set; } = true;

    /// <summary>环层横幅（网页 body.no-banner，默认显示）。</summary>
    public static bool LayerBanner { get; private set; } = true;

    /// <summary>开发者模式（固定骰子/卡牌制作入口；网页 game.devMode，默认关）。</summary>
    public static bool DeveloperMode { get; private set; }

    /// <summary>屏幕震动反馈（注意方向：网页 sdt-reduce-shake='1' 表示禁震动；默认开）。</summary>
    public static bool ScreenShake { get; private set; } = true;

    /// <summary>减少动态（网页 sdt-reduce-motion='1'；Fx/动画时长缩短的信号，默认关）。</summary>
    public static bool ReduceMotion { get; private set; }

    /// <summary>画质（渲染倍率 low/standard/high；网页 sdt-quality，默认 standard）。</summary>
    public static string Quality { get; private set; } = "standard";

    /// <summary>启动加载（AppMain._Ready 调；「重启语义」= 对同一存储重新读取）。</summary>
    public static void Load()
    {
        NodeNumbers = Storage.GetBool(KeyNodeNumbers, true);
        HintBar = Storage.GetBool(KeyHintBar, true);
        LayerBanner = Storage.GetBool(KeyLayerBanner, true);
        DeveloperMode = Storage.GetBool(KeyDevMode, false);
        ScreenShake = Storage.GetBool(KeyScreenShake, true);
        ReduceMotion = Storage.GetBool(KeyReduceMotion, false);
        Quality = NormalizeQuality(Storage.GetString(KeyQuality, "standard"));
    }

    /// <summary>测试装载：换存储并立即读取（等价一次冷启动）。</summary>
    internal static void LoadFrom(ISettingsStorage storage)
    {
        TestStorage = storage;
        Load();
    }

    public static void SetNodeNumbers(bool value) { NodeNumbers = value; Storage.Set(KeyNodeNumbers, value); }
    public static void SetHintBar(bool value) { HintBar = value; Storage.Set(KeyHintBar, value); }
    public static void SetLayerBanner(bool value) { LayerBanner = value; Storage.Set(KeyLayerBanner, value); }
    public static void SetDeveloperMode(bool value) { DeveloperMode = value; Storage.Set(KeyDevMode, value); }
    public static void SetScreenShake(bool value) { ScreenShake = value; Storage.Set(KeyScreenShake, value); }
    public static void SetReduceMotion(bool value) { ReduceMotion = value; Storage.Set(KeyReduceMotion, value); }

    public static void SetQuality(string value)
    {
        Quality = NormalizeQuality(value);
        Storage.Set(KeyQuality, Quality);
    }

    /// <summary>表外值回退 standard（scene/runtime.js:9 口径；不做大小写归一，网页同理）。</summary>
    public static string NormalizeQuality(string value) =>
        value is "low" or "standard" or "high" ? value : "standard";

    /// <summary>未装配兜底：只读默认值、写即抛（暴露装配缺失，不静默丢设置）。</summary>
    private sealed class UninstalledFallbackStorage : ISettingsStorage
    {
        internal static readonly UninstalledFallbackStorage Instance = new();
        public bool GetBool(string key, bool fallback) => fallback;
        public string GetString(string key, string fallback) => fallback;
        public void Set(string key, bool value) => throw new InvalidOperationException(
            "Settings storage not installed: call GodotSettingsStorage.Install() in AppMain._Ready first.");
        public void Set(string key, string value) => throw new InvalidOperationException(
            "Settings storage not installed: call GodotSettingsStorage.Install() in AppMain._Ready first.");
    }
}
