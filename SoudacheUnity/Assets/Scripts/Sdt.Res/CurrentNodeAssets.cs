// Exported current node imagery and event-encounter-text.js results; roster views are source-owned.
using System;
using System.Collections.Generic;
using UnityEngine;
namespace Sdt.Res
{
    public static class CurrentNodeAssets
    {
        [Serializable] public sealed class Scene { public string key,source,resource; }
        [Serializable] public sealed class Encounter { public string id,role,name,intro; }
        [Serializable] public sealed class EventScene { public string id,asset; }
        [Serializable] sealed class Manifest { public Scene[] scenes; public Encounter[] encounters; public EventScene[] events; }
        static Manifest _data;
        static readonly Dictionary<string,Sprite> Sprites=new Dictionary<string,Sprite>();
        static Manifest Data {get{if(_data==null){var text=Resources.Load<TextAsset>("Data/CurrentNodeRooms");_data=text==null?new Manifest():JsonUtility.FromJson<Manifest>(text.text);}return _data;}}
        static Sprite Art(string path)
        {
            if(Sprites.TryGetValue(path,out var sprite)&&sprite!=null)return sprite;
            var texture=Resources.Load<Texture2D>(path);if(texture==null)return null;
            sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),100);sprite.name=path;Sprites[path]=sprite;return sprite;
        }
        public static Sprite Background(string key)
        {if(Data.scenes!=null)foreach(var scene in Data.scenes)if(scene.key==key)return Art(scene.resource);return Res.Scene(key);}
        public static Sprite Outcome(string kind)=>Art("Art/Current/node-rooms/outcome/"+(kind=="heal"?"recovery-v2":"restoration-v2"));
        public static Sprite Choice=>Art("Art/Current/node-rooms/choice-winter-v1");
        public static Sprite Ghost(string kind)=>Art("Art/Current/node-rooms/ghosts/"+kind);
        public static Encounter EncounterText(string id,string role)
        {
            if(role!=null&&CurrentAssets.CharacterIds.TryGetValue(role,out var mapped))role=mapped;
            if(Data.encounters!=null)foreach(var entry in Data.encounters)if(entry.id==id&&entry.role==role)return entry;
            return new Encounter{intro=""};
        }
        public static string EventAsset(string id)
        {if(Data.events!=null)foreach(var entry in Data.events)if(entry.id==id)return entry.asset;return "scene-event-custom-a";}
    }
}
