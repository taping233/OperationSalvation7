using System;
using System.Collections.Generic;
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
        static string _rewardRecord="",_milestoneRecord="",_achievementQuery="";
        sealed class ArchiveRecord
        {
            public string id,label,name,status,body,rewards;public int value,total;public bool ready,claimed;public Action claim;
        }
        void BuildRecordWorkspace(Transform parent,List<ArchiveRecord> records,string current,Action<string> select,bool inbox)
        {
            var workspace=Row(parent,"av12-record-workspace",20);var list=Column(workspace,"av12-record-list",12,new RectOffset(14,14,14,14));Surface(list);var scroll=Scroll(list,"archive-records");
            if(inbox)Fact(scroll,"待领取",records.Count.ToString());
            var chosen=records.FirstOrDefault(r=>r.id==current)??records.FirstOrDefault();
            foreach(var item in records){var record=item;var button=Command(scroll,"<size=16>"+record.label+"</size>\n<b>"+record.name+"</b>\n<size=18>"+record.status+"  ›</size>",()=>{select(record.id);Rebuild();},chosen==record);Bounds(button.gameObject,0,106,1,0);SoftSelection(button,chosen==record);}
            if(inbox){Command(scroll,"成就目标 ›",()=>{_achievementReturn="rewards";_archiveView="achievements";Rebuild();});Command(scroll,"收藏里程碑 ›",()=>{_archiveView="classes";Rebuild();});}
            var detail=Column(workspace,"av12-record-detail",24,new RectOffset(28,28,28,28));Surface(detail);
            if(chosen==null){Label(detail,inbox?"当前没有待领取奖励":"暂无收藏里程碑",28,true);if(inbox)Label(detail,"奖励领完后仍可在成就目标与收藏里程碑查看记录。",22,false,Muted);return;}
            Label(detail,chosen.label+" · "+chosen.status,20,false,Muted);Label(detail,chosen.name,28,true);
            if(chosen.total>0){Label(detail,Math.Min(chosen.value,chosen.total)+" / "+chosen.total,56,true,Accent);Progress(detail,(float)chosen.value/chosen.total);}
            if(!string.IsNullOrEmpty(chosen.body))Label(detail,chosen.body,22);
            Label(detail,"奖励预览",20,false,Muted);Label(detail,chosen.rewards,22);
            var claim=Command(detail,chosen.claimed?"已领取":chosen.ready?"领取奖励":"待完成",chosen.claim,true);claim.interactable=chosen.ready&&!chosen.claimed;
        }
        void BuildRewards(Transform parent,(int total,int progress) collection,List<AchievementDef> achievements)
        {
            var records=new List<ArchiveRecord>();
            int total=collection.total,progress=collection.progress;
            foreach(var item in achievements)
            {var a=item;records.Add(new ArchiveRecord{id="achievement-"+a.id,label="成就奖励",name=a.name,status="可领取",body=a.desc,rewards=RewardText(a),ready=true,claim=()=>ClaimAchievement(a.id)});}
            foreach(var item in HubCatalog.Current.milestones.Where(m=>!G.Meta.MilestoneClaimed(m.id)&&progress>=(m.all?total:m.need)))
            {var m=item;int need=m.all?total:m.need;records.Add(new ArchiveRecord{id="collection-"+m.id,label="收藏奖励",name=need==total?"收集完成":"收集 "+need+" 张",status="可领取",rewards=G.Meta.CollectionRewardText(m),ready=true,claim=()=>ClaimMilestone(m.id)});}
            BuildRecordWorkspace(parent,records,_rewardRecord,id=>_rewardRecord=id,true);
        }
        void ClaimMilestone(string id){if(!G.Meta.TryClaimCollection(id,out var reason)){Log(reason,"warn");return;}Log("收藏奖励已入账","ok");Rebuild();}
        void BuildMilestones(Transform parent,(int total,int progress) collection)
        {
            int total=collection.total,progress=collection.progress;
            var summary=Row(parent,"av12-summary",20,72);Surface(summary);Label(summary,"已收藏",22,false,Muted);Label(summary,progress+" / "+total,30,true);Progress(summary,(float)progress/Math.Max(1,total));
            var records=HubCatalog.Current.milestones.Select((m,index)=>
            {
                int need=m.all?total:m.need;bool claimed=G.Meta.MilestoneClaimed(m.id),ready=progress>=need;
                return new ArchiveRecord{id=m.id,label="收藏里程碑 "+(index+1).ToString("00"),name=need==total?"收集完成":"收集 "+need+" 张",status=claimed?"已领取":ready?"可领取":"未达成",rewards=G.Meta.CollectionRewardText(m),value=progress,total=need,ready=ready,claimed=claimed,claim=()=>ClaimMilestone(m.id)};
            }).ToList();
            BuildRecordWorkspace(parent,records,_milestoneRecord,id=>_milestoneRecord=id,false);
        }
        static readonly string[] MedalIds={"firstExtract","extract3","kill10","firstBoss","allBoss","rich30","stash20","bagMax","safeMax","class3","collectGold","collectLegend","collect5","petHatch1","petHatch3","petMax","petAll","unlimitedEnergy","weaponMaster","runeFan","savior","beautifulVase","excuseMe","labScore1","labScore2","labScore3"};
        static readonly Dictionary<string,Sprite> Medals=new Dictionary<string,Sprite>();
        static Sprite Medal(string id)
        {
            if(Medals.TryGetValue(id,out var value))return value;var atlas=Sdt.Res.Res.HubArt("achievement-painted");if(atlas==null)return null;
            int index=Math.Max(0,Array.IndexOf(MedalIds,id));float width=atlas.texture.width/6f,height=atlas.texture.height/5f;
            value=Sprite.Create(atlas.texture,new Rect(index%6*width,atlas.texture.height-(index/6+1)*height,width,height),new Vector2(.5f,.5f),100);Medals[id]=value;return value;
        }
        string AchievementProgress(string id)
        {
            var b=G.Base;var s=b.stats;int value=0,total=1;
            switch(id)
            {
                case "firstExtract":value=s.extracts;break;case "extract3":value=s.extracts;total=3;break;case "kill10":value=s.kills;total=10;break;
                case "firstBoss":value=s.bossKills.Count;break;case "allBoss":value=s.bossKills.Count;total=3;break;case "rich30":value=s.bestRunCoins;total=30;break;case "stash20":value=s.stashTotal;total=20;break;
                case "bagMax":value=b.BagCap;total=GameRules.BagMax;break;case "safeMax":value=b.SafeCap;total=GameRules.SafeMax;break;
                case "class3":value=b.characters.Values.Select(p=>p.lv).DefaultIfEmpty(1).Max();total=3;break;
                case "collectGold":value=b.collection.ContainsKey("tt-gold")?1:0;break;case "collectLegend":value=b.collection.Count(p=>p.Value?.rarity=="传说");break;case "collect5":value=b.collection.Count;total=5;break;
                case "petHatch1":value=Math.Max(0,b.pets.Count-1);break;case "petHatch3":value=Math.Max(0,b.pets.Count-1);total=3;break;case "petMax":value=b.pets.Values.Select(p=>p.lv).DefaultIfEmpty(1).Max();total=5;break;case "petAll":value=b.pets.Count;total=BaseData.PetsCatalog.Count;break;
                case "unlimitedEnergy":value=s.turnMovesMax;total=10;break;case "weaponMaster":value=s.battleEquipsMax;total=5;break;case "excuseMe":value=s.reviveKills;break;
                case "labScore1":value=s.labTotalScore;total=500;break;case "labScore2":value=s.labTotalScore;total=1500;break;case "labScore3":value=s.labTotalScore;total=4000;break;default:return "";
            }
            return Math.Min(value,total)+" / "+total;
        }
        void BuildAch(Transform parent)
        {
            var workspace=Row(parent,"av3-honours-layout",20);var left=Column(workspace,"av3-cabinet",12,new RectOffset(14,14,14,14));Surface(left);
            var filters=Row(left,"archive-status",6,54);
            foreach(var filter in new[]{("","全部"),("ready","可领取"),("locked","未达成"),("claimed","已领取")})
            {
                string id=filter.Item1;int count=MetaProgress.Achievements.Count(a=>id==""||(id=="claimed"?G.Meta.IsClaimed(a.id):id=="locked"?!MetaProgress.IsUnlocked(a,G.Base):MetaProgress.IsUnlocked(a,G.Base)&&!G.Meta.IsClaimed(a.id)));
                Command(filters,filter.Item2+" "+count,()=>{_achievementFilter=id;Rebuild();},_achievementFilter==id);
            }
            Input(left,"搜索成就或目标",_achievementQuery,v=>{_achievementQuery=v;Rebuild();});
            var achievements=MetaProgress.Achievements.Where(a=>(_achievementQuery==""||(a.name+" "+a.desc).IndexOf(_achievementQuery,StringComparison.OrdinalIgnoreCase)>=0)&&(_achievementFilter==""||(_achievementFilter=="claimed"?G.Meta.IsClaimed(a.id):_achievementFilter=="locked"?!MetaProgress.IsUnlocked(a,G.Base):MetaProgress.IsUnlocked(a,G.Base)&&!G.Meta.IsClaimed(a.id)))).OrderBy(a=>G.Meta.IsClaimed(a.id)?2:MetaProgress.IsUnlocked(a,G.Base)?0:1).ToList();
            var list=Scroll(left,"av3-medals");var detail=Column(workspace,"av3-medal-detail",20,new RectOffset(28,28,28,28));Surface(detail);
            if(achievements.Count==0){Label(list,"没有匹配的成就",26,true);Label(detail,"没有匹配的成就",26,true);return;}
            var selected=achievements.FirstOrDefault(a=>a.id==_achievement)??achievements[0];_achievement=selected.id;
            foreach(var item in achievements)
            {
                var a=item;var button=Command(list,"",()=>{_achievement=a.id;Rebuild();},selected.id==a.id);Bounds(button.gameObject,0,106,1,0);SoftSelection(button,selected.id==a.id);
                var art=UIKit.Image(button.transform,Medal(a.id));art.preserveAspect=true;Set(art.transform,new Vector2(0,.5f),new Vector2(0,.5f),new Vector2(16,-28),new Vector2(72,28));
                var text=UIKit.Label(button.transform,a.name+"\n<size=18>"+AchievementProgress(a.id)+"   "+(G.Meta.IsClaimed(a.id)?"已领取":MetaProgress.IsUnlocked(a,G.Base)?"可领取":"未达成")+"</size>",23,InkColor);Fill(text.rectTransform,new Vector2(88,16),new Vector2(-16,-16));
            }
            var medal=UIKit.Image(detail,Medal(selected.id));medal.preserveAspect=true;Bounds(medal.gameObject,0,140,1,0);Label(detail,selected.name,28,true);Label(detail,selected.desc,22);Fact(detail,"当前进度",AchievementProgress(selected.id));Label(detail,"奖励预览",20,false,Muted);Label(detail,RewardText(selected),22);
            bool claimed=G.Meta.IsClaimed(selected.id),unlocked=MetaProgress.IsUnlocked(selected,G.Base);var claim=Command(detail,claimed?"已领取":unlocked?"领取奖励":"目标未达成",()=>ClaimAchievement(selected.id),unlocked&&!claimed);claim.interactable=unlocked&&!claimed;
        }
        void BuildBacks(Transform parent)
        {
            var backs=CardLibrary.CardBacks;var selected=backs.FirstOrDefault(b=>b.id==_backId)??backs.FirstOrDefault(b=>b.id==G.Base.BackSel)??backs[0];_backId=selected.id;
            var workspace=Area(parent,"av3-backs",Vector2.zero,Vector2.one);
            var left=Area(workspace,"av12-back-area",Vector2.zero,Vector2.one,Vector2.zero,new Vector2(-330,0));var col=Column(left,"back-workspace",20);Fill((RectTransform)col);
            var stage=Column(col,"av12-back-stage",12,new RectOffset(30,30,30,30));Surface(stage);var art=UIKit.Image(stage,Sdt.Res.Res.CardBack(selected.id));art.preserveAspect=true;Bounds(art.gameObject,0,340,1,1);
            var shelf=Scroll(col,"av3-back-shelves");Bounds(shelf.parent.gameObject,0,220,1,0);Surface(shelf.parent);var row=Row(shelf,"card-backs",22,190);
            foreach(var definition in backs){var back=definition;var b=Command(row,"",()=>{_backId=back.id;Rebuild();},_backId==back.id);Bounds(b.gameObject,140,190,0,0);var image=UIKit.Image(b.transform,Sdt.Res.Res.CardBack(back.id));image.preserveAspect=true;Set(image.transform,new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(-45,-140),new Vector2(45,-14));var text=UIKit.Label(b.transform,back.name+"\n<size=13>"+(G.Base.BackSel==back.id?"使用中":G.Base.IsBackUnlocked(back.id)?"已解锁":"未解锁")+"</size>",18,InkColor);text.alignment=TextAnchor.MiddleCenter;Fill(text.rectTransform,new Vector2(4,2),new Vector2(-4,-140));}
            var sr=shelf.parent.GetComponent<ScrollRect>();sr.horizontal=true;sr.vertical=false;row.gameObject.AddComponent<ContentSizeFitter>().horizontalFit=ContentSizeFitter.FitMode.PreferredSize;
            var detailArea=Area(workspace,"av3-back-detail",new Vector2(1,0),Vector2.one,new Vector2(-310,0),Vector2.zero);Surface(detailArea);var detail=Column(detailArea,"back-detail-body",20,new RectOffset(28,28,28,28));Fill((RectTransform)detail);
            Label(detail,"外观预览",20,false,Muted);Label(detail,selected.name,28,true);Label(detail,selected.from,22,false,Muted);
            bool unlocked=G.Base.IsBackUnlocked(selected.id),equipped=G.Base.BackSel==selected.id;Label(detail,equipped?"用于背包与牌库。":unlocked?"应用后用于背包与牌库。":"完成目标并领取奖励后解锁。",22,false,Muted);
            if(!unlocked){var target=MetaProgress.Achievements.FirstOrDefault(a=>a.back==selected.id);if(target!=null){Label(detail,target.name,23,true);Label(detail,target.desc,22);Command(detail,"查看解锁目标 →",()=>{_achievement=target.id;_achievementReturn="backs";_archiveView="achievements";Rebuild();});}}
            var choose=Command(detail,equipped?"使用中":unlocked?"应用卡背":"尚未解锁",()=>{if(!G.TryPersistMutation(()=>{if(!G.Base.SetBack(selected.id))throw new InvalidOperationException("卡背尚未解锁");},out var why)){Log(why,"warn");return;}Rebuild();},true);choose.interactable=unlocked&&!equipped;
        }
    }
}
