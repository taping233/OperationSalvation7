using System;
using System.Linq;
using System.Collections.Generic;
namespace Sdt.Core.Battle
{
    public sealed partial class PendingTargetSnapshot
    {
        public string Kind, BattleToken;
        public int SelectionId, ExcludedTargetIndex=-1;
    }
    public sealed partial class BattleSession
    {
        private sealed partial class RuleContext
        {
            public List<BattleFoe> LastDamageTargets = new List<BattleFoe>();
            public BattleFoe[] Fighters;
        }
        private List<string> pendingFuel; private string pendingFuelUid;
        private BattleFoe[] preparedFighters;
        private string preparedFightersUid;
        private int targetSelectionSequence;
        private Action<BattleFoe> deferredTargetAction;
        private static bool NeedsFighters(CardDef card) => card?.rules?.Get("triggers")?.Operations("onPlay").Any(op=>op.Text("op")=="foeFight" && op.Text("pick")=="two")==true;
        private bool PrepareFoeFightSelection(string uid, CardDef card, ref BattleFoe target)
        {
            if(!NeedsFighters(card))return true;
            var first=pendingTarget?.uid==uid && pendingTarget.Kind=="fighters" && pendingTarget.BattleToken==_battleToken && pendingTarget.ExcludedTargetIndex>=0 && pendingTarget.ExcludedTargetIndex<foes.Count ? foes[pendingTarget.ExcludedTargetIndex] : null;
            if(first==null||first.dead)
            {
                pendingTarget=new PendingTargetSnapshot { uid=uid,card=card,Kind="fighters",BattleToken=_battleToken,SelectionId=++targetSelectionSequence,ExcludedTargetIndex=foes.IndexOf(target) };
                pendingHint="已选 "+target.name+" 先攻击；再选另一名敌人（存活才反击）· Esc 取消";
                _phase="targeting";RequestRender();return false;
            }
            if(first==target){pendingHint="请选择另一名存活敌人";RequestRender();return false;}
            preparedFighters=new[]{first,target};preparedFightersUid=uid;target=first;return true;
        }
        private bool ValidatePreparedFighters(string uid, CardDef card) => !NeedsFighters(card) || preparedFightersUid!=uid || preparedFighters!=null && preparedFighters.Length==2 && preparedFighters[0]!=preparedFighters[1] && preparedFighters.All(f=>foes.Contains(f)&&!f.dead&&f.hp>0);
        private void BindPreparedFighters(string uid)
        {
            if(preparedFightersUid==uid){castContext.Fighters=preparedFighters;preparedFighters=null;preparedFightersUid=null;}
        }
        private void BeginDeferredTarget(string uid, CardDef card, RuleContext context)
        {
            var ops=card.rules?.Get("triggers")?.Operations("onPlay").Where(op=>op.Text("pick")=="new").Select(op=>{var copy=RuleValue.Obj();foreach(var pair in op.Values)if(pair.Key!="pick")copy.Values[pair.Key]=pair.Value;return copy;}).ToArray();
            if(ops==null||ops.Length==0||Alive().Count==0)return;
            pendingTarget=new PendingTargetSnapshot {uid=uid,card=card,Kind="rulePick",BattleToken=_battleToken,SelectionId=++targetSelectionSequence};
            pendingHint="请为下一段效果选择目标（可重复选择同一目标）· Esc 取消";
            deferredTargetAction=foe=>{var previous=castContext;castContext=context;context.LastDamageTargets.Clear();using(BeginActorCard(card))RunRuleOps(card,ops,foe);castContext=previous;};
        }
        public CommandResult SelectRuleTarget(int index,string battleToken,int selectionId)
        {
            if(over||busy||RuleSelectionPending||_phase=="enemy"||pendingTarget?.Kind!="rulePick"||pendingTarget.BattleToken!=battleToken||_battleToken!=battleToken||pendingTarget.SelectionId!=selectionId)return CommandResult.No("目标选择已失效");
            if(index<0||index>=foes.Count||foes[index].dead)return CommandResult.No("请重新选择一名存活敌人");
            var action=deferredTargetAction;pendingTarget=null;pendingHint="";deferredTargetAction=null;_phase="resolving";
            action?.Invoke(foes[index]);ResolveRuleOutcome();ResumeRules();RequestRender();return CommandResult.Yes();
        }
        private PendingTargetSnapshot CopyPendingTarget() => pendingTarget==null?null:new PendingTargetSnapshot { uid=pendingTarget.uid,card=pendingTarget.card,Kind=pendingTarget.Kind,BattleToken=pendingTarget.BattleToken,SelectionId=pendingTarget.SelectionId,ExcludedTargetIndex=pendingTarget.ExcludedTargetIndex };
        private void ResolveFighterAttack(CardDef card,BattleFoe a,BattleFoe b)
        {
            if(a.dead||b.dead)return;
            EmitPresentation(new BattleActorCue { Kind="enemy-windup",ActorIndex=FoeIdx(a),WindupMs=130 });
            using var presentation=BeginPassiveHit(b);
            if(AegisBlocked(b))return;
            bool alive=!b.dead;var result=CombatResolver.DealDamage(a,b,0,CombatResolver.ATTACK); if(b.hp<=0)MarkEnemyDead(b);

            if(result.dealt>0)enemyDamageThisTurn=true;
            G.Log("[[icon:swords]] <b>"+Esc(card.name)+"</b>："+Esc(a.name)+" 被迫攻击 "+Esc(b.name)+"，造成 "+result.dealt+" 点伤害","sys");
            FireEnemyMarks(b,result.dealt>0?"damaged":null);
            if(alive&&b.dead){FireEnemyMarks(b,"death");FireStructuredTrigger("onKill",b);OnEliteDeath(b);}
            floats.Add(new BattleFloat {unit=foes.IndexOf(b).ToString(),text="-"+result.dealt,cls="hurt"});
        }
        private void ResolveFighters(CardDef card)
        {
            var pair=castContext?.Fighters ?? Alive().Take(2).ToArray();
            if(pair.Length!=2||pair[0]==pair[1]||pair.Any(f=>!foes.Contains(f)||f.dead))return;
            ResolveFighterAttack(card,pair[0],pair[1]);
            if(!pair[0].dead&&!pair[1].dead)ResolveFighterAttack(card,pair[1],pair[0]);
        }
    }
}



