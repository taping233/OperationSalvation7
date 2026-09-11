using Godot;
using System;
using System.Collections.Generic;

namespace SoudacheGodot.App;

/// <summary>
/// Audio pipeline ported from 搜打撤/game/src/sound.js:
/// - two-track BGM (streaming mp3 in the web version): title theme and battle/board theme,
///   cross-faded with the same 420 ms in / 280 ms out (+300 ms stop) envelope and the
///   same combat side-chain ducking factor (0.45);
/// - category-based SFX API with the same layered resolution as sfx(): battle sample
///   pool first (random pick, ±5% pitch), jsfxr samples (independent semantics, no
///   synth fallback), then named pools / synthesized fallbacks;
/// - volume & mute semantics of the five localStorage keys, persisted to
///   user://audio.cfg via <see cref="GameAudioSettings"/> (base gains: music 0.45,
///   sfx 2.5, dB curve dbGain(k) = 10^((k-1)*30/20)).
/// The web version's two-slot decode queue maps to Godot resources loaded once and
/// kept resident; the WebAudio synthesized SFX map to runtime-rendered
/// AudioStreamWav clips (<see cref="GameAudioSfxSynth"/>). Buses are configured in
/// code through AudioServer so project.godot stays untouched.
/// </summary>
public sealed partial class GameAudio : Node
{
    private const string TitleMusicPath = "res://assets/bgm-liejie-fuhe.mp3";
    private const string BattleMusicPath = "res://assets/bgm-sour-orange-earth.mp3";

    private const string MusicBusName = "Music";
    private const string SfxBusName = "SFX";
    private const string ClickBusName = "Click";

    // sound.js:18 — BASE_MUSIC 0.45, BASE_SFX 2.5
    private const double BaseMusic = 0.45;
    private const double BaseSfx = 2.5;
    // sound.js:21 — combat ducking: BGM side-chain pushed down while in battle
    private const double DuckFactor = 0.45;
    // sound.js:347/361 — fade(track.volume(), 0, 280) / fade(0, target, 420), pause after 300 ms
    private const float FadeInSeconds = 0.42f;
    private const float FadeOutSeconds = 0.28f;
    private const float FadeOutStopDelay = 0.30f;
    private const float SilenceDb = -60f;
    // sound.js:303 — jsfxr clips play at gain 0.6
    private const double JsfxGain = 0.6;
    // sound.js:37 — click chain: extra 1.8× into a compressor (threshold -14 dB, ratio 4)
    private const double ClickGain = 1.8;
    private const int SfxVoiceCount = 8;
    private const int ClickVoiceCount = 2;

    // sound.js:180-184 — BATTLE_GAIN: normalized samples pushed back per-key loudness
    private static readonly Dictionary<string, double> BattleGain = new()
    {
        ["hit"] = 0.55, ["hurt"] = 0.55, ["parry"] = 0.4, ["curse"] = 0.35, ["heal"] = 0.45,
        ["chestShake"] = 0.5, ["chestBurst"] = 0.65, ["reveal"] = 0.45, ["legend"] = 0.55,
        ["victory"] = 0.5, ["defeat"] = 0.5,
    };

    private readonly Random _rng = new();
    private readonly List<AudioStreamPlayer> _sfxVoices = new();
    private readonly List<AudioStreamPlayer> _clickVoices = new();
    private readonly List<Tween> _bgmTweens = new();
    private readonly Dictionary<string, AudioStream[]> _battlePools = new();
    private readonly Dictionary<string, AudioStream> _jsfx = new();
    private readonly Dictionary<string, AudioStream[]> _uiPools = new();
    private readonly Dictionary<string, AudioStreamWav> _synthCache = new();

    private GameAudioSettings _settings = new();
    private bool _userGestured;
    private bool _ducked;
    private string? _musicMode; // "title" | "battle" | "board" | "base" | null (sound.js:335)

    private AudioStreamPlayer _titleBgm = null!;
    private AudioStreamPlayer _battleBgm = null!;
    private int _sfxVoiceIndex;
    private int _clickVoiceIndex;

    private int _lastPlayerHp = -1;
    private int _lastEnemyHp = -1;
    private string _lastBattleOutcome = "";

