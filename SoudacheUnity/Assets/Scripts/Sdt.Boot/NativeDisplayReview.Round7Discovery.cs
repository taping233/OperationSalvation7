// Opt-in normal current-window review; state setup is controlled, UI clicks use actual raycasts.
using System;
using System.Collections;
using System.Linq;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        IEnumerator ReviewRound7Discovery()
        {
            yield return Round6DiscoverFixture(false);if(_failed)yield break;
            yield return Capture("player-r7-discovery-candidates",false);if(_failed)yield break;
            var page=UiStack.Top;Button pick=null,confirm=null;string rng=GameRuntime.I.Rng.SaveState();
            yield return new WaitForSecondsRealtime(.4f);
            yield return Round6WaitForButton("discoverPick-1");if(_failed)yield break;
            if(!Guard(()=>
            {
                pick=page.GetComponentsInChildren<Button>().Single(button=>button.name=="discoverPick-1");
                confirm=page.GetComponentsInChildren<Button>().Single(button=>button.name=="discoverConfirm");
                ClickButton(pick);
                for(int i=0;i<4;i++)BattleEvents.Raise(BattleViewApi.Session.Snapshot);
            }))yield break;
            yield return Capture("player-r7-discovery-selected",false);if(_failed)yield break;
            if(!Guard(()=>
            {
                if(UiStack.Top!=page||page.GetComponentsInChildren<Button>().Single(button=>button.name==pick.name)!=pick
                    ||page.GetComponentsInChildren<Button>().Single(button=>button.name==confirm.name)!=confirm||!confirm.IsInteractable()
                    ||BattleViewApi.Session.Snapshot.Energy!=99||GameRuntime.I.Rng.SaveState()!=rng)
                    throw new InvalidOperationException("Actual selection/unrelated snapshots did not retain controls without another sample/payment.");
                _records.Add(new{kind="actual-r7-retained-discovery",pick=pick.name,pickEntity=pick.GetInstanceID().ToString(),
                    confirmEntity=confirm.GetInstanceID().ToString(),unrelatedSnapshots=4,energy=99,randomUnchanged=true,osHardwareInput=false});
                ClickButton(confirm);
            }))yield break;
            float deadline=Time.realtimeSinceStartup+8;
            while(UiStack.Top is DiscoverPanel&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                if(!(UiStack.Top is BattleScreen)||BattleViewApi.Session.Snapshot.Discovering!=null
                    ||!BattleViewApi.Session.Snapshot.Hand.Contains("display-discover-2"))
                    throw new InvalidOperationException("Retained actual confirmation did not acquire the chosen original bottom UID.");
            }))yield break;
            yield return Capture("player-r7-discovery-return",false);
            if(_failed)yield break;
            yield return Round6DiscoverFixture(true,true);if(_failed)yield break;
            if(!Guard(()=>
            {
                if(BattleViewApi.Session.Snapshot.Discovering.Options.Count!=6)throw new InvalidOperationException("Three actual dark forms did not expose six choices.");
                _records.Add(new{kind="controlled-r7-expanded-discovery",source="cmtn125e1nk0",modifier="cmtn1r10xnl1",plays=3,
                    options=6,energy=97,input="formal PlayCard commands; no OS input"});
            }))yield break;
            yield return Capture("player-r7-discovery-expanded",false);if(_failed)yield break;
            if(!Guard(()=>
            {
                var scroll=UiStack.Top.GetComponentsInChildren<ScrollRect>().Single(item=>item.transform.parent.name=="ovBody");
                scroll.verticalNormalizedPosition=0;
            }))yield break;
            yield return new WaitForSecondsRealtime(.4f);
            yield return Round6WaitForButton("discoverPick-5");if(_failed)yield break;
            if(!Guard(()=>ClickNamed("discoverPick-5")))yield break;
            yield return Capture("player-r7-discovery-sixth-selected",false);if(_failed)yield break;
            if(!Guard(()=>ClickNamed("discoverCancel")))yield break;
            deadline=Time.realtimeSinceStartup+8;
            while(UiStack.Top is DiscoverPanel&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                if(!(UiStack.Top is BattleScreen)||BattleViewApi.Session.Snapshot.Energy!=97
                    ||!BattleViewApi.Session.Snapshot.Hand.Contains("display-discover-0"))
                    throw new InvalidOperationException("Expanded preview cancellation did not preserve its unpaid source and energy.");
            }))yield break;
        }
    }
}
