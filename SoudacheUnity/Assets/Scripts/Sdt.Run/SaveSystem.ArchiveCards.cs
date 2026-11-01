// An archive carries the custom definitions referenced by its slot, not unrelated global settings.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class SaveSystem
    {
        static Dictionary<string,JObject> ValidateArchiveCards(JToken value)
        {
            var cards=new Dictionary<string,JObject>(StringComparer.Ordinal);
            if(value==null||value.Type==JTokenType.Null)return cards;
            if(!(value is JArray list))throw new InvalidDataException("备份中的自定义卡牌定义无效。");
            foreach(var item in list)
            {
                if(!(item is JObject card))throw new InvalidDataException("备份中的卡牌定义必须是对象。");
                var definition=SaveJson.Read<CardDef>(card);
                if(definition==null||string.IsNullOrWhiteSpace(definition.id)||string.IsNullOrWhiteSpace(definition.name)||string.IsNullOrWhiteSpace(definition.type)||cards.ContainsKey(definition.id))
                    throw new InvalidDataException("自定义卡牌的标识、名称、类型或重复记录无效。");
                cards.Add(definition.id,card);
            }
            return cards;
        }
        static readonly HashSet<string> CardIdFields=new HashSet<string>{"cardId","eventCardId","classCardId","altarFragmentCardId","tokenOf"};
        static readonly HashSet<string> CardIdArrays=new HashSet<string>{"cardIds","rewardCardIds","restoredIds","injectIds"};
        static void CardIds(JToken token,Action<string> visit)
        {
            if(token is JArray array)foreach(var item in array)CardIds(item,visit);
            else if(token?.Type==JTokenType.String)visit((string)token);
        }
        static void CardReferences(JToken token,Action<string> visit,Action<string> named)
        {
            if(token is JObject obj)
            {
                bool cardField=obj.Parent is JProperty parent&&(parent.Name=="card"||parent.Name=="classCard");
                if(obj["id"]?.Type==JTokenType.String&&obj["name"]?.Type==JTokenType.String&&obj["type"]?.Type==JTokenType.String&&(cardField||obj.Property("cost")!=null||obj.Property("uid")!=null))visit((string)obj["id"]);
                bool eventData=obj.Property("eventId")!=null&&obj.Property("stage")!=null;
                foreach(var property in obj.Properties())
                {
                    if(CardIdFields.Contains(property.Name)&&property.Value.Type==JTokenType.String)visit((string)property.Value);
                    if(property.Name=="eventId"&&eventData&&property.Value.Type==JTokenType.String)visit((string)property.Value);
                    if(CardIdArrays.Contains(property.Name)||eventData&&(property.Name=="drawn"||property.Name=="drawPools")||property.Name=="ids"&&((string)obj["kind"]=="ids"||(string)obj["op"]=="insertCards"||(string)obj["op"]=="rewards"))
                        CardIds(property.Value,visit);
                    if(property.Name=="collection"&&obj.Property("stash")!=null&&obj.Property("pocket")!=null&&property.Value is JObject collection)foreach(var entry in collection.Properties())visit(entry.Name);
                    if(property.Value.Type==JTokenType.String)
                    {
                        if(property.Name=="into"){if((string)obj["op"]=="transform")named((string)property.Value);else visit((string)property.Value);}
                        if(property.Name=="key"&&(string)obj["op"]=="release"&&(string)obj["source"]=="generated")named((string)property.Value);
                        if(property.Name=="kind"&&obj.Parent is JProperty owner&&owner.Name=="pool")named((string)property.Value);
                    }
                    CardReferences(property.Value,visit,named);
                }
            }
            else if(token is JArray array)
                foreach(var item in array)CardReferences(item,visit,named);
        }
        static Dictionary<string,string> CardNames(Dictionary<string,JObject> definitions)
        {
            var names=new Dictionary<string,string>(StringComparer.Ordinal);
            var customs=definitions.Values.Select(card=>SaveJson.Read<CardDef>(card)).ToList();
            foreach(var card in CardLibrary.MergeCustoms(CardDatabase.All,customs))
                if(card!=null&&!string.IsNullOrEmpty(card.name)&&!names.ContainsKey(card.name))names.Add(card.name,card.id);
            return names;
        }
        static JArray ArchiveCardDependencies(JObject profile,JObject values)
        {
            var all=ValidateArchiveCards(profile["global"]?[CustomCardsKey]);
            var names=CardNames(all);
            var needed=new HashSet<string>(StringComparer.Ordinal);var pending=new Queue<JObject>();
            void Include(string id)
            {if(id!=null&&all.TryGetValue(id,out var card)&&needed.Add(id))pending.Enqueue(card);}
            void IncludeName(string name){if(name!=null&&names.TryGetValue(name,out var id))Include(id);}
            CardReferences(values,Include,IncludeName);
            while(pending.Count>0)CardReferences(pending.Dequeue(),Include,IncludeName);
            var result=new JArray();
            foreach(var card in all)if(needed.Contains(card.Key))result.Add(card.Value.DeepClone());
            return result;
        }
        static JArray MergeArchiveCards(JObject values,JObject profile,out int added)
        {
            added=0;var incoming=ValidateArchiveCards(values["cards"]);
            ValidatePendingArchiveCards(values,profile,incoming);
            if(incoming.Count==0)return null;
            var existing=ValidateArchiveCards(profile["global"]?[CustomCardsKey]);
            var merged=profile["global"]?[CustomCardsKey] is JArray list?(JArray)list.DeepClone():new JArray();
            foreach(var card in incoming)
            {
                if(existing.TryGetValue(card.Key,out var current))
                {
                    if(!JToken.DeepEquals(current,card.Value))throw new InvalidDataException("卡牌「"+(string)card.Value["name"]+"」的标识与本机已有自定义定义冲突。请先保全并处理该卡牌定义，再重新预检；尚未覆盖任何内容。");
                }
                else {merged.Add(card.Value.DeepClone());added++;}
            }
            var sourceNames=CardNames(incoming);var targetNames=CardNames(ValidateArchiveCards(merged));
            CardReferences(values,_=>{},name=>{
                if(sourceNames.TryGetValue(name,out var expected)&&(!targetNames.TryGetValue(name,out var actual)||expected!=actual))
                    throw new InvalidDataException("卡牌名称「"+name+"」在本机指向另一条定义。请先处理同名卡牌，再重新预检；尚未覆盖任何内容。");
            });
            return merged;
        }
        static void ValidatePendingArchiveCards(JObject values,JObject profile,Dictionary<string,JObject> incoming)
        {
            var available=new HashSet<string>(CardDatabase.All.Where(card=>card!=null).Select(card=>card.id),StringComparer.Ordinal){CardLibrary.SHA.id};
            available.UnionWith(ValidateArchiveCards(profile["global"]?[CustomCardsKey]).Keys);available.UnionWith(incoming.Keys);
            void Require(string id){if(!string.IsNullOrEmpty(id)&&!available.Contains(id))throw new InvalidDataException("待处理内容引用的卡牌「"+id+"」缺少定义。请先在来源恢复该定义再导出；尚未覆盖任何内容。");}
            void RequireMany(IEnumerable<string> ids){if(ids!=null)foreach(var id in ids)Require(id);}
            foreach(var token in new[]{values["run"],(values["settlement"] as JObject)?["run"]})
            {
                if(!Present(token))continue;var run=SaveJson.Read<RunSaveData>(token);
                if(run.entrySupply!=null)RequireMany(run.entrySupply.cardIds.Where((_,index)=>!run.entrySupply.taken.Contains(index)));
                foreach(var receipt in run.nodeRewards.Values)
                {
                    if(receipt==null||receipt.completed)continue;
                    Require(receipt.eventCardId);
                    if(!receipt.bonusReceived)Require(receipt.classCardId);
                    if(!receipt.rewardTaken.HasValue)RequireMany(receipt.rewardCardIds);
                    if(receipt.chestQueue!=null)foreach(var chest in receipt.chestQueue)if(!chest.completed)RequireMany(chest.cardIds.Where((_,index)=>chest.taken?.Contains(index)!=true&&chest.lost?.Contains(index)!=true));
                    var progress=receipt.eventProgress;
                    if(progress==null||progress.settled)continue;
                    Require(progress.eventId);
                    switch(progress.stage)
                    {
                        case "sources":case "selection":case "rewards":
                            RequireMany(progress.cardIds.Where((_,index)=>!progress.taken.Contains(index)));break;
                        case "gamble":RequireMany(progress.cardIds);RequireMany(progress.drawn);break;
                        case "recodeConfirm":RequireMany(progress.drawn);break;
                        case "dice":
                            if(progress.drawPools!=null||progress.route=="gamble")RequireMany(progress.drawn);
                            if(progress.diceIndex<progress.dice.Count)
                            {
                                var die=progress.dice[progress.diceIndex];
                                if(die.result.HasValue)Require(die.outcomes[(die.result.Value-1)*die.outcomes.Count/6].Text("cardId"));
                                else foreach(var outcome in die.outcomes)Require(outcome.Text("cardId"));
                            }
                            if(progress.drawPools!=null)for(int i=progress.drawn.Count+1;i<progress.drawPools.Count;i++)RequireMany(progress.drawPools[i]);
                            break;
                    }
                }
            }
        }
    }
}