    public override void _Ready()
    {
        _settings = GameAudioSettings.Load();
        EnsureBuses();
        _titleBgm = MakePlayer("TitleBgm", MusicBusName);
        _battleBgm = MakePlayer("BattleBgm", MusicBusName);
        for (var i = 0; i < SfxVoiceCount; i++) _sfxVoices.Add(MakePlayer($"SfxVoice{i}", SfxBusName));
        for (var i = 0; i < ClickVoiceCount; i++) _clickVoices.Add(MakePlayer($"ClickVoice{i}", ClickBusName));
        LoadPools();
        ApplyVolumes();
        SyncBgm();
    }

    // ---------- music (sound.js:334-420) ----------

    /// <summary>sound.js music(mode): "title" picks the title theme, any other
    /// mode ("battle"/"board"/"base") plays the main theme; null stops selection.</summary>
    public void Music(string? mode)
    {
        _musicMode = string.IsNullOrEmpty(mode) ? null : mode;
        SyncBgm();
    }

    /// <summary>Bridges screen routing to BGM modes: menu → title theme,
    /// battle → battle theme, run/map → marching (board) theme.</summary>
    public void SetContext(string screenKey)
    {
        Music(screenKey switch
        {
            "menu" => "title",
            "battle" => "battle",
            _ => "board",
        });
    }

