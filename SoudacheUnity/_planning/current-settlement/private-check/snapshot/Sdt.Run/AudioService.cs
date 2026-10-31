// ported from src/sound.js（Howler/WebAudio → AudioSource 池 + 过程化合成）
using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;

namespace Sdt.Run
{
    /// <summary>
    /// 音频服务。原版函数 → C# 方法映射（sound.js）：
    ///   sfx(name)→PlaySfx / music(mode)→PlayBgm / setMuted→Mute / setMusicMuted→SetMusicMuted /
    ///   setSfxMuted→SetSfxMuted / setMusicVolume→SetMusicVolume / setSfxVolume→SetSfxVolume /
    ///   tone()→Tone（合成参数照抄）/ noise()→Noise / syncBgm()→SyncBgm / kick()→Kick /
    ///   playClick/playHover/playSwitch→(click/hover/switch 键的采样路径)。
    ///
    /// 资源 key 对照表（sound.js 采样 → Resources 路径，经 Sdt.Res.Res 加载）：
    ///   click     → Audio/Sfx/click{1..5}.wav        （随机选一，回退合成 tone{f:900,f2:640,triangle,.06,.035}）
    ///   hover     → Audio/Sfx/rollover{1..6}.wav     （回退 tone{f:1500,sine,.04,.05}；采样响度 0.12）
    ///   switch    → Audio/Sfx/switch{1..6}.wav       （回退 tone{f:700,f2:1050,square,.05,.03}；采样响度 0.5）
    ///   hit       → Audio/Sfx/Battle/hit-{1..4}.ogg        增益 0.55
    ///   hurt      → Audio/Sfx/Battle/hurt-{1..2}.ogg       增益 0.55
    ///   parry     → Audio/Sfx/Battle/parry-{1..2}.ogg      增益 0.40
    ///   curse     → Audio/Sfx/Battle/curse-{1..2}.ogg      增益 0.35
    ///   heal      → Audio/Sfx/Battle/heal-{1..3}.ogg       增益 0.45
    ///   chestShake→ Audio/Sfx/Battle/chestshake-{1..2}.ogg 增益 0.50
    ///   chestBurst→ Audio/Sfx/Battle/chestburst-{1..3}.ogg 增益 0.65
    ///   reveal    → Audio/Sfx/Battle/reveal-{1..3}.ogg     增益 0.45
    ///   legend    → Audio/Sfx/Battle/legend-{1..3}.ogg     增益 0.55
    ///   victory   → Audio/Sfx/Battle/victory-{1..2}.ogg    增益 0.50
    ///   defeat    → Audio/Sfx/Battle/defeat-1.ogg          增益 0.50
    /// BGM 仅使用 Res.Music 对应现行 MUSIC_TRACKS；载入失败保持静音，不回退历史曲目。
    /// 其余 key（open/close/error/pick/drop/card/dice/scene/flee/ding 等）为合成音，参数见 SfxSynth 表（照抄 SFX 对象）。
    /// 音量/静音持久化到 global.json：sdt-muted / sdt-music-off / sdt-sfx-off / sdt-music-vol / sdt-sfx-vol（键名不改）。
    /// </summary>
    public sealed class AudioService : MonoBehaviour
    {
        public static AudioService I
        {
            get
            {
                if (_i == null)
                {
                    var go = new GameObject("SdtAudioService");
                    DontDestroyOnLoad(go);
                    _i = go.AddComponent<AudioService>();
                }
                return _i;
            }
        }
        static AudioService _i;

        // 三级开关（sound.js）：muted 全局静音 · musicOff 只关音乐 · sfxOff 只关音效
        bool _muted, _musicOff, _sfxOff;
        // 音量 0~1；音乐基准 0.45，音效基准 2.5（BASE_MUSIC / BASE_SFX）
        float _musicVol = 1f, _sfxVol = 1f;
        const float BaseMusic = 0.45f, BaseSfx = 2.5f;

        // BGM 双通道（bgm=行军 board / titleBgm=标题），loop，淡入 420ms / 淡出 280ms（syncBgm 数值照抄）
        AudioSource _bgm, _titleBgm;
        string _musicMode;   // null / 'board' / 'title'

