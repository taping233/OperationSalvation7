using System;
using System.Linq;
namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        private static bool KeepsCardInHand(CardDef card) => card?.rules?.Get("battle")?.Flag("keepInHand") == true;
        private bool CanUseAsInfusionFuel(string uid) => hand.Contains(uid) && FindCard(uid)?.card != null && !(FindCard(uid).card.rules?.Get("battle")?.Value("fuelAllowed") is bool allowed && !allowed);
        private void RestoreRetainedHand(string uid, CardDef card)
        {
            if (!KeepsCardInHand(card)) return;
            int di=discard.LastIndexOf(uid); if(di>=0)discard.RemoveAt(di);
            int pi=played.LastIndexOf(uid); if(pi>=0)played.RemoveAt(pi);
            if(hand.Contains(uid))return;
            if(hand.Count<GameRules.BattleHandMax)hand.Add(uid);else discard.Add(uid);
        }
    }
}

