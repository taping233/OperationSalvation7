using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    // A queued play owns the source, infusion fuel and target until payment commits.
    public sealed partial class BattleSession
    {
        private sealed class HandPayment
        {
            public string uid; public CardDef card; public BattleFoe target;
            public List<string> fuel; public bool freeCost, directRelease;
            public long selectionId;
        }
        private HandPayment handPayment;
        private long handPaymentSerial;
        private static RuleValue HandRequirement(CardDef card) => card?.rules?.Get("battle")?.Operations("requirements").FirstOrDefault(r => r.Text("kind") == "handCards");
        private bool PaymentCandidate(string uid, HandPayment payment, HashSet<string> selected = null)
        {
            return hand.Contains(uid) && uid != payment.uid && !payment.fuel.Contains(uid)
                && selected?.Contains(uid) != true && BattleRules.MatchesHandSelectKey(FindCard(uid)?.card, HandRequirement(payment.card)?.Text("type"));
        }
        private string PaymentPreflight(string uid, CardDef card, List<string> fuel)
        {
            var requirement = HandRequirement(card); if (requirement == null) return null;
            var payment = new HandPayment { uid=uid, card=card, fuel=fuel };
            return hand.Distinct().Count(h => PaymentCandidate(h,payment)) < requirement.Number("count",1) ? "手牌支付不足" : null;
        }
        private void BeginHandPayment(string uid, CardDef card, List<string> fuel, BattleFoe target, bool freeCost, bool directRelease)
        {
            handPayment = new HandPayment { uid=uid,card=card,fuel=new List<string>(fuel),target=target,freeCost=freeCost,directRelease=directRelease,selectionId=++handPaymentSerial };
            ruleHandSelection = new RuleHandSelectionSnapshot {
                act="payment", type=HandRequirement(card).Text("type"), n=HandRequirement(card).Number("count",1), selectionId=handPayment.selectionId, sourceUid=uid, sourceCard=card,
                candidateUids=hand.Distinct().Where(h=>PaymentCandidate(h,handPayment)).ToArray(), selectedUids=Array.Empty<string>(), canCancel=false };
            RequestRender();
        }
        public CommandResult ConfirmRuleHandPayment(long selectionId, string[] materialUids)
        {
            var payment=handPayment; var selection=ruleHandSelection;
            if(payment==null || selection?.act!="payment" || selectionId!=payment.selectionId) return CommandResult.No("支付已失效");
            var paid=(materialUids??Array.Empty<string>()).ToList();
            if(paid.Count!=selection.n) return CommandResult.No("支付材料未选满");
            var card=FindCard(payment.uid)?.card; var seen=new HashSet<string>();
            bool valid=!over && hand.Contains(payment.uid) && card!=null && HandRequirement(card)!=null
                && HandRequirement(card).Number("count",1)==paid.Count
                && paid.All(uid=>PaymentCandidate(uid,new HandPayment{uid=payment.uid,card=card,fuel=payment.fuel},seen)&&seen.Add(uid))
                && payment.fuel.Distinct().Count()==payment.fuel.Count && payment.fuel.All(uid=>uid!=payment.uid&&CanUseAsInfusionFuel(uid))
                && StructuredRequirement(card)==null && BattleRules.UnplayableReasonFor(card,mode)==null
                && ValidatePreparedFighters(payment.uid,card)
                && (payment.directRelease || !RequiresInfusion(card) || InfuseOf(card)==0 || payment.fuel.Count==InfuseOf(card))
                && (payment.freeCost || EffCostOf(card)<=energy)
                && (BattleRules.TargetSideFor(card)!="enemy" || payment.target!=null&&!payment.target.dead&&foes.Contains(payment.target));
            handPayment=null; ruleHandSelection=null;
            if(!valid) { ResumeRules(); RequestRender(); return CommandResult.No("支付或目标已变化，本次未消耗"); }
            ExecPlay(payment.uid,card,payment.fuel,payment.target,payment.freeCost,payment.directRelease,paid);
            ResumeRules(); RequestRender(); return CommandResult.Yes();
        }
    }
}
