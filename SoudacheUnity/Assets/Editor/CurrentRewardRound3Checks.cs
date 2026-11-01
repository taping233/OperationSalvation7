// Explicit round3 checks; the central driver supplies Play mode and an isolated profile.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentRewardRound3Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value,string message)
        {Assertions++;if(!value)throw new InvalidOperationException("reward round3: "+message);}
        static Button Find(Panel panel,string name)=>panel.GetComponentsInChildren<Button>().Single(button=>button.name==name);
        static void Submit(Button button)
        {
            Check(button!=null&&button.IsActive()&&button.IsInteractable(),"available current EventSystem submit");
            Check(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"native submit dispatched");
        }
        static void Focus(Panel panel,string name)=>Check(EventSystem.current.currentSelectedGameObject==Find(panel,name).gameObject,"focus remains on "+name);
        static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
        static string State(GameRuntime game)=>SaveJson.Stringify(game.State);
        public static IEnumerator Run()
        {
            Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            Clear();var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");Clear();
            game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.battleActive=false;game.State.Phase="idle";
            var templates=CardLibrary.All().Where(card=>(card.type=="法术"||card.type=="武术")&&!BaseData.IsSha(card)&&card.id!=CardContainerCommands.PouchId&&card.id!=CardContainerCommands.PearlId).Take(12).ToArray();Check(templates.Length==12,"fixture has distinct stack cards");
            for(int row=0;row<templates.Length;row++)for(int copy=0;copy<2;copy++)game.State.ownedCards.Add(new OwnedCard{uid="r3-"+row+"-"+copy,card=templates[row].Clone()});
            game.SaveCurrent();Check(game.Saves.LastWriteSucceeded,"fixture saved");
            var owner=ScreenMount.Show<CurrentRewardRound3Owner>("reward-r3-owner");owner.Build();int claimed=0;
            var item=new CurrentRewardItem{Card=CardLibrary.FindById("tt3-fireball").Clone(),Claim=()=>claimed++};
            CurrentRewardCapacityOrganizer.Open(item,owner);yield return null;Canvas.ForceUpdateCanvases();
            var page=(CurrentRewardCapacityOrganizer)UiStack.Top;var root=page.transform.Find("reward-capacity-organizer");
            var scroll=page.GetComponentInChildren<ScrollRect>();var rowOne=Find(page,"organizer-discard-r3-1-0").transform.parent;
            var sameSafe=Find(page,"organizer-safe-r3-1-0");var staleSafe=sameSafe.onClick;var sameReturn=Find(page,"organizer-return");
            Check(scroll.content.rect.height>scroll.viewport.rect.height,"organizer scroll fixture overflows");scroll.verticalNormalizedPosition=.37f;float position=scroll.verticalNormalizedPosition;
            Submit(Find(page,"organizer-discard-r3-0-0"));Focus(page,"organizer-keep");var sameConfirm=Find(page,"organizer-confirm-r3-0-0");var staleConfirm=sameConfirm.onClick;
            Submit(Find(page,"organizer-keep"));Focus(page,"organizer-discard-r3-0-0");
            string before=State(game),rng=game.Rng.SaveState();var focused=EventSystem.current.currentSelectedGameObject;
            staleConfirm.Invoke();staleSafe.Invoke(); // Deliberate saved UnityEvents, distinct from player submits above.
            Check(State(game)==before&&game.Rng.SaveState()==rng&&claimed==0,"old confirm after keep and old safe cannot mutate");
            Check(EventSystem.current.currentSelectedGameObject==focused,"old callbacks cannot steal focus");
            Check(page.transform.Find("reward-capacity-organizer")==root&&Find(page,"organizer-return")==sameReturn,"retained organizer root and footer");
            Check(Find(page,"organizer-safe-r3-1-0")==sameSafe&&sameSafe.transform.parent==rowOne,"unaffected row and button retained");
            Check(page.GetComponentInChildren<ScrollRect>()==scroll,"scroll owner retained");Canvas.ForceUpdateCanvases();Check(Mathf.Abs(scroll.verticalNormalizedPosition-position)<.01f,"decision toggles preserve scroll");
            Submit(Find(page,"organizer-discard-r3-0-0"));Check(Find(page,"organizer-confirm-r3-0-0")==sameConfirm,"confirmation control retained on reopening");
            before=State(game);staleConfirm.Invoke();Check(State(game)==before,"old confirm rejected even when same button is active again");
            Submit(sameConfirm);Check(game.State.ownedCards.Count==23&&!game.State.ownedCards.Any(card=>card.uid=="r3-0-0"),"current confirmation discards exactly one selected UID");Focus(page,"organizer-discard-r3-0-1");
            Check(Find(page,"organizer-safe-r3-1-0")==sameSafe,"unrelated row retained after inventory mutation");
            Submit(sameSafe);Check(game.State.ownedCards.Count(card=>card.safe==true&&card.uid.StartsWith("r3-1-"))==2&&claimed==0,"current safe move retains both UIDs without granting reward");
            Check(page.GetComponentsInChildren<Button>().All(button=>button.name!="organizer-safe-r3-1-0"),"moved stack removed from organizer");
            Submit(Find(page,"organizer-discard-r3-2-0"));before=State(game);rng=game.Rng.SaveState();
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))Submit(Find(page,"organizer-confirm-r3-2-0"));
            Check(!game.Saves.LastWriteSucceeded&&State(game)==before&&game.Rng.SaveState()==rng,"failed save rolls back discard and RNG");Focus(page,"organizer-confirm-r3-2-0");
            Check(!string.IsNullOrEmpty(page.GetComponentsInChildren<Text>().Single(text=>text.name=="organizer-receipt").text),"failed action keeps local receipt");
            var closed=Find(page,"organizer-confirm-r3-2-0").onClick;UiStack.Close(page);before=State(game);closed.Invoke();Check(State(game)==before&&claimed==0,"same-frame closed callback inert");
            CurrentRewardCapacityOrganizer.Open(item,owner);var replacement=(CurrentRewardCapacityOrganizer)UiStack.Top;closed.Invoke();Check(State(game)==before&&UiStack.Top==replacement,"closed callback cannot target replacement");
            var removedOwner=Find(replacement,"organizer-discard-r3-2-0").onClick;UiStack.Close(owner);removedOwner.Invoke();Check(State(game)==before&&claimed==0,"removed reward owner invalidates live organizer callback");Clear();

            game.State.entrySupply=null;game.SaveCurrent();Check(game.Saves.LastWriteSucceeded&&game.EntrySupplyComplete,"neutral tile fixture has no pending entry supply");Clear();
            owner=ScreenMount.Show<CurrentRewardRound3Owner>("reward-r3-scene-owner");owner.Build();var scene=CurrentRewardScene.Create(owner.transform);
            CurrentRewardItem a=new CurrentRewardItem{Key="r3-a",Index=0,Card=templates[0],Claim=()=>claimed++},b=new CurrentRewardItem{Key="r3-b",Index=1,Card=templates[1]},bonus=new CurrentRewardItem{Key="r3-bonus",Index=2,Card=templates[2],Bonus=true};
            var items=new[]{a,b,bonus};scene.Sync(items);yield return null;Canvas.ForceUpdateCanvases();
            var tile=scene.GetComponentsInChildren<CurrentRewardTile>().Single(value=>value.Key==a.Key);var art=tile.ArtRect.GetChild(0);var sceneScroll=scene.GetComponentInChildren<ScrollRect>();
            var tileClaim=tile.GetComponentsInChildren<Button>().Single(button=>button.name=="收下");var oldTileClaim=tileClaim.onClick;
            var tileRead=tile.ArtRect.GetComponent<Button>();var oldTileRead=tileRead.onClick;
            var revisionField=typeof(CurrentRewardTile).GetField("_revision",BindingFlags.Instance|BindingFlags.NonPublic);int oldRevision=(int)revisionField.GetValue(tile);
            string Context()=>"claimed="+claimed+", top="+(UiStack.Top==null?"none":UiStack.Top.GetType().Name+"/"+UiStack.Top.name+"#"+UiStack.Top.GetInstanceID())+", owner="+(owner==null?"destroyed":owner.name+"#"+owner.GetInstanceID())+", tileRevision="+revisionField.GetValue(tile)+", oldRevision="+oldRevision;
            Check(claimed==0&&UiStack.Top==owner,"tile fixture current before rebinding: "+Context());
            scene.Sync(items);
            Check((int)revisionField.GetValue(tile)>oldRevision&&!ReferenceEquals(tileClaim.onClick,oldTileClaim)&&!ReferenceEquals(tileRead.onClick,oldTileRead),"tile rebinding replaces events and expires old version: "+Context());
            yield return new WaitForSecondsRealtime(.2f);
            Check(claimed==0&&UiStack.Top==owner,"tile fixture remains current before old callbacks: "+Context());
            oldTileClaim.Invoke(); // Deliberate old UnityEvent replay, distinct from the current player submit below.
            Check(claimed==0&&UiStack.Top==owner,"old rebound tile claim callback inert: "+Context());
            oldTileRead.Invoke();Check(claimed==0&&UiStack.Top==owner,"old rebound tile reader callback inert: "+Context());
            Submit(tileClaim);Check(claimed==1,"current retained tile claim still dispatches");
            a.State="received";scene.Sync(items);yield return null;Canvas.ForceUpdateCanvases();
            Check(scene.GetComponentsInChildren<CurrentRewardTile>().Single(value=>value.Key==a.Key)==tile&&tile.ArtRect.GetChild(0)==art,"claim state patch retains tile and card face");
            Check(scene.GetComponentInChildren<ScrollRect>()==sceneScroll,"reward patch retains scroll");
            var flow=scene.GetComponentInChildren<CurrentRewardFlow>();var rows=(IList)typeof(CurrentRewardFlow).GetField("_rows",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(flow);
            Check(rows.Count>=2,"ordinary and bonus layout use separate rows");var rowObjects=rows.Cast<object>().ToArray();
            for(int i=0;i<4;i++){flow.CalculateLayoutInputHorizontal();flow.CalculateLayoutInputVertical();flow.SetLayoutHorizontal();flow.SetLayoutVertical();}
            Check(rows.Count==rowObjects.Length&&rows.Cast<object>().SequenceEqual(rowObjects),"layout stages reuse row objects");
            Check(sceneScroll.content.rect.width>0&&flow.preferredHeight>0,"retained reward layout has finite positive extent");
            a.State="pending";scene.Sync(items);var removedTileClaim=tileClaim.onClick;scene.Sync(new[]{b,bonus});before=State(game);removedTileClaim.Invoke();
            Check(claimed==1&&State(game)==before&&UiStack.Top==owner,"removed pending tile callback cannot act on next reward");
            Clear();yield return null;
        }
    }
    public sealed class CurrentRewardRound3Owner:Panel
    {public override void Build(){} }
}
