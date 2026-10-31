from pathlib import Path
p=Path(__file__).parent
s=(p/'StructuredRules.before.cs').read_text(encoding='utf-8-sig')
old='''            int repeats=(doubled?1:0)+(triggers.Get("replay")?.Text("on")=="lastHand" && castContext?.lastHand==true?triggers.Get("replay").Number("times",1):0);
            if(repeats>0)
            {
                var context=castContext;
                Action replay=()=>{var previous=castContext;castContext=context;for(int i=0;i<repeats;i++)RunRuleOps(card,operations,target);castContext=previous;};
                if(RuleInputPending)ruleContinuations.Insert(continuationBase,replay);else replay();
            }'''
new='''            var replayRule = triggers.Get("replay");
            if (doubled || replayRule?.Text("on") == "lastHand")
            {
                var context = castContext;
                Action replay = () =>
                {
                    var previous = castContext; castContext = context;
                    try
                    {
                        // Source exec-play checks the actual hand after main effects and input settle.
                        int repeats = replayRule?.Text("on") == "lastHand" && hand.All(uid => KeepsCardInHand(FindCard(uid)?.card)) ? replayRule.Number("times", 1) : 0;
                        RunStructuredReplays(card, operations, target, repeats, doubled);
                    }
                    finally { castContext = previous; }
                };
                if (RuleInputPending) ruleContinuations.Insert(continuationBase, replay); else replay();
            }'''
assert old in s
s=s.replace(old,new)
s=s.replace('n = Math.Min(op.Number("upTo"), G.MaxHp - G.Hp);','n = Math.Max(0, op.Number("upTo") - G.Hp);')
s=s.replace('case "energyCap": maxEnergy += op.Number("n", 1); energy += op.Number("n", 1); break;', 'case "energyCap": maxEnergy += op.Number("n", 1); if (EnergyCapGrantsCurrent(card)) energy += op.Number("n", 1); break;')
s=s.replace('''            foreach (var foe in RuleTargets(op, target))
            {
                if (op.Text("source") == "handMoves")''','''            // Source draws kinds once before selecting targets, including when no target survives.
            var randomKinds = op.Has("randomKinds") ? DrawRandomCurseKinds(op.Number("randomKinds")) : null;
            foreach (var foe in RuleTargets(op, target))
            {
                if (op.Has("extend"))
                {
                    var kind = op.Text("curse");
                    if (kind != "bleed" && kind != "poison" && foe.status.Get(kind) > 0)
                        foe.status.Set(kind, foe.status.Get(kind) + op.Number("extend"));
                    continue; // Extension does not apply a new curse or fire freeze events.
                }
                if (op.Text("source") == "handMoves")''')
old='''                    var remaining = CombatResolver.Curses.ToList();
                    for (int i = 0; i < op.Number("randomKinds") && remaining.Count > 0; i++) { int idx = (int)(rng.Random("target") * remaining.Count); AddRuleStatus(foe, remaining[idx], 1); remaining.RemoveAt(idx); }'''
assert old in s
s=s.replace(old,'''                    foreach (var kind in randomKinds)
                        AddRuleStatus(foe, kind, kind == "bleed" || kind == "poison" ? 1 : op.Number("duration", 1));''')
s=s.replace('                if (op.Has("extend") && foe.status.Get(curse) > 0) n = foe.status.Get(curse) + op.Number("extend");\n','')
(p/'StructuredRules.draft.cs').write_text(s,encoding='utf-8')
