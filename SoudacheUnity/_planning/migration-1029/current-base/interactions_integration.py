from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubPets.cs');s=p.read_text(encoding='utf-8-sig').replace('using Sdt.Run;','using Sdt.Run;\nusing Sdt.Core;')
s=s.replace('var details=Column(stage,"partner-details",16,new RectOffset(28,28,28,28));Surface(details);Bounds(details.gameObject,0,0,1,1);','var detailBox=Column(stage,"partner-details",16,new RectOffset(28,28,28,28));Surface(detailBox);Bounds(detailBox.gameObject,0,0,1,1);var details=Scroll(detailBox,"partner-details-scroll");')
s=s.replace('Label(display,selected.name,34,true);','''if(owned)
            {
                var play=portrait.gameObject.AddComponent<Button>();portrait.raycastTarget=true;play.targetGraphic=portrait;
                var reply=Label(display,"",20,false,Accent);var interaction=portrait.gameObject.AddComponent<HubPartnerPlay>();interaction.Art=portrait.rectTransform;interaction.Reply=reply;interaction.PetId=selected.id;play.onClick.AddListener(interaction.Play);
                Label(display,"逗一逗",20,false,Muted);
            }
            Label(display,selected.name,34,true);''')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs');s=p.read_text(encoding='utf-8-sig').replace('capsule.name=title+" "+value;','capsule.name=title+" "+value;var focus=capsule.AddComponent<Button>();focus.targetGraphic=capsule.GetComponent<Image>();capsule.AddComponent<HubResourceHint>().Caption=title;');p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs');s=p.read_text(encoding='utf-8-sig').replace('_browseSlot = runtime.ActiveSlot; _warehouseView', 'BrowseScroll.Clear();BrowseFocus.Clear();_collectionPage=0;_storySegment=0;_shopParent=_facilityParent="stash";_stashFromPersonnel=false;\n                _browseSlot = runtime.ActiveSlot; _warehouseView');p.write_text(s,encoding='utf-8')
