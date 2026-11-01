using System;
using System.Collections.Generic;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        bool turnEndPending;
        string turnOwnerToken;
        bool OwnsTurn(string token) => !over && turnEndPending && turnOwnerToken == token && _battleToken == token;
        void ClearTurnOwner() { turnEndPending=false;turnOwnerToken=null; }
        void SuspendTurn(int continuationBase,string token,Action resume,string phase="enemy")
        {
            DeferRuleBatch(continuationBase,()=>
            {
                if(!OwnsTurn(token))return;
                ResolveRuleOutcome();if(!OwnsTurn(token))return;
                busy=true;_phase=phase;resume();
            });
            busy=false;_phase="player";RequestRender();
        }
        void BeginEnemyActions(string token)
        {
            if(!OwnsTurn(token))return;
            ResolveRuleOutcome();if(!OwnsTurn(token))return;
            int continuationBase=ruleContinuations.Count;
            ResolveRuleAllyAttacks();
            if(!OwnsTurn(token))return;
            if(RuleInputPending){SuspendTurn(continuationBase,token,()=>StartEnemyActions(token));return;}
            StartEnemyActions(token);
        }
        void StartEnemyActions(string token)
        {
            ResolveRuleOutcome();if(!OwnsTurn(token))return;
            EmitPresentation(new BattleActorCue{Kind="wait",WindupMs=420});
            ContinueEnemyActions(token,Alive(),0);
        }
        void ContinueEnemyActions(string token,List<BattleFoe> acting,int index,BattleFoe current=null,EnemyActionPlan plan=null,int hit=0)
        {
            while(OwnsTurn(token))
            {
                ResolveRuleOutcome();if(!OwnsTurn(token))return;
                if(current==null)
                {
                    if(index>=acting.Count){AfterEnemies(token);return;}
                    current=acting[index++];plan=BattleEnemyPlan.Build(current,turn);hit=0;
                    if(plan.Skip=="dead"||plan.Skip=="oddRound"||plan.Skip=="firstRound"){current=null;continue;}
                    if(plan.Skip=="stunned"){current.stunned=false;current=null;continue;}
                    if(plan.Skip=="frozen")G.Log("[[icon:crystal]] <b>"+Esc(current.name)+"</b> 被冰冻，无法行动！","sys");
                }
                if(plan.Skip!="frozen")
                {
                    for(int h=hit;h<plan.Hits&&G.Hp>0&&!current.dead&&current.hp>0&&CombatResolver.CanAct(current);h++)
                    {
                        if(CombatResolver.IsStealthed(pstat))
                        {G.Log("[[icon:runner]] 你在<b>潜行</b>中，<b>"+Esc(current.name)+"</b> 无法将你作为攻击对象","sys");break;}
                        int continuationBase=ruleContinuations.Count;
                        drawnCastHold++;
                        try
                        {
                            if(TryRuleAllyGuard(current))CleanseCurrentBlocker(current);
                            else
                            {
                                int dealt=PlayerTakeHit(current);
                                if(!OwnsTurn(token))return;
                                if(dealt>0&&CombatResolver.BreakStealth(current))G.Log("[[icon:runner]] <b>"+Esc(current.name)+"</b> 发动了攻击，<b>潜行</b>被破除","dim");
                                if(dealt>0&&current.affix=="frenzy")FrenzyCurse(current);
                                CleanseCurrentBlocker(current);
                            }
                        }
                        finally{if(OwnsTurn(token))drawnCastHold--;}
                        ResolveRuleOutcome();if(!OwnsTurn(token))return;
                        DrainDrawnCasts(continuationBase);
                        if(!OwnsTurn(token))return;
                        if(RuleInputPending)
                        {
                            int nextHit=h+1,nextIndex=index;var foe=current;var savedPlan=plan;
                            SuspendTurn(continuationBase,token,()=>ContinueEnemyActions(token,acting,nextIndex,foe,savedPlan,nextHit));return;
                        }
                    }
                }
                current=null;hit=0;RequestRender();
                ResolveRuleOutcome();if(!OwnsTurn(token))return;
                EmitPresentation(new BattleActorCue{Kind="wait",WindupMs=420});
            }
        }
        void ContinuePlayerTurnStart(string token)
        {
            ResolveRuleOutcome();
            if(!OwnsTurn(token))return;
            if(pstat.status.Get("natureForm")>0)
            {energy++;G.Log("[[icon:wood]] <b>自然形态</b>：额外获得 1 点能量（当前 "+energy+"/"+maxEnergy+"）","ok");}
            int continuationBase=ruleContinuations.Count;
            if(pstat.status.Get("swordForm")>0)
            {int got=DrawCards(1);G.Log("[[icon:sword]] <b>剑仙形态</b>：额外抽了 "+got+" 张牌","ok");}
            if(!OwnsTurn(token))return;
            if(RuleInputPending){SuspendTurn(continuationBase,token,()=>ContinuePlayerDelayed(token),"player");return;}
            ContinuePlayerDelayed(token);
        }
        void ContinuePlayerDelayed(string token)
        {
            int continuationBase=ruleContinuations.Count;ProcessDelayed();
            if(!OwnsTurn(token))return;
            if(RuleInputPending){SuspendTurn(continuationBase,token,()=>DrawPlayerTurn(token),"player");return;}
            DrawPlayerTurn(token);
        }
        void DrawPlayerTurn(string token)
        {
            int continuationBase=ruleContinuations.Count;
            if(noDrawNext){noDrawNext=false;G.Log("[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌","warn");}
            else if(mode=="boss")DrawCards(GameRules.BattleTurnDraw);
            if(!OwnsTurn(token))return;
            if(RuleInputPending){SuspendTurn(continuationBase,token,()=>CompleteOwnedTurn(token),"player");return;}
            CompleteOwnedTurn(token);
        }
        void CompleteOwnedTurn(string token,bool sound=true)
        {
            if(!OwnsTurn(token))return;
            ResolveRuleOutcome();if(!OwnsTurn(token))return;
            ClearTurnOwner();_phase="player";busy=false;
            if(sound)EmitSoundCue("phaseSelf");RequestRender();
        }
    }
}
