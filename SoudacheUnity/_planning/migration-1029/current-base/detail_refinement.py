from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentRooms.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('Label(content,"出征加成",23,true);Fact(content,"当前",MetaProgress.PerkText(stats.lv));if(!stats.maxed)Fact(content,"下一级",MetaProgress.PerkText(stats.lv+1));','''Label(content,"出征加成",23,true);var steps=Row(content,"person-perk-value",16,140);var currentStep=Column(steps,"person-perk-step-current",12);Label(currentStep,"当前",20,false,Muted);Label(currentStep,MetaProgress.PerkText(stats.lv),25,true);
            if(!stats.maxed){Label(steps,"→",30,false,Muted);var nextStep=Column(steps,"person-perk-step-next",12);Label(nextStep,"下一级",20,false,Muted);Label(nextStep,MetaProgress.PerkText(stats.lv+1),25,true);}''')
s=s.replace('if(!stats.maxed)Command(content,"选择培养卡牌    →",','var growthFill=Column(content,"person-growth-fill",0);Bounds(growthFill.gameObject,0,0,1,1);\n            if(!stats.maxed)Command(content,"选择培养卡牌    →",')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs');s=p.read_text(encoding='utf-8-sig')
start=s.index('        static Sprite _rounded;');end=s.index('        static Image Surface(',start)
s=s[:start]+'''        static readonly Dictionary<int,Sprite> RoundedShapes=new Dictionary<int,Sprite>();
        static Sprite Rounded(float requested)
        {
            int radius=Mathf.Clamp(Mathf.RoundToInt(requested),2,32);if(RoundedShapes.TryGetValue(radius,out var sprite))return sprite;
            const int side=64;var tex=new Texture2D(side,side,TextureFormat.RGBA32,false);tex.name="base-glass-rounded-"+radius;tex.wrapMode=TextureWrapMode.Clamp;
            for(int y=0;y<side;y++)for(int x=0;x<side;x++)
            {float dx=Mathf.Max(0,Mathf.Abs(x-31.5f)-(32-radius)),dy=Mathf.Max(0,Mathf.Abs(y-31.5f)-(32-radius));float a=Mathf.Clamp01(radius-Mathf.Sqrt(dx*dx+dy*dy));tex.SetPixel(x,y,new Color(1,1,1,a));}
            tex.Apply();sprite=Sprite.Create(tex,new Rect(0,0,side,side),new Vector2(.5f,.5f),100,0,SpriteMeshType.FullRect,new Vector4(radius,radius,radius,radius));RoundedShapes[radius]=sprite;return sprite;
        }
'''+s[end:]
s=s.replace('image.sprite=radius>0?Rounded:null;','image.sprite=radius>0?Rounded(radius):null;')
p.write_text(s,encoding='utf-8')
