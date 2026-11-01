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
        bool ArchiveSnapshotCurrent(long revision)
        {if(G.Saves.Global.Revision==revision)return true;Rebuild();return false;}
        void BuildRecordWorkspace(Transform parent,List<ArchiveRecord> records,string current,Action<string> select,bool inbox)
        {
            var workspace=Row(parent,"av12-record-workspace",20);var list=Column(workspace,"av12-record-list",12,new RectOffset(14,14,14,14));Surface(list);var scroll=Scroll(list,"archive-records");
            if(inbox)Fact(scroll,"待领取",records.Count.ToString());
            var chosen=records.FirstOrDefault(r=>r.id==current)??records.FirstOrDefault();
            var buttons=new Dictionary<string,Button>();
            var detail=Column(workspace,"av12-record-detail",24,new RectOffset(28,28,28,28));Surface(detail);int detailVersion=0;long sourceRevision=G.Saves.Global.Revision;
            void Show(ArchiveRecord record,bool force=false)
            {
                if(record!=null)select(record.id);if(!ArchiveSnapshotCurrent(sourceRevision))return;
                if(!force&&chosen==record)return;var previous=chosen;chosen=record;int version=++detailVersion;UIKit.ClearChildren(detail);
                if(previous!=record){if(previous!=null)SoftSelection(buttons[previous.id],false);if(record!=null)SoftSelection(buttons[record.id],true);}
                if(record==null){Label(detail,inbox?"当前没有待领取奖励":"暂无收藏里程碑",28,true);if(inbox)Label(detail,"奖励领完后仍可在成就目标与收藏里程碑查看记录。",22,false,Muted);return;}
                _archiveReturnFocus=buttons[record.id];
                Label(detail,record.label+" · "+record.status,20,false,Muted);Label(detail,record.name,28,true);
                if(record.total>0){Label(detail,Math.Min(record.value,record.total)+" / "+record.total,56,true,Accent);Progress(detail,(float)record.value/record.total);}
                if(!string.IsNullOrEmpty(record.body))Label(detail,record.body,22);
                Label(detail,"奖励预览",20,false,Muted);Label(detail,record.rewards,22);
                var claim=Command(detail,record.claimed?"已领取":record.ready?"领取奖励":"待完成",()=>{if(version==detailVersion&&chosen==record)record.claim?.Invoke();},true);claim.interactable=record.ready&&!record.claimed;
            }
            foreach(var item in records)
            {
                var record=item;Button button=null;
                button=Command(scroll,"<size=16>"+record.label+"</size>\n<b>"+record.name+"</b>\n<size=18>"+record.status+"  ›</size>",()=>{if(button.isActiveAndEnabled&&button.interactable)Show(record);},chosen==record);
                Bounds(button.gameObject,0,106,1,0);SoftSelection(button,chosen==record);buttons.Add(record.id,button);
            }
            if(inbox){Command(scroll,"成就目标 ›",()=>{_achievementReturn="rewards";_archiveView="achievements";Rebuild();});Command(scroll,"收藏里程碑 ›",()=>{_archiveView="classes";Rebuild();});}
            Show(chosen,true);
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
        void ClaimMilestone(string id)
        {var milestone=HubCatalog.Current.milestones.FirstOrDefault(item=>item.id==id);ClaimReward(milestone?.all==true?"收藏完成":"收藏 "+(milestone?.need??0)+" 张",id,true,()=>{bool ok=G.Meta.TryClaimCollection(id,out var reason);return (ok,reason);});}
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
        sealed class AchievementTile
        {
            public AchievementStatus Status;public Button Button;
        }
        void BuildAch(Transform parent,List<AchievementStatus> snapshot)
        {
            var workspace=Row(parent,"av3-honours-layout",20);var left=Column(workspace,"av3-cabinet",12,new RectOffset(14,14,14,14));Surface(left);
            var filters=Row(left,"archive-status",6,54);
            var entries=snapshot.OrderBy(row=>row.Claimed?2:row.Unlocked?0:1).ToList();
            long sourceRevision=G.Saves.Global.Revision;
            var counts=new Dictionary<string,int>{{"",entries.Count},{"ready",0},{"locked",0},{"claimed",0}};
            foreach(var row in entries)counts[row.Claimed?"claimed":row.Unlocked?"ready":"locked"]++;
            var filterButtons=new Dictionary<string,Button>();var tiles=new List<AchievementTile>(entries.Count);
            var list=Scroll(left,"av3-medals");var detail=Column(workspace,"av3-medal-detail",20,new RectOffset(28,28,28,28));Surface(detail);
            var empty=Label(list,"没有匹配的成就",26,true);AchievementTile selected=null;int detailVersion=0;
            void Show(AchievementTile tile)
            {
                if(selected==tile&&detail.childCount>0)return;var previous=selected;selected=tile;int version=++detailVersion;UIKit.ClearChildren(detail);
                if(previous!=null)SoftSelection(previous.Button,false);if(tile!=null)SoftSelection(tile.Button,true);
                if(tile==null){Label(detail,"没有匹配的成就",26,true);return;}
                var state=tile.Status;var achievement=state.Definition;_achievement=achievement.id;_archiveReturnFocus=tile.Button;
                var medal=UIKit.Image(detail,Medal(achievement.id));medal.preserveAspect=true;Bounds(medal.gameObject,0,140,1,0);Label(detail,achievement.name,28,true);Label(detail,achievement.desc,22);
                if(state.Total>0)Fact(detail,"当前进度",state.Progress);Label(detail,"奖励预览",20,false,Muted);Label(detail,RewardText(achievement),22);
                var claim=Command(detail,state.Claimed?"已领取":state.Unlocked?"领取奖励":"目标未达成",()=>{if(version==detailVersion&&selected==tile)ClaimAchievement(achievement.id);},true);claim.interactable=state.Unlocked&&!state.Claimed;
            }
            bool Matches(AchievementStatus row)
            {
                string query=_achievementQuery.Trim();var a=row.Definition;
                return (query.Length==0||(a.name+" "+a.desc).IndexOf(query,StringComparison.OrdinalIgnoreCase)>=0)
                    &&(_achievementFilter==""||(_achievementFilter=="claimed"?row.Claimed:_achievementFilter=="locked"?!row.Unlocked&&!row.Claimed:row.Unlocked&&!row.Claimed));
            }
            void Apply()
            {
                if(!ArchiveSnapshotCurrent(sourceRevision))return;
                AchievementTile first=null,current=null;
                foreach(var tile in tiles){bool visible=Matches(tile.Status);tile.Button.gameObject.SetActive(visible);if(visible){if(first==null)first=tile;if(tile.Status.Definition.id==_achievement)current=tile;}}
                empty.gameObject.SetActive(first==null);Show(current??first);
            }
            foreach(var filter in new[]{("","全部"),("ready","可领取"),("locked","未达成"),("claimed","已领取")})
            {
                string id=filter.Item1;int count=counts[id];
                var button=Command(filters,filter.Item2+" "+count,()=>{_achievementFilter=id;foreach(var pair in filterButtons)SoftSelection(pair.Value,pair.Key==id);Apply();},_achievementFilter==id);button.name="achievement-filter-"+(id==""?"all":id);SoftSelection(button,_achievementFilter==id);filterButtons.Add(id,button);
            }
            Input(left,"搜索成就或目标",_achievementQuery,value=>{_achievementQuery=value;Apply();}).transform.SetSiblingIndex(1);
            foreach(var state in entries)
            {
                var a=state.Definition;var tile=new AchievementTile{Status=state};tiles.Add(tile);
                var button=Command(list,"",()=>{if(!tile.Button.isActiveAndEnabled||!tile.Button.interactable)return;_achievement=a.id;if(ArchiveSnapshotCurrent(sourceRevision))Show(tile);});tile.Button=button;button.name="achievement-item-"+a.id;Bounds(button.gameObject,0,106,1,0);SoftSelection(button,false);
                var art=UIKit.Image(button.transform,Medal(a.id));art.preserveAspect=true;Set(art.transform,new Vector2(0,.5f),new Vector2(0,.5f),new Vector2(16,-28),new Vector2(72,28));
                var text=UIKit.Label(button.transform,a.name+"\n<size=18>"+state.Progress+"   "+(state.Claimed?"已领取":state.Unlocked?"可领取":"未达成")+"</size>",23,InkColor);Fill(text.rectTransform,new Vector2(88,16),new Vector2(-16,-16));
            }
            Apply();
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