        // Sfx 一池多通道
        readonly List<AudioSource> _sfxPool = new List<AudioSource>();
        const int SfxPoolSize = 16;

        // 采样缓存（key → clips），失败/未就绪时回退合成音
        readonly Dictionary<string, AudioClip[]> _samples = new Dictionary<string, AudioClip[]>();
        sealed class CurrentCue { public AudioClip[] clips; public float gain, rateMin, rateMax; public bool silent; }
        readonly Dictionary<string, CurrentCue> _currentCues = new Dictionary<string, CurrentCue>();
        // 合成音缓存（参数签名 → clip）
        readonly Dictionary<string, AudioClip> _synth = new Dictionary<string, AudioClip>();

        readonly System.Random _audioRnd = new System.Random();   // sound.js 的 Math.random / Random.random('audio')（音轨不需确定性）

        SaveSystem Saves => GameRuntime.I.Saves;

        void Awake()
        {
            _bgm = MakeSource("BgmBoard", loop: true);
            _titleBgm = MakeSource("BgmTitle", loop: true);
            for (int i = 0; i < SfxPoolSize; i++) _sfxPool.Add(MakeSource("Sfx" + i, loop: false, sfx: true));
            LoadPersisted();
            _bgm.clip = Res.Res.Music("board");
            _titleBgm.clip = Res.Res.Music("title");
            LoadSamples();
            LoadCurrentCues();
        }

        AudioSource MakeSource(string name, bool loop, bool sfx = false)
        {
            var src = new GameObject(name).AddComponent<AudioSource>();
            src.transform.SetParent(transform, false);
            src.loop = loop;
            src.playOnAwake = false;
            if (sfx) { src.volume = 1f; }
            return src;
        }

        // ---------- 持久化（localStorage 键 → global.json） ----------
        void LoadPersisted()
        {
            try
            {
                var g = Saves.Global;
                _muted = g.GetString("sdt-muted") == "1";
                _musicOff = g.GetString("sdt-music-off") == "1";
                _sfxOff = g.GetString("sdt-sfx-off") == "1";
                if (float.TryParse(g.GetString("sdt-music-vol"), out var mv) && mv >= 0 && mv <= 1) _musicVol = mv;
                if (float.TryParse(g.GetString("sdt-sfx-vol"), out var sv) && sv >= 0 && sv <= 1) _sfxVol = sv;
            }
            catch { /* 存储不可用 */ }
            ApplyVolumes();
        }
        bool _settingsWriteWarning;
        void Persist(string key, string value)
        {
            try { Saves.Global.SetString(key, value); _settingsWriteWarning = false; }
            catch (Exception exception)
            {
                if (!_settingsWriteWarning)
                    GameRuntime.I.Bus.Emit(new ToastRequested { Text = "音频设置保存失败，本次调整仍生效，请重试保存：" + exception.Message, Tone = "warn" });
                _settingsWriteWarning = true;
            }
        }

        void ApplyVolumes()
        {
            float music = _muted || _musicOff ? 0 : BaseMusic * _musicVol;
            float target = _musicMode != null ? music : 0;
            if (_bgm && _bgm.clip != null) _bgm.volume = target;
            if (_titleBgm && _titleBgm.clip != null) _titleBgm.volume = target;
            float sfxGain = BaseSfx * _sfxVol;
            foreach (var s in _sfxPool) s.pitch = 1f;   // 增益在 PlayClip 时按 key 乘
            _sfxGain = sfxGain;
        }
        float _sfxGain = BaseSfx;

