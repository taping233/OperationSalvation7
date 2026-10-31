using System;
using System.Linq;
using Sdt.Run;
using Sdt.Core;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        void BuildPets(Transform parent)
        {
            var B=G.Base;var selected=BaseData.PetsCatalog.FirstOrDefault(p=>p.id==_pet)??B.CarriedPet??BaseData.PetsCatalog[0];_pet=selected.id;
            bool owned=B.pets.ContainsKey(selected.id),carried=B.petSel==selected.id;int level=owned?B.PetLevel(selected.id):1,cost=B.PetUpCost(selected.id);
            int eggs=B.stash.Where(s=>s.card.id==PetCatalog.Current.eggId).Sum(s=>s.count);bool maximum=level>=PetCatalog.Current.levelMax;
            var root=Column(parent,"personnel-v12 companions",18);Fill((RectTransform)root);
            if(_hatch)
            {
                var scene=Row(root,"companion-hatch-scene",40);var art=Column(scene,"companion-hatch-art",16);Surface(art);
                CardArt(art,Sdt.Core.CardLibrary.FindById(PetCatalog.Current.eggId),340,560);
                var info=Column(scene,"companion-hatch",24,new RectOffset(36,36,36,36));Surface(info);Label(info,"伙伴孵化",32,true);Command(info,"返回伙伴",()=>{_hatch=false;Rebuild();});
                Label(info,"随机获得一位尚未拥有的伙伴。",22,false,Muted);Fact(info,"伙伴蛋",eggs+" / 1");Fact(info,"储备币",B.coins+" / "+PetCatalog.Current.hatchCost);
                var hatch=Command(info,"孵化伙伴",()=>{if(!G.Base.TryHatchPet(out var pet,out var reason)){Log(reason,"warn");return;}_pet=pet.id;_hatch=false;Log("孵化成功："+pet.name,"ok");Rebuild();},true);
                hatch.interactable=eggs>0&&B.coins>=PetCatalog.Current.hatchCost&&B.pets.Count<BaseData.PetsCatalog.Count;
                if(!hatch.interactable)Label(info,B.pets.Count>=BaseData.PetsCatalog.Count?"所有伙伴已相遇":eggs==0?"缺少 1 枚伙伴蛋":"还需 "+(PetCatalog.Current.hatchCost-B.coins)+" 储备币",20,false,Muted);return;
            }
            var tools=Row(root,"companion-toolbar",16,58);Command(tools,"返回角色",()=>{_personGroup="people";_personSection="profile";Rebuild();});Label(tools,"已相遇  "+B.pets.Count+" / "+BaseData.PetsCatalog.Count,22,true);Command(tools,"孵化新伙伴  "+eggs+" 枚蛋",()=>{_hatch=true;Rebuild();});
            var stage=Row(root,"partner-stage",24);var display=Column(stage,"partner-display",18,new RectOffset(30,30,30,30));Surface(display);Bounds(display.gameObject,0,0,1.4f,1);
            Label(display,"伙伴 / 0"+(BaseData.PetsCatalog.IndexOf(selected)+1),20,false,Muted);
            var portrait=UIKit.Image(display,Sdt.Res.Res.HubArt("companion-"+selected.id));portrait.preserveAspect=true;Bounds(portrait.gameObject,0,390,1,1);if(!owned)portrait.color=new Color(.55f,.6f,.62f,1);
            if(owned)
            {
                var play=portrait.gameObject.AddComponent<Button>();portrait.raycastTarget=true;play.targetGraphic=portrait;
                var reply=Label(display,"",20,false,Accent);var interaction=portrait.gameObject.AddComponent<HubPartnerPlay>();interaction.Art=portrait.rectTransform;interaction.Reply=reply;interaction.PetId=selected.id;play.onClick.AddListener(interaction.Play);
                Label(display,"逗一逗",20,false,Muted);
            }
            Label(display,selected.name,34,true);Label(display,carried?"随行中":owned?"已相遇":"未相遇",22,false,carried?Accent:Muted);
            var detailBox=Column(stage,"partner-details",16,new RectOffset(28,28,28,28));Surface(detailBox);Bounds(detailBox.gameObject,0,0,1,1);var details=Scroll(detailBox,"partner-details-scroll");
            Label(details,"随行能力",28,true);Label(details,selected.desc.Replace("携带效果：",""),22);Rule(details);
            int safe=Math.Min(GameRules.SafeMax,GameRules.SafeStart+level-1)+(selected.effect?.safeBonus??0),nextSafe=Math.Min(GameRules.SafeMax,GameRules.SafeStart+level)+(selected.effect?.safeBonus??0);
            Fact(details,"等级",owned?"Lv."+level:"未相遇");Fact(details,owned?"携带时安全格":"初次携带安全格",safe+" 格");
            var carry=Command(details,carried?"当前随行伙伴":owned?"携带出征":"相遇后可携带",()=>{if(!G.Base.TrySelectPet(selected.id,out var why)){Log(why,"warn");return;}Rebuild();},true);carry.interactable=owned&&!carried;Rule(details);
            Label(details,owned?"本次培养":"相遇途径",23,true);
            if(owned)
            {
                Fact(details,"等级","Lv."+level+" → "+(maximum?"MAX":"Lv."+(level+1)));Fact(details,"安全格",safe+" → "+(maximum?safe:nextSafe));Fact(details,"口粮",B.rations+" / "+(maximum?"—":cost.ToString()));
                var up=Command(details,maximum?"已达培养上限":"培养伙伴",()=>{if(!G.Base.TryUpgradePet(selected.id,out var why)){Log(why,"warn");return;}G.Meta.CheckUnlocks();Rebuild();},true);up.interactable=B.CanUpgradePet(selected.id);
                if(!maximum)Label(details,B.rations<cost?"还需 "+(cost-B.rations)+" 口粮":"安全格加成在携带时生效",20,false,Muted);
                if(!maximum&&B.rations<cost)Command(details,"交易所补充口粮 →",()=>{_tradeMode="buy";_tradeKey="rations";Navigate("shop");});
            }
            else {Label(details,"远征搜刮点获取伙伴蛋，回基地孵化。",22,false,Muted);Command(details,"查看孵化条件",()=>{_hatch=true;Rebuild();});}
            var roster=Row(root,"person-roster",10,132);
            foreach(var definition in BaseData.PetsCatalog)
            {
                var pet=definition;var button=Command(roster,"",()=>{_pet=pet.id;Rebuild();},_pet==pet.id);Bounds(button.gameObject,0,132,1,0);
                var image=UIKit.Image(button.transform,Sdt.Res.Res.HubArt("companion-"+pet.id));image.preserveAspect=true;Set(image.transform,new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(-38,-86),new Vector2(38,-10));
                var text=UIKit.Label(button.transform,pet.name+" · "+(B.petSel==pet.id?"随行中":B.pets.ContainsKey(pet.id)?"Lv."+B.PetLevel(pet.id):"未相遇"),20,InkColor);text.alignment=TextAnchor.MiddleCenter;Fill(text.rectTransform,new Vector2(4,5),new Vector2(-4,-90));
            }
        }
    }
}
