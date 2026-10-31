// battle.engine.factory.domain.js applyImitate: battle-owned overrides preserve original inventory cards.
using System.Linq;
namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        void ApplyHandTransforms(CardDef playedMartial)
        {
            foreach(string uid in hand.ToArray())
            {
                var current=FindCard(uid);
                var original=G.OwnedCards.FirstOrDefault(entry=>entry.uid==uid)?.card??granted.FirstOrDefault(entry=>entry.uid==uid)?.card??current?.card;
                var transform=original?.rules?.Get("battle")?.Get("handTransform");
                bool ownsOnPlay=original?.rules?.Get("triggers")?.Value("onPlay") is object[];
                bool legacy=!ownsOnPlay&&(original?.id=="tt7-imitate"||original?.rules?.Get("battle")?.Items("hosted").Contains("imitate")==true);
                if(current==null||!(transform!=null?transform.Text("afterType")==playedMartial.type:legacy))continue;
                var copy=playedMartial.Clone();copy.cost=transform?.Number("cost",1)??1;copy.runtimeCost=null;
                cardOverrides[uid]=copy;
                G.Log("[[icon:recycle]] <b>"+Esc(current.card.name)+"</b>：变为【"+Esc(playedMartial.name)+"】的 1 费复制","sys");
            }
        }
    }
}
