from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs');s=p.read_text(encoding='utf-8-sig');s=s.replace('(width/280f)','(width/(392f*2f/3f))');s=s.replace('CardArt(col,card,210,height-70);var caption=Label(col,label,20,false,InkColor);','CardArt(col,card,height<250?90:210,height-70);var caption=Label(col,label,height<250?13:20,false,InkColor);');p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubModernPages.cs');s=p.read_text(encoding='utf-8-sig').replace('static string StackKey(StashStack stack)','static int _collectionPage;\n        static string StackKey(StashStack stack)');s=s.replace('v=>{_collectionQuery=v;Rebuild();}','v=>{_collectionQuery=v;_collectionPage=0;Rebuild();}').replace('v=>{_collectionType=v;Rebuild();}','v=>{_collectionType=v;_collectionPage=0;Rebuild();}')
s=s.replace('var stage=Row(parent,"collection-v12-stage",30,440);','var stage=Row(parent,"collection-v12-stage",30);Bounds(stage.gameObject,0,350,1,1);').replace('Bounds(display.gameObject,380,440,0,0);CardArt(display,chosen.card,280,420);','Bounds(display.gameObject,0,350,1,1);CardArt(display,chosen.card,230,345);')
start=s.index('            var shelf=Scroll(parent,"collection-owned");')
end=s.index('\n        }\n        void BuildRewards',start)
s=s[:start]+'''            var shelf=Column(parent,"collection-owned",12,new RectOffset(14,14,14,14));Surface(shelf);Bounds(shelf.gameObject,0,228,1,0);
            float canvasWidth=GetComponentInParent<Canvas>().GetComponent<RectTransform>().rect.width;int perPage=Math.Max(1,Mathf.FloorToInt((canvasWidth-360)/127));
            int pages=Math.Max(1,(filtered.Count+perPage-1)/perPage);_collectionPage=Mathf.Clamp(_collectionPage,0,pages-1);
            var row=Row(shelf,"collection-card-row",12,164);
            foreach(var record in filtered.Skip(_collectionPage*perPage).Take(perPage)){var item=record;SelectableCard(row,item.card,item.card?.name??item.record.name??item.id,item.id==_collectionId,()=>{_collectionId=item.id;Rebuild();},115,164);}
            var pager=Row(shelf,"card-browser-footer",12,42);var previous=Command(pager,"‹",()=>{_collectionPage--;Rebuild();});previous.interactable=_collectionPage>0;Bounds(previous.gameObject,56,42,0,0);
            var position=Label(pager,(_collectionPage+1)+" / "+pages,19,false,Muted);position.alignment=TextAnchor.MiddleCenter;var next=Command(pager,"›",()=>{_collectionPage++;Rebuild();});next.interactable=_collectionPage<pages-1;Bounds(next.gameObject,56,42,0,0);'''+s[end:]
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentRooms.cs');s=p.read_text(encoding='utf-8-sig').replace('const int columns=4;','float warehouseWidth=GetComponentInParent<Canvas>().GetComponent<RectTransform>().rect.width-120;\n            int columns=Math.Max(1,Mathf.FloorToInt((warehouseWidth+24)/348));').replace('CardArt(content,stack.card,280,420)','CardArt(content,stack.card,300,450)')
p.write_text(s,encoding='utf-8')
