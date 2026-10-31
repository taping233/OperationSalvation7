using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        void BuildStash(Transform page)
        {
            var root=Column(page,"warehouse-v3",16);Fill((RectTransform)root);
            bool pocket=_warehouseView=="pocket";
            if(pocket)
            {
                Label(root,"待复原   "+G.Base.pocket.Sum(s=>s.count)+" 张",22,true);
                Label(root,"未复原卡牌将在下次出征时清空。",20,false,Muted);
            }
            else
            {
                var categories=Row(root,"warehouse-categories-v7",8,64);Surface(categories);
                foreach(var entry in new[]{("","全部"),("battle","战斗卡牌"),("supplies","消耗物品"),("growth","归档培养")})
                {string key=entry.Item1;Command(categories,entry.Item2,()=>{_warehouseGroup=key;Rebuild();},_warehouseGroup==key);}
                var tools=Row(root,"warehouse-toolbar",12,54);
                Input(tools,"搜索卡牌",_warehouseQuery,v=>{_warehouseQuery=v;Rebuild();});
                Filter(tools,"全部类型",_warehouseType,G.Base.stash.Select(s=>s.card.type),v=>{_warehouseType=v;Rebuild();});
                Filter(tools,"全部品质",_warehouseRarity,G.Base.stash.Select(s=>s.card.rarity),v=>{_warehouseRarity=v;Rebuild();});
                int pending=G.Base.pocket.Sum(s=>s.count);
                if(pending>0) Command(tools,"待复原 "+pending+" ↗",()=>{_warehouseView="pocket";Rebuild();});
                if(!string.IsNullOrEmpty(_warehouseCharacter))
                {var purpose=Row(root,"warehouse-purpose",12,54);Label(purpose,CharacterTable.Name(_warehouseCharacter)+" · 归档培养",22,true);Command(purpose,"返回角色 →",()=>{_person=_warehouseCharacter;Navigate("classes");});}
            }
            var source=(pocket?G.Base.pocket:G.Base.stash).Where(s=>s.card!=null&&s.count>0).Where(s=>pocket||WarehouseMatches(s.card)).ToList();
            if(!pocket) Label(root,source.Count+" 种 · 仓库 "+G.Base.StashUsed+" / "+G.Base.StashCap+" 格",20,false,Muted);
            var scroll=Scroll(root,"warehouse-card-browser");Surface(scroll.parent,.55f);
            if(source.Count==0)
            {
                Label(scroll,pocket?"暂无待复原卡牌":G.Base.stash.Count==0?"仓库暂无卡牌":"没有匹配的卡牌",28,true);
                Label(scroll,pocket?"":G.Base.stash.Count==0?"出征带回的卡牌会存入这里。":"调整搜索或筛选，继续浏览。",22,false,Muted);
                Command(scroll,pocket?"返回仓库 →":G.Base.stash.Count==0?"前往整备 →":"显示全部",()=>{if(G.Base.stash.Count==0&&!pocket){Navigate("deploy");return;}_warehouseView="cards";_warehouseGroup=_warehouseQuery=_warehouseType=_warehouseRarity=_warehouseCharacter="";Rebuild();});return;
            }
            SourceCardGrid(scroll,true);
            foreach(var stack in source)
            {
                    var selected=stack;var button=Command(scroll,"",()=>OpenWarehouseCard(selected,pocket));button.name="warehouse-card-cell "+stack.card.id;SoftSelection(button,false);button.GetComponent<Outline>().enabled=false;
                    var content=Column(button.transform,"stash-cell",8,new RectOffset(12,12,8,8));Fill((RectTransform)content);
                    CardArt(content,stack.card,300,450);var caption=Row(content,"collection-caption",0,34);caption.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleRight;
                    var countNode=new GameObject("stack-count",typeof(RectTransform),typeof(Image));countNode.transform.SetParent(caption,false);countNode.GetComponent<Image>().color=Theme.HexA("#081015",.8f);
                    var label=UIKit.Label(countNode.transform,"×"+stack.count,19,InkColor);label.fontStyle=FontStyle.Bold;label.alignment=TextAnchor.MiddleCenter;label.font=Sdt.Res.Res.NumberBold;Fill(label.rectTransform,new Vector2(8,4),new Vector2(-8,-4));IntrinsicWidth(countNode.transform,label,16);Bounds(countNode,0,34,0,0);
                    var countLine=UIKit.GetOrAdd<Outline>(countNode);countLine.effectColor=Theme.HexA("#d6e7e7",.4f);countLine.effectDistance=new Vector2(1,-1);
                    if(G.Base.IsProtected(stack.card)){var protection=UIKit.Label(button.transform,"收藏保护",19,Ink("#d7e5b4"));Set(protection.transform,new Vector2(1,1),Vector2.one,new Vector2(-106,-40),new Vector2(-8,-8));protection.alignment=TextAnchor.MiddleCenter;}
            }
        }
        bool WarehouseMatches(CardDef card)
        {
            bool supply=card.id==PetCatalog.Current.eggId||card.id=="tt-econpack"||BaseData.MaterialInfo(card)!=null;
            bool growth=!string.IsNullOrEmpty(card.cls)&&(card.rarity=="职业"||card.type=="能力卡");
            return (string.IsNullOrEmpty(_warehouseQuery)||card.name.IndexOf(_warehouseQuery,StringComparison.OrdinalIgnoreCase)>=0)
                &&(string.IsNullOrEmpty(_warehouseType)||card.type==_warehouseType)&&(string.IsNullOrEmpty(_warehouseRarity)||card.rarity==_warehouseRarity)
                &&(string.IsNullOrEmpty(_warehouseCharacter)||CharacterTable.For(card.cls)?.id==_warehouseCharacter)
                &&(_warehouseGroup==""||(_warehouseGroup=="growth"?growth:_warehouseGroup=="supplies"?supply:!supply));
        }
        void OpenWarehouseCard(StashStack stack,bool pocket)
        {
            if(!pocket && BaseData.MaterialInfo(stack.card)!=null)
            {if(!G.Base.TryUseStashMaterial(stack.card.name,false,out var reason,GameRuntime.DepartureStackKey(stack))){Log(reason,"warn");return;}Rebuild();return;}
            HubInventoryCardScreen.Open(stack.card,()=>{if(this!=null)Rebuild();},pocket,stackKey:GameRuntime.DepartureStackKey(stack));
        }
        void BuildUpgrade(Transform page)
        {
            var B=G.Base;bool bag=_facility=="bag";int have=bag?B.BagCap:B.StashCap,max=bag?GameRules.BagMax:GameRules.StashMax;
            int add=bag?1:GameRules.StashUpgradeSlots,cost=bag?GameRules.BagUpgradeWood:GameRules.StashUpgradeWood;
            bool can=bag?B.CanUpgradeBag:B.CanUpgradeStash,maxed=have>=max;int runes=!bag&&!maxed&&have>=50?2:0;
            var layout=Row(page,"facility-layout",22);Fill((RectTransform)layout);
            SourceColumns(layout,new[]{230f,0,0},new[]{0f,0,490},new[]{0f,.8f,1.2f},22);
            var directory=Column(layout,"facility-map",8,new RectOffset(10,10,14,14));Bounds(directory.gameObject,230,0,0,1);Surface(directory);
            foreach(var id in new[]{"bag","stash"}) {string key=id;bool isBag=id=="bag";DirectoryEntry(directory,isBag?1:2,isBag?"出征背包":"基地仓库",()=>{_facility=key;Rebuild();},_facility==id,"当前 "+(isBag?B.BagCap:B.StashCap)+" 格");}
            var stage=Column(layout,"facility-v12-stage",20,new RectOffset(30,30,30,30));Surface(stage);Bounds(stage.gameObject,0,0,.8f,1);
            var illustration=UIKit.Image(stage,Sdt.Res.Res.HubIcon(bag?"facility-bag":"facility-stash"));illustration.preserveAspect=true;Bounds(illustration.gameObject,0,300,1,0);
            Label(stage,bag?"永久增加出征背包容量，每次出征均生效。":"卡牌每张、符文每块各占一个仓库格。",22,false,Muted);Progress(stage,(float)have/max);
            var details=Column(layout,"facility-details",22,new RectOffset(36,36,30,30));Surface(details);Bounds(details.gameObject,490,0,1.2f,1);
            Label(details,bag?"出征背包":"基地仓库",28,true);Rule(details);
            var benefits=Row(details,"facility-benefit",16,115);var current=Column(benefits,"当前",8);Label(current,"当前容量",20,false,Muted);Label(current,have+" 格",48,true,Accent);
            Label(benefits,"→",34,false,Muted);var next=Column(benefits,"扩建后",8);Label(next,maxed?"容量上限":"扩建后容量",20,false,Muted);Label(next,Mathf.Min(max,have+(maxed?0:add))+" 格",48,true,Accent);Rule(details);
            Label(details,maxed?"持有材料":"扩建材料",23,true);Fact(details,"木材",B.wood+" / "+(maxed?"—":cost.ToString()));
            if(runes>0)Fact(details,"符文",B.runes.Count+" / "+runes);
            var confirm=Command(details,maxed?"建设完成":"确认扩建    →",()=>
            {
                bool ok=G.TryPersistMutation(()=>{bool changed=bag?G.Base.UpgradeBag():G.Base.UpgradeStash();if(!changed)throw new InvalidOperationException("材料不足或设施已达上限");},out var reason);
                if(!ok){Log(reason,"warn");return;}G.Meta.CheckUnlocks();Log("扩建完成：容量 "+(bag?G.Base.BagCap:G.Base.StashCap)+" 格","ok");Rebuild();
            },true);confirm.interactable=can;
            if(!can)Label(details,maxed?"已达上限":string.Join(" · ",new[]{B.wood<cost?"木材不足，还需 "+(cost-B.wood):"",B.runes.Count<runes?"符文不足，还需 "+(runes-B.runes.Count):""}.Where(v=>v!="")),20,false,Muted);
            if(!maxed&&B.wood<cost)Command(details,"交易所补充木材 →",()=>{_tradeMode="buy";_tradeKey="wood";Navigate("shop");});
        }
        static int _poolPage;
        void BuildClasses(Transform page)
        {
            if(_personGroup=="pets"){BuildPets(page);return;}
            var character=CharacterTable.For(_person)??CharacterTable.All[0];_person=character.id;
            var stats=G.Meta.ClassSummary().First(s=>CharacterTable.For(s.cls)?.id==character.id);
            if(string.IsNullOrEmpty(_previewSkin))_previewSkin=G.Base.SelectedSkin(character.id);
            var root=Area(page,"personnel-v12",Vector2.zero,Vector2.one,new Vector2(24,16),new Vector2(-24,-16));
            var art=Area(root,_personSection=="pool"?"pv12-pool-catalog":"pv12-agent-art",Vector2.zero,new Vector2(_personSection=="pool"?1:.44f,1),Vector2.zero,new Vector2(_personSection=="pool"?0:-12,0));
            if(_personSection!="pool")
            {
                Surface(art);string skin=string.IsNullOrEmpty(_previewSkin)?G.Base.SelectedSkin(character.id):_previewSkin;
                var imageStage=Area(art,"pv12-agent-image-stage",Vector2.zero,Vector2.one,new Vector2(0,95),Vector2.zero);
                if(skin=="default")UIKit.GetOrAdd<Image>(imageStage).color=Ink("#c4ccc9");
                var portrait=UIKit.Image(imageStage,Sdt.Res.Res.SkinPortrait(character.id,skin));portrait.preserveAspect=true;Fill(portrait.rectTransform);
                if(skin=="default")portrait.material=HubDefaultPortrait.Material;
                LabelAt(art,character.name,34,new Vector2(20,43),new Vector2(420,88));LabelAt(art,string.IsNullOrEmpty(_previewSkin)?"默认外观":HubCatalog.Current.skins.FirstOrDefault(s=>s.characterId==character.id&&s.id==_previewSkin)?.name??"默认外观",22,new Vector2(20,12),new Vector2(420,44),Muted);
            }
            var strip=Area(root,"pv12-agent-strip",new Vector2(.46f,1),Vector2.one,new Vector2(0,-92),Vector2.zero);
            var roster=strip.gameObject.AddComponent<HorizontalLayoutGroup>();Configure(roster,10,new RectOffset(),false);
            foreach(var person in CharacterTable.All)
            {
                var ch=person;var button=Command(strip,"",()=>{_person=ch.id;_previewSkin="";_poolPage=0;Rebuild();},ch.id==_person);Bounds(button.gameObject,108,92,0,0);SoftSelection(button,ch.id==_person,.25f);
                var avatar=UIKit.Image(button.transform,Sdt.Res.Res.Avatar(ch.id));avatar.preserveAspect=true;Set(avatar.transform,new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(-32,-60),new Vector2(32,-8));
                var name=UIKit.Label(button.transform,ch.name,20,InkColor);name.alignment=TextAnchor.MiddleCenter;Fill(name.rectTransform,new Vector2(4,4),new Vector2(-4,-65));
            }
            var tabs=Area(root,"pv12-sections",new Vector2(.46f,0),new Vector2(1,0),Vector2.zero,new Vector2(0,58));var tabsRow=tabs.gameObject.AddComponent<HorizontalLayoutGroup>();Configure(tabsRow,8,new RectOffset(),true);
            foreach(var entry in new[]{("profile","培养"),("pool","招式"),("appearance","外观"),("pets","伙伴")}){string section=entry.Item1;Command(tabs,entry.Item2,()=>{if(section=="pets")_personGroup="pets";else _personSection=section;Rebuild();},_personSection==section);}
            if(_personSection=="pool")
            {
                // The source pool spans the stage while the roster and section controls remain on the right.
                Set(art,Vector2.zero,new Vector2(1,1),new Vector2(0,74),new Vector2(0,-108));var pool=Column(art,"person-pool",14);Fill((RectTransform)pool);
                var cards=CardLibrary.ClassPool(character.rulesetId);int pages=Math.Max(1,(cards.Count+3)/4);_poolPage=Mathf.Clamp(_poolPage,0,pages-1);
                var row=Row(pool,"pool-row",28);row.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleCenter;row.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;
                foreach(var c in cards.Skip(_poolPage*4).Take(4)){var pick=c;SelectableCard(row,pick,G.Meta.IsCollectible(c)?G.Base.IsCollected(c)?"已归档":"未归档":"不计入人物归档",false,()=>HubInventoryCardScreen.Open(pick,null,false,true),285,560);}
                var pager=Row(pool,"card-browser-footer",12,42);var previous=Command(pager,"‹",()=>{_poolPage--;Rebuild();});previous.interactable=_poolPage>0;Bounds(previous.gameObject,48,38,0,0);var position=Label(pager,(_poolPage+1)+" / "+pages,21,false,Muted);position.alignment=TextAnchor.MiddleCenter;var next=Command(pager,"›",()=>{_poolPage++;Rebuild();});next.interactable=_poolPage<pages-1;Bounds(next.gameObject,48,38,0,0);return;
            }
            var data=Area(root,"pv12-agent-data",new Vector2(.46f,0),Vector2.one,new Vector2(0,74),new Vector2(0,-108));Surface(data);var content=Column(data,"pv12-data-content",16,new RectOffset(24,24,20,20));Fill((RectTransform)content);
            Fact(content,_personSection=="appearance"?"外观预览":"人物培养","Lv."+stats.lv+(stats.maxed?" · MAX":""));Rule(content);
            if(_personSection=="appearance")
            {
                string equipped=G.Base.SelectedSkin(character.id);if(_previewSkin=="")_previewSkin=equipped;
                var scroll=Scroll(content,"person-skin-grid");
                foreach(var skin in new[]{new SkinOption{characterId=character.id,id="default",name="默认外观"}}.Concat(HubCatalog.Current.skins.Where(s=>s.characterId==character.id)))
                {
                    string id=skin.id;var b=Command(scroll,skin.name+(id==equipped?" · 已装备":id==_previewSkin?" · 预览中":""),()=>{_previewSkin=id;Rebuild();},_previewSkin==id);
                    var preview=UIKit.Image(scroll,Sdt.Res.Res.SkinPortrait(character.id,id));preview.preserveAspect=true;Bounds(preview.gameObject,0,150,1,0);
                }
                var apply=Command(content,_previewSkin==equipped?"已装备":"应用外观",()=>{if(!G.Base.TrySelectSkin(character.id,_previewSkin,out var why)){Log(why,"warn");return;}Rebuild();},true);apply.interactable=_previewSkin!=equipped;return;
            }
            Label(content,"出征加成",23,true);var steps=Row(content,"person-perk-value",16,140);var currentStep=Column(steps,"person-perk-step-current",12);Label(currentStep,"当前",20,false,Muted);Label(currentStep,MetaProgress.PerkText(stats.lv),25,true);
            if(!stats.maxed){Label(steps,"→",30,false,Muted);var nextStep=Column(steps,"person-perk-step-next",12);Label(nextStep,"下一级",20,false,Muted);Label(nextStep,MetaProgress.PerkText(stats.lv+1),25,true);}
            Rule(content);Fact(content,"熟练度",stats.maxed?"熟练度已满":stats.xp+" / "+stats.need+" XP");Progress(content,stats.maxed?1:(float)stats.xp/Math.Max(1,stats.need));
            var growthFill=Column(content,"person-growth-fill",0);Bounds(growthFill.gameObject,0,0,1,1);
            if(!stats.maxed)Command(content,"选择培养卡牌    →",()=>{_warehouseCharacter=character.id;_warehouseGroup="growth";_warehouseView="cards";_warehouseQuery=_warehouseType=_warehouseRarity="";Navigate("stash");},true);
        }
    }
}
