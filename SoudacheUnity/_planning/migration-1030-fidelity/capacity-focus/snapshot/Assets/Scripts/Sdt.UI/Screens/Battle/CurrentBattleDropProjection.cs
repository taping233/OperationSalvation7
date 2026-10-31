// battle.aim.js makeAimTargetSession / completeCardTarget. UI chooses the submission target, Core owns the effect.
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Core.Battle;
namespace Sdt.UI.Screens.Battle
{
    public static class CurrentBattleDropProjection
    {
        public static bool FieldPlayable(CardDef card,string side)=>card!=null&&(side=="self"||BattleRules.IsAreaEffect(card)||BattleRules.IsRandomEnemyEffect(card));
        public static int SubmitTarget(string side,string hitKind,int hitIndex,IReadOnlyList<FoeSnapshot> foes)
        {
            if(side=="self")return -1;if(side!="enemy")return -2;if(hitKind=="enemy")return hitIndex;
            for(int i=0;i<foes.Count;i++)if(!foes[i].Dead&&foes[i].Hp>0)return i;return -2;
        }
    }
}
