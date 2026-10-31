// Geometry is copied from current game/data/card-frame-layout.json; no source artwork is redrawn.
using System.Collections.Generic;
using Sdt.Core;
namespace Sdt.UI.Screens.Run
{
    public sealed class CardFaceOptions
    {
        public bool HideCost=true,ScrollDescription=true;
        public int? CostOverride;
        public int SpellDamageBonus;
    }
    public struct CardFrameOpening { public float Left,Top,Width,Height,CanvasWidth,CanvasHeight; }
    public static class CardVisual
    {
        public static readonly IReadOnlyDictionary<string,CardFrameOpening> Frames=new Dictionary<string,CardFrameOpening>
        {
            {"initial",new CardFrameOpening{Left=57f,Top=61.5f,Width=411f,Height=650.5f,CanvasWidth=512f,CanvasHeight=768f}},
            {"common",new CardFrameOpening{Left=57f,Top=66f,Width=411f,Height=646f,CanvasWidth=512f,CanvasHeight=768f}},
            {"rare",new CardFrameOpening{Left=56.5f,Top=65.5f,Width=411f,Height=646f,CanvasWidth=512f,CanvasHeight=768f}},
            {"epic",new CardFrameOpening{Left=57.5f,Top=62.5f,Width=411f,Height=642.5f,CanvasWidth=512f,CanvasHeight=768f}},
            {"legendary",new CardFrameOpening{Left=56.5f,Top=65.5f,Width=399.5f,Height=639f,CanvasWidth=512f,CanvasHeight=768f}},
            {"prism",new CardFrameOpening{Left=58f,Top=73f,Width=404.5f,Height=625f,CanvasWidth=512f,CanvasHeight=768f}},
            {"token",new CardFrameOpening{Left=57f,Top=66f,Width=410.5f,Height=645.5f,CanvasWidth=512f,CanvasHeight=768f}},
            {"wu",new CardFrameOpening{Left=58.5f,Top=67.5f,Width=410.5f,Height=645f,CanvasWidth=512f,CanvasHeight=768f}},
            {"xingyue",new CardFrameOpening{Left=59f,Top=62.5f,Width=411f,Height=649.5f,CanvasWidth=512f,CanvasHeight=768f}},
            {"changwuyu",new CardFrameOpening{Left=60.5f,Top=66.5f,Width=406f,Height=639f,CanvasWidth=512f,CanvasHeight=768f}},
            {"baita",new CardFrameOpening{Left=58.5f,Top=62f,Width=410f,Height=650f,CanvasWidth=512f,CanvasHeight=768f}},
            {"heixiang",new CardFrameOpening{Left=58f,Top=65f,Width=382.5f,Height=636f,CanvasWidth=512f,CanvasHeight=768f}},
            {"neutral",new CardFrameOpening{Left=57f,Top=61.5f,Width=411f,Height=650.5f,CanvasWidth=512f,CanvasHeight=768f}},
        };
        static readonly Dictionary<string,string> Careers=new Dictionary<string,string>{{"侠客","wu"},{"战士","heixiang"},{"法师","baita"},{"牧师","xingyue"},{"降临者","changwuyu"}};
        static readonly Dictionary<string,string> Rarities=new Dictionary<string,string>{{"初始","initial"},{"古朴","common"},{"稀有","rare"},{"史诗","epic"},{"传说","legendary"},{"衍生","token"},{"棱彩","prism"}};
        public static string EffectiveRarity(CardDef card)=>card==null?"初始":CardLibrary.RarityOf(card)??"初始";
        public static string FrameKey(CardDef card)
        {
            string rarity=EffectiveRarity(card);
            if(rarity=="职业")return card?.cls!=null&&Careers.TryGetValue(card.cls,out var career)?career:"neutral";
            return Rarities.TryGetValue(rarity,out var key)?key:"initial";
        }
        public static bool ShowCost(CardDef card,bool hideCost)=>card!=null&&card.type!="资源"&&(!hideCost||!(card.type=="道具"||card.type=="生物"||card.type=="装备"||card.type=="事件"));
        public static int Cost(CardDef card,CardFaceOptions options)=>options?.CostOverride??card?.runtimeCost??card?.cost??0;
        public static string CostTone(CardDef card,CardFaceOptions options)=>Cost(card,options)<(card?.cost??0)?"down":Cost(card,options)>(card?.cost??0)?"up":"normal";
        public static string DamageIcon(CardDef card)=>card?.dmgType=="attack"?"swords":card?.dmgType=="spell"?"sparkles":card?.dmgType=="true"?"bolt":"crystal";
        public static string DamageText(CardDef card,int spellBonus=0)
        {
            int value=card?.dmg??0;
            if(card?.dmgType=="attack")return value<0?value.ToString():"+"+value;
            if(card?.dmgType=="spell")return (value+spellBonus)+"'";
            return value+(card?.dmgType=="true"?"''":"");
        }
        public static bool ShowDamage(CardDef card)=>card!=null&&(card.type=="武术"||card.type=="法术")&&((card.dmg??0)>0||(card.dmg??0)<0&&card.dmgType=="attack");
        public static string Pigment(string frame)=>frame=="common"?"#716048":frame=="rare"?"#235682":frame=="epic"?"#674087":frame=="legendary"?"#805511":frame=="prism"?"#694D86":frame=="token"?"#3F6C67":frame=="wu"?"#354A6D":frame=="xingyue"?"#79600F":frame=="changwuyu"?"#69427C":frame=="baita"?"#416C33":frame=="heixiang"?"#7B3C37":"#52595C";
    }
}
