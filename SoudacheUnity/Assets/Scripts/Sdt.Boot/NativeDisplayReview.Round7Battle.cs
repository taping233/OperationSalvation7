// Opt-in current-window evidence: formal battle fixtures and strict native raycast controls; no OS input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using OwnedCard=Sdt.Core.OwnedCard;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        IEnumerator ReviewRound7Battle()
        {
            if(!Guard(()=>
            {
                NewPresentationFixture();var game=GameRuntime.I;game.State.entrySupply=null;
                game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
                game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
                for(int i=0;i<2;i++)
                {
                    var card=CardLibrary.FindById("tt3-fireball").Clone();card.cost=i==0?2:5;card.variantKey="round7-formation-"+i;
                    game.State.ownedCards.Add(new OwnedCard{uid="display-r7-formation-"+i,card=card});
                }
                game.Bus.Emit(new BattleRequested{Request=new BattleRequest{IsBoss=true,Layer=1,Name="同名变体编组呈现复核",
                    Foes=new List<EnemyStats>{new EnemyStats{id="display-r7-boss",name="受控首脑",hp=10000,atk=0}}}});
                _records.Add(new{kind="controlled-r7-formation-fixture",uids=new[]{"display-r7-formation-0","display-r7-formation-1"},printedFees=new[]{2,5},osHardwareInput=false});
            }))yield break;
            float deadline=Time.realtimeSinceStartup+12;
            while((!(UiStack.Top is DeckSelectionPanel)||CurrentRunFilm.Active)&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>{if(!(UiStack.Top is DeckSelectionPanel)||CurrentRunFilm.Active)throw new TimeoutException("Round7 formal formation did not mount.");}))yield break;
            yield return Round6WaitForButton("bossSel-display-r7-formation-0");if(_failed)yield break;
            if(!Guard(()=>
            {
                if(!(UiStack.Top is DeckSelectionPanel))throw new InvalidOperationException("Round7 formal Boss formation absent.");
                ClickNamed("bossSel-display-r7-formation-0");
                var selected=BattleViewApi.Session.Snapshot.DeckSelection.Selected;
                if(!selected.SequenceEqual(new[]{"display-r7-formation-0"}))throw new InvalidOperationException("Actual formation click did not select only its physical UID.");
                _records.Add(new{kind="actual-r7-formation-selection",selected=selected.ToArray(),input="strict current-window raycast click",osHardwareInput=false});
            }))yield break;
            yield return Capture("player-r7-formation-selected",false);if(_failed)yield break;
            yield return Round6WaitForButton("bossCancel");if(_failed)yield break;
            if(!Guard(()=>ClickNamed("bossCancel")))yield break;

            if(!Guard(()=>
            {
                NewPresentationFixture();var game=GameRuntime.I;game.State.entrySupply=null;
                game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();game.State.myClass="侠客";
                game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
                game.State.ownedCards.Add(new OwnedCard{uid="display-r7-permanent",card=CardLibrary.FindById("tt3-fireball").Clone()});
                game.State.ownedCards.Add(new OwnedCard{uid="display-r7-imitate",card=CardLibrary.FindById("tt7-imitate").Clone()});
                game.State.ownedCards.Add(new OwnedCard{uid="display-r7-martial",card=CardLibrary.FindById("tt2-piercearrow").Clone()});
                var source=new CardDef{id="display-r7-generate",name="来源状态检查",type="法术",rarity="古朴",cost=0,desc="获得护甲，并生成普通及0费火球。",
                    rules=RuleValue.Obj("version",1,"battle",RuleValue.Obj("target",RuleValue.Obj("side","self","area",false)),"triggers",RuleValue.Obj("onPlay",RuleValue.Arr(
                        RuleValue.Obj("op","armor","amount",1),RuleValue.Obj("op","acquire","n",1,"dest","hand","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))),
                        RuleValue.Obj("op","acquire","n",1,"dest","hand","act","zeroCost","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))))))};
                game.State.ownedCards.Add(new OwnedCard{uid="display-r7-generate",card=source});
                game.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="临时及变形来源呈现复核",
                    Foes=new List<EnemyStats>{new EnemyStats{id="display-r7-foe",name="受控敌人",hp=10000,atk=0}}}});
                _records.Add(new{kind="controlled-r7-card-state-fixture",input="formal BattleRequested; controlled generator definition; original built-in martial/imitate/fireball",osHardwareInput=false});
            }))yield break;
            deadline=Time.realtimeSinceStartup+12;
            while((!(UiStack.Top is BattleScreen)||CurrentRunFilm.Active)&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>{if(!(UiStack.Top is BattleScreen)||CurrentRunFilm.Active)throw new TimeoutException("Round7 normal battle did not mount.");}))yield break;
            yield return Round6WaitForButton("btGrave");if(_failed)yield break;
            var session=BattleViewApi.Session;string generated=null,free=null;
            if(!Guard(()=>
            {
                Round6BattleField(session,"energy",100);
                if(!session.PlayCard("display-r7-martial",0,false).Ok||!session.PlayCard("display-r7-generate",-1,false).Ok)
                    throw new InvalidOperationException("Formal transform/acquire fixture commands rejected.");
                int printed=CardLibrary.FindById("tt3-fireball").cost;
                generated=session.GrantedCards.Single(entry=>entry.card.id=="tt3-fireball"&&entry.card.cost==printed).uid;
                free=session.GrantedCards.Single(entry=>entry.card.id=="tt3-fireball"&&entry.card.cost==0).uid;
                var transformed=session.GetCardPresentation("display-r7-imitate");
                if(!transformed.Transforming||!transformed.Transformed||transformed.EffectiveCost!=1||session.GetCardPresentation(free).BaseCost!=printed)
                    throw new InvalidOperationException("Formal source state fixture did not retain transform/printed fee facts.");
                _records.Add(new{kind="controlled-r7-formal-card-commands",commands=new[]{"PlayCard(original martial,enemy0)","PlayCard(controlled mixed acquire,self)"},
                    hand=session.Snapshot.Hand.ToArray(),cards=new[]{"display-r7-permanent",generated,free,"display-r7-imitate"}.Select(uid=>Round7CardState(session.GetCardPresentation(uid))).ToArray(),
                    input="formal Core commands construct card states; this is not drag/physical input evidence",osHardwareInput=false});
            }))yield break;
            yield return Round7WaitForPresentation(session);if(_failed)yield break;
            yield return Round6WaitForButton("btGrave");if(_failed)yield break;
            yield return Capture("player-r7-hand-state",false);if(_failed)yield break;
            if(!Guard(()=>
            {
                foreach(string uid in new[]{"display-r7-permanent",generated,free})if(!session.PlayCard(uid,0,false).Ok)throw new InvalidOperationException("Controlled consumed UID rejected: "+uid);
                _records.Add(new{kind="controlled-r7-consumed-commands",uids=new[]{"display-r7-permanent",generated,free},input="formal PlayCard commands; hidden draw order left intact",osHardwareInput=false});
            }))yield break;
            yield return Round7WaitForPresentation(session);if(_failed)yield break;
            yield return Round6WaitForButton("btGrave");if(_failed)yield break;
            if(!Guard(()=>ClickNamed("btGrave")))yield break;
            yield return Capture("player-r7-consumed-provenance",false);if(_failed)yield break;
            int inspect=-1;
            if(!Guard(()=>
            {
                var page=UiStack.Top as BattlePileScreen;if(page==null||page.Kind!="grave")throw new InvalidOperationException("Natural consumed HUD did not open the current pile.");
                var copies=page.Stacks.Where(stack=>stack.Card.id=="tt3-fireball"&&stack.Card.cost==CardLibrary.FindById("tt3-fireball").cost).ToArray();
                if(copies.Length!=2||copies.Any(stack=>stack.Count!=1)||copies.Count(stack=>stack.State.Temporary)!=1)throw new InvalidOperationException("Permanent and generated copies merged in the actual consumed page.");
                inspect=page.Stacks.ToList().FindIndex(stack=>stack.Uids.Contains(free));if(inspect<0)throw new InvalidOperationException("Zero-fee original UID is absent from the natural pile.");
                _records.Add(new{kind="actual-r7-pile",entry="strict raycast btGrave HUD",stacks=page.Stacks.Select(stack=>new{uids=stack.Uids.ToArray(),stack.Count,state=Round7CardState(stack.State)}).ToArray(),osHardwareInput=false});
            }))yield break;
            yield return Round6WaitForButton("btDecisionInspect-"+inspect);if(_failed)yield break;
            if(!Guard(()=>ClickNamed("btDecisionInspect-"+inspect)))yield break;
            yield return Capture("player-r7-pile-reader",false);if(_failed)yield break;
            yield return Round6WaitForButton("zoom-close");if(_failed)yield break;
            if(!Guard(()=>ClickNamed("zoom-close")))yield break;
            yield return Round6WaitForButton("btGraveBack");if(_failed)yield break;
            if(!Guard(()=>
            {
                ClickNamed("btGraveBack");var selected=EventSystem.current.currentSelectedGameObject;
                if(!(UiStack.Top is BattleScreen)||selected==null||selected.name!="btGrave")throw new InvalidOperationException("Natural pile return did not restore its real battle opener focus.");
                _records.Add(new{kind="actual-r7-pile-return",focus=selected.name,consumed=session.Snapshot.ConsumedPile.ToArray(),osHardwareInput=false});
            }))yield break;
            yield return Capture("player-r7-pile-return",false);
        }
        IEnumerator Round7WaitForPresentation(BattleSession session)
        {
            var screen=UiStack.Top as BattleScreen;
            var queue=screen==null?null:screen.GetComponent<BattlePresentationQueue>();
            float deadline=Time.realtimeSinceStartup+12;
            while(screen!=null&&queue!=null&&UiStack.Top==screen&&BattleViewApi.Session==session&&queue.Busy&&Time.realtimeSinceStartup<deadline)
                yield return null;
            Guard(()=>
            {
                if(screen==null||queue==null||UiStack.Top!=screen||BattleViewApi.Session!=session)
                    throw new InvalidOperationException("Round7 presentation lost its current battle owner.");
                if(queue.Busy)throw new TimeoutException("Round7 current battle presentation did not settle.");
            });
        }
        static object Round7CardState(BattleCardPresentation state)=>new{state.Uid,state.Card.id,state.Card.cost,state.BaseCost,state.EffectiveCost,state.Temporary,state.Transforming,state.Transformed,state.OriginName};
    }
}
