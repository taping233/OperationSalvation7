from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentRooms.cs');s=p.read_text(encoding='utf-8-sig');s=s.replace('void BuildClasses(Transform page)','static int _poolPage;\n        void BuildClasses(Transform page)')
s=s.replace('_person=ch.id;_previewSkin="";Rebuild();','_person=ch.id;_previewSkin="";_poolPage=0;Rebuild();')
start=s.index('var pool=Scroll(art,"person-pool");')
end=s.index('return;',start)+len('return;')
s=s[:start]+'''var pool=Column(art,"person-pool",14);Fill((RectTransform)pool);
                var cards=CardLibrary.ClassPool(character.rulesetId);int pages=Math.Max(1,(cards.Count+3)/4);_poolPage=Mathf.Clamp(_poolPage,0,pages-1);
                var row=Row(pool,"pool-row",28);row.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleCenter;row.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;
                foreach(var c in cards.Skip(_poolPage*4).Take(4)){var pick=c;SelectableCard(row,pick,G.Meta.IsCollectible(c)?G.Base.IsCollected(c)?"已归档":"未归档":"不计入人物归档",false,()=>HubInventoryCardScreen.Open(pick,null,false,true),285,560);}
                var pager=Row(pool,"card-browser-footer",12,42);var previous=Command(pager,"‹",()=>{_poolPage--;Rebuild();});previous.interactable=_poolPage>0;Bounds(previous.gameObject,48,38,0,0);var position=Label(pager,(_poolPage+1)+" / "+pages,21,false,Muted);position.alignment=TextAnchor.MiddleCenter;var next=Command(pager,"›",()=>{_poolPage++;Rebuild();});next.interactable=_poolPage<pages-1;Bounds(next.gameObject,48,38,0,0);return;'''+s[end:]
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs');s=p.read_text(encoding='utf-8-sig').replace('height<250?90:210,height-70','height<250?90:height>=560?285:210,height-70');p.write_text(s,encoding='utf-8')
