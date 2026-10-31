// Resources 资源入口；现行映射由 migration-1029/ui/sync_assets.py 从 Vite 同步。
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Sdt.Res
{
    /// <summary>按契约 §7 的 Resources 路径表集中加载。加载失败返回 null 并只告警一次。</summary>
    public static class Res
    {
        static string CharacterId(string value) => value != null && CurrentAssets.CharacterIds.TryGetValue(value, out var id) ? id : value;
        static Sprite Mapped(IReadOnlyDictionary<string, string> map, string key)
        {
            if (!string.IsNullOrEmpty(key) && map.TryGetValue(key, out var path)) return Sprite(path);
            return null;
        }
        public static System.Func<string, string> SelectedSkin;
        public static Sprite Portrait(string id)
        {
            var character = CharacterId(id);
            return SkinPortrait(character, SelectedSkin?.Invoke(character) ?? "default");
        }
        public static Sprite SkinPortrait(string id, string skinId)
        {
            var character = CharacterId(id);
            if (skinId != "default" && CurrentAssets.Skins.TryGetValue(character + "/" + skinId, out var path)) return Sprite(path);
            return Mapped(CurrentAssets.Portraits, character);
        }
        public static Sprite BattlePortrait(string id) => Mapped(CurrentAssets.BattlePortraits, CharacterId(id)) ?? Portrait(id);
        public static Sprite Avatar(string id) => Mapped(CurrentAssets.Avatars, CharacterId(id)) ?? Portrait(id);
        public static Sprite EnemyPortrait(string id) => Mapped(CurrentAssets.EnemyPortraits, id);
        public static Sprite Scene(string key) => Mapped(CurrentAssets.Scenes, key);
        public static Sprite BattleLayer(string key) => Mapped(CurrentAssets.BattleLayers, key);
        public static Sprite BattleControl(string key) => Mapped(CurrentAssets.BattleControls, key);
        public static Sprite Card(string key) => Mapped(CurrentAssets.CardFamilies, key);
        public static Sprite CardBack(string key = "classic") => Mapped(CurrentAssets.CardBacks, key);
        public static Sprite CardFrame(string key) => Mapped(CurrentAssets.CardFrames, key);
        public static Sprite CardIllustration(string id, string art, string type, string name, bool low = false)
        {
            if (low)
            {
                var thumbnail = Mapped(CurrentThumbnails.Paths, id);
                if (thumbnail != null) return thumbnail;
            }
            var illustration = Mapped(CurrentAssets.CardIllustrations, id);
            if (illustration != null) return illustration;
            if (type == "生物" && !string.IsNullOrEmpty(art)) return EnemyPortrait(art);
            name = name ?? "";
            string family;
            switch (type)
            {
                case "能力卡": case "英雄卡": family = "hero"; break;
                case "武术": family = Regex.IsMatch(name, "箭|射|弓") ? "martial-ranged" : "martial-melee"; break;
                case "法术": family = Regex.IsMatch(name, "治|愈|疗|回复") ? "healing" : "spell"; break;
                case "装备": family = Regex.IsMatch(name, "甲|盾|堡垒|龟") ? "equipment-armor"
                    : Regex.IsMatch(name, "剑|刃|刀|弓|箭|杖") ? "equipment-weapon" : "equipment-utility"; break;
                case "资源": family = name.Contains("钥匙") ? "resource-key"
                    : Regex.IsMatch(name, "币|钻石|令牌|水晶|弹珠") ? "resource-valuables" : "resource-material"; break;
                case "道具": family = Regex.IsMatch(name, "药|绷带|医疗|急救|合剂|治伤") ? "healing" : "consumable"; break;
                case "事件": family = "event"; break;
                default: family = "unknown"; break;
            }
            return Card(family);
        }
        public static Sprite MapArt(string key) => Mapped(CurrentAssets.MapArt, key);
        public static Sprite HomeIcon(string key) => Mapped(CurrentAssets.HomeIcons, key);
        public static Sprite HubIcon(string key) => Mapped(CurrentUiIcons.HubPaths, key);
        static string NodeArtKey(string key)
        {
            switch (key)
            {
                case "boss": case "elite": case "battleElite": key = "battle"; break;
                case "entrance": case "emergencyExit": case "extraction": key = "door"; break;
            }
            return key;
        }
        public static Rect NodeArtBounds(string key)
        {
            key = NodeArtKey(key);
            return key != null && CurrentAssets.NodeBounds.TryGetValue(key, out var bounds)
                ? new Rect(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]) : new Rect(0, 0, 128, 128);
        }
        public static Sprite NodeIcon(string key)
        {
            key = NodeArtKey(key);
            if (key == null || !CurrentAssets.NodeIcons.TryGetValue(key, out var path)) return null;
            string cacheKey = "node-source-pivot:" + key;
            if (_sprites.TryGetValue(cacheKey, out var cached) && cached != null) return cached;
            var original = Sprite(path);
            if (original == null || !CurrentAssets.NodeBounds.TryGetValue(key, out var bounds)) return original;
            var centered = UnityEngine.Sprite.Create(original.texture,
                new Rect(0, 0, original.texture.width, original.texture.height),
                new Vector2((bounds[0] + bounds[2]) * .5f / original.texture.width, 1 - (bounds[1] + bounds[3]) * .5f / original.texture.height), 100f);
            centered.name = path;
            _sprites[cacheKey] = centered;
            return centered;
        }
        public static Sprite Ui(string name)
        {
            if (name == null || !CurrentUiIcons.Paths.TryGetValue(name, out var path))
            {
                WarnOnce("current-ui-icon:" + name);
                path = CurrentUiIcons.Paths["question"];
            }
            var icon = Sprite(path);
            if (name != "altar" || icon == null) return icon;
            const string cacheKey = "ui-altar-source-clip";
            if (_sprites.TryGetValue(cacheKey, out var cached) && cached != null) return cached;
            // Exact visible source region of icons-bitmap.js' altar span (171.3%, -37.1%, -39.6%).
            float width = icon.texture.width / 1.713f, height = icon.texture.height / 1.713f;
            var clipped = UnityEngine.Sprite.Create(icon.texture, new Rect(width * .371f, icon.texture.height - height * 1.396f, width, height), new Vector2(.5f, .5f), 100f);
            clipped.name = path;
            _sprites[cacheKey] = clipped;
            return clipped;
        }
        public static Sprite HubArt(string key) => Mapped(CurrentAssets.Hub, key);

        public static AudioClip Music(string key) => key != null && CurrentAssets.Music.TryGetValue(key, out var path) ? Load<AudioClip>(path) : null;
        public static AudioClip AudioPath(string path) => string.IsNullOrEmpty(path) ? null : Load<AudioClip>(path);
        public static TextAsset CurrentAudioCues => Load<TextAsset>("Data/CurrentAudioCues");

        public static TextAsset NarrativeJson => Load<TextAsset>("Data/NarrativeEvents");

        static Font _mono, _sans, _monoBold, _sansBold;
        public static Font Mono => _mono != null ? _mono : (_mono = Load<Font>("Fonts/cascadia-code-400"));
        public static Font MonoBold => _monoBold != null ? _monoBold : (_monoBold = Load<Font>("Fonts/cascadia-code-700"));
        public static Font Sans => _sans != null ? _sans : (_sans = Load<Font>("Fonts/HarmonyOS_Sans_SC_Regular"));
        public static Font SansBold => _sansBold != null ? _sansBold : (_sansBold = Load<Font>("Fonts/HarmonyOS_Sans_SC_Bold"));
        public static Font Number => Load<Font>("Fonts/oxanium-latin-500-normal");
        public static Font NumberBold => Load<Font>("Fonts/oxanium-latin-700-normal");
        public static Font Label => Load<Font>("Fonts/rajdhani-latin-600-normal");
        public static Font LabelBold => Load<Font>("Fonts/rajdhani-latin-700-normal");
        public static Font NotoSans => Load<Font>("Fonts/notosans-sc-400");
        public static Font NotoSansBold => Load<Font>("Fonts/notosans-sc-700");

        static Sprite Sprite(string path)
        {
            if (string.IsNullOrEmpty(path)) return null;
            if (_sprites.TryGetValue(path, out var cached) && cached != null) return cached;
            var s = Resources.Load<Sprite>(path);
            if (s == null)
            {
                // 资源以 Default 纹理导入（非 Sprite 类型，dump 批量入库的 png/jpg 均如此）时
                // Resources.Load<Sprite> 因类型不符返回 null——这里 Load<Texture2D> 后手工包一层 Sprite
                var tex = Resources.Load<Texture2D>(path);
                if (tex != null)
                {
                    s = UnityEngine.Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
                    s.name = path;
                }
                else WarnOnce(path);
            }
            if (s != null) _sprites[path] = s;
            return s;
        }

        static T Load<T>(string path) where T : Object
        {
            var a = Resources.Load<T>(path);
            if (a == null) WarnOnce(path);
            return a;
        }

        static void WarnOnce(string path)
        {
            if (_warned.Contains(path)) return;
            _warned.Add(path);
            Debug.LogWarning("[Res] 资源缺失(继续用 null 兜底): " + path);
        }

        static readonly System.Collections.Generic.HashSet<string> _warned = new System.Collections.Generic.HashSet<string>();
        static readonly Dictionary<string, Sprite> _sprites = new Dictionary<string, Sprite>();
    }
}