        // ---------- 采样加载（loadClicks/loadHovers/loadSwitches/loadBattle 语义；失败回退合成音） ----------
        static readonly Dictionary<string, string[]> SampleKeys = new Dictionary<string, string[]> {
            ["click"] = new[] { "click1", "click2", "click3", "click4", "click5" },
            ["hover"] = new[] { "rollover1", "rollover2", "rollover3", "rollover4", "rollover5", "rollover6" },
            ["switch"] = new[] { "switch1", "switch2", "switch3", "switch4", "switch5", "switch6" },
            ["hit"] = new[] { "hit-1", "hit-2", "hit-3", "hit-4" },
            ["hurt"] = new[] { "hurt-1", "hurt-2" },
            ["parry"] = new[] { "parry-1", "parry-2" },
            ["curse"] = new[] { "curse-1", "curse-2" },
            ["heal"] = new[] { "heal-1", "heal-2", "heal-3" },
            ["chestShake"] = new[] { "chestshake-1", "chestshake-2" },
            ["chestBurst"] = new[] { "chestburst-1", "chestburst-2", "chestburst-3" },
            ["reveal"] = new[] { "reveal-1", "reveal-2", "reveal-3" },
            ["legend"] = new[] { "legend-1", "legend-2", "legend-3" },
            ["victory"] = new[] { "victory-1", "victory-2" },
            ["defeat"] = new[] { "defeat-1" },
        };
        // BATTLE_GAIN：采样峰值统一到 95% 后偏响，按键系数压回（参考原合成音相对响度）
        static readonly Dictionary<string, float> SampleGain = new Dictionary<string, float> {
            ["hit"] = 0.55f, ["hurt"] = 0.55f, ["parry"] = 0.4f, ["curse"] = 0.35f, ["heal"] = 0.45f,
            ["chestShake"] = 0.5f, ["chestBurst"] = 0.65f, ["reveal"] = 0.45f, ["legend"] = 0.55f,
            ["victory"] = 0.5f, ["defeat"] = 0.5f,
            ["click"] = 1.8f,   // clickGain 1.8（原链路另带压缩器，此处以增益近似）
            ["hover"] = 0.12f,  // 归一化后很响，压低成轻提示
            ["switch"] = 0.5f,
        };

        void LoadSamples()
        {
            foreach (var kv in SampleKeys)
            {
                var list = new List<AudioClip>();
                foreach (var f in kv.Value)
                {
                    var clip = kv.Key == "click" || kv.Key == "hover" || kv.Key == "switch"
                        ? Res.Res.Sfx(f) : Res.Res.BattleSfx(f);
                    if (clip != null) list.Add(clip);
                }
                if (list.Count > 0) _samples[kv.Key] = list.ToArray();
            }
        }

        void LoadCurrentCues()
        {
            var source = Res.Res.CurrentAudioCues;
            if (source == null) return;
            var definitions = JObject.Parse(source.text);
            foreach (var property in definitions.Properties())
            {
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
                    clips = clips.ToArray(), gain = (float?)definition["gain"] ?? 1f,
                    rateMin = Mathf.Max(0.1f, minimum), rateMax = Mathf.Max(0.1f, maximum),
                    silent = (bool?)definition["silent"] ?? false,
                };
            }
        }

        // ============================================================
        // 合成音（sound.js tone/noise 参数照抄）
        // ============================================================
        public enum WaveType { Sine, Triangle, Square, Sawtooth }

        /// <summary>
        /// tone({f, f2, type, dur, vol, delay, attack})：单音，f2 可选指数滑动终点；
        /// 增益 0.0001 → vol（attack 内指数上升）→ 0.0001（dur 处）。
        /// </summary>
        public void Tone(float f = 440f, float? f2 = null, WaveType type = WaveType.Sine,
            float dur = 0.15f, float vol = 0.08f, float delay = 0f, float attack = 0.006f)
        {
            if (_muted || _sfxOff) return;
            string sig = $"t{f}|{f2}|{(int)type}|{dur}|{vol}|{delay}|{attack}";
            var clip = Synth(sig, (int)(44100 * (delay + dur + 0.05f)), (sr, i, t) =>
            {
                if (t < delay || t > delay + dur) return 0f;
                float p = (t - delay) / dur;
                float g;
                if (t - delay < attack) g = 0.0001f * Mathf.Pow(vol / 0.0001f, (t - delay) / attack);
                else g = vol * Mathf.Pow(0.0001f / vol, (t - delay - attack) / Mathf.Max(0.0001f, dur - attack));
                return Wave(type, FreqPhase(f, f2, t - delay, dur), 1f) * g;
            });
            PlayClip(clip, 1f);
        }

