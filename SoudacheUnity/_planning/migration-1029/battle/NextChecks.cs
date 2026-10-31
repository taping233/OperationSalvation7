using System;
using Sdt.Core;
using Sdt.Core.Battle;

// 后续语义对照场景；由 CoreChecks 在对应实现落地后调用。
static class NextChecks
{
    static BattleSession Start(Host host,params string[] ids)
    {
        foreach(var id in ids)host.cards.Add(new OwnedCard{uid=id,card=CardLibrary.FindById(id).Clone()});
        var session=new BattleSession(); session.Start(new BattleStartContext{host=host,rng=new Rng(123),enemies=new[]{new EnemyInput{id="dummy",name="目标",hp=100,atk=1}}});
        return session;
    }
    static void Require(bool value,string name){if(!value)throw new Exception(name);}
    public static void Run()
    {
        var session=Start(new Host(),"tt2-block");session.PlayCard("tt2-block",-1,false);session.EndTurn();
        Require(!session.Snapshot.pdef.Guard,"格挡在本回合后到期");
        session=Start(new Host(),"tt7-elementstorm","tt7-arcanebolt");session.FindCard("tt7-elementstorm").card.runtimeCost=0;
        session.PlayCard("tt7-elementstorm",-1,false);session.PlayCard("tt7-arcanebolt",0,false);
        Require(session.Snapshot.drawPile.Count==3,"元素风暴重施整张法术，包括抽牌");
        session=Start(new Host(),"tt8-hero-assassin","starter-attack");session.FindCard("tt8-hero-assassin").card.runtimeCost=0;
        session.PlayCard("tt8-hero-assassin",-1,false);session.PlayCard("starter-attack",0,false);
        Require(session.Snapshot.foes[0].hp==92,"破隐一击对攻击总值翻倍");
        session=Start(new Host(),"cmtn1r10xnl1","tt3-treasure-hunt");session.FindCard("cmtn1r10xnl1").card.runtimeCost=0;
        session.PlayCard("cmtn1r10xnl1",-1,false);session.PlayCard("tt3-treasure-hunt",0,false);
        Require(session.Snapshot.discovering.options.Count==4,"黑暗形态增加发现候选");
        session=Start(new Host(),"cmtn1lbhbqi4");int initial=session.FindCard("cmtn1lbhbqi4").card.dmg??0;session.EndTurn();
        Require(session.FindCard("cmtn1lbhbqi4").card.dmg==initial+1,"充能火球在手牌中逐回合成长");
        Console.WriteLine("PASS 5 additional semantic scenarios");
    }
}
