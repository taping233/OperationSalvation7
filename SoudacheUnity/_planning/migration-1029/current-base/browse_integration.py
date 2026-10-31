from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('static bool _hatch;','static bool _hatch, _stashFromPersonnel;\n        static string _shopParent="stash", _facilityParent="stash", _achievementReturn="rewards";')
s=s.replace('void Navigate(string tab) { _tab = tab; AudioService.I.PlaySfx("switch"); Rebuild(); }','''void Navigate(string tab)
        {
            if(tab=="shop"&&_tab!="shop")_shopParent=_tab=="upgrade"?"stash":_tab;
            if(tab=="upgrade"&&_tab!="upgrade")_facilityParent=_tab;
            if(tab=="stash"&&_tab!="stash"&&!(_tab=="shop"&&_shopParent=="stash"))_stashFromPersonnel=_tab=="classes"&&!string.IsNullOrEmpty(_warehouseCharacter);
            _tab=tab; AudioService.I.PlaySfx("switch"); Rebuild();
        }''')
s=s.replace('if (_tab == "ach" && _archiveView != "cards") { _archiveView = "cards"; Rebuild(); return; }','''if(_tab=="stash"&&_stashFromPersonnel){_personGroup="people";_personSection="profile";Navigate("classes");return;}
            if (_tab == "ach" && _archiveView != "cards") { _archiveView=_archiveView=="achievements"?_achievementReturn:_archiveView=="classes"?"rewards":"cards"; Rebuild(); return; }''')
s=s.replace('if (_tab == "shop" || _tab == "upgrade") { Navigate("stash"); return; }','if (_tab == "shop" || _tab == "upgrade") { Navigate(_tab=="shop"?_shopParent:_facilityParent); return; }')
s=s.replace('BuildNavigation(root.transform);','BuildNavigation(root.transform);\n            RestoreBrowse(root);')
s=s.replace('if (destination == "courtyard") CourtyardScreen.Open(); else Navigate(destination);','''if (destination == "courtyard") CourtyardScreen.Open(); else { if(destination=="classes"){_personGroup="people";_personSection="profile";}if(destination=="ach")_archiveView="cards";if(destination=="stash"&&_tab=="deploy"){_warehouseView="cards";_warehouseGroup=_warehouseQuery=_warehouseType=_warehouseRarity=_warehouseCharacter="";} Navigate(destination); }''')
s=s.replace('Label(person,"待选择",22,true); Label(cards,"携带卡牌",20,false,Muted); Label(cards,"待配置",22,true);','Label(person,DepartPrepScreen.HasDraft?CharacterTable.Name(DepartPrepScreen.DraftCharacterId):"待选择",22,true); Label(cards,"携带卡牌",20,false,Muted); Label(cards,DepartPrepScreen.HasDraft?DepartPrepScreen.DraftCardCount+" 张":"待配置",22,true);')
s=s.replace('"[[icon:map]]  出征整备     →"','"[[icon:map]]  "+(DepartPrepScreen.HasDraft?"继续整备":"出征整备")+"     →"')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubModernPages.cs');s=p.read_text(encoding='utf-8-sig').replace('_archiveView=key;Rebuild();','if(key=="achievements")_achievementReturn=_archiveView=="backs"?"backs":"rewards";_archiveView=key;Rebuild();').replace('_archiveView="achievements";Rebuild();','_achievementReturn=_archiveView=="backs"?"backs":"rewards";_archiveView="achievements";Rebuild();');p.write_text(s,encoding='utf-8')
