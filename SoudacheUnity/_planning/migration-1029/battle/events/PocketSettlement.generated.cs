// Generated directly from GameBattleHost.ToPocket; do not edit.
using System.Collections.Generic;
using Sdt.Core;
static class PocketSettlement {
        static int ToPocket(Sdt.Core.RunState st, List<string> uids, string why, List<Sdt.Core.OwnedCard> spent, HashSet<string> movedUids)
        {
            var moved = new List<CardDef>();
            foreach (var uid in uids)
            {
                if (movedUids.Contains(uid)) continue;
                var i = st.ownedCards.FindIndex(o => o.uid == uid);
                var card = i >= 0 ? st.ownedCards[i].card : spent?.Find(entry => entry.uid == uid)?.card;
                if (card == null) continue;
                moved.Add(card); movedUids.Add(uid);
                if (i >= 0) st.ownedCards.RemoveAt(i);
            }
            foreach (var card in moved)
            {
                var stack = st.usedPocket.Find(p => p.card.name == card.name);
                if (stack != null) stack.count++;
                else st.usedPocket.Add(new Sdt.Core.PocketStack { card = card, count = 1 });
            }
            if (moved.Count > 0)
                RunLog.Log("[[icon:archive]] " + why + "：<b>" + moved.Count + "</b> 张卡牌进入消耗口袋（本局无法再用，基地/火堆可复原）", "sys");
            return moved.Count;
        }
public static int Apply(RunState state,List<string> uids,List<OwnedCard> spent,HashSet<string> moved)=>ToPocket(state,uids,"domain test",spent,moved);
}
static class RunLog { public static void Log(string message,string kind) {} }
