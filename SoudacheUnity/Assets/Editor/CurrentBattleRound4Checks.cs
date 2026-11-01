// Legal post-stellar physical copies; formal bridge/UI dispatch, isolated profile, no OS input.
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

public static class CurrentBattleRound4Checks
{
    static BattleScreen _screen;static BattleSession _session;
    public static int Assertions { get; private set; }
    public static string Step { get; private set; }
    static void Require(bool value,string text){Assertions++;if(!value)throw new InvalidOperationException("Battle round4 ("+Step+"): "+text);}
    static void Clear(){CurrentRunFilm.CancelActive();Sdt.UI.Screens.Menu.SuggestionBox.CloseIfOpen();while(UiStack.Count>0)UiStack.Pop();_screen=null;_session=null;}
    static object Field(string name)=>typeof(BattleSession).GetField(name,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(_session);
    static void Set(string name,object value)=>typeof(BattleSession).GetField(name,BindingFlags.NonPublic|BindingFlags.Instance).SetValue(_session,value);
    static IEnumerator Until(Func<bool> ready,string message)
    {float deadline=Time.realtimeSinceStartup+12;while(!ready()){if(Time.realtimeSinceStartup>=deadline)throw new TimeoutException("Battle round4 ("+Step+"): "+message+" "+Diagnostic());yield return null;}}
    static string Diagnostic()
    {
        var state=_session?.Snapshot;var queue=_screen==null?null:_screen.GetComponent<BattlePresentationQueue>();
        var game=GameRuntime.I;var random=_session==null?null:(Rng)Field("rng");var top=UiStack.Top;
        return SaveJson.Stringify(new{Step,focused=Application.isFocused,hold=CurrentUiPreferences.EndTurnHold,film=CurrentRunFilm.Active,
            top=top==null?null:top.GetType().Name,screenLive=_screen!=null,ready=_screen!=null&&Ready(),
            beats=queue==null?-1:queue.PendingBeats,presentationBusy=queue!=null&&queue.Busy,
            rngSame=ReferenceEquals(random,game.Rng),sessionRng=random?.SaveState(),gameRng=game.Rng.SaveState(),
            turn=state?.Turn,phase=state?.Phase,busy=state?.Busy,over=state?.Over,pending=state?.TurnEndPending,
            choice=state?.RuleChoice?.labels,hand=state?.Hand,draw=state?.DrawPile,
            currentToken=GameSnapshotRef.Current?.BattleToken,sessionToken=state?.BattleToken});
    }
    static bool Ready()=>_screen!=null&&UiStack.Top==_screen&&!CurrentRunFilm.Active&&!_screen.GetComponent<BattlePresentationQueue>().Busy;
    static Button TextButton(string text)=>_screen.GetComponentsInChildren<Button>().Single(button=>button.GetComponentInChildren<Text>()?.text==text);
    static Button Choice(int index)=>TextButton(_session.Snapshot.RuleChoice.labels[index]);
    static void Submit(Button button)
    {
        Require(button!=null&&button.isActiveAndEnabled&&button.IsInteractable()&&EventSystem.current!=null,"submit target unavailable");
        EventSystem.current.SetSelectedGameObject(button.gameObject);
        Require(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"submit handler absent");
    }
    static int Seed()
    {
        for(int seed=1;seed<4096;seed++)
        {var rng=new Rng(seed);rng.Random("battle","target");bool first=rng.Random("battle","generation")<.5;rng.Random("battle","target");if(first&&rng.Random("battle","generation")<.5)return seed;}
        throw new InvalidOperationException("Controlled legal draw roll unavailable");
    }
    static IEnumerator Fixture(int scales=2)
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");Clear();
        game.State.entrySupply=null;game.State.inventory.Clear();game.State.usedPocket.Clear();game.State.ownedCards.Clear();
        game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.myClass="牧师";game.State.Phase="idle";
        game.State.ownedCards.Add(new OwnedCard{uid="turn-r4-scale-a",card=CardLibrary.FindById("tt13-scale-armor").Clone()});
        game.State.ownedCards.Add(new OwnedCard{uid="turn-r4-scale-b",card=CardLibrary.FindById("tt13-scale-armor").Clone()});
        game.State.ownedCards.Add(new OwnedCard{uid="turn-r4-pouch",card=CardLibrary.FindById("tt3-crimson-pouch").Clone()});
        game.State.ownedCards.Add(new OwnedCard{uid="turn-r4-hand",card=CardLibrary.FindById("tt2-piercearrow").Clone()});
        game.State.ownedCards.Add(new OwnedCard{uid="turn-r4-potion",card=CardLibrary.FindById("tt3-blue-potion").Clone()});
        game.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="敌方等待原生验收",Foes=new List<EnemyStats>{
            new EnemyStats{id="turn-r4-first",name="第一敌人",hp=10000,atk=3},new EnemyStats{id="turn-r4-second",name="第二敌人",hp=10000,atk=4}}}});
        yield return Until(()=>UiStack.Top is BattleScreen&&!CurrentRunFilm.Active,"formal battle absent");
        _screen=(BattleScreen)UiStack.Top;_session=BattleViewApi.Session;
        Require(_session!=null&&BattleView.Commands!=null,"bridge missing");
        Require(_session.PlayCard("turn-r4-scale-a",-1,false).Ok&&(scales==2?_session.PlayCard("turn-r4-scale-b",-1,false).Ok:_session.PlayCard("turn-r4-pouch",-1,false).Ok),"real equipment rejected");
        // Construct only the result of the real stellar operation (tested by Core): two granted on-draw lamp UIDs.
        var granted=(List<OwnedCard>)Field("granted");var onDraw=(HashSet<string>)Field("castOnDraw");
        foreach(string uid in new[]{"turn-r4-copy-a","turn-r4-copy-b"})
        {granted.Add(new OwnedCard{uid=uid,card=CardLibrary.FindById("tt3-magic-lamp").Clone()});onDraw.Add(uid);}
        Set("drawPile",new List<string>{"turn-r4-copy-b","turn-r4-copy-a"});
        var random=(Rng)Field("rng");
        random.LoadState(new Rng(Seed()).SaveState());
        BattleEvents.Raise(_session.Snapshot);yield return Until(Ready,"equipment presentation did not drain");
        Require(TextButton("结束回合").IsInteractable(),"turn control unavailable before formal command");
        // CurrentEndTurnHold deliberately requires real window focus. This background check owns
        // the reactive selection UI, so begin through the installed command, then submit actual choices.
        Debug.Log("[Battle round4 before EndTurn] "+Diagnostic());BattleView.Commands.EndTurn();
        Debug.Log("[Battle round4 after EndTurn] "+Diagnostic());
        Require(_session.Snapshot.TurnEndPending&&_session.Snapshot.RuleChoice!=null&&_session.Turn==1&&_session.Snapshot.Player.Hp==997,"formal EndTurn did not create the controlled response: "+Diagnostic());
        yield return Until(()=>Ready()&&_session.Snapshot.RuleChoice!=null&&GameSnapshotRef.Current?.TurnEndPending==true,"reactive native choice absent");
    }
    public static IEnumerator Run()
    {
        Assertions=0;Step="isolated profile";string profile=Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA");
        Require(!string.IsNullOrWhiteSpace(profile)&&Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(profile),StringComparison.OrdinalIgnoreCase),"isolated profile required");
        bool reduced=CurrentUiPreferences.ReducedMotion;Require(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out var reason),reason);
        try
        {
            Step="enemy input ownership and visible locks";yield return Fixture();
            var snapshot=_session.Snapshot;var first=snapshot.RuleChoice;var firstButton=Choice(2);var old=firstButton.onClick;
            Require(snapshot.Turn==1&&!snapshot.Busy&&snapshot.Phase=="player"&&snapshot.TurnEndPending&&snapshot.Player.Hp==997,"enemy advanced before its first response choice");
            Require(_screen.GetComponentsInChildren<Text>().Any(text=>text.text.Contains("正在结束回合 · 等待选择")),"HUD did not express the owned wait");
            Require(!TextButton("等待当前选择").IsInteractable(),"end-turn control still appears available");
            Require(!_screen.GetComponentsInChildren<Button>().Single(button=>button.name==snapshot.HeroSkill.name).IsInteractable(),"hero skill remains available during wait");
            var equipment=_screen.GetComponentsInChildren<Button>().Where(button=>button.name=="逆鳞护甲").ToArray();
            Require(equipment.Length==2&&equipment.All(button=>!button.IsInteractable()),"equipped controls remain available during wait");
            Require(!_screen.GetComponentsInChildren<Button>().Single(button=>button.GetComponentInChildren<Text>()?.text.Contains("恢复药水")==true).IsInteractable(),"item remains available during wait");
            Require(_screen.GetComponentsInChildren<BattleCard>().Single(card=>card.Uid=="turn-r4-hand").Off&&firstButton.IsInteractable(),"ordinary hand not locked or owned choice locked");
            Require(snapshot.Hand.All(uid=>uid!="turn-r4-copy-a"&&uid!="turn-r4-copy-b"),"queued copies leaked into current hand/materials");
            yield return null;yield return null;
            Require(ReferenceEquals(_session.Snapshot.RuleChoice,first)&&Choice(2)==firstButton&&_session.Turn==1,"waiting replaced the live choice or advanced time");
            Step="same-label next choice rejects old UnityEvent";Submit(firstButton);
            yield return Until(()=>Ready()&&_session.Snapshot.RuleChoice!=null&&!ReferenceEquals(_session.Snapshot.RuleChoice,first),"second same-hit copy did not enter its own choice");
            var second=_session.Snapshot.RuleChoice;var secondButton=Choice(2);int hp=GameRuntime.I.State.hp;string random=((Rng)Field("rng")).SaveState();
            Require(secondButton!=firstButton&&secondButton.IsInteractable()&&_session.Turn==1&&hp==997,"second same-label choice reused stale controls or enemy progressed");
            old.Invoke();
            Require(ReferenceEquals(_session.Snapshot.RuleChoice,second)&&_session.Turn==1&&GameRuntime.I.State.hp==hp&&((Rng)Field("rng")).SaveState()==random,"old choice event consumed another owned choice");
            Step="current choice resumes and rechecks freeze";Submit(secondButton);
            yield return Until(()=>Ready()&&!_session.Snapshot.TurnEndPending,"choice did not complete the owned turn");
            Require(_session.Turn==2&&_session.Snapshot.RuleChoice==null&&GameRuntime.I.State.hp==997&&TextButton("结束回合").IsInteractable(),"resume ignored freeze, retained waiting UI or ran another enemy hit");

            Step="active equipment lock, old screen event and forced exit";yield return Fixture(1);
            Require(!_screen.GetComponentsInChildren<Button>().Single(button=>button.name=="深红丝袋").IsInteractable(),"active pouch skill remains available during owned wait");
            var current=_session.Snapshot.RuleChoice;hp=GameRuntime.I.State.hp;random=((Rng)Field("rng")).SaveState();old.Invoke();
            Require(ReferenceEquals(_session.Snapshot.RuleChoice,current)&&GameRuntime.I.State.hp==hp&&((Rng)Field("rng")).SaveState()==random,"old screen event crossed battle owner");
            var exiting=_session;Require(exiting.Retract().Ok,"controlled forced exit rejected");
            yield return Until(()=>!GameRuntime.I.State.battleActive,"forced exit did not settle");
            Require(!exiting.Snapshot.TurnEndPending&&!exiting.RuleInputPending,"forced exit retained owned waiting state");
            Step="complete";
        }
        finally
        {
            Clear();if(!CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",reduced,out var error))throw new InvalidOperationException("Battle round4 preference restore: "+error);
        }
    }
}
