from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('var button=UIKit.Btn(parent,caption,action);','var owner=parent.GetComponentInParent<HubScreen>();int revision=owner!=null?owner._renderVersion:0;\n            var button=UIKit.Btn(parent,caption,()=>{if(owner!=null&&!owner.CurrentHub(revision))return;action?.Invoke();});')
s=s.replace('var button=Command(parent,"",action,selected);Bounds(button.gameObject,width,height,0,0);','var button=Command(parent,"",action,selected);SoftSelection(button,selected);Bounds(button.gameObject,width,height,0,0);')
pos=s.index('        static void Resource(')
s=s[:pos]+'''        static void SoftSelection(Button button,bool selected,float opacity=.11f)
        {button.GetComponent<Image>().material=null;button.GetComponent<Image>().color=selected?Theme.HexA("#9EDCE7",opacity):Color.clear;var line=button.GetComponent<Outline>();line.effectColor=selected?Accent:Theme.HexA("#D2E3E3",.18f);foreach(var text in button.GetComponentsInChildren<Text>())text.color=InkColor;}
'''+s[pos:]
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs');s=p.read_text(encoding='utf-8-sig').replace('static int? _browseSlot;','static int? _browseSlot;\n        static int _renderSequence;int _renderVersion;BaseData _viewBase;int? _viewSlot;\n        bool CurrentHub(int revision)=>this!=null&&isActiveAndEnabled&&_renderVersion==revision&&_renderSequence==revision&&ReferenceEquals(_viewBase,G.Base)&&_viewSlot==G.ActiveSlot;')
s=s.replace('var root = UIKit.Panel("hubMain', '_renderVersion=++_renderSequence;_viewBase=G.Base;_viewSlot=G.ActiveSlot;\n            var root = UIKit.Panel("hubMain')
# Replace the obsolete legacy stash body with a compatibility entry to the current inventory zoom, retaining raw material helpers.
start=s.index('        int _idx;',s.index('public sealed class StashItemModal'))
end=s.index('        internal static GameObject MakeCard',start)
s=s[:start]+'''        public void Setup(int index)
        {
            var current=GameRuntime.I.Base;
            if(index>=0&&index<current.stash.Count)HubScreen.HubInventoryCardScreen.Open(current.stash[index].card,()=>HubScreen.Open("stash"));
            Close();
        }
        public override void Build() { }

'''+s[end:]
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentRooms.cs');s=p.read_text(encoding='utf-8-sig').replace('static int columns=', 'static int columns=')
s=s.replace('var selected=stack;var button=Command(row,"",()=>OpenWarehouseCard(selected,pocket));','var selected=stack;var button=Command(row,"",()=>OpenWarehouseCard(selected,pocket));SoftSelection(button,false);button.GetComponent<Outline>().enabled=false;')
s=s.replace('Bounds(button.gameObject,108,92,0,0);','Bounds(button.gameObject,108,92,0,0);SoftSelection(button,ch.id==_person,.25f);')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubModernPages.cs');s=p.read_text(encoding='utf-8-sig').replace('Bounds(item.gameObject,0,480,1,0);','Bounds(item.gameObject,0,480,1,0);SoftSelection(item,_tradeKey==key,.22f);')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentArchiveViews.cs');s=p.read_text(encoding='utf-8-sig').replace('Bounds(button.gameObject,0,106,1,0);','Bounds(button.gameObject,0,106,1,0);SoftSelection(button,chosen==record);',1)
s=s.replace('Bounds(button.gameObject,0,106,1,0);\n                var art=', 'Bounds(button.gameObject,0,106,1,0);SoftSelection(button,selected.id==a.id);\n                var art=')
p.write_text(s,encoding='utf-8')
