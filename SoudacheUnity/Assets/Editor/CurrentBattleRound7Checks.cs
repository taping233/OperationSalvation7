using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Sdt.Boot;
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

public static class CurrentBattleRound7Checks
{
    public static int Assertions { get; private set; }
    static UnityEngine.Events.UnityEvent _oldFormation,_oldInspect,_oldBack;
    static string _oldToken;
    static BattleSession Session=>BattleViewApi.Session;
    static void FinishCurrent()
    {
        var session=Session;
        if(session==null)return;
        var finish=typeof(BattleSession).GetMethod("Finish",BindingFlags.Instance|BindingFlags.NonPublic,null,new[]{typeof(bool?)},null)
            ??throw new MissingMethodException(typeof(BattleSession).FullName,"Finish(bool?)");
        finish.Invoke(session,new object[]{null});
    }
    static void Check(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Battle round7: "+message);}
    static object Field(object value,string name)=>value.GetType().GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(value);
    static Button Named(Panel page,string name)=>page.GetComponentsInChildren<Button>().Single(button=>button.name==name);
    static Text Cost(Transform root)=>root.GetComponentsInChildren<Text>().Single(text=>text.transform.parent.name=="cost");
    static bool BattleReady(BattleScreen battle)=>UiStack.Top==battle&&!battle.GetComponent<BattlePresentationQueue>().Busy;
    static BattleCard[] HandCards(BattleScreen battle)=>((RectTransform)Field(battle,"_hand")).GetComponentsInChildren<BattleCard>();
    static BattleCard HandCard(BattleScreen battle,string uid)
    {
        var cards=HandCards(battle);var matches=cards.Where(card=>card.Uids.Contains(uid)).ToArray();
        if(matches.Length!=1)throw new InvalidOperationException("Battle round7: expected one active hand face for "+uid+", found "+matches.Length
            +"; queueBusy="+battle.GetComponent<BattlePresentationQueue>().Busy+"; hand="+string.Join(",",Session.Snapshot.Hand)
            +"; activeFaces="+string.Join(";",cards.Select(card=>card.Uid+"=["+string.Join(",",card.Uids)+"]")));
        return matches[0];
    }
    static void Submit(Button button)
    {
        Check(button!=null&&button.isActiveAndEnabled&&button.IsInteractable(),"current native control available");
        EventSystem.current.SetSelectedGameObject(button.gameObject);
        Check(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"real Submit handler accepted");
    }
    static IEnumerator Until(Func<bool> ready,string label,Func<string> diagnostic=null)
    {
        float deadline=Time.realtimeSinceStartup+12;
        while(!ready()){if(Time.realtimeSinceStartup>=deadline)throw new TimeoutException("Battle round7: "+label+"; top="+(UiStack.Top==null?"none":UiStack.Top.GetType().Name)+(diagnostic==null?"":"; "+diagnostic()));yield return null;}
    }
    static bool DiscoveryReady(DiscoverPanel page,string token,long selectionId)
        =>page!=null&&UiStack.Top==page&&Session.BattleToken==token&&Session.Snapshot.Discovering?.selectionId==selectionId
            &&(string)Field(page,"_token")==token&&(long)Field(page,"_selectionId")==selectionId&&Time.unscaledTime>=(float)Field(page,"_readyAt");
    static string DiscoveryDiagnostic(DiscoverPanel page,BattleScreen battle)
    {
        var queue=battle.GetComponent<BattlePresentationQueue>();var latest=(BattleSnapshot)Field(queue,"_latest");
        var current=Session.Snapshot;var shown=GameSnapshotRef.Current;
        var confirm=page!=null?(Button)Field(page,"_confirm"):null;
        return "coreToken="+current.BattleToken+"; coreDiscovery="+(current.Discovering?.selectionId.ToString()??"none")
            +"; shownDiscovery="+(shown?.Discovering?.selectionId.ToString()??"none")+"; queueBusy="+queue.Busy+"; pendingBeats="+queue.PendingBeats
            +"; queuedSnapshot="+(latest!=null)+"; queuedDiscovery="+(latest?.Discovering?.selectionId.ToString()??"none")
            +"; page="+(page!=null?"token="+Field(page,"_token")+", round="+Field(page,"_selectionId")+", revision="+Field(page,"_revision")
                +", selected="+Field(page,"_selected")+", readyAt="+Field(page,"_readyAt")+", now="+Time.unscaledTime:"closed")
            +"; confirmInteractable="+(confirm!=null&&confirm.isActiveAndEnabled&&confirm.IsInteractable());
    }
    static IEnumerator Settled(){yield return null;yield return null;Canvas.ForceUpdateCanvases();yield return null;}
    static IEnumerator Fixture(bool formation)
    {
        FinishCurrent();CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();
        var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();
        game.State.entrySupply=null;game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
        game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
        if(!formation)game.State.myClass="侠客";
        if(formation)
        {
            for(int i=0;i<12;i++)
            {
                var card=CardLibrary.FindById("tt3-fireball").Clone();card.cost=i==1?5:2;card.variantKey=i==1?"round7-cost5":"round7-cost2";
                game.State.ownedCards.Add(new OwnedCard{uid="formation-r7-"+i,card=card});
            }
        }
        else
        {
            game.State.ownedCards.Add(new OwnedCard{uid="round7-permanent",card=CardLibrary.FindById("tt3-fireball").Clone()});
            var source=new CardDef{id="round7-generate",name="有界生成检查",type="法术",rarity="古朴",cost=0,desc="获得护甲并生成一张火球。",
                rules=RuleValue.Obj("version",1,"battle",RuleValue.Obj("target",RuleValue.Obj("side","self","area",false)),"triggers",RuleValue.Obj("onPlay",RuleValue.Arr(
                    RuleValue.Obj("op","armor","amount",1),RuleValue.Obj("op","acquire","n",1,"dest","hand","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))),
                    RuleValue.Obj("op","acquire","n",1,"dest","hand","act","zeroCost","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))))))};
            game.State.ownedCards.Add(new OwnedCard{uid="round7-generate",card=source});
            game.State.ownedCards.Add(new OwnedCard{uid="round7-imitate",card=CardLibrary.FindById("tt7-imitate").Clone()});
            game.State.ownedCards.Add(new OwnedCard{uid="round7-martial",card=CardLibrary.FindById("tt2-piercearrow").Clone()});
            game.State.ownedCards.Add(new OwnedCard{uid="round7-permanent-b",card=CardLibrary.FindById("tt3-fireball").Clone()});
            game.State.ownedCards.Add(new OwnedCard{uid="round7-infusion",card=new CardDef{id="round7-infusion",name="注能归属检查",type="法术",rarity="古朴",cost=0,infuse=1,
                desc="注能1，获得1护甲。",rules=RuleValue.Obj("version",1,"battle",RuleValue.Obj("target",RuleValue.Obj("side","self","area",false)),
                    "triggers",RuleValue.Obj("onPlay",RuleValue.Arr(RuleValue.Obj("op","armor","amount",1))))}});
            game.State.ownedCards.Add(new OwnedCard{uid="round7-dig",card=CardLibrary.FindById("tt3-dig-treasure").Clone()});
        }
        game.Bus.Emit(new BattleRequested{Request=new BattleRequest{IsBoss=formation,Layer=1,Name="编组牌堆呈现检查",
            Foes=new List<EnemyStats>{new EnemyStats{id="round7-controlled-foe",name="受控敌人",hp=10000,atk=0}}}});
        yield return Until(()=>!CurrentRunFilm.Active&&(formation?UiStack.Top is DeckSelectionPanel:UiStack.Top is BattleScreen),"formal battle entrance");
        if(!formation)typeof(BattleSession).GetField("energy",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(Session,100);
        yield return Settled();
    }
    static IEnumerator Formation()
    {
        yield return Fixture(true);var session=Session;var page=(DeckSelectionPanel)UiStack.Top;var view=page.GetComponent<CurrentDeckFormation>();
        var select=Named(page,"bossSel-formation-r7-0");var second=Named(page,"bossSel-formation-r7-1");
        Check(Cost(select.transform).text=="2"&&Cost(second.transform).text=="5","same-name variants retain distinct printed fees");
        var scroll=view.ContentScroll;
        var fixedRects=new[]{view.Workspace,(RectTransform)Field(view,"_header"),(RectTransform)Field(view,"_summary"),
            (RectTransform)Field(view,"_body"),(RectTransform)Field(view,"_footer")};
        foreach(var rect in fixedRects)rect.hasChanged=false;
        yield return null;yield return null;yield return null;
        Check(fixedRects.All(rect=>!rect.hasChanged),"stable formation writes fixed geometry every frame");
        Submit(Named(page,"bossFormationRules"));yield return Settled();
        Check(view.RulesExpanded&&scroll.content.rect.height>scroll.viewport.rect.height,"expanded rules and candidate overflow remain scrollable");
        scroll.verticalNormalizedPosition=0;scroll.StopMovement();yield return Settled();var position=scroll.content.anchoredPosition;
        int forced=0;Canvas.WillRenderCanvases observe=()=>forced++;Canvas.preWillRenderCanvases+=observe;
        try{Submit(select);}finally{Canvas.preWillRenderCanvases-=observe;}
        Check(forced==0,"selecting one card forces all canvases synchronously");yield return Settled();
        Check(Named(page,"bossSel-formation-r7-0")==select&&Session.Snapshot.DeckSelection.Selected.Contains("formation-r7-0")
            &&Vector2.Distance(position,scroll.content.anchoredPosition)<.1f,"selection replaces retained candidates or resets their scroll");
        Submit(select);yield return Settled();
        Check(!Session.Snapshot.DeckSelection.Selected.Contains("formation-r7-0")&&Named(page,"bossSel-formation-r7-0")==select,"deselection loses physical UID or control identity");
        var parent=(RectTransform)page.transform;Vector2 before=parent.offsetMax;float oldWidth=view.Workspace.rect.width;
        parent.offsetMax=before-new Vector2(240,0);yield return Settled();
        Check(Mathf.Abs(view.Workspace.rect.width-Mathf.Min(1760,parent.rect.width-88))<.1f&&view.Workspace.rect.width<oldWidth,"actual parent geometry change is not laid out");
        parent.offsetMax=before;yield return Settled();
        Check(Mathf.Abs(view.Workspace.rect.width-oldWidth)<.1f,"restored parent geometry is not laid out");
        var inspect=Named(page,"btDecisionInspect-0");Submit(inspect);yield return Settled();
        Check(UiStack.Top!=page&&Cost(UiStack.Top.transform).text=="2","formation reader loses the exact first variant");
        Submit(Named(UiStack.Top,"zoom-next"));yield return Settled();
        Check(Cost(UiStack.Top.transform).text=="5","formation reader browse merges same-name cost variants");
        Submit(Named(UiStack.Top,"zoom-close"));yield return Settled();
        Check(UiStack.Top==page&&EventSystem.current.currentSelectedGameObject==Named(page,"btDecisionInspect-1").gameObject,"reader does not return to the currently browsed native control");
        var old=select.onClick;_oldFormation=old;Submit(Named(page,"bossCancel"));yield return null;
        var top=UiStack.Top;old.Invoke();Check(UiStack.Top==top&&session.Snapshot.DeckSelection==null,"closed formation input acts on a later page");
    }
    static IEnumerator Piles()
    {
        yield return Fixture(false);var battle=(BattleScreen)UiStack.Top;var session=Session;
        Check(HandCard(battle,"round7-imitate").GetComponentsInChildren<Text>()
            .Any(text=>text.name=="card-state-text"&&text.text=="随动变形"),"real untransformed hand card omits its live-transform state");
        Check(session.PlayCard("round7-martial",0,false).Ok,"real native martial transform command rejected");
        yield return Until(()=>BattleReady(battle)&&((Button)Field(battle,"_consumed")).IsInteractable(),"transformed hand presentation finishes");
        var transformed=HandCard(battle,"round7-imitate");
        Check(transformed.GetComponentsInChildren<Text>().Any(text=>text.name=="card-state-text"&&text.text=="随动变形")
            &&Cost(transformed.transform).text=="1"&&session.GetCardPresentation("round7-imitate").Transformed,"hand reuses a stale face after its real transform");
        Check(session.PlayCard("round7-generate",-1,false).Ok,"real mixed acquire command rejected");
        int printed=CardLibrary.FindById("tt3-fireball").cost;
        string generated=session.GrantedCards.Single(entry=>entry.card.id=="tt3-fireball"&&entry.card.cost==printed).uid;
        string free=session.GrantedCards.Single(entry=>entry.card.id=="tt3-fireball"&&entry.card.cost==0).uid;
        Check(session.GetCardPresentation(generated).Temporary&&!session.GetCardPresentation("round7-permanent").Temporary,"native source projection guesses temporary status");
        yield return Until(()=>BattleReady(battle)&&((Button)Field(battle,"_consumed")).IsInteractable(),"generated hand presentation finishes");
        var hand=(List<string>)Field(session,"hand");hand.Remove("round7-permanent-b");hand.Add("round7-permanent-b");
        BattleEvents.Raise(session.Snapshot);yield return Settled();
        var permanentFace=HandCard(battle,"round7-permanent");var generatedFace=HandCard(battle,generated);
        Check(permanentFace!=generatedFace&&permanentFace.Uids.SequenceEqual(new[]{"round7-permanent","round7-permanent-b"})
            &&generatedFace.Uids.SequenceEqual(new[]{generated})&&generatedFace.GetComponentsInChildren<Text>().Any(text=>text.name=="card-state-text"&&text.text=="临时"),"actual hand merges equal-fee permanent/generated faces and exposes only the first UID state");
        string[] handBefore=hand.ToArray();string infusionRandom=GameRuntime.I.Rng.SaveState();session.PlayCard("round7-infusion",-1,false);yield return Settled();
        Check(session.Snapshot.Infusing?.Uid=="round7-infusion"&&!session.SelectInfusion("round7-infusion").Ok,"formal infusion does not own its source or admits it as material");
        var keys=HandPanel.InfusionKeys(session.Snapshot,BattleView.Api).ToArray();
        Check(keys.Where(uid=>uid=="round7-permanent"||uid=="round7-permanent-b"||uid==generated).SequenceEqual(new[]{"round7-permanent","round7-permanent-b",generated})
            &&!keys.Contains("round7-infusion"),"actual infusion shortcuts ignore source provenance grouping or source exclusion");
        BattleView.Commands.SelectInfusion("round7-permanent");yield return Settled();
        Check(session.Snapshot.Infusing.Picked.SequenceEqual(new[]{"round7-permanent"})&&HandPanel.InfusionKeys(session.Snapshot,BattleView.Api).SequenceEqual(keys),"selected physical UID changes its original provenance shortcut");
        var candidates=HandCards(battle).Where(card=>card.Infusion).ToArray();
        Check(candidates.Single(card=>card.DisplayIndex==0).Uid=="round7-permanent-b"&&candidates.Single(card=>card.Uids.Contains(generated)).Uids.Count==1,"picked representative moves its surviving provenance group behind another source group");
        BattleView.Commands.SelectInfusion(keys[0]);yield return Settled();
        Check(session.Snapshot.Infusing.Picked.Count==0,"original numeric UID cannot withdraw the selected material");
        BattleView.Commands.CancelInfusion();yield return Settled();
        Check(session.Snapshot.Infusing==null&&session.Snapshot.Hand.SequenceEqual(handBefore)&&GameRuntime.I.Rng.SaveState()==infusionRandom,"infusion draft selection/cancel spends a UID or changes a random stream");
        var candidatesForDiscovery=new[]{free,"round7-imitate","round7-permanent-b"};
        foreach(string uid in candidatesForDiscovery)hand.Remove(uid);
        var tail=session.Snapshot.DrawPile.ToArray();((List<string>)Field(session,"drawPile")).InsertRange(0,candidatesForDiscovery);
        int energyBefore=session.Snapshot.Energy;string discoveryRandom=GameRuntime.I.Rng.SaveState();var grantedBefore=session.GrantedCards.Select(entry=>entry.uid).ToArray();
        Check(session.PlayCard("round7-dig",-1,false).Ok,"real dig command did not accept the original-state deck fixture");
        yield return Until(()=>UiStack.Top is DiscoverPanel,"mapped deck discovery UI did not mount");var discovery=(DiscoverPanel)UiStack.Top;
        Check(session.Snapshot.Discovering.candidateUids.SequenceEqual(candidatesForDiscovery),"actual discovery loses temporary/transformed/permanent original UID mapping");
        var freePick=Named(discovery,"discoverPick-0");var transformedPick=Named(discovery,"discoverPick-1");
        Check(Cost(freePick.transform).text=="0"&&Cost(freePick.transform).color==Theme.Hex("#285839")
            &&freePick.GetComponentsInChildren<Text>().Any(text=>text.name=="card-state-text"&&text.text=="临时")
            &&transformedPick.GetComponentsInChildren<Text>().Any(text=>text.name=="card-state-text"&&text.text=="随动变形"),"actual deck candidates omit original fee ink or their authoritative source labels");
        string discoveryToken=session.BattleToken;long discoveryId=session.Snapshot.Discovering.selectionId;
        yield return Until(()=>DiscoveryReady(discovery,discoveryToken,discoveryId)&&Named(discovery,"discoverPick-0").IsInteractable(),
            "mapped candidate admission deadline",()=>DiscoveryDiagnostic(discovery,battle));
        Debug.Log("Battle round7 discovery before pick: "+DiscoveryDiagnostic(discovery,battle));
        Submit(Named(discovery,"discoverPick-0"));
        yield return Until(()=>DiscoveryReady(discovery,discoveryToken,discoveryId)&&(int)Field(discovery,"_selected")==0&&Named(discovery,"discoverConfirm").IsInteractable(),
            "mapped candidate confirmation did not become ready",()=>DiscoveryDiagnostic(discovery,battle));
        Debug.Log("Battle round7 discovery before confirm: "+DiscoveryDiagnostic(discovery,battle));
        Submit(Named(discovery,"discoverConfirm"));
        Debug.Log("Battle round7 discovery after confirm: "+DiscoveryDiagnostic(discovery,battle));
        yield return Until(()=>BattleReady(battle)&&((Button)Field(battle,"_consumed")).IsInteractable(),"mapped original candidate did not return to battle",()=>DiscoveryDiagnostic(discovery,battle));
        Check(session.Snapshot.Hand.Contains(free)&&!session.Snapshot.Hand.Contains("round7-imitate")
            &&session.Snapshot.DrawPile.SequenceEqual(new[]{"round7-imitate","round7-permanent-b"}.Concat(tail))
            &&session.Snapshot.Energy==energyBefore-1&&session.GrantedCards.Select(entry=>entry.uid).SequenceEqual(grantedBefore)
            &&GameRuntime.I.Rng.SaveState()==discoveryRandom,"mapped candidate confirmation replaces a UID, changes source payment/RNG, or loses unselected deck order");
        Check(session.PlayCard("round7-permanent",0,false).Ok&&session.PlayCard(generated,0,false).Ok&&session.PlayCard(free,0,false).Ok,"real permanent/generated cards could not populate the consumed pile");
        var opener=(Button)Field(battle,"_consumed");yield return Until(()=>BattleReady(battle)&&opener.IsInteractable(),"presentation finishes before pile input");
        var draw=session.Snapshot.DrawPile.ToArray();string random=GameRuntime.I.Rng.SaveState();
        var original=BattleView.Api;var calls=new CountingApi(original);BattleView.Api=calls;
        try
        {
            Submit(opener);yield return Settled();var page=(BattlePileScreen)UiStack.Top;
            var copies=page.Stacks.Where(stack=>stack.Card.id=="tt3-fireball"&&stack.Card.cost==printed).ToArray();
            Check(copies.Length==2&&copies.All(stack=>stack.Count==1)&&copies.Count(stack=>stack.State.Temporary)==1,"same face with different permanent/generated provenance is merged");
            int count=page.Stacks.Sum(stack=>stack.Count);
            Check(calls.Presentations==count&&calls.CardReads==0&&calls.CostReads==0,"pile opening repeats live lookups after its one projection per UID");
            int temporary=page.Stacks.ToList().FindIndex(stack=>stack.Card.id=="tt3-fireball"&&stack.Card.cost==printed&&stack.State.Temporary);
            int permanent=page.Stacks.ToList().FindIndex(stack=>stack.Card.id=="tt3-fireball"&&!stack.State.Temporary);
            var tempButton=Named(page,"btDecisionInspect-"+temporary);var permanentButton=Named(page,"btDecisionInspect-"+permanent);
            Check(tempButton.GetComponentsInChildren<Text>().Any(text=>text.name=="card-state-text"&&text.text=="临时")
                &&!permanentButton.GetComponentsInChildren<Text>().Any(text=>text.name=="card-state-text"),"real pile faces omit or misapply provenance labels");
            int zero=page.Stacks.ToList().FindIndex(stack=>stack.Uids.Contains(free));var zeroCost=Cost(Named(page,"btDecisionInspect-"+zero).transform);
            Check(zeroCost.text=="0"&&zeroCost.color==Theme.Hex("#285839")&&page.Stacks[zero].State.BaseCost==printed,"actual zero-fee generated pile face loses its original fee or discount ink");
            var position=page.Scroll.content.anchoredPosition;int before=calls.Presentations;var stale=tempButton.onClick;
            _oldInspect=stale;_oldBack=Named(page,"btGraveBack").onClick;_oldToken=session.BattleToken;
            Submit(tempButton);yield return Settled();
            Check(UiStack.Top!=page&&UiStack.Top.GetComponentsInChildren<Text>().Any(text=>text.name=="card-state-text"&&text.text=="临时"),"actual reader omits the selected generated-card state");
            Submit(Named(UiStack.Top,"zoom-close"));yield return Settled();
            Check(UiStack.Top==page&&Vector2.Distance(position,page.Scroll.content.anchoredPosition)<.1f
                &&EventSystem.current.currentSelectedGameObject==tempButton.gameObject&&calls.Presentations==before,"reader return loses scroll/focus or re-derives the frozen pile");
            Submit(Named(page,"btGraveBack"));yield return null;
            Check(UiStack.Top==battle&&EventSystem.current.currentSelectedGameObject==opener.gameObject,"consumed pile does not return focus to its actual HUD opener");
            var deckOpener=(Button)Field(battle,"_draw");int prior=calls.Presentations;Submit(deckOpener);yield return Settled();var deck=(BattlePileScreen)UiStack.Top;
            Check(deck.Kind=="deck"&&deck.Stacks.Count==draw.Length&&deck.Stacks.All(stack=>stack.Count==1)
                &&calls.Presentations-prior==draw.Length,"deck projection groups physical UIDs or repeats its card query");
            deck.CloseFromEscape();yield return null;
            Check(UiStack.Top==battle&&EventSystem.current.currentSelectedGameObject==deckOpener.gameObject,"Esc pile return does not restore its real deck opener");
            stale.Invoke();Check(UiStack.Top==battle&&session.Snapshot.DrawPile.SequenceEqual(draw)&&GameRuntime.I.Rng.SaveState()==random,"closed pile callback opens a stale reader or changes draw order/RNG");
            var card=session.GetCardPresentation(generated).Card.Clone();card._baseCost=7;card.cost=1;
            Check(card.Clone()._baseCost==7&&!SaveJson.Stringify(card).Contains("_baseCost"),"runtime printed fee is lost by clone or persisted into run/archive data");
            var options=new CardFaceOptions{CostOverride=1};
            Check(CardVisual.CostTone(card,options)=="down","common card cost color ignores battle-only printed fee");
        }
        finally{BattleView.Api=original;}
    }
    public static IEnumerator Run()
    {
        Assertions=0;FinishCurrent();CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();MistSameFace();
        yield return Formation();yield return Piles();yield return Fixture(false);
        var current=(BattleScreen)UiStack.Top;var focus=(Button)Field(current,"_draw");EventSystem.current.SetSelectedGameObject(focus.gameObject);
        string random=GameRuntime.I.Rng.SaveState();_oldFormation.Invoke();_oldInspect.Invoke();_oldBack.Invoke();
        Check(Session.BattleToken!=_oldToken&&UiStack.Top==current&&EventSystem.current.currentSelectedGameObject==focus.gameObject
            &&GameRuntime.I.Rng.SaveState()==random,"retired events steal a newer session's page, focus or random state");
        FinishCurrent();
    }
    static void MistSameFace()
    {
        var mist=CardLibrary.FindById("tt3eq-mistbox").Clone();var repeated=CardLibrary.FindById("tt2-piercearrow").Clone();
        var other=CardLibrary.FindById("tt2-swiftarrow").Clone();
        var sourceField=typeof(CardLibrary).GetField("_source",BindingFlags.Static|BindingFlags.NonPublic);
        var customsField=typeof(CardLibrary).GetField("_customs",BindingFlags.Static|BindingFlags.NonPublic);
        var source=(Func<IReadOnlyList<CardDef>>)sourceField.GetValue(null);var customs=customsField.GetValue(null);var loader=CardLibrary.CustomsLoader;
        try
        {
            CardLibrary.CustomsLoader=()=>Array.Empty<CardDef>();customsField.SetValue(null,null);CardLibrary.Init(()=>new[]{repeated,other});
            var session=new BattleSession();session.Start(new BattleStartContext{host=new MistHost{OwnedCards=new[]{new OwnedCard{uid="real-mist-source",card=mist}}},rng=new Rng(1031),
                enemies=new[]{new EnemyInput{id="mist-r7-foe",name="受控敌人",hp=10000,atk=0}}});
            Check(session.PlayCard("real-mist-source",-1,false).Ok&&session.UseEquipment("real-mist-source").Ok,"real mist-box equipment or active skill rejected in controlled two-move catalog");
            int first=session.Snapshot.Discovering.options.ToList().FindIndex(card=>card.id==repeated.id);
            Check(first>=0&&session.PickDiscover(first).Ok,"first actual mist discovery did not award the chosen built-in");
            int second=session.Snapshot.Discovering.options.ToList().FindIndex(card=>card.id==repeated.id);
            Check(second>=0&&session.PickDiscover(second).Ok,"second actual mist discovery did not allow the same ID again");
            var pair=session.GrantedCards.Where(entry=>entry.card.id==repeated.id).Select(entry=>session.GetCardPresentation(entry.uid)).ToArray();
            var stacks=CurrentBattlePileData.Build(pair.Select(state=>new CurrentBattlePileData.Entry{Uid=state.Uid,Card=state.Card,EffectiveCost=state.EffectiveCost,State=state}));
            Check(pair.Length==2&&pair[0].BaseCost==pair[1].BaseCost&&pair[0].Card.cost==pair[1].Card.cost
                &&stacks.Count==1&&stacks[0].Uids.SequenceEqual(pair.Select(state=>state.Uid)),"equivalent real same-ID/same-fee mist awards split only because internal printed-fee storage differs");
        }
        finally{CardLibrary.CustomsLoader=loader;customsField.SetValue(null,customs);CardLibrary.Init(source);}
    }
    sealed class MistHost:BattleHost
    {
        public int Hp{get;set;}=1000;public int MaxHp=>1000;public int Atk=>0;public int SpellPower=>0;
        public string MyClass=>"侠客";public string CharacterId=>"wu";public IReadOnlyList<OwnedCard> OwnedCards{get;set;}
        public void Log(string text,string kind=null){}public void Heal(int value)=>Hp=Math.Min(MaxHp,Hp+value);public void OnBattleEnd(BattleResult result){}
    }

    // Observation-only proxy: every call delegates to the real Boot implementation.
    sealed class CountingApi:IBattleViewApi
    {
        readonly IBattleViewApi _inner;public int Presentations,CardReads,CostReads;
        public CountingApi(IBattleViewApi inner){_inner=inner;}
        public BattleCardPresentation CardPresentation(string uid){Presentations++;return _inner.CardPresentation(uid);}
        public Sdt.UI.Screens.Battle.OwnedCard FindCard(string uid){CardReads++;return _inner.FindCard(uid);}
        public int EffCostOf(CardDef card){CostReads++;return _inner.EffCostOf(card);}
        public bool AegisBlocked(FoeSnapshot foe)=>_inner.AegisBlocked(foe);
        public IReadOnlyList<StatusChip> CurseChips(IReadOnlyDictionary<string,int> status)=>_inner.CurseChips(status);
        public int InfuseOf(CardDef card)=>_inner.InfuseOf(card);
        public void MarkDreadShown()=>_inner.MarkDreadShown();
        public string PileTip(IReadOnlyList<string> uids)=>_inner.PileTip(uids);
        public IReadOnlyList<FloatSpec> TakeFloats()=>_inner.TakeFloats();
        public string TargetSide(CardDef card)=>_inner.TargetSide(card);
        public string UnplayableReason(CardDef card)=>_inner.UnplayableReason(card);
        public PreviewResult PreviewDamage(int attack,int spell,FoeSnapshot foe,int amount,string type,CardDef card=null)=>_inner.PreviewDamage(attack,spell,foe,amount,type,card);
        public AffixDef AffixMeta(string affix)=>_inner.AffixMeta(affix);
        public string DmgTypeName(string type)=>_inner.DmgTypeName(type);
        public int BattleStartDraw=>_inner.BattleStartDraw;public int BattleTurnDraw=>_inner.BattleTurnDraw;public int BattleEnergy=>_inner.BattleEnergy;
        public int StarterSha=>_inner.StarterSha;public int BossDeckSize=>_inner.BossDeckSize;
        public IReadOnlyList<CardDef> AllCards=>_inner.AllCards;public CardDef StarterAttack=>_inner.StarterAttack;
    }
}
