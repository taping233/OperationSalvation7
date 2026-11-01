using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;

static class Program
{
    static GameRuntime game;
    static int checks,saves,sourceReads,faults;
    static IReadOnlyList<CardDef> catalog;
    static void Check(bool condition,string message){checks++;if(!condition)throw new InvalidOperationException(message);}
    static OwnedCard Source=>game.State.ownedCards.Single(entry=>entry.uid=="round6-source");
    static string Disk=>File.ReadAllText(SaveSystem.ProfilePath);
    static string State=>SaveJson.Stringify(game.State);
    static void Start(string sourceId="tt4-shine-token")
    {
        catalog=CardDatabase.All;CardLibrary.Init(()=>{sourceReads++;return catalog;});CardLibrary.ClearCustoms();
        game.ResetSlot(1);game.NewRun(1,"wu");
        game.State.entrySupply=null;game.State.ownedCards.Clear();game.State.inventory.Clear();game.State.usedPocket.Clear();
        // Use real item rules; current definitions explicitly remove the original
        // legendary pool so only the controlled live overrides below qualify.
        catalog=CardDatabase.All.Select(card=>{var copy=card.Clone();if(copy.rarity=="传说")copy.unrandom=true;return copy;}).ToArray();
        CardLibrary.Init(()=>{sourceReads++;return catalog;});
        game.State.ownedCards.Add(new OwnedCard{uid="round6-source",card=CardLibrary.FindById(sourceId).Clone()});
        game.State.Phase="modal";saves=sourceReads=0;
    }
    static List<CardDef> Legends()
    {
        var originals=CardDatabase.All.Where(card=>card.rarity=="传说"&&CardLibrary.IsRandomObtainable(card)&&card.id!="tt4-shine-token").Take(2).ToArray();
        var current=originals[0].Clone();current.name="当前覆盖的传说";current.unrandom=false;CardLibrary.Upsert(current);
        var excluded=originals[1].Clone();excluded.rarity="稀有";excluded.unrandom=false;CardLibrary.Upsert(excluded);
        CardLibrary.Upsert(new CardDef{id="round6-legend-a",name="自定义传说甲",type="法术",rarity="传说"});
        CardLibrary.Upsert(new CardDef{id="round6-legend-b",name="自定义传说乙",type="装备",rarity="传说"});
        return CardLibrary.All().Where(card=>card.rarity=="传说"&&CardLibrary.IsRandomObtainable(card)).ToList();
    }
    static List<CardDef> Abilities()
    {
        var original=CardDatabase.All.First(card=>card.type=="能力卡"&&card.cls==game.State.myClass);
        catalog=catalog.Select(card=>{var copy=card.Clone();if(copy.type=="能力卡")copy.cls="其它职业";return copy;}).ToArray();
        var current=original.Clone();current.name="当前覆盖的本职能力";CardLibrary.Upsert(current);
        CardLibrary.Upsert(new CardDef{id="round6-ability",name="自定义本职能力",type="能力卡",rarity="职业",cls=game.State.myClass,unrandom=true});
        return CardLibrary.All().Where(card=>card.cls==game.State.myClass&&card.type=="能力卡").ToList();
    }
    static List<string> Draw(List<CardDef> source,Rng rng)
    {
        var pool=source.ToList();var ids=new List<string>();
        while(pool.Count>0&&ids.Count<3){int index=(int)(rng.Random("loot","reward")*pool.Count);ids.Add(pool[index].id);pool.RemoveAt(index);}
        return ids;
    }
    static Rng Reference(){var rng=new Rng(1);rng.LoadState(game.Rng.SaveState());return rng;}
    static void BlockWrite(Func<bool> command,string label)
    {
        string state=State,rng=game.Rng.SaveState(),disk=Disk;saves=0;
        Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
        try
        {
            Check(!command(),label+" rejects failed persistence");
            Check(State==state&&game.Rng.SaveState()==rng&&Disk==disk,label+" restores complete state/RNG and leaves disk intact");
            Check(saves==0&&!game.Saves.InTransaction,label+" closes transaction without SaveCompleted");
        }
        finally{Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+(++faults));}
    }
    static void SavedDiscovery()
    {
        Start();var pool=Legends();Check(pool.Count==3,"current overrides leave exactly three eligible legendary definitions");
        var reference=Reference();var expected=Draw(pool,reference);saves=sourceReads=0;
        Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out var cards,out _),"first discovery reserves current candidates");
        Check(cards.Select(card=>card.id).SequenceEqual(expected)&&cards.Any(card=>card.id=="round6-legend-a")&&cards.Any(card=>card.name=="当前覆盖的传说"),"live new and same-ID definitions determine candidate order and faces");
        Check(game.Rng.SaveState()==reference.SaveState(),"first discovery preserves source without-replacement RNG order");
        Check(saves==1&&sourceReads==1,"first discovery reads the merged catalog once and checkpoints once");
        Check(new SaveSystem().ReadSlot(1).ownedCards.Single().bagDiscover.cardIds.SequenceEqual(expected),"independent profile read contains the saved pending candidates");
        string disk=Disk,rng=game.Rng.SaveState(),state=State;var receipt=Source.bagDiscover;saves=sourceReads=0;
        using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.ReadWrite,FileShare.None))
            Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out cards,out _)&&cards.Select(card=>card.id).SequenceEqual(expected),"reopening an already saved choice succeeds with the profile file locked");
        Check(saves==0&&sourceReads==1&&ReferenceEquals(receipt,Source.bagDiscover)&&State==state&&game.Rng.SaveState()==rng&&Disk==disk,"reopen performs one pool projection and no transaction, mutation, random draw or write");
        var archive=JObject.Parse(game.Saves.ExportSlotArchive(1));
        Check(archive["values"]["cards"].Select(card=>(string)card["id"]).SequenceEqual(pool.Select(card=>card.id)),"archive closes pending custom discovery definitions in global source order");
        game.ShowTitle();Check(game.LoadRun(1),"saved discovery resumes through formal title/load");
        saves=0;rng=game.Rng.SaveState();disk=Disk;
        Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out cards,out _)&&cards.Select(card=>card.id).SequenceEqual(expected)&&saves==0&&game.Rng.SaveState()==rng&&Disk==disk,"loaded pending choice remains read-only and does not reroll");
    }
    static void DiscoveryFailureAndClaim()
    {
        Start();var pool=Legends();game.SaveCurrent();var reference=Reference();var expected=Draw(pool,reference);
        List<CardDef> candidates=null;
        BlockWrite(()=>BagItemCommands.TryPrepareDiscovery(game,Source.uid,out candidates,out _),"first discovery");
        Check(candidates==null&&Source.bagDiscover==null,"failed first save exposes no unsaved candidate receipt");
        saves=0;Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out candidates,out _)&&candidates.Select(card=>card.id).SequenceEqual(expected)&&game.Rng.SaveState()==reference.SaveState()&&saves==1,"first-save retry recovers the exact initial RNG result once");
        string chosen=candidates[0].id;
        for(int i=0;i<game.Base.BagCap;i++)game.State.ownedCards.Add(new OwnedCard{uid="full-"+i,card=new CardDef{id="full-"+i,name="占位装备"+i,type="装备",rarity="稀有"}});
        game.SaveCurrent();string state=State,rng=game.Rng.SaveState(),disk=Disk;saves=0;
        Check(!BagItemCommands.TryChooseDiscovery(game,Source.uid,chosen,out _)&&State==state&&game.Rng.SaveState()==rng&&Disk==disk&&saves==0,"failed replacement capacity retains source, receipt and RNG");
        game.State.ownedCards.RemoveAt(game.State.ownedCards.Count-1);game.SaveCurrent();
        BlockWrite(()=>BagItemCommands.TryChooseDiscovery(game,Source.uid,chosen,out _),"discovery claim");
        saves=0;Check(BagItemCommands.TryChooseDiscovery(game,Source.uid,chosen,out _)&&saves==1&&!game.State.ownedCards.Any(entry=>entry.uid=="round6-source")&&game.State.ownedCards.Count(entry=>entry.card.id==chosen)==1,"successful claim replaces only the physical source UID with one current-definition card");
        var received=game.State.ownedCards.Single(entry=>entry.card.id==chosen);Check(received.card.name==pool.Single(card=>card.id==chosen).name,"claim uses the same qualified current definition as its candidate");
        state=State;rng=game.Rng.SaveState();disk=Disk;
        Check(!BagItemCommands.TryChooseDiscovery(game,"round6-source",chosen,out _)&&State==state&&game.Rng.SaveState()==rng&&Disk==disk&&saves==1,"replayed claim grants no extra UID, consumes no RNG and emits no save");
    }
    static void InvalidReceipts()
    {
        foreach(string invalid in new[]{"version","duplicates","null","missing","kind"})
        {
            Start();var pool=Legends();Source.bagDiscover=new BagDiscoveryReceipt{cardIds=pool.Select(card=>card.id).ToList()};
            string valid=pool[0].id;
            if(invalid=="version")Source.bagDiscover.version=2;
            else if(invalid=="duplicates")Source.bagDiscover.cardIds[1]=valid;
            else if(invalid=="null")Source.bagDiscover.cardIds=null;
            else if(invalid=="missing")Source.bagDiscover.cardIds[1]="round6-missing";
            else Source.bagDiscover.poolKind="classAbility";
            game.SaveCurrent();string state=State,rng=game.Rng.SaveState(),disk=Disk;saves=0;
            Check(!BagItemCommands.TryPrepareDiscovery(game,Source.uid,out var cards,out _)&&cards==null&&State==state&&game.Rng.SaveState()==rng&&Disk==disk&&saves==0,"invalid "+invalid+" receipt is retained without reroll or write");
            Check(!BagItemCommands.TryChooseDiscovery(game,Source.uid,valid,out _)&&State==state&&game.Rng.SaveState()==rng&&Disk==disk&&saves==0,"invalid "+invalid+" receipt cannot be partially redeemed");
        }
        Start();var candidates=Legends();BagItemCommands.TryPrepareDiscovery(game,Source.uid,out _,out _);
        var changed=candidates[0].Clone();changed.unrandom=true;CardLibrary.Upsert(changed);
        string before=State,random=game.Rng.SaveState(),saved=Disk;saves=0;
        Check(!BagItemCommands.TryPrepareDiscovery(game,Source.uid,out _,out _)&&State==before&&game.Rng.SaveState()==random&&Disk==saved&&saves==0,"candidate that no longer qualifies blocks reopen without replacing its receipt");
        Check(!BagItemCommands.TryChooseDiscovery(game,Source.uid,candidates[1].id,out _)&&State==before&&game.Rng.SaveState()==random&&Disk==saved&&saves==0,"claim rechecks complete current-pool eligibility");
        CardLibrary.Upsert(candidates[0]);var ids=Source.bagDiscover.cardIds.ToArray();saves=0;
        Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out var reopened,out _)&&reopened.Select(card=>card.id).SequenceEqual(ids)&&game.Rng.SaveState()==random&&saves==0,"restoring the definition reuses the original candidates without drawing");
    }
    static void AcquireAndClassDiscovery()
    {
        foreach(string kind in new[]{"legendary","classAbility"})
        {
            Start(kind=="legendary"?"tt-token-gold":"cmtmvq6ss84l");var pool=kind=="legendary"?Legends():Abilities();
            var reference=Reference();var expected=pool[(int)(reference.Random("loot","reward")*pool.Count)];reference.Random("identity");reference.Random("identity");
            saves=0;Check(BagItemCommands.TryUse(game,Source.uid,out _)&&game.State.ownedCards.Single().card.id==expected.id&&game.State.ownedCards.Single().card.name==expected.name&&saves==1,"acquire "+kind+" draws and grants the current qualified definition once");
            Check(game.Rng.SaveState()==reference.SaveState(),"acquire "+kind+" retains reward then physical UID RNG consumption");
        }
        Start();var abilities=Abilities();Source.card.rules=RuleValue.Obj("version",1,"bag",RuleValue.Obj("use",RuleValue.Arr(RuleValue.Obj("op","discover","pool",RuleValue.Obj("kind","classAbility")))));
        var rng=Reference();var expectedIds=Draw(abilities,rng);saves=0;
        Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out var cards,out _)&&cards.Select(card=>card.id).SequenceEqual(expectedIds)&&cards.Any(card=>card.id=="round6-ability")&&cards.All(card=>card.cls==game.State.myClass)&&saves==1,"structured class discovery includes live custom and override abilities while excluding other classes");
        Check(game.Rng.SaveState()==rng.SaveState(),"class discovery preserves eligible source order and RNG draws");
    }
    static void Pickup()
    {
        Start();game.State.ownedCards.Clear();var receipt=game.CurrentNodeReceipt;receipt.type="coin";receipt.pickupPrepared=true;receipt.coins=3;
        game.SaveCurrent();string node=game.CurrentNodeId;int before=game.State.coins;saves=0;
        Check(game.TryClaimCurrentPickup(node,out _)&&saves==1&&game.State.coins==before+3,"pickup claim grants and persists exactly once");
        string disk=Disk,rng=game.Rng.SaveState();int coins=game.State.coins;var record=new SaveSystem().ReadSlot(1).nodeRewards[node];
        Check(record.pickupSaved&&record.pickupClaimed&&record.completed,"pickup's first checkpoint durably records the completed grant");
        using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.ReadWrite,FileShare.None))
            Check(game.TryLeaveCurrentPickup(node,out _),"already saved pickup returns to map with profile file locked");
        Check(game.State.Phase=="idle"&&saves==1&&game.State.coins==coins&&game.Rng.SaveState()==rng&&Disk==disk,"saved leave changes only runtime phase without a second write or SaveCompleted");
        Check(game.TryLeaveCurrentPickup(node,out _)&&game.TryClaimCurrentPickup(node,out _)&&saves==1&&game.State.coins==coins&&game.Rng.SaveState()==rng&&Disk==disk,"replayed saved pickup neither pays again nor writes");
        game.ShowTitle();Check(game.LoadRun(1)&&game.State.Phase=="idle"&&game.CurrentNodeReceipt.pickupSaved&&game.State.coins==coins,"formal load resumes saved pickup idle without phase persistence");
        game.Saves.ReportReadError("round6 later slot read failure",1);game.State.Phase="modal";disk=Disk;saves=0;
        Check(game.TryLeaveCurrentPickup(node,out _)&&game.State.Phase=="idle"&&game.Saves.HasSlotReadError(1)&&Disk==disk&&saves==0,"read-only return from a previously saved pickup does not require another writable checkpoint or clear read errors");

        Start();game.State.ownedCards.Clear();receipt=game.CurrentNodeReceipt;receipt.type="coin";receipt.pickupPrepared=true;receipt.coins=3;game.SaveCurrent();node=game.CurrentNodeId;before=game.State.coins;disk=Disk;rng=game.Rng.SaveState();saves=0;
        Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
        try
        {
            Check(!game.TryClaimCurrentPickup(node,out _),"pickup claim reports failed checkpoint");
            coins=game.State.coins;
            Check(coins==before+3&&game.CurrentNodeReceipt.pickupClaimed&&!game.CurrentNodeReceipt.pickupSaved&&game.CurrentNodeReceipt.completed&&game.State.settled.Contains(node)&&Disk==disk&&game.Rng.SaveState()==rng&&saves==0,"failed pickup save retains its already applied coins/receipt while preserving disk and RNG");
            Check(!game.TryLeaveCurrentPickup(node,out _)&&game.State.Phase=="modal"&&game.State.coins==coins&&Disk==disk&&saves==0,"unsaved claimed pickup retries persistence and cannot leave early");
        }
        finally{Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+(++faults));}
        Check(game.TryLeaveCurrentPickup(node,out _)&&game.State.Phase=="idle"&&game.State.coins==coins&&saves==1&&game.CurrentNodeReceipt.pickupSaved,"pickup retry checkpoints the existing grant once and then returns read-only");
        Start();game.State.ownedCards.Clear();receipt=game.CurrentNodeReceipt;receipt.type="coin";receipt.pickupPrepared=true;receipt.coins=3;game.SaveCurrent();node=game.CurrentNodeId;before=game.State.coins;game.Rng.Random("gameplay");rng=game.Rng.SaveState();saves=0;
        Check(game.TryLeaveCurrentPickup(node,out _)&&saves==1&&!game.CurrentNodeReceipt.pickupClaimed&&game.State.coins==before,"unclaimed exit retains its original checkpoint and does not grant coins");
        var loaded=new SaveSystem().ReadSlot(1);Check((string)loaded.rngState==rng&&!loaded.nodeRewards[node].pickupClaimed,"unclaimed exit persists the scene-copy gameplay RNG for continuation");
        Check(!game.TryLeaveCurrentPickup("other-node",out _)&&saves==1,"expired node cannot close a current pickup");
    }
    static string Sign(JObject body)
    {
        body.Remove("checksum");
        using(var hash=SHA256.Create())body["checksum"]=BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(body.ToString(Newtonsoft.Json.Formatting.None)))).Replace("-","").ToLowerInvariant();
        return body.ToString(Newtonsoft.Json.Formatting.None);
    }
    static void DiscoveryArchive()
    {
        Start();var target=new CardDef{id="round6-archive-target",name="备份中的自定义传说",type="法术",rarity="传说",cost=1,dmg=3,dmgType="fixed",
            rules=RuleValue.Obj("version",1,"battle",RuleValue.Obj("target",RuleValue.Obj("side","enemy","area",false)),"triggers",RuleValue.Obj("onPlay",RuleValue.Arr(RuleValue.Obj("op","damage","amountField","dmg","target","chosenEnemy"))))};
        CardLibrary.Upsert(target);CardLibrary.Upsert(new CardDef{id="round6-unrelated",name="不应随档导出的定义",type="资源",rarity="稀有",unrandom=true});
        Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out var cards,out _)&&cards.Count==1&&cards[0].id==target.id,"real employee pass C prepares one legitimate current custom legendary candidate");
        string archive=game.Saves.ExportSlotArchive(1);var body=JObject.Parse(archive);
        Check(body["values"]["cards"].Count()==1&&JToken.DeepEquals(body["values"]["cards"][0],SaveJson.Token(target)),"pending bag discovery carries only its exact required custom definition");
        CardLibrary.Remove(target.id);game.Saves.Global.SetString("round6-archive-sentinel","preserve");
        string disk=Disk,random=game.Rng.SaveState(),sourceRun=SaveJson.Stringify(game.Saves.ReadSlot(1));bool rejected=false;
        try{game.Saves.ExportSlotArchive(1);}catch(InvalidDataException){rejected=true;}
        Check(rejected&&Disk==disk&&game.Rng.SaveState()==random,"export rejects deleted pending bag candidate definitions without changing profile or RNG");
        var preview=game.Saves.PreviewSlotArchive(archive,2);
        Check(preview.AddedCustomCards==1&&Disk==disk&&game.Rng.SaveState()==random,"complete archive previews in a target profile missing the candidate definition without writes");
        body["values"]["cards"]=new JArray();rejected=false;
        try{game.Saves.PreviewSlotArchive(Sign(body),2);}catch(InvalidDataException){rejected=true;}
        Check(rejected&&Disk==disk&&game.Rng.SaveState()==random,"correctly re-signed archive missing its pending definition is rejected before import");
        Check(game.Saves.ImportSlotArchive(preview,true,out _)&&CardLibrary.FindById(target.id)?.name==target.name,"complete archive imports its missing candidate definition with the slot");
        Check(game.Saves.Global.GetString("round6-archive-sentinel")=="preserve"&&SaveJson.Stringify(game.Saves.ReadSlot(1))==sourceRun&&SaveSystem.LoadCustomCards(game.Saves).Count==2,"import preserves unrelated globals, source slot and unrelated target definitions");
        Check(game.LoadRun(2)&&game.Rng.SaveState()==random&&Source.bagDiscover.cardIds.SequenceEqual(new[]{target.id}),"formal imported-slot load retains its original pending candidate and RNG");
        saves=0;disk=Disk;
        Check(BagItemCommands.TryPrepareDiscovery(game,Source.uid,out cards,out _)&&cards.Single().id==target.id&&saves==0&&Disk==disk&&game.Rng.SaveState()==random,"imported candidate opens read-only without rerolling");
        var reference=Reference();reference.Random("identity");reference.Random("identity");
        Check(BagItemCommands.TryChooseDiscovery(game,Source.uid,target.id,out _)&&game.State.ownedCards.Single().card.id==target.id&&game.Rng.SaveState()==reference.SaveState()&&saves==1,"imported candidate redeems the saved definition once using only physical UID RNG");
        var received=game.State.ownedCards.Single();
        Check(new SaveSystem().ReadSlot(2).ownedCards.Single().uid==received.uid&&received.uid!="round6-source","independent imported-slot read contains exactly the redeemed new physical UID");
    }
    static List<CardDef> EventCatalog(bool includeOverride,bool includeNew)
    {
        Start();game.State.ownedCards.Clear();
        catalog=catalog.Select(card=>{var copy=card.Clone();if(copy.type=="事件")copy.type="资源";return copy;}).ToArray();
        if(includeOverride)
        {
            var card=CardDatabase.All.First(item=>item.type=="事件").Clone();card.name="当前覆盖的事件名";card.desc="当前覆盖的事件描述";CardLibrary.Upsert(card);
        }
        if(includeNew)CardLibrary.Upsert(new CardDef{id="round6-event",name="当前新增事件",desc="新增事件描述",type="事件",rarity="普通"});
        var node=game.Map.Nodes.First(item=>item.type=="event");game.EnterLayer(node.layerIdx,node.idx,false);
        return CardLibrary.All().Where(card=>card.type=="事件").ToList();
    }
    static void Events()
    {
        foreach(bool isOverride in new[]{false,true})
        {
            var expected=EventCatalog(isOverride,!isOverride).Single();var reference=Reference();reference.NextDouble();
            var first=game.ResolveCell();
            Check(first.Kind==NodeKind.Event&&first.Instant.EventCard.id==expected.id&&first.Instant.EventCard.name==expected.name&&first.Instant.EventCard.desc==expected.desc,"first event uses the current "+(isOverride?"same-ID override":"new custom")+" definition");
            Check(game.Rng.SaveState()==reference.SaveState(),"event selection keeps one gameplay draw in source order");
            var saved=new SaveSystem().ReadSlot(1);string node=game.CurrentNodeId,random=game.Rng.SaveState();
            Check(saved.nodeRewards[node].eventCardId==expected.id&&saved.eventLog.Single().name==expected.name&&saved.eventLog.Single().desc==expected.desc,"event checkpoint binds and logs the exact current definition");
            game.ShowTitle();Check(game.LoadRun(1),"current event checkpoint resumes through formal LoadRun");
            var resumed=game.ResolveCell();
            Check(resumed.Instant.EventCard.id==expected.id&&resumed.Instant.EventCard.name==expected.name&&resumed.Instant.EventCard.desc==expected.desc&&game.Rng.SaveState()==random&&game.State.eventLog.Count==1,"bound event resumes with matching current name/description and no reroll or duplicate log");
        }
        foreach(string history in new[]{"receipt-id","log-id","log-name"})
        {
            var pool=EventCatalog(true,true);var excluded=pool[0];var expected=pool[1];
            if(history=="receipt-id")
            {
                var previous=game.Map.Nodes.First(node=>node.type=="event"&&node.id!=game.CurrentNodeId);
                game.State.nodeRewards[previous.id]=new NodeVisitReceipt{type="event",eventCardId=excluded.id,completed=true};
            }
            else game.State.eventLog.Add(new EventLogEntry{id=history=="log-id"?excluded.id:"historical-id",name=history=="log-name"?excluded.name:"历史旧名",turn=1});
            var reference=Reference();reference.NextDouble();var chosen=game.ResolveCell();
            Check(chosen.Instant.EventCard.id==expected.id,"event history "+history+" excludes the current matching definition");
            Check(game.Rng.SaveState()==reference.SaveState(),"history filtering preserves a single remaining-pool gameplay draw");
            var next=game.Map.Nodes.First(node=>node.type=="event"&&node.id!=game.CurrentNodeId&&!game.State.nodeRewards.ContainsKey(node.id));
            game.EnterLayer(next.layerIdx,next.idx,false);string random=game.Rng.SaveState();var exhausted=game.ResolveCell();
            Check(exhausted.Instant.EventPoolExhausted&&game.Rng.SaveState()==random,"exhausted current event pool makes no extra random draw after "+history);
        }
    }
    static void ReadGuards()
    {
        Start();Legends();BagItemCommands.TryPrepareDiscovery(game,Source.uid,out _,out _);
        foreach(string zone in new[]{"safe","stored","pouch","battle","inactive"})
        {
            Source.safe=zone=="safe";Source.stored=zone=="stored";Source.pouchOf=zone=="pouch"?"container":null;game.State.battleActive=zone=="battle";game.State.runActive=zone!="inactive";
            string state=State,rng=game.Rng.SaveState(),disk=Disk;saves=0;
            Check(!BagItemCommands.TryPrepareDiscovery(game,Source.uid,out var cards,out _)&&cards==null&&State==state&&game.Rng.SaveState()==rng&&Disk==disk&&saves==0,"read-only discovery still rejects "+zone+" source");
        }
        Source.safe=false;Source.stored=false;Source.pouchOf=null;game.State.battleActive=false;game.State.runActive=true;
        string before=State,random=game.Rng.SaveState(),saved=Disk;saves=0;
        game.Saves.ReportReadError("round6 damaged slot",1);
        Check(!BagItemCommands.TryPrepareDiscovery(game,Source.uid,out _,out _)&&State==before&&game.Rng.SaveState()==random&&Disk==saved&&saves==0,"saved receipt fast path does not bypass slot read-error protection");
        game.Saves.ReportReadError("round6 damaged profile");
        Check(!BagItemCommands.TryPrepareDiscovery(game,Source.uid,out _,out _)&&State==before&&game.Rng.SaveState()==random&&Disk==saved&&saves==0,"saved receipt fast path does not bypass profile read-error protection");
    }
    static void Main()
    {
        string path=Path.GetFullPath("_planning/parity-1101-round6/run-check/profile-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(path);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",path);
        CardLibrary.Init(()=>CardDatabase.All);game=GameRuntime.I;game.Bus.On<SaveCompleted>(_=>saves++);
        SavedDiscovery();DiscoveryFailureAndClaim();InvalidReceipts();AcquireAndClassDiscovery();Pickup();DiscoveryArchive();Events();ReadGuards();
        Console.WriteLine("PASS "+checks+" Round6 Run checks");
    }
}
