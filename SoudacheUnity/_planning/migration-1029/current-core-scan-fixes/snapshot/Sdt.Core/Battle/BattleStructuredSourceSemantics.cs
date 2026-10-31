using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        // Exact source policy: cards/card-energy-policy.js.
        private static bool EnergyCapGrantsCurrent(CardDef card) => card?.id != "tt3-nature-form";

        private void RunStructuredReplays(CardDef card, RuleValue[] operations, BattleFoe target, int remaining, bool doubled)
        {
            if (remaining <= 0 && !doubled) return;
            // Source last-hand repetitions stop when no enemies remain; next-spell runs afterwards.
            if (remaining > 0 && Alive().Count == 0) remaining = 0;
            if (remaining <= 0 && !doubled) return;
            int next = Math.Max(0, remaining - 1);
            bool nextDoubled = remaining > 0 && doubled;
            int continuationBase = ruleContinuations.Count;
            RunRuleOps(card, operations, target);
            if (next <= 0 && !nextDoubled) return;
            var context = castContext;
            Action resume = () => { var previous = castContext; castContext = context;
                try { RunStructuredReplays(card, operations, target, next, nextDoubled); }
                finally { castContext = previous; } };
            if (RuleInputPending) ruleContinuations.Insert(continuationBase, resume); else resume();
        }

        private string[] DrawRandomCurseKinds(int count)
        {
            var pool = CombatResolver.Curses.Where(kind => kind != "atkDown").ToList();
            // V8 Array.sort for this six-element pool: detect/reverse the natural run,
            // then stable binary insertion. Random comparator call order is observable RNG state.
            // This preserves the current V8 source behaviour, not a portable JS sort guarantee.
            if (pool.Count > 1)
            {
                int run = 2;
                bool descending = rng.Random("generation") < 0.5;
                while (run < pool.Count)
                {
                    bool less = rng.Random("generation") < 0.5;
                    if (descending ? !less : less) break;
                    run++;
                }
                if (descending) pool.Reverse(0, run);
                for (int start = run; start < pool.Count; start++)
                {
                    string pivot = pool[start]; int left = 0, right = start;
                    while (left < right)
                    {
                        int mid = left + (right - left) / 2;
                        if (rng.Random("generation") < 0.5) right = mid; else left = mid + 1;
                    }
                    for (int i = start; i > left; i--) pool[i] = pool[i - 1];
                    pool[left] = pivot;
                }
            }
            return pool.Take(Math.Max(0, count)).ToArray();
        }
    }
}
