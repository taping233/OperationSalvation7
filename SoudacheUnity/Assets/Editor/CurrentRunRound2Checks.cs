// Current run UI on controlled sources; constructed native submit/continuation events only.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public static class CurrentRunRound2Checks
{
    public static string Step { get; private set; }
    public static int Assertions { get; private set; }
    static readonly BindingFlags Private=BindingFlags.Instance|BindingFlags.NonPublic;
    static void Require(bool value,string message)
    { Assertions++;if(!value)throw new InvalidOperationException("Run round2: "+message); }
    static void Clear()
    { CurrentRunFilm.CancelActive();Sdt.UI.Screens.Menu.SuggestionBox.CloseIfOpen();while(UiStack.Count>0)UiStack.Pop(); }
    static void Start()
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");Clear();
        game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();game.State.Phase="modal";
    }
    static EventDialogScreen EventFixture()
    {
        Start();var game=GameRuntime.I;game.State.entrySupply=null;
        var first=CardLibrary.FindById("tt3-fireball").Clone();first.variantKey="round2-first";first.name="复原变体甲";
        var second=first.Clone();second.variantKey="round2-second";second.name="复原变体乙";
        game.State.usedPocket.Add(new PocketStack{card=first,count=2});game.State.usedPocket.Add(new PocketStack{card=second,count=1});
        game.CurrentNodeReceipt.type="event";
        game.CurrentNodeReceipt.eventProgress=new EventProgress{eventId="cmtn7qttxqo4",stage="restore",need=1};
        game.SaveCurrent();Require(game.Saves.LastWriteSucceeded,"event fixture save failed");
        EventDialogScreen.Open(CardLibrary.FindById("cmtn7qttxqo4"),null);
        return UiStack.Top as EventDialogScreen;
    }
    public static IEnumerator Run()
    {
        Assertions=0;
        int saves=0;bool counting=false;
        GameRuntime.I.Bus.On<SaveCompleted>(_=>{if(counting)saves++;});
        try
        {
            Step="distinct actual restore rows and selected variant";
            var page=EventFixture();Require(page!=null,"actual event page not opened");
            yield return new WaitForSecondsRealtime(.22f);
            var tiles=page.GetComponentsInChildren<CurrentRewardTile>();
            Require(tiles.Length==2&&tiles.Select(tile=>tile.Key).Distinct().Count()==2,"restore rows collapsed into one tile");
            var faces=tiles.Select(tile=>((CurrentRewardItem)typeof(CurrentRewardTile).GetField("_item",Private).GetValue(tile)).Card).ToArray();
            Require(faces.Select(card=>card.variantKey).SequenceEqual(new[]{"round2-first","round2-second"}),"actual displayed source lost its variants");
            Require(tiles[0].GetComponentsInChildren<Text>().Any(text=>text.text.Contains("复原变体甲"))
                &&tiles[1].GetComponentsInChildren<Text>().Any(text=>text.text.Contains("复原变体乙")),"visible restore faces did not use the actual snapshots");
            var second=(Button)typeof(CurrentRewardTile).GetField("_claim",Private).GetValue(tiles[1]);
            EventSystem.current.SetSelectedGameObject(second.gameObject);
            Require(ExecuteEvents.Execute(second.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"native restore submit rejected");
            var game=GameRuntime.I;
            Require(game.State.ownedCards.Single().card.variantKey=="round2-second"&&game.State.usedPocket.Single().card.variantKey=="round2-first"
                &&game.State.usedPocket[0].count==2,"actual second-row submit restored another variant");
            yield return null;

            Step="entry take-all uses one formal checkpoint";
            Start();game=GameRuntime.I;game.State.classCard=null;
            game.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{"tt3-fireball","tt3-fireball"}};
            game.SaveCurrent();Require(game.Saves.LastWriteSucceeded,"entry fixture save failed");EntrySupplyScreen.Open();yield return null;
            var takeAll=UiStack.Top.GetComponentsInChildren<Button>().First(button=>button.GetComponentsInChildren<Text>().Any(text=>text.text=="全部收下"));
            saves=0;counting=true;EventSystem.current.SetSelectedGameObject(takeAll.gameObject);
            Require(ExecuteEvents.Execute(takeAll.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"native entry batch submit rejected");
            counting=false;
            Require(saves==1&&game.State.entrySupply.taken.SequenceEqual(new[]{0,1})&&game.State.ownedCards.Count==2
                &&game.State.ownedCards.All(card=>card.brought==1),"entry batch did not atomically save both brought cards once");
            yield return null;

            Step="covered and expired event continuations keep the new owner";
            page=EventFixture();yield return null;
            var cover=ScreenMount.Show<CurrentRunRound2Cover>("run-round2-cover");cover.Build();
            var focused=cover.GetComponentInChildren<Button>();EventSystem.current.SetSelectedGameObject(focused.gameObject);
            page.ValidationAcceptOutcome(new EventOutcome{Settled=true,Stage="complete"});
            Require(UiStack.Count==2&&UiStack.PanelAt(0)==page&&UiStack.Top==cover
                &&EventSystem.current.currentSelectedGameObject==focused.gameObject,"covered continuation closed its owner or stole focus");
            UiStack.Close(cover);game=GameRuntime.I;game.State.seed++;
            page.ValidationAcceptOutcome(new EventOutcome{Settled=true,Stage="complete"});
            Require(UiStack.Top==page&&game.State.ownedCards.Count==0,"expired run continuation changed its page or granted cards");
        }
        finally{counting=false;Clear();}
    }
}

public sealed class CurrentRunRound2Cover:Panel
{
    public override void Build()=>UIKit.Btn(transform,"round2 focus sentinel",()=>{});
}
