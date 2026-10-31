using System;
using System.Collections.Generic;
using UnityEngine;
namespace Sdt.Res
{
    // Source/output receipt: current-slot-achievement/source-receipt.json. Presentation only.
    public static class CurrentArchiveAssets
    {
        static readonly Dictionary<string,Sprite> Cache=new Dictionary<string,Sprite>();
        public static readonly string[] Styles={"painted","gesture","ink","collage","symbol"};
        static readonly string[] MedalIds={"firstExtract","extract3","kill10","firstBoss","allBoss","rich30","stash20","bagMax","safeMax","class3","collectGold","collectLegend","collect5","petHatch1","petHatch3","petMax","petAll","unlimitedEnergy","weaponMaster","runeFan","savior","beautifulVase","excuseMe","labScore1","labScore2","labScore3"};
        public static Sprite Load(string name)
        {
            if(Cache.TryGetValue(name,out var sprite)&&sprite!=null)return sprite;
            string path=name=="painted"?"Art/Current/ui/achievement-styles/painted":"Art/CurrentArchive/"+name;
            sprite=Resources.Load<Sprite>(path);if(sprite==null){var texture=Resources.Load<Texture2D>(path);if(texture!=null)sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),100);}
            if(sprite==null)Debug.LogError("[CurrentArchiveAssets] Missing source asset: "+path);else Cache[name]=sprite;return sprite;
        }
        public static Sprite Medal(string id,string style)
        {
            string key=style+"/"+id;if(Cache.TryGetValue(key,out var result)&&result!=null)return result;
            var atlas=Load(style);if(atlas==null)return null;int index=Math.Max(0,Array.IndexOf(MedalIds,id));float width=atlas.rect.width/6,height=atlas.rect.height/5;
            result=Sprite.Create(atlas.texture,new Rect(atlas.rect.x+index%6*width,atlas.rect.y+(4-index/6)*height,width,height),new Vector2(.5f,.5f),100);Cache[key]=result;return result;
        }
    }
}
