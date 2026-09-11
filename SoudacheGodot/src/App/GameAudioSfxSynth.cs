using Godot;
using System;

namespace SoudacheGodot.App;

/// <summary>
/// Runtime equivalent of the WebAudio-synthesized SFX in sound.js (tone/noise,
/// sound.js:200-277). Each key renders a short 16-bit mono PCM clip at 44.1 kHz
/// from the same segment table as the web SFX table (waveform, exponential
/// frequency sweep, duration, volume, delay, exponential envelope), so keys
/// without a sample file keep their exact sound semantics as the last-resort
/// fallback. "dice" re-renders on every call: the web version randomizes the
/// tumble sequence on purpose (boss note #56).
/// </summary>
public static class GameAudioSfxSynth
{
    private const int MixRate = 44100;
    private const double Epsilon = 0.0001; // sound.js exponential envelope floor

    private readonly record struct ToneSeg(
        double F, double? F2, string Wave, double Dur, double Vol, double Delay = 0, double Attack = 0.006);

    // FLo/FHi keep the web naming: the filter sweeps from FHi (start) to FLo (end).
    private readonly record struct NoiseSeg(
        double Dur, double Vol, double FLo, double FHi, string Type = "bandpass", double Delay = 0);

    public static AudioStreamWav Render(string key, Random rng) =>
        key == "dice" ? RenderDice(rng) : RenderSegments(BuildSegments(key), rng);

    private static (ToneSeg[] Tones, NoiseSeg[] Noises) BuildSegments(string key) => key switch
    {
        // Ported from sound.js SFX table (sound.js:237-277); comments keep the original params.
        "open" => (
            new[] { new ToneSeg(440, 660, "sine", .12, .025) },
            new[] { new NoiseSeg(.14, .028, 2200, 600) }),
        "close" => (
            new[] { new ToneSeg(620, 420, "sine", .11, .02) },
            new[] { new NoiseSeg(.13, .024, 500, 1800) }),
        "error" => (
            new[] { new ToneSeg(190, null, "square", .09, .045), new ToneSeg(150, null, "square", .13, .045, .1) },
            Array.Empty<NoiseSeg>()),
        "pick" => (
            new[] { new ToneSeg(520, 720, "triangle", .07, .035) },
            new[] { new NoiseSeg(.06, .04, 800, 2000) }),
        "drop" => (
            new[] { new ToneSeg(480, 300, "triangle", .09, .04) },
            new[] { new NoiseSeg(.07, .045, 400, 1200) }),
        "card" => (
            new[] { new ToneSeg(520, 300, "triangle", .1, .03) },
            new[] { new NoiseSeg(.13, .055, 700, 2600) }),
        "hit" => (
            new[] { new ToneSeg(150, 55, "sine", .16, .1) },
            new[] { new NoiseSeg(.12, .09, 130, 900, "lowpass") }),
        "hurt" => (
            new[] { new ToneSeg(220, 70, "sawtooth", .2, .05) },
            new[] { new NoiseSeg(.16, .09, 220, 1300) }),
        "curse" => (
            new[] { new ToneSeg(300, 170, "sawtooth", .18, .035) },
            Array.Empty<NoiseSeg>()),
        "parry" => (
            new[] { new ToneSeg(1250, 1850, "sine", .12, .05), new ToneSeg(2600, null, "sine", .07, .02, .05) },
            Array.Empty<NoiseSeg>()),
        "heal" => (
            new[] { new ToneSeg(520, 780, "sine", .18, .04), new ToneSeg(660, 990, "sine", .2, .03, .09) },
            Array.Empty<NoiseSeg>()),
        "coin" => (
            new[] { new ToneSeg(1250, null, "triangle", .09, .045), new ToneSeg(1870, null, "triangle", .14, .035, .06) },
            Array.Empty<NoiseSeg>()),
        "scene" => (
            Array.Empty<ToneSeg>(),
            new[] { new NoiseSeg(.32, .032, 280, 1300) }),
        "flee" => (
            Array.Empty<ToneSeg>(),
            new[] { new NoiseSeg(.26, .04, 2600, 700) }),
        "ding" => (
            new[] { new ToneSeg(880, null, "triangle", .12, .05), new ToneSeg(1318, null, "triangle", .18, .04, .09) },
            Array.Empty<NoiseSeg>()),
        "victory" => (
            new[] { new ToneSeg(523, null, "triangle", .22, .05, 0), new ToneSeg(659, null, "triangle", .22, .05, .12),
                    new ToneSeg(784, null, "triangle", .22, .05, .24), new ToneSeg(1046, null, "triangle", .22, .05, .36) },
            Array.Empty<NoiseSeg>()),
        "defeat" => (
            new[] { new ToneSeg(392, null, "sine", .3, .05, 0), new ToneSeg(330, null, "sine", .3, .05, .14),
                    new ToneSeg(262, null, "sine", .3, .05, .28), new ToneSeg(196, null, "sine", .3, .05, .42) },
            Array.Empty<NoiseSeg>()),
        "chestShake" => (
            new[] { new ToneSeg(170, 120, "triangle", .07, .05) },
            new[] { new NoiseSeg(.05, .06, 200, 600, "lowpass") }),
        "chestBurst" => (
            new[] { new ToneSeg(90, 240, "sine", .25, .09), new ToneSeg(1568, null, "triangle", .2, .03, .1) },
            new[] { new NoiseSeg(.3, .12, 90, 1400, "lowpass") }),
        "reveal" => (
            Array.Empty<ToneSeg>(),
            new[] { new NoiseSeg(.09, .045, 900, 2400) }),
        "legend" => (
            new[] { new ToneSeg(659, null, "triangle", .26, .055, 0), new ToneSeg(1318, null, "sine", .2, .018, .02),
                    new ToneSeg(784, null, "triangle", .26, .055, .1), new ToneSeg(1568, null, "sine", .2, .018, .12),
                    new ToneSeg(988, null, "triangle", .26, .055, .2), new ToneSeg(1976, null, "sine", .2, .018, .22),
                    new ToneSeg(1318, null, "triangle", .26, .055, .3), new ToneSeg(2636, null, "sine", .2, .018, .32),
                    new ToneSeg(1568, null, "triangle", .26, .055, .4), new ToneSeg(3136, null, "sine", .2, .018, .42) },
            Array.Empty<NoiseSeg>()),
        _ => (Array.Empty<ToneSeg>(), Array.Empty<NoiseSeg>()),
    };

