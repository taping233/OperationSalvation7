// sound.js sfxTame: fixed 4500 Hz / -4 dB high shelf (WebAudio's unit shelf slope).
using System;
using System.Threading;

namespace Sdt.Run
{
    internal sealed class CurrentSfxShelfKernel
    {
        const int MaximumChannels = 8;
        sealed class Coefficients
        {
            public readonly double b0, b1, b2, a1, a2;
            public Coefficients(int sampleRate)
            {
                double amplitude = Math.Pow(10, -4.0 / 40);
                double omega = 2 * Math.PI * Math.Min(4500, sampleRate * .499) / sampleRate;
                double cosine = Math.Cos(omega), alpha = Math.Sin(omega) / Math.Sqrt(2);
                double shelf = 2 * Math.Sqrt(amplitude) * alpha;
                double a0 = amplitude + 1 - (amplitude - 1) * cosine + shelf;
                b0 = amplitude * (amplitude + 1 + (amplitude - 1) * cosine + shelf) / a0;
                b1 = -2 * amplitude * (amplitude - 1 + (amplitude + 1) * cosine) / a0;
                b2 = amplitude * (amplitude + 1 + (amplitude - 1) * cosine - shelf) / a0;
                a1 = 2 * (amplitude - 1 - (amplitude + 1) * cosine) / a0;
                a2 = (amplitude + 1 - (amplitude - 1) * cosine - shelf) / a0;
            }
        }

        readonly double[] _first = new double[MaximumChannels], _second = new double[MaximumChannels];
        Coefficients _published, _applied;
        int _reset, _appliedReset, _channels;

        // Configuration and immutable coefficient publication happen on the main thread.
        public void SetSampleRate(int sampleRate)
        {
            if (sampleRate <= 0) throw new ArgumentOutOfRangeException(nameof(sampleRate));
            Volatile.Write(ref _published, new Coefficients(sampleRate));
        }
        public void RequestReset() => Interlocked.Increment(ref _reset);

        // Only the audio thread touches history. No allocation, lock, Unity API or shared mutable coefficients.
        public void Process(float[] data, int channels)
        {
            var coefficients = Volatile.Read(ref _published);
            if (coefficients == null || channels <= 0 || channels > MaximumChannels)
            { Array.Clear(data, 0, data.Length); return; }
            int reset = Volatile.Read(ref _reset);
            if (!ReferenceEquals(coefficients, _applied) || reset != _appliedReset || channels != _channels)
            {
                Array.Clear(_first, 0, MaximumChannels); Array.Clear(_second, 0, MaximumChannels);
                _applied = coefficients; _appliedReset = reset; _channels = channels;
            }
            for (int channel = 0; channel < channels; channel++)
            {
                double first = _first[channel], second = _second[channel];
                for (int index = channel; index < data.Length; index += channels)
                {
                    double input = data[index], output = coefficients.b0 * input + first;
                    first = coefficients.b1 * input - coefficients.a1 * output + second;
                    second = coefficients.b2 * input - coefficients.a2 * output;
                    data[index] = (float)output;
                }
                _first[channel] = Math.Abs(first) < 1e-20 ? 0 : first;
                _second[channel] = Math.Abs(second) < 1e-20 ? 0 : second;
            }
        }
    }
}
