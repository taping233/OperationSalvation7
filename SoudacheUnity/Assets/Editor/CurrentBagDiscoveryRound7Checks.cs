using System;
using System.Collections;
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

public static class CurrentBagDiscoveryRound7Checks
{
    public static int Assertions { get; private set; }
    static int _faults,_saves,_granted,_rejected;
    static GameRuntime G=>GameRuntime.I;
    static void Check(bool value,string text){Assertions++;if(!value)throw new InvalidOperationException("Bag discovery Round7: "+text);}
    static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
    static Button Button(Panel page,string name)=>page.GetComponentsInChildren<Button>(true).Single(b=>b.name==name);
    static int Selected(Panel page)=>(int)page.GetType().GetField("_selected",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(page);
    static void Inside(RectTransform child,RectTransform parent)
    {
        var corners=new Vector3[4];child.GetWorldCorners(corners);var bounds=parent.rect;
        Check(corners.All(corner=>{var point=parent.InverseTransformPoint(corner);return point.x>=bounds.xMin-.5f&&point.x<=bounds.xMax+.5f&&point.y>=bounds.yMin-.5f&&point.y<=bounds.yMax+.5f;}),child.name+" inside actual parent");
    }
    static void Submit(Button button)
    {
        Check(button!=null&&button.IsActive()&&button.IsInteractable(),"formal control available");
        EventSystem.current.SetSelectedGameObject(button.gameObject);
        Check(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"constructed EventSystem submit delivered");
    }
    static BagItemDiscoveryScreen Fixture(bool open=true)
    {
        Clear();G.ResetSlot(5);G.NewRun(5,"wu");Clear();
        G.State.entrySupply=null;G.State.ownedCards.Clear();G.State.inventory.Clear();G.State.usedPocket.Clear();G.State.Phase="idle";
        G.State.ownedCards.Add(new OwnedCard{uid="r7-bag-source",card=CardLibrary.FindById("tt4-shine-token").Clone()});
        G.SaveCurrent();Check(G.Saves.LastWriteSucceeded,"fixture checkpoint saved");BagScreen.Open();
        Check(UiStack.Top==BagScreen.Current,"formal backpack is source owner");
        if(!open)return null;
        BagCardDetail.UseOwnedCard("r7-bag-source");
        Check(UiStack.Top is BagItemDiscoveryScreen,"formal bag-use entry mounts discovery");
        return (BagItemDiscoveryScreen)UiStack.Top;
    }
    static string Cards=>SaveJson.Stringify(G.State.ownedCards);
    static long Sequence()=>(long)typeof(AudioService).GetField("_sequence",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(AudioService.I);
    static void StopAudio()=>typeof(AudioService).GetMethod("StopSfx",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(AudioService.I,null);
    static bool LastCue(string key)
    {
        var flags=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance;
        var cues=(IDictionary)typeof(AudioService).GetField("_currentCues",flags).GetValue(AudioService.I);
        var clips=(AudioClip[])cues[key].GetType().GetField("clips",flags).GetValue(cues[key]);
        foreach(var voice in (Array)typeof(AudioService).GetField("_voices",flags).GetValue(AudioService.I))
            if((long)voice.GetType().GetField("sequence",flags).GetValue(voice)==Sequence())return clips.Contains(((AudioSource)voice.GetType().GetField("source",flags).GetValue(voice)).clip);
        return false;
    }
    static BagCardDetail Detail(string uid="r7-bag-source")
    {
        BagCardDetail.Show(G.State.ownedCards.Single(entry=>entry.uid==uid).card.name,false,uid);
        Check(UiStack.Top is BagCardDetail,"current UID-owned detail entry opens");return (BagCardDetail)UiStack.Top;
    }
    static void DetailOwnership()
    {
        Fixture(false);var page=Detail();var oldUse=Button(page,"useDetailCard").onClick;var oldClose=Button(page,"inventoryZoomClose").onClick;
        var oldSafe=Button(page,"zoomMoveToSafe").onClick;var oldDiscard=Button(page,"detailDiscard").onClick;
        page.CloseFromEscape();BagScreen.Current.CloseBag();BagScreen.Open();var bag=BagScreen.Current;
        string cards=Cards,random=G.Rng.SaveState(),disk=File.ReadAllText(SaveSystem.ProfilePath);int saves=_saves,granted=_granted;StopAudio();long sequence=Sequence();
        oldUse.Invoke();oldClose.Invoke();oldSafe.Invoke();oldDiscard.Invoke();
        Check(UiStack.Top==bag&&Cards==cards&&G.Rng.SaveState()==random&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&_saves==saves&&_granted==granted&&Sequence()==sequence,"closed detail callbacks cannot target a new same-slot backpack, grant, save or sound");
        page=Detail();oldUse=Button(page,"useDetailCard").onClick;oldClose=Button(page,"inventoryZoomClose").onClick;
        var cover=UiStack.Show<SettingsScreen>("r7-detail-cover");CurrentRunFilm.CancelActive();StopAudio();sequence=Sequence();
        oldUse.Invoke();oldClose.Invoke();Check(UiStack.Top==cover&&Cards==cards&&Sequence()==sequence,"covered detail callbacks cannot consume or close the covering page");
        UiStack.Close(cover);oldUse.Invoke();oldClose.Invoke();
        Check(UiStack.Top==page&&Cards==cards&&Sequence()==sequence,"pre-cover detail events expire on return");
        Submit(Button(page,"useDetailCard"));Check(UiStack.Top is BagItemDiscoveryScreen&&G.State.ownedCards.Single().bagDiscover!=null,"current rebound detail still enters formal discovery");

        Fixture(false);page=Detail();oldUse=Button(page,"useDetailCard").onClick;oldClose=Button(page,"inventoryZoomClose").onClick;
        var replacement=SaveJson.Read<RunState>(SaveJson.Stringify(G.State));typeof(GameRuntime).GetProperty("State").SetValue(G,replacement);
        cards=Cards;random=G.Rng.SaveState();StopAudio();sequence=Sequence();saves=_saves;
        oldUse.Invoke();oldClose.Invoke();Check(UiStack.Top==page&&Cards==cards&&G.Rng.SaveState()==random&&_saves==saves&&Sequence()==sequence,"same UID in replacement State cannot be addressed by old detail events");
        page.CloseFromEscape();BagScreen.Current.CloseBag();BagScreen.Open();bag=BagScreen.Current;
        oldUse.Invoke();oldClose.Invoke();Check(UiStack.Top==bag&&Cards==cards&&_saves==saves&&Sequence()==sequence,"closed old detail cannot prepare replacement State's same-UID source");

        Fixture(false);var heal=CardLibrary.All().First(card=>card.type=="道具"&&card.id!="tt3-mystery-potion"
            &&card.rules?.Get("bag")?.Operations("use").Any(op=>op.Text("op")=="heal"&&(op.Text("amountField")=="heal"?card.heal.GetValueOrDefault():op.Number("amount"))>0)==true
            &&card.rules.Get("bag").Operations("use").All(op=>op.Text("op")=="heal"));
        G.State.ownedCards.Add(new OwnedCard{uid="r7-heal-source",card=heal.Clone()});G.State.hp=G.State.maxHp-5;BagScreen.Refresh();
        page=Detail("r7-heal-source");oldUse=Button(page,"useDetailCard").onClick;int hp=G.State.hp;
        var browse=page.GetComponentsInChildren<Button>().First(button=>(button.name=="inventoryZoomPrevious"||button.name=="inventoryZoomNext")&&button.IsInteractable());
        Submit(browse);var current=UiStack.Top;StopAudio();sequence=Sequence();cards=Cards;saves=_saves;
        oldUse.Invoke();Check(current is BagCardDetail&&current!=page&&UiStack.Top==current&&Cards==cards&&G.State.hp==hp&&_saves==saves&&Sequence()==sequence,"Browse creates a new detail; old non-discover use cannot consume its old UID");
        page.CloseFromEscape();Check(UiStack.Top==current,"old instance Escape cannot close a newer detail");

        Fixture(false);page=Detail();Submit(Button(page,"detailDiscard"));var confirm=(BagCardDetail)UiStack.Top;var discard=Button(confirm,"confirmDiscard");
        FailedWrite(()=>Submit(discard));Check(UiStack.Top==confirm&&discard.IsInteractable(),"current discard confirmation survives owned rollback");
        Submit(discard);Check(UiStack.Top==BagScreen.Current&&!G.State.ownedCards.Any(entry=>entry.uid=="r7-bag-source"),"current discard retry remains usable after narrow rebind");

        Fixture(false);G.State.ownedCards.Add(new OwnedCard{uid="r7-pearl",card=CardLibrary.FindById(CardContainerCommands.PearlId).Clone()});
        var resource=CardLibrary.All().First(card=>card.type=="资源").Clone();G.State.ownedCards.Add(new OwnedCard{uid="r7-container-resource",card=resource});
        G.SaveCurrent();Check(G.Saves.LastWriteSucceeded,"container inspection fixture checkpoint saved");BagScreen.Refresh();ContainerScreen.Open("pearl");
        var container=(ContainerScreen)UiStack.Top;Submit(Button(container,"pearlInspect-r7-container-resource"));
        Check(UiStack.Top is BagCardDetail&&G.State.ownedCards.Single(entry=>entry.uid=="r7-container-resource").stored==false,"container available-column inspection accepts its actual unstored source");
        Submit(Button((BagCardDetail)UiStack.Top,"inventoryZoomClose"));Check(UiStack.Top==container,"read-only detail returns to the same container owner");
    }
    static void FailedWrite(Action action)
    {
        string disk=File.ReadAllText(SaveSystem.ProfilePath),cards=Cards,rng=G.Rng.SaveState();
        Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
        try{action();Check(!G.Saves.LastWriteSucceeded&&Cards==cards&&G.Rng.SaveState()==rng&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"failed persistence restores inventory/RNG/disk");}
        finally{Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".r7-fault-"+(++_faults));}
    }
    public static IEnumerator Run()
    {
        Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
        bool counting=true;G.Bus.On<SaveCompleted>(_=>{if(counting)_saves++;});G.Bus.On<CardGranted>(message=>{if(counting){if(message.Rejected)_rejected++;else _granted++;}});
        bool muted=AudioService.I.Muted,sfx=AudioService.I.SfxMuted;
        try
        {
        AudioService.I.Mute(false);AudioService.I.SetSfxMuted(false);
        var page=Fixture();yield return null;
        var root=page.transform.GetChild(0);var first=Button(page,"bagDiscoverPick-0");var second=Button(page,"bagDiscoverPick-1");
        var face=first.transform.Find("card-art");var confirm=Button(page,"bagDiscoverConfirm");var cancel=Button(page,"bagDiscoverCancel");
        Canvas.ForceUpdateCanvases();Inside((RectTransform)root,(RectTransform)page.transform);
        foreach(string name in new[]{"bagDiscoverTitle","bagDiscoverNotice","bagDiscoverPick-0","bagDiscoverPick-1","bagDiscoverPick-2","bagDiscoverConfirm","bagDiscoverCancel"})
            Inside(page.GetComponentsInChildren<RectTransform>().Single(rect=>rect.name==name),(RectTransform)root);
        var ink=face.GetComponentsInChildren<Text>().Select(text=>text.color).ToArray();
        Check(!confirm.IsInteractable(),"unselected confirmation disabled");
        var oldPick=first.onClick;var oldConfirm=confirm.onClick;var oldCancel=cancel.onClick;
        string before=Cards,rng=G.Rng.SaveState(),disk=File.ReadAllText(SaveSystem.ProfilePath);int saves=_saves,granted=_granted,rejected=_rejected;
        StopAudio();long sequence=Sequence();Check(AudioService.I.IsSubpageOpen?.Invoke()==true,"formal audio policy recognizes the bag subpage");
        Submit(first);Check(Selected(page)==0&&EventSystem.current.currentSelectedGameObject==confirm.gameObject,"selecting stages a choice and focuses retained confirmation");
        Check(face.GetComponentsInChildren<Text>().Select(text=>text.color).SequenceEqual(ink),"selection patch preserves card-face ink colors");
        oldPick.Invoke();oldConfirm.Invoke();oldCancel.Invoke();
        Check(Selected(page)==0&&Cards==before&&G.Rng.SaveState()==rng&&UiStack.Top==page,"rebound old events cannot consume, retarget, cancel or draw");
        Submit(second);Check(Selected(page)==1&&page.transform.GetChild(0)==root&&Button(page,"bagDiscoverConfirm")==confirm&&Button(page,"bagDiscoverCancel")==cancel&&first.transform.Find("card-art")==face,"selection retains shell, controls and card face");
        Check(Cards==before&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&G.Rng.SaveState()==rng&&_saves==saves&&_granted==granted&&_rejected==rejected&&Sequence()==sequence,"selection is presentation only; formal subpage click stays suppressed");
        var coveredPick=first.onClick;var coveredConfirm=confirm.onClick;var coveredCancel=cancel.onClick;
        var cover=UiStack.Show<SettingsScreen>("r7-bag-cover");CurrentRunFilm.CancelActive();
        coveredPick.Invoke();coveredConfirm.Invoke();coveredCancel.Invoke();
        Check(UiStack.Top==cover&&Selected(page)==1&&Cards==before,"covered page events inert");
        UiStack.Close(cover);coveredPick.Invoke();coveredConfirm.Invoke();coveredCancel.Invoke();
        Check(UiStack.Top==page&&Selected(page)==1&&Cards==before&&G.Rng.SaveState()==rng&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&_saves==saves,"same-frame resumed page rejects old events without reroll or checkpoint");
        Check(first.transform.Find("card-art")==face&&Button(page,"bagDiscoverConfirm")==confirm,"resume retains identical candidate art and controls");
        var disabled=first.onClick;page.gameObject.SetActive(false);disabled.Invoke();
        Check(Selected(page)==1&&Cards==before,"disabled owner rejects captured event");
        page.gameObject.SetActive(true);disabled.Invoke();
        Check(Selected(page)==1&&first.transform.Find("card-art")==face,"reenabling keeps art and rejects pre-disable event");
        StopAudio();sequence=Sequence();FailedWrite(()=>Submit(confirm));
        Check(_granted==granted&&_rejected==rejected&&Sequence()==sequence,"failed claim emits neither CardGranted nor success audio");
        Check(UiStack.Top==page&&Selected(page)==1&&confirm.IsInteractable()&&first.transform.Find("card-art")==face,"failed claim narrowly rebinds rollback source/Map and retains selected UI");
        var ids=G.State.ownedCards.Single().bagDiscover.cardIds.ToArray();
        StopAudio();sequence=Sequence();Submit(confirm);Check(UiStack.Top==BagScreen.Current&&G.State.ownedCards.Count==1&&G.State.ownedCards[0].uid!="r7-bag-source"&&G.State.ownedCards[0].card.id==ids[1]&&_saves==saves+1,"current retry checkpoints once, consumes once and grants exactly saved selected candidate");
        Check(_granted==granted+1&&_rejected==rejected&&Sequence()==sequence+1&&LastCue("ding"),"current success emits one CardGranted and exactly one actual ding voice/clip");
        before=Cards;rng=G.Rng.SaveState();sequence=Sequence();oldPick.Invoke();coveredConfirm.Invoke();
        Check(Cards==before&&G.Rng.SaveState()==rng&&UiStack.Top==BagScreen.Current&&_granted==granted+1&&Sequence()==sequence,"closed page events cannot replay reward or success sound");

        page=Fixture();before=Cards;rng=G.Rng.SaveState();disk=File.ReadAllText(SaveSystem.ProfilePath);saves=_saves;
        var expired=Button(page,"bagDiscoverPick-0").onClick;var expiredCancel=Button(page,"bagDiscoverCancel").onClick;
        page.CloseFromEscape();expired.Invoke();expiredCancel.Invoke();
        Check(UiStack.Top==BagScreen.Current&&Cards==before&&G.Rng.SaveState()==rng&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"Escape preserves candidate receipt, source and disk; same-frame old events inert");
        BagCardDetail.UseOwnedCard("r7-bag-source");var reopened=(BagItemDiscoveryScreen)UiStack.Top;
        Check(G.Rng.SaveState()==rng&&Cards==before&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&_saves==saves,"cancel/reopen uses saved receipt read-only without save notification");
        expired.Invoke();expiredCancel.Invoke();Check(UiStack.Top==reopened&&Selected(reopened)==-1,"closed callbacks cannot act on replacement page");

        page=Fixture();var pendingIds=G.State.ownedCards.Single().bagDiscover.cardIds;
        var fillers=CardLibrary.All().Where(c=>!pendingIds.Contains(c.id)&&!BaseData.IsSha(c)&&(c.type=="法术"||c.type=="武术")).Take(G.Base.BagCap+1).ToArray();
        Check(fillers.Length==G.Base.BagCap+1,"full-bag fixture has distinct actual nonresource definitions");
        for(int i=0;i<fillers.Length;i++)G.State.ownedCards.Add(new OwnedCard{uid="r7-full-"+i,card=fillers[i].Clone()});
        G.SaveCurrent();before=Cards;rng=G.Rng.SaveState();Submit(Button(page,"bagDiscoverPick-0"));Submit(Button(page,"bagDiscoverConfirm"));
        Check(UiStack.Top==page&&Cards==before&&G.Rng.SaveState()==rng&&Selected(page)==0,"full-bag rejection preserves source, receipt, choice and RNG");
        Check(Button(page,"bagDiscoverConfirm").IsInteractable(),"capacity rollback permits current retry");
        Submit(Button(page,"bagDiscoverCancel"));Check(UiStack.Top==BagScreen.Current,"full-bag discovery can return for inventory organization");

        foreach(string change in new[]{"slot","state","node","source","receipt"})
        {
            page=Fixture();var pick=Button(page,"bagDiscoverPick-0").onClick;var back=Button(page,"bagDiscoverCancel").onClick;
            var originalRun=G.State;int? originalSlot=G.ActiveSlot;int originalPosition=G.State.trackPos;
            if(change=="slot")typeof(GameRuntime).GetProperty("ActiveSlot").SetValue(G,4);
            else if(change=="state")typeof(GameRuntime).GetProperty("State").SetValue(G,SaveJson.Read<RunState>(SaveJson.Stringify(G.State)));
            else if(change=="node")G.State.trackPos=G.Map.Nodes.First(n=>n.layerIdx==G.State.layerIdx&&n.idx!=G.State.trackPos).idx;
            else if(change=="source")G.State.ownedCards[0]=SaveJson.Read<OwnedCard>(SaveJson.Stringify(G.State.ownedCards[0]));
            else G.State.ownedCards[0].bagDiscover.cardIds.Reverse();
            before=Cards;rng=G.Rng.SaveState();pick.Invoke();back.Invoke();
            Check(Selected(page)==-1&&Cards==before&&G.Rng.SaveState()==rng&&UiStack.Top==page,"stale "+change+" rejects reward/selection and cancellation");
            typeof(GameRuntime).GetProperty("ActiveSlot").SetValue(G,originalSlot);typeof(GameRuntime).GetProperty("State").SetValue(G,originalRun);originalRun.trackPos=originalPosition;
        }

        Fixture(false);FailedWrite(()=>BagCardDetail.UseOwnedCard("r7-bag-source"));
        page=(BagItemDiscoveryScreen)UiStack.Top;var retry=Button(page,"bagDiscoverRetry");
        Check(retry.IsInteractable()&&G.State.ownedCards.Single().bagDiscover==null,"first reservation failure keeps source and retry control");
        Submit(retry);Check(Button(page,"bagDiscoverConfirm")==retry&&G.State.ownedCards.Single().bagDiscover.cardIds.Count==3,"retry prepares once on same retained control");
        var raw=File.ReadAllText(SaveSystem.ProfilePath);Check(new SaveSystem().ReadSlot(5).ownedCards.Single().bagDiscover.cardIds.SequenceEqual(G.State.ownedCards.Single().bagDiscover.cardIds),"independent profile read contains new candidate receipt");
        Check(File.ReadAllText(SaveSystem.ProfilePath)==raw,"independent read is nonmutating");Clear();yield return null;
        page=Fixture();Submit(Button(page,"bagDiscoverPick-0"));bool coverOnSave=true;Panel savedCover=null;
        G.Bus.On<SaveCompleted>(_=>{if(coverOnSave){coverOnSave=false;savedCover=UiStack.Show<SettingsScreen>("r7-post-save-cover");CurrentRunFilm.CancelActive();}});
        var submitted=Button(page,"bagDiscoverConfirm").onClick;Submit(Button(page,"bagDiscoverConfirm"));
        Check(savedCover!=null&&UiStack.Top==savedCover&&G.State.ownedCards.All(entry=>entry.uid!="r7-bag-source"),"save observer's new page is not closed after successful domain claim");
        before=Cards;rng=G.Rng.SaveState();submitted.Invoke();Check(UiStack.Top==savedCover&&Cards==before&&G.Rng.SaveState()==rng,"post-save covered old confirmation cannot replay");
        DetailOwnership();
        }
        finally{counting=false;Clear();AudioService.I.SetSfxMuted(sfx);AudioService.I.Mute(muted);}
    }
}
