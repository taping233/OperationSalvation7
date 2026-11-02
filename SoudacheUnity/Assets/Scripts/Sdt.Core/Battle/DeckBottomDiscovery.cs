using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        void StartDeckBottomDiscovery(CardDef source,RuleValue operation)
        {
            int count=source.id=="tt3-dig-treasure"?3:operation.Number("n",3);
            var uids=drawPile.Take(count).Where(uid=>FindCard(uid)!=null).ToList();
            if(uids.Count==0)return;
            foreach(string uid in uids)drawPile.Remove(uid);
            var options=uids.Take(3).Select(uid=>FindCard(uid).card).ToList();
            lastAcquired=null;
            var state=BeginDiscovery(options,kind:"deckBottom",cancel:()=>{drawPile.InsertRange(0,uids);lastAcquired=null;});
            state.candidateUids=uids.Take(options.Count).ToList();
            structuredDiscoverAction=chosen=>{
                CompleteDiscoveryChoice(state,chosen,()=>
                {
                    string selected=uids[state.selectedIndex];
                    hand.Add(selected);drawPile.InsertRange(0,uids.Where(uid=>uid!=selected));
                    lastAcquired=chosen;CheckRuleCombinations();
                });
            };
        }
    }
}
