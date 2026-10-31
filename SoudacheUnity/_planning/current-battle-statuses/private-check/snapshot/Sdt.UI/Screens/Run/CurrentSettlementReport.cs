using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;
using V=Sdt.UI.Screens.Run.CurrentSettlementView;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentSettlementReport:MonoBehaviour
    {
        Panel _owner;Text _notice;bool _busy;RectTransform _body;float _height,_contentWidth;
        void NoticeRoot(Transform host,float x,float y,float w)=>_notice=V.Text(host,"operation-notice","",x,y,w,42,18,"#e5b4a4");
        public void Navigate(Action action)
        {
            if(_busy||UiStack.Top!=_owner)return;_busy=true;var before=UiStack.CapturePanels();var buttons=_owner.GetComponentsInChildren<Button>();var enabled=buttons.Select(b=>b.interactable).ToArray();for(int i=0;i<buttons.Length;i++)buttons[i].interactable=false;
            try{action();if(UiStack.Top==_owner)throw new InvalidOperationException("结果页面尚未打开");UiStack.Close(_owner);}
            catch(Exception error){foreach(var panel in UiStack.CapturePanels().Where(p=>!before.Contains(p)).ToArray())UiStack.Close(panel);Debug.LogException(error);_notice.text="结算已完成，暂时无法打开该页面，请重试。";for(int i=0;i<buttons.Length;i++)if(buttons[i]!=null)buttons[i].interactable=enabled[i];}
            finally{_busy=false;}
        }
        Text Paragraph(string name,string value,int size=20,string color="#c5d1cd",float height=60)
        {var text=V.Text(_body,name,value,0,_height,_contentWidth,height,size,color);text.lineSpacing=1.45f;height=Mathf.Max(height,text.preferredHeight+6);text.rectTransform.sizeDelta=new Vector2(_contentWidth,height);_height+=height+18;return text;}
        void Growth(RunGrowthReceipt g)
        {
            if(g?.before==null||g.after==null)return;
            Paragraph("exr-growth-heading","<b>"+g.characterName+"</b>     "+(g.before.lv==g.after.lv?"Lv."+g.after.lv:"Lv."+g.before.lv+" → Lv."+g.after.lv)+(g.maxed?" · MAX":""),22,"#c6dbcc",34);
            V.Paint(V.Box(_body,"xp-track",0,_height,680,6),"#9aafb729");float progress=g.maxed?1:(float)g.after.xp/Math.Max(1,g.nextLevelXp??1);V.Paint(V.Box(_body,"xp-progress",0,_height,680*Mathf.Clamp01(progress),6),"#b6cbd7");_height+=22;
            Paragraph("exr-growth-note",(g.maxed?"已满级":g.after.xp+" / "+g.nextLevelXp+" XP")+"　· 本次结算 +"+g.actualXp+" XP",17,"#b9c6cc",30);
            if(g.after.lv>g.before.lv)Paragraph("exr-growth-effects","出征生命加成     +"+Math.Max(0,g.before.lv-1)+" → +"+Math.Max(0,g.after.lv-1),19,"#c6dbcc",32);
        }
        void Memento(SettlementReceipt receipt,bool failed)
        {string text=V.Memento(receipt,failed);if(text.Length>0)Paragraph("run-memento",text,20,"#eef1ed",96+(receipt.memento.trail.Count>0?38:0)+receipt.memento.moments.Count*34);}
        void Disclosure(string name,string label,string detail,float height,Action<Transform> extra=null)
        {
            float top=_height;bool open=false;var group=V.Box(_body,name+"-section",0,top,_contentWidth,62);var region=V.Box(group,name+"-body",0,56,_contentWidth,height);region.gameObject.SetActive(false);V.Text(region,"details",detail,0,0,_contentWidth,height,18,"#b9c6cc");extra?.Invoke(region);
            V.Button(group,name,label,0,0,_contentWidth,48,()=>{open=!open;float delta=open?height+12:-(height+12);region.gameObject.SetActive(open);foreach(RectTransform child in _body)if(child!=group&&child.anchoredPosition.y<group.anchoredPosition.y)child.anchoredPosition+=new Vector2(0,-delta);_height+=delta;_body.sizeDelta=new Vector2(0,_height);});_height+=62;
        }
        public void BuildExtraction(Panel owner,ExtractResult result)
        {
            _owner=owner;var receipt=result?.Receipt??new SettlementReceipt();var root=V.Box(owner.transform,"exDone",0,0,0,0);UiStack.Stretch(root);V.Background(root);
            V.Text(root,"exr-success-title",receipt.outcome=="clear"?"首脑突破":"撤离成功",140,64,1100,64,48);
            V.Text(root,"exr-done-meta","第 "+receipt.layersReached+" 层 · "+result?.TimeStr,1400,84,380,38,18,"#bacbd0");V.Paint(V.Box(root,"header-rule",140,152,1640,1),"#bfd6e030");
            var totals=V.Box(root,"exr-totals",140,180,1640,152);V.Paint(totals,"#bcd8e30b");string[] labels={"卡牌入库","木材","口粮","人物经验"};string[] values={(receipt.netTake?.cardsStashed??0)+" 张","+"+(receipt.netTake?.wood??0),"+"+(receipt.netTake?.rations??0),"+"+(receipt.growth?.actualXp??receipt.firstExplore?.xp??0)};
            for(int i=0;i<4;i++){V.Text(totals,"total-label-"+i,labels[i],32+i*400,22,360,28,18,"#c1cdd0");V.Text(totals,"total-value-"+i,values[i],32+i*400,62,360,58,44,"#e7e7d7");}
            var scroll=V.Scroll(root,"exr-done-content",Vector2.zero,Vector2.one,new Vector2(144,150),new Vector2(-152,-364));_body=scroll.content;_height=0;_contentWidth=1624;Growth(receipt.growth);Memento(receipt,false);
            if(receipt.savedCards.Count>0)Disclosure("exr-done-cards","入库卡牌",string.Join("　",receipt.savedCards.Select(s=>s.card.name+" ×"+s.count)),Mathf.Ceil(receipt.savedCards.Count/6f)*355+50,host=>{
                for(int i=0;i<receipt.savedCards.Count;i++){var stack=receipt.savedCards[i];var button=V.Button(host,"exDoneInspect-"+i,"",i%6*244,48+i/6*355,220,308,()=>CurrentSettlementCardZoom.Show(stack.card));button.GetComponent<Image>().color=Color.clear;var face=CardFace.Create(stack.card,CardSize.Lg,button.transform);var rt=(RectTransform)face.transform;rt.anchorMin=rt.anchorMax=new Vector2(.5f,.5f);rt.anchoredPosition=Vector2.zero;foreach(var graphic in face.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;}
            });
            var loss=receipt.losses??new SettlementLosses();int lost=loss.lostCount+loss.pocketLost;
            if((receipt.netTake?.pocketKept??0)>0||lost>0)Disclosure("exr-receipt-details","待复原 "+(receipt.netTake?.pocketKept??0)+" 张"+(lost>0?" · 散失 "+lost+" 张":""),"保留的消耗牌已送至基地消耗区，可用钥匙复原。\n未入库 "+loss.lostCount+" 张 · 消耗区散失 "+loss.pocketLost+" 张\n"+string.Join("、",loss.lostNotable.Select(c=>c.name+" ×"+c.count)),150);
            _body.sizeDelta=new Vector2(0,_height);V.Text(root,"exr-saved-state","[[icon:check]] 已保存",140,974,1000,50,17,"#afcabd");
            V.Button(root,"goBase","返回基地  →",1540,970,240,68,()=>Navigate(()=>GameRuntime.I.OpenHub("deploy")),true);NoticeRoot(root,140,1028,1400);
        }
        public void BuildDeath(Panel owner,DeathResult result)
        {
            _owner=owner;var receipt=result?.Receipt??new SettlementReceipt();var root=V.Box(owner.transform,"death-overlay",0,0,0,0);UiStack.Stretch(root);V.Paint(root,"#050b13b8");
            var panel=V.Box(root,"settlement-report",0,0,1000,960);panel.anchorMin=panel.anchorMax=new Vector2(.5f,.5f);panel.pivot=new Vector2(.5f,.5f);panel.anchoredPosition=Vector2.zero;V.Paint(panel,"#13232bf2");
            var banner=V.Box(panel,"settlement-banner",32,32,264,100);var image=UIKit.GetOrAdd<Image>(banner);var texture=Resources.Load<Texture2D>("Art/Current/Settlement/rewards-convoy-fail");if(texture!=null)image.sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),100);image.preserveAspect=true;image.raycastTarget=false;
            V.Text(panel,"settlement-title","撤离失败",320,32,648,56,36,"#edaaa0");V.Text(panel,"settlement-subtitle",(receipt.endReason??"生命归零；未提供具体受伤来源")+" · 远征到此为止",320,92,648,58,20,"#c5d1cd");
            var scroll=V.Scroll(panel,"settlement-content",Vector2.zero,Vector2.one,new Vector2(32,148),new Vector2(-32,-172));_body=scroll.content;_height=0;_contentWidth=936;
            Paragraph("ui-facts","卡牌散失  <size=34>"+(receipt.losses?.lostCount??0)+" 张</size>            抢运回基地  <size=34>"+(receipt.netTake?.cardsStashed??result?.SavedN??0)+" 张</size>",22,"#e4e9e7",62);
            Paragraph("settlement-notes","消耗区另散失 "+(receipt.losses?.pocketLost??0)+" 张 · 散装物资估值损失 "+(result?.LostValue??0).ToString("N0")+"\n安全格占用 "+CardContainerCommands.Query(GameRuntime.I).safeUsed+"/"+GameRuntime.I.SafeCap,18,"#b9c6cc",70);
            var review=receipt.battleReview;
            if(review==null)Paragraph("settlement-review","<b>结束原因</b>\n"+(receipt.endReason??"生命归零；未提供具体受伤来源")+"\n<size=17>本次没有战斗摘要，不推算敌人状态或承伤来源。</size>",20,"#c5d1cd",110);
            else{
                Paragraph("settlement-review","<b>战斗复盘 · 最后第 "+review.round+" 回合</b>\n"+(review.isBoss?"首脑":"敌方")+"剩余："+(review.foes.Count==0?"无存活敌人":string.Join("、",review.foes.Select(f=>f.name+" "+Math.Max(0,f.hp)+"/"+f.maxHp+" 生命"))),20,"#c5d1cd",90);
                string sources=string.Join("、",review.hits.GroupBy(h=>h.source).Select(g=>new{name=g.Key,damage=g.Sum(h=>h.damage)}).OrderByDescending(h=>h.damage).Select(h=>h.name+" "+h.damage));
                Disclosure("settlement-damage-details","承伤来源与记录范围","已归因承伤："+(sources.Length>0?sources:"未记录到已覆盖来源的生命伤害")+(string.IsNullOrEmpty(review.coverage)?"":"\n"+review.coverage),110);
            }
            Growth(result?.Growth);Memento(receipt,true);
            Disclosure("settlement-details","物资明细与保留规则","散装物资估值损失："+(result?.LostValue??0).ToString("N0")+"（不含卡牌）。\n散装物资散失："+string.Join("、",GameRuntime.I.State.inventory.Select(i=>i.name+" ×"+i.count))+"\n已抢运卡牌："+string.Join("、",result?.SavedStacks.Select(s=>s.card.name+" ×"+s.count)??Enumerable.Empty<string>())+"\n木材、口粮、钥匙资源卡入基地仓库后，需在仓库“使用”才折入基地材料数字；散装木材与口粮仅在成功撤离时直接折入。",440,host=>{
                for(int i=0;i<Math.Min(6,result?.SavedStacks.Count??0);i++){var stack=result.SavedStacks[i];var b=V.Button(host,"rescued-card-"+i,"",i*114,260,96,134,()=>CurrentSettlementCardZoom.Show(stack.card));b.GetComponent<Image>().color=Color.clear;var face=CardFace.Create(stack.card,CardSize.Sm,b.transform);var rt=(RectTransform)face.transform;rt.anchorMin=rt.anchorMax=new Vector2(.5f,.5f);rt.anchoredPosition=Vector2.zero;foreach(var graphic in face.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;}
            });
            _body.sizeDelta=new Vector2(0,_height);V.Button(panel,"goBase","回基地",32,844,452,62,()=>Navigate(()=>GameRuntime.I.OpenHub("deploy")));V.Button(panel,"again","再出发",500,844,468,62,()=>Navigate(()=>GameRuntime.I.OpenHub("departure")),true);NoticeRoot(panel,32,912,936);
        }
    }
}
