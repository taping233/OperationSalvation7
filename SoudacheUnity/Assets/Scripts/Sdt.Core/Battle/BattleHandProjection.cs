// Pure physical-UID projection from battle.hand.js + infusionHandCards; presentation never spends cards.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public static class BattleHandProjection
    {
        sealed class Stack
        {
            public CardDef Card;
            public readonly List<string> Uids=new List<string>();
        }
        public static int Rank(CardDef card) => card.id=="starter-attack" || string.IsNullOrEmpty(card.id)&&card.name=="初始攻击" ? 0
            : card.type=="武术"||card.type=="法术" ? 1 : card.type=="装备" ? 4 : 2;
        public static IReadOnlyList<string> InfusionShortcuts(IEnumerable<(string Uid,CardDef Card)> entries,string sourceUid,Func<CardDef,int> effectiveCost)
        {
            var groups=new List<Stack>();var byKey=new Dictionary<string,Stack>();
            foreach(var entry in entries)
            {
                var card=entry.Card;if(card==null||entry.Uid==sourceUid)continue;
                string identity=!string.IsNullOrEmpty(card.id)?"id:"+card.id:"card:"+card.name+"|"+card.type;
                string key=identity+"|"+card.cost+"|"+card.desc+"|"+effectiveCost(card);
                if(!byKey.TryGetValue(key,out var stack)){stack=new Stack{Card=card};byKey.Add(key,stack);groups.Add(stack);}
                stack.Uids.Add(entry.Uid);
            }
            return groups.OrderBy(group=>Rank(group.Card)).SelectMany(group=>group.Uids).ToArray();
        }
    }
}
