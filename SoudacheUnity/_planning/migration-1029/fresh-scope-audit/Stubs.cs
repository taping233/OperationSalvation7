using System;
using System.IO;
namespace UnityEngine {
 public static class Application { public static string persistentDataPath => Path.GetTempPath(); }
 public static class Debug { public static void LogException(Exception exception) { Console.WriteLine("listener-error: " + exception); } }
 public sealed class TextAsset { public string text; }
 public static class Resources { public static T Load<T>(string name) where T:class => new TextAsset { text=File.ReadAllText(Path.Combine(Environment.CurrentDirectory,"Assets/Resources",name+".json")) } as T; }
}
namespace Sdt.Run { public sealed class AudioService { public static AudioService I {get;}=new AudioService(); public void PlaySfx(string key){} public void PlayBgm(string key){} } }
