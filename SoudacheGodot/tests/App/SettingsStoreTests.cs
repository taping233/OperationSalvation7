using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using SoudacheGodot.App;

/// <summary>
/// 批次 7b 验收①：设置持久化「写 → 重读 → 重启语义一致」。
/// SettingsStore.cs 纯 C# 核心语义（键映射/默认值/取值校验/持久化往返）在此验证；
/// ConfigFile + user:// 真文件链路由模板 exe 的 --smoke-7b（SETTINGS_SMOKE_OK）覆盖。
/// </summary>
internal static class SettingsStoreTests
{
    private static int _checks;

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        _checks++;
    }

    public static int Main()
    {
        WebAlignedDefaults();
        WriteReloadRestartRoundTrip();
        ShakeKeyDirectionIsInvertedFromWeb();
        InvalidQualityFallsBackToStandard();
        UninstalledStorageKeepsDefaultsAndRejectsWrites();
        Console.WriteLine($"SETTINGS_TESTS_OK checks={_checks}");
        return 0;
    }

    /// <summary>空存储 = 网页默认（无 localStorage 时设置页各 checkbox 的初始态）。</summary>
    private static void WebAlignedDefaults()
    {
        Settings.LoadFrom(new MemoryStorage());
        Check(Settings.NodeNumbers, "结点编号默认开（game.toggles.index=true）");
        Check(Settings.HintBar, "底部提示条默认显示（sdt-hintbar 缺省≠'0'）");
        Check(Settings.LayerBanner, "环层横幅默认显示（sdt-banner 缺省≠'0'）");
        Check(!Settings.DeveloperMode, "开发者模式默认关（sdt-dev 缺省≠'1'）");
        Check(Settings.ScreenShake, "屏幕震动默认开（sdt-reduce-shake 缺省≠'1'）");
        Check(!Settings.ReduceMotion, "减少动态默认关（sdt-reduce-motion 缺省≠'1'）");
        Check(Settings.Quality == "standard", "画质默认 standard（sdt-quality 缺省）");
    }

    /// <summary>写七项 → 同一后端新实例重读（=重启）→ 七项语义一致。</summary>
    private static void WriteReloadRestartRoundTrip()
    {
        var storage = new TempFileStorage();
        Settings.LoadFrom(storage);
        Settings.SetNodeNumbers(false);
        Settings.SetHintBar(false);
        Settings.SetLayerBanner(false);
        Settings.SetDeveloperMode(true);
        Settings.SetScreenShake(false);
        Settings.SetReduceMotion(true);
        Settings.SetQuality("high");
        // 重启语义：全新的 storage 实例只认落盘文件，模拟进程结束后再启动
        Settings.LoadFrom(storage.Fresh());
        Check(!Settings.NodeNumbers, "重启重读：结点编号=关");
        Check(!Settings.HintBar, "重启重读：提示条=关");
        Check(!Settings.LayerBanner, "重启重读：环层横幅=关");
        Check(Settings.DeveloperMode, "重启重读：开发者模式=开");
        Check(!Settings.ScreenShake, "重启重读：屏幕震动=关");
        Check(Settings.ReduceMotion, "重启重读：减少动态=开");
        Check(Settings.Quality == "high", "重启重读：画质=high");
        // 再翻转一项并重读：证明写路径持续生效（非一次性幸运）
        Settings.SetScreenShake(true);
        Settings.LoadFrom(storage.Fresh());
        Check(Settings.ScreenShake, "二次翻转后重启重读：屏幕震动恢复=开");
    }

    /// <summary>
    /// 方向性：ScreenShake=false 必须等价网页 sdt-reduce-shake='1'（renderer.fx.js reduceShake 读法）。
    /// 直接检查落盘键值为「禁震动」语义，防止映射写反。
    /// </summary>
    private static void ShakeKeyDirectionIsInvertedFromWeb()
    {
        var storage = new MemoryStorage();
        Settings.LoadFrom(storage);
        Settings.SetScreenShake(false);
        Check(storage.Raw["screen_shake"] == "false",
            "screen_shake=false 落盘（等价网页 sdt-reduce-shake='1'：禁震动）");
        Settings.SetScreenShake(true);
        Check(storage.Raw["screen_shake"] == "true",
            "screen_shake=true 落盘（等价网页 sdt-reduce-shake 缺省/'0'：允许震动）");
    }

    /// <summary>表外画质回退 standard（scene/runtime.js `if(!QUALITY[quality])` 口径），且重启后保持。</summary>
    private static void InvalidQualityFallsBackToStandard()
    {
        var storage = new MemoryStorage();
        Settings.LoadFrom(storage);
        Check(Settings.NormalizeQuality("ultra") == "standard", "NormalizeQuality 表外值→standard");
        Check(Settings.NormalizeQuality("LOW") == "standard", "NormalizeQuality 大小写敏感（网页同口径）→standard");
        Settings.SetQuality("low");
        storage.Raw["quality"] = "cinematic"; // 模拟外部/旧版写入坏值
        Settings.LoadFrom(storage); // MemoryStorage 同实例重读（键值已直接被测试改写）
        Check(Settings.Quality == "standard", "重启读坏值：回退 standard 不崩溃");
    }

    /// <summary>存储未装配（生产未 Install 且无测试注入）时读默认值不抛、写显式失败。</summary>
    private static void UninstalledStorageKeepsDefaultsAndRejectsWrites()
    {
        Settings.TestStorage = null;
        Settings.StorageFactory = null;
        // 直接走属性：未装配读路径回退默认值（消费方安全）
        Check(Settings.HintBar == true && Settings.Quality == "standard",
            "未装配存储：静态属性回退默认值不抛");
        bool threw = false;
        try { Settings.SetHintBar(false); }
        catch (InvalidOperationException) { threw = true; }
        Check(threw, "未装配存储：写入显式失败（暴露装配缺失，不静默丢设置）");
        Settings.TestStorage = new MemoryStorage(); // 还原注入态，防影响后续测试
        Settings.Load();
    }

    /// <summary>内存存储（进程内语义）。</summary>
    private sealed class MemoryStorage : ISettingsStorage
    {
        public readonly Dictionary<string, string> Raw = new(StringComparer.Ordinal);

        public bool GetBool(string key, bool fallback) =>
            Raw.TryGetValue(key, out var v) ? v == "true" : fallback;

        public string GetString(string key, string fallback) =>
            Raw.TryGetValue(key, out var v) ? v : fallback;

        public void Set(string key, bool value) => Raw[key] = value ? "true" : "false";
        public void Set(string key, string value) => Raw[key] = value;
    }

    /// <summary>临时文件存储：JSON 落盘 + Fresh() 换实例重读（文件系统级「重启」语义）。</summary>
    private sealed class TempFileStorage : ISettingsStorage
    {
        private readonly string _path =
            Path.Combine(Path.GetTempPath(), "soudache-7b-settings-" + Guid.NewGuid().ToString("N") + ".json");

        public TempFileStorage() { }

        private TempFileStorage(string path) => _path = path;

        private Dictionary<string, string> Read()
        {
            if (!File.Exists(_path)) return new Dictionary<string, string>(StringComparer.Ordinal);
            return JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(_path))
                   ?? new Dictionary<string, string>(StringComparer.Ordinal);
        }

        public bool GetBool(string key, bool fallback)
        {
            var raw = Read();
            return raw.TryGetValue(key, out var v) ? v == "true" : fallback;
        }

        public string GetString(string key, string fallback)
        {
            var raw = Read();
            return raw.TryGetValue(key, out var v) ? v : fallback;
        }

        public void Set(string key, bool value) => Write(key, value ? "true" : "false");
        public void Set(string key, string value) => Write(key, value);

        private void Write(string key, string value)
        {
            var raw = Read();
            raw[key] = value;
            File.WriteAllText(_path, JsonSerializer.Serialize(raw));
        }

        public TempFileStorage Fresh() => new(_path);
    }
}