    /// <summary>sound.js kick(): first user gesture unlocks BGM playback. Godot has
    /// no autoplay policy, but the gate is kept for semantic parity; any key or
    /// mouse press unlocks via _UnhandledInput.</summary>
    public void Kick()
    {
        if (_userGestured && _musicMode != null && ActiveBgm().Playing) return;
        _userGestured = true;
        SyncBgm();
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventKey or InputEventMouseButton or InputEventScreenTouch)
            Kick();
    }

    /// <summary>sound.js setDucked(v): combat side-chain, called on battle enter/exit.</summary>
    public void SetDucked(bool value)
    {
        if (_ducked == value) return;
        _ducked = value;
        ApplyVolumes();
        SyncBgm();
    }

    private bool IsMusicOn() =>
        _musicMode != null && !_settings.Muted && !_settings.MusicOff && _userGestured;

    private AudioStreamPlayer ActiveBgm() => _musicMode == "title" ? _titleBgm : _battleBgm;

    // sound.js syncBgm(): fade the inactive track out (280 ms, pause after 300 ms),
    // fade the active track in (420 ms) — playback gated by mode/mutes/gesture.
    private void SyncBgm()
    {
        var on = IsMusicOn();
        var current = ActiveBgm();
        foreach (var tween in _bgmTweens)
            if (tween.IsValid()) tween.Kill();
        _bgmTweens.Clear();

        foreach (var track in new[] { _titleBgm, _battleBgm })
        {
            if ((!on || track != current) && track.Playing)
            {
                var faded = track;
                var tween = CreateTween();
                tween.TweenProperty(faded, "volume_db", SilenceDb, FadeOutSeconds);
                _bgmTweens.Add(tween);
                GetTree().CreateTimer(FadeOutStopDelay).Timeout += () =>
                {
                    if (faded != ActiveBgm() || !IsMusicOn()) faded.Stop();
                };
            }
        }

        if (!on) return;
        EnsureBgmStream(current);
        if (!current.Playing)
        {
            current.VolumeDb = SilenceDb;
            current.Play();
            var tween = CreateTween();
            tween.TweenProperty(current, "volume_db", 0f, FadeInSeconds);
            _bgmTweens.Add(tween);
        }
        else
        {
            current.VolumeDb = 0f;
        }
    }

    // BGM loads on first need, mirroring the web preload:false lazy-load intent.
    private void EnsureBgmStream(AudioStreamPlayer player)
    {
        if (player.Stream != null) return;
        var isTitle = player == _titleBgm;
        var path = isTitle ? TitleMusicPath : BattleMusicPath;
        var stream = GD.Load<AudioStreamMP3>(path);
        if (stream == null)
        {
            GD.PrintErr($"GameAudio: BGM stream not found: {path}");
            return;
        }
        stream.Loop = true;
        player.Stream = stream;
    }

    // ---------- sfx (sound.js:309-332) ----------

    /// <summary>Plays a named SFX with the web resolution order: battle sample pool
    /// (random pick + ±5% pitch) → jsfxr sample (no synth fallback) → named UI pool
    /// (click/hover/switch) → synthesized clip. Keys not present anywhere stay silent.</summary>
    public void PlaySfx(string name)
    {
        if (_settings.Muted || _settings.SfxOff) return;
        if (_battlePools.TryGetValue(name, out var pool) && pool.Length > 0)
        {
            var gain = BattleGain.GetValueOrDefault(name, 0.5);
            PlayOnVoice(NextSfxVoice(), pool[_rng.Next(pool.Length)], LinearToDb(gain),
                0.95 + _rng.NextDouble() * 0.1); // sound.js:319 — ±5% playback rate
            return;
        }
        if (_jsfx.TryGetValue(name, out var jsfxStream))
        {
            PlayOnVoice(NextSfxVoice(), jsfxStream, LinearToDb(JsfxGain), 1.0);
            return;
        }
        if (TryPlayUiPool(name)) return;
        PlaySynth(name);
    }

    private bool TryPlayUiPool(string name)
    {
        if (!_uiPools.TryGetValue(name, out var pool) || pool.Length == 0) return false;
        var stream = pool[_rng.Next(pool.Length)];
        // sound.js:137/145/156 — click rides its 1.8× compressor chain; hover 0.12; switch 0.5.
        var gain = name switch { "click" => ClickGain, "hover" => 0.12, "switch" => 0.5, _ => 1.0 };
        if (name == "click")
            PlayOnVoice(NextClickVoice(), stream, LinearToDb(gain), 1.0);
        else
            PlayOnVoice(NextSfxVoice(), stream, LinearToDb(gain), 1.0);
        return true;
    }

    private void PlaySynth(string name)
    {
        AudioStreamWav? clip;
        if (name == "dice")
        {
            clip = GameAudioSfxSynth.Render("dice", _rng); // random tumble: re-render per call
        }
        else if (!_synthCache.TryGetValue(name, out clip))
        {
            clip = GameAudioSfxSynth.Render(name, _rng);
            _synthCache[name] = clip;
        }
        if (clip == null || clip.Data.Length <= 2) return;
        PlayOnVoice(NextSfxVoice(), clip, 0f, 1.0); // amplitude is baked into the clip
    }

    private void PlayOnVoice(AudioStreamPlayer voice, AudioStream stream, float volumeDb, double pitch)
    {
        voice.Stream = stream;
        voice.VolumeDb = volumeDb;
        voice.PitchScale = (float)pitch;
        voice.Play();
    }

    private AudioStreamPlayer NextSfxVoice()
    {
        var voice = _sfxVoices[_sfxVoiceIndex];
        _sfxVoiceIndex = (_sfxVoiceIndex + 1) % _sfxVoices.Count;
        return voice;
    }

    private AudioStreamPlayer NextClickVoice()
    {
        var voice = _clickVoices[_clickVoiceIndex];
        _clickVoiceIndex = (_clickVoiceIndex + 1) % _clickVoices.Count;
        return voice;
    }

    // ---------- volume / mute keys (sound.js:369-406) ----------

    public bool Muted => _settings.Muted;
    public bool MusicMuted => _settings.MusicOff;
    public bool SfxMuted => _settings.SfxOff;
    public double MusicVolume => _settings.MusicVolume;
    public double SfxVolume => _settings.SfxVolume;
    public GameAudioSettings Settings => _settings;

    public void SetMuted(bool value) { _settings.SetMuted(value); ApplyVolumes(); SyncBgm(); }
    public void SetMusicMuted(bool value) { _settings.SetMusicMuted(value); SyncBgm(); }
    public void SetSfxMuted(bool value) { _settings.SetSfxMuted(value); }
    public void SetMusicVolume(double value) { _settings.SetMusicVolume(value); ApplyVolumes(); }
    public void SetSfxVolume(double value) { _settings.SetSfxVolume(value); ApplyVolumes(); }

    // sound.js:20 — dbGain(k) = 10^((k-1)*30/20): k=1 → unity, k=0 → -30 dB
    private static double DbGain(double k) => Math.Pow(10, (k - 1) * 30.0 / 20.0);

    private static float LinearToDb(double linear) =>
        linear <= 1e-5 ? -80f : (float)(20.0 * Math.Log10(linear));

    private void ApplyVolumes()
    {
        AudioServer.SetBusMute(AudioServer.GetBusIndex("Master"), _settings.Muted);
        var musicLinear = BaseMusic * DbGain(_settings.MusicVolume) * (_ducked ? DuckFactor : 1.0);
        AudioServer.SetBusVolumeDb(AudioServer.GetBusIndex(MusicBusName), LinearToDb(musicLinear));
        var sfxLinear = BaseSfx * DbGain(_settings.SfxVolume);
        AudioServer.SetBusVolumeDb(AudioServer.GetBusIndex(SfxBusName), LinearToDb(sfxLinear));
    }

    // ---------- battle snapshot hooks (see _planning/audio-inventory.md §3) ----------

    public void BindButtons(Control root)
    {
        foreach (var child in root.FindChildren("*", "Button", true, false))
        {
            if (child is not Button button) continue;
            button.Pressed += () => PlaySfx("click");
            button.MouseEntered += () => PlaySfx("hover");
        }
    }

    public void BindCore(ICoreUiPort core)
    {
        core.BattleSnapshotChanged += OnBattleSnapshot;
    }

    private void OnBattleSnapshot(BattleUiSnapshot snapshot)
    {
        var enemyHp = 0;
        foreach (var enemy in snapshot.Enemies) enemyHp += enemy.Hp;
        if (_lastPlayerHp >= 0 && snapshot.PlayerHp > _lastPlayerHp) PlaySfx("heal");
        else if (_lastPlayerHp >= 0 && snapshot.PlayerHp < _lastPlayerHp) PlaySfx("hurt");
        if (_lastEnemyHp >= 0 && enemyHp < _lastEnemyHp) PlaySfx("hit");
        var outcome = snapshot.StatusText.Contains("胜利", StringComparison.Ordinal) ? "victory"
            : snapshot.StatusText.Contains("失败", StringComparison.Ordinal) ? "defeat" : "";
        if (outcome.Length > 0 && outcome != _lastBattleOutcome) PlaySfx(outcome);
        _lastBattleOutcome = outcome;
        _lastPlayerHp = snapshot.PlayerHp;
        _lastEnemyHp = enemyHp;
    }

    // ---------- pools (sound.js:75-198, 279-294) ----------

    private void LoadPools()
    {
        _uiPools["click"] = LoadPool(new[] { "click1.wav", "click2.wav", "click3.wav", "click4.wav", "click5.wav" }, normalize: true);
        _uiPools["hover"] = LoadPool(new[] { "rollover1.wav", "rollover2.wav", "rollover3.wav", "rollover4.wav", "rollover5.wav", "rollover6.wav" }, normalize: true);
        _uiPools["switch"] = LoadPool(new[] { "switch1.wav", "switch2.wav", "switch3.wav", "switch4.wav", "switch5.wav", "switch6.wav" }, normalize: true);
        _battlePools["hit"] = LoadPool(new[] { "hit-1.ogg", "hit-2.ogg", "hit-3.ogg", "hit-4.ogg" }, normalize: false);
        _battlePools["hurt"] = LoadPool(new[] { "hurt-1.ogg", "hurt-2.ogg" }, normalize: false);
        _battlePools["parry"] = LoadPool(new[] { "parry-1.ogg", "parry-2.ogg" }, normalize: false);
        _battlePools["curse"] = LoadPool(new[] { "curse-1.ogg", "curse-2.ogg" }, normalize: false);
        _battlePools["heal"] = LoadPool(new[] { "heal-1.ogg", "heal-2.ogg", "heal-3.ogg" }, normalize: false);
        _battlePools["chestShake"] = LoadPool(new[] { "chestshake-1.ogg", "chestshake-2.ogg" }, normalize: false);
        _battlePools["chestBurst"] = LoadPool(new[] { "chestburst-1.ogg", "chestburst-2.ogg", "chestburst-3.ogg" }, normalize: false);
        _battlePools["reveal"] = LoadPool(new[] { "reveal-1.ogg", "reveal-2.ogg", "reveal-3.ogg" }, normalize: false);
        _battlePools["legend"] = LoadPool(new[] { "legend-1.ogg", "legend-2.ogg", "legend-3.ogg" }, normalize: false);
        _battlePools["victory"] = LoadPool(new[] { "victory-1.ogg", "victory-2.ogg" }, normalize: false);
        _battlePools["defeat"] = LoadPool(new[] { "defeat-1.ogg" }, normalize: false);
        // jsfxr semantic keys (sound.js:280-286): gain/confirm/deny/levelup/strike
        foreach (var (key, file) in new[]
                 {
                     ("gain", "jsfxr/pickup.wav"), ("confirm", "jsfxr/confirm.wav"),
                     ("deny", "jsfxr/error.wav"), ("levelup", "jsfxr/levelup.wav"),
                     ("strike", "jsfxr/hit.wav"),
                 })
        {
            var stream = LoadSingle(file, normalize: true);
            if (stream != null) _jsfx[key] = stream;
        }
    }

    private AudioStream[] LoadPool(string[] files, bool normalize)
    {
        var streams = new List<AudioStream>();
        foreach (var file in files)
        {
            var stream = LoadSingle(file, normalize);
            if (stream != null) streams.Add(stream);
        }
        return streams.ToArray();
    }

    private AudioStream? LoadSingle(string relativeName, bool normalize)
    {
        var stream = GD.Load<AudioStream>($"res://assets/sfx/{relativeName}");
        if (stream == null)
        {
            GD.PushWarning($"GameAudio: SFX sample missing, fallback applies: {relativeName}");
            return null;
        }
        // sound.js:117-130 — peak-normalize to 95% (skipped when within ±5% of unity).
        // Only wav data is rewritable at runtime; ogg battle samples rely on BATTLE_GAIN.
        if (normalize && stream is AudioStreamWav wav) NormalizeWav16(wav, 0.95);
        return stream;
    }

    private static void NormalizeWav16(AudioStreamWav wav, double targetPeak)
    {
        if (wav.Format != AudioStreamWav.FormatEnum.Format16Bits) return;
        var data = wav.Data;
        if (data == null || data.Length < 2) return;
        var peak = 1;
        for (var i = 0; i + 1 < data.Length; i += 2)
        {
            var sample = (short)(data[i] | (data[i + 1] << 8));
            var magnitude = Math.Abs((int)sample);
            if (magnitude > peak) peak = magnitude;
        }
        var k = targetPeak * short.MaxValue / peak;
        if (Math.Abs(k - 1.0) < 0.05) return;
        for (var i = 0; i + 1 < data.Length; i += 2)
        {
            var sample = (short)(data[i] | (data[i + 1] << 8));
            var boosted = (short)Math.Clamp((int)Math.Round(sample * k), short.MinValue, short.MaxValue);
            data[i] = (byte)(boosted & 0xFF);
            data[i + 1] = (byte)((boosted >> 8) & 0xFF);
        }
        wav.Data = data;
    }

    // ---------- buses (AudioServer, no project.godot changes) ----------

    private static void EnsureBuses()
    {
        EnsureBus(MusicBusName);
        EnsureBus(SfxBusName);
        var clickIndex = AudioServer.GetBusIndex(ClickBusName);
        if (clickIndex < 0)
        {
            AudioServer.AddBus();
            clickIndex = AudioServer.BusCount - 1;
            AudioServer.SetBusName(clickIndex, ClickBusName);
        }
        // sound.js:36-40 — click chain: clickGain(1.8) → DynamicsCompressor(-14 dB, 4:1) → sfxGain
        AudioServer.SetBusSend(clickIndex, SfxBusName);
        if (AudioServer.GetBusEffectCount(clickIndex) == 0)
            AudioServer.AddBusEffect(clickIndex, new AudioEffectCompressor { Threshold = -14f, Ratio = 4f });
    }

    private static void EnsureBus(string name)
    {
        var index = AudioServer.GetBusIndex(name);
        if (index < 0)
        {
            AudioServer.AddBus();
            index = AudioServer.BusCount - 1;
            AudioServer.SetBusName(index, name);
        }
    }

    private AudioStreamPlayer MakePlayer(string name, string bus)
    {
        var player = new AudioStreamPlayer { Name = name, Bus = bus };
        AddChild(player);
        return player;
    }

    public void StopAll()
    {
        foreach (var tween in _bgmTweens)
            if (tween.IsValid()) tween.Kill();
        _bgmTweens.Clear();
        foreach (var player in _sfxVoices) { player.Stop(); player.Stream = null; }
        foreach (var player in _clickVoices) { player.Stop(); player.Stream = null; }
        foreach (var player in new[] { _titleBgm, _battleBgm }) { player.Stop(); player.Stream = null; }
        _musicMode = null;
    }

    public override void _ExitTree()
    {
        StopAll();
    }
}
