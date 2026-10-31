using UnityEngine;

namespace Sdt.Run
{
    // A linear shelf per native voice commutes with summing; compression stays on the shared SFX mixer.
    public sealed class CurrentSfxHighShelf : MonoBehaviour
    {
        readonly CurrentSfxShelfKernel _kernel = new CurrentSfxShelfKernel();
        public void Configure(int sampleRate) => _kernel.SetSampleRate(sampleRate);
        public void ResetForPlayback() => _kernel.RequestReset();
        void OnAudioFilterRead(float[] data, int channels) => _kernel.Process(data, channels);
    }
}
