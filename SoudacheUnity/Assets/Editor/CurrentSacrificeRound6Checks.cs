using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Bag;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using OwnedCard = Sdt.Core.OwnedCard;

public static class CurrentSacrificeRound6Checks
{
    public static int Assertions { get; private set; }
    static void Check(bool value,string message)
    {Assertions++;if(!value)throw new InvalidOperationException("Sacrifice round6: "+message);}
    static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
    static Button Button(Panel page,string name)=>page.GetComponentsInChildren<Button>().Single(button=>button.name==name);
    static Button Pick(Panel page,int index)=>Button(page,"sacrificePick-offer-"+index);
    static HashSet<string> Selected(CardSacrificeScreen page)=>(HashSet<string>)typeof(CardSacrificeScreen).GetField("_selected",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(page);
    static void Submit(Button button)
    {
        Check(button!=null&&button.isActiveAndEnabled&&button.IsInteractable(),"actual current control available");
        EventSystem.current.SetSelectedGameObject(button.gameObject);
        Check(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"actual EventSystem Submit accepted");
    }
    static CardSacrificeScreen Fixture(bool emergency)
    {
        Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");
        for(int i=0;i<game.GetEntrySupplyCards().Count;i++)Check(game.ClaimEntrySupply(i,out var reason),reason);
        Clear();var node=game.Map.Nodes.First(item=>item.type==(emergency?"emergencyExit":"altar")&&(!emergency||item.layerIdx==2));
        game.State.layerIdx=node.layerIdx;game.State.trackPos=node.idx;game.State.Phase="modal";
        game.State.altarActivated=false;game.State.ownedCards.Clear();game.State.inventory.Clear();
        for(int i=0;i<9;i++)
        {
            var card=CardLibrary.FindById("tt3-fireball").Clone();card.cost=i%3;card.variantKey="sacrifice-round6-"+i;card.desc="造成 "+(7+i)+" 点法术伤害。";
            game.State.ownedCards.Add(new OwnedCard{uid="offer-"+i,card=card,safe=i==6?true:null,stored=i==7||i==8,pouchOf=i==8?CardContainerCommands.PouchId:null});
        }
        game.SaveCurrent();Check(game.Saves.LastWriteSucceeded,"fixture saved in isolated profile");
        Check(new SaveSystem().ReadSlot(5)?.ownedCards.Count==9,"fixture independently reloads under formal run validation");
        CardSacrificeScreen.Open(emergency);Check(UiStack.Top is CardSacrificeScreen,"formal sacrifice page opened");return (CardSacrificeScreen)UiStack.Top;
    }
    public static IEnumerator Run()
    {
        Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
        try
        {
            var game=GameRuntime.I;var page=Fixture(false);yield return null;yield return null;
            var picks=page.GetComponentsInChildren<Button>().Where(button=>button.name.StartsWith("sacrificePick-",StringComparison.Ordinal)).ToArray();
            Check(picks.Length==6&&game.GetSacrificeCandidates().Count==6,"only ordinary carried cards are candidates");
            var first=Pick(page,0);var variant=Pick(page,2);var face=first.transform.Find("card-tt3-fireball");
            Check(face!=null&&first.GetComponentsInChildren<Text>().Any(text=>text.transform.parent.name=="cost"&&text.text=="0")
                &&variant.GetComponentsInChildren<Text>().Any(text=>text.transform.parent.name=="cost"&&text.text=="2"),"same-name variants expose real card face and different costs");
            Check(first.GetComponentsInChildren<Text>().Any(text=>text.text.Contains("造成 7"))
                &&variant.GetComponentsInChildren<Text>().Any(text=>text.text.Contains("造成 9")),"variant descriptions remain distinct in actual card text");
            var scroll=first.GetComponentInParent<ScrollRect>();var content=scroll.content;
            content.anchoredPosition=new Vector2(0,120);var position=content.anchoredPosition;
            Submit(first);Submit(Pick(page,1));Submit(variant);
            Check(Selected(page).SetEquals(new[]{"offer-0","offer-1","offer-2"})&&Button(page,"sacrificeConfirm").interactable,"three distinct UID choices enable confirmation");
            Submit(Pick(page,3));Check(Selected(page).Count==3&&!Selected(page).Contains("offer-3"),"fourth UID cannot exceed three choices");
            Submit(Pick(page,1));Check(Selected(page).Count==2&&!Button(page,"sacrificeConfirm").interactable,"selecting the same UID retracts only it");Submit(Pick(page,1));
            yield return null;yield return null;
            Check(Pick(page,0)==first&&first.transform.Find("card-tt3-fireball")==face&&scroll.content==content
                &&content.anchoredPosition==position,"pick and retract retain controls, card face, scroll content and offset");
            var surviving=Pick(page,1);var stalePick=surviving.onClick;var staleConfirm=Button(page,"sacrificeConfirm").onClick;
            var cover=UiStack.Show<SettingsScreen>("sacrifice-cover");CurrentRunFilm.CancelActive();
            stalePick.Invoke();Check(Selected(page).Count==3,"covered picker callback cannot mutate selection");
            game.State.ownedCards.Single(entry=>entry.uid=="offer-0").safe=true;
            game.State.ownedCards.Add(new OwnedCard{uid="offer-new",card=CardLibrary.FindById("tt3-fireball").Clone()});
            UiStack.Close(cover);staleConfirm.Invoke();
            Check(Selected(page).SetEquals(new[]{"offer-1","offer-2"})&&!game.State.altarActivated,"same-frame return prunes unavailable UID before stale confirmation can run");
            yield return null;yield return null;
            Check(Selected(page).SetEquals(new[]{"offer-1","offer-2"})&&Pick(page,1)==surviving
                &&page.GetComponentsInChildren<Button>().Any(button=>button.name=="sacrificePick-offer-new")&&scroll.content==content&&content.anchoredPosition==position,"return prunes unavailable UID, adds current inventory and retains surviving controls and scroll");
            stalePick.Invoke();staleConfirm.Invoke();
            Check(Selected(page).Count==2&&!game.State.altarActivated,"pre-return callbacks cannot toggle current candidate or confirm a new render");
            var oldCancel=Button(page,"sacrificeCancel").onClick;Submit(Button(page,"sacrificeCancel"));
            Check(UiStack.Top is AltarRitualScreen&&game.State.Phase=="modal","ordinary cancel returns to actual altar entry");
            var returned=UiStack.Top;oldCancel.Invoke();stalePick.Invoke();Check(UiStack.Top==returned,"closed page events cannot open or close the returned entry");

            page=Fixture(true);page.CloseFromEscape();
            Check(UiStack.Top is EmergencyModal&&game.State.Phase=="modal","Escape returns emergency picker to emergency entry");
            page=Fixture(false);var expired=Pick(page,0).onClick;var expiredCancel=Button(page,"sacrificeCancel").onClick;
            var replacement=SaveJson.Read<RunState>(SaveJson.Stringify(game.State));
            typeof(GameRuntime).GetProperty("State").SetValue(game,replacement);
            expired.Invoke();expiredCancel.Invoke();
            Check(UiStack.Top==page&&Selected(page).Count==0&&!replacement.altarActivated,"same-slot replacement State rejects old choices and cancel");
            UiStack.Close(page);Check(replacement.Phase=="modal","closing expired page does not change replacement State phase");
            page=Fixture(false);expired=Pick(page,0).onClick;expiredCancel=Button(page,"sacrificeCancel").onClick;
            game.State.layerIdx=(game.State.layerIdx+1)%game.Map.Layers.Count;
            expired.Invoke();expiredCancel.Invoke();Check(Selected(page).Count==0&&UiStack.Top==page,"changed layer rejects stale page events before next frame");
            Clear();page=Fixture(false);expired=Pick(page,0).onClick;
            game.State.trackPos=game.Map.Nodes.First(item=>item.layerIdx==game.State.layerIdx&&item.idx!=game.State.trackPos).idx;
            expired.Invoke();Check(Selected(page).Count==0,"changed node rejects stale UID event");

            page=Fixture(false);Submit(Pick(page,0));Submit(Pick(page,1));Submit(Pick(page,2));
            var bagStalePick=Pick(page,0).onClick;var bagStaleConfirm=Button(page,"sacrificeConfirm").onClick;
            BagScreen.Open();var bag=UiStack.Top as BagScreen;
            Check(bag!=null,"formal backpack covers the current sacrifice picker");
            var bagRun=game.State;var bagMap=game.Map;var bagSlot=game.ActiveSlot;var bagSeed=game.State.seed;
            int bagLayer=game.State.layerIdx,bagPosition=game.State.trackPos;
            string bagDisk=File.ReadAllText(SaveSystem.ProfilePath),bagRng=game.Rng.SaveState(),bagCards=SaveJson.Stringify(game.State.ownedCards);
            bool discarded;
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))
                discarded=BagCardDetail.DiscardOwnedCard(game.State.ownedCards.Single(entry=>entry.uid=="offer-0").card.name,false,"offer-0");
            Check(!discarded&&!game.Saves.LastWriteSucceeded&&!string.IsNullOrEmpty(game.Saves.LastError)&&!game.Saves.InTransaction
                &&game.State==bagRun&&game.ActiveSlot==bagSlot&&game.State.seed==bagSeed&&game.State.layerIdx==bagLayer&&game.State.trackPos==bagPosition
                &&!ReferenceEquals(game.Map,bagMap)&&game.State.Phase=="modal"&&SaveJson.Stringify(game.State.ownedCards)==bagCards
                &&File.ReadAllText(SaveSystem.ProfilePath)==bagDisk&&game.Rng.SaveState()==bagRng,
                "real bag discard I/O failure preserves run and cards but replaces the derived Map");
            bag.CloseBag();
            Check(UiStack.Count==0&&game.State.Phase=="idle"&&game.Map.Nodes.Any(node=>node.id!=game.CurrentNodeId&&game.CanMoveToNode(node.id,out _)),
                "same-frame bag return expires the old Map owner and restores an operable idle map");
            bagStalePick.Invoke();bagStaleConfirm.Invoke();
            Check(UiStack.Count==0&&game.State.Phase=="idle"&&!game.State.altarActivated&&SaveJson.Stringify(game.State.ownedCards)==bagCards
                &&File.ReadAllText(SaveSystem.ProfilePath)==bagDisk&&game.Rng.SaveState()==bagRng,
                "expired pre-bag pick and confirm cannot revive the old page or sacrifice cards");

            page=Fixture(false);yield return null;yield return null;Submit(Pick(page,0));Submit(Pick(page,1));Submit(Pick(page,2));
            first=Pick(page,1);face=first.transform.Find("card-tt3-fireball");scroll=first.GetComponentInParent<ScrollRect>();content=scroll.content;
            string disk=File.ReadAllText(SaveSystem.ProfilePath),rng=game.Rng.SaveState();var failed=Button(page,"sacrificeConfirm").onClick;
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))Submit(Button(page,"sacrificeConfirm"));
            Check(UiStack.Top==page&&!game.State.altarActivated&&game.State.ownedCards.Count==9&&Selected(page).Count==3
                &&File.ReadAllText(SaveSystem.ProfilePath)==disk&&game.Rng.SaveState()==rng&&!game.Saves.InTransaction,"I/O failure preserves exact cards, selection, disk and RNG");
            Check(Pick(page,1)==first&&first.transform.Find("card-tt3-fireball")==face&&scroll.content==content
                &&page.GetComponentsInChildren<Text>().Any(text=>text.name=="sacrificeError"&&text.text.Contains("保存失败")),"rollback rebind retains controls and exposes retry receipt");
            failed.Invoke();Check(!game.State.altarActivated,"failed render confirmation cannot replay after rollback rebind");
            Submit(Button(page,"sacrificeConfirm"));
            Check(game.State.altarActivated&&game.CurrentNodeReceipt.altarRewardPending&&UiStack.Top is AltarRitualScreen
                &&new[]{"offer-0","offer-1","offer-2"}.All(uid=>!game.State.ownedCards.Any(entry=>entry.uid==uid)),"current retry consumes exact three UIDs and returns to altar reward entry");

            page=Fixture(true);Submit(Pick(page,0));Submit(Pick(page,1));Submit(Pick(page,2));
            var closed=Button(page,"sacrificeConfirm").onClick;Submit(Button(page,"sacrificeConfirm"));
            Check(game.CurrentExtraction!=null&&(UiStack.Top is ExtractStashScreen||UiStack.Top is ExtractDoneScreen),"emergency success uses production extraction route");
            returned=UiStack.Top;disk=File.ReadAllText(SaveSystem.ProfilePath);closed.Invoke();
            Check(UiStack.Top==returned&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"old emergency confirm cannot repeat extraction");
        }
        finally{Clear();}
        yield return null;
    }
}
