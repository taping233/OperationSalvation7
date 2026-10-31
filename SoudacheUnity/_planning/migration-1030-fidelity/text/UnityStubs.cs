namespace UnityEngine
{
    public sealed class TextAsset { public string text; }
    public static class Resources { public static T Load<T>(string path) where T:class { throw new System.InvalidOperationException("Use Configure for this pure presentation check"); } }
    public static class JsonUtility { public static T FromJson<T>(string text) { throw new System.InvalidOperationException("Use Configure for this pure presentation check"); } }
}
