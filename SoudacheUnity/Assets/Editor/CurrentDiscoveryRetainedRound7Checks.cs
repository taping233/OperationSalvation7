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

public static class CurrentDiscoveryRetainedRound7Checks
{
    public static int Assertions { get; private set; }
    static void Check(bool value,string message)
    {Assertions++;if(!value)throw new InvalidOperationException("Retained discovery: "+message);}
    static T Field<T>(object instance,string name)=>(T)instance.GetType().GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(instance);
    static void Set(BattleSession session,string name,object value)=>typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).SetValue(session,value);
    static Button Button(Panel page,string name)=>page.GetComponentsInChildren<Button>().Single(button=>button.name==name);
    static IEnumerator Until(Func<bool> ready,string message)
    {
        float deadline=Time.realtimeSinceStartup+12;
        while(!ready())
        {
            if(Time.realtimeSinceStartup>deadline)throw new TimeoutException(message);
            yield return null;
        }
    }
    static void Submit(Button button)
    {
        Check(button.isActiveAndEnabled&&button.IsInteractable(),"current control is available");
        EventSystem.current.SetSelectedGameObject(button.gameObject);
        ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);
    }
    static IEnumerator Fixture(bool expanded=false)
    {
        CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();
        var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");
        CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();
        game.State.entrySupply=null;game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
        game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
        var ids=expanded?new[]{"cmtn125e1nk0","cmtn1r10xnl1","cmtn1r10xnl1","cmtn1r10xnl1"}
            :new[]{"tt3-dig-treasure","tt3-fireball","tt3-fireball","tt3-fireball","starter-attack"};
        for(int i=0;i<ids.Length;i++)game.State.ownedCards.Add(new OwnedCard{uid="retained-r7-"+i,card=CardLibrary.FindById(ids[i]).Clone()});
        game.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="发现控件生命周期检查",Foes=new List<EnemyStats>{new EnemyStats{id="retained-r7-foe",name="受控敌人",hp=10000,atk=0}}}});
        yield return Until(()=>UiStack.Top is BattleScreen&&!CurrentRunFilm.Active,"formal battle did not mount");
        var session=BattleViewApi.Session;
        Set(session,"hand",expanded?new List<string>{"retained-r7-0","retained-r7-1","retained-r7-2","retained-r7-3"}:new List<string>{"retained-r7-0"});
        Set(session,"drawPile",expanded?new List<string>():new List<string>{"retained-r7-1","retained-r7-2","retained-r7-3","retained-r7-4"});Set(session,"energy",100);
        if(expanded)for(int i=1;i<=3;i++)Check(BattleView.Commands.PlayCard("retained-r7-"+i,-1,false).Ok,"actual dark form increases discovery choices");
        Check(BattleView.Commands.PlayCard("retained-r7-0",-1,false).Ok,"actual source command enters discovery");
        yield return Until(()=>UiStack.Top is DiscoverPanel,"actual discovery did not mount");
        yield return null;
    }
    public static IEnumerator Run()
    {
        Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
        bool reduced=CurrentUiPreferences.ReducedMotion;
        Check(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out var reason),reason);
        try
        {
            yield return Fixture();var page=(DiscoverPanel)UiStack.Top;var session=BattleViewApi.Session;
            var first=Button(page,"discoverPick-0");var second=Button(page,"discoverPick-1");
            var confirm=Button(page,"discoverConfirm");var cancel=Button(page,"discoverCancel");
            var frames=Field<List<Outline>>(page,"_selectionFrames");
            int descendants=page.GetComponentsInChildren<Transform>().Length,revision=Field<int>(page,"_revision");
            float readyAt=Field<float>(page,"_readyAt");string rng=GameRuntime.I.Rng.SaveState();
            for(int i=0;i<8;i++){BattleEvents.Raise(session.Snapshot);page.SetSnapshot(session.Snapshot);}
            yield return null;
            Check(Button(page,"discoverPick-0")==first&&Button(page,"discoverConfirm")==confirm&&Button(page,"discoverCancel")==cancel,
                "unrelated actual snapshots retain pick, confirm and cancel controls");
            Check(page.GetComponentsInChildren<Transform>().Length==descendants&&Field<int>(page,"_revision")==revision,
                "stable snapshots leave the rendered tree and callback generation unchanged");
            Check(Field<float>(page,"_readyAt")==readyAt&&frames.All(frame=>!frame.enabled),
                "stable snapshots retain the admission deadline and unselected cards have no outline mesh effect");
            yield return new WaitForSecondsRealtime(.4f);
            Submit(first);
            Check(EventSystem.current.currentSelectedGameObject==first.gameObject&&Button(page,first.name)==first&&Button(page,"discoverConfirm")==confirm,
                "selection keeps keyboard focus and current controls");
            Check(Field<int>(page,"_selected")==0&&confirm.IsInteractable()&&frames[0].enabled&&!frames[0].useGraphicAlpha
                &&frames[0].effectColor.a>0&&first.GetComponent<Image>().color.a==0&&frames.Skip(1).All(frame=>!frame.enabled),
                "first selection activates its visible effect independently of the transparent hit graphic");
            yield return null;Canvas.ForceUpdateCanvases();
            var mesh=first.GetComponent<Image>().canvasRenderer.GetMesh();
            Check(mesh!=null&&mesh.colors32.Any(color=>color.a>0),"selected transparent hit graphic produces actual visible outline vertices");
            Submit(second);
            Check(Field<int>(page,"_selected")==1&&!frames[0].enabled&&frames[1].enabled&&frames.Count(frame=>frame.enabled)==1,
                "changing selection updates only the old/new visual state");
            page.SetSnapshot(session.Snapshot);
            Check(Field<int>(page,"_selected")==1&&EventSystem.current.currentSelectedGameObject==second.gameObject
                &&page.GetComponentsInChildren<Transform>().Length==descendants&&Field<int>(page,"_revision")==revision,
                "unrelated refresh preserves selected identity, focus and tree without rebinding callbacks");
            Check(GameRuntime.I.Rng.SaveState()==rng&&session.Snapshot.Energy==99,"UI-only selection and refresh do not sample or pay again");
            var oldPick=first.onClick;var oldConfirm=confirm.onClick;var oldCancel=cancel.onClick;
            // Replace an actual owned-round option to exercise the view invalidation boundary; no command is committed from this fixture.
            var state=Field<object>(session,"discovering");
            var options=(List<CardDef>)state.GetType().GetField("options").GetValue(state);
            var changed=options[0].Clone();changed.cost+=3;options[0]=changed;
            BattleEvents.Raise(session.Snapshot);page.SetSnapshot(session.Snapshot);
            bool oldDetached=!first.gameObject.activeInHierarchy;
            yield return null;
            Check(Button(page,"discoverPick-0")!=first&&oldDetached&&Field<int>(page,"_revision")>revision,
                "changed current options immediately detach old controls and create a new callback generation");
            Check(Field<int>(page,"_selected")==-1&&!Button(page,"discoverConfirm").IsInteractable(),
                "changed candidates require a new deliberate selection");
            oldPick.Invoke();oldConfirm.Invoke();oldCancel.Invoke();
            Check(session.Snapshot.Discovering!=null&&session.Snapshot.Energy==99&&Field<int>(page,"_selected")==-1,
                "callbacks captured before changed candidates cannot select, confirm or cancel the replacement view");
            Submit(Button(page,"discoverCancel"));
            yield return Until(()=>UiStack.Top is BattleScreen,"cancel did not resume battle");
            Check(session.Snapshot.Discovering==null&&session.Snapshot.DrawPile.SequenceEqual(new[]{"retained-r7-1","retained-r7-2","retained-r7-3","retained-r7-4"}),
                "real cancellation still returns the original bottom UIDs in order");
            yield return Fixture();var next=BattleViewApi.Session;var nextPage=(DiscoverPanel)UiStack.Top;
            string nextRng=GameRuntime.I.Rng.SaveState();oldPick.Invoke();oldConfirm.Invoke();oldCancel.Invoke();
            Check(next.Snapshot.Discovering!=null&&next.Snapshot.Energy==99&&Field<int>(nextPage,"_selected")==-1&&GameRuntime.I.Rng.SaveState()==nextRng,
                "closed previous-session callbacks cannot affect the next real battle");
            Submit(Button(nextPage,"discoverCancel"));
            yield return Until(()=>UiStack.Top is BattleScreen,"final cancellation did not resume battle");
            yield return Fixture(true);page=(DiscoverPanel)UiStack.Top;session=BattleViewApi.Session;
            Check(session.Snapshot.Discovering.Options.Count==6&&session.Snapshot.Energy==97,
                "three real dark forms produce six choices before the real summon is paid");
            yield return new WaitForSecondsRealtime(.4f);Canvas.ForceUpdateCanvases();
            var scroll=page.GetComponentsInChildren<ScrollRect>().Single(item=>item.transform.parent.name=="ovBody");
            scroll.verticalNormalizedPosition=0;yield return null;Canvas.ForceUpdateCanvases();
            var last=Button(page,"discoverPick-5");var rect=(RectTransform)last.transform;
            var point=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,rect.TransformPoint(rect.rect.center));
            var pointer=new PointerEventData(EventSystem.current){position=point,button=PointerEventData.InputButton.Left};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(pointer,hits);
            Check(hits.Count>0&&ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject)==last.gameObject,
                "additional choices wrap into vertical scrolling and the sixth real candidate receives the first hit");
            ExecuteEvents.Execute(last.gameObject,pointer,ExecuteEvents.pointerClickHandler);
            Check(Field<int>(page,"_selected")==5&&Button(page,"discoverConfirm").IsInteractable(),
                "a scrolled sixth choice is selectable without clipping or another payment");
            Submit(Button(page,"discoverCancel"));
            yield return Until(()=>UiStack.Top is BattleScreen,"expanded discovery cancellation did not resume battle");
            Check(session.Snapshot.Energy==97&&session.Snapshot.Hand.Contains("retained-r7-0"),
                "expanded choice cancellation retains the unpaid source after already played dark forms");
        }
        finally
        {CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",reduced,out _);CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
    }
}
