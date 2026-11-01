using System;using System.IO;using System.Linq;using Sdt.Core;using Sdt.Run;
static class Program
{
    static int _checks;static GameRuntime G;
    static void Check(bool value,string label){_checks++;if(!value)throw new InvalidOperationException(label);}
    static CardDef Card(string id,string type="法术",string variant=null)=>new CardDef{id=id,name=id,type=type,rarity="普通",variantKey=variant};
    static OwnedCard Add(CardDef card,string uid=null,bool safe=false,bool stored=false,string pouch=null)
    {var entry=new OwnedCard{uid=uid??"r7-"+G.State.ownedCards.Count,card=card,safe=safe,stored=stored,pouchOf=pouch};G.State.ownedCards.Add(entry);return entry;}
    static void Compare(string name,params CardDef[] targets)
    {
        string state=SaveJson.Stringify(G.State),rng=G.Rng.SaveState();var snapshot=CardContainerCommands.CreateRestorationPreview(G);
        foreach(var source in G.State.ownedCards.Where(o=>o.card!=null&&o.safe!=true&&!o.stored&&string.IsNullOrEmpty(o.pouchOf)))
        foreach(var target in targets)
            Check(snapshot.CanReplace(source.uid,target)==CardContainerCommands.CanReceive(G,target,G.State.ownedCards.Where(o=>!ReferenceEquals(o,source))),name+" replacement source="+source.uid+" target="+target.id+":"+target.variantKey);
        Check(!snapshot.CanReplace("missing",targets[0])&&!snapshot.CanReplace(null,targets[0])&&!snapshot.CanReplace(G.State.ownedCards[0].uid,null),name+" invalid source/target rejected");
        Check(SaveJson.Stringify(G.State)==state&&G.Rng.SaveState()==rng,name+" preview is read-only");
    }
    static void ExactCapacity(CardDef item,CardDef spell,CardDef variant,CardDef pearl,CardDef resource)
    {
        void Reset(){G.Base.bagUp=0;G.State.ownedCards.Clear();G.State.inventory.Clear();}
        void Expect(string uid,CardDef target,bool expected,string name)
        {
            var source=G.State.ownedCards.Single(o=>o.uid==uid);var preview=CardContainerCommands.CreateRestorationPreview(G);
            Check(preview.CanReplace(uid,target)==expected&&CardContainerCommands.CanReceive(G,target,G.State.ownedCards.Where(o=>o!=source))==expected,name);
        }
        foreach(int count in new[]{1,2,3})
        {
            Reset();for(int i=0;i<count;i++)Add(item.Clone(),i==0?"full-source":"full-source-"+i);
            for(int i=1;i<G.Base.BagCap;i++)Add(Card("exact-fill-"+i));
            var query=CardContainerCommands.Query(G);Check(query.used==query.totalCap&&query.ordinarySlots==query.baseCap,"actual equal full capacity with source count "+count);
            Expect("full-source",spell,count==1,"only removing the final source stack copy frees its exact full slot");
        }
        G.State.ownedCards.RemoveAt(G.State.ownedCards.Count-1);Add(spell.Clone(),"partial-target");Add(spell.Clone());
        var full=CardContainerCommands.Query(G);Check(full.used==full.totalCap&&full.ordinarySlots==full.baseCap,"partial-target fixture remains exactly full");
        Expect("full-source",spell,true,"full bag can append to matching partial target after source removal");
        Expect("full-source",variant,false,"same ID different variant needs its own full-bag slot");
        Reset();Add(item.Clone(),"full-source");Add(item.Clone());var box=Add(pearl.Clone(),"pearl-source");
        for(int i=2;i<G.Base.BagCap;i++)Add(Card("ordinary-fill-"+i));
        int bonus=CardContainerCommands.ResourceBonus(new[]{box});
        for(int i=0;i<bonus;i++)Add(Card("full-resource-"+i,"资源"));
        full=CardContainerCommands.Query(G);Check(full.resourceBonus==bonus&&full.used==full.totalCap&&full.ordinarySlots==full.baseCap,"actual resource extension and ordinary base are both exactly full");
        Expect("full-source",spell,false,"ordinary replacement without freed stack cannot cross exact base limit");
        Expect("full-source",resource,false,"new resource group cannot cross exact total limit");
        Expect("pearl-source",spell,false,"removing container capacity cannot admit a card from full extended bag");
        var old=CardContainerCommands.CreateRestorationPreview(G);int cap=G.Base.BagCap;G.Base.bagUp++;
        var next=CardContainerCommands.CreateRestorationPreview(G);var sourceAfter=G.State.ownedCards.Single(o=>o.uid=="full-source");
        Check(!old.CanReplace("full-source",spell)&&next.CanReplace("full-source",spell)&&CardContainerCommands.CanReceive(G,spell,G.State.ownedCards.Where(o=>o!=sourceAfter)),"upgrade requires a new render snapshot and enables exact-boundary replacement");
        Check(CardContainerCommands.Query(G).baseCap==cap+1,"upgraded preview uses actual base capacity");G.Base.bagUp=0;
    }
    static void Main()
    {
        string path=Path.GetFullPath("_planning/parity-1101-round7/bag-check/profile-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(path);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",path);
        CardLibrary.Init(()=>CardDatabase.All);G=GameRuntime.I;G.ResetSlot(1);G.NewRun(1,"wu");G.State.entrySupply=null;
        var item=Card("restore","道具");var spell=Card("spell");var variant=Card("spell","法术","v1");var equipment=Card("gear","装备");var resource=Card("resource","资源");
        var pearl=CardLibrary.FindById(CardContainerCommands.PearlId).Clone();var pouch=CardLibrary.FindById(CardContainerCommands.PouchId).Clone();
        foreach(int count in new[]{1,2,3,4})
        {
            G.State.ownedCards.Clear();G.State.inventory.Clear();
            for(int i=0;i<count;i++)Add(item.Clone());Add(spell.Clone());Add(variant.Clone());Add(equipment.Clone());Add(resource.Clone());Add(pearl.Clone());
            Add(spell.Clone(),"safe-only",safe:true);Add(resource.Clone(),"stored-only",stored:true);Add(spell.Clone(),"pouch-only",stored:true,pouch:CardContainerCommands.PouchId);
            for(int i=0;i<G.Base.BagCap+1;i++)Add(Card("fill-"+i));
            Compare("overfull stack "+count,item,spell,variant,equipment,resource,pearl,pouch);
            G.State.ownedCards.RemoveAll(o=>o.card.id.StartsWith("fill-",StringComparison.Ordinal));
            Compare("room stack "+count,item,spell,variant,equipment,resource,pearl,pouch);
            var preview=CardContainerCommands.CreateRestorationPreview(G);
            Check(!preview.CanReplace("safe-only",spell)&&!preview.CanReplace("stored-only",spell)&&!preview.CanReplace("pouch-only",spell),"nonordinary sources excluded");
            G.State.inventory.Add(new InvSlot{name="受控散装物资",count=7,value=1,tier="C"});
            Compare("supplies stack "+count,item,spell,variant,equipment,resource,pearl,pouch);
        }
        G.State.ownedCards.Clear();Add(equipment,"hetero-first");var changed=equipment.Clone();changed.type="资源";Add(changed);Add(changed.Clone());Add(changed.Clone());
        Add(item);Add(spell,stored:true);Add(spell.Clone(),pouch:"explicit-unstored-pouch");
        Compare("first removed changes remaining group cap/category",spell,equipment,resource,pearl);
        G.State.ownedCards.Clear();var source=Add(item,"source");Add(spell,"target");
        var snapshot=CardContainerCommands.CreateRestorationPreview(G);bool before=snapshot.CanReplace("source",equipment);
        for(int i=0;i<G.Base.BagCap+2;i++)Add(Card("full-"+i));
        Check(snapshot.CanReplace("source",equipment)==before,"render snapshot does not read later inventory mutations");
        Check(CardContainerCommands.CreateRestorationPreview(G).CanReplace("source",equipment)==CardContainerCommands.CanReceive(G,equipment,G.State.ownedCards.Where(o=>o!=source)),"next render observes new capacity");
        Check(!CardContainerCommands.CreateRestorationPreview(G).CanReplace("target-missing",spell),"invalid UID never substitutes another card");
        Add(item.Clone(),"source");Check(!CardContainerCommands.CreateRestorationPreview(G).CanReplace("source",equipment),"ambiguous normal UID rejected");
        ExactCapacity(item,spell,variant,pearl,resource);
        Console.WriteLine("PASS "+_checks+" Round7 bag replacement checks");
    }
}
