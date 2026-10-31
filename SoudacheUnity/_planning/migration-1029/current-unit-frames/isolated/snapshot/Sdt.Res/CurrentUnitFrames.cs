// Current battle.frames.js fixed-canvas catalogs. Exported source pixels, never legacy battle art.
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Sdt.Res
{
    public static class CurrentUnitFrames
    {
        [Serializable] sealed class Manifest { public int version; public UnitFrameCatalog[] roles; }
        static readonly Dictionary<string, UnitFrameCatalog> Catalogs = new Dictionary<string, UnitFrameCatalog>();
        static readonly Dictionary<string, FrameSet> Sets = new Dictionary<string, FrameSet>();
        sealed class FrameSet
        {
            public int Owners;
            public readonly Dictionary<string, Sprite> Sprites = new Dictionary<string, Sprite>();
            public readonly HashSet<string> Missing = new HashSet<string>();
        }
        static bool _loaded;
        public static UnitFrameCatalog Find(string role)
        {
            if (role != null && CurrentAssets.CharacterIds.TryGetValue(role, out var id)) role = id;
            if (!_loaded)
            {
                _loaded = true;
                var json = Resources.Load<TextAsset>("Data/CurrentUnitFrames");
                if (json == null) { Debug.LogWarning("Missing current unit frame manifest"); return null; }
                var manifest = JsonUtility.FromJson<Manifest>(json.text);
                if (manifest?.roles != null) foreach (var catalog in manifest.roles) Catalogs[catalog.id] = catalog;
            }
            return role != null && Catalogs.TryGetValue(role, out var value) ? value : null;
        }

        // One lease per mounted actor; redraws retain their lease. Each acquired frame is decoded once.
        // Closing/replacing the actor destroys created sprites and unloads only this private path's textures.
        public sealed class Lease : IDisposable
        {
            readonly FrameSet _set;
            public UnitFrameCatalog Catalog { get; }
            bool _disposed;
            internal Lease(UnitFrameCatalog catalog)
            {
                Catalog = catalog;
                if (!Sets.TryGetValue(catalog.id, out _set)) Sets[catalog.id] = _set = new FrameSet();
                _set.Owners++;
            }
            public Sprite Frame(string name)
            {
                if (_disposed || string.IsNullOrEmpty(name) || _set.Missing.Contains(name)) return null;
                if (_set.Sprites.TryGetValue(name, out var sprite)) return sprite;
                var path = "Art/Current/portraits/frames/" + Catalog.id + "/" + name;
                var texture = Resources.Load<Texture2D>(path);
                if (texture == null || texture.width != Catalog.width || texture.height != Catalog.height)
                {
                    _set.Missing.Add(name); Debug.LogWarning("Missing/incorrect current unit frame: " + path); return null;
                }
                sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(.5f, 0), 100);
                sprite.name = Catalog.id + "/" + name;
                _set.Sprites[name] = sprite;
                return sprite;
            }
            public void Dispose()
            {
                if (_disposed) return; _disposed = true;
                if (--_set.Owners > 0) return;
                foreach (var sprite in _set.Sprites.Values)
                {
                    var texture = sprite.texture;
                    UnityEngine.Object.Destroy(sprite);
                    Resources.UnloadAsset(texture);
                }
                _set.Sprites.Clear(); _set.Missing.Clear(); Sets.Remove(Catalog.id);
            }
        }
        public static Lease Acquire(string role)
        {
            var catalog = Find(role);
            return catalog == null ? null : new Lease(catalog);
        }
    }
}
