// Home-only resource boundary. Sources and hashes: _planning/migration-1029/current-home/source-receipt.json.
using System.Collections.Generic;
using UnityEngine;

namespace Sdt.Res
{
    public static class CurrentHomeAssets
    {
        public const string PreferenceKey = "sdt-title-wallpaper";
        public const string DefaultWallpaper = "wu-bass";
        public const string Version = "v0.8.0";
        public static readonly string[] Wallpapers = {
            "snow-road", "baita-heixiang", "xingyue-piano", "wu-bass",
            "baita-station", "xingyue-reeds", "companions-dinner"
        };
        static readonly Dictionary<string, Sprite> Cache = new Dictionary<string, Sprite>();

        public static Sprite Load(string key)
        {
            if (Cache.TryGetValue(key, out var sprite) && sprite != null) return sprite;
            string path = "Art/CurrentHome/" + key;
            sprite = Resources.Load<Sprite>(path);
            if (sprite == null)
            {
                var texture = Resources.Load<Texture2D>(path);
                if (texture != null)
                    sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(.5f, .5f), 100);
            }
            if (sprite == null) Debug.LogError("[CurrentHomeAssets] Missing current source asset: " + path);
            else { sprite.name = path; Cache[key] = sprite; }
            return sprite;
        }
    }
}