        // 用积分后的相位保证频率滑动正确（exponentialRamp f→f2）
        static float FreqPhase(float f, float? f2, float t, float dur)
        {
            if (!f2.HasValue || dur <= 0) return 2f * Mathf.PI * f * t;
            float k = Mathf.Log(Mathf.Max(1f, f2.Value) / f) / dur;
            return 2f * Mathf.PI * f * (Mathf.Exp(k * t) - 1f) / k;
        }

        static float Wave(WaveType type, float phase, float _ = 0f)
        {
            float p = phase / (2f * Mathf.PI);
            switch (type)
            {
                case WaveType.Sine: return Mathf.Sin(phase);
                case WaveType.Triangle: { var x = 4f * Mathf.Abs(p - Mathf.Floor(p + 0.5f)) - 1f; return x; }
                case WaveType.Square: return Mathf.Sin(phase) >= 0 ? 1f : -1f;
                case WaveType.Sawtooth: return 2f * (p - Mathf.Floor(p + 0.5f));
                default: return 0f;
            }
        }

        /// <summary>noise({dur, vol, delay, fLo, fHi, type})：噪声爆发（带通/低通扫频，Q=0.8；一阶低通近似）。</summary>
        public void Noise(float dur = 0.12f, float vol = 0.08f, float delay = 0f,
            float fLo = 400f, float fHi = 3000f, bool lowpass = false)
        {
            if (_muted || _sfxOff) return;
            string sig = $"n{dur}|{vol}|{delay}|{fLo}|{fHi}|{lowpass}|{_audioRnd.Next()}";   // 噪声每次不同
            var clip = Synth(sig, (int)(44100 * (delay + dur)), (sr, i, t) =>
            {
                if (t < delay || t > delay + dur) return 0f;
                float p = (t - delay) / dur;
                // 频率扫 fHi → fLo（exponentialRamp 到 max(40, fLo)）
                float cutoff = fHi * Mathf.Pow(Mathf.Max(40f, fLo) / fHi, p);
                return 0f;   // 占位：循环内由下方状态机计算
            }, noise: (dur, vol, delay, fLo, fHi, lowpass));
            PlayClip(clip, 1f);
        }

        AudioClip Synth(string sig, int samples, Func<int, int, float, float> f,
            (float dur, float vol, float delay, float fLo, float fHi, bool lowpass)? noise = null)
        {
            if (_synth.TryGetValue(sig, out var cached)) return cached;
            const int Sr = 44100;
            var data = new float[samples];
            if (noise != null)
            {
                var (dur, vol, delay, fLo, fHi, lowpass) = noise.Value;
                float y = 0f;
                for (int i = 0; i < samples; i++)
                {
                    float t = i / (float)Sr;
                    if (t < delay || t > delay + dur) { data[i] = 0f; continue; }
                    float p = (t - delay) / dur;
                    float cutoff = fHi * Mathf.Pow(Mathf.Max(40f, fLo) / fHi, p);
                    float x = (float)(_audioRnd.NextDouble() * 2 - 1);
                    float a = 1f - Mathf.Exp(-2f * Mathf.PI * cutoff / Sr);   // 一阶低通/带通近似
                    if (lowpass) y += a * (x - y);
                    else y = y + a * (x - y);   // 带通：低通差分近似（Q≈0.8 的听感近似）
                    float g = vol * Mathf.Pow(0.0001f / vol, p);              // gain: vol → 0.0001 指数衰减
                    data[i] = lowpass ? y * g : (x - y) * g;
                }
            }
            else
            {
                for (int i = 0; i < samples; i++) data[i] = f(i, i, i / (float)Sr);
            }
            var clip = AudioClip.Create("sdt_" + sig.GetHashCode().ToString("x"), samples, 1, Sr, false);
            clip.SetData(data, 0);
            _synth[sig] = clip;
            return clip;
        }

