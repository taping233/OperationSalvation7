using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        /// <summary>Current warehouse/collection inventory zoom. Permanent gallery opens the read-only variant.</summary>
        public sealed class HubInventoryCardScreen : Panel
        {
            CardDef _card;BaseData _base;int? _slot;Action _refresh;bool _pocket,_readOnly,_converting;int _convertCount=1;
            GameRuntime R=>GameRuntime.I;
            public static void Open(CardDef card,Action refresh,bool pocket=false,bool readOnly=false)
            {
                var screen=UiStack.Show<HubInventoryCardScreen>("inventory-card-zoom");screen._card=card;screen._base=GameRuntime.I.Base;screen._slot=GameRuntime.I.ActiveSlot;
                screen._refresh=refresh;screen._pocket=pocket;screen._readOnly=readOnly;screen.Rebuild();
            }
            bool Current=>ReferenceEquals(_base,R.Base)&&_slot==R.ActiveSlot;
            StashStack Stack=>!Current?null:(_pocket?_base.pocket:_base.stash).SingleOrDefault(s=>s.card.id==_card.id&&s.card.name==_card.name);
            void Notify(string reason){R.Bus.Emit(new ToastRequested(reason));}
            void Done(string text){Notify(text);Close();_refresh?.Invoke();}
            public override void Build()
            {
                if(_card==null)return;
                var shade=UIKit.Panel("inventory-zoom-overlay",transform);shade.AddComponent<Image>().color=Theme.HexA("#02070C",.82f);
                var card=Area(shade.transform,"inventory-zoom",new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-600,-430),new Vector2(600,430));Surface(card,.98f);
                var body=Row(card,"inventory-zoom-body",30);Fill((RectTransform)body,new Vector2(32,32),new Vector2(-32,-32));
                var art=Column(body,"inventory-card",16);Bounds(art.gameObject,460,0,0,1);CardArt(art,_card,430,660);
                var info=Column(body,"inventory-actions",16);Label(info,_card.name,32,true);Label(info,(_card.rarity??"—")+" · "+(_card.type??"卡牌")+" · "+_card.cost+" 费",20,false,Muted);
                var description=Scroll(info,"inventory-description");Label(description,_card.desc,22);
                if(_readOnly){Command(info,"返回",Close);return;}
                if(!Current){Label(info,"档案已切换，请重新打开。",22,false,Muted);Command(info,"返回",Close);return;}
                StashStack stack;
                try{stack=Stack;}catch(InvalidOperationException){Label(info,"卡牌身份已变化，请重新选择。",22,false,Muted);Command(info,"返回",Close);return;}
                if(stack==null){Label(info,"该卡牌已不在仓库。",22,false,Muted);Command(info,"返回",Close);return;}
                Label(info,(_pocket?"待复原 ":"持有 ")+stack.count+" 张",22,true);Rule(info);
                if(_pocket)
                {
                    int cost=_base.PocketKeyCost(stack);Fact(info,"钥匙",_base.KeyCount+" / "+cost);Fact(info,"仓库空位",_base.StashRoom+" / "+stack.count);
                    var restore=Command(info,"复原 "+stack.count+" 张 · "+cost+" 钥匙",()=>
                    {
                        if(!Current){Notify("档案已切换");return;}
                        int index=_base.pocket.IndexOf(stack);if(index<0){Notify("库存已变化");return;}
                        bool ok=R.TryPersistMutation(()=>{string result=_base.Restore(index);if(result!="true"&&result!="sha")throw new InvalidOperationException(result=="nokey"?"钥匙不足":result=="full"?"仓库容量不足":"复原未完成");},out var why);
                        if(!ok){Notify(why);return;}Done("卡牌已复原");
                    },true);restore.interactable=_base.KeyCount>=cost&&_base.StashRoom>=stack.count;
                    Command(info,"返回仓库",Close);return;
                }
                bool protect=_base.IsProtected(_card);var material=BaseData.MaterialInfo(_card);
                if(material!=null)
                {Command(info,"使用 1 张 · +"+material.amount+material.label,()=>UseMaterial(false),true);if(stack.count>1)Command(info,"全部使用 · +"+material.amount*stack.count+material.label,()=>UseMaterial(true));}
                else if(_card.id==PetCatalog.Current.eggId)
                {var hatch=Command(info,"孵化伙伴 · "+PetCatalog.Current.hatchCost+" 储备币",()=>{if(!Current){Notify("档案已切换");return;}if(!R.Base.TryHatchPet(out var pet,out var why)){Notify(why);return;}Done("获得伙伴「"+pet.name+"」");},true);hatch.interactable=_base.coins>=PetCatalog.Current.hatchCost&&_base.pets.Count<BaseData.PetsCatalog.Count;}
                else if(_card.id=="tt-econpack")Command(info,"拆开 1 包 · 获得 5 张随机卡牌",()=>{if(!Current){Notify("档案已切换");return;}if(!R.Base.TryOpenSupplyPack(out var cards,out var why)){Notify(why);return;}Done("拆包完成："+string.Join("、",cards.Select(c=>c.name)));},true);
                if(_converting)
                {
                    int maximum=ConversionMax(stack);Label(info,"人物归档培养",26,true);Label(info,"消耗卡牌，首次转化永久收录图鉴。",20,false,Muted);
                    Fact(info,"获得经验",(_card.type=="能力卡"?50:10)*_convertCount+" XP");Fact(info,"消耗数量",_convertCount+" / "+stack.count);
                    var step=Row(info,"conversion-quantity",12,54);var minus=Command(step,"−",()=>{_convertCount--;Rebuild();});minus.interactable=_convertCount>1;Label(step,_convertCount.ToString(),22,true);var plus=Command(step,"＋",()=>{_convertCount++;Rebuild();});plus.interactable=_convertCount<maximum;
                    var confirm=Command(info,"确认消耗并转化",()=>{if(!Current){Notify("档案已切换");return;}if(!R.Meta.TryConvertCollection(_card.id,_convertCount,out var why)){Notify(why);return;}Done("人物培养完成，图鉴进度已保存");},true);confirm.interactable=!protect&&maximum>0;
                    Command(info,"取消转化",()=>{_converting=false;Rebuild();});return;
                }
                var protection=Command(info,protect?"解除收藏保护":"收录并保护",()=>{if(!Current){Notify("档案已切换");return;}if(!R.Base.TrySetProtection(_card,!protect,out var why)){Notify(why);return;}R.Meta.CheckUnlocks();Rebuild();_refresh?.Invoke();});
                if(R.Meta.IsCollectible(_card))
                {var convert=Command(info,"转化为人物经验 →",()=>{_converting=true;_convertCount=1;Rebuild();},true);convert.interactable=!protect&&ConversionMax(stack)>0;}
                if(CardLibrary.IsSellable(_card)&&material==null&&_card.id!=PetCatalog.Current.eggId&&_card.id!="tt-econpack")
                {
                    int price=CardLibrary.SellPrice(_card);var sell=Command(info,"出售 ×1 · +"+price+" 储备币",()=>{});sell.interactable=!protect;BindConfirm(sell,()=>Sell(1));
                    if(stack.count>1){var all=Command(info,"整堆出售 ×"+stack.count+" · +"+price*stack.count+" 储备币",()=>{});all.interactable=!protect;BindConfirm(all,()=>Sell(stack.count));}
                }
                Command(info,"返回仓库",Close);
            }
            int ConversionMax(StashStack stack)
            {
                if(!R.Meta.IsCollectible(_card))return 0;int levelNow=R.Meta.ClassLv(_card.cls),xpNow=R.Meta.ClassXP(_card.cls);int required=0;
                if(levelNow>=MetaProgress.LevelMax)return _base.IsCollected(_card)?0:1;
                for(int level=levelNow;level<MetaProgress.LevelMax;level++)required+=MetaProgress.XpForNext(level);required=Math.Max(0,required-xpNow);
                return Math.Min(stack.count,Math.Max(1,(required+(_card.type=="能力卡"?49:9))/(_card.type=="能力卡"?50:10)));
            }
            void UseMaterial(bool all){if(!Current){Notify("档案已切换");return;}if(!R.Base.TryUseStashMaterial(_card.name,all,out var why)){Notify(why);return;}Done("物资已入账");}
            void Sell(int count)
            {
                if(!Current){Notify("档案已切换");return;}bool ok=R.TryPersistMutation(()=>
                {if(_base.stash.Count(s=>s.card.name==_card.name)!=1)throw new InvalidOperationException("卡牌身份已变化，请重新选择");var result=_base.SellStashCards(_card.name,count);if(!result.ok)throw new InvalidOperationException(result.msg??"暂不能出售");},out var why);
                if(!ok){Notify(why);return;}Done("出售完成");
            }
        }
    }
}
