using Godot;

namespace SoudacheGodot.App;

/// Owns non-positional music and UI feedback. The service creates its buses at
/// runtime so the same routing works in editor, tests, and exported builds.
public sealed partial class GameAudio : Node
{
    private const string CalmMusic = "res://assets/audio/music/sour-orange-earth.mp3";
    private const string BattleMusic = "res://assets/audio/music/black-stream-sea.mp3";
    private const string ClickSound = "res://assets/audio/sfx/click.wav";
    private const string HoverSound = "res://assets/audio/sfx/hover.wav";

    private AudioStreamPlayer _activeMusic = null!;
    private AudioStreamPlayer _standbyMusic = null!;
    private AudioStreamPlayer _ui = null!;
    private string _musicPath = "";
    private Tween? _musicTween;
    private int _lastPlayerHp = -1;
    private int _lastEnemyHp = -1;
    private string _lastBattleOutcome = "";

    public override void _Ready()
    {
        EnsureBus("Music", -6f);
        EnsureBus("SFX", -4f);
        _activeMusic = MakePlayer("MusicA", "Music");
        _standbyMusic = MakePlayer("MusicB", "Music");
        _ui = MakePlayer("UiSfx", "SFX");
    }

    public void SetContext(string screenKey)
    {
        var nextPath = screenKey == "battle" ? BattleMusic : CalmMusic;
        if (_musicPath == nextPath && _activeMusic.Playing) return;
        var stream = GD.Load<AudioStream>(nextPath);
        if (stream == null) return;
        if (stream is AudioStreamMP3 mp3) mp3.Loop = true;

        _standbyMusic.Stream = stream;
        _standbyMusic.VolumeDb = -40f;
        _standbyMusic.Play();
        var previous = _activeMusic;
        var next = _standbyMusic;
        if (_musicTween?.IsValid() == true) _musicTween.Kill();
        _musicTween = CreateTween().SetParallel(true);
        _musicTween.TweenProperty(previous, "volume_db", -40f, 0.8);
        _musicTween.TweenProperty(next, "volume_db", -10f, 0.8);
        _musicTween.Finished += previous.Stop;
        (_activeMusic, _standbyMusic) = (next, previous);
        _musicPath = nextPath;
    }

    public void BindButtons(Control root)
    {
        foreach (var child in root.FindChildren("*", "Button", true, false))
        {
            if (child is not Button button) continue;
            button.Pressed += PlayClick;
            button.MouseEntered += PlayHover;
        }
    }

    public void BindCore(ICoreUiPort core)
    {
        core.BattleSnapshotChanged += OnBattleSnapshot;
    }

    public void PlayEffect(string relativeName)
    {
        var stream = GD.Load<AudioStream>($"res://assets/audio/sfx/{relativeName}");
        if (stream == null) return;
        _ui.Stream = stream;
        _ui.Play();
    }

    public void StopAll()
    {
        if (_musicTween?.IsValid() == true) _musicTween.Kill();
        foreach (var player in new[] { _activeMusic, _standbyMusic, _ui })
        {
            if (player == null) continue;
            player.Stop();
            player.Stream = null;
        }
        _musicPath = "";
    }

    private void PlayClick() => PlayEffect("click.wav");
    private void PlayHover() => PlayEffect("hover.wav");

    private void OnBattleSnapshot(BattleUiSnapshot snapshot)
    {
        var enemyHp = 0;
        foreach (var enemy in snapshot.Enemies) enemyHp += enemy.Hp;
        if (_lastPlayerHp >= 0 && snapshot.PlayerHp > _lastPlayerHp) PlayEffect("heal.ogg");
        else if ((_lastPlayerHp >= 0 && snapshot.PlayerHp < _lastPlayerHp) || (_lastEnemyHp >= 0 && enemyHp < _lastEnemyHp)) PlayEffect("hit.ogg");
        var outcome = snapshot.StatusText.Contains("胜利", System.StringComparison.Ordinal) ? "victory"
            : snapshot.StatusText.Contains("失败", System.StringComparison.Ordinal) ? "defeat" : "";
        if (outcome.Length > 0 && outcome != _lastBattleOutcome) PlayEffect(outcome + ".ogg");
        _lastBattleOutcome = outcome;
        _lastPlayerHp = snapshot.PlayerHp;
        _lastEnemyHp = enemyHp;
    }

    public override void _ExitTree()
    {
        StopAll();
    }

    private AudioStreamPlayer MakePlayer(string name, string bus)
    {
        var player = new AudioStreamPlayer { Name = name, Bus = bus };
        AddChild(player);
        return player;
    }

    private static void EnsureBus(string name, float volumeDb)
    {
        var index = AudioServer.GetBusIndex(name);
        if (index < 0)
        {
            AudioServer.AddBus();
            index = AudioServer.BusCount - 1;
            AudioServer.SetBusName(index, name);
        }
        AudioServer.SetBusVolumeDb(index, volumeDb);
    }
}