        /// <summary>把合成 clip 排进 Sfx 池。</summary>
        void PlayClip(AudioClip clip, float gain)
        {
            if (clip == null) return;
            foreach (var s in _sfxPool)
                if (!s.isPlaying)
                {
                    s.volume = Mathf.Clamp01(gain * _sfxGain / BaseSfx * 0.5f);   // SFX 总线基准 2.5 的听感对齐
                    s.clip = clip;
                    s.Play();
                    return;
                }
            _sfxPool[0].PlayOneShot(clip, Mathf.Clamp01(gain * 0.5f));
        }

        // ============================================================
        // 音效表（sound.js SFX 对象逐条照抄；采样缺位时回退这些合成音）
        // ============================================================
        void SynthSfx(string name)
        {
            switch (name)
            {
                case "click": Tone(900f, 640f, WaveType.Triangle, .06f, .035f); break;
                case "hover": Tone(1500f, null, WaveType.Sine, .04f, .05f); break;
                case "switch": Tone(700f, 1050f, WaveType.Square, .05f, .03f); break;
                case "open": Noise(.14f, .028f, 0, 2200, 600); Tone(440f, 660f, WaveType.Sine, .12f, .025f); break;
                case "close": Noise(.13f, .024f, 0, 500, 1800); Tone(620f, 420f, WaveType.Sine, .11f, .02f); break;
                case "error": Tone(190f, null, WaveType.Square, .09f, .045f); Tone(150f, null, WaveType.Square, .13f, .045f, .1f); break;
                case "pick": Noise(.06f, .04f, 0, 800, 2000); Tone(520f, 720f, WaveType.Triangle, .07f, .035f); break;
                case "drop": Noise(.07f, .045f, 0, 400, 1200); Tone(480f, 300f, WaveType.Triangle, .09f, .04f); break;
                case "card": Noise(.13f, .055f, 0, 700, 2600); Tone(520f, 300f, WaveType.Triangle, .1f, .03f); break;
                case "hit": Noise(.12f, .09f, 0, 130, 900, lowpass: true); Tone(150f, 55f, WaveType.Sine, .16f, .1f); break;
                case "hurt": Noise(.16f, .09f, 0, 220, 1300); Tone(220f, 70f, WaveType.Sawtooth, .2f, .05f); break;
                case "curse": Tone(300f, 170f, WaveType.Sawtooth, .18f, .035f); break;
                case "parry": Tone(1250f, 1850f, WaveType.Sine, .12f, .05f); Tone(2600f, null, WaveType.Sine, .07f, .02f, .05f); break;
                case "heal": Tone(520f, 780f, WaveType.Sine, .18f, .04f); Tone(660f, 990f, WaveType.Sine, .2f, .03f, .09f); break;
                case "coin": Tone(1250f, null, WaveType.Triangle, .09f, .045f); Tone(1870f, null, WaveType.Triangle, .14f, .035f, .06f); break;
                case "dice":
                    // 老板留言 #56：多段随机碰撞嗒声（匹配 640ms 翻滚期，末段落定重音）
                {
                    float t = 0f;
                    while (t < .52f)
                    {
                        float step = .035f + (float)_audioRnd.NextDouble() * .05f;
                        Noise(.018f + (float)_audioRnd.NextDouble() * .022f, .022f + (float)_audioRnd.NextDouble() * .03f, t, 1400, 4200);
                        if (_audioRnd.NextDouble() < .4) Tone(2100f + (float)_audioRnd.NextDouble() * 1500f, null, WaveType.Sine, .03f, .012f, t);
                        t += step;
                    }
                    Noise(.05f, .05f, .54f, 700, 2600);
                    Tone(190f, 120f, WaveType.Sine, .09f, .04f, .54f);
                    break;
                }
                case "scene": Noise(.32f, .032f, 0, 280, 1300); break;
                case "flee": Noise(.26f, .04f, 0, 2600, 700); break;
                case "ding": Tone(880f, null, WaveType.Triangle, .12f, .05f); Tone(1318f, null, WaveType.Triangle, .18f, .04f, .09f); break;
                case "victory":
                    { var fs = new[] { 523f, 659f, 784f, 1046f }; for (int i = 0; i < fs.Length; i++) Tone(fs[i], null, WaveType.Triangle, .22f, .05f, i * .12f); break; }
                case "defeat":
                    { var fs = new[] { 392f, 330f, 262f, 196f }; for (int i = 0; i < fs.Length; i++) Tone(fs[i], null, WaveType.Sine, .3f, .05f, i * .14f); break; }
                case "chestShake": Noise(.05f, .06f, 0, 200, 600, lowpass: true); Tone(170f, 120f, WaveType.Triangle, .07f, .05f); break;
                case "chestBurst":
                    Noise(.3f, .12f, 0, 90, 1400, lowpass: true);
                    Tone(90f, 240f, WaveType.Sine, .25f, .09f);
                    Tone(1568f, null, WaveType.Triangle, .2f, .03f, .1f);
                    break;
                case "reveal": Noise(.09f, .045f, 0, 900, 2400); break;
                case "legend":
                {
                    var fs = new[] { 659f, 784f, 988f, 1318f, 1568f };
                    for (int i = 0; i < fs.Length; i++)
                    {
                        Tone(fs[i], null, WaveType.Triangle, .26f, .055f, i * .1f);
                        Tone(fs[i] * 2, null, WaveType.Sine, .2f, .018f, i * .1f + .02f);
                    }
                    break;
                }
            }
        }

