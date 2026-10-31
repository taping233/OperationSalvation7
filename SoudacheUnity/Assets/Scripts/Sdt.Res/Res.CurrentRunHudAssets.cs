// Original map-tools-1021/*-v2.webp pixels, losslessly decoded for Unity's native texture importer.
using System.Collections.Generic;
using UnityEngine;
namespace Sdt.Res
{
    public static class CurrentRunHudAssets
    {
        static readonly Dictionary<string,Sprite> Cache=new Dictionary<string,Sprite>();
        public static Sprite Tool(string name)
        {
            if(Cache.TryGetValue(name,out var sprite)&&sprite!=null)return sprite;
            var texture=Resources.Load<Texture2D>("Art/Current/RunHud/"+name+"-v2");if(texture==null)return null;
            sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),100);sprite.name="map-tool-"+name;Cache[name]=sprite;return sprite;
        }
    }
}
