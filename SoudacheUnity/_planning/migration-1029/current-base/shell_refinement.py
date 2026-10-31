from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('Configure(resourceRow, 18, new RectOffset(), false);','Configure(resourceRow, 18, new RectOffset(), false);resourceRow.childAlignment=TextAnchor.MiddleRight;')
s=s.replace('Bounds(button.gameObject, 0, 104, 1, 0);','Bounds(button.gameObject, 0, 104, 1, 0);button.GetComponent<Image>().material=null;button.GetComponent<Image>().color=selected?Theme.HexA("#9EDCE7",.11f):Color.clear;button.GetComponent<Outline>().enabled=false;')
s=s.replace('var badge = LabelAt(button.transform,pending.ToString(),20,new Vector2(126,70),new Vector2(158,98),Accent); badge.fontStyle=FontStyle.Bold;','var badge=UIKit.Label(button.transform,pending.ToString(),20,Accent);Set(badge.transform,Vector2.one,Vector2.one,new Vector2(-50,-36),new Vector2(-20,-8));badge.fontStyle=FontStyle.Bold;')
s=s.replace('"[[icon:map]]  "+(DepartPrepScreen.HasDraft?"继续整备":"出征整备")+"     →"','(DepartPrepScreen.HasDraft?"继续整备":"出征整备")+"     →"')
s=s.replace('foreach(var t in launch.GetComponentsInChildren<Text>())t.fontSize=28;','''foreach(var t in launch.GetComponentsInChildren<Text>()){t.fontSize=28;t.fontStyle=FontStyle.Bold;t.alignment=TextAnchor.MiddleLeft;t.rectTransform.offsetMin=new Vector2(82,8);}
            var launchIcon=UIKit.Image(launch.transform,Sdt.Res.Res.HubIcon("deploy"));launchIcon.color=Ink("#E2C891");launchIcon.preserveAspect=true;Set(launchIcon.transform,new Vector2(0,.5f),new Vector2(0,.5f),new Vector2(20,-23),new Vector2(66,23));
            var stripe=Area(launch.transform,"launch-gold-line",Vector2.zero,new Vector2(0,1),Vector2.zero,new Vector2(5,0));stripe.gameObject.AddComponent<Image>().color=Ink("#E2C891");''')
s=s.replace('Bounds(b.gameObject,0,54,1,0); }','Bounds(b.gameObject,0,54,1,0);if(id=="elite"&&B.selMode==id)b.GetComponent<Image>().color=Ink("#FF818C"); }')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubModernPages.cs');s=p.read_text(encoding='utf-8-sig').replace('Command(directory,(++number).ToString("00")+"  "+section.Item2+"  ›",()=>{if(key=="achievements")_achievementReturn=_archiveView=="backs"?"backs":"rewards";_archiveView=key;Rebuild();},key==_archiveView);','var entry=Command(directory,(++number).ToString("00")+"  "+section.Item2+"  ›",()=>{if(key=="achievements")_achievementReturn=_archiveView=="backs"?"backs":"rewards";_archiveView=key;Rebuild();},key==_archiveView);Bounds(entry.gameObject,0,66,1,0);')
p.write_text(s,encoding='utf-8')
