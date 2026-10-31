from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/CourtyardScreen.cs');s=p.read_text(encoding='utf-8-sig');s=s.replace('_preferences.intensity==80?.095f:.035f','_preferences.intensity==80 ? .095f : .035f')
for x,y in [('r.tap?.43:.20','r.tap ? .43 : .20'),('r.tap?.38:.17','r.tap ? .38 : .17'),('r.tap?.05:.022','r.tap ? .05 : .022'),('heavy?.4:.32','heavy ? .4 : .32')]:s=s.replace(x,y)
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs');s=p.read_text(encoding='utf-8-sig')
for name in ['Color Ink','RectTransform Area','void Fill','void Set','LayoutElement Bounds','Transform Column','Transform Row','Text Label','Image Surface','Button Command','void SoftSelection']:
 s=s.replace('        static '+name,'        internal static '+name)
s=s.replace('static readonly Color InkColor','internal static readonly Color InkColor');p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs');s=p.read_text(encoding='utf-8-sig').replace('case "courtyard": CourtyardScreen.Open(); break;','case "courtyard": CourtyardScreen.BuildCurrentRoom(page); break;')
s=s.replace('if (destination == "courtyard") CourtyardScreen.Open(); else {','{');p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentMotion.cs');s=p.read_text(encoding='utf-8-sig').replace('"partner-display"}', '"partner-display","courtyard-v3-scene"}').replace('"companion-hatch"}', '"companion-hatch","courtyard-v3-controls"}');p.write_text(s,encoding='utf-8')