    // sound.js:249-260 — randomized tumble collisions for ~520 ms, landing thud at 540 ms.
    private static AudioStreamWav RenderDice(Random rng)
    {
        var tones = new System.Collections.Generic.List<ToneSeg>();
        var noises = new System.Collections.Generic.List<NoiseSeg>();
        double t = 0;
        while (t < .52)
        {
            double step = .035 + rng.NextDouble() * .05;
            noises.Add(new NoiseSeg(.018 + rng.NextDouble() * .022, .022 + rng.NextDouble() * .03, 1400, 4200, "bandpass", t));
            if (rng.NextDouble() < .4)
                tones.Add(new ToneSeg(2100 + rng.NextDouble() * 1500, null, "sine", .03, .012, t));
            t += step;
        }
        noises.Add(new NoiseSeg(.05, .05, 700, 2600, "bandpass", .54));
        tones.Add(new ToneSeg(190, 120, "sine", .09, .04, .54));
        return RenderSegments((tones.ToArray(), noises.ToArray()), rng);
    }

    private static AudioStreamWav RenderSegments((ToneSeg[] Tones, NoiseSeg[] Noises) segments, Random rng)
    {
        double length = 0;
        foreach (var t in segments.Tones) length = Math.Max(length, t.Delay + t.Dur);
        foreach (var n in segments.Noises) length = Math.Max(length, n.Delay + n.Dur);
        var buffer = new float[(int)Math.Ceiling(length * MixRate) + 1];
        foreach (var t in segments.Tones) AddTone(buffer, t);
        foreach (var n in segments.Noises) AddNoise(buffer, n, rng);
        return ToWav(buffer);
    }

