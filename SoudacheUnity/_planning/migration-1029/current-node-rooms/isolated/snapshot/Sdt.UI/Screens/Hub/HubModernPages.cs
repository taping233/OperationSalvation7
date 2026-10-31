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
        void BuildTrade(Transform page)
        {
            var layout=Row(page,"trade-v12-layout",20);Fill((RectTransform)layout);
            SourceColumns(layout,new[]{166f,0,480},new[]{0f,0,0},new[]{0f,1,0},20);
            var modes=Column(layout,"trade-v5-modes",8,new RectOffset(8,8,14,14));Surface(modes);Bounds(modes.gameObject,166,0,0,1);
            Command(modes,"▣ 购入商品",()=>{_tradeMode="buy";_tradeKey="";Rebuild();},_tradeMode=="buy");
            Command(modes,"⇄ 出售卡牌",()=>{_tradeMode="sell";_tradeKey="";Rebuild();},_tradeMode=="sell");
            Command(modes,"▦ 后勤仓库",()=>{_warehouseView="cards";Navigate("stash");});
            var rail=Column(layout,"trade-v5-rail",16);Bounds(rail.gameObject,0,0,1,1);
            var categories=Row(rail,"trade-v12-categories",4,56);Surface(categories);
            foreach(var category in new[]{("","全部"),("supplies","基地补给"),("battle","战斗卡牌")})
            {string id=category.Item1;Command(categories,category.Item2,()=>{_tradeCategory=id;_tradeKey="";Rebuild();},_tradeCategory==id);}
            bool buying=_tradeMode=="buy";
            var goods=HubCatalog.Current.goods.Where(g=>_tradeCategory==""||(_tradeCategory=="supplies")==!string.IsNullOrEmpty(g.material)).ToList();
            var stacks=G.Base.stash.Where(s=>s.count>0&&s.card.id!=PetCatalog.Current.eggId&&s.card.id!="tt-econpack"&&BaseData.MaterialInfo(s.card)==null).Where(s=>_tradeCategory!="supplies").ToList();
            Label(rail,(buying?"在售商品":"仓库可售卡牌")+"    "+(buying?goods.Count:stacks.Count)+" 种",20,true);
            var shelf=Scroll(rail,"trade-v5-list");
            if(buying&&!goods.Any(g=>g.Key==_tradeKey))_tradeKey=goods.FirstOrDefault()?.Key??"";
            if(!buying&&!stacks.Any(s=>StackKey(s)==_tradeKey))_tradeKey=stacks.FirstOrDefault()!=null?StackKey(stacks[0]):"";
            int count=buying?goods.Count:stacks.Count;
            if(count>0)SourceCardGrid(shelf,false);
            for(int j=0;j<count;j++)
            {
                    var good=buying?goods[j]:null;var stack=buying?null:stacks[j];string key=buying?good.Key:StackKey(stack);
                    var card=buying?GoodCard(good):stack.card;int owned=buying?OwnedGood(good):stack.count,price=buying?good.price:CardLibrary.SellPrice(card);
                    var item=Command(shelf,"",()=>{_tradeKey=key;Rebuild();},_tradeKey==key);item.name="trade-v5-item "+key;SoftSelection(item,_tradeKey==key,.22f);
                    var info=Column(item.transform,"trade-v5-item-content",8,new RectOffset(8,8,10,0));Fill((RectTransform)info);CardArt(info,card,210,410);
                    var text=Label(info,"持有 "+owned+(stack!=null&&G.Base.IsProtected(card)?" · 收藏保护":""),22);text.alignment=TextAnchor.MiddleCenter;
                    var amount=Label(info,price+" 储备币",21);amount.alignment=TextAnchor.MiddleCenter;Bounds(amount.gameObject,0,52,1,0);
            }
            if(count==0)Label(shelf,"该类别暂无物品",22,false,Muted);
            var desk=Column(layout,"trade-v5-desk",12,new RectOffset(22,22,22,22));Surface(desk);Bounds(desk.gameObject,480,0,0,1);
            var selectedGood=buying?goods.FirstOrDefault(g=>g.Key==_tradeKey):null;var selectedStack=buying?null:stacks.FirstOrDefault(s=>StackKey(s)==_tradeKey);
            if(selectedGood==null&&selectedStack==null){Label(desk,buying?"暂无在售商品":"暂无可出售卡牌",28,true);return;}
            var selectedCard=buying?GoodCard(selectedGood):selectedStack.card;int selectedCount=buying?OwnedGood(selectedGood):selectedStack.count,selectedPrice=buying?selectedGood.price:CardLibrary.SellPrice(selectedCard);
            Label(desk,(buying?"购入商品":"出售卡牌")+" · "+(selectedGood?.material!=null?"基地物资":selectedCard.rarity+" · "+selectedCard.type),20,false,Muted);
            Label(desk,selectedGood?.name??selectedCard.name,30,true);
            var reading=Scroll(desk,"trade-v5-reading");CardArt(reading,selectedCard,220,380);Label(reading,selectedGood?.material!=null?selectedGood.tip:Sdt.Res.CurrentCardPresentation.Description(selectedCard),22);Label(reading,"当前持有 "+selectedCount,22,false,Muted);
            Rule(desk);Fact(desk,"单价",selectedPrice+" 储备币");Fact(desk,buying?"购入数量":"出售数量","1");Fact(desk,buying?"总花费":"总收入",selectedPrice+" 储备币");Fact(desk,"当前余额",G.Base.coins+" 储备币");
            if(buying)
            {
                bool full=selectedGood.material==null&&G.Base.StashRoom<1,poor=G.Base.coins<selectedPrice;
                if(full||poor)Label(desk,full?"仓库已满":"还需 "+(selectedPrice-G.Base.coins)+" 储备币",20,false,Muted);
                var purchase=Command(desk,"购入 ×1 · −"+selectedPrice+" 储备币   →",()=>{if(!G.Base.TryPurchase(selectedGood.Key,out var reason)){Log(reason,"warn");return;}Log("商品已入账","ok");Rebuild();},true);purchase.interactable=!full&&!poor;
                if(full){var links=Row(desk,"trade-v5-capacity",12,56);Command(links,"整理仓库 ↗",()=>Navigate("stash"));Command(links,"扩建 ↗",()=>{_facility="stash";Navigate("upgrade");});}
            }
            else
            {
                bool protect=G.Base.IsProtected(selectedCard);if(protect)Label(desk,"收藏卡牌受保护",20,false,Muted);
                var one=Command(desk,"出售 ×1 · +"+selectedPrice+" 币   →",()=>{},true);one.interactable=!protect&&CardLibrary.IsSellable(selectedCard);
                BindConfirm(one,()=>SellTrade(selectedStack,1));
                if(selectedCount>1){Fact(desk,"整堆 "+selectedCount+" 张收入",selectedPrice*selectedCount+" 储备币");var all=Command(desk,"整堆 ×"+selectedCount+" · +"+selectedPrice*selectedCount+" 币   →",()=>{});all.interactable=one.interactable;BindConfirm(all,()=>SellTrade(selectedStack,selectedCount));}
            }
        }
        static CardDef GoodCard(HubShopGood good) => CardLibrary.FindById(good.material=="wood"?"tt-wood":good.material=="rations"?"tt-rations":good.id);
        int OwnedGood(HubShopGood good) => good.material=="wood"?G.Base.wood:good.material=="rations"?G.Base.rations:G.Base.stash.Where(s=>s.card.id==good.id).Sum(s=>s.count);
        static int _collectionPage;
        static string StackKey(StashStack stack) => stack==null?"":stack.card.id + "::" + stack.card.name;
        void SellTrade(StashStack selected,int amount)
        {
            string key=StackKey(selected);bool ok=G.TryPersistMutation(()=>
            {
                var matches=G.Base.stash.Where(s=>StackKey(s)==key).ToArray();if(matches.Length!=1||matches[0].count<amount)throw new InvalidOperationException("库存已变化，请重新选择");
                var result=G.Base.SellStashCards(matches[0].card.name,amount);if(!result.ok)throw new InvalidOperationException(result.msg??"暂不能出售");
            },out var reason);if(!ok){Log(reason,"warn");return;}Log("出售完成","ok");Rebuild();
        }
        static void BindConfirm(Button button,Action action)
        {var owner=button.GetComponentInParent<HubScreen>();int revision=owner!=null?owner._renderVersion:0;button.onClick.RemoveAllListeners();button.gameObject.AddComponent<HubConfirmAction>().Bind(button,()=>{if(owner!=null&&!owner.CurrentHub(revision))return;action?.Invoke();});}
        void BuildCollectionRoom(Transform page)
        {
            var layout=Row(page,"av12-workspace",22);Fill((RectTransform)layout);
            SourceColumns(layout,new[]{184f,0},new[]{0f,0},new[]{0f,1},22);
            var directory=Column(layout,"av12-directory",0,new RectOffset(10,10,14,14));Surface(directory);Bounds(directory.gameObject,184,0,0,1);
            int number=0;
            foreach(var section in new[]{("cards","已收藏"),("rewards","奖励"),("achievements","成就目标"),("classes","收藏里程碑"),("backs","卡背"),("stories","故事")})
            {string key=section.Item1;DirectoryEntry(directory,++number,section.Item2,()=>{if(key=="achievements")_achievementReturn=_archiveView=="backs"?"backs":"rewards";_archiveView=key;Rebuild();},key==_archiveView);}
            var content=Column(layout,"av12-content",16);Bounds(content.gameObject,0,0,1,1);
            switch(_archiveView)
            {case "cards":BuildOwnedGallery(content);break;case "rewards":BuildRewards(content);break;case "classes":BuildMilestones(content);break;case "backs":BuildBacks(content);break;case "stories":BuildStories(content);break;default:BuildAch(content);break;}
        }
        void BuildOwnedGallery(Transform parent)
        {
            // Permanent dictionary is authoritative even after the final stash copy is consumed/converted.
            var records=G.Base.collection.Where(pair=>pair.Value!=null).Select(pair=>new {id=pair.Key,record=pair.Value,card=CardLibrary.FindById(pair.Key)??G.Base.stash.FirstOrDefault(s=>s.card.id==pair.Key)?.card}).ToList();
            var tools=Row(parent,"collection-browse-tools",12,54);
            Input(tools,"搜索收藏卡牌",_collectionQuery,v=>{_collectionQuery=v;_collectionPage=0;Rebuild();});Filter(tools,"全部类型",_collectionType,records.Select(r=>r.card?.type),v=>{_collectionType=v;_collectionPage=0;Rebuild();});
            var filtered=records.Where(r=>(string.IsNullOrEmpty(_collectionQuery)||(r.card?.name??r.record.name??r.id).IndexOf(_collectionQuery,StringComparison.OrdinalIgnoreCase)>=0)&&(string.IsNullOrEmpty(_collectionType)||r.card?.type==_collectionType)).ToList();
            Label(parent,_collectionQuery==""&&_collectionType==""?records.Count+" 张已收藏":"匹配 "+filtered.Count+" / 已收藏 "+records.Count,20,false,Muted);
            if(filtered.Count==0){Label(parent,records.Count==0?"尚未收藏卡牌":"没有匹配的收藏卡牌",28,true);if(records.Count==0)Label(parent,"在仓库收藏卡牌。",22,false,Muted);Command(parent,records.Count==0?"前往仓库 →":"显示全部收藏",()=>{if(records.Count==0){Navigate("stash");return;}_collectionQuery=_collectionType="";Rebuild();});return;}
            var chosen=filtered.FirstOrDefault(r=>r.id==_collectionId)??filtered[0];_collectionId=chosen.id;
            var stage=Row(parent,"collection-v12-stage",30);Bounds(stage.gameObject,0,350,1,1);Surface(stage);var display=Column(stage,"collection-v12-display",12);Bounds(display.gameObject,0,350,1,1);CardArt(display,chosen.card,230,345);
            var info=Column(stage,"collection-v12-info",16,new RectOffset(24,24,24,24));Label(info,chosen.card?.name??chosen.record.name??chosen.id,28,true);
            if(chosen.card!=null){Fact(info,"类型",chosen.card.type??"卡牌");Fact(info,"稀有度",chosen.card.rarity??"—");Command(info,"详情 →",()=>HubInventoryCardScreen.Open(chosen.card,null,false,true));}else Label(info,"旧收藏档案",22,false,Muted);
            var shelf=Column(parent,"collection-owned",12,new RectOffset(14,14,14,14));Surface(shelf);Bounds(shelf.gameObject,0,228,1,0);
            float canvasWidth=GetComponentInParent<Canvas>().GetComponent<RectTransform>().rect.width;int perPage=Math.Max(1,Mathf.FloorToInt((canvasWidth-360)/127));
            int pages=Math.Max(1,(filtered.Count+perPage-1)/perPage);_collectionPage=Mathf.Clamp(_collectionPage,0,pages-1);
            var row=Row(shelf,"collection-card-row",12,164);
            foreach(var record in filtered.Skip(_collectionPage*perPage).Take(perPage)){var item=record;SelectableCard(row,item.card,item.card?.name??item.record.name??item.id,item.id==_collectionId,()=>{_collectionId=item.id;Rebuild();},115,164);}
            var pager=Row(shelf,"card-browser-footer",12,42);var previous=Command(pager,"‹",()=>{_collectionPage--;Rebuild();});previous.interactable=_collectionPage>0;Bounds(previous.gameObject,56,42,0,0);
            var position=Label(pager,(_collectionPage+1)+" / "+pages,19,false,Muted);position.alignment=TextAnchor.MiddleCenter;var next=Command(pager,"›",()=>{_collectionPage++;Rebuild();});next.interactable=_collectionPage<pages-1;Bounds(next.gameObject,56,42,0,0);
        }


        static string RewardText(AchievementDef a)
        {return string.Join(" · ",new[]{a.reward?.wood>0?"木材 ×"+a.reward.wood:"",a.reward?.rations>0?"口粮 ×"+a.reward.rations:"",a.reward?.keys>0?"钥匙 ×"+a.reward.keys:"",!string.IsNullOrEmpty(a.reward?.card)?"卡牌 · "+(CardLibrary.FindById(a.reward.card)?.name??a.reward.card):"",!string.IsNullOrEmpty(a.back)?"卡背 · "+a.back:""}.Where(v=>v!=""));}
        void ClaimAchievement(string id){var result=G.Meta.Claim(id);if(!result.ok){Log(result.msg,"warn");return;}Log("奖励已入账","ok");Rebuild();}


        static int _storySegment;
        void BuildStories(Transform parent)
        {
            if(!G.Base.TryReadLastLamp(out var state,out var reason)){Label(parent,reason+"；原记录已保留",22,false,Muted);Command(parent,"重新读取",Rebuild);return;}
            var workspace=Row(parent,"story-workspace",20);var directory=Column(workspace,"story-list",12);Bounds(directory.gameObject,240,0,0,1);
            for(int i=1;i<=3;i++){int n=i;var button=Command(directory,"北门灯标 · 第"+i+"段\n"+(i<=state.stage?"已记录":"未记录"),()=>{_storySegment=n;Rebuild();},i==_storySegment);Bounds(button.gameObject,0,116,1,0);button.interactable=i<=state.stage;}
            var reader=Column(workspace,"story-reader",20,new RectOffset(28,28,28,28));Surface(reader);var scroll=Scroll(reader,"story-body");
            if(_storySegment<1||_storySegment>state.stage)_storySegment=state.stage;
            if(_storySegment==0){Label(scroll,"尚无见闻",28,true);Label(scroll,"已记录的远征见闻会收入这里。",22,false,Muted);return;}
            Label(scroll,"北门灯标 · 第"+_storySegment+"段",28,true);
            try{var narrative=new Sdt.Narrative.NarrativeService(Sdt.Res.Res.NarrativeJson.text).OpenLastLamp(_storySegment);foreach(var paragraph in narrative.Paragraphs)Label(scroll,paragraph,22);if(_storySegment==3)Label(scroll,state.ending=="open_beacon"?"你让灯光越过风雪，公共疏散线也随之暴露。":"你让窄光留在墙边，近路仍隐蔽，远处却看不见出口。",22,true,Accent);}
            catch{Label(scroll,"正文暂时无法载入，段落记录仍在。请重新选择此段重试。",22,false,Muted);}
        }
    }
    sealed class HubConfirmAction : MonoBehaviour
    {
        Button _button;Action _action;string _caption;float _expires;
        public void Bind(Button button,Action action){_button=button;_action=action;_caption=button.GetComponentInChildren<Text>()?.text??"确认";button.onClick.AddListener(Click);}
        void Click(){if(_expires>Time.unscaledTime){_expires=0;_action();return;}_expires=Time.unscaledTime+2.6f;var label=_button.GetComponentInChildren<Text>();if(label!=null)label.text="确认此操作？";}
        void Update(){if(_expires<=0||Time.unscaledTime<_expires)return;_expires=0;var label=_button.GetComponentInChildren<Text>();if(label!=null)label.text=_caption;}
    }
}

