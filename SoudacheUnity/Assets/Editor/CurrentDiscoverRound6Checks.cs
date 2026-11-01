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
using OwnedCard = Sdt.Core.OwnedCard;

public static class CurrentDiscoverRound6Checks
{
    public static int Assertions { get; private set; }
    static BattleSession _session;
    static void Check(bool value,string message)
    {Assertions++;if(!value)throw new InvalidOperationException("Discover round6: "+message);}
    static object Field(object instance,string name)=>instance.GetType().GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(instance);
    static List<string> Ledger(string name)=>(List<string>)Field(_session,name);
    static void Set(string name,object value)=>typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).SetValue(_session,value);
    static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
    static Button Button(Panel page,string name)=>page.GetComponentsInChildren<Button>().Single(button=>button.name==name);
    static void Inside(RectTransform element,RectTransform parent,string label)
    {
        var corners=new Vector3[4];element.GetWorldCorners(corners);
        float left=float.PositiveInfinity,bottom=float.PositiveInfinity,right=float.NegativeInfinity,top=float.NegativeInfinity;
        foreach(var corner in corners){var point=parent.InverseTransformPoint(corner);left=Mathf.Min(left,point.x);right=Mathf.Max(right,point.x);bottom=Mathf.Min(bottom,point.y);top=Mathf.Max(top,point.y);}
        var bounds=parent.rect;
        Check(left>=bounds.xMin-.5f&&right<=bounds.xMax+.5f&&bottom>=bounds.yMin-.5f&&top<=bounds.yMax+.5f,
            label+" fits actual parent: element="+Rect.MinMaxRect(left,bottom,right,top)+" parent="+bounds);
    }
    static void Geometry(BattleSubpageBase page)
    {
        Canvas.ForceUpdateCanvases();
        var card=page.GetComponentsInChildren<RectTransform>().Single(rect=>rect.name=="card");
        var header=page.GetComponentsInChildren<RectTransform>().Single(rect=>rect.name=="ovTitle");
        Inside(card,(RectTransform)App.Canvas.transform,"battle subpage surface");Inside(header,card,"battle subpage header");
        foreach(var text in header.GetComponentsInChildren<Text>())Inside(text.rectTransform,header,"battle subpage title");
        var scroll=page.GetComponentsInChildren<ScrollRect>().Single(item=>item.transform.parent.name=="ovBody");
        Inside(scroll.viewport,card,"battle subpage body viewport");
        if(page is DiscoverPanel)
        {
            foreach(var text in page.GetComponentsInChildren<Text>().Where(item=>item.name=="discoverPrompt"||item.name=="discoverHint"))Inside(text.rectTransform,scroll.viewport,text.name);
            foreach(var button in page.GetComponentsInChildren<Button>().Where(item=>item.name.StartsWith("discoverPick-",StringComparison.Ordinal)))Inside((RectTransform)button.transform,scroll.viewport,"current discovery candidate");
        }
        else foreach(var text in scroll.content.GetComponentsInChildren<Text>())Inside(text.rectTransform,scroll.viewport,"grave content");
        foreach(var button in page.GetComponentsInChildren<Button>().Where(item=>item.transform.parent.name=="ov-btns"))Inside((RectTransform)button.transform,card,"battle subpage footer control");
    }
    static void Submit(Button button)
    {
        Check(button!=null&&button.isActiveAndEnabled&&button.IsInteractable(),"actual current discovery control available");
        EventSystem.current.SetSelectedGameObject(button.gameObject);
        Check(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"actual EventSystem Submit accepted");
    }
    static IEnumerator Until(Func<bool> ready,string message)
    {
        float deadline=Time.realtimeSinceStartup+12;
        while(!ready())
        {
            if(Time.realtimeSinceStartup>=deadline)throw new TimeoutException("Discover round6: "+message+"; top="+(UiStack.Top==null?"none":UiStack.Top.GetType().Name)
                +"; discover="+_session?.Snapshot.Discovering?.selectionId+"; over="+_session?.Snapshot.Over);
            yield return null;
        }
    }
    static IEnumerator Fixture(bool deck,bool pureSource=false,bool stored=false)
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");Clear();
        game.State.entrySupply=null;game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
        game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
        var source=CardLibrary.FindById(stored?"tt7-stratagem":pureSource?"cmtn125e1nk0":"tt3-dig-treasure").Clone();
        if(!deck&&!pureSource&&!stored)
        {
            // Explicit structured source fixture: two n=1 jobs with identical real candidates.
            source.id="round6-native-discover";source.name="连续发现检查";source.cost=0;
            var acquire=RuleValue.Obj("op","acquire","n",1,"pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball")),"dest","discover");
            source.rules=RuleValue.Obj("version",1,"battle",RuleValue.Obj("target",RuleValue.Obj("side","self","area",false)),
                "triggers",RuleValue.Obj("onPlay",RuleValue.Arr(acquire,acquire)));
        }
        game.State.ownedCards.Add(new OwnedCard{uid="discover-r6-source",card=source});
        foreach(string uid in new[]{"discover-r6-a","discover-r6-b","discover-r6-c","discover-r6-d"})
            game.State.ownedCards.Add(new OwnedCard{uid=uid,card=CardLibrary.FindById("tt3-fireball").Clone()});
        if(stored)
        {
            var a=CardLibrary.FindById("tt3-fireball").Clone();a.variantKey="native-stored-a";a.cost=2;
            var b=a.Clone();b.variantKey="native-stored-b";b.cost=5;
            game.State.ownedCards.Add(new OwnedCard{uid="discover-stored-a",card=a,stored=true,pouchOf=CardContainerCommands.PouchId});
            game.State.ownedCards.Add(new OwnedCard{uid="discover-stored-b",card=b,stored=true,pouchOf=CardContainerCommands.PouchId});
        }
        game.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="发现取消原生检查",Foes=new List<EnemyStats>{new EnemyStats{id="discover-r6-foe",name="受控敌人",hp=10000,atk=0}}}});
        yield return Until(()=>UiStack.Top is BattleScreen&&!CurrentRunFilm.Active,"formal battle did not mount");
        _session=BattleViewApi.Session;Check(_session!=null&&BattleView.Commands!=null,"actual session/command bridge installed");
        Set("hand",new List<string>{"discover-r6-source"});
        Set("drawPile",new List<string>{"discover-r6-a","discover-r6-b","discover-r6-c","discover-r6-d"});Set("energy",100);
        Check(BattleView.Commands.PlayCard("discover-r6-source",-1,false).Ok,"formal source command did not enter discovery");
        yield return Until(()=>UiStack.Top is DiscoverPanel,"actual discovery page absent");
        yield return null;Geometry((DiscoverPanel)UiStack.Top);
    }
    static IEnumerator GraveGeometry()
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");Clear();
        game.State.entrySupply=null;game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
        game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
        for(int index=0;index<3;index++)game.State.ownedCards.Add(new OwnedCard{uid="grave-r6-"+index,card=CardLibrary.FindById("tt3-fireball").Clone()});
        game.Bus.Emit(new BattleRequested{Request=new BattleRequest{IsBoss=true,Name="墓地容器几何检查",Foes=new List<EnemyStats>{new EnemyStats{id="grave-r6-foe",name="受控首脑",hp=10000,atk=0}}}});
        yield return Until(()=>BattleViewApi.Session?.Snapshot.DeckSelection!=null&&UiStack.Top is DeckSelectionPanel&&!CurrentRunFilm.Active,"formal grave geometry boss selection absent");
        _session=BattleViewApi.Session;var selection=_session.Snapshot.DeckSelection;
        foreach(var entry in selection.Cards.Take(selection.Need))if(!selection.Selected.Contains(entry.uid))BattleView.Commands.SelectDeckCard(entry.uid);
        BattleView.Commands.ConfirmDeck();
        yield return Until(()=>UiStack.Top is BattleScreen&&!CurrentRunFilm.Active,"formal grave geometry boss battle absent");
        // Controlled grave contents isolate layout; this does not claim to test how fuel enters the grave.
        var grave=new List<string>{"grave-r6-0","grave-r6-1"};
        foreach(string pile in new[]{"hand","drawPile","discard"})Ledger(pile).RemoveAll(uid=>grave.Contains(uid));
        Ledger("consumed").AddRange(grave);Set("grave",grave);BattleView.Commands.OpenGrave();
        yield return Until(()=>UiStack.Top is GravePanel,"actual grave page absent");yield return null;
        var page=(GravePanel)UiStack.Top;Geometry(page);
        var topBar=App.Canvas.GetComponentInChildren<CurrentRunTopBar>(true);var headerGroup=topBar!=null?topBar.GetComponent<CanvasGroup>():null;
        Check(topBar!=null&&headerGroup!=null&&!CurrentRunTopBar.Visible&&headerGroup.alpha==0,"actual grave coverage hides the shared header and its CanvasGroup");
        Check(_session.Snapshot.Mode=="boss"&&_session.Snapshot.ViewingGrave
            &&page.GetComponentsInChildren<Text>().Any(text=>text.text.Contains("火球")&&text.text.Contains("×2")),"actual boss grave renders grouped controlled original UIDs");
        Submit(page.GetComponentsInChildren<Button>().Single(button=>button.transform.parent.name=="ov-btns"));
        yield return Until(()=>UiStack.Top is BattleScreen,"grave return did not resume actual battle");
        yield return null;
        Check(topBar!=null&&headerGroup!=null&&CurrentRunTopBar.Visible&&headerGroup.alpha==1,"actual grave return restores the shared header and its CanvasGroup");
        Check(!_session.Snapshot.ViewingGrave,"grave return clears its actual view state");
    }
    public static IEnumerator Run()
    {
        Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
        bool reduced=CurrentUiPreferences.ReducedMotion;
        Check(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out var reason),reason);
        try
        {
            yield return Fixture(true);var page=(DiscoverPanel)UiStack.Top;
            Check(page.GetComponentsInChildren<Text>().Any(text=>text.name=="discoverPrompt"&&text.text.Contains("牌库底"))
                &&page.GetComponentsInChildren<Text>().Any(text=>text.name=="discoverHint"&&text.text.Contains("原实体")),"real dig displays existing deck identity rather than generated-temporary copy text");
            var oldCancel=Button(page,"discoverCancel").onClick;var state=_session.Snapshot.Discovering;string random=((Rng)Field(_session,"rng")).SaveState();
            Submit(Button(page,"discoverCancel"));
            Check(_session.Snapshot.Discovering==null&&_session.Snapshot.DrawPile.SequenceEqual(new[]{"discover-r6-a","discover-r6-b","discover-r6-c","discover-r6-d"})
                &&_session.Snapshot.Pdef.Armor==0&&((Rng)Field(_session,"rng")).SaveState()==random,"actual cancel restores all original deck UIDs without armor or RNG changes");
            yield return Until(()=>UiStack.Top is BattleScreen,"cancel did not return to battle");

            yield return Fixture(false);page=(DiscoverPanel)UiStack.Top;
            Check(page.GetComponentsInChildren<Text>().Any(text=>text.name=="discoverPrompt"&&text.text.Contains("选择 1 张获得")),"ordinary generated discovery accurately describes obtaining a mixed-type candidate");
            float ready=(float)Field(page,"_readyAt");
            BattleEvents.Raise(_session.Snapshot);page.SetSnapshot(_session.Snapshot);yield return null;
            Check((float)Field(page,"_readyAt")==ready,"unrelated snapshot does not restart current round's 350ms admission deadline");
            yield return new WaitForSecondsRealtime(.4f);
            var oldPick=Button(page,"discoverPick-0").onClick;oldCancel.Invoke();
            Check(_session.Snapshot.Discovering!=null,"closed previous session cancel cannot dismiss a new discovery");
            Submit(Button(page,"discoverPick-0"));var currentConfirm=Button(page,"discoverConfirm").onClick;
            Geometry(page);
            var firstCancel=Button(page,"discoverCancel").onClick;state=_session.Snapshot.Discovering;
            Submit(Button(page,"discoverConfirm"));
            yield return Until(()=>UiStack.Top is DiscoverPanel&&_session.Snapshot.Discovering?.selectionId!=state.selectionId,"next identical discovery absent");
            page=(DiscoverPanel)UiStack.Top;var second=_session.Snapshot.Discovering;
            Check(second.n==state.n&&second.Options.Select(card=>card.id).SequenceEqual(state.Options.Select(card=>card.id))
                &&second.selectionId!=state.selectionId&&!Button(page,"discoverConfirm").interactable&&(int)Field(page,"_selected")==-1,"identical next n/options receive a new owner and clear previous selection");
            string[] acquired=_session.Snapshot.Hand.ToArray();oldPick.Invoke();currentConfirm.Invoke();firstCancel.Invoke();
            Check(_session.Snapshot.Discovering.selectionId==second.selectionId&&_session.Snapshot.Hand.SequenceEqual(acquired)
                &&(int)Field(page,"_selected")==-1,"old same-label pick/confirm/cancel cannot act on successor round");
            Submit(Button(page,"discoverCancel"));
            Check(_session.Snapshot.Discovering==null&&_session.Snapshot.Hand.SequenceEqual(acquired)&&acquired.Length==1,"cancel remainder preserves exactly the first confirmed generated reward");
            yield return Until(()=>UiStack.Top is BattleScreen,"generated cancellation did not resume battle");

            yield return Fixture(false,true);page=(DiscoverPanel)UiStack.Top;state=_session.Snapshot.Discovering;
            random=((Rng)Field(_session,"rng")).SaveState();var offered=state.Options.Select(card=>card.id).ToArray();
            var uncommitted=_session.Snapshot;var previewPick=Button(page,"discoverPick-0").onClick;
            Check(state.sourceCommit=="preview"&&state.sourceUid=="discover-r6-source"&&uncommitted.Energy==100
                &&uncommitted.Hand.SequenceEqual(new[]{"discover-r6-source"})&&!Ledger("played").Contains("discover-r6-source")
                &&Button(page,"discoverCancel").GetComponentInChildren<Text>().text.Contains("取消使用")
                &&page.GetComponentsInChildren<Text>().Any(text=>text.name=="discoverHint"&&text.text.Contains("尚未使用")),"actual mysterious-summon preview exposes uncommitted source and accurate cancel wording");
            Submit(Button(page,"discoverCancel"));
            Check(_session.Snapshot.Energy==100&&_session.Snapshot.Hand.SequenceEqual(uncommitted.Hand)
                &&!Ledger("played").Contains("discover-r6-source")&&((Rng)Field(_session,"rng")).SaveState()==random,"actual pure-source cancel leaves source, payment and post-generation RNG unchanged");
            yield return Until(()=>UiStack.Top is BattleScreen,"preview cancel did not return to battle");
            Check(BattleView.Commands.PlayCard("discover-r6-source",-1,false).Ok,"reopen actual mysterious-summon rejected");
            yield return Until(()=>UiStack.Top is DiscoverPanel,"reopened preview absent");page=(DiscoverPanel)UiStack.Top;
            Check(_session.Snapshot.Discovering.Options.Select(card=>card.id).SequenceEqual(offered)&&((Rng)Field(_session,"rng")).SaveState()==random,"same-turn actual source reuses exact candidates without another RNG draw");
            previewPick.Invoke();Check((int)Field(page,"_selected")==-1&&!Button(page,"discoverConfirm").interactable,"cancelled preview pick cannot preselect its successor");
            var selectedAward=_session.Snapshot.Discovering.Options[0];var beforeAwards=_session.GrantedCards.Select(entry=>entry.uid).ToHashSet();
            yield return new WaitForSecondsRealtime(.4f);Submit(Button(page,"discoverPick-0"));Submit(Button(page,"discoverConfirm"));
            var awarded=_session.GrantedCards.Where(entry=>!beforeAwards.Contains(entry.uid)).ToArray();
            Check(_session.Snapshot.Discovering==null&&_session.Snapshot.Energy==98&&!_session.Snapshot.Hand.Contains("discover-r6-source")
                &&Ledger("played").Count(uid=>uid=="discover-r6-source")==1&&awarded.Length==1&&awarded[0].card.id==selectedAward.id
                &&awarded[0].card.cost==selectedAward.cost&&awarded[0].card.variantKey==selectedAward.variantKey
                &&(selectedAward.type=="道具"?_session.Snapshot.Hand.Count==0:_session.Snapshot.Hand.SequenceEqual(new[]{awarded[0].uid}))
                &&((Rng)Field(_session,"rng")).SaveState()==random,"real first confirmation pays once, grants the exact selected variant and routes its physical UID by card type without another popup or sample");
            yield return Until(()=>UiStack.Top is BattleScreen,"confirmed actual preview did not return to battle");

            yield return Fixture(false,stored:true);page=(DiscoverPanel)UiStack.Top;
            random=((Rng)Field(_session,"rng")).SaveState();var storedSnapshot=_session.Snapshot;
            Check(storedSnapshot.Discovering.sourceCommit=="preview"&&storedSnapshot.Discovering.kind=="stored"
                &&storedSnapshot.Discovering.Options.Select(card=>card.variantKey).SequenceEqual(new[]{"native-stored-a","native-stored-b"})
                &&Button(page,"discoverPick-0").GetComponentsInChildren<Text>().Any(text=>text.transform.parent.name=="cost"&&text.text=="2")
                &&Button(page,"discoverPick-1").GetComponentsInChildren<Text>().Any(text=>text.transform.parent.name=="cost"&&text.text=="5"),"actual stratagem exposes each stored variant in source UID order and both printed costs");
            Submit(Button(page,"discoverCancel"));
            Check(GameRuntime.I.State.ownedCards.Count(entry=>entry.pouchOf==CardContainerCommands.PouchId)==2
                &&_session.Snapshot.Energy==100&&_session.Snapshot.Hand.SequenceEqual(storedSnapshot.Hand)
                &&((Rng)Field(_session,"rng")).SaveState()==random,"stored preview cancel preserves both physical mothers, source and RNG");
            yield return Until(()=>UiStack.Top is BattleScreen,"stored preview cancel did not return to battle");
            Check(BattleView.Commands.PlayCard("discover-r6-source",-1,false).Ok,"stored preview reopen rejected");
            yield return Until(()=>UiStack.Top is DiscoverPanel,"stored preview reopen absent");page=(DiscoverPanel)UiStack.Top;
            yield return new WaitForSecondsRealtime(.4f);Submit(Button(page,"discoverPick-1"));Submit(Button(page,"discoverConfirm"));
            Check(_session.Snapshot.Discovering==null&&GameRuntime.I.State.ownedCards.Any(entry=>entry.uid=="discover-stored-a")
                &&!GameRuntime.I.State.ownedCards.Any(entry=>entry.uid=="discover-stored-b")&&Ledger("consumed").Count(uid=>uid=="discover-stored-b")==1
                &&!Ledger("consumed").Contains("discover-stored-a")&&_session.Snapshot.Energy==99
                &&((Rng)Field(_session,"rng")).SaveState()==random,"actual stratagem confirmation consumes only selected same-ID physical UID and charges its source once");
            yield return Until(()=>UiStack.Top is BattleScreen,"stored direct release did not return to battle");
            yield return GraveGeometry();

            yield return Fixture(true);page=(DiscoverPanel)UiStack.Top;firstCancel.Invoke();
            Check(_session.Snapshot.Discovering!=null,"old render cancel cannot affect a later session");
            page.CloseFromEscape();Check(_session.Snapshot.Discovering==null,"formal Escape closes via current owned discover cancellation");
            yield return Until(()=>UiStack.Top is BattleScreen,"Escape cancellation did not resume battle");
            yield return Fixture(true);var oldCommands=BattleView.Commands;var replacedSession=_session;
            string replacedToken=_session.BattleToken;long replacedSelection=_session.Snapshot.Discovering.selectionId;
            yield return Fixture(true);page=(DiscoverPanel)UiStack.Top;
            Check(replacedSession.Snapshot.Discovering!=null&&!ReferenceEquals(replacedSession,_session)
                &&!oldCommands.PickDiscover(0,replacedToken,replacedSelection).Ok&&!oldCommands.CancelDiscover(replacedToken,replacedSelection).Ok
                &&replacedSession.Snapshot.Discovering.selectionId==replacedSelection&&_session.Snapshot.Discovering!=null,"obsolete command bridge rejects its still-pending earlier session after replacement");
            var terminal=Button(page,"discoverCancel").onClick;
            typeof(BattleSession).GetMethod("Finish",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(_session,new object[]{(bool?)false});
            terminal.Invoke();Check(_session.Snapshot.Over&&_session.Snapshot.Discovering==null,"terminal discovery callback cannot recreate input or mutate finished battle");
        }
        finally
        {
            Clear();
            if(!CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",reduced,out var error))throw new InvalidOperationException("Discover round6 preference restore: "+error);
        }
        yield return null;
    }
}
