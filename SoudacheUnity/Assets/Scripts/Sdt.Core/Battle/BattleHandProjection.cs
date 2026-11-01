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
        public static string StackKey(CardDef card,int effectiveCost)
        {
            string identity=!string.IsNullOrEmpty(card.id)?"id:"+card.id:"card:"+card.name+"|"+card.type;
            return identity+"|"+card.cost+"|"+card.desc+"|"+effectiveCost;
        }
        public static string StackKey(BattleCardPresentation state)
        {
            string origin=state.OriginName;
            return StackKey(state.Card,state.EffectiveCost)+"|source:"+state.BaseCost+"|"+state.Temporary+"|"+state.Transforming+"|"+state.Transformed
                +"|"+(origin==null?"-1:":origin.Length+":"+origin);
        }
        public static IReadOnlyList<string> InfusionShortcuts(IEnumerable<(string Uid,CardDef Card)> entries,string sourceUid,Func<CardDef,int> effectiveCost)
            =>OrderShortcuts(entries.Where(entry=>entry.Card!=null&&entry.Uid!=sourceUid)
                .Select(entry=>(entry.Uid,entry.Card,Key:StackKey(entry.Card,effectiveCost(entry.Card)))));
        public static IReadOnlyList<string> InfusionShortcuts(IEnumerable<BattleCardPresentation> entries,string sourceUid)
            =>OrderShortcuts(entries.Where(state=>state!=null&&state.Uid!=sourceUid).Select(state=>(state.Uid,state.Card,Key:StackKey(state))));
        static IReadOnlyList<string> OrderShortcuts(IEnumerable<(string Uid,CardDef Card,string Key)> entries)
        {
            var groups=new List<Stack>();var byKey=new Dictionary<string,Stack>();
            foreach(var entry in entries)
            {
                var card=entry.Card;string key=entry.Key;
                if(!byKey.TryGetValue(key,out var stack)){stack=new Stack{Card=card};byKey.Add(key,stack);groups.Add(stack);}
                stack.Uids.Add(entry.Uid);
            }
            return groups.OrderBy(group=>Rank(group.Card)).SelectMany(group=>group.Uids).ToArray();
        }
    }
}
