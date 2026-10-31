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
            CardDef _card;BaseData _base;int? _slot;Action _refresh;bool _pocket,_readOnly,_converting;int _convertCount=1;string _stackKey;
            string _operationNotice;Text _operationText;
            GameRuntime R=>GameRuntime.I;
            public static void Open(CardDef card,Action refresh,bool pocket=false,bool readOnly=false,string stackKey=null)
            {
                var screen=UiStack.Show<HubInventoryCardScreen>("inventory-card-zoom");screen._card=card;screen._base=GameRuntime.I.Base;screen._slot=GameRuntime.I.ActiveSlot;
                screen._refresh=refresh;screen._pocket=pocket;screen._readOnly=readOnly;screen._stackKey=stackKey??GameRuntime.DepartureStackKey(new StashStack{card=card});screen.Rebuild();
            }
            bool Current=>this!=null&&isActiveAndEnabled&&UiStack.Top==this&&ReferenceEquals(_base,R.Base)&&_slot==R.ActiveSlot;
            StashStack Stack=>!Current?null:_base.FindStoredStack(_stackKey,_pocket);
            void PaintOperationNotice(){if(_operationText==null)return;_operationText.text=_operationNotice??"";_operationText.gameObject.SetActive(!string.IsNullOrEmpty(_operationNotice));}
            bool BeginOperation(){if(!Current)return false;_operationNotice=null;PaintOperationNotice();return true;}
            void Notify(string reason)
            {
                _operationNotice=reason;PaintOperationNotice();
                R.Bus.Emit(new LogRequested{Text=reason,Tone="warn",SuppressNotice=true});
            }
            void Done(string text,bool sound=true){if(sound)R.Audio.PlaySfx("ding");Close();_refresh?.Invoke();R.Bus.Emit(new ToastRequested{Text=text,Tone="ok"});}
            public override void Build()
            {
                if(_card==null)return;
                var shade=UIKit.Panel("inventory-zoom-overlay",transform);shade.AddComponent<Image>().color=Theme.HexA("#02070C",.82f);
                var card=Area(shade.transform,"inventory-zoom",new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-600,-430),new Vector2(600,430));Surface(card,.98f);
                var body=Row(card,"inventory-zoom-body",30);Fill((RectTransform)body,new Vector2(32,32),new Vector2(-32,-32));
                var art=Column(body,"inventory-card",16);Bounds(art.gameObject,460,0,0,1);CardArt(art,_card,430,660);
                var info=Column(body,"inventory-actions",16);Label(info,_card.name,32,true);Label(info,(_card.rarity??"—")+" · "+(_card.type??"卡牌")+" · "+_card.cost+" 费",20,false,Muted);
                var description=Scroll(info,"inventory-description");Label(description,Sdt.Res.CurrentCardPresentation.Description(_card),22);
                try
                {
                    if(_readOnly){Command(info,"返回",Close);return;}
                    if(!Current){Label(info,"档案已切换，请重新打开。",22,false,Muted);Command(info,"返回",Close);return;}
                    var stack=Stack;
                    if(stack==null){Label(info,"该卡牌已不在仓库。",22,false,Muted);Command(info,"返回",Close);return;}
                    Label(info,(_pocket?"待复原 ":"持有 ")+stack.count+" 张",22,true);Rule(info);
                    if(_pocket)
                    {
                        int cost=_base.PocketKeyCost(stack);Fact(info,"钥匙",_base.keys+" / "+cost);Fact(info,"仓库空位",_base.StashRoom+" / "+stack.count);
                        var restore=Command(info,"复原 "+stack.count+" 张 · "+cost+" 钥匙",()=>
                        {
                            if(!BeginOperation())return;
                            int index=_base.pocket.IndexOf(stack);if(index<0){Notify("库存已变化");return;}
                            string result=null;bool ok=R.TryPersistMutation(()=>{result=_base.Restore(index);if(result!="true"&&result!="sha")throw new InvalidOperationException(result=="nokey"?"钥匙不足":result=="full"?"仓库容量不足":"复原未完成");},out var why);
                            if(!ok){Notify(why);return;}Done("卡牌已复原",result=="true");
                        },true);restore.interactable=_base.keys>=cost&&_base.StashRoom>=stack.count;
                        Command(info,"返回仓库",Close);return;
                    }
                    bool protect=_base.IsProtected(_card);var material=BaseData.MaterialInfo(_card);
                    if(material!=null)
                    {Command(info,"使用 1 张 · +"+material.amount+material.label,()=>UseMaterial(false),true);if(stack.count>1)Command(info,"全部使用 · +"+material.amount*stack.count+material.label,()=>UseMaterial(true));}
                    else if(_card.id==PetCatalog.Current.eggId)
                    {var hatch=Command(info,"孵化伙伴 · "+PetCatalog.Current.hatchCost+" 储备币",()=>{if(!BeginOperation())return;if(!R.Base.TryHatchPet(out var pet,out var why)){Notify(why);return;}Done("获得伙伴「"+pet.name+"」");},true);hatch.interactable=_base.coins>=PetCatalog.Current.hatchCost&&_base.pets.Count<BaseData.PetsCatalog.Count;}
                    else if(_card.id=="tt-econpack")Command(info,"拆开 1 包 · 获得 5 张随机卡牌",()=>{if(!BeginOperation())return;if(!R.Base.TryOpenSupplyPack(out var cards,out var why)){Notify(why);return;}Done("拆包完成："+string.Join("、",cards.Select(c=>c.name)));},true);
                    if(material!=null||_card.id==PetCatalog.Current.eggId||_card.id=="tt-econpack"){Command(info,"返回仓库",Close);return;}
                    if(_converting)
                    {
                        var preview=R.Meta.PreviewCollectionConversion(_card,stack.count,_convertCount);int maximum=preview.maxCount;
                        int clamped=Math.Max(1,Math.Min(_convertCount,Math.Max(1,maximum)));if(clamped!=_convertCount){_convertCount=clamped;preview=R.Meta.PreviewCollectionConversion(_card,stack.count,_convertCount);}
                        Label(info,"人物归档培养",26,true);Label(info,"消耗卡牌，首次转化永久收录图鉴。",20,false,Muted);
                        Fact(info,"实际经验",preview.actualXp+" XP");Fact(info,"末张溢出",preview.overflowXp+" XP");Fact(info,"人物等级","Lv."+preview.beforeLevel+" → Lv."+preview.afterLevel);Fact(info,"消耗数量",_convertCount+" / "+stack.count);
                        if(!preview.canConvert)Label(info,preview.reason,20,false,Muted);
                        var step=Row(info,"conversion-quantity",12,54);var minus=Command(step,"−",()=>{if(!BeginOperation())return;_convertCount--;Rebuild();});minus.interactable=_convertCount>1;Label(step,_convertCount.ToString(),22,true);var plus=Command(step,"＋",()=>{if(!BeginOperation())return;_convertCount++;Rebuild();});plus.interactable=_convertCount<maximum;
                        var confirm=Command(info,"确认消耗并转化",()=>{if(!BeginOperation())return;if(!R.Meta.TryConvertCollection(_card.id,_convertCount,out var why,_stackKey)){Notify(why);return;}Done("人物培养完成，图鉴进度已保存");},true);confirm.interactable=preview.canConvert;
                        Command(info,"取消转化",()=>{if(!BeginOperation())return;_converting=false;Rebuild();});return;
                    }
                    if(!R.Meta.IsCollectible(_card)||_base.IsCollected(_card))
                        Command(info,protect?"取消保护":"保护卡牌",()=>{if(!BeginOperation())return;if(!R.Base.TrySetProtection(_card,!protect,out var why)){Notify(why);return;}R.Audio.PlaySfx("ding");R.Meta.CheckUnlocks();Rebuild();_refresh?.Invoke();});
                    if(R.Meta.IsCollectible(_card))
                    {var convert=Command(info,"转化为人物经验 →",()=>{if(!BeginOperation())return;_converting=true;_convertCount=1;Rebuild();},true);convert.interactable=!protect&&ConversionMax(stack)>0;}
                    Command(info,"返回仓库",Close);
                }
                finally
                {
                    _operationText=Label(info,_operationNotice??"",18,false,Ink("#E3A486"));_operationText.name="inventory-operation-notice";
                    _operationText.supportRichText=false;PaintOperationNotice();
                }
            }
            int ConversionMax(StashStack stack)
            {
                return R.Meta.PreviewCollectionConversion(_card,stack.count).maxCount;
            }
            void UseMaterial(bool all){if(!BeginOperation())return;if(!R.Base.TryUseStashMaterial(_card.name,all,out var why,_stackKey)){Notify(why);return;}Done("物资已入账");}
        }
    }
}
