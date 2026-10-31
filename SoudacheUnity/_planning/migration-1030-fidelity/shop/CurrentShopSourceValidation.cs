// Root-only hidden Unity probe. Current source flow; actual wait frames and uGUI raycast/pointer.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentShopSourceValidation
    {
        const string Active="Sdt.CurrentShopSource.Active";
        static readonly List<object> Records=new List<object>();
        static IEnumerator _flow;static FileStream _locked;static double _start,_next;static string _step;
        static int _granted,_saved;static bool _lockAfterSave;
        static string Output=>Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static double Now=>EditorApplication.timeSinceStartup;
        static CurrentShopSourceValidation(){EditorApplication.update+=Tick;Application.logMessageReceived+=Observe;}
        public static void Run()
        {
            if(string.IsNullOrWhiteSpace(Output))throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT required");
            Directory.CreateDirectory(Output);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",Path.Combine(Output,"profile-shop-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            AssetDatabase.DisallowAutoRefresh();SessionState.SetBool(Active,true);EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");EditorApplication.EnterPlaymode();
        }
        static void Observe(string message,string stack,LogType type){if(SessionState.GetBool(Active,false)&&(type==LogType.Error||type==LogType.Exception))Finish(new InvalidOperationException(message+"\n"+stack));}
        static void Tick()
        {
            if(!SessionState.GetBool(Active,false))return;EditorApplication.QueuePlayerLoopUpdate();
            if(!EditorApplication.isPlaying||EditorApplication.isCompiling||App.Canvas==null||Now<_next)return;_next=Now+.035;if(_start==0)_start=Now;
            try{Require(Now-_start<120,"shop probe timeout: "+_step);if(_flow==null)_flow=Flow().GetEnumerator();if(!_flow.MoveNext())Finish(null);}catch(Exception error){Finish(error);}
        }
        static IEnumerable<object> Wait(double seconds){double end=Now+seconds;while(Now<end)yield return null;}
        static IEnumerable<object> Flow()
        {
            OffscreenCapture.PrepareReference();Require(Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(Output),StringComparison.OrdinalIgnoreCase),"profile escaped probe output");
            Require(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",false,out var settingsError),settingsError);
            _step="complete shelf layout";Fixture();var g=GameRuntime.I;g.Bus.On<CardGranted>(_=>_granted++);g.Bus.On<SaveCompleted>(_=>{_saved++;if(_lockAfterSave){_lockAfterSave=false;Lock();}});DefaultBoundaries();string uid=SafeSaleFixture();ShopScreen.Open();foreach(var item in Wait(.7))yield return item;
            Require(UiStack.Top is ShopScreen,"shop not presented");var view=UiStack.Top.GetComponentInChildren<CurrentShopView>();
            var tiles=view.GetComponentsInChildren<CurrentShopOffer>();Require(tiles.Length==9,"nine persistent offers missing");
            var offers=tiles.Select(tile=>Bounds((RectTransform)tile.transform)).ToArray();Require(offers[4].x>offers[0].x&&offers[5].y<offers[0].y,"current five-column/two-row shelf absent");
            Require(offers.All(box=>box.height>250&&box.yMin>70&&box.yMax<1010),"shelf cards clipped outside source page body");Shot("shop-current-market");
            _step="inspect before buy";int coins=g.State.coins,owned=g.State.ownedCards.Count;string card=g.CurrentNodeReceipt.shopStock[0].cardId;int price=g.CurrentNodeReceipt.shopStock[0].price;
            Click("shop-slot-0");foreach(var item in Wait(.4))yield return item;Require(view.DetailOpen&&g.State.coins==coins&&g.State.ownedCards.Count==owned,"inspection incorrectly trades");Shot("shop-current-inspection");
            Click("buyCard-0");foreach(var item in Wait(.7))yield return item;Require(g.State.coins==coins-price&&g.State.ownedCards.Count==owned+1&&g.CurrentNodeReceipt.shopStock[0].sold,"purchase did not update exactly once");
            Require(Find("buyCard-0")==null,"sold detail retained purchase action");Click("shopCloseInspect");foreach(var item in Wait(.3))yield return item;
            _step="unaffordable mystery remains inspectable and hidden";g.State.coins=0;g.SaveCurrent();UiStack.Top.CloseFromEscape();ShopScreen.Open();foreach(var item in Wait(.5))yield return item;
            view=UiStack.Top.GetComponentInChildren<CurrentShopView>();Click("shop-slot-8");foreach(var item in Wait(.4))yield return item;
            var detail=Find("shopCloseInspect").transform.parent;string mysteryId=g.CurrentNodeReceipt.shopStock[8].cardId;string mysteryName=CardLibrary.FindById(mysteryId).name;
            Require(!detail.GetComponentsInChildren<Transform>().Any(child=>child.name=="paper-card"),"unsold mystery creates real face");Require(!detail.GetComponentsInChildren<Text>().Any(text=>text.text.Contains(mysteryName)),"unsold mystery exposes its name");
            Require(Find("buyCard-8")?.interactable==false,"unaffordable mystery purchase enabled");Shot("shop-current-mystery-hidden");Click("shopCloseInspect");foreach(var item in Wait(.3))yield return item;
            _step="exchange and backpack browse return";var shelf=UiStack.Top.GetComponentsInChildren<ScrollRect>().First(scroll=>scroll.name=="shop-board-scroll");shelf.verticalNormalizedPosition=.42f;float shelfPosition=shelf.verticalNormalizedPosition;
            Click("openSell");foreach(var item in Wait(.4))yield return item;Require(view.ExchangeOpen,"exchange did not open");Click("shopSellRule");foreach(var item in Wait(.3))yield return item;
            Click("shopOpenBag");foreach(var item in Wait(.4))yield return item;Require(UiStack.Top.GetType().Name=="BagScreen","exchange bag did not open");UiStack.Top.CloseFromEscape();foreach(var item in Wait(.5))yield return item;
            Require(view.ExchangeOpen&&view.transform.Find("shop-page-content/shop-layout/sell-ledger/ledger-rule").gameObject.activeSelf,"exchange/rule state lost after bag");Shot("shop-current-exchange");
            Click("backShop");foreach(var item in Wait(.4))yield return item;Require(!view.ExchangeOpen&&Mathf.Abs(UiStack.Top.GetComponentsInChildren<ScrollRect>().First(scroll=>scroll.name=="shop-board-scroll").verticalNormalizedPosition-shelfPosition)<.04f,"shelf browse scroll lost after exchange");
            Click("openSell");foreach(var item in Wait(.3))yield return item;
            _step="safe-card sale I/O failure retains one trade and blocks departure";int sellPrice=CardLibrary.SellPrice(g.State.ownedCards.Single(entry=>entry.uid==uid).card);coins=g.State.coins;string before=File.ReadAllText(SaveSystem.ProfilePath);_granted=_saved=0;Lock();Click("sellCard-"+uid);foreach(var item in Wait(.35))yield return item;
            Require(g.State.ownedCards.All(entry=>entry.uid!=uid)&&g.State.coins==coins+sellPrice,"accepted failed-write sale was rolled back or duplicated");Require(File.ReadAllText(SaveSystem.ProfilePath)==before&&_saved==0&&!g.Saves.InTransaction,"failed sale changed disk/emitted SaveCompleted/left a transaction");Require(Find("sellCard-"+uid)==null,"accepted sale still has duplicate action");
            string soldShelf=JsonConvert.SerializeObject(g.CurrentNodeReceipt.shopStock),soldRng=g.Rng.SaveState();Click("backShop");foreach(var item in Wait(.3))yield return item;Click("closeShop");foreach(var item in Wait(.3))yield return item;
            Require(UiStack.Top is ShopScreen&&_saved==0&&g.State.coins==coins+sellPrice,"failed leave lost the live sale or escaped");Unlock();Click("closeShop");foreach(var item in Wait(.3))yield return item;
            Require(!(UiStack.Top is ShopScreen)&&_saved==1&&_granted==0&&!g.Saves.InTransaction,"retry departure did not only save once");ShopScreen.Open();foreach(var item in Wait(.5))yield return item;
            Require(g.State.coins==coins+sellPrice&&g.State.ownedCards.All(entry=>entry.uid!=uid)&&JsonConvert.SerializeObject(g.CurrentNodeReceipt.shopStock)==soldShelf&&g.Rng.SaveState()==soldRng,"sale recovery replayed trade or rerolled stock/RNG");
            _step="full-bag inspection and backpack detail return";Fixture();g=GameRuntime.I;ShopScreen.Open();foreach(var item in Wait(.4))yield return item;
            var candidate=CardLibrary.All().First(def=>def.type=="装备"&&!def.unrandom&&(def.desc?.Length??0)>80);g.CurrentNodeReceipt.shopStock[0].cardId=candidate.id;g.CurrentNodeReceipt.shopStock[0].price=2;
            foreach(var def in CardLibrary.All().Where(def=>def.id!=candidate.id&&!def.unrandom&&!BaseData.IsSha(def))){if(!g.GrantCard(def))break;}
            UiStack.Top.CloseFromEscape();ShopScreen.Open();foreach(var item in Wait(.5))yield return item;Click("shop-slot-0");foreach(var item in Wait(.4))yield return item;
            Require(!g.CanReceiveCard(candidate)&&Find("shop-detail-bag")!=null,"full-bag recovery action missing");if(Find("shopRules")!=null){Click("shopRules");foreach(var item in Wait(.3))yield return item;}var detailScroll=UiStack.Top.GetComponentsInChildren<ScrollRect>().First(scroll=>scroll.name=="shop-detail-scroll");detailScroll.verticalNormalizedPosition=.3f;float detailPosition=detailScroll.verticalNormalizedPosition;
            Click("shop-detail-bag");foreach(var item in Wait(.4))yield return item;UiStack.Top.CloseFromEscape();foreach(var item in Wait(.5))yield return item;
            Require(UiStack.Top.GetComponentInChildren<CurrentShopView>().DetailOpen,"bag return lost open inspection");Require(Mathf.Abs(UiStack.Top.GetComponentsInChildren<ScrollRect>().First(scroll=>scroll.name=="shop-detail-scroll").verticalNormalizedPosition-detailPosition)<.04f,"bag return lost detail scroll");
            _step="Apollo mystery purchase I/O failure retains trade and queued gift";Fixture(true);g=GameRuntime.I;ShopScreen.Open();foreach(var item in Wait(.5))yield return item;Click("shop-slot-8");foreach(var item in Wait(.4))yield return item;
            coins=g.State.coins;owned=g.State.ownedCards.Count;before=File.ReadAllText(SaveSystem.ProfilePath);_granted=_saved=0;Lock();Click("buyCard-8");foreach(var item in Wait(.4))yield return item;
            Require(UiStack.Top is ShopScreen&&g.State.coins==coins-3&&g.State.ownedCards.Count==owned+1&&g.CurrentNodeReceipt.shopStock[8].sold&&g.HasPendingShopAcquisition,"accepted failed-write purchase did not retain full transaction/gift");
            Require(_granted==1&&_saved==0&&!g.Saves.InTransaction&&File.ReadAllText(SaveSystem.ProfilePath)==before,"failed purchase observers/disk/transaction boundary mismatch");Require(Find("buyCard-8")==null,"accepted purchase still has duplicate action");
            string queued=g.CurrentChestReceipt.cardIds.Single(),purchasedRng=g.Rng.SaveState();Click("closeShop");foreach(var item in Wait(.3))yield return item;Require(UiStack.Top is ShopScreen&&_saved==0,"unsaved gift escaped shop");Unlock();Click("closeShop");foreach(var item in Wait(.7))yield return item;
            Require(UiStack.Top is ChestOpenScreen&&g.HasPendingShopAcquisition,"Apollo bonus did not open existing pending chest");Require(g.State.ownedCards.Count==owned+1&&g.State.coins==coins-3&&g.CurrentNodeReceipt.chestQueue.Count==1,"Apollo transaction card/coins/queue mismatch");
            Require(_granted==1&&_saved==1&&g.CurrentChestReceipt.cardIds.Single()==queued&&g.Rng.SaveState()==purchasedRng&&!g.Saves.InTransaction,"departure replayed purchase/gift/RNG or reemitted CardGranted");
            string gift=g.CurrentChestReceipt.cardIds.Single();UiStack.Top.CloseFromEscape();ShopScreen.Open();foreach(var item in Wait(.6))yield return item;Require(UiStack.Top is ChestOpenScreen&&g.CurrentChestReceipt.cardIds.Single()==gift,"Shop reopen rerolled or lost its pending gift");Shot("shop-current-apollo-pending");
            _step="shared gift claim failed-write/retry and no duplicate";owned=g.State.ownedCards.Count;Lock();Require(!g.TryClaimCurrentChest(g.CurrentNodeId,g.State.seed,0,out _),"locked gift claim succeeded");Require(g.State.ownedCards.Count==owned&&!g.CurrentChestReceipt.taken.Contains(0),"failed gift claim lost or duplicated its card");Unlock();
            Require(g.TryClaimCurrentChest(g.CurrentNodeId,g.State.seed,0,out var reason),reason);Require(g.State.ownedCards.Count==owned+1&&g.CurrentChestReceipt.taken.Contains(0),"gift retry failed");Require(!g.TryClaimCurrentChest(g.CurrentNodeId,g.State.seed,0,out _),"duplicate gift claim succeeded");
            UiStack.Top.CloseFromEscape();ShopScreen.Open();foreach(var item in Wait(.5))yield return item;ClickText("继续探索");foreach(var item in Wait(.5))yield return item;
            Require(!g.HasPendingShopAcquisition&&g.State.Phase=="idle","gift continuation did not finish");ShopScreen.Open();foreach(var item in Wait(.5))yield return item;Require(UiStack.Top is ShopScreen&&g.CurrentNodeReceipt.shopStock[8].sold&&g.State.ownedCards.Count==owned+1,"Shop continuation duplicated purchase/gift or reset shelf");
            foreach(var item in CommissionFlow())yield return item;
            Record("complete",new{migrationFilterCorrection="safe sellables follow source isSellable&&!stored",saveFailure="explicit shop retain mode keeps accepted trades/gift and blocks departure until saved; default transactions and action exceptions retain atomic rollback",gift,coins=g.State.coins});
        }
        static void DefaultBoundaries()
        {
            var g=GameRuntime.I;int coins=g.State.coins,count=g.State.ownedCards.Count;string rng=g.Rng.SaveState(),before=File.ReadAllText(SaveSystem.ProfilePath);_granted=_saved=0;Lock();
            bool saved=g.TryPersistMutation(()=>{g.State.coins--;Require(g.GrantCard(CardLibrary.FindById("tt3-fireball")),"default fixture card failed");g.Rng.Random("event");},out _);
            Require(!saved&&g.State.coins==coins&&g.State.ownedCards.Count==count&&g.Rng.SaveState()==rng&&_granted==0&&_saved==0&&!g.Saves.InTransaction,"default failed write lost atomic rollback/deferred boundary");Unlock();
            foreach(bool io in new[]{false,true})
            {
                saved=g.TryPersistMutation(()=>{g.State.coins--;Require(g.GrantCard(CardLibrary.FindById("tt3-fireball")),"exception fixture card failed");g.Rng.Random("event");if(io)throw new IOException("probe action IO exception");throw new InvalidOperationException("probe action exception");},out _,true,out bool applied);
                Require(!saved&&!applied&&g.State.coins==coins&&g.State.ownedCards.Count==count&&g.Rng.SaveState()==rng&&_granted==0&&_saved==0&&!g.Saves.InTransaction&&File.ReadAllText(SaveSystem.ProfilePath)==before,"retain mode incorrectly kept an action exception");
            }
            Record("default-and-action-exception-boundaries",new{defaultRollback=true,actionIoRollback=true,ordinaryActionRollback=true,noObserverLeak=true});
        }
        static EventProgress Voucher=>GameRuntime.I.State.nodeRewards.Values.Select(receipt=>receipt.eventProgress).Single(progress=>progress?.eventId=="tt6-goldhammer");
        static void AttachVoucher()
        {
            var g=GameRuntime.I;int shop=g.State.trackPos;var node=g.Map.Snapshot.layers[0].nodes.First(entry=>entry.type=="event");g.State.trackPos=node.idx;
            Require(g.GetEventChoices("tt6-goldhammer").Any(choice=>choice.EffectKey=="tt6-goldhammer:1"),"source voucher choice unavailable");g.ApplyCurrentEventChoice("tt6-goldhammer:1");Require(Voucher.commissionPending&&g.Saves.LastWriteSucceeded,"real voucher choice did not persist");
            g.State.trackPos=shop;g.State.Phase="idle";g.SaveCurrent();Require(g.Saves.LastWriteSucceeded,"voucher fixture position save failed");Record("voucher-source-command",new{source="actual GetEventChoices/ApplyCurrentEventChoice; controlled generated event/shop positions"});
        }
        static IEnumerable<object> CommissionFlow()
        {
            _step="mystery offer is eligible and stays hidden in voucher dice";Fixture();AttachVoucher();var g=GameRuntime.I;
            for(int i=1;i<=6;i++)g.CurrentNodeReceipt.shopStock[i].sold=true;g.SaveCurrent();Require(g.TryPrepareShopCommission(out var error),error);g.StartCommissionDice();
            Require(g.CurrentCommissionDie.outcomes.Any(value=>value.Number("slot",-1)==8)&&g.CurrentCommissionDie.labels.Any(label=>label.EndsWith("神秘货箱")),"voucher excluded or exposed mystery offer");
            _step="voucher start/candidates/roll checkpoint recovery";Fixture();AttachVoucher();g=GameRuntime.I;string beforeBind=g.Rng.SaveState();ShopScreen.Open();foreach(var item in Wait(.8))yield return item;
            Require(Find("commissionStart")!=null&&g.CurrentCommissionDie==null&&g.Rng.SaveState()==beforeBind,"opening voucher consumed RNG or skipped start story");
            string disk=File.ReadAllText(SaveSystem.ProfilePath);_granted=_saved=0;Lock();Submit("commissionStart");foreach(var item in Wait(.8))yield return item;
            string candidates=JsonConvert.SerializeObject(g.CurrentCommissionDie),reservedRng=g.Rng.SaveState();Require(Voucher.commissionDice.Count==1&&g.CurrentCommissionDie.outcomes.Count==6&&reservedRng!=beforeBind,"failed reserve lost frozen candidates/RNG");Require(_saved==0&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&!g.Saves.InTransaction,"failed reserve leaked a checkpoint/transaction");
            Unlock();Submit("commissionRetry");foreach(var item in Wait(.8))yield return item;Require(JsonConvert.SerializeObject(g.CurrentCommissionDie)==candidates&&g.Rng.SaveState()==reservedRng,"candidate retry rerolled voucher");
            _saved=0;Lock();Submit("eventDiceRoll");foreach(var item in Wait(.35))yield return item;int first=g.CurrentCommissionDie.result.Value;string rolledRng=g.Rng.SaveState();Require(_saved==0&&rolledRng!=reservedRng&&Voucher.commissionSlots.Count==0&&!g.Saves.InTransaction,"failed roll did not retain exactly one unconfirmed result");
            Submit("eventDiceContinue");foreach(var item in Wait(.3))yield return item;Require(g.CurrentCommissionDie.result==first&&Voucher.commissionSlots.Count==0&&g.Rng.SaveState()==rolledRng,"failed confirmation accepted a slot or rerolled");
            Unlock();_saved=0;_lockAfterSave=true;Submit("eventDiceContinue");foreach(var item in Wait(.8))yield return item;
            Require(_locked!=null&&_saved==1&&Voucher.commissionSlots.Count==1&&Voucher.commissionDice.Count==2&&!g.CurrentCommissionDie.result.HasValue&&Find("commissionRetry")!=null,"second die reserve failure did not retain the accepted first slot/candidates");
            string secondCandidates=JsonConvert.SerializeObject(g.CurrentCommissionDie),secondReserveRng=g.Rng.SaveState();Unlock();Submit("commissionRetry");foreach(var item in Wait(.8))yield return item;
            Require(Find("eventDiceRoll")!=null&&Find("eventDiceContinue")==null&&Voucher.commissionSlots.Count==1&&JsonConvert.SerializeObject(g.CurrentCommissionDie)==secondCandidates&&g.Rng.SaveState()==secondReserveRng,"second die reserve retry reconfirmed first slot or rerolled instead of returning to roll");
            _step="dice motion does not steal feedback input focus";Submit("eventDiceRoll");Sdt.UI.Screens.Menu.SuggestionBox.OpenForCurrentScreen();var feedback=App.UiRoot.GetComponentInChildren<Sdt.UI.Screens.Menu.CurrentFeedbackComposer>();Require(feedback!=null,"actual feedback composer missing");var input=feedback.GetComponentsInChildren<InputField>().First();input.text="commission feedback focus sentinel";
            foreach(var item in Wait(1.5))yield return item;Require(Sdt.UI.Screens.Menu.SuggestionBox.IsOpen&&EventSystem.current.currentSelectedGameObject==input.gameObject&&Voucher.commissionSlots.Count==1,"dice completion stole feedback focus or accepted hidden step");
            ExecuteEvents.Execute(EventSystem.current.currentSelectedGameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);Require(Voucher.commissionSlots.Count==1&&input.text=="commission feedback focus sentinel","feedback submit confirmed hidden dice or lost text");Sdt.UI.Screens.Menu.SuggestionBox.CloseIfOpen();foreach(var item in Wait(.8))yield return item;Require(EventSystem.current.currentSelectedGameObject==Find("eventDiceContinue")?.gameObject,"feedback close did not restore current dice continue focus");
            _step="voucher apply rollback retains both chosen slots; no third dice";string beforeApply=g.Rng.SaveState();int owned=g.State.ownedCards.Count;_saved=0;_lockAfterSave=true;Submit("eventDiceContinue");foreach(var item in Wait(.8))yield return item;
            Require(_locked!=null&&_saved==1&&Voucher.commissionSlots.Count==2&&Voucher.commissionDice.Count==2&&!Voucher.commissionUsed,"apply fault did not preserve two choices or emitted false SaveCompleted");Require(Voucher.commissionSlots.All(index=>!g.CurrentNodeReceipt.shopStock[index].free&&g.CurrentNodeReceipt.shopStock[index].price>0)&&g.Rng.SaveState()==beforeApply,"failed discount changed prices or RNG");
            Unlock();Click("commissionRetry");foreach(var item in Wait(.8))yield return item;Require(Voucher.commissionUsed&&!Voucher.commissionPending&&!Voucher.commissionAnnounced&&Voucher.commissionSlots.Count==2&&Voucher.commissionDice.Count==2&&g.Rng.SaveState()==beforeApply,"apply retry did not reach unannounced receipt without reroll");
            Require(Find("commissionEnterShop")!=null&&g.State.ownedCards.Count==owned&&Voucher.commissionSlots.All(index=>g.CurrentNodeReceipt.shopStock[index].free),"receipt granted goods before shelf or lost discounts");
            _step="applied receipt restores before announcement";UiStack.Top.CloseFromEscape();ShopScreen.Open();foreach(var item in Wait(.8))yield return item;Require(Find("commissionEnterShop")!=null&&Find("commissionStart")==null,"reentry did not restore applied receipt");
            _saved=0;Lock();Click("commissionEnterShop");foreach(var item in Wait(.8))yield return item;Require(!Voucher.commissionAnnounced&&Voucher.commissionUsed&&_saved==0&&g.State.ownedCards.Count==owned,"failed announcement entered shelf or undid applied discounts");Unlock();Click("commissionRetry");foreach(var item in Wait(.8))yield return item;
            Click("commissionEnterShop");foreach(var item in Wait(.8))yield return item;Require(Voucher.commissionAnnounced&&g.GetCommissionOutcome()==null&&UiStack.Top.GetComponentInChildren<CurrentShopView>()!=null&&g.State.ownedCards.Count==owned,"saved announcement failed to enter same shelf");
            Require(UiStack.Top.GetComponentsInChildren<Transform>().Count(child=>child.name=="commission-top")==2,"two paid-by-voucher shelf markers missing");Record("commission-full-source-stages",new{startBeforeRng=true,preservedDice=true,applyRollbackKeptChoices=true,announcementSeparate=true,goodsNotAutoClaimed=true});
        }
        static void Fixture(bool apollo=false)
        {
            Clear();var g=GameRuntime.I;g.ResetSlot(5);g.NewRun(5,CharacterTable.All[0].id);for(int i=0;i<g.GetEntrySupplyCards().Count;i++)Require(g.ClaimEntrySupply(i,out var error),error);Clear();
            var node=g.Map.Snapshot.layers[0].nodes.First(entry=>entry.type=="shop");g.State.layerIdx=0;g.State.trackPos=node.idx;g.State.Phase="idle";g.State.coins=30;
            var stock=ShopScreen.GenerateStock().Select(slot=>new ShopOfferReceipt{cardId=slot.card?.id,price=slot.price,sold=slot.sold,empty=slot.empty,mystery=slot.mystery,free=slot.free,label=slot.label,shaReplenish=slot.shaReplenish}).ToList();
            stock[0].cardId="tt3-fireball";stock[0].price=2;if(apollo){stock[8].cardId="tt2-apollo";stock[8].price=3;}g.CurrentNodeReceipt.shopStock=stock;g.SaveCurrent();Require(g.Saves.LastWriteSucceeded,"fixture write failed");
            Record("controlled-source-fixture",new{apollo,node=node.id,entrySupplyComplete=g.EntrySupplyComplete,source="actual NewRun, entry claims and stock generation; controlled map position/first offer, not RNG equivalence"});
        }
        static string SafeSaleFixture(){var g=GameRuntime.I;var card=CardLibrary.All().First(CardLibrary.IsSellable);Require(g.GrantCard(card),"safe sale fixture did not fit");string uid=g.State.ownedCards.Last(entry=>entry.card.id==card.id).uid;Require(CardContainerCommands.TryMoveSafe(g,new[]{uid},true,out var error),error);return uid;}
        static Button Find(string name)=>UiStack.Top?.GetComponentsInChildren<Button>().FirstOrDefault(button=>button.name==name);
        static void Submit(string name){var target=Find(name);Require(target!=null&&target.IsInteractable()&&EventSystem.current.currentSelectedGameObject==target.gameObject,"keyboard focus missing before submit "+name);Require(ExecuteEvents.Execute(target.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"keyboard submit rejected "+name);Record("constructed-uGUI-selected-submit",new{target=name});}
        static void Click(string name){var target=Find(name);Require(target!=null,"missing button "+name);Click(target);}
        static void ClickText(string text){var target=UiStack.Top.GetComponentsInChildren<Button>().FirstOrDefault(button=>button.GetComponentsInChildren<Text>().Any(label=>label.text==text));Require(target!=null,"missing action "+text);Click(target);}
        static void Click(Button target)
        {
            var scroll=target.GetComponentInParent<ScrollRect>();if(scroll!=null)for(int attempt=0;attempt<32;attempt++)
            {
                Canvas.ForceUpdateCanvases();var viewport=scroll.viewport==null?(RectTransform)scroll.transform:scroll.viewport;var bounds=RectTransformUtility.CalculateRelativeRectTransformBounds(viewport,target.transform);
                if(bounds.min.y>=viewport.rect.yMin+4&&bounds.max.y<=viewport.rect.yMax-4)break;
                var scrollPoint=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,viewport.TransformPoint(viewport.rect.center));float direction=bounds.min.y<viewport.rect.yMin?-1:1;
                ExecuteEvents.Execute(scroll.gameObject,new PointerEventData(EventSystem.current){position=scrollPoint,scrollDelta=new Vector2(0,direction)},ExecuteEvents.scrollHandler);
            }
            Canvas.ForceUpdateCanvases();var rect=(RectTransform)target.transform;var point=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,rect.TransformPoint(rect.rect.center));var data=new PointerEventData(EventSystem.current){position=point,pressPosition=point,button=PointerEventData.InputButton.Left,eligibleForClick=true,clickCount=1};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(data,hits);var receiver=hits.Count==0?null:ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject);Require(receiver==target.gameObject,"raycast blocked "+target.name+" by "+receiver?.name);Require(target.IsInteractable(),"disabled action "+target.name);
            data.pointerCurrentRaycast=data.pointerPressRaycast=hits[0];var down=ExecuteEvents.ExecuteHierarchy(hits[0].gameObject,data,ExecuteEvents.pointerDownHandler);Require(down==target.gameObject,"pointer down mismatch");data.pointerPress=down;data.rawPointerPress=hits[0].gameObject;ExecuteEvents.Execute(down,data,ExecuteEvents.pointerUpHandler);Require(ExecuteEvents.Execute(receiver,data,ExecuteEvents.pointerClickHandler),"pointer click rejected");Record("constructed-uGUI-pointer",new{target=target.name,point.x,point.y});
        }
        static Rect Bounds(RectTransform rect){var corners=new Vector3[4];rect.GetWorldCorners(corners);var a=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,corners[0]);var b=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,corners[2]);return new Rect(a,b-a);}
        static void Lock(){_locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read);}static void Unlock(){_locked?.Dispose();_locked=null;}
        static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
        static void Require(bool pass,string reason){if(!pass)throw new InvalidOperationException(reason);}
        static void Shot(string name){Record("native-render-reference",new{name,capture=OffscreenCapture.Write(Path.Combine(Output,name+".png"))});}
        static void Record(string kind,object detail){Records.Add(new{elapsed=Now-_start,step=_step,kind,detail});File.WriteAllText(Path.Combine(Output,"trace.json"),JsonConvert.SerializeObject(Records,Formatting.Indented));}
        static void Finish(Exception error)
        {
            if(!SessionState.GetBool(Active,false))return;SessionState.SetBool(Active,false);Unlock();
            File.WriteAllText(Path.Combine(Output,"result.json"),JsonConvert.SerializeObject(new{passed=error==null,error=error?.ToString(),step=_step,records=Records,dataDirectory=SaveSystem.Dir,input="actual runtime and constructed EventSystem raycast/down/up/click",osHardwareInput=false,limitations=new[]{"Controlled map/offer fixtures do not prove navigation, balance or original RNG equivalence.","1920 reference offscreen evidence requires independent actual Standalone visual review."}},Formatting.Indented));EditorApplication.Exit(error==null?0:2);
        }
    }
}
