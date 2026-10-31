# -*- coding: utf-8 -*-
from pathlib import Path
import sys
p=Path(__file__).resolve().parent
target=p.parents[2]/'Assets/Scripts/Sdt.Core' if '--production' in sys.argv else p/'snapshot'
f=target/'Battle/StructuredRules.cs'
s=f.read_text(encoding='utf-8-sig')
changes=[
('''                ruleJobs.Remove(job); RunRuleOps(job.card, job.operations, job.target?.dead == true ? Alive().FirstOrDefault() : job.target);
                if (job.repeat) { job.turn = turn + 1; ruleJobs.Add(job); }''','''                // Source retains repeat jobs at their registration position relative to delayed jobs.
                if (job.repeat) job.turn = turn + 1; else ruleJobs.Remove(job);
                RunRuleOps(job.card, job.operations, job.target?.dead == true ? Alive().FirstOrDefault() : job.target);'''),
('curses.Where(key => foe.status.Get(key) == 0).ToArray()', 'curses.Where(key => !(foe.status.Get(key) > 0)).ToArray()'),
('choices[(int)(rng.Random("target") * choices.Length)], op.Number("stacks", 1)', 'choices[(int)(rng.Random("battle", "generation") * choices.Length)], op.Number("stacks", 1)'),
('infused = fuel.Count > 0 || persistentRules.Contains("allSpellsInfused") && IsMove(card),','infused = fuel.Count > 0 || HasRuleInfusionWaiver(card),'),
('private int InfuseOf(CardDef card) { return card.noInfuse || persistentRules.Contains("allSpellsInfused") && IsMove(card) ? 0 :','private int InfuseOf(CardDef card) { return HasRuleInfusionWaiver(card) ? 0 :'),
('private readonly List<(BattleFoe foe, int amount, int turn)> stolenAttackReturns = new List<(BattleFoe, int, int)>();','private readonly List<(Combatant foe, int amount, int turn)> stolenAttackReturns = new List<(Combatant, int, int)>();'),
('private readonly List<(BattleFoe foe, int amount)> attackReductions = new List<(BattleFoe,int)>();','private readonly List<(Combatant foe, int amount)> attackReductions = new List<(Combatant,int)>();'),
('if (recruit != null && !(op.Flag("excludeBoss") && mode == "boss") && (!op.Flag("wounded") || recruit.hp < recruit.maxHp)) { ruleAllies.Add(new RuleAlly { name = recruit.name, hp = recruit.hp, maxHp = recruit.maxHp, atk = recruit.atk }); recruit.dead = true; }','if (recruit != null && recruit.hp > 0 && !(op.Flag("excludeBoss") && mode == "boss") && (!op.Flag("wounded") || recruit.hp < recruit.maxHp)) { ruleAllies.Add(CloneRecruitedAlly(recruit)); recruit.dead = true; }'),
('''            var key = choices[(int)(rng.Random("reward") * choices.Count)];
            if (key == "purify") CombatResolver.Purify(pstat); else if (key == "armor") pdef.Armor++; else CombatResolver.AddBlessing(pstat, key, 1);''','''            ApplyRandomRuleBlessing(op, choices);'''),
('''            while (options.Count < 3+discoverExtra && pool.Count > 0) { int index = (int)(rng.Random("generation") * pool.Count); options.Add(pool[index]); pool.RemoveAt(index); }''','''            var taken = new HashSet<string>(); var names = new HashSet<string>();
            // Source discover-flow draws from the full pool and retries collisions (ID or name).
            int optionCap = 3 + Math.Max(0, discoverExtra);
            for (int i = 0; i < optionCap && options.Count < optionCap && pool.Count > 0; i++)
            {
                CardDef candidate = pool[(int)(rng.Random("battle", "generation") * pool.Count)];
                int guard = 0;
                while ((taken.Contains(candidate.id) || names.Contains(candidate.name)) && guard++ < 40)
                    candidate = pool[(int)(rng.Random("battle", "generation") * pool.Count)];
                if (!taken.Contains(candidate.id) && !names.Contains(candidate.name))
                { taken.Add(candidate.id); names.Add(candidate.name); options.Add(candidate); }
            }''')]
for old,new in changes:
    if old.startswith('private int InfuseOf'):continue
    if old not in s:raise RuntimeError('missing hunk '+old[:65])
    s=s.replace(old,new,1)
structured=s
f=target/'Battle/BattleSession.cs';s=f.read_text(encoding='utf-8-sig')
old,new=next(pair for pair in changes if pair[0].startswith('private int InfuseOf'))
assert old in s;s=s.replace(old,new,1)
anchor='''            // —— 共享回合钟：所有计时状态在本回合结束统一递减 1 ——'''
assert s.count(anchor)==1;s=s.replace(anchor,'            ResolveRuleAllyPoison();\n'+anchor)
anchor='''            foreach (var foe in foes) if (!foe.dead) TickDurationsLog(foe.status, foe.name);'''
assert s.count(anchor)==1;s=s.replace(anchor,anchor+'\n            TickRuleAllyDurations();')
session=s
new=target/'Battle/BattleComplexSourceSemantics.cs'
partial=(p/'BattleComplexSourceSemantics.cs').read_text(encoding='utf-8')
if '--production' in sys.argv:
    import shutil
    before=p/'production-before'
    before.mkdir(exist_ok=True)
    for source in [target/'Battle/StructuredRules.cs',target/'Battle/BattleSession.cs']:
        dest=before/source.name
        if not dest.exists():shutil.copyfile(source,dest)
(target/'Battle/StructuredRules.cs').write_text(structured,encoding='utf-8')
(target/'Battle/BattleSession.cs').write_text(session,encoding='utf-8')
new.write_text(partial,encoding='utf-8')
print('private semantics patched')
