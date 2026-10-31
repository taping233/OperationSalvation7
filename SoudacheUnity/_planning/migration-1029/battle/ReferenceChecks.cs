using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using Sdt.Core;

static class ReferenceChecks
{
    static int checks;
    static void Equal<T>(T actual, T expected, string name) { if (!Equals(actual, expected)) throw new Exception(name + " expected=" + expected + " actual=" + actual); checks++; }
    static int Number(JsonElement node, string key, int fallback = 0) { return node.TryGetProperty(key, out var value) ? value.GetInt32() : fallback; }
    static Combatant Unit(JsonElement node)
    {
        var unit = new Combatant { hp = Number(node,"hp"), maxHp = Number(node,"maxHp"), atk = Number(node,"atk"), spellPower = Number(node,"spellPower") };
        if (node.TryGetProperty("status",out var statuses)) foreach (var entry in statuses.EnumerateObject()) unit.status.Set(entry.Name,entry.Value.GetInt32());
        if (node.TryGetProperty("defense",out var defense)) { unit.defense.Armor=Number(defense,"armor"); unit.defense.Shield=Number(defense,"shield"); unit.defense.Guard=defense.TryGetProperty("guard",out var guard)&&guard.GetBoolean(); }
        return unit;
    }
    public static int Run()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText("_planning/migration-1029/battle/source-vectors.json"));
        foreach (var vector in doc.RootElement.GetProperty("randomVectors").EnumerateArray())
        {
            var seed=vector.GetProperty("seed"); var rng=seed.ValueKind==JsonValueKind.String ? new Rng(seed.GetString()) : new Rng(seed.GetUInt32());
            var calls=vector.GetProperty("calls").EnumerateArray().ToArray(); var values=vector.GetProperty("values").EnumerateArray().ToArray();
            for(int i=0;i<calls.Length;i++) Equal(rng.Random(calls[i][0].GetString(),calls[i][1].ValueKind==JsonValueKind.String?calls[i][1].GetString():null),values[i].GetDouble(),"source rng "+seed+"/"+i);
        }
        foreach(var vector in doc.RootElement.GetProperty("damageVectors").EnumerateArray())
        {
            var target=Unit(vector.GetProperty("target")); var attacker=Unit(vector.GetProperty("attacker"));
            var result=CombatResolver.DealDamage(attacker,target,Number(vector,"amount"),vector.GetProperty("type").GetString()); var expected=vector.GetProperty("after");
            Equal(result.dealt,Number(vector,"dealt"),"source damage "+vector.GetProperty("type")+"/"+vector.GetProperty("amount"));
            Equal(target.hp,Number(expected,"hp"),"source remaining hp");
            Equal(target.defense.Armor,Number(expected.GetProperty("defense"),"armor"),"source armor");
            Equal(target.defense.Shield,Number(expected.GetProperty("defense"),"shield"),"source shield");
            Equal(target.status.dodge,Number(expected.GetProperty("status"),"dodge"),"source dodge");
        }
        foreach(var vector in doc.RootElement.GetProperty("chestVectors").EnumerateArray())
        {
            var actual=ChestLoot.RollDrops(false,Number(vector,"layer"),new Rng(Number(vector,"seed")));
            Equal(string.Join(",",actual),string.Join(",",vector.GetProperty("boxes").EnumerateArray().Select(value=>value.GetString())),"source chest drop "+vector.GetProperty("seed")+"/"+vector.GetProperty("layer"));
        }
        foreach(var vector in doc.RootElement.GetProperty("contentVectors").EnumerateArray())
        {
            var actual=ChestLoot.RollContents(vector.GetProperty("kind").GetString(),new Rng(Number(vector,"seed")),vector.GetProperty("isClass").GetBoolean(),"法师","standard");
            string name="source chest contents "+vector.GetProperty("seed")+"/"+vector.GetProperty("kind")+"/"+vector.GetProperty("isClass");
            Equal(string.Join(",",actual.cards.Select(card=>card.id)),string.Join(",",vector.GetProperty("cards").EnumerateArray().Select(value=>value.GetString())),name);
            Equal(actual.coins,Number(vector,"coins"),name+" coins");
            Equal(actual.claimMode,vector.GetProperty("claimMode").GetString(),name+" claim");
            Equal(actual.choiceCount,Number(vector,"choiceCount"),name+" choices");
        }
        return checks;
    }
}
