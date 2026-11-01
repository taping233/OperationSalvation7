// Opt-in background review only: current-window controls and isolated presentation fixtures, never OS input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.UI.Screens.Battle;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using OwnedCard = Sdt.Core.OwnedCard;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        IEnumerator ReviewRound6Audio()
        {
            var audio=AudioService.I;string scene=audio.MusicScene;
            bool muted=audio.Muted,musicMuted=audio.MusicMuted;
            var catalog=(IDictionary<string,string>)Sdt.Res.CurrentAssets.Music;
            string board=catalog["board"];
            try
            {
                string oldAsset=null;
                if(!Guard(()=>ClickNamed("settings-tab-2")))yield break;
                float deadline=Time.realtimeSinceStartup+3;
                while(!Round6AudioReady()&&Time.realtimeSinceStartup<deadline)yield return null;
                if(!Guard(()=>
                {
                    if(!Round6AudioReady())throw new TimeoutException("Audio category did not finish its transition.");
                    audio.Mute(false);audio.SetMusicMuted(false);audio.PlayBgm("title");
                    oldAsset=audio.MusicAsset;
                    if(string.IsNullOrEmpty(oldAsset)||audio.MusicLoadFailed)throw new InvalidOperationException("Real title music did not load before failure fixture.");
                    catalog["board"]="__round6_missing_music_20261101__";audio.PlayBgm("board");
                    if(!audio.MusicLoadFailed||audio.MusicAsset!=oldAsset)throw new InvalidOperationException("Failed request did not retain the previous valid track.");
                }))yield break;
                yield return Capture("player-music-load-failed",false);
                if(!Guard(()=>
                {
                    ClickNamed("setMusicRetry");
                    if(!audio.MusicLoadFailed||audio.MusicAsset!=oldAsset)throw new InvalidOperationException("Failed manual retry lost the previous track.");
                }))yield break;
                yield return Capture("player-music-retry-kept",false);
                if(!Guard(()=>
                {
                    catalog["board"]=board;ClickNamed("setMusicRetry");
                    if(audio.MusicLoadFailed||string.IsNullOrEmpty(audio.MusicAsset))throw new InvalidOperationException("Restored real board track did not load.");
                    if(UiStack.Top.GetComponentsInChildren<Button>().Any(button=>button.name=="setMusicRetry"&&button.gameObject.activeInHierarchy))
                        throw new InvalidOperationException("Recovered music retry control remained visible.");
                    _records.Add(new{kind="actual-player-music-retry",previous=oldAsset,current=audio.MusicAsset,mode=audio.MusicScene,
                        fixture="Only the in-memory board resource path was unavailable; no disk assets changed.",osHardwareInput=false});
                }))yield break;
                yield return Capture("player-music-recovered",false);
            }
            finally
            {
                catalog["board"]=board;audio.PlayBgm(scene);audio.SetMusicMuted(musicMuted);audio.Mute(muted);
            }
        }
        static bool Round6AudioReady()
        {
            var control=UiStack.Top?.GetComponentsInChildren<RectTransform>().FirstOrDefault(item=>item.name=="setMusicVol");
            return control!=null&&control.GetComponentsInParent<CanvasGroup>().All(group=>group.interactable&&group.alpha>=.999f);
        }
        IEnumerator Round6WaitForButton(string name)
        {
            yield return new WaitForEndOfFrame();yield return null;
            float deadline=Time.realtimeSinceStartup+3;
            while(Time.realtimeSinceStartup<deadline)
            {
                Canvas.ForceUpdateCanvases();
                var button=UiStack.Top?.GetComponentsInChildren<Button>().FirstOrDefault(item=>item.name==name&&item.isActiveAndEnabled&&item.IsInteractable());
                if(button!=null)
                {
                    var rect=(RectTransform)button.transform;
                    var point=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,rect.TransformPoint(rect.rect.center));
                    var hits=new List<RaycastResult>();
                    EventSystem.current.RaycastAll(new PointerEventData(EventSystem.current){position=point},hits);
                    if(hits.Count>0&&ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject)==button.gameObject)yield break;
                }
                yield return null;
            }
            Guard(()=>throw new TimeoutException("Standalone control did not become clickable: "+name));
        }
        IEnumerator ReviewRound6Sacrifice()
        {
            if(!Guard(()=>
            {
                NewPresentationFixture();var game=GameRuntime.I;
                var node=game.Map.Nodes.First(item=>item.type=="emergencyExit"&&item.layerIdx==2);
                game.State.layerIdx=node.layerIdx;game.State.trackPos=node.idx;game.State.Phase="modal";
                game.State.ownedCards.Clear();game.State.inventory.Clear();
                for(int i=0;i<9;i++)
                {
                    var card=CardLibrary.FindById("tt3-fireball").Clone();card.cost=i%3;card.variantKey="display-sacrifice-"+i;
                    game.State.ownedCards.Add(new OwnedCard{uid="display-sacrifice-"+i,card=card,safe=i==6?true:null,stored=i>=7,pouchOf=i==8?CardContainerCommands.PouchId:null});
                }
                game.SaveCurrent();if(!game.Saves.LastWriteSucceeded)throw new InvalidOperationException("Sacrifice presentation fixture did not persist.");
                if(game.Saves.ReadSlot(5)==null||game.Saves.HasSlotReadError(5))throw new InvalidOperationException("Sacrifice fixture did not satisfy the formal run-save schema.");
                EmergencyModal.Open();
                _records.Add(new{kind="controlled-sacrifice-variant-fixture",ordinary=6,excluded=3,sameCardId="tt3-fireball",costs=new[]{0,1,2},osHardwareInput=false});
            }))yield break;
            yield return null;yield return null;
            yield return Capture("player-emergency-entry",false);
            if(!Guard(()=>
            {
                var open=UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.GetComponentInChildren<Text>()?.text=="选择献祭卡牌");
                var image=open.GetComponent<Image>();
                _records.Add(new{kind="emergency-control-state",stack=UiStack.Names(),bounds=Bounds((RectTransform)open.transform),
                    graphic=image==null?null:new{image.raycastTarget,image.depth,image.canvasRenderer.cull,image.canvasRenderer.cullTransparentMesh,alpha=image.color.a},
                    groups=open.GetComponentsInParent<CanvasGroup>().Select(group=>new{group.name,group.alpha,group.interactable,group.blocksRaycasts}).ToArray(),
                    masks=open.GetComponentsInParent<RectMask2D>().Select(mask=>new{mask.name,bounds=Bounds(mask.rectTransform)}).ToArray()});
                ClickButton(open);
            }))yield break;
            yield return Capture("player-sacrifice-candidates",false);
            Button first=null;
            if(!Guard(()=>
            {
                var picks=UiStack.Top.GetComponentsInChildren<Button>().Where(button=>button.name.StartsWith("sacrificePick-",StringComparison.Ordinal)).ToArray();
                if(picks.Length!=6)throw new InvalidOperationException("Sacrifice candidates did not exclude protected/container cards.");
                first=picks.Single(button=>button.name=="sacrificePick-display-sacrifice-0");
                ClickNamed("sacrificePick-display-sacrifice-0");ClickNamed("sacrificePick-display-sacrifice-1");ClickNamed("sacrificePick-display-sacrifice-2");
                if(UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.name==first.name)!=first)
                    throw new InvalidOperationException("Selecting sacrifice rebuilt the retained card control.");
            }))yield break;
            yield return Capture("player-sacrifice-selected",false);
            if(!Guard(()=>{ClickNamed("sacrificeCancel");if(!(UiStack.Top is EmergencyModal))throw new InvalidOperationException("Sacrifice cancel did not return to the emergency entrance.");}))yield break;
            yield return Capture("player-sacrifice-returned",false);
            if(!Guard(()=>
            {
                ClickButton(UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.GetComponentInChildren<Text>()?.text=="选择献祭卡牌"));
            }))yield break;
            yield return Round6WaitForButton("sacrificePick-display-sacrifice-0");if(_failed)yield break;
            if(!Guard(()=>
            {
                ClickNamed("sacrificePick-display-sacrifice-0");ClickNamed("sacrificePick-display-sacrifice-1");ClickNamed("sacrificePick-display-sacrifice-2");
                ClickNamed("sacrificeConfirm");
                var game=GameRuntime.I;
                if(!(UiStack.Top is ExtractStashScreen)||game.State.ownedCards.Any(card=>card.uid=="display-sacrifice-0"||card.uid=="display-sacrifice-1"||card.uid=="display-sacrifice-2"))
                    throw new InvalidOperationException("Emergency sacrifice did not consume the exact three UIDs and enter extraction.");
                _records.Add(new{kind="actual-player-emergency-sacrifice",consumed=new[]{"display-sacrifice-0","display-sacrifice-1","display-sacrifice-2"},destination="ExtractStashScreen",osHardwareInput=false});
            }))yield break;
            yield return Capture("player-sacrifice-extraction",false);
            if(!Guard(NewPresentationFixture))yield break;
        }
        static T Round6BattleField<T>(BattleSession session,string name)=>(T)typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(session);
        static void Round6BattleField(BattleSession session,string name,object value)=>typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).SetValue(session,value);
        IEnumerator Round6DiscoverFixture(bool preview)
        {
            if(!Guard(()=>
            {
                NewPresentationFixture();var game=GameRuntime.I;game.State.entrySupply=null;
                game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
                game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
                var ids=new[]{preview?"cmtn125e1nk0":"tt3-dig-treasure","tt3-fireball","tt3-blooddrinker","tt3-magic-lamp","starter-attack"};
                for(int i=0;i<ids.Length;i++)game.State.ownedCards.Add(new OwnedCard{uid="display-discover-"+i,card=CardLibrary.FindById(ids[i]).Clone()});
                game.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name=preview?"支付前发现呈现复核":"底牌发现呈现复核",Foes=new List<EnemyStats>{new EnemyStats{id="display-discover-foe",name="受控敌人",hp=10000,atk=0}}}});
            }))yield break;
            float deadline=Time.realtimeSinceStartup+12;
            while((!(UiStack.Top is BattleScreen)||CurrentRunFilm.Active)&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                if(!(UiStack.Top is BattleScreen)||CurrentRunFilm.Active)throw new TimeoutException("Bottom discovery battle did not open.");
                var session=BattleViewApi.Session;
                Round6BattleField(session,"hand",new List<string>{"display-discover-0"});
                Round6BattleField(session,"drawPile",new List<string>{"display-discover-1","display-discover-2","display-discover-3","display-discover-4"});
                Round6BattleField(session,"energy",100);
                var result=session.PlayCard("display-discover-0",-1,false);
                if(!result.Ok)throw new InvalidOperationException("Real dig card did not execute: "+result.Reason);
                if(session.Snapshot.Energy!=(preview?100:99))throw new InvalidOperationException("Discovery did not respect its before/after-payment boundary.");
            }))yield break;
            deadline=Time.realtimeSinceStartup+12;
            while(!(UiStack.Top is DiscoverPanel)&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                var state=BattleViewApi.Session.Snapshot.Discovering;
                if(!(UiStack.Top is DiscoverPanel)||state==null||(preview?state.sourceCommit!="preview":state.kind!="deckBottom"))
                    throw new TimeoutException("Real discovery did not mount with its correct payment/source state.");
            }))yield break;
        }
        IEnumerator ReviewRound6Discovery()
        {
            yield return Round6DiscoverFixture(false);if(_failed)yield break;
            yield return Capture("player-discover-bottom",false);
            yield return new WaitForSecondsRealtime(.4f);
            if(!Guard(()=>ClickNamed("discoverPick-0")))yield break;
            yield return Capture("player-discover-selected",false);
            if(!Guard(()=>ClickNamed("discoverConfirm")))yield break;
            float deadline=Time.realtimeSinceStartup+8;
            while(UiStack.Top is DiscoverPanel&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                var session=BattleViewApi.Session;
                var deck=Round6BattleField<List<string>>(session,"drawPile");
                if(!(UiStack.Top is BattleScreen)||session.Snapshot.Discovering!=null||!Round6BattleField<List<string>>(session,"hand").Contains("display-discover-1")
                    ||!deck.SequenceEqual(new[]{"display-discover-2","display-discover-3","display-discover-4"}))
                    throw new InvalidOperationException("Bottom confirmation did not keep the selected original UID and return the remainder in order.");
                _records.Add(new{kind="actual-player-bottom-confirm",selected="display-discover-1",returned=new[]{"display-discover-2","display-discover-3"},osHardwareInput=false});
            }))yield break;
            yield return Capture("player-discover-confirm-return",false);
            yield return Round6DiscoverFixture(false);if(_failed)yield break;
            int energy=Round6BattleField<int>(BattleViewApi.Session,"energy");
            yield return Round6WaitForButton("discoverCancel");if(_failed)yield break;
            if(!Guard(()=>ClickNamed("discoverCancel")))yield break;
            deadline=Time.realtimeSinceStartup+8;
            while(UiStack.Top is DiscoverPanel&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                var session=BattleViewApi.Session;
                if(!(UiStack.Top is BattleScreen)||session.Snapshot.Discovering!=null||Round6BattleField<int>(session,"energy")!=energy
                    ||!Round6BattleField<List<string>>(session,"drawPile").SequenceEqual(new[]{"display-discover-1","display-discover-2","display-discover-3","display-discover-4"}))
                    throw new InvalidOperationException("Committed bottom cancellation did not restore the original UIDs without changing paid energy.");
                _records.Add(new{kind="actual-player-bottom-cancel",returned=new[]{"display-discover-1","display-discover-2","display-discover-3"},committedCostPreserved=true,osHardwareInput=false});
            }))yield break;
            yield return Capture("player-discover-cancel-return",false);
            yield return ReviewRound6DiscoveryPreview();
            if(!_failed)yield return ReviewRound6Grave();
        }
        IEnumerator ReviewRound6Grave()
        {
            if(!Guard(()=>
            {
                NewPresentationFixture();var game=GameRuntime.I;game.State.entrySupply=null;
                game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
                game.State.hp=game.State.maxHp=1000;game.State.atk=game.State.spellPower=0;game.State.Phase="idle";
                for(int i=0;i<3;i++)game.State.ownedCards.Add(new OwnedCard{uid="display-grave-"+i,card=CardLibrary.FindById("tt3-fireball").Clone()});
                game.Bus.Emit(new BattleRequested{Request=new BattleRequest{IsBoss=true,Name="墓地呈现复核",Foes=new List<EnemyStats>{new EnemyStats{id="display-grave-foe",name="受控首脑",hp=10000,atk=0}}}});
            }))yield break;
            float deadline=Time.realtimeSinceStartup+12;
            while((!(UiStack.Top is DeckSelectionPanel)||CurrentRunFilm.Active)&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                if(!(UiStack.Top is DeckSelectionPanel)||CurrentRunFilm.Active)throw new TimeoutException("Grave fixture boss selection did not mount.");
                var selection=BattleViewApi.Session.Snapshot.DeckSelection;
                foreach(var card in selection.Cards.Take(selection.Need))if(!selection.Selected.Contains(card.uid))BattleView.Commands.SelectDeckCard(card.uid);
                BattleView.Commands.ConfirmDeck();
            }))yield break;
            deadline=Time.realtimeSinceStartup+12;
            while((!(UiStack.Top is BattleScreen)||CurrentRunFilm.Active)&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                if(!(UiStack.Top is BattleScreen)||CurrentRunFilm.Active)throw new TimeoutException("Grave fixture boss battle did not mount.");
                var session=BattleViewApi.Session;var grave=new List<string>{"display-grave-0","display-grave-1"};
                foreach(string pile in new[]{"hand","drawPile","discard"})Round6BattleField<List<string>>(session,pile).RemoveAll(grave.Contains);
                Round6BattleField<List<string>>(session,"consumed").AddRange(grave);Round6BattleField(session,"grave",grave);
                BattleView.Commands.OpenGrave();
                _records.Add(new{kind="controlled-player-grave-fixture",mode="boss",uids=grave,entry="production OpenGrave command",osHardwareInput=false});
            }))yield break;
            yield return Capture("player-grave",false);
            if(!Guard(()=>
            {
                if(!(UiStack.Top is GravePanel))throw new InvalidOperationException("Actual grave page did not mount.");
                ClickButton(UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.transform.parent.name=="ov-btns"));
                if(!(UiStack.Top is BattleScreen)||BattleViewApi.Session.Snapshot.ViewingGrave)throw new InvalidOperationException("Actual grave return did not restore battle.");
            }))yield break;
            yield return Capture("player-grave-return",false);
        }
        IEnumerator ReviewRound6DiscoveryPreview()
        {
            yield return Round6DiscoverFixture(true);if(_failed)yield break;
            var session=BattleViewApi.Session;
            var options=session.Snapshot.Discovering.options.Select(card=>card.id+":"+card.cost+":"+card.variantKey).ToArray();
            string rng=GameRuntime.I.Rng.SaveState();
            if(!Guard(()=>
            {
                if(session.Snapshot.Energy!=100||!Round6BattleField<List<string>>(session,"hand").Contains("display-discover-0"))
                    throw new InvalidOperationException("Real mysterious summon preview paid before confirmation.");
            }))yield break;
            yield return Capture("player-discover-preview",false);
            if(!Guard(()=>ClickNamed("discoverCancel")))yield break;
            float deadline=Time.realtimeSinceStartup+8;
            while(UiStack.Top is DiscoverPanel&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                if(!(UiStack.Top is BattleScreen)||session.Snapshot.Energy!=100||!Round6BattleField<List<string>>(session,"hand").Contains("display-discover-0")||GameRuntime.I.Rng.SaveState()!=rng)
                    throw new InvalidOperationException("First preview cancellation consumed the source, energy, or another random sample.");
            }))yield break;
            yield return Capture("player-discover-preview-cancel",false);
            if(!Guard(()=>
            {
                var result=session.PlayCard("display-discover-0",-1,false);
                if(!result.Ok)throw new InvalidOperationException("Same-turn preview did not reopen: "+result.Reason);
            }))yield break;
            deadline=Time.realtimeSinceStartup+8;
            while(!(UiStack.Top is DiscoverPanel)&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                var state=session.Snapshot.Discovering;
                if(!(UiStack.Top is DiscoverPanel)||state?.sourceCommit!="preview"||GameRuntime.I.Rng.SaveState()!=rng
                    ||!state.options.Select(card=>card.id+":"+card.cost+":"+card.variantKey).SequenceEqual(options))
                    throw new InvalidOperationException("Same-turn preview did not reuse the original ordered candidates.");
            }))yield break;
            yield return new WaitForSecondsRealtime(.4f);
            yield return Round6WaitForButton("discoverPick-0");if(_failed)yield break;
            var chosen=session.Snapshot.Discovering.Options[0].Clone();
            if(!Guard(()=>ClickNamed("discoverPick-0")))yield break;
            yield return Round6WaitForButton("discoverConfirm");if(_failed)yield break;
            if(!Guard(()=>ClickNamed("discoverConfirm")))yield break;
            deadline=Time.realtimeSinceStartup+8;
            while(UiStack.Top is DiscoverPanel&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>
            {
                var awarded=session.GrantedCards.Where(card=>card.card.id==chosen.id&&card.card.cost==chosen.cost&&card.card.variantKey==chosen.variantKey).ToArray();
                var hand=Round6BattleField<List<string>>(session,"hand");
                _records.Add(new{kind="actual-player-preview-commit-state",selected=chosen.id,chosen.type,energy=session.Snapshot.Energy,
                    currentPage=UiStack.Top?.GetType().Name,granted=awarded.Select(card=>card.uid).ToArray(),hand=hand.ToArray()});
                if(!(UiStack.Top is BattleScreen)||session.Snapshot.Discovering!=null||session.Snapshot.Energy!=98
                    ||hand.Contains("display-discover-0")||awarded.Length!=1
                    ||hand.Contains(awarded[0].uid)!=(chosen.type!="道具"))
                    throw new InvalidOperationException("Real mysterious summon did not commit its two energy and source exactly once.");
                _records.Add(new{kind="actual-player-discovery-preview",source="cmtn125e1nk0",energyBefore=100,energyAfter=98,
                    selected=chosen.id,destination=chosen.type=="道具"?"granted item":"hand",cancelledBeforePayment=true,sameTurnCandidatesAndRngReused=true,osHardwareInput=false});
            }))yield break;
            yield return Capture("player-discover-preview-confirm",false);
        }
    }
}