        /// <summary>sound.js sfx(name)：采样优先（随机选一），缺位回退合成音；muted/sfxOff 时静默。</summary>
        public void PlaySfx(string key)
        {
            if (_muted || _sfxOff) return;
            if (key != null && _currentCues.TryGetValue(key, out var cue))
            {
                if (cue.silent) return;
                if (cue.clips.Length > 0)
                {
                    var clip = cue.clips[_audioRnd.Next(cue.clips.Length)];
                    foreach (var source in _sfxPool)
                        if (!source.isPlaying)
                        {
                            source.clip = clip;
                            source.pitch = cue.rateMin + (float)_audioRnd.NextDouble() * (cue.rateMax - cue.rateMin);
                            source.volume = Mathf.Clamp01(cue.gain * _sfxVol);
                            source.Play();
                            return;
                        }
                    return;
                }
            }
            if (_samples.TryGetValue(key, out var pool) && pool.Length > 0)
            {
                var clip = pool[_audioRnd.Next(pool.Length)];
                float gain = SampleGain.TryGetValue(key, out var g) ? g : 0.5f;
                foreach (var s in _sfxPool)
                    if (!s.isPlaying)
                    {
                        s.clip = clip;
                        s.volume = Mathf.Clamp01(gain * _sfxVol * 0.5f);
                        s.Play();
                        return;
                    }
                _sfxPool[0].PlayOneShot(clip, Mathf.Clamp01(gain * _sfxVol * 0.5f));
                return;
            }
            try { SynthSfx(key); } catch { /* 静默 */ }
        }

        // ============================================================
        // BGM（sound.js syncBgm/music：双通道，淡入 420ms / 淡出 280ms+300ms 后停）
        // ============================================================
        public void PlayBgm(string mode)
        {
            if (mode == _musicMode) { SyncBgm(); return; }
            _musicMode = string.IsNullOrEmpty(mode) ? null : mode;
            var clip = Res.Res.Music(mode);
            var source = ActiveBgm;
            if (source != null && clip == null)
            {
                source.Stop(); source.clip = null;
                if (!string.IsNullOrEmpty(mode)) Debug.LogWarning("[BGM] 当前配乐未加载：" + mode);
            }
            if (source != null && clip != null && source.clip != clip)
            { source.Stop(); source.clip = clip; }
            SyncBgm();
        }

        AudioSource ActiveBgm => _musicMode == "title" ? _titleBgm : _bgm;

        void SyncBgm()
        {
            bool on = _musicMode != null && !_muted && !_musicOff;
            float target = BaseMusic * _musicVol;
            var cur = ActiveBgm;
            foreach (var track in new[] { _bgm, _titleBgm })
            {
                if (track == null || track.clip == null) continue;
                if (track != cur || !on)
                {
                    if (track.isPlaying) StartFade(track, 0f, 0.28f, stopAfter: 0.30f);
                }
            }
            if (!on || cur == null || cur.clip == null) return;
            if (!cur.isPlaying)
            {
                cur.volume = 0f;
                cur.Play();
                StartFade(cur, target, 0.42f, stopAfter: null);
            }
            else StartFade(cur, target, 0.42f, stopAfter: null);
        }

