using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;

sealed class Host : BattleHost, BattleHostEffects
{
    public int Hp { get; set; } = 30;
    public int MaxHp { get; private set; } = 30;
    public int Atk => 4;
    public int SpellPower => 2;
    public string Class = "法师";
    public string MyClass => Class;
    public string CharacterId => "baita";
    public readonly List<OwnedCard> cards = new List<OwnedCard>();
    public IReadOnlyList<OwnedCard> OwnedCards => cards;
    public void Log(string value, string kind = null) { }
    public void Heal(int amount) { Hp = Math.Min(MaxHp, Hp + amount); }
    public void OnBattleEnd(BattleResult result) { }
    public void GainCoins(int amount) { }
    public void ChangeMaxHp(int amount) { MaxHp += amount; Hp += amount; }
}
static class CoreChecks
{
    static int checks;
    static void Check(bool condition, string name) { if (!condition) throw new Exception(name); checks++; }
    static BattleSession Start(Host host, params string[] ids)
    {
        host.cards.Clear(); foreach (var id in ids) { var card = CardLibrary.FindById(id); Check(card != null, "exists " + id); host.cards.Add(new OwnedCard { uid = host.cards.Any(o=>o.uid==id) ? id+":"+host.cards.Count : id, card = card.Clone() }); }
        var battle = new BattleSession(); battle.Start(new BattleStartContext { host = host, rng = new Rng(123), enemies = new[] { new EnemyInput { id = "dummy", name = "目标", hp = 100, atk = 1 } } }); return battle;
    }
    static void Main(string[] args)
    {
        CardLibrary.Init(() => CardDatabase.All);
        Check(CardDatabase.All.Length == 291, "catalog count");
        Check(CardDatabase.All.Count(card => card.rules != null) == 231, "complete structured data");
        Check(CharacterTable.All.Select(c => c.name).SequenceEqual(new[] { "无", "常无欲", "白塔", "黑像", "星月" }), "roster");
        Check(GameRules.FireHeal == 8 && GameRules.StashMax == 100, "current constants");
        var host = new Host(); var battle = Start(host, "starter-attack", "tt3-bandage", "tt3-fireball");
        Check(battle.PlayCard("starter-attack", 0, false).Ok, "attack submitted");
        Check(battle.Snapshot.foes[0].hp == 96, "attack resolves once");
        Check(!battle.PlayCard("starter-attack", 0, false).Ok, "cannot replay consumed hand");
        host.Hp = 20; Check(battle.PlayCard("tt3-bandage", -1, false).Ok, "bandage");
        Check(host.Hp == 23 && battle.Snapshot.pdef.Armor == 3, "ordered heal armor");
        battle = Start(new Host(), "tt3-fireball"); battle.PlayCard("tt3-fireball", 0, false);
        Check(battle.Snapshot.foes[0].hp == 100 - CardLibrary.FindById("tt3-fireball").dmg - 2, "spell power applied once");
        battle = Start(new Host(), "tt2-piercearrow"); battle.PlayCard("tt2-piercearrow", 0, false);
        Check(battle.Snapshot.foes[0].status["abreak"] == 2, "structured curse");
        battle = Start(new Host(), "tt3-hold-fast"); int before = battle.Snapshot.hand.Count; battle.PlayCard("tt3-hold-fast", -1, false);
        Check(battle.Snapshot.drawPile.Count < GameRules.Battle.NormalStarterDeckSize && battle.Snapshot.hand.Count >= before, "normal draw consumes temporary starter deck");
        battle = Start(new Host(), "tt5-galaxy-voyage", "tt3-fireball"); battle.PlayCard("tt5-galaxy-voyage", -1, false);
        Check(battle.GetEffectiveCost(CardLibrary.FindById("tt3-fireball")) == 1, "move cost rule");
        var rng = new Rng(123); double first = rng.Random("battle", "target"); var state = rng.SaveState(); double next = rng.Random("other", "target"); rng.LoadState(state);
        Check(rng.Version == 2 && rng.Random("battle", "target") == next, "v2 named stream restore");
        var priest = new Host { Class="牧师", Hp=20 }; battle=Start(priest,"starter-attack");
        Check(battle.UseHeroSkill().Ok && priest.Hp==23 && battle.Snapshot.HeroSkill.name=="惩戒", "priest skill flips");
        Check(!battle.UseHeroSkill(0).Ok, "hero skill limited per turn");
        battle.EndTurn(); Check(battle.UseHeroSkill(0).Ok && battle.Snapshot.HeroSkill.name=="圣疗", "priest reverse flip");
        battle=Start(new Host(),"tt7-recruit"); Check(battle.PlayCard("tt7-recruit",-1,false).Ok && battle.Snapshot.Allies.Count==2,"summon allies");
        int playerHp=battle.Snapshot.player.hp; battle.EndTurn();
        Check(battle.Snapshot.player.hp==playerHp && battle.Snapshot.foes[0].hp==92,"allies attack and guard");
        battle=Start(new Host(),"tt3-magic-lamp"); battle.FindCard("tt3-magic-lamp").card.runtimeCost=0;
        Check(battle.PlayCard("tt3-magic-lamp",0,false).Ok && battle.Snapshot.RuleChoice.labels.Count==3,"choice exposed");
        Check(battle.ChooseRuleOption(2).Ok && battle.Snapshot.pdef.Armor==5 && battle.Snapshot.foes[0].status["freeze"]==1,"choice executes selected branch");
        battle=Start(new Host(),"tt3-crimson-pouch","starter-attack"); battle.PlayCard("tt3-crimson-pouch",-2,false);
        Check(battle.UseEquipment("tt3-crimson-pouch").Ok && battle.Snapshot.RuleHandSelection.candidateUids.Contains("starter-attack"),"equipment hand selection");
        Check(battle.SelectRuleHand("starter-attack").Ok && battle.Snapshot.hand.Count==2,"hand choice copy");
        Check(MapData.LayerChests.Length==4 && ChestLoot.RollDrops(false,3,new Rng(123)).SequenceEqual(new[]{"large","medium"}),"fourth-layer fixed drops");
        Check(MapData.ChestKinds["boss"].tokenChance==null,"removed legacy boss token");
        Console.WriteLine("PASS " + checks + " core checks; " + ReferenceChecks.Run() + " source-reference assertions; rng-first=" + first.ToString("R"));
        NextChecks.Run();
        if(args.Contains("--smoke")) SmokeCards();
    }
    static void SmokeCards()
    {
        var failures=new List<string>(); int executed=0,rejected=0;
        foreach(var card in CardDatabase.All.Where(c=>c.type=="法术"||c.type=="武术"||c.type=="装备"||c.type=="能力卡"))
        {
            try
            {
                var ids=new[]{card.id}.Concat(Enumerable.Repeat("starter-attack",8)).ToArray();
                var battle=Start(new Host(),ids); battle.FindCard(card.id).card.runtimeCost=0;
                string side=battle.TargetSide(card); var result=battle.PlayCard(card.id,side=="self"?-1:side=="enemy"?0:-2,true);
                if(!result.Ok){rejected++;continue;} executed++;
                for(int i=0;i<32&&!battle.Snapshot.over;i++)
                {
                    if(battle.Snapshot.RuleChoice!=null) battle.ChooseRuleOption(0);
                    else if(battle.Snapshot.RuleHandSelection!=null) battle.SelectRuleHand(battle.Snapshot.RuleHandSelection.candidateUids[0]);
                    else if(battle.Snapshot.discovering!=null) battle.PickDiscover(0);
                    else break;
                }
                if(!battle.Snapshot.over) battle.EndTurn();
            }
            catch(Exception e){failures.Add(card.id+" "+card.name+": "+e.Message);}
        }
        System.IO.File.WriteAllText("_planning/migration-1029/battle/card-smoke.txt","Executed="+executed+" Rejected="+rejected+" Failures="+failures.Count+"\n"+string.Join("\n",failures));
        Console.WriteLine("CARD SMOKE executed="+executed+" rejected="+rejected+" exceptions="+failures.Count);
        if(failures.Count>0)throw new Exception(string.Join("\n",failures));
    }
}
