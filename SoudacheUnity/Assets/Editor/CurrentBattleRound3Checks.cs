// Controlled native battle UI dispatch through the real bridge; no OS keyboard/mouse input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
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
using OwnedCard = Sdt.Core.OwnedCard;

public static class CurrentBattleRound3Checks
{
    const string Hero="battle-r3-hero",First="battle-r3-dart-a",Second="battle-r3-dart-b";
    static BattleScreen _screen;static BattleSession _session;
    public static int Assertions { get; private set; }
    public static string Step { get; private set; }
    static void Require(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Battle round3 ("+Step+"): "+message);}
    static void Clear(){CurrentRunFilm.CancelActive();Sdt.UI.Screens.Menu.SuggestionBox.CloseIfOpen();while(UiStack.Count>0)UiStack.Pop();_screen=null;_session=null;}
    static IEnumerator Until(Func<bool> ready,string message)
    {
        float deadline=Time.realtimeSinceStartup+12;
        while(!ready()){if(Time.realtimeSinceStartup>=deadline)throw new TimeoutException("Battle round3 ("+Step+"): "+message);yield return null;}
    }
    static bool Ready()
    {
        if(_screen==null||UiStack.Top!=_screen||CurrentRunFilm.Active)return false;
        var queue=_screen.GetComponent<BattlePresentationQueue>();
        return queue!=null&&!queue.Busy&&GameSnapshotRef.Current?.BattleToken==_session.BattleToken;
    }
    static Button Cancel()=>_screen==null?null:_screen.GetComponentsInChildren<Button>().SingleOrDefault(button=>button.GetComponentInChildren<Text>()?.text=="取消 Esc");
    static bool PromptNames(Button cancel,string name)=>cancel!=null&&cancel.transform.parent.GetComponentsInChildren<Text>().Any(text=>text.text.Contains(name)&&text.text.Contains("下一段"));
    static void Submit(Button button)
    {
        Require(button!=null&&button.isActiveAndEnabled&&button.IsInteractable()&&EventSystem.current!=null,"native submit control unavailable");
        EventSystem.current.SetSelectedGameObject(button.gameObject);
        Require(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"native submit handler absent");
    }
    static void ClickHero()
    {
        var card=_screen.GetComponentsInChildren<BattleCard>().Single(view=>view.Uid==Hero);
        Require(card.isActiveAndEnabled&&!card.Off&&EventSystem.current!=null,"real hero card unavailable");
        var input=new PointerEventData(EventSystem.current){button=PointerEventData.InputButton.Left,
            position=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,card.CardRt.position)};
        Require(ExecuteEvents.Execute(card.gameObject,input,ExecuteEvents.pointerDownHandler)&&ExecuteEvents.Execute(card.gameObject,input,ExecuteEvents.pointerUpHandler),"real hero pointer handlers absent");
    }
    static Button Enemy()=>_screen.GetComponentsInChildren<Button>().Single(button=>button.name.StartsWith("sts-foe ",StringComparison.Ordinal));
    static IEnumerator Fixture(int enemyHp)
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");Clear();
        game.State.entrySupply=null;game.State.inventory.Clear();game.State.usedPocket.Clear();game.State.ownedCards.Clear();
        game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
        game.State.ownedCards.Add(new OwnedCard{uid=Hero,card=CardLibrary.FindById("tt8-hero-sword").Clone()});
        game.State.ownedCards.Add(new OwnedCard{uid=First,card=CardLibrary.FindById("tt7-bloodpoison").Clone()});
        game.State.ownedCards.Add(new OwnedCard{uid=Second,card=CardLibrary.FindById("tt7-bloodpoison").Clone()});
        for(int i=0;i<3;i++)game.State.ownedCards.Add(new OwnedCard{uid="battle-r3-filler-"+i,card=CardLibrary.FindById("tt3-fireball").Clone()});
        game.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="自动释放二段原生验收",Foes=new List<EnemyStats>{new EnemyStats{id="battle-r3-foe",name="受控敌人",hp=enemyHp,atk=0}}}});
        yield return Until(()=>UiStack.Top is BattleScreen&&!CurrentRunFilm.Active,"formal battle did not open");
        _screen=(BattleScreen)UiStack.Top;_session=BattleViewApi.Session;
        Require(_session!=null&&BattleView.Commands!=null,"formal battle bridge/session missing");
        // Only place known physical UIDs for a deterministic draw. Resolver, cards, bridge and UI remain real.
        typeof(BattleSession).GetField("hand",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(_session,new List<string>{Hero});
        typeof(BattleSession).GetField("drawPile",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(_session,new List<string>{"battle-r3-filler-2","battle-r3-filler-1","battle-r3-filler-0",Second,First});
        BattleEvents.Raise(_session.Snapshot);
        yield return Until(Ready,"controlled physical draw did not reach the native view");
    }
    public static IEnumerator Run()
    {
        Assertions=0;Step="isolated profile";
        string profile=Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA");
        Require(!string.IsNullOrWhiteSpace(profile)&&Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(profile),StringComparison.OrdinalIgnoreCase),"isolated profile required");
        bool reduced=CurrentUiPreferences.ReducedMotion;
        Require(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out var reason),reason);
        try
        {
            Step="first automatic target remains current";yield return Fixture(10000);ClickHero();
            yield return Until(()=>Ready()&&_session.Snapshot.PendingTarget?.uid==First&&Cancel()!=null,"first dependent target prompt absent");
            var first=_session.Snapshot.PendingTarget;var firstCancel=Cancel();var oldCancel=firstCancel.onClick;
            Require(first.Kind=="rulePick"&&_session.RuleInputPending&&_session.Snapshot.Hand.Contains(Second),"second physical card advanced before first rulePick");
            Require(PromptNames(firstCancel,"血毒双镖")&&firstCancel.IsInteractable(),"first next-target prompt or cancel unavailable");
            yield return null;yield return null;
            Require(_session.Snapshot.PendingTarget?.SelectionId==first.SelectionId&&Cancel()==firstCancel&&PromptNames(firstCancel,"血毒双镖"),"waiting replaced the current target or native cancel control");

            Step="real enemy submit resumes the next physical UID";Submit(Enemy());
            yield return Until(()=>Ready()&&_session.Snapshot.PendingTarget?.uid==Second&&Cancel()!=null,"next automatic target did not appear after enemy submit");
            var second=_session.Snapshot.PendingTarget;var secondCancel=Cancel();
            Require(second.Kind=="rulePick"&&second.SelectionId!=first.SelectionId&&!_session.Snapshot.Hand.Contains(Second),"second automatic target lost its distinct cast identity");
            Require(secondCancel!=firstCancel&&secondCancel.IsInteractable()&&PromptNames(secondCancel,"血毒双镖"),"second target did not bind a current prompt/cancel");
            int hp=_session.Snapshot.Foes[0].Hp;var hand=_session.Snapshot.Hand.ToArray();
            oldCancel.Invoke();
            Require(_session.Snapshot.PendingTarget?.SelectionId==second.SelectionId&&_session.Snapshot.PendingTarget.uid==Second&&_session.Snapshot.Foes[0].Hp==hp&&_session.Snapshot.Hand.SequenceEqual(hand),"old cancel UnityEvent consumed the new target or changed battle facts");
            yield return null;
            Require(Cancel()==secondCancel&&PromptNames(secondCancel,"血毒双镖"),"old cancel removed the current native prompt");

            Step="current native cancel completes the remaining batch";Submit(secondCancel);
            yield return Until(()=>Ready()&&_session.Snapshot.PendingTarget==null,"current cancel did not complete the batch");
            Require(!_session.RuleInputPending&&_session.Snapshot.Phase=="player"&&Cancel()==null,"cancel left stale targeting UI or pending continuation");

            Step="target victory does not construct another target";yield return Fixture(2);ClickHero();
            yield return Until(()=>Ready()&&_session.Snapshot.PendingTarget?.uid==First&&Cancel()!=null,"terminal fixture did not expose the first target");
            var terminal=_session;string token=terminal.BattleToken;int laterTargets=0;
            Action<BattleSnapshot> observe=snapshot=>{if(snapshot.BattleToken==token&&snapshot.PendingTarget?.Kind=="rulePick"&&snapshot.PendingTarget.uid==Second)laterTargets++;};
            BattleSession.SnapshotChanged+=observe;
            try
            {
                int id=terminal.Snapshot.PendingTarget.SelectionId;oldCancel.Invoke();
                Require(terminal.Snapshot.PendingTarget?.SelectionId==id,"old battle's cancel crossed the native owner token");
                Submit(Enemy());
                yield return Until(()=>terminal.Snapshot.Over&&!GameRuntime.I.State.battleActive,"terminal dependent target did not settle through the bridge");
                Require(terminal.Snapshot.PendingTarget==null&&!terminal.RuleInputPending&&laterTargets==0,"terminal target constructed another automatic target");
                yield return null;yield return null;
                Require(laterTargets==0&&terminal.Snapshot.PendingTarget==null,"late native presentation reconstructed an automatic target after victory");
            }
            finally{BattleSession.SnapshotChanged-=observe;}
            Step="complete";
        }
        finally
        {
            Clear();
            if(!CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",reduced,out var restoreReason))throw new InvalidOperationException("Battle round3 preference restore: "+restoreReason);
        }
    }
}
