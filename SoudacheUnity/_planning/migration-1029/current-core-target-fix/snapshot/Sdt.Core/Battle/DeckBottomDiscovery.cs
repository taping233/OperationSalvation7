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
            var options=uids.Select(uid=>FindCard(uid).card).ToList();
            discovering=new DiscoveringState{options=options,n=1};
            structuredDiscoverAction=chosen=>{
                int index=options.IndexOf(chosen);if(index<0)return;string selected=uids[index];
                hand.Add(selected);drawPile.InsertRange(0,uids.Where(uid=>uid!=selected));
                lastAcquired=chosen;
                CheckRuleCombinations();
            };
        }
    }
}
