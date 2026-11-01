// Opt-in normal-player review: controlled inventory, production bag UI and strict raycast controls.
using System;
using System.Collections;
using System.IO;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Bag;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        IEnumerator ReviewRound7Bag()
        {
            const string uid="display-round7-bag-source";BagItemDiscoveryScreen page=null;Button pick=null,confirm=null;Transform face=null;
            string cards=null,rng=null,chosen=null;string[] candidates=null;
            if(!Guard(()=>
            {
                NewPresentationFixture();var g=GameRuntime.I;g.State.entrySupply=null;g.State.ownedCards.Clear();g.State.inventory.Clear();g.State.usedPocket.Clear();g.State.Phase="idle";
                g.State.ownedCards.Add(new OwnedCard{uid=uid,card=CardLibrary.FindById("tt4-shine-token").Clone()});
                g.SaveCurrent();if(!g.Saves.LastWriteSucceeded)throw new InvalidOperationException("Round7 bag fixture did not save.");
                BagScreen.Open();if(UiStack.Top!=BagScreen.Current)throw new InvalidOperationException("Formal backpack did not open.");
                BagCardDetail.Show(g.State.ownedCards.Single().card.name,false,uid);
                _records.Add(new{kind="round7-bag-controlled-fixture",source="tt4-shine-token",uid,
                    entry="Production BagScreen.Open and UID-owned BagCardDetail.Show; subsequent buttons use actual raycast checks.",
                    inventory="Single real employee C token; candidates use the actual current legendary pool and persisted receipt.",osHardwareInput=false});
            }))yield break;
            yield return Round6WaitForButton("useDetailCard");if(_failed)yield break;
            if(!Guard(()=>ClickNamed("useDetailCard")))yield break;
            yield return Round6WaitForButton("bagDiscoverPick-0");if(_failed)yield break;
            if(!Guard(()=>
            {
                page=UiStack.Top as BagItemDiscoveryScreen;if(page==null)throw new InvalidOperationException("Real bag-use entrance did not mount discovery.");
                pick=page.GetComponentsInChildren<Button>().Single(b=>b.name=="bagDiscoverPick-0");
                confirm=page.GetComponentsInChildren<Button>().Single(b=>b.name=="bagDiscoverConfirm");face=pick.transform.Find("card-art");
                var source=GameRuntime.I.State.ownedCards.Single(o=>o.uid==uid);candidates=source.bagDiscover.cardIds.ToArray();chosen=candidates[0];
                cards=SaveJson.Stringify(GameRuntime.I.State.ownedCards);rng=GameRuntime.I.Rng.SaveState();
                if(confirm.IsInteractable()||face==null||candidates.Length!=3)throw new InvalidOperationException("Initial bag discovery view does not match its saved receipt.");
                var savedCandidates=new SaveSystem().ReadSlot(5)?.ownedCards.Single(o=>o.uid==uid).bagDiscover.cardIds;
                if(savedCandidates==null||!savedCandidates.SequenceEqual(candidates))throw new InvalidOperationException("Candidate receipt did not independently reload.");
                _records.Add(new{kind="round7-bag-real-candidates",sourceUid=uid,candidates,choice="none",candidatesFromPersistedReceipt=true});
            }))yield break;
            yield return Capture("player-bag-discovery-candidates",false);
            yield return Round6WaitForButton("bagDiscoverPick-0");if(_failed)yield break;
            if(!Guard(()=>
            {
                ClickButton(pick);
                if(UiStack.Top!=page||page.GetComponentsInChildren<Button>().Single(b=>b.name==pick.name)!=pick||pick.transform.Find("card-art")!=face
                    ||page.GetComponentsInChildren<Button>().Single(b=>b.name=="bagDiscoverConfirm")!=confirm||EventSystem.current.currentSelectedGameObject!=confirm.gameObject
                    ||SaveJson.Stringify(GameRuntime.I.State.ownedCards)!=cards||GameRuntime.I.Rng.SaveState()!=rng)
                    throw new InvalidOperationException("Bag selection rebuilt its controls, lost confirmation focus or mutated the reward.");
                _records.Add(new{kind="round7-bag-retained-selection",chosen,retainedPick=true,retainedFace=true,retainedConfirm=true,focus=confirm.name,osHardwareInput=false});
            }))yield break;
            yield return Capture("player-bag-discovery-selected",false);
            yield return Round6WaitForButton("bagDiscoverConfirm");if(_failed)yield break;
            string fault=SaveSystem.ProfilePath+".writing",keptFault=SaveSystem.ProfilePath+".round7-display-fault-"+System.Guid.NewGuid().ToString("N");bool ownsFault=false;
            try
            {
                if(!Guard(()=>
                {
                    if(File.Exists(fault)||Directory.Exists(fault))throw new InvalidOperationException("Round7 write-failure fixture path already occupied.");
                    Directory.CreateDirectory(fault);ownsFault=true;string disk=File.ReadAllText(SaveSystem.ProfilePath);ClickButton(confirm);
                    if(GameRuntime.I.Saves.LastWriteSucceeded||UiStack.Top!=page||!confirm.IsInteractable()||pick.transform.Find("card-art")!=face
                        ||SaveJson.Stringify(GameRuntime.I.State.ownedCards)!=cards||GameRuntime.I.Rng.SaveState()!=rng||File.ReadAllText(SaveSystem.ProfilePath)!=disk)
                        throw new InvalidOperationException("Bag claim I/O failure did not preserve source, candidates, selection controls, RNG and disk.");
                    _records.Add(new{kind="round7-bag-controlled-io-failure",fixture="Only isolated profile .writing path is a directory for this synchronous write.",
                        sourcePreserved=true,candidatesPreserved=true,retainedControls=true,canRetry=true,osHardwareInput=false});
                }))yield break;
            }
            finally{if(ownsFault&&Directory.Exists(fault))Directory.Move(fault,keptFault);}
            yield return Capture("player-bag-discovery-save-failed",false);
            yield return Round6WaitForButton("bagDiscoverConfirm");if(_failed)yield break;
            if(!Guard(()=>
            {
                ClickButton(confirm);var g=GameRuntime.I;
                if(UiStack.Top!=BagScreen.Current||g.State.ownedCards.Count!=1||g.State.ownedCards[0].uid==uid||g.State.ownedCards[0].card.id!=chosen)
                    throw new InvalidOperationException("Bag current retry did not grant exactly the saved choice and return to inventory.");
                var saved=new SaveSystem().ReadSlot(5);
                if(saved==null||saved.ownedCards.Count!=1||saved.ownedCards[0].card.id!=chosen||saved.ownedCards[0].uid==uid)
                    throw new InvalidOperationException("Bag retry result did not survive independent profile read.");
                _records.Add(new{kind="round7-bag-real-claim-return",chosen,sourceConsumedOnce=true,rewardCount=1,independentRead=true,osHardwareInput=false});
            }))yield break;
            yield return Capture("player-bag-discovery-returned",false);
            Guard(NewPresentationFixture);
        }
    }
}
