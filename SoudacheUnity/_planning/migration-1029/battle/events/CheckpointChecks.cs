using System;
using System.Linq;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;

sealed class CheckpointHost:BattleHost,BattleHostEffects
{
    public int Hp{get;set;}=30;public int MaxHp{get;set;}=35;public int Atk=>4;public int SpellPower=>2;public string MyClass=>"法师";public string CharacterId=>"baita";
    public List<OwnedCard> cards=new List<OwnedCard>();public IReadOnlyList<OwnedCard> OwnedCards=>cards;public int coins;
    public void Log(string text,string kind=null){}public void Heal(int n){Hp=Math.Min(MaxHp,Hp+n);}public void OnBattleEnd(BattleResult result){}
    public void GainCoins(int amount){coins+=amount;}public void ChangeMaxHp(int amount){MaxHp+=amount;Hp+=amount;}
}
static class CheckpointChecks
{
    static int count;static void Check(bool ok,string message){count++;if(!ok)throw new Exception(message);}
    static CheckpointHost Host(params string[] ids)=>new CheckpointHost{cards=ids.Select((id,i)=>new OwnedCard{uid="owned:"+i,card=CardLibrary.FindById(id).Clone()}).ToList()};
    static BattleStartContext Context(CheckpointHost host,bool boss=false)=>new BattleStartContext{host=host,rng=new Rng(333),isBoss=boss,layer=2,name="检查点测试",risk="高",enemies=new[]{new EnemyInput{id="dummy",name="测试目标",hp=1000,atk=2,elite=true,eliteSkill="damageCap",damageCap=5}}};
    static string View(BattleSession session){var s=session.Snapshot;return SaveJson.Stringify(new{s.mode,s.turn,s.energy,s.maxEnergy,s.drawPile,s.hand,s.discard,s.grave,s.player,s.foes,s.pdef,s.pstat,s.Infusing,s.RuleChoice,s.RuleHandSelection,s.Allies,s.Equipment,s.HeroSkill,s.deckSelection});}
    public static int Run()
    {
        foreach(string card in new[]{"tt3-fireball","tt3-magic-lamp","tt3-crimson-pouch","tt7-recruit","tt5-galaxy-voyage"}){
            var host=Host(card,"starter-attack");var ctx=Context(host);var prepared=BattleSession.PrepareCheckpoint(ctx);Check(prepared.rngState==ctx.rng.SaveState(),"entry prepared before effects");
            var session=new BattleSession();session.Start(ctx);string initial=View(session),checkpoint=SaveJson.Stringify(session.CaptureCheckpoint());
            session.FindCard("owned:0").card.runtimeCost=0;session.PlayCard("owned:0",0,false);session.EndTurn();
            Check(SaveJson.Stringify(session.CaptureCheckpoint())==checkpoint,"midcombat cannot change entry snapshot "+card);
            var clean=Host(card,"starter-attack");var restored=new BattleSession();var rng=new Rng(99);
            Check(restored.RestoreCheckpoint(clean,SaveJson.Read<BattleRestartCheckpoint>(checkpoint),rng,out var error),"restart normal "+error);
            Check(View(restored)==initial,"all combat state rebuilt from entry "+card);
            Check(clean.Hp==30&&clean.coins==0,"entry caller host retained "+card);
            Check(ctx.rng.SaveState()!=null&&restored.CaptureCheckpoint().rngState==prepared.rngState,"entry rng retained "+card);
        }
        var bossHost=Host("tt3-fireball","tt3-bandage","tt2-pearlbox","starter-attack");var boss=new BattleSession();var bossContext=Context(bossHost,true);boss.Start(bossContext);
        Check(boss.CaptureCheckpoint().selectedDeck==null,"unconfirmed boss selection not saved");
        foreach(var entry in boss.Snapshot.deckSelection.cards)Check(boss.SelectDeckCard(entry.uid).Ok,"boss card selected");
        Check(boss.ConfirmDeck().Ok,"boss begins");var selected=boss.CaptureCheckpoint();string bossEntry=View(boss);boss.EndTurn();
        var restartedBoss=new BattleSession();Check(restartedBoss.RestoreCheckpoint(Host("tt3-fireball","tt3-bandage","tt2-pearlbox","starter-attack"),selected,new Rng(1),out var why),"boss restart "+why);
        Check(restartedBoss.Snapshot.deckSelection==null&&View(restartedBoss)==bossEntry,"confirmed boss deck and first draw identical");
        // Restore into a reused object must not toggle off its previous selections.
        Check(boss.RestoreCheckpoint(Host("tt3-fireball","tt3-bandage","tt2-pearlbox","starter-attack"),selected,new Rng(2),out why)&&View(boss)==bossEntry,"reused boss session restores confirmed selection");
        var invalid=SaveJson.Read<BattleRestartCheckpoint>(SaveJson.Stringify(selected));invalid.rngState="seed=999999999999999999999;v=2";Check(!BattleSession.ValidateCheckpoint(invalid,out why),"overflow seed rejected");
        invalid=SaveJson.Read<BattleRestartCheckpoint>(SaveJson.Stringify(selected));invalid.restartVersion=99;Check(!BattleSession.ValidateCheckpoint(invalid,out why),"future checkpoint rejected");
        invalid=SaveJson.Read<BattleRestartCheckpoint>(SaveJson.Stringify(selected));invalid.enemyDefs[0].hp=0;Check(!BattleSession.ValidateCheckpoint(invalid,out why),"bad foe rejected");
        selected.enemyDefs[0].hp=1;Check(restartedBoss.CaptureCheckpoint().enemyDefs[0].hp==1000,"checkpoint payload deep copy");
        Console.WriteLine("PASS "+count+" entry-checkpoint assertions (normal + pending choice/equipment/summon; boss confirmed deck, deterministic draw, invalid records)");return count;
    }
}
