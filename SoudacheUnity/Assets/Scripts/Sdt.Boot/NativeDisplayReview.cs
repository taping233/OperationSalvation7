using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace Sdt.Boot
{
    // Explicit QA command only. This records the real standalone backbuffer and keeps
    // normal ScreenSpaceOverlay/CanvasScaler behaviour, unlike Editor offscreen fixtures.
    public sealed partial class NativeDisplayReview : MonoBehaviour
    {
        static readonly string[] Arguments = Environment.GetCommandLineArgs();
        static string Argument(string key)
        { int index = Array.IndexOf(Arguments, key); return index >= 0 && index + 1 < Arguments.Length ? Arguments[index + 1] : null; }
        public static bool Enabled => Array.IndexOf(Arguments, "--sdt-background-review") >= 0;
        static string Output => Path.GetFullPath(Argument("--sdt-background-review"));
        readonly List<object> _records = new List<object>();
        bool _failed;
        float _began;
        public static void ConfigureBeforeLaunch()
        {
            if (!Enabled) return;
            if (!long.TryParse(Argument("-parentHWND"), out var parent))
                throw new InvalidOperationException("Background display review requires an explicit hidden parent window.");
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
            if (!IsWindow(new IntPtr(parent)) || IsWindowVisible(new IntPtr(parent)))
                throw new InvalidOperationException("Background display review parent must exist and remain invisible.");
#endif
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "isolated-profile"));
            Application.runInBackground = true;
            AudioListener.volume=0;
        }
        public static void Install()
        {
            if (!Enabled) return;
            var node = new GameObject("~NativeDisplayReview");
            DontDestroyOnLoad(node); node.AddComponent<NativeDisplayReview>();
        }
        void Start()
        { _began = Time.realtimeSinceStartup; Application.logMessageReceived += Observe; StartCoroutine(Run()); }
        void Update() { if (!_failed && Time.realtimeSinceStartup - _began > 180) Fail(new TimeoutException("Actual standalone review exceeded 180 seconds.")); }
        void OnDestroy() { Application.logMessageReceived -= Observe; }
        void Observe(string message, string stack, LogType type)
        { if (type == LogType.Error || type == LogType.Exception) Fail(new InvalidOperationException(message + "\n" + stack)); }
        bool Guard(Action action)
        {
            if (_failed) return false;
            try { action(); return true; }
            catch (Exception error) { Fail(error); return false; }
        }
        IEnumerator Run()
        {
            for (int frame = 0; frame < 12; frame++) yield return null;
            if(!Guard(()=>{if(FindObjectsByType<GameBoot>(FindObjectsSortMode.None).Length!=1||FindObjectsByType<NativeDisplayReview>(FindObjectsSortMode.None).Length!=1)throw new InvalidOperationException("Duplicate boot/review owners.");}))yield break;
            if (!Guard(() => _records.Add(new { kind = "actual-player-start", display = DisplayMetadata() }))) yield break;
            // Capture the real startup mid-motion, then wait for its own completion.
            // No forced resolution, input bypass or replacement curtain is involved.
            float startupWait = Time.realtimeSinceStartup;
            while (!StartupTransition.Finished && StartupTransition.Film != null
                && StartupTransition.Film.PlaybackProgress < .5f && Time.realtimeSinceStartup - startupWait < 10) yield return null;
            if (!StartupTransition.Finished)
            {
                if (!Guard(() => _records.Add(new { kind = "actual-player-startup-midpoint", stage = StartupTransition.Stage,
                    progress = StartupTransition.Film?.PlaybackProgress, shaderReady = StartupTransition.Film?.ShaderReady,
                    duration = StartupTransition.Film?.DurationSeconds, exit = StartupTransition.Film?.ExitSeconds,
                    sourceContract = "city reflection; no visible subtitle; keyboard/pointer skipping disabled", display = DisplayMetadata() }))) yield break;
                yield return Capture("player-startup", false);
            }
            while (!StartupTransition.Finished && Time.realtimeSinceStartup - startupWait < 10) yield return null;
            if (!Guard(() => {
                if (!StartupTransition.Finished) throw new TimeoutException("Desktop startup film did not finish.");
                _records.Add(new { kind = "actual-player-startup-finished", stage = StartupTransition.Stage,
                    started = StartupTransition.StartedAt, completed = StartupTransition.CompletedAt,
                    elapsed = StartupTransition.StartedAt > 0 ? StartupTransition.CompletedAt - StartupTransition.StartedAt : 0,
                    display = DisplayMetadata() });
            })) yield break;
            yield return Capture("player-title", false);
            if (!Guard(() => { Clear(); CurrentRewardCardZoom.Open(new CurrentRewardItem { Card = CardLibrary.FindById("tt7-bloodpoison"), State = "taken" }); })) yield break;
            for (int frame = 0; frame < 4; frame++) yield return null;
            yield return Capture("player-card-legacy-density", true);
            yield return Capture("player-card-native-density", false);
            if (!Guard(() => { Clear(); Sdt.UI.Screens.Misc.CardLibraryScreen.Open(); })) yield break;
            for (int frame = 0; frame < 4; frame++) yield return null;
            yield return Capture("player-photo", false);
            yield return ReviewPhotoStudioExports();
            if (_failed) yield break;
            if (!Guard(() => { Clear(); UiStack.Show<Sdt.UI.Screens.Menu.SettingsScreen>("Settings"); })) yield break;
            for (int frame = 0; frame < 4; frame++) yield return null;
            yield return Capture("player-settings", false);
            yield return ReviewRound6Audio();
            if (_failed) yield break;
            if (!Guard(() => { Clear(); UiStack.Show<Sdt.UI.Screens.Menu.GuideScreen>("Guide"); })) yield break;
            for(int page=0;page<6;page++)
            {
                if(page>0&&!Guard(()=>ClickNamed("guidePage-"+page)))yield break;
                float settle=Time.realtimeSinceStartup+.4f;while(Time.realtimeSinceStartup<settle)yield return null;
                if(!Guard(()=>{var guide=App.Canvas.GetComponentInChildren<Sdt.UI.Screens.Menu.CurrentBeginnerGuide>();if(guide==null||guide.CurrentPage!=page||guide.PageCount!=6)throw new InvalidOperationException("Guide chapter did not update: "+page);}))yield break;
                yield return Capture("player-guide-"+page,false);
                if(page==3||page==4){yield return ExpandGuideMore();yield return Capture("player-guide-more-"+page,false);}
            }
            if(!Guard(()=>ClickNamed("guideImageOpen")))yield break;
            yield return Capture("player-guide-original",false);
            if(!Guard(()=>{NewPresentationFixture();UiStack.Show<Sdt.UI.Screens.Menu.GuideScreen>("Guide");}))yield break;
            yield return Capture("player-guide-in-run",false);
            if(!Guard(()=>{if(!CurrentRunTopBar.Covered())throw new InvalidOperationException("Run guide did not cover shared top bar.");Clear();GameRuntime.I.State.Phase="modal";AltarRitualScreen.Open();}))yield break;
            yield return Capture("player-altar",false);
            yield return ReviewRound6Sacrifice();
            if (_failed) yield break;
            if(!Guard(()=>{Clear();var g=GameRuntime.I;var door=g.Map.Snapshot.layers[0].doors.First(item=>item.toLayer>0);g.State.layerIdx=0;g.State.trackPos=door.at;g.State.Phase="modal";DoorModal.Open(new Sdt.UI.Screens.Run.DoorInfo{toLayer=door.toLayer,arriveAt=door.arriveAt,toLayerName=g.Map.Layers[door.toLayer],reverse=false,exit=false},false);}))yield break;
            yield return Capture("player-door",false);
            if(!Guard(()=>ClickNamed("goDoor")))yield break;
            float passageWait=Time.realtimeSinceStartup;
            while((CurrentRunFilm.Current==null||CurrentRunFilm.Current.Kind!="passage"||CurrentRunFilm.Current.PlaybackProgress<.55f)&&Time.realtimeSinceStartup-passageWait<10)yield return null;
            if(!Guard(()=>{if(CurrentRunFilm.Current==null||CurrentRunFilm.Current.Kind!="passage")throw new InvalidOperationException("Door did not mount real passage film.");}))yield break;
            yield return Capture("player-passage",false);
            while(CurrentRunFilm.Visible&&Time.realtimeSinceStartup-passageWait<12)yield return null;
            if(!Guard(()=>{if(CurrentRunFilm.Visible||GameRuntime.I.State.layerIdx!=1)throw new InvalidOperationException("Passage did not finish at the next layer.");}))yield break;
            if(!Guard(()=>{
                Clear();var g=GameRuntime.I;g.State.ownedCards.Clear();g.State.hp=g.State.maxHp=1000;g.State.atk=0;g.State.Phase="idle";
                for(int i=0;i<24;i++){var card=CardLibrary.SHA.Clone();card.cost=0;card.dmg=0;card.rules=null;g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="display-pile-"+i,card=card});}
                g.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="后台呈现复核",Foes=new List<EnemyStats>{new EnemyStats{id="display-foe",name="受控敌人",hp=10000,atk=0}}}});
            }))yield break;
            float battleWait=Time.realtimeSinceStartup;
            while(!(UiStack.Top is Sdt.UI.Screens.Battle.BattleScreen)&&Time.realtimeSinceStartup-battleWait<10)yield return null;
            yield return Capture("player-battle",false);
            if(!Guard(()=>ClickButton(UiStack.Top.GetComponentsInChildren<Button>().First(button=>button.GetComponentInChildren<Text>()?.text.StartsWith("[[icon:cards]] 牌库")==true))))yield break;
            yield return Capture("player-battle-pile",false);
            if(!Guard(()=>ClickNamed("btDecisionInspect-0")))yield break;
            yield return Capture("player-battle-pile-reader",false);
            if(!Guard(()=>ClickNamed("zoom-close")))yield break;
            yield return Capture("player-battle-pile-return",false);
            yield return ParityBattle();
            if (_failed) yield break;
            yield return ReviewRound6Discovery();
            if (_failed) yield break;
            yield return ReviewRound7Discovery();
            if (_failed) yield break;
            yield return ReviewRound7Battle();
            if (_failed) yield break;
            yield return ReviewRound7Bag();
            if (_failed) yield break;
            if(!Guard(()=>{
                NewPresentationFixture();var g=GameRuntime.I;
                var card=CardDatabase.All.First(item=>item.type=="武术"&&item.cls==g.State.myClass&&item.id!="starter-attack").Clone();
                g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="display-formation-card",card=card});
                g.Bus.Emit(new BattleRequested{Request=new BattleRequest{IsBoss=true,Name="编组呈现复核",Layer=3,Foes=new List<EnemyStats>{new EnemyStats{id="boss_orc",name="受控首脑",hp=45,atk=3}}}});
            }))yield break;
            yield return Capture("player-formation",false);
            if(!Guard(()=>{if(!(UiStack.Top is Sdt.UI.Screens.Battle.DeckSelectionPanel))throw new InvalidOperationException("Formation destination absent.");ClickNamed("bossFormationRules");}))yield break;
            yield return Capture("player-formation-rules",false);
            if(!Guard(()=>{
                NewPresentationFixture();var g=GameRuntime.I;g.State.layerIdx=1;
                g.State.trackPos=g.Map.Snapshot.layers[1].nodes.First(node=>node.type=="shop").idx;
                g.State.coins=30;g.State.Phase="idle";g.SaveCurrent();g.ResolveCell();
            }))yield break;
            yield return Capture("player-shop",false);
            if(!Guard(()=>{if(!(UiStack.Top is ShopScreen))throw new InvalidOperationException("Shop destination absent.");ClickNamed("shop-slot-0");}))yield break;
            yield return new WaitForSecondsRealtime(.4f);
            yield return Capture("player-shop-inspection",false);
            if(!Guard(()=>{ClickNamed("shopCloseInspect");}))yield break;
            yield return new WaitForSecondsRealtime(.4f);
            if(!Guard(()=>ClickNamed("openSell")))yield break;
            yield return Capture("player-shop-exchange",false);
            if(!Guard(()=>{
                NewPresentationFixture();var g=GameRuntime.I;g.State.layerIdx=1;
                int shop=g.Map.Snapshot.layers[1].nodes.First(node=>node.type=="shop").idx;
                g.State.trackPos=g.Map.Snapshot.layers[1].nodes.First(node=>node.type=="event").idx;
                if(!g.GetEventChoices("tt6-goldhammer").Any(choice=>choice.EffectKey=="tt6-goldhammer:1"))throw new InvalidOperationException("Voucher source choice absent.");
                g.ApplyCurrentEventChoice("tt6-goldhammer:1");g.State.trackPos=shop;g.State.coins=30;g.State.Phase="idle";g.SaveCurrent();g.ResolveCell();
            }))yield break;
            yield return Capture("player-shop-commission",false);
            if(!Guard(()=>ClickNamed("commissionStart")))yield break;
            yield return Capture("player-shop-commission-dice",false);
            for(int die=0;die<2;die++)
            {
                if(!Guard(()=>ClickNamed("eventDiceRoll")))yield break;
                yield return new WaitForSecondsRealtime(1.5f);
                if(!Guard(()=>ClickNamed("eventDiceContinue")))yield break;
                yield return null;yield return null;
            }
            yield return Capture("player-shop-commission-receipt",false);
            if(!Guard(()=>ClickNamed("commissionEnterShop")))yield break;
            yield return Capture("player-shop-free-offers",false);
            if(!Guard(NewRecodeFixture))yield break;
            yield return Capture("player-recode-result",false);
            string recodeCards=SaveJson.Stringify(GameRuntime.I.State.ownedCards),recodeRng=GameRuntime.I.Rng.SaveState();
            string recodeDrawn=SaveJson.Stringify(GameRuntime.I.CurrentNodeReceipt.eventProgress.drawn);
            if(!Guard(()=>ClickNamed("eventRecodeInspect-0")))yield break;
            yield return Capture("player-recode-reader",false);
            if(!Guard(()=>ClickNamed("zoom-close")))yield break;
            yield return null;yield return null;
            if(!Guard(()=>{
                if(EventSystem.current.currentSelectedGameObject?.name!="eventRecodeInspect-0")throw new InvalidOperationException("Recode reader did not return focus.");
                ClickNamed("eventRecodeResultBag");
            }))yield break;
            yield return null;yield return null;
            if(!Guard(()=>{if(!(UiStack.Top is Sdt.UI.Screens.Bag.BagScreen))throw new InvalidOperationException("Recode bag destination absent.");UiStack.Top.CloseFromEscape();}))yield break;
            yield return null;yield return null;
            if(!Guard(()=>{
                var g=GameRuntime.I;
                if(!(UiStack.Top is EventDialogScreen)||SaveJson.Stringify(g.State.ownedCards)!=recodeCards||g.Rng.SaveState()!=recodeRng||SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress.drawn)!=recodeDrawn)
                    throw new InvalidOperationException("Recode inspection/bag changed frozen result or inventory.");
                using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))ClickNamed("eventRecodeAccept");
                if(SaveJson.Stringify(g.State.ownedCards)!=recodeCards||g.Rng.SaveState()!=recodeRng||SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress.drawn)!=recodeDrawn||g.CurrentNodeReceipt.eventProgress.settled)
                    throw new InvalidOperationException("Failed recode save did not preserve original cards and frozen result.");
            }))yield break;
            yield return Capture("player-recode-save-failed",false);
            if(!Guard(()=>{ClickNamed("eventRecodeAccept");if(!GameRuntime.I.CurrentNodeReceipt.eventProgress.settled)throw new InvalidOperationException("Recode retry did not commit.");}))yield break;
            if(!Guard(NewRewardReaderFixture))yield break;
            yield return new WaitForSecondsRealtime(.7f);
            yield return Capture("player-reward-pending",false);
            if(!Guard(()=>ClickButton(UiStack.Top.GetComponentInChildren<CurrentRewardTile>().GetComponentsInChildren<Button>().First(button=>button.name=="reward-card"))))yield break;
            yield return Capture("player-reward-reader-pending",false);
            var rewardClaim=UiStack.Top.GetComponentsInChildren<Button>().First(button=>button.name=="rewardZoomClaim");var staleRewardClaim=rewardClaim.onClick;
            if(!Guard(()=>ClickButton(rewardClaim)))yield break;
            yield return null;yield return null;
            if(!Guard(()=>{
                var g=GameRuntime.I;if(!g.CurrentNodeReceipt.chestQueue[0].taken.Contains(0))throw new InvalidOperationException("Reward reader did not claim its original frozen card.");
                string after=SaveJson.Stringify(g.State),rng=g.Rng.SaveState();staleRewardClaim.Invoke();
                if(SaveJson.Stringify(g.State)!=after||g.Rng.SaveState()!=rng)throw new InvalidOperationException("Stale reward reader repeated a claim.");
                _records.Add(new{kind="constructed-stale-callback-rejected",target="rewardZoomClaim"});
            }))yield break;
            if(!Guard(()=>{
                NewRewardReaderFixture();var g=GameRuntime.I;var target=CardLibrary.FindById("tt3-fireball");
                for(int copies=0;copies<128&&g.CanReceiveCard(target);copies++)if(!g.GrantCard(target))throw new InvalidOperationException("Capacity fixture grant rejected before capacity filled.");
                if(g.CanReceiveCard(target))throw new InvalidOperationException("Capacity fixture did not fill.");
                g.SaveCurrent();UiStack.Close(UiStack.Top);g.State.Phase="modal";ChestOpenScreen.OpenPending(null);
            }))yield break;
            yield return new WaitForSecondsRealtime(.7f);
            if(!Guard(()=>ClickButton(UiStack.Top.GetComponentInChildren<CurrentRewardTile>().GetComponentsInChildren<Button>().First(button=>button.name=="reward-card"))))yield break;
            yield return Capture("player-reward-reader-capacity",false);
            int rewardOwned=GameRuntime.I.State.ownedCards.Count,rewardCoins=GameRuntime.I.State.coins;string rewardRng=GameRuntime.I.Rng.SaveState();
            if(!Guard(()=>{var button=UiStack.Top.GetComponentsInChildren<Button>().First(item=>item.name=="rewardZoomClaim");if(button.GetComponentInChildren<Text>().text!="整理背包")throw new InvalidOperationException("Capacity reader action label differs.");ClickButton(button);}))yield break;
            yield return null;yield return null;
            if(!Guard(()=>{
                var g=GameRuntime.I;if(!(UiStack.Top is CurrentRewardCapacityOrganizer)&&!(UiStack.Top is Sdt.UI.Screens.Bag.BagScreen))throw new InvalidOperationException("Capacity reward reader did not open organization.");
                if(g.CurrentNodeReceipt.chestQueue[0].taken.Contains(0)||g.State.ownedCards.Count!=rewardOwned||g.State.coins!=rewardCoins||g.Rng.SaveState()!=rewardRng)throw new InvalidOperationException("Opening reward organization changed reward/card/currency/RNG.");
            }))yield break;
            yield return Capture("player-reward-reader-organizer",false);
            if(!Guard(()=>{
                NewPresentationFixture();var g=GameRuntime.I;g.State.layerIdx=3;g.State.trackPos=g.Map.Snapshot.layers[3].nodes.First(node=>node.type=="extraction").idx;
                g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="display-extraction-card",card=CardDatabase.All.First(card=>card.name=="冰刺").Clone()});
                g.State.bossDefeated=true;g.State.Phase="idle";if(!g.TryFinalExtract(out var reason))throw new InvalidOperationException(reason);
            }))yield break;
            yield return Capture("player-extraction",false);
            if(!Guard(()=>{if(!(UiStack.Top is ExtractStashScreen)||CurrentRunTopBar.Visible)throw new InvalidOperationException("Extraction did not park the shared header.");}))yield break;
            if(!Guard(()=>ClickNamed("exRarity")))yield break;
            yield return null;yield return null;
            if(!Guard(()=>ClickNamed("exFinish")))yield break;
            yield return null;yield return null;
            var confirm=App.Canvas.GetComponentsInChildren<Button>().FirstOrDefault(button=>button.name=="exConfirmFinish"&&button.isActiveAndEnabled&&button.IsInteractable());
            if(confirm!=null&&!Guard(()=>ClickButton(confirm)))yield break;
            yield return Capture("player-settlement",false);
            if(!Guard(()=>{if(!(UiStack.Top is ExtractDoneScreen))throw new InvalidOperationException("Settlement destination absent.");ClickNamed("goBase");}))yield break;
            yield return Capture("player-returned-base",false);
            if(!Guard(()=>{if(!(UiStack.Top is Sdt.UI.Screens.Hub.HubScreen)||GameRuntime.I.State.runActive)throw new InvalidOperationException("Returned base destination absent.");}))yield break;
            yield return ParityHub();
            if (_failed) yield break;
            if(!Guard(()=>ClickNamed("hub-back archive-back")))yield break;
            yield return Capture("player-returned-slots",false);
            if(!Guard(()=>{if(!(UiStack.Top is Sdt.UI.Screens.Menu.SlotPickerScreen))throw new InvalidOperationException("Base back did not return to slots.");ClickNamed("slot-archive-5");}))yield break;
            yield return Capture("player-slots-backup",false);
            if(!Guard(()=>ClickNamed("exportSlotArchive-5")))yield break;
            yield return Capture("player-slot-archive-export",false);
            string slotArchiveJson=App.Canvas.GetComponentsInChildren<InputField>().First(field=>field.name=="slotArchiveJson").text;
            if(!Guard(()=>{if(!App.Canvas.GetComponentsInChildren<InputField>().Any(field=>field.name=="slotArchiveJson"))throw new InvalidOperationException("Slot archive export field absent.");ClickNamed("slotArchiveBack");}))yield break;
            yield return null;yield return null;
            yield return new WaitForSecondsRealtime(.95f);
            if(!Guard(()=>{
                ClickNamed("importSlotArchive-5");var field=App.Canvas.GetComponentsInChildren<InputField>().First(item=>item.name=="slotArchiveJson");
                if(field.readOnly)throw new InvalidOperationException("Slot import field is read-only.");field.text=slotArchiveJson;
                _records.Add(new{kind="constructed-native-field-value",target="slotArchiveJson",source="exported isolated slot archive",osHardwareInput=false});
            }))yield break;
            yield return Capture("player-slot-archive-import",false);
            if(!Guard(()=>{ClickNamed("slotArchivePreview");if(EventSystem.current.currentSelectedGameObject?.name!="confirmation-cancel")throw new InvalidOperationException("Archive confirmation did not default to cancel.");}))yield break;
            yield return Capture("player-slot-archive-import-preview",false);
            if(!Guard(()=>ClickNamed("confirmation-accept")))yield break;
            yield return null;yield return null;yield return null;
            if(!Guard(()=>{if(!(UiStack.Top is Sdt.UI.Screens.Menu.SlotPickerScreen))throw new InvalidOperationException("Archive import did not return to slots.");}))yield break;
            if(!Guard(()=>ClickNamed("slotBack")))yield break;
            yield return new WaitForSecondsRealtime(1.5f);
            yield return Capture("player-returned-title",false);
            if(!Guard(()=>{if(!(UiStack.Top is Sdt.UI.Screens.Menu.TitleScreen)||UiStack.Count!=1||GameRuntime.I.State.Phase!="title")throw new InvalidOperationException("Slots back did not restore a unique title owner.");}))yield break;
            yield return ReviewRound7Hub();
            if (_failed) yield break;
            Guard(() => File.WriteAllText(Path.Combine(Output, "result.json"), SaveJson.Stringify(new {
                passed = true, scope = "Actual standalone backbuffer; hidden parent; normal CanvasScaler and ScreenSpaceOverlay; constructed page opens; no OS input",
                display = DisplayMetadata(), records = _records
            })));
            if (!_failed) Application.Quit(0);
        }
        IEnumerator Capture(string name, bool legacy)
        {
            // Capture real destinations after their source curtain, not a half-revealed page.
            float entryWait=Time.realtimeSinceStartup;
            bool filmFrame=name=="player-startup"||name.StartsWith("player-passage");
            while(!filmFrame&&CurrentRunFilm.Visible&&!_failed&&Time.realtimeSinceStartup-entryWait<20)yield return null;
            if(!filmFrame&&CurrentRunFilm.Visible){Fail(new TimeoutException("Entry curtain did not finish: "+name));yield break;}
            if(UiStack.Top is Sdt.UI.Screens.Menu.SlotPickerScreen)yield return new WaitForSecondsRealtime(.95f);
            // Commission also owns a short source arrival, independent of the shared curtain.
            var commission=UiStack.Top?.GetComponentInChildren<CurrentShopCommission>();
            var commissionScene=commission?.GetComponentInChildren<CurrentNodeScene>();
            var arrival=commissionScene?.GetComponent<CanvasGroup>();
            float arrivalWait=Time.realtimeSinceStartup;
            while(arrival!=null&&(arrival.alpha<.999f||((RectTransform)arrival.transform).anchoredPosition.sqrMagnitude>.01f)&&Time.realtimeSinceStartup-arrivalWait<3)yield return null;
            if(arrival!=null&&(arrival.alpha<.999f||((RectTransform)arrival.transform).anchoredPosition.sqrMagnitude>.01f)){Fail(new TimeoutException("Commission arrival did not settle: "+name));yield break;}
            if (!Guard(() => {
                InlineIconText.SetLegacyDensityForBackgroundReview(legacy);
                Debug.Log("[display-review] begin "+name+" legacy="+InlineIconText.LegacyDensityForBackgroundReview+" frame="+Time.frameCount);
                foreach (var text in App.Canvas.GetComponentsInChildren<Text>()) text.SetAllDirty();
                Canvas.ForceUpdateCanvases();
            })) yield break;
            for (int frame = 0; frame < 3; frame++) yield return null;
            yield return new WaitForEndOfFrame();
            string path = Path.Combine(Output, name + ".png");
            Debug.Log("[display-review] pixels "+name+" legacy="+InlineIconText.LegacyDensityForBackgroundReview+" frame="+Time.frameCount);
            // Read the completed native backbuffer directly: Windows suppresses the
            // CaptureScreenshot swap-chain request when the parent is invisible.
            // Keep the production overlay canvas, resolution and render target.
            if (!Guard(() => {
                if(RenderTexture.active!=null)throw new InvalidOperationException("Expected the actual screen backbuffer.");
                var pixels=new Texture2D(Screen.width,Screen.height,TextureFormat.RGB24,false);
                try{pixels.ReadPixels(new Rect(0,0,Screen.width,Screen.height),0,0,false);pixels.Apply(false,false);File.WriteAllBytes(path,pixels.EncodeToPNG());}
                finally{Destroy(pixels);}
            })) yield break;
            float began = Time.realtimeSinceStartup;
            while (!PngReady(path) && !_failed && Time.realtimeSinceStartup - began < 15) yield return null;
            if (!Guard(() => {
                if (!PngReady(path)) throw new TimeoutException("Actual player backbuffer capture did not finish: " + name);
                if(InlineIconText.LegacyDensityForBackgroundReview!=legacy)throw new InvalidOperationException("Raster review mode changed during capture: "+name);
                _records.Add(new { kind = "actual-player-capture", name, legacyGlyphDensity = legacy,
                    actualLegacyGlyphDensity=InlineIconText.LegacyDensityForBackgroundReview,
                    frame = Time.frameCount, display = DisplayMetadata(),film=FilmMetadata(), text = TextMetadata(), images = ImageMetadata() });
                File.WriteAllText(Path.Combine(Output, "trace.json"), SaveJson.Stringify(_records));
            })) yield break;
        }
        void NewPresentationFixture()
        {
            Clear();var g=GameRuntime.I;g.ResetSlot(5);g.NewRun(5,CharacterTable.All[0].id);
            for(int i=0;i<g.GetEntrySupplyCards().Count;i++)if(!g.ClaimEntrySupply(i,out var reason))throw new InvalidOperationException(reason);
            CurrentRunFilm.CancelActive();Clear();
        }
        void NewRecodeFixture()
        {
            NewPresentationFixture();var g=GameRuntime.I;g.State.layerIdx=0;
            g.State.trackPos=g.Map.Snapshot.layers[0].nodes.First(node=>node.type=="event").idx;g.State.Phase="modal";
            for(int i=0;i<2;i++)g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="display-recode-source-"+i,card=CardDatabase.All.First(card=>card.name=="冰刺").Clone()});
            g.CurrentNodeReceipt.eventCardId="ev19-recode";g.GetEventChoices("ev19-recode");g.ApplyCurrentEventChoice("ev19-recode:0");
            var selection=g.GetCurrentEventOutcome();if(selection?.Stage!="sources")throw new InvalidOperationException("Recode source selection absent.");
            g.SubmitEventSelection(selection.CardKeys.Take(selection.Need).ToList());
            for(int i=0;i<3&&g.GetCurrentEventOutcome().Stage=="dice";i++){g.RollCurrentEventDice();g.ApplyCurrentEventChoice("__dice_continue");}
            if(g.GetCurrentEventOutcome().Stage!="recodeConfirm")throw new InvalidOperationException("Recode frozen result absent.");
            EventDialogScreen.Open(CardLibrary.FindById("ev19-recode"),null);
        }
        void NewRewardReaderFixture()
        {
            NewPresentationFixture();var g=GameRuntime.I;g.State.layerIdx=0;g.State.trackPos=g.Map.Snapshot.layers[0].nodes.First(node=>node.type=="chest").idx;g.State.Phase="modal";
            ChestOpenScreen.Open(new List<string>{"small"},null);
            // The real chest commands own delivery. A fixed current card isolates reader
            // actions and capacity from the separately verified random generation.
            var receipt=g.CurrentNodeReceipt;var box=receipt.chestQueue[0];box.cardIds=new List<string>{"tt3-fireball"};box.claimMode="all";box.choiceCount=0;box.taken.Clear();box.lost.Clear();box.completed=false;receipt.chestIndex=0;receipt.completed=false;
            if(UiStack.Top is ChestOpenScreen)UiStack.Close(UiStack.Top);g.State.Phase="modal";g.SaveCurrent();ChestOpenScreen.OpenPending(null);
            _records.Add(new{kind="controlled-native-reward-fixture",card="tt3-fireball",delivery="formal current chest commands",randomEquivalence=false});
        }
        IEnumerator ExpandGuideMore()
        {
            var more=App.Canvas.GetComponentsInChildren<Button>().First(button=>button.name=="guideMore");
            var scroll=more.GetComponentInParent<ScrollRect>();
            bool visible=false;
            for(int step=0;step<24;step++)
            {
                Canvas.ForceUpdateCanvases();
                var point=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,more.transform.TransformPoint(((RectTransform)more.transform).rect.center));
                var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(new PointerEventData(EventSystem.current){position=point},hits);
                if(hits.Count>0&&ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject)==more.gameObject){visible=true;break;}
                if(!GuideWheel(scroll))yield break;
                yield return null;yield return null;
            }
            if(!visible){Fail(new InvalidOperationException("Guide more entry never became visible."));yield break;}
            if(!Guard(()=>ClickButton(more)))yield break;
            for(int frame=0;frame<4;frame++)yield return null;
            for(int step=0;step<24&&scroll.verticalNormalizedPosition>.005f;step++)
            {if(!GuideWheel(scroll))yield break;yield return null;yield return null;}
        }
        bool GuideWheel(ScrollRect scroll)
        {
            var center=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,scroll.viewport.TransformPoint(scroll.viewport.rect.center));
            var wheel=new PointerEventData(EventSystem.current){position=center,scrollDelta=new Vector2(0,-3)};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(wheel,hits);
            var receiver=hits.Count==0?null:ExecuteEvents.GetEventHandler<IScrollHandler>(hits[0].gameObject);
            if(receiver!=scroll.gameObject){Fail(new InvalidOperationException("Guide scroll wheel is blocked."));return false;}
            ExecuteEvents.Execute(receiver,wheel,ExecuteEvents.scrollHandler);
            _records.Add(new{kind="constructed-player-wheel",target=scroll.name,delta=-3});return true;
        }
        void ClickNamed(string name)
        {
            var button=App.Canvas.GetComponentsInChildren<Button>().First(item=>item.name==name&&item.isActiveAndEnabled&&item.IsInteractable());
            ClickButton(button);
        }
        void ClickButton(Button button)
        {
            string name=button.name;Canvas.ForceUpdateCanvases();
            var rect=(RectTransform)button.transform;
            var point=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,rect.TransformPoint(rect.rect.center));
            var input=new PointerEventData(EventSystem.current){position=point,button=PointerEventData.InputButton.Left};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(input,hits);
            var first=hits.FirstOrDefault().gameObject;
            var receiver=first==null?null:ExecuteEvents.GetEventHandler<IPointerClickHandler>(first);
            _records.Add(new{kind="constructed-player-click",name,point.x,point.y,first=first==null?null:first.name,receiver=receiver==null?null:receiver.name});
            if(receiver!=button.gameObject)throw new InvalidOperationException("Standalone button blocked: "+name);
            ExecuteEvents.Execute(receiver,input,ExecuteEvents.pointerClickHandler);
        }
        static void Clear() { while (UiStack.Count > 0) UiStack.Pop(); }
        static object FilmMetadata()
        {
            var film=CurrentRunFilm.Current;if(film==null)return null;
            return new{film.Kind,film.PlaybackProgress,film.IsRevealing,groups=film.GetComponentsInChildren<CanvasGroup>().Select(group=>new{group.name,group.alpha}).ToArray(),
                graphics=film.GetComponentsInChildren<Graphic>().Select(graphic=>new{graphic.name,bounds=Bounds(graphic.rectTransform),graphic.depth,cull=graphic.canvasRenderer.cull,inheritedAlpha=graphic.canvasRenderer.GetInheritedAlpha(),
                    colorAlpha=graphic.color.a,queue=graphic.materialForRendering.renderQueue,shader=graphic.materialForRendering.shader.name,canvas=graphic.canvas.name,mode=graphic.canvas.renderMode.ToString(),graphic.canvas.sortingOrder}).ToArray()};
        }
        static object DisplayMetadata()
        {
            var scaler = App.Canvas.GetComponent<CanvasScaler>();
            var bounds = ((RectTransform)App.Canvas.transform).rect;
            return new { screenWidth = Screen.width, screenHeight = Screen.height, Screen.dpi, fullScreenMode = Screen.fullScreenMode.ToString(),
                desktop = new { Screen.currentResolution.width, Screen.currentResolution.height },
                display = new { Display.main.renderingWidth, Display.main.renderingHeight, Display.main.systemWidth, Display.main.systemHeight },
                quality = QualitySettings.names[QualitySettings.GetQualityLevel()], Application.targetFrameRate,
                bufferWidthScale = ScalableBufferManager.widthScaleFactor, bufferHeightScale = ScalableBufferManager.heightScaleFactor,
                canvas = new { mode = App.Canvas.renderMode.ToString(), App.Canvas.scaleFactor, bounds.width, bounds.height,
                    lossyScale = Point(App.Canvas.transform.lossyScale), scaler = scaler.uiScaleMode.ToString(),
                    referenceWidth = scaler.referenceResolution.x, referenceHeight = scaler.referenceResolution.y, scaler.matchWidthOrHeight },
                windowsDpi = WindowsDpi(), graphics = SystemInfo.graphicsDeviceName, graphicsApi = SystemInfo.graphicsDeviceType.ToString(), Application.unityVersion, Application.buildGUID };
        }
        static object[] TextMetadata() => App.Canvas.GetComponentsInChildren<Text>().Select(text => {
            var inline = text as InlineIconText;
            var scroll=text.GetComponentInParent<ScrollRect>();
            float density = inline != null ? inline.GlyphPixelsPerUnit : text.pixelsPerUnit;
            var lines = text.cachedTextGenerator.lines;
            var characters = text.cachedTextGenerator.characters;
            return new { path = PathOf(text.transform), value = inline != null ? inline.RenderedText : text.text, sourceValue=inline!=null?inline.SourceText:text.text, legacy=InlineIconText.LegacyDensityForBackgroundReview,
                text.fontSize, text.lineSpacing, font = text.font != null ? text.font.name : null,
                importedFontSize=text.font!=null?text.font.fontSize:0,importedLineHeight=text.font!=null?text.font.lineHeight:0,
                fontNativeSize = text.font != null ? text.font.fontSize : 0, fontLineHeight = text.font != null ? text.font.lineHeight : 0,
                dynamicFont = text.font != null && text.font.dynamic, insideInputField = text.GetComponentInParent<InputField>() != null, text.pixelsPerUnit, glyphPixelsPerUnit = density,
                fontTexture = FontTexture(text.font), glyphSample = GlyphSample(text, density),
                transformDensity = inline != null ? inline.TransformGlyphDensity : 1, lossyScale = Point(text.transform.lossyScale),
                width = text.rectTransform.rect.width, height = text.rectTransform.rect.height,
                screenBounds = Bounds(text.rectTransform), viewportBounds=Bounds((RectTransform)text.transform.parent),layoutHostBounds=Bounds(scroll!=null?(RectTransform)scroll.transform:(RectTransform)text.transform.parent), lines = lines.Select(line => new { line.startCharIdx, line.height, line.topY,
                    logicalTop = line.topY / Math.Max(.0001f, density), logicalCursorY = line.startCharIdx < characters.Count ? (float?)(characters[line.startCharIdx].cursorPos.y / Math.Max(.0001f, density)) : null }).ToArray(),
                vertices = text.cachedTextGenerator.verts.Take(8).Select(v => new { x = v.position.x / Math.Max(.0001f,density), y = v.position.y / Math.Max(.0001f,density) }).ToArray() };
        }).Cast<object>().ToArray();
        static object[] ImageMetadata() => App.Canvas.GetComponentsInChildren<Image>().Where(image => image.sprite != null).Select(image => new {
            path = PathOf(image.transform), sprite = image.sprite.name, texture = image.sprite.texture.name,
            width = image.sprite.texture.width, height = image.sprite.texture.height,
            spriteWidth = image.sprite.rect.width, spriteHeight = image.sprite.rect.height,
            filter = image.sprite.texture.filterMode.ToString(), mipCount = image.sprite.texture.mipmapCount,
            screenBounds = Bounds(image.rectTransform)
        }).Cast<object>().ToArray();
        static object Bounds(RectTransform rect)
        {
            var points = new Vector3[4]; rect.GetWorldCorners(points);
            var screen = points.Select(point => RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera, point)).ToArray();
            return new { minX = screen.Min(p => p.x), minY = screen.Min(p => p.y), maxX = screen.Max(p => p.x), maxY = screen.Max(p => p.y) };
        }
        static object Point(Vector3 point) => new { point.x, point.y, point.z };
        static object FontTexture(Font font)
        {
            var texture = font != null && font.material != null ? font.material.mainTexture : null;
            return texture == null ? null : new { texture.name, texture.width, texture.height, filter = texture.filterMode.ToString() };
        }
        static object GlyphSample(Text text, float density)
        {
            string content = text is InlineIconText inline ? inline.RenderedText : text.text;
            char sample = content.FirstOrDefault(character => character >= '\u4e00' && character <= '\u9fff');
            if (sample == default) sample = content.FirstOrDefault(char.IsLetterOrDigit);
            int pixels = Mathf.RoundToInt(text.fontSize * density);
            bool found = text.font != null && text.font.GetCharacterInfo(sample, out var info, pixels, text.fontStyle);
            if (!found) return new { found = false, character = sample.ToString(), requestedPixels = pixels };
            // Read only: do not request/rebuild the font atlas while taking the sample.
            text.font.GetCharacterInfo(sample, out info, pixels, text.fontStyle);
            return new { found = true, character = sample.ToString(), requestedPixels = pixels, info.glyphWidth, info.glyphHeight, info.advance };
        }
        static bool PngReady(string path)
        {
            try
            {
                if (!File.Exists(path)) return false;
                using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    if (stream.Length < 24) return false;
                    stream.Position = stream.Length - 12;
                    var tail = new byte[12]; if (stream.Read(tail, 0, 12) != 12) return false;
                    return tail[4] == 73 && tail[5] == 69 && tail[6] == 78 && tail[7] == 68;
                }
            }
            catch (IOException) { return false; }
        }
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern bool IsWindow(IntPtr window);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern bool IsWindowVisible(IntPtr window);
        [System.Runtime.InteropServices.DllImport("shcore.dll")]
        static extern int GetProcessDpiAwareness(IntPtr process, out int awareness);
#endif
        static object WindowsDpi()
        {
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
            int awareness;
            int result = GetProcessDpiAwareness(System.Diagnostics.Process.GetCurrentProcess().Handle, out awareness);
            return new { available = result == 0, processAwareness = awareness, result };
#else
            return new { available = false, reason = "Windows standalone only" };
#endif
        }
        static string PathOf(Transform transform)
        { var parts = new List<string>(); for (var node = transform; node != null; node = node.parent) parts.Add(node.name); parts.Reverse(); return string.Join("/", parts); }
        void Fail(Exception error)
        {
            if (_failed) return; _failed = true;
            File.WriteAllText(Path.Combine(Output, "result.json"), SaveJson.Stringify(new { passed = false, error = error.ToString(), records = _records }));
            Application.Quit(2);
        }
    }
}
