using Godot;
using System;

namespace SoudacheGodot.App;

/// <summary>
/// Persistent audio settings, ported from the localStorage keys in
/// 搜打撤/game/src/sound.js (sdt-muted / sdt-music-off / sdt-sfx-off /
/// sdt-music-vol / sdt-sfx-vol) to a Godot cfg file under user://.
/// Same value ranges and validation rules as the web version: switches are
/// boolean "1"/"0"-equivalents, volumes are clamped to 0..1 and a stored
/// out-of-range value falls back to the default 1. Setters persist immediately,
/// mirroring the web version's synchronous localStorage writes.
/// Full settings surface (keybinds, quality, ...) lands in batch 7b.
/// </summary>
public sealed class GameAudioSettings
{
    public const string ConfigPath = "user://audio.cfg";
    public const string Section = "audio";

    private const string KeyMuted = "muted";        // sdt-muted
    private const string KeyMusicOff = "music_off"; // sdt-music-off
    private const string KeySfxOff = "sfx_off";     // sdt-sfx-off
    private const string KeyMusicVol = "music_vol"; // sdt-music-vol
    private const string KeySfxVol = "sfx_vol";     // sdt-sfx-vol

    public bool Muted { get; private set; }
    public bool MusicOff { get; private set; }
    public bool SfxOff { get; private set; }
    public double MusicVolume { get; private set; } = 1.0;
    public double SfxVolume { get; private set; } = 1.0;

    public static GameAudioSettings Load()
    {
        var settings = new GameAudioSettings();
        var cfg = new ConfigFile();
        if (cfg.Load(ConfigPath) != Error.Ok) return settings;
        settings.Muted = cfg.GetValue(Section, KeyMuted, false).AsBool();
        settings.MusicOff = cfg.GetValue(Section, KeyMusicOff, false).AsBool();
        settings.SfxOff = cfg.GetValue(Section, KeySfxOff, false).AsBool();
        // sound.js:27-28 — parseFloat + range check; invalid/out-of-range keeps the default 1.
        settings.MusicVolume = ReadVolume(cfg, KeyMusicVol);
        settings.SfxVolume = ReadVolume(cfg, KeySfxVol);
        return settings;
    }

    public void Save()
    {
        var cfg = new ConfigFile();
        cfg.SetValue(Section, KeyMuted, Muted);
        cfg.SetValue(Section, KeyMusicOff, MusicOff);
        cfg.SetValue(Section, KeySfxOff, SfxOff);
        cfg.SetValue(Section, KeyMusicVol, MusicVolume);
        cfg.SetValue(Section, KeySfxVol, SfxVolume);
        cfg.Save(ConfigPath);
    }

    public void SetMuted(bool value) { Muted = value; Save(); }
    public void SetMusicMuted(bool value) { MusicOff = value; Save(); }
    public void SetSfxMuted(bool value) { SfxOff = value; Save(); }

    public void SetMusicVolume(double value)
    {
        MusicVolume = ClampVolume(value);
        Save();
    }

    public void SetSfxVolume(double value)
    {
        SfxVolume = ClampVolume(value);
        Save();
    }

    private static double ReadVolume(ConfigFile cfg, string key)
    {
        var raw = cfg.GetValue(Section, key, 1.0).AsDouble();
        return raw is >= 0 and <= 1 ? raw : 1.0;
    }

    private static double ClampVolume(double value) =>
        double.IsNaN(value) ? 0 : Math.Clamp(value, 0.0, 1.0);
}
