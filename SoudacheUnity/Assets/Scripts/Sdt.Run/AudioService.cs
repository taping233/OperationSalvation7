// Current sound.js, sound.policy.js and SampleOnlyPlayer projected onto reusable native voices.
using System;
using System.Collections.Generic;
using System.Globalization;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Sdt.Run
{
    public sealed class AudioService : MonoBehaviour
    {
        static AudioService _i;
        public static AudioService I
        {
            get
            {
                if (_i == null)
                {
                    var go = new GameObject("SdtAudioService");
                    DontDestroyOnLoad(go); _i = go.AddComponent<AudioService>();
                }
                return _i;
            }
        }
        bool _muted, _musicOff, _sfxOff, _settingsWriteWarning;
        float _musicVol = 1, _sfxVol = 1;
        const float BaseMusic = .45f, BaseSfx = 1.5f;
        AudioSource _bgm, _titleBgm, _activeBgm;
        string _musicMode;
        sealed class CurrentCue
        {
            public AudioClip[] clips;
            public string group;
            public float gain, rateMin, rateMax, lowpass, maxDuration;
            public int cursor;
        }
        sealed class Voice
        {
            public AudioSource source;
            public AudioLowPassFilter filter;
            public bool ui, result;
            public int priority;
            public long sequence;
            public double start;
            public float duration, initialVolume;
        }
        readonly Voice[] _voices = new Voice[10];
        readonly Dictionary<string, CurrentCue> _currentCues = new Dictionary<string, CurrentCue>();
        readonly Dictionary<string, double> _lastSfxAt = new Dictionary<string, double>();
        readonly Queue<double> _recentSfx = new Queue<double>();
        readonly System.Random _audioRnd = new System.Random();
        JObject _policy;
        long _sequence;
        double _lastUiStart = double.NegativeInfinity;
        SaveSystem Saves => GameRuntime.I.Saves;
        static float DbGain(float value) => value <= 0 ? 0 : Mathf.Pow(10, (Mathf.Min(1, value) - 1) * 1.5f);
        float MusicGain => BaseMusic * DbGain(_musicVol) * (_musicMode == "battle" ? .45f : 1);
        AudioSource MakeSource(string name, bool loop)
        {
            var go = new GameObject(name); go.transform.SetParent(transform, false);
            var source = go.AddComponent<AudioSource>(); source.loop = loop; source.playOnAwake = false; return source;
        }
        void Awake()
        {
            _bgm = MakeSource("BgmA", true); _titleBgm = MakeSource("BgmB", true); _activeBgm = _bgm;
            for (int i = 0; i < _voices.Length; i++)
            {
                var source = MakeSource("Sfx" + i, false);
                var filter = source.gameObject.AddComponent<AudioLowPassFilter>(); filter.enabled = false;
                _voices[i] = new Voice { source = source, filter = filter };
            }
            LoadPersisted(); LoadCurrentCues();
        }
        void LoadPersisted()
        {
            var global = Saves.Global;
            _muted = global.GetString("sdt-muted") == "1";
            _musicOff = global.GetString("sdt-music-off") == "1";
            _sfxOff = global.GetString("sdt-sfx-off") == "1";
            if (float.TryParse(global.GetString("sdt-music-vol"), NumberStyles.Float, CultureInfo.InvariantCulture, out var mv) && mv >= 0 && mv <= 1) _musicVol = mv;
            if (float.TryParse(global.GetString("sdt-sfx-vol"), NumberStyles.Float, CultureInfo.InvariantCulture, out var sv) && sv >= 0 && sv <= 1) _sfxVol = sv;
        }
        void Persist(string key, string value)
        {
            try { Saves.Global.SetString(key, value); _settingsWriteWarning = false; }
            catch (Exception exception)
            {
                if (!_settingsWriteWarning) GameRuntime.I.Bus.Emit(new ToastRequested("音频设置保存失败：" + exception.Message));
                _settingsWriteWarning = true;
            }
        }
        void LoadCurrentCues()
        {
            var source = Res.Res.CurrentAudioCues;
            if (source == null) return;
            var definitions = JObject.Parse(source.text);
            _policy = definitions["_policy"] as JObject;
            foreach (var property in definitions.Properties())
            {
                if (property.Name == "_policy") continue;
                var definition = property.Value;
                var clips = new List<AudioClip>();
                if (definition["files"] is JArray files)
                    foreach (var file in files)
                    {
                        var clip = Res.Res.AudioPath((string)file);
                        if (clip != null) clips.Add(clip);
                    }
                var rate = definition["rate"];
                float minimum = 1f, maximum = 1f;
                if (rate is JArray range && range.Count > 0)
                { minimum = (float)range[0]; maximum = (float)range[range.Count - 1]; }
                else if (rate != null && (rate.Type == JTokenType.Float || rate.Type == JTokenType.Integer))
                    minimum = maximum = (float)rate;
                _currentCues[property.Name] = new CurrentCue
                {
                    clips = clips.ToArray(), gain = ((float?)definition["gain"] ?? 1f) * ((float?)definition["gainScale"] ?? 1f),
                    rateMin = Mathf.Max(0.1f, minimum), rateMax = Mathf.Max(0.1f, maximum),
                    group = (string)definition["group"], lowpass = (float?)definition["lowpass"] ?? 0,
                    maxDuration = (float?)definition["maxDuration"] ?? 0,
                };
            }
        }

        int Policy(string field, string key, int fallback = 0) => (int?)_policy?[field]?[key] ?? fallback;
        bool ShouldPlay(string key, double now)
        {
            if (key == "deny" && _lastSfxAt.TryGetValue("click", out var click) && now - click < .350) return false;
            int cooldown = Policy("cooldowns", key);
            if (cooldown > 0 && _lastSfxAt.TryGetValue(key, out var previous) && now - previous < cooldown / 1000.0) return false;
            while (_recentSfx.Count > 0 && (now < _recentSfx.Peek() || now - _recentSfx.Peek() >= .045)) _recentSfx.Dequeue();
            if (Policy("priorities", key, 2) <= 1 && _recentSfx.Count >= 4) return false;
            if (cooldown > 0) _lastSfxAt[key] = now;
            _recentSfx.Enqueue(now); return true;
        }
        public void PlaySfx(string key) => PlaySfx(key, null);
        public void PlaySfx(string key, string side)
        {
            if (_muted || _sfxOff || string.IsNullOrEmpty(key)) return;
            double now = Time.unscaledTimeAsDouble;
            if (!ShouldPlay(key, now)) return;
            if (key == "phase") key = side == "foe" ? "phaseFoe" : "phaseSelf";
            if (!_currentCues.TryGetValue(key, out var cue) || cue.clips.Length == 0) return;
            bool ui = cue.group == "ui", result = cue.group == "result";
            int active = 0, ordinary = 0, uiCount = 0, priority = Policy("priorities", key, ui ? 1 : 2);
            Voice free = null, victim = null;
            foreach (var voice in _voices)
            {
                if (!voice.source.isPlaying) { if (free == null) free = voice; continue; }
                active++; if (!voice.result) ordinary++; if (voice.ui) uiCount++;
                if (voice.priority < priority || result && voice.result)
                    if (victim == null || voice.priority < victim.priority || voice.priority == victim.priority && voice.sequence < victim.sequence) victim = voice;
            }
            if (ui && (now - _lastUiStart < .035 || uiCount >= 3)) return;
            if (active >= 10 || !result && ordinary >= 9) free = victim;
            if (free == null) return;
            free.source.Stop(); free.source.clip = cue.clips[cue.cursor]; cue.cursor = (cue.cursor + 1) % cue.clips.Length;
            free.source.pitch = cue.rateMin + (float)_audioRnd.NextDouble() * (cue.rateMax - cue.rateMin);
            free.source.volume = Mathf.Clamp01(BaseSfx * DbGain(_sfxVol) * cue.gain);
            free.filter.enabled = cue.lowpass > 0;
            if (free.filter.enabled) free.filter.cutoffFrequency = cue.lowpass;
            free.ui = ui; free.result = result; free.priority = priority; free.sequence = ++_sequence;
            free.start = now; free.initialVolume = free.source.volume;
            free.duration = cue.maxDuration > 0 ? Mathf.Min(cue.maxDuration, free.source.clip.length) / free.source.pitch : 0;
            free.source.Play(); if (ui) _lastUiStart = now;
        }
        public void PlayBgm(string mode)
        {
            mode = string.IsNullOrEmpty(mode) ? null : mode;
            if (mode == _musicMode) { SyncBgm(); return; }
            _musicMode = mode;
            if (mode != null)
            {
                var clip = Res.Res.Music(mode);
                if (clip == null) { Debug.LogWarning("[BGM] 当前配乐未加载：" + mode); return; }
                if (_activeBgm.clip != clip)
                {
                    _activeBgm = _activeBgm == _bgm ? _titleBgm : _bgm;
                    CancelFade(_activeBgm); _activeBgm.Stop(); _activeBgm.clip = clip;
                }
            }
            SyncBgm();
        }
        void SyncBgm()
        {
            bool on = _musicMode != null && !_muted && !_musicOff;
            SyncTrack(_bgm, on); SyncTrack(_titleBgm, on);
        }
        void SyncTrack(AudioSource track, bool on)
        {
            if (track.clip == null) return;
            if (!on)
            {
                CancelFade(track); track.Stop(); track.volume = 0; return;
            }
            if (track != _activeBgm) { if (track.isPlaying) StartFade(track, 0, .9f, true); return; }
            if (!track.isPlaying) { track.volume = 0; track.Play(); }
            StartFade(track, MusicGain, 1.1f, false);
        }
        sealed class Fade { public AudioSource source; public float from, to, time, duration; public bool stop; }
        readonly List<Fade> _fades = new List<Fade>(2);
        void CancelFade(AudioSource source)
        {
            for (int i = _fades.Count - 1; i >= 0; i--) if (_fades[i].source == source) _fades.RemoveAt(i);
        }
        void StartFade(AudioSource source, float to, float duration, bool stop)
        {
            foreach (var fade in _fades) if (fade.source == source && fade.to == to && fade.stop == stop) return;
            CancelFade(source);
            if (Mathf.Approximately(source.volume, to)) { source.volume = to; if (stop) source.Stop(); return; }
            _fades.Add(new Fade { source = source, from = source.volume, to = to, duration = duration, stop = stop });
        }
        void Update()
        {
            for (int i = _fades.Count - 1; i >= 0; i--)
            {
                var fade = _fades[i]; fade.time += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(fade.time / fade.duration);
                fade.source.volume = Mathf.Lerp(fade.from, fade.to, t);
                if (t >= 1) { if (fade.stop) fade.source.Stop(); _fades.RemoveAt(i); }
            }
            double now = Time.unscaledTimeAsDouble;
            foreach (var voice in _voices)
            {
                if (voice.duration <= 0 || !voice.source.isPlaying) continue;
                float t = (float)((now - voice.start) / voice.duration);
                if (t >= 1) voice.source.Stop(); else voice.source.volume = voice.initialVolume * (1 - t);
            }
        }
        void StopSfx() { foreach (var voice in _voices) voice.source.Stop(); _lastSfxAt.Clear(); _recentSfx.Clear(); _lastUiStart = double.NegativeInfinity; }
        public bool Muted => _muted;
        public string MusicScene => _musicMode;
        public string MusicAsset => _activeBgm.clip != null ? _activeBgm.clip.name : null;
        public bool MusicMuted => _musicOff;
        public bool SfxMuted => _sfxOff;
        public float MusicVolume => _musicVol;
        public float SfxVolume => _sfxVol;
        public void Mute(bool value) { _muted = value; Persist("sdt-muted", value ? "1" : "0"); if (value) StopSfx(); SyncBgm(); }
        public void SetMusicMuted(bool value) { _musicOff = value; Persist("sdt-music-off", value ? "1" : "0"); SyncBgm(); }
        public void SetSfxMuted(bool value) { _sfxOff = value; Persist("sdt-sfx-off", value ? "1" : "0"); if (value) StopSfx(); }
        public void SetMusicVolume(float value) { _musicVol = Mathf.Clamp01(value); Persist("sdt-music-vol", _musicVol.ToString("0.####", CultureInfo.InvariantCulture)); SyncBgm(); }
        public void SetSfxVolume(float value) { _sfxVol = Mathf.Clamp01(value); Persist("sdt-sfx-vol", _sfxVol.ToString("0.####", CultureInfo.InvariantCulture)); }
        public void Kick() => SyncBgm();
        void OnDestroy() { if (_i == this) _i = null; }
    }
}
