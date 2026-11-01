// Read-only findEffectiveCard presentation; ownership and overrides remain session-owned.
namespace Sdt.Core.Battle
{
    public sealed class BattleCardPresentation
    {
        public string Uid { get; internal set; }
        public CardDef Card { get; internal set; }
        public bool Temporary { get; internal set; }
        public bool Transforming { get; internal set; }
        public bool Transformed { get; internal set; }
        public string OriginName { get; internal set; }
        public int BaseCost { get; internal set; }
        public int EffectiveCost { get; internal set; }
    }

    public sealed partial class BattleSession
    {
        public BattleCardPresentation GetCardPresentation(string uid)
        {
            OwnedCard source=null;bool temporary=false;
            if(G!=null)foreach(var entry in G.OwnedCards)if(entry.uid==uid){source=entry;break;}
            if(source==null)foreach(var entry in granted)if(entry.uid==uid){source=entry;temporary=true;break;}
            if(source?.card==null)return null;
            var original=source.card;var card=cardOverrides.TryGetValue(uid,out var current)?current:original;
            bool transformed=card.id!=original.id||card.name!=original.name;
            return new BattleCardPresentation { Uid=uid,Card=card,Temporary=temporary,
                Transforming=original.rules?.Get("battle")?.Get("handTransform")!=null||original.id=="tt7-imitate",
                Transformed=transformed,OriginName=original.name,BaseCost=card._baseCost??original.cost,
                EffectiveCost=GetEffectiveCost(card) };
        }
        static void CaptureTransformedCost(CardDef original,CardDef altered)
        {
            // Definitions cannot be edited during battle. Resolve a new face's printed
            // fee at its actual mutation, rather than scanning the catalog on UI reads.
            if(altered._baseCost==null&&(altered.id!=original.id||altered.name!=original.name))
                altered._baseCost=CardLibrary.FindById(altered.id)?.cost??altered.cost;
        }
    }
}
