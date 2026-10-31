// extraction-rewards-view.js and retained extraction-stash-update.js. Commands own all capacity and persistence.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.Run;
using Sdt.UI.Kit;
using V=Sdt.UI.Screens.Run.CurrentSettlementView;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentExtractionPage:MonoBehaviour
    {
        sealed class Cell {public RectTransform root;public Text count;public Button deposit;public string key;}
        readonly Dictionary<string,Cell> _cells=new Dictionary<string,Cell>(),_savedCells=new Dictionary<string,Cell>();
        ExtractResult _result;string _identity,_confirmation;int? _slot;bool _saving,_savedOpen,_otherOpen;
        RectTransform _root,_footer,_side;ScrollRect _scroll,_sideScroll,_confirmScroll;Text _count,_notice,_capacity,_room,_other,_finishNote,_confirmList;
        Button _all,_rarity,_value,_finish,_back,_confirm,_savedToggle;Image _meter;GameObject _empty;Text _emptyLabel;readonly List<Button> _pocketButtons=new List<Button>();
        static string Signature(ExtractResult r)=>string.Join("|",r.Left.Select(s=>CurrentSettlementLogic.SourceKey(s)+":"+s.count));
        public void Initialize(Transform host)
        {
            _root=V.Box(host,"exMain",0,0,0,0);UiStack.Stretch(_root);V.Background(_root);
            V.Text(_root,"exr-success-title","整理战利品",64,48,1200,74,60);
            V.Paint(V.Box(_root,"header-rule",64,143,1792,1),"#879ba640");
            _count=V.Text(_root,"exr-section-title","",70,170,1300,55,28);_notice=V.Text(_root,"exr-notice","",70,227,1368,34,20,"#cfdbc9");
            _scroll=V.Scroll(_root,"exr-card-scroll",Vector2.zero,Vector2.one,new Vector2(68,160),new Vector2(-424,-270));
            _empty=V.Box(_scroll.content,"exr-empty",0,0,1400,320).gameObject;CurrentRunHudView.Art(_empty.transform,"archive",Sdt.Res.Res.Ui("archive"),673,90,54,54);_emptyLabel=V.Text(_empty.transform,"empty-title","本次没有待入库卡牌",0,170,1400,50,30,"#d0ded3");_emptyLabel.alignment=TextAnchor.MiddleCenter;
            _side=V.Box(_root,"exr-sidebar",1536,170,320,700);V.Paint(V.Box(_side,"sidebar-rule",-28,0,1,700),"#879ba640");
            _capacity=V.Text(_side,"exr-capacity","",0,0,320,45,24);V.Paint(V.Box(_side,"capacity-track",0,60,320,5),"#9aafb729");_meter=V.Paint(V.Box(_side,"capacity-meter",0,60,320,5),"#b6cbd7");
            _room=V.Text(_side,"capacity-room","",0,78,320,80,22,"#b6cbd7");
            _all=V.Button(_side,"exAll","全部入库",0,170,320,68,()=>Store("all"),true);
            _rarity=V.Button(_side,"exRarity","按稀有度入库",0,250,320,68,()=>Store("rarity"),true);
            _value=V.Button(_side,"exSmart","按估值入库",0,330,320,54,()=>Store("value"));
            _sideScroll=V.Scroll(_side,"exr-sidebar-scroll",Vector2.zero,Vector2.one,Vector2.zero,new Vector2(0,-418));
            var toggle=V.Button(_sideScroll.content,"exr-storage-details","其他收获与去向",0,0,320,46,()=>{_otherOpen=!_otherOpen;RefreshOther();});
            _other=V.Text(_sideScroll.content,"other-rewards","",0,62,308,560,18,"#b9c6cc");
            _footer=V.Box(_root,"exr-footer",64,0,1792,120);_footer.anchorMin=_footer.anchorMax=new Vector2(0,0);_footer.pivot=Vector2.zero;_footer.anchoredPosition=new Vector2(64,32);
            V.Paint(V.Box(_footer,"footer-rule",0,0,1792,1),"#879ba640");_finishNote=V.Text(_footer,"exr-finish-note","",0,22,1250,70,23,"#e2b7a2");
            _finish=V.Button(_footer,"exFinish","完成整理",1400,22,392,68,RequestFinish,true);
            _confirmScroll=V.Scroll(_footer,"exr-confirm-list",new Vector2(0,1),Vector2.one,new Vector2(0,-205),new Vector2(0,-90));_confirmScroll.content.sizeDelta=new Vector2(0,120);_confirmList=V.Text(_confirmScroll.content,"loss-list","",0,0,1776,120,20,"#d3c3bb");
            _back=V.Button(_footer,"exCancelFinish","返回整理",1060,222,320,68,()=>{_confirmation=null;Refresh(_result);EventSystem.current?.SetSelectedGameObject(_finish.gameObject);},true);
            _confirm=V.Button(_footer,"exConfirmFinish","",1396,222,396,68,Finish,false,true);
            _identity=GameRuntime.I.CurrentExtractionIdentity;_slot=GameRuntime.I.ActiveSlot;
        }
        bool Current()=>isActiveAndEnabled&&_identity==GameRuntime.I.CurrentExtractionIdentity&&_slot==GameRuntime.I.ActiveSlot&&UiStack.Top is ExtractStashScreen;
        Cell CreateCell(Transform parent,string key,StashStack stack,bool saved)
        {
            var cell=new Cell{key=key,root=V.Box(parent,"exr-item-"+key,0,0,260,450)};
            V.Paint(V.Box(cell.root,"rarity-mark",6,12,26,3),Sdt.UI.Screens.Run.CardVisual.Pigment(Sdt.UI.Screens.Run.CardVisual.FrameKey(stack.card)));
            cell.count=V.Text(cell.root,"stack-count","",158,0,96,35,24);cell.count.alignment=TextAnchor.MiddleRight;
            var preview=V.Button(cell.root,"exInspect","",6,40,248,347,()=>CurrentSettlementCardZoom.Show(stack.card));preview.GetComponent<Image>().color=Color.clear;var outline=preview.GetComponent<Outline>();if(outline!=null)outline.enabled=false;
            var face=CardFace.Create(stack.card,CardSize.Lg,preview.transform);var fr=(RectTransform)face.transform;fr.anchorMin=fr.anchorMax=new Vector2(.5f,.5f);fr.anchoredPosition=Vector2.zero;fr.localScale=Vector3.one*(248f/220);
            foreach(var graphic in face.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;
            if(!saved)cell.deposit=V.Button(cell.root,"exStash","入库",6,399,248,50,()=>StoreOne(key));
            return cell;
        }
        void SyncCells(Dictionary<string,Cell> cells,IEnumerable<StashStack> input,float offset,bool saved)
        {
            var ordered=input.Select((s,i)=>new{stack=s,index=i}).OrderByDescending(x=>CurrentSettlementLogic.RarityRank(x.stack.card)).ThenBy(x=>x.index).ToList();var keys=new HashSet<string>();
            for(int i=0;i<ordered.Count;i++){
                var stack=ordered[i].stack;string key=CurrentSettlementLogic.SourceKey(stack);keys.Add(key);if(!cells.TryGetValue(key,out var cell)){cell=CreateCell(_scroll.content,key,stack,saved);cells.Add(key,cell);}
                cell.root.anchoredPosition=new Vector2(i%5*288,-(offset+i/5*478));cell.root.gameObject.SetActive(!saved||_savedOpen);cell.count.text="×"+stack.count;
                if(cell.deposit!=null){int take=Math.Min(stack.count,_result.StashRoom);cell.deposit.interactable=take>0&&!_saving&&_confirmation==null;cell.deposit.GetComponentInChildren<Text>().text=take<=0?"仓库已满":take<stack.count?"入库 "+take+"/"+stack.count+" 张":"入库 "+take+" 张";}
            }
            foreach(var key in cells.Keys.Where(k=>!keys.Contains(k)).ToList()){var cell=cells[key];var selected=EventSystem.current?.currentSelectedGameObject;if(selected!=null&&selected.transform.IsChildOf(cell.root))EventSystem.current.SetSelectedGameObject(null);Destroy(cell.root.gameObject);cells.Remove(key);}
        }
        public void Refresh(ExtractResult result)
        {
            if(result==null)return;_result=result;int remaining=result.Left.Sum(s=>s.count),saved=result.SavedCards.Sum(s=>s.count);bool allFit=remaining>0&&result.StashRoom>=remaining,confirming=_confirmation!=null&&remaining>0;
            _count.text="待入库  <size=40>"+remaining+"</size><size=21> 张</size>";_capacity.text="仓库容量     <size=34>"+result.StashUsed+"</size><size=19> / "+result.StashCap+" 格</size>";_room.text=(result.StashRoom>0?"还能入库 "+result.StashRoom+" 张":"仓库已满")+"\n<size=17>卡牌每张、符文每块各占1格</size>";
            _meter.rectTransform.sizeDelta=new Vector2(320*Mathf.Clamp01((float)result.StashUsed/Math.Max(1,result.StashCap)),5);
            _all.gameObject.SetActive(allFit);_all.GetComponentInChildren<Text>().text="全部入库 "+remaining+" 张";_value.gameObject.SetActive(!allFit&&remaining>0);_rarity.gameObject.SetActive(remaining>0);
            _rarity.GetComponentInChildren<Text>().text="按稀有度入库 "+Math.Min(remaining,result.StashRoom)+" 张";_rarity.GetComponent<RectTransform>().anchoredPosition=new Vector2(0,allFit?-250:-170);_value.GetComponent<RectTransform>().anchoredPosition=new Vector2(0,-250);
            _all.interactable=_rarity.interactable=_value.interactable=result.StashRoom>0&&!_saving&&!confirming;
            float gridHeight=result.Left.Count>0?Mathf.Ceil(result.Left.Count/5f)*478:320;SyncCells(_cells,result.Left,0,false);_empty.SetActive(result.Left.Count==0);_emptyLabel.text=saved>0?"卡牌已妥善入库":"本次没有待入库卡牌";
            if(_savedToggle==null)_savedToggle=V.Button(_scroll.content,"exr-saved-shelf","",0,0,1400,50,()=>{_savedOpen=!_savedOpen;Refresh(_result);});
            _savedToggle.gameObject.SetActive(saved>0);_savedToggle.GetComponent<RectTransform>().anchoredPosition=new Vector2(0,-(gridHeight+24));_savedToggle.GetComponentInChildren<Text>().text=(_savedOpen?"▾ ":"▸ ")+"本次已入库 "+saved+" 张";
            SyncCells(_savedCells,result.SavedCards,gridHeight+90,true);_scroll.content.sizeDelta=new Vector2(0,Mathf.Max(400,gridHeight+(saved>0?90:0)+(_savedOpen?Mathf.Ceil(result.SavedCards.Count/5f)*478:0)));
            _finishNote.text=confirming?"<b>这些卡牌将永久散失</b>\n<size=18>出发带入卡同样适用，完成后无法取回。</size>":remaining>0?"完成时将丢失 "+remaining+" 张未入库卡\n<size=18>永久失去；带入卡同样适用</size>":"本次已入库 "+saved+" 张\n<size=18>已保存至基地仓库</size>";
            _finish.GetComponentInChildren<Text>().text=remaining>0?"放弃 "+remaining+" 张并完成  →":"完成整理  →";_finish.gameObject.SetActive(!confirming);_finish.interactable=!_saving;
            _confirmScroll.gameObject.SetActive(confirming);_back.gameObject.SetActive(confirming);_confirm.gameObject.SetActive(confirming);_confirm.interactable=!_saving;
            if(confirming){_confirmList.text=string.Join("\n",result.Left.Select(s=>s.card.name+"    ×"+s.count));_confirmScroll.content.sizeDelta=new Vector2(0,result.Left.Count*30);_confirmList.rectTransform.sizeDelta=new Vector2(1776,result.Left.Count*30);_confirm.GetComponentInChildren<Text>().text="确认放弃 "+remaining+" 张并完成";}
            _footer.sizeDelta=new Vector2(1792,confirming?300:120);_scroll.GetComponent<RectTransform>().offsetMin=new Vector2(68,confirming?340:160);RefreshOther();
            _scroll.GetComponent<RectTransform>().offsetMax=new Vector2(-424,string.IsNullOrEmpty(_notice.text)?-240:-282);
        }
        void RefreshOther()
        {
            _other.gameObject.SetActive(_otherOpen);if(_result==null)return;var r=_result;var lines=new List<string>();
            if(r.WoodN>0||r.RatN>0)lines.Add("<b>资源已入库</b>\n木材 ×"+r.WoodN+"　口粮 ×"+r.RatN);
            if(r.PocketKept>0||r.PocketLost>0)lines.Add("<b>待复原 "+r.PocketKept+" 张</b>\n已送至基地消耗区，用钥匙复原后才能携带。\n逐张 1/3 概率保留 · 概率散失 "+Math.Max(0,r.PocketLost-r.PocketRuleLost)+" 张"+(r.PocketRuleLost>0?"；初始攻击/职业卡 "+r.PocketRuleLost+" 张不可带回":""));
            if(r.Coins>0)lines.Add("随身币 "+r.Coins+" 币不带回基地。");if(r.ShaN>0)lines.Add("初始攻击 ×"+r.ShaN+" 不可入库；每局自动携带 "+Sdt.Core.GameRules.StarterSha+" 张。");if(r.OtherN>0)lines.Add("其余物资 ×"+r.OtherN+" 未能带出。");
            _other.text=string.Join("\n\n",lines);_other.lineSpacing=1.6f;float height=Mathf.Max(80,_other.preferredHeight+8);_other.rectTransform.sizeDelta=new Vector2(308,height);
            for(int i=0;i<r.KeptPocket.Count;i++){int index=i;if(_pocketButtons.Count<=i)_pocketButtons.Add(V.Button(_sideScroll.content,"exPocketInspect-"+i,"",0,0,308,40,()=>CurrentSettlementCardZoom.Show(_result.KeptPocket[index].card)));var button=_pocketButtons[i];button.GetComponent<RectTransform>().anchoredPosition=new Vector2(0,-(height+74+i*44));button.GetComponentInChildren<Text>().text=r.KeptPocket[i].card.name+" ×"+r.KeptPocket[i].count;button.gameObject.SetActive(_otherOpen);}
            for(int i=r.KeptPocket.Count;i<_pocketButtons.Count;i++)_pocketButtons[i].gameObject.SetActive(false);_sideScroll.content.sizeDelta=new Vector2(0,_otherOpen?height+80+r.KeptPocket.Count*44:48);
        }
        void StoreOne(string key){var stack=_result.Left.FirstOrDefault(s=>CurrentSettlementLogic.SourceKey(s)==key);if(stack==null)return;StoreSelections(new[]{new ExtractionSelection{name=stack.card.name,sourceKey=key,count=Math.Min(stack.count,_result.StashRoom)}});}
        void Store(string order){if(order=="all"&&_result.Left.Sum(s=>s.count)>_result.StashRoom)return;StoreSelections(CurrentSettlementLogic.SelectOrdered(_result.Left,_result.StashRoom,order));}
        void StoreSelections(IEnumerable<ExtractionSelection> selections)
        {
            if(!Current()||_saving||_confirmation!=null)return;_saving=true;float scroll=_scroll.verticalNormalizedPosition;var result=GameRuntime.I.ExtractStore(selections,_identity,_slot);_saving=false;
            if(result==null){_notice.text="入库尚未保存："+GameRuntime.I.SettlementError+"。原选择仍保留。";Refresh(GameRuntime.I.CurrentExtraction??_result);}
            else{_notice.text="入库选择已保存。";Refresh(result);} _scroll.verticalNormalizedPosition=scroll;
        }
        void RequestFinish(){if(!Current()||_saving)return;if(_result.Left.Count==0){Finish();return;}_confirmation=Signature(_result);Refresh(_result);EventSystem.current?.SetSelectedGameObject(_back.gameObject);}
        void Finish()
        {
            if(!Current()||_saving)return;var live=GameRuntime.I.CurrentExtraction;if(_confirmation!=null&&Signature(live)!=_confirmation){_confirmation=null;Refresh(live);_notice.text="待入库卡牌已变化，请重新确认。";return;}
            _saving=true;var result=GameRuntime.I.FinishExtract(_confirmation!=null);_saving=false;if(result==null){_notice.text="完成整理尚未保存："+GameRuntime.I.SettlementError+"。已入库的卡牌仍保留。";_confirmation=null;Refresh(GameRuntime.I.CurrentExtraction??_result);}
        }
    }
}
