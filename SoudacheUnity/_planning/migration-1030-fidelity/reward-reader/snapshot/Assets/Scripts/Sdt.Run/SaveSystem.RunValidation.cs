// The normal reader and archive preview use this single run validation entry.
using System;using System.IO;using System.Linq;using System.Collections.Generic;
using Newtonsoft.Json.Linq;using Sdt.Core;
namespace Sdt.Run
{
    public sealed partial class SaveSystem
    {
        internal static RunSaveData ParseValidatedRun(JToken token,int index)
        {
            if((string)token["format"]!="sdt-unity-desktop"||token["version"]?.Type!=JTokenType.Integer||(int)token["version"]!=1)throw new InvalidDataException("对局格式不受支持。");
            var raw=SaveJson.Read<RunSaveData>(token);
            if(raw==null||raw.slot!=index||raw.hp<0||raw.maxHp<=0||raw.hp>raw.maxHp||raw.coins<0||raw.fragments<0)throw new InvalidDataException("对局状态无效。");
            if(!LayeredMapGenerator.ValidateSnapshot(raw.mapSnapshot,out var reason))throw new InvalidDataException("地图存档无效："+reason);
            if(raw.layerIdx<0||raw.layerIdx>=4||raw.trackPos<0||raw.trackPos>=raw.mapSnapshot.layers[raw.layerIdx].nodes.Count)throw new InvalidDataException("对局位置无效。");
            if(raw.ownedCards==null||raw.inventory==null||raw.usedPocket==null||raw.nodeRewards==null)throw new InvalidDataException("对局库存记录缺失。");
            var identities=new HashSet<string>();
            foreach(var owned in raw.ownedCards){
                if(owned?.card==null||string.IsNullOrEmpty(owned.uid)||!identities.Add(owned.uid)||string.IsNullOrEmpty(owned.card.id)||string.IsNullOrEmpty(owned.card.name))throw new InvalidDataException("卡牌实例记录无效。");
                if((owned.safe==true&&owned.stored)||(!owned.stored&&!string.IsNullOrEmpty(owned.pouchOf))||(!string.IsNullOrEmpty(owned.pouchOf)&&owned.pouchOf!=CardContainerCommands.PouchId))throw new InvalidDataException("卡牌所在区域无效。");
            }
            if(raw.inventory.Any(i=>i==null||string.IsNullOrEmpty(i.name)||i.count<=0)||raw.usedPocket.Any(p=>p?.card==null||p.count<=0))throw new InvalidDataException("库存数量无效。");
            if(raw.entrySupply!=null&&(raw.entrySupply.cardIds==null||raw.entrySupply.taken==null||raw.entrySupply.taken.Distinct().Count()!=raw.entrySupply.taken.Count||raw.entrySupply.taken.Any(i=>i<0||i>=raw.entrySupply.cardIds.Count)))throw new InvalidDataException("入城补给进度无效。");
            var checkpoint=raw.battleRestartCheckpoint;
            if(checkpoint!=null){
                if(!Sdt.Core.Battle.BattleSession.ValidateCheckpoint(checkpoint.battle,out var checkpointError))throw new InvalidDataException(checkpointError);
                if(checkpoint.run==null||checkpoint.run.battleRestartCheckpoint!=null||checkpoint.run.slot!=index||checkpoint.run.seed!=raw.seed||checkpoint.run.hp<=0||checkpoint.run.hp>checkpoint.run.maxHp||checkpoint.run.ownedCards==null||checkpoint.run.ownedCards.Any(o=>o?.card==null)||checkpoint.run.layerIdx!=raw.layerIdx||checkpoint.run.trackPos!=raw.trackPos)throw new InvalidDataException("战斗入场对局记录无效。");
                if(!LayeredMapGenerator.ValidateSnapshot(checkpoint.run.mapSnapshot,out _)||checkpoint.run.coins<0||checkpoint.run.fragments<0||checkpoint.run.inventory==null||checkpoint.run.inventory.Any(i=>i==null||i.count<=0)||checkpoint.run.usedPocket==null||checkpoint.run.usedPocket.Any(p=>p?.card==null||p.count<=0)||checkpoint.run.ownedCards.Any(o=>string.IsNullOrEmpty(o.uid))||checkpoint.run.ownedCards.Select(o=>o.uid).Distinct().Count()!=checkpoint.run.ownedCards.Count)throw new InvalidDataException("战斗入场库存或地图无效。");
                if(checkpoint.battle.selectedDeck!=null&&checkpoint.battle.selectedDeck.Any(uid=>!checkpoint.run.ownedCards.Any(o=>o.uid==uid)))throw new InvalidDataException("战斗编组卡牌不在入场背包中。");
            }
            return raw;
        }
    }
}
