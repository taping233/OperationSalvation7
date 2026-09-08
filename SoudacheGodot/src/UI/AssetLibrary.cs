using Godot;

namespace SoudacheGodot.UI;

/// Local, project-owned art references. Missing art degrades to a plain panel so
/// headless UI smoke remains useful while preserving a single provenance list.
public static class AssetLibrary
{
    public const string Title = "res://assets/backgrounds/title-hero-ascension.webp";
    public const string Board = "res://assets/backgrounds/board-backdrop-wreck.webp";
    public const string Hub = "res://assets/backgrounds/hub-bg-rhine.png";
    public const string MapBack = "res://assets/map/map-bg.png";
    public const string MapMid = "res://assets/map/map-mid.png";
    public const string MapFront = "res://assets/map/map-fg.png";
    public const string Battle = "res://assets/battle/battle-art-v2.png";

    public static readonly string[] CorePortraits =
    {
        "res://assets/portraits/shuangling.png", "res://assets/portraits/baiqi.png",
        "res://assets/portraits/lituan.png", "res://assets/portraits/xuanli.png",
        "res://assets/portraits/dengkui.png"
    };

    public static TextureRect Background(Control parent, string path, float opacity = 0.72f)
    {
        var image = new TextureRect { Texture = GD.Load<Texture2D>(path), MouseFilter = Control.MouseFilterEnum.Ignore, Modulate = new Color(1, 1, 1, opacity), ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize, StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered };
        image.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        parent.AddChild(image);
        parent.MoveChild(image, 0);
        return image;
    }

    public static TextureRect Thumbnail(Control parent, string path, Vector2 size)
    {
        var image = new TextureRect { Texture = GD.Load<Texture2D>(path), CustomMinimumSize = size, MouseFilter = Control.MouseFilterEnum.Ignore, ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize, StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered };
        parent.AddChild(image);
        return image;
    }

    public static string MapIcon(string type) => type.ToLowerInvariant() switch
    {
        "battle" or "combat" => "res://assets/icons/battle.svg",
        "boss" => "res://assets/icons/boss.svg",
        "chest" => "res://assets/icons/chest.svg",
        "event" => "res://assets/icons/event.svg",
        "door" => "res://assets/icons/door.svg",
        "campfire" => "res://assets/icons/fire.svg",
        "altar" or "altarentrance" => "res://assets/icons/altar.svg",
        "shop" => "res://assets/icons/shop.svg",
        "entrance" => "res://assets/icons/entrance.svg",
        _ => "res://assets/icons/entrance.svg"
    };

    public static string CharacterPortrait(string characterId) => characterId.ToLowerInvariant() switch
    {
        "baiqi" => CorePortraits[1], "assassin" or "lituan" => CorePortraits[2],
        "guard" or "xuanli" => CorePortraits[3], "mage" or "dengkui" => CorePortraits[4],
        _ => CorePortraits[0]
    };
}
