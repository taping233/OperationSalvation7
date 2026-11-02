using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        // A ticket belongs to this source's execution view, never a fuel/acquisition trigger.
        private sealed class PreparedDiscovery
        {
            public List<CardDef> options;
            public string[] storedUids;
            public DiscoveringState state;
            public int index;
            public bool claimed;
            public bool Claim(bool stored=false)
            { if(claimed||(storedUids!=null)!=stored)return false;claimed=true;return true; }
        }
        private sealed partial class RuleContext { public PreparedDiscovery preparedDiscovery; }
        private sealed class PreviewCandidates { public List<CardDef> options; public string[] storedUids; }
        private sealed class DiscoveryPreview
        {
            public DiscoveringState state;
            public string token,uid,plan;
            public int turn;
            public bool item;
            public PreviewCandidates candidates;
            public Func<PreparedDiscovery,CommandResult> commit;
        }
        private DiscoveryPreview discoveryPreview;
        private readonly Dictionary<string,PreviewCandidates> discoveryPreviewCache=new Dictionary<string,PreviewCandidates>();
        private string previewCacheToken;
        private int previewCacheTurn;

        private void ClearDiscoveryPreviews()
        {discoveryPreview=null;discoveryPreviewCache.Clear();previewCacheToken=null;}
        private static void PlanValue(StringBuilder text,object value)
        {
            if(value==null){text.Append('N');return;}
            if(value is RuleValue rule){text.Append('{');foreach(var pair in rule.Values){PlanValue(text,pair.Key);PlanValue(text,pair.Value);}text.Append('}');return;}
            if(value is object[] array){text.Append('[');foreach(var item in array)PlanValue(text,item);text.Append(']');return;}
            string part=value is string literal?literal:Convert.ToString(value,CultureInfo.InvariantCulture);
            text.Append(value is string?'S':'V').Append(part.Length).Append(':').Append(part);
        }
        private static string DiscoveryPlan(CardDef card)
        {
            var key=new StringBuilder();PlanValue(key,card.id);PlanValue(key,card.type);PlanValue(key,card.desc);PlanValue(key,card.rules);return key.ToString();
        }
        private static bool PositiveInteger(RuleValue operation,string field)
        {
            var value=operation.Value(field);
            return value is int integer?integer>0:value is double number&&number>0&&number==Math.Truncate(number);
        }
        private static bool BagDiscovery(CardDef card)=>card.type=="道具"&&card.rules?.Get("bag")?.Value("use") is object[];
        private static int BagDiscoveryCount(RuleValue operation)
        {
            var amount=operation.Value("amount");
            if(amount is int integer)return integer;
            if(amount is double number&&number==Math.Truncate(number))return (int)number;
            int count=operation.Number("n",1);return count==0?1:count;
        }
        private RuleValue FirstPreviewOperation(CardDef card,out bool stored)
        {
            stored=false;bool bag=BagDiscovery(card);
            var rules=bag?card.rules.Get("bag"):card.rules?.Get("triggers");
            var values=rules?.Items(bag?"use":"onPlay");
            if(values==null||values.Length==0||values.Any(value=>!(value is RuleValue)))return null;
            var operations=values.Cast<RuleValue>().ToArray();var first=operations[0];
            if(!bag&&operations.Length==1&&first.Text("op")=="castStored"&&!first.Has("when"))
            {stored=true;return first;}
            if(!bag&&card.type=="装备")return null;
            foreach(var operation in operations)
            {
                if(operation.Has("when")||operation.Has("schedule")||!bag&&operation.Has("pick"))return null;
                string kind=operation.Text("op");
                if(bag)
                {
                    if(kind!="discover"&&(kind!="acquire"||new[]{"classAbility","legendary"}.Contains(operation.Get("pool")?.Text("kind"))))return null;
                }
                else if(!(kind=="discover"&&PositiveInteger(operation,"count")
                    ||kind=="acquire"&&PositiveInteger(operation,"n")&&operation.Text("dest","discover")=="discover"&&operation.Get("pool")?.Text("kind")!="牌库底"))return null;
            }
            return first;
        }
        private bool TryPreviewDiscovery(string uid,CardDef card,bool item,Func<PreparedDiscovery,CommandResult> commit)
        {
            if(over||discovering!=null||discoverQueue.Count>0||!BagDiscovery(card)&&pstat.status.silence>0&&card.rules?.Get("battle")?.Flag("ignoresSilence")!=true)return false;
            var operation=FirstPreviewOperation(card,out bool stored);if(operation==null)return false;
            // A zero/negative item amount has no reward; do not reproduce Source's zero-count award.
            if(BagDiscovery(card)&&BagDiscoveryCount(operation)<=0)return false;
            if(previewCacheToken!=_battleToken||previewCacheTurn!=turn)
            {discoveryPreviewCache.Clear();previewCacheToken=_battleToken;previewCacheTurn=turn;}
            string plan=DiscoveryPlan(card),key=uid+":"+plan;
            if(!discoveryPreviewCache.TryGetValue(key,out var candidates))
            {
                candidates=new PreviewCandidates();
                if(stored)
                {
                    var entries=StoredRuleCards();candidates.options=entries.Select(entry=>entry.card).ToList();candidates.storedUids=entries.Select(entry=>entry.uid).ToArray();
                }
                else candidates.options=DiscoverOptions(RulePool(operation.Get("pool"),operation.Get("filter")),3);
                if(candidates.options.Count==0)return false;
                discoveryPreviewCache[key]=candidates;
            }
            int count=stored?1:BagDiscovery(card)?BagDiscoveryCount(operation):DiscoveryCount(operation);
            var state=BeginDiscovery(candidates.options,n:count,kind:stored?"stored":operation.Text("act")=="play"||operation.Text("act")=="playKeep"?"play":"hand");
            state.sourceCommit="preview";state.sourceUid=uid;
            discoveryPreview=new DiscoveryPreview{state=state,uid=uid,token=_battleToken,turn=turn,plan=plan,item=item,candidates=candidates,commit=commit};
            if(_phase=="targeting")_phase="player";
            RequestRender();return true;
        }
        private bool PreviewCurrent(DiscoveryPreview preview)
        {
            if(over||preview==null||preview.state!=discovering||preview.token!=_battleToken||preview.turn!=turn)return false;
            var source=preview.item?AvailableBattleItems().FirstOrDefault(entry=>entry.uid==preview.uid)?.card:hand.Contains(preview.uid)?FindCard(preview.uid)?.card:null;
            if(source==null||DiscoveryPlan(source)!=preview.plan)return false;
            return preview.candidates.storedUids==null||preview.candidates.storedUids.Select((uid,index)=>G.OwnedCards.Any(entry=>entry.uid==uid&&entry.pouchOf=="tt7-stratagem"&&entry.card?.id==preview.candidates.options[index].id&&entry.card.type=="法术")).All(valid=>valid);
        }
        private CommandResult ConfirmDiscoveryPreview(int index)
        {
            var preview=discoveryPreview;
            if(!PreviewCurrent(preview))return CommandResult.No("发现来源已变化，请取消本次使用");
            discoveryPreview=null;discovering=null;
            var result=preview.commit(new PreparedDiscovery{options=preview.candidates.options,storedUids=preview.candidates.storedUids,index=index,state=preview.state});
            if(!result.Ok)G.Log(result.Reason,"warn");
            ResolveRuleOutcome();ResumeRules();RequestRender();return result;
        }
        private CommandResult CancelDiscoveryPreview()
        {
            bool valid=PreviewCurrent(discoveryPreview);discoveryPreview=null;discovering=null;
            if(valid)G.Log("[[icon:question]] 已取消本次使用，源牌、能量、注能材料与手牌代价均未消耗；再次打开保留本回合候选","sys");
            ResolveRuleOutcome();ResumeRules();RequestRender();return valid?CommandResult.Yes():CommandResult.No("发现来源已变化，本次未消耗");
        }
        private string PreviewPlayIssue(string uid,CardDef card,List<string> fuel,BattleFoe target,bool freeCost,bool directRelease,List<string> payment)
        {
            if(over||!hand.Contains(uid)||card==null)return "源牌已不在手牌，本次未消耗";
            string issue=StructuredRequirement(card)??BattleRules.UnplayableReasonFor(card,mode);if(issue!=null)return issue;
            if(!ValidatePreparedFighters(uid,card)||BattleRules.TargetSideFor(card)=="enemy"&&(target==null||target.dead||target.hp<=0||!foes.Contains(target)))return "目标已变化，本次未消耗";
            if(!freeCost&&EffCostOf(card)>energy)return "能量不足，本次未消耗";
            if(fuel.Distinct().Count()!=fuel.Count||fuel.Any(material=>material==uid||!CanUseAsInfusionFuel(material))
                ||!directRelease&&RequiresInfusion(card)&&InfuseOf(card)>0&&fuel.Count!=InfuseOf(card))return "注能材料已变化，本次未消耗";
            var requirement=HandRequirement(card);
            if(requirement!=null)
            {
                var seen=new HashSet<string>();var draft=new HandPayment{uid=uid,card=card,fuel=fuel};
                if(payment==null||payment.Count!=requirement.Number("count",1)||!payment.All(material=>PaymentCandidate(material,draft,seen)&&seen.Add(material)))return "手牌代价已变化，本次未消耗";
            }
            else if(payment?.Count>0)return "手牌代价已变化，本次未消耗";
            return null;
        }
    }
}
