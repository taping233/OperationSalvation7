using System.Collections.Generic;
using UnityEngine;

namespace Sdt.Res
{
    /// <summary>Gallery-only live source assets. Card pixels continue through Res.CardIllustration.</summary>
    public static class CurrentPhotoAssets
    {
        static readonly Dictionary<string, Sprite> Sprites = new Dictionary<string, Sprite>();
        public static Sprite Get(string key, bool sliced = false)
        {
            var cacheKey = key + (sliced ? "/slice" : "");
            if (Sprites.TryGetValue(cacheKey, out var existing)) return existing;
            var texture = Resources.Load<Texture2D>("Art/CurrentPhoto/" + key);
            if (texture == null) return null;
            float border = key == "frame-atelier-v1" ? 170 : 48;
            var sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(.5f, .5f),
                100, 0, SpriteMeshType.FullRect, sliced ? new Vector4(border, border, border, border) : Vector4.zero);
            Sprites[cacheKey] = sprite;
            return sprite;
        }
    }
}