    private static void AddTone(float[] buffer, ToneSeg seg)
    {
        int start = (int)(seg.Delay * MixRate);
        int durSamples = Math.Max(1, (int)(seg.Dur * MixRate));
        int attackSamples = Math.Max(1, (int)(seg.Attack * MixRate));
        double phase = 0;
        double omega = 2.0 * Math.PI / MixRate;
        for (int i = 0; i < durSamples; i++)
        {
            double t = (double)i / durSamples;
            // exponentialRampToValueAtTime: f(t) = f * (f2/f)^(t/dur)
            double f = seg.F2.HasValue ? seg.F * Math.Pow(seg.F2.Value / seg.F, t) : seg.F;
            phase += omega * f;
            double env;
            if (i < attackSamples)
                env = Epsilon * Math.Pow(seg.Vol / Epsilon, (double)i / attackSamples);
            else
                env = seg.Vol * Math.Pow(Epsilon / seg.Vol, (double)(i - attackSamples) / (durSamples - attackSamples));
            int idx = start + i;
            if (idx < buffer.Length) buffer[idx] += (float)(Osc(seg.Wave, phase) * env);
        }
    }

    private static void AddNoise(float[] buffer, NoiseSeg seg, Random rng)
    {
        int start = (int)(seg.Delay * MixRate);
        int durSamples = Math.Max(1, (int)(seg.Dur * MixRate));
        const double q = 0.8;
        double fLoEff = Math.Max(40, seg.FLo);
        double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (int i = 0; i < durSamples; i++)
        {
            double t = (double)i / durSamples;
            double fc = seg.FHi * Math.Pow(fLoEff / seg.FHi, t);
            double w0 = 2.0 * Math.PI * fc / MixRate;
            double alpha = Math.Sin(w0) / (2 * q);
            double cosW = Math.Cos(w0);
            double a0 = 1 + alpha, a1 = -2 * cosW, a2 = 1 - alpha;
            double b0, b1, b2;
            if (seg.Type == "lowpass")
            {
                b0 = (1 - cosW) / 2; b1 = 1 - cosW; b2 = (1 - cosW) / 2;
            }
            else
            {
                // WebAudio bandpass (constant 0 dB peak gain)
                b0 = alpha; b1 = 0; b2 = -alpha;
            }
            double x = rng.NextDouble() * 2 - 1;
            double y = b0 / a0 * x + b1 / a0 * x1 + b2 / a0 * x2 - a1 / a0 * y1 - a2 / a0 * y2;
            x2 = x1; x1 = x; y2 = y1; y1 = y;
            double env = seg.Vol * Math.Pow(Epsilon / seg.Vol, t);
            int idx = start + i;
            if (idx < buffer.Length) buffer[idx] += (float)(y * env);
        }
    }

    private static double Osc(string wave, double phase)
    {
        double s = Math.Sin(phase);
        return wave switch
        {
            "square" => s >= 0 ? 1.0 : -1.0,
            "triangle" => 2.0 / Math.PI * Math.Asin(s),
            "sawtooth" => 2.0 * (phase / (2 * Math.PI) - Math.Floor(phase / (2 * Math.PI) + 0.5)),
            _ => s,
        };
    }

    private static AudioStreamWav ToWav(float[] buffer)
    {
        var data = new byte[buffer.Length * 2];
        for (int i = 0; i < buffer.Length; i++)
        {
            short sample = (short)Math.Clamp((int)Math.Round(buffer[i] * 32767.0), short.MinValue, short.MaxValue);
            data[i * 2] = (byte)(sample & 0xFF);
            data[i * 2 + 1] = (byte)((sample >> 8) & 0xFF);
        }
        return new AudioStreamWav
        {
            Format = AudioStreamWav.FormatEnum.Format16Bits,
            MixRate = MixRate,
            Stereo = false,
            Data = data,
        };
    }
}
