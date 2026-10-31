using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Core.Battle;

static class ItemChecks
{
    static int count;static void Check(bool ok,string message){count++;if(!ok)throw new Exception(message);}
    static object Field(BattleSession battle,string name)=>typeof(BattleSession).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(battle);
    static object Call(BattleSession battle,string name,params object[] args)=>typeof(BattleSession).GetMethod(name,BindingFlags.Instance|BindingFlags.NonPublic).Invoke(battle,args);
    static (BattleSession,CheckpointHost) Start(params string[] ids)
    {
        var host=new CheckpointHost{Hp=20,cards=ids.Select((id,i)=>new OwnedCard{uid="item:"+i,card=CardLibrary.FindById(id).Clone()}).ToList()};
        var battle=new BattleSession();battle.Start(new BattleStartContext{host=host,rng=new Rng(333),enemies=new[]{new EnemyInput{name="target",hp=40,atk=4},new EnemyInput{name="target2",hp=40,atk=7}}});return(battle,host);
    }
    public static int Run()
    {
        var doc=JObject.Parse(File.ReadAllText("_planning/migration-1029/battle/item-source-vectors.json"));
        foreach(var vector in doc["vectors"]){
            string id=(string)vector["id"];var(b,h)=Start(id,"starter-attack");if((bool)vector["silenced"])((Combatant)Field(b,"pstat")).status.silence=2;
            int before=b.Snapshot.hand.Count;Check(b.Snapshot.Items.Any(i=>i.uid=="item:0"),"source item visible "+id);Check(b.ItemTargetSide(h.cards[0].card)==(string)vector["targetSide"],"source item targeting "+id);
            Check(b.UseItem("item:0",0).Ok,"item executes "+id);var s=b.Snapshot;
            Check(h.Hp==(int)vector["hp"]&&s.energy==(int)vector["energy"],"source hp/energy "+id);Check(s.hand.Count-before==(int)vector["draw"],"source draw count "+id);
            foreach(var pair in ((JObject)vector["status"]).Properties())if(pair.Value.Type==JTokenType.Integer)Check(s.pstat.status.TryGetValue(pair.Name,out var actual)&&actual==(int)pair.Value,"source item player status "+id+" "+pair.Name);
            for(int i=0;i<2;i++){
                var expected=vector["foes"][i];Check(s.foes[i].hp==(int)expected["hp"]&&s.foes[i].dead==(bool)expected["dead"],"source foe hp/dead "+id);
                foreach(var pair in ((JObject)expected["status"]).Properties())Check(s.foes[i].status.TryGetValue(pair.Name,out var actual)&&actual==(int)pair.Value,"source foe status "+id+" "+pair.Name);
            }
            Check(!s.Items.Any(i=>i.uid=="item:0")&&!b.UseItem("item:0",0).Ok,"item cannot duplicate "+id);
        }
        var(crystal,host)=Start("tt-crystal","starter-attack");Check(!crystal.Snapshot.Items[0].usable&&!crystal.UseItem("item:0").Ok,"empty restoration does not consume item");
        crystal.PlayCard("item:1",0,false);Check(crystal.Snapshot.hand.Count==0,"attack spent");Check(crystal.UseItem("item:0").Ok&&crystal.Snapshot.hand.Contains("item:1"),"restoration returns original uid");
        Check(!((List<string>)Field(crystal,"played")).Contains("item:1"),"retrieved uid clears settlement ledger");Check(!crystal.Snapshot.Items.Any(i=>i.uid=="item:0"),"restoration does not restore itself");
        var(boss,bh)=Start("tt-crystal","tt4-smoke-bomb","tt3-blue-potion");var ctx=new BattleStartContext{host=bh,rng=new Rng(333),isBoss=true,layer=3,enemies=new[]{new EnemyInput{name="boss",hp=1000,atk=1}}};boss.Start(ctx);boss.ConfirmDeck();Check(boss.Snapshot.Items.Count==0,"boss excludes permanent inventory items");
        string temp=(string)Call(boss,"AddTempCard",CardLibrary.FindById("tt3-blue-potion"));Check(!boss.Snapshot.hand.Contains(temp)&&boss.Snapshot.Items.Any(i=>i.uid==temp),"temporary items belong to quickbar");Check(boss.UseItem(temp).Ok,"temporary boss item usable");
        string smoke=(string)Call(boss,"AddTempCard",CardLibrary.FindById("tt4-smoke-bomb"));Check(!boss.UseItem(smoke).Ok&&boss.Snapshot.Items.Any(i=>i.uid==smoke),"boss flee refuses without consuming");
        string gold=(string)Call(boss,"AddTempCard",CardLibrary.FindById("tt-token-gold"));Check(boss.UseItem(gold).Ok&&boss.GrantedCards.Any(c=>c.card.rarity=="传说"),"gold token grants legendary");
        var(awakening,ah)=Start("cmtmvq6ss84l");Check(awakening.UseItem("item:0").Ok&&awakening.GrantedCards.Any(c=>c.card.type=="能力卡"&&c.card.cls==ah.MyClass),"pass awakens current class ability");
        // Current source readConsumedPile/takeConsumedCard is the exact reference for original UID movement.
        var(pile,pileHost)=Start("starter-attack");foreach(string name in new[]{"hand","drawPile","played","consumed","discard","grave"})((List<string>)Field(pile,name)).Clear();
        ((List<string>)Field(pile,"hand")).Add("active");((List<string>)Field(pile,"drawPile")).Add("deck");((List<string>)Field(pile,"played")).AddRange(new[]{"a","a","active"});((List<string>)Field(pile,"consumed")).AddRange(new[]{"b","a"});((List<string>)Field(pile,"discard")).AddRange(new[]{"c","deck"});((List<string>)Field(pile,"grave")).AddRange(new[]{"d","b"});
        var read=(List<string>)Call(pile,"BattleConsumedPile");Check(string.Join(",",read.Where(x=>x!="d"))==string.Join(",",doc["consumed"]["before"].Values<string>()),"source consumed projection stable order and unique");
        ((List<string>)Field(pile,"hand")).Clear();((List<string>)Field(pile,"drawPile")).Clear();((List<string>)Field(pile,"discard")).Clear();((List<string>)Field(pile,"discard")).Add("item:0");
        Check((int)Call(pile,"DrawCards",3)==0&&pile.Snapshot.discard.Count==1,"empty deck never automatically recycles source discard");
        var(spent,spentHost)=Start("starter-attack");string usedTemp=(string)Call(spent,"AddTempCard",CardLibrary.FindById("tt3-blue-potion"));string unusedTemp=(string)Call(spent,"AddTempCard",CardLibrary.FindById("tt3-blue-potion"));
        BattleResult receipt=null;Action<BattleResult> capture=r=>receipt=r;BattleSession.BattleEnded+=capture;
        try{spent.UseItem(usedTemp);spent.Retract();Check(receipt.SpentCards.Count==1&&receipt.SpentCards[0].uid==usedTemp&&!receipt.SpentCards.Any(c=>c.uid==unusedTemp),"used generated card snapshot survives finish; unused generated card vanishes");Check(receipt.Played.Contains(usedTemp),"spent temporary UID remains in settlement ledger");}
        finally{BattleSession.BattleEnded-=capture;}
        var(starters,startersHost)=Start("starter-attack");Call(starters,"DrawCards",1);string temporaryStarter=starters.Snapshot.hand.First(uid=>uid!="item:0");
        receipt=null;BattleSession.BattleEnded+=capture;
        try{
            Check(starters.PlayCard(temporaryStarter,0,false).Ok&&starters.PlayCard("item:0",0,false).Ok,"temporary and real starter both played");starters.Retract();
            Check(receipt.Played.Contains(temporaryStarter)&&receipt.Played.Contains("item:0"),"both starter categories retain played accounting");
            Check(!receipt.SpentCards.Any(card=>card.uid==temporaryStarter),"ordinary temporary starter has no persistent spent template");
            var state=new RunState{ownedCards=startersHost.cards.ToList()};var moved=new HashSet<string>();
            PocketSettlement.Apply(state,receipt.Played,receipt.SpentCards,moved);PocketSettlement.Apply(state,receipt.Consumed,receipt.SpentCards,moved);
            Check(state.usedPocket.Sum(stack=>stack.count)==1&&state.ownedCards.Count==0,"actual Boot settlement pockets real starter only");
            Check(moved.Contains("item:0")&&!moved.Contains(temporaryStarter),"actual Boot ledger excludes generated normal starter");
        }finally{BattleSession.BattleEnded-=capture;}
        var(lethal,lh)=Start("starter-attack","starter-attack");lh.cards[0].card.dmg=100;lh.cards[1].card.dmg=100;lethal.PlayCard("item:0",0,false);Check(lethal.Snapshot.foes[0].dead&&lethal.Snapshot.foes[0].hp==0&&!lethal.Snapshot.foes[1].dead,"lethal hit synchronizes dead flag in multi enemy battle");lethal.PlayCard("item:1",1,false);Check(lethal.Snapshot.over,"all lethal hits finish battle");
        Console.WriteLine("PASS "+count+" battle item assertions with 26 actual source operation vectors");return count;
    }
}