        // 淡入淡出（Update 驱动；禁协程，禁 Dx 每帧 new）
        sealed class Fade
        {
            public AudioSource src; public float from, to, t, dur, stopAfter;
            public bool stopPending;
        }
        readonly List<Fade> _fades = new List<Fade>();

        void StartFade(AudioSource src, float to, float dur, float? stopAfter)
        {
            for (int i = 0; i < _fades.Count; i++)
                if (_fades[i].src == src) { _fades.RemoveAt(i); break; }
            _fades.Add(new Fade { src = src, from = src.volume, to = to, dur = dur, t = 0f,
                stopAfter = stopAfter ?? 0f, stopPending = stopAfter.HasValue });
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            for (int i = _fades.Count - 1; i >= 0; i--)
            {
                var f = _fades[i];
                f.t += dt;
                float p = f.dur <= 0 ? 1f : Mathf.Clamp01(f.t / f.dur);
                if (f.src != null) f.src.volume = Mathf.Lerp(f.from, f.to, p);
                if (p >= 1f)
                {
                    if (f.stopPending)
                    {
                        f.stopAfter -= dt;
                        if (f.stopAfter <= 0f)
                        {
                            if (f.src != null && (f.src != ActiveBgm || _musicMode == null || _muted || _musicOff)) f.src.Stop();
                            _fades.RemoveAt(i);
                        }
                    }
                    else _fades.RemoveAt(i);
                }
            }
        }

        // ---------- 开关与音量（三级 + 持久化，键名照抄） ----------
        public bool Muted => _muted;
        public string MusicScene => _musicMode;
        public string MusicAsset => ActiveBgm != null && ActiveBgm.clip != null ? ActiveBgm.clip.name : null;
        public bool MusicMuted => _musicOff;
        public bool SfxMuted => _sfxOff;
        public float MusicVolume => _musicVol;
        public float SfxVolume => _sfxVol;

        /// <summary>sound.js setMuted：全局静音。</summary>
        public void Mute(bool m)
        {
            _muted = m;
            Persist("sdt-muted", _muted ? "1" : "0");
            if (!_muted && !_musicOff && _bgm != null && _titleBgm != null) SyncBgm();
            else if (_muted)
            {
                if (_bgm != null) { _bgm.volume = 0f; if (_bgm.isPlaying) _bgm.Pause(); }
                if (_titleBgm != null) { _titleBgm.volume = 0f; if (_titleBgm.isPlaying) _titleBgm.Pause(); }
            }
        }

        /// <summary>sound.js setMusicMuted：只关音乐。</summary>
        public void SetMusicMuted(bool m)
        {
            _musicOff = m;
            Persist("sdt-music-off", _musicOff ? "1" : "0");
            SyncBgm();
        }

        /// <summary>sound.js setSfxMuted：只关音效。</summary>
        public void SetSfxMuted(bool m)
        {
            _sfxOff = m;
            Persist("sdt-sfx-off", _sfxOff ? "1" : "0");
        }

        /// <summary>sound.js setMusicVolume(0~1)：即时生效并持久化。</summary>
        public void SetMusicVolume(float v01)
        {
            _musicVol = Mathf.Clamp01(v01);
            Persist("sdt-music-vol", _musicVol.ToString("0.####"));
            SyncBgm();
        }

        /// <summary>sound.js setSfxVolume(0~1)。</summary>
        public void SetSfxVolume(float v01)
        {
            _sfxVol = Mathf.Clamp01(v01);
            Persist("sdt-sfx-vol", _sfxVol.ToString("0.####"));
            _sfxGain = BaseSfx * _sfxVol;
        }

        /// <summary>sound.js kick：首次交互后恢复播放（Unity 下由引擎自动解锁，这里只重同步 BGM）。</summary>
        public void Kick() => SyncBgm();
    }
}
