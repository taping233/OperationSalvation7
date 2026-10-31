// Direct port of battle.summary.factory.js. Read-only history, separate from rule execution.
using System.Collections.Generic;
using System.Linq;
namespace Sdt.Core.Battle
{
    public sealed class BattleSummaryFoe { public string name; public int hp,maxHp; }
    public sealed class BattleSummaryHit { public string source; public int damage,round; }
    public sealed class BattleSummary
    {
        public int round;
        public IReadOnlyList<BattleSummaryFoe> remainingFoes;
        public IReadOnlyList<BattleSummaryHit> damageTaken;
        public string damageCoverage;
    }
    public sealed partial class BattleSession
    {
        readonly List<BattleSummaryHit> _summaryHits = new List<BattleSummaryHit>();
        void RecordSummaryDamage(string source,int damage)
        { if(damage>0)_summaryHits.Add(new BattleSummaryHit{source=source,damage=damage,round=turn}); }
        BattleSummary ReadSummary() => new BattleSummary {
            round=turn,
            remainingFoes=foes.Where(foe=>!foe.dead&&foe.hp>0).Select(foe=>new BattleSummaryFoe{name=foe.name,hp=foe.hp,maxHp=foe.maxHp}).ToArray(),
            damageTaken=_summaryHits.Select(hit=>new BattleSummaryHit{source=hit.source,damage=hit.damage,round=hit.round}).ToArray(),
            damageCoverage="记录敌方直接攻击与回合末中毒；其他卡牌或反噬伤害未归因。"
        };
    }
}
