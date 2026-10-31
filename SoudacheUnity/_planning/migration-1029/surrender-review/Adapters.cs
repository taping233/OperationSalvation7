using System;
using System.Collections.Generic;
using System.IO;
using Sdt.Core.Battle;
using Sdt.Run;

// Headless adapters intentionally do not emulate the native Unity event loop, hit testing or scene UI.
namespace UnityEngine
{
    public class MonoBehaviour { }
    public static class Time { public static float unscaledTime; }
    public static class Application { public static string persistentDataPath => Path.GetTempPath(); }
    public static class Debug { public static void LogException(Exception exception) { throw new InvalidOperationException("Unexpected listener error", exception); } }
    public sealed class TextAsset { public string text; }
    public static class Resources
    {
        public static T Load<T>(string name) where T : class => new TextAsset { text = File.ReadAllText(Path.Combine(Environment.CurrentDirectory, "Assets/Resources", name + ".json")) } as T;
    }
    public struct Color
    {
        public float r, g, b, a;
        public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public override bool Equals(object value) => value is Color other && r == other.r && g == other.g && b == other.b && a == other.a;
        public override int GetHashCode() => HashCode.Combine(r, g, b, a);
        public static bool operator ==(Color left, Color right) => left.Equals(right);
        public static bool operator !=(Color left, Color right) => !left.Equals(right);
    }
    public struct Color32
    {
        readonly byte r, g, b, a;
        public Color32(byte r, byte g, byte b, byte a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public static implicit operator Color(Color32 c) => new Color(c.r / 255f, c.g / 255f, c.b / 255f, c.a / 255f);
    }
}
namespace UnityEngine.UI
{
    public sealed class Text { public string text = "撤退"; public UnityEngine.Color color = new UnityEngine.Color(1, 1, 1, 1); }
    public sealed class Image { public UnityEngine.Color color = new UnityEngine.Color(0, 0, 0, 1); }
    public sealed class Button
    {
        public sealed class ClickEvent { event Action Click; public void AddListener(Action click) { Click += click; } public void Invoke() { Click?.Invoke(); } }
        public readonly ClickEvent onClick = new ClickEvent();
        public readonly Text Label = new Text(); public readonly Image Background = new Image();
        public T GetComponentInChildren<T>() where T : class => Label as T;
        public T GetComponent<T>() where T : class => Background as T;
    }
}
namespace Sdt.Run
{
    public sealed class AudioService
    {
        public static AudioService I { get; } = new AudioService();
        public readonly List<string> Effects = new List<string>();
        public void PlaySfx(string key) { Effects.Add(key); }
        public void PlayBgm(string key) { }
    }
}
namespace Sdt.UI.Kit { public static class HeadlessMarker { } }
namespace Sdt.UI.Screens.Run { public static class RunLog { public static void Log(string text, string kind = null) { } } }
namespace Sdt.UI.Screens.Battle
{
    public static class BtColors { public static UnityEngine.Color Dim = new UnityEngine.Color(.5f, .5f, .5f, 1); }
    public static class BattleEvents { public static Action RetrySettlement; public static void Raise(BattleSnapshot snapshot) { } }
}
namespace Sdt.Boot
{
    public static class BattleViewApi { public static BattleSession Session; }
    public static class BattleBridge
    {
        public static bool _battleOpen;
        public static int Closed, RewardCalls;
        public static void CloseBattlePanels() { Closed++; }
        public static void ResumeRewards(GameRuntime game) { RewardCalls++; }
    }
}
