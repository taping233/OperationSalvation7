using Godot;

namespace SoudacheGodot.App;

/// <summary>
/// <see cref="ISettingsStorage"/> 的生产实现：user://settings.cfg（[settings] 段），
/// 风格与 GameAudioSettings（user://audio.cfg，[audio] 段）一致。首次访问时惰性读文件，
/// 每次 Set 即 Save（镜像网页 localStorage 同步写入；文件小，重写开销可忽略）。
/// 本类型带 Godot 依赖，tests/App 不编译此文件（纯语义测试走 SettingsStore.cs + 注入存储）。
/// </summary>
public sealed class GodotSettingsStorage : ISettingsStorage
{
    public static readonly GodotSettingsStorage Shared = new();

    private readonly ConfigFile _cfg = new();
    private bool _loaded;

    /// <summary>生产装配：AppMain._Ready 最先调用，此后 Settings 静态 API 全部可用。</summary>
    public static void Install() => Settings.StorageFactory = () => Shared;

    private void EnsureLoaded()
    {
        if (_loaded) return;
        // 文件缺失返回 Error.FileNotFound：ConfigFile 保持空表，GetValue 走 fallback 默认值
        _cfg.Load(Settings.ConfigPath);
        _loaded = true;
    }

    public bool GetBool(string key, bool fallback)
    {
        EnsureLoaded();
        return _cfg.GetValue(Settings.Section, key, fallback).AsBool();
    }

    public string GetString(string key, string fallback)
    {
        EnsureLoaded();
        // 键缺失时 GetValue 返回 fallback 本身，AsString 不经过 null
        return _cfg.GetValue(Settings.Section, key, fallback).AsString();
    }

    public void Set(string key, bool value)
    {
        EnsureLoaded();
        _cfg.SetValue(Settings.Section, key, value);
        Save();
    }

    public void Set(string key, string value)
    {
        EnsureLoaded();
        _cfg.SetValue(Settings.Section, key, value);
        Save();
    }

    private void Save() => _cfg.Save(Settings.ConfigPath);

    /// <summary>独立实例（重新读文件，不共享缓存）——--smoke-7b 里模拟「重启后重读」用。</summary>
    public static GodotSettingsStorage Fresh() => new();
}
