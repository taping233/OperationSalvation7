using System.Text.RegularExpressions;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        // Same boundary as source battle.damage.domain hitFoe; applied once for both HP and hearts.
        public int AdjustCardDamage(CardDef card, int bleed, int amount, string type)
        {
            if(type=="attack" && bleed>0 && (card?.id=="tt3-fly-arrowhawk"
                || Regex.IsMatch(card?.desc??"", "流血伤害翻倍") || persistentRules.Contains("bleedAmp"))) amount+=bleed;
            return amount;
        }
        private int RuleDamageAmount(BattleFoe foe, CardDef card, int amount, string type) => AdjustCardDamage(card,foe.status.Get("bleed"),amount,type);
        private void ResolveDrawHandOps(RuleValue operation)
        {
            foreach(var entry in operation.Operations("handOps"))
            {
                string act=entry.Text("op"); if(act!="consumeHand" && act!="dumpHand") continue;
                var uids=hand.ToArray(); hand.Clear(); bool dumping=act=="dumpHand"&&mode=="boss";
                foreach(var uid in uids)
                {
                    if(dumping) { discard.Add(uid); continue; }
                    consumed.Add(uid); if(mode=="boss") grave.Add(uid);
                    var card=FindCard(uid)?.card; if(card==null) continue;
                    ResolveInfusedFuel(card,Alive().FirstOrDefault());
                    if(persistentRules.Contains("consumeFireball")) CastRuleCard(CardLibrary.FindById("tt3-fireball"),Alive().FirstOrDefault());
                }
            }
        }
    }
}
