from pathlib import Path
import shutil,sys
base=Path(__file__).resolve().parent
live=base.parents[2]/'Assets'/'Scripts'
root=live if '--apply' in sys.argv else base/'snapshot'
if root!=live:
 for p in (live/'Sdt.Core').rglob('*.cs'):
  out=root/p.relative_to(live);out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
def edit(rel,old,new):
 p=root/rel;s=p.read_text(encoding='utf-8-sig');assert s.count(old)==1,(rel,old[:100],s.count(old));p.write_text(s.replace(old,new),encoding='utf-8')
core='Sdt.Core/Battle/'
edit(core+'BattleSession.cs','public sealed class PendingTargetSnapshot','public sealed partial class PendingTargetSnapshot')
edit(core+'StructuredRules.cs','private sealed class RuleContext','private sealed partial class RuleContext')
edit(core+'StructuredRules.cs','itemJobs.Clear();resolvingItemUid=null;','itemJobs.Clear();resolvingItemUid=null; preparedFighters=null; preparedFightersUid=null; deferredTargetAction=null; pendingFuel=null; pendingFuelUid=null;')
edit(core+'StructuredRules.cs','var operations=triggers.Operations("onPlay").ToArray();','var operations=triggers.Operations("onPlay").Where(op=>op.Text("pick")!="new").ToArray();')
edit(core+'StructuredRules.cs','var alive = Alive();\n            if (operation.Text("target")', 'var alive = Alive();\n            if(operation.Text("bindTarget")=="prevDamage")return (castContext?.LastDamageTargets ?? new List<BattleFoe>()).Where(f=>!f.dead).ToList();\n            if (operation.Text("target")')
edit(core+'StructuredRules.cs','int count = op.Number("hitCount", 1);','if(castContext!=null)castContext.LastDamageTargets.Clear();\n            int count = op.Number("hitCount", 1);')
edit(core+'StructuredRules.cs','bool wasAlive = !foe.dead; int dealt = ApplyRuleRawHit','if(castContext!=null && !castContext.LastDamageTargets.Contains(foe))castContext.LastDamageTargets.Add(foe);\n                    bool wasAlive = !foe.dead; int dealt = ApplyRuleRawHit')
edit(core+'StructuredRules.cs','var pair = Alive().Take(2).ToArray(); if (pair.Length == 2) { ApplyRuleRawHit(card, pair[1], pair[0].atk, CombatResolver.FIXED, false); if (!pair[0].dead) ApplyRuleRawHit(card, pair[0], pair[1].atk, CombatResolver.FIXED, false); } break;','ResolveFighters(card); break;')
edit(core+'BattleSession.cs','int infN = skipInfusionCards.Contains(cardId) ? 0 : InfuseOf(card);','int infN = skipInfusionCards.Contains(cardId) || pendingFuelUid==cardId ? 0 : InfuseOf(card);')
edit(core+'BattleSession.cs','foreach (var h in hand) if (h != cardId) others++;','foreach (var h in hand) if (h != cardId && CanUseAsInfusionFuel(h)) others++;')
edit(core+'BattleSession.cs','if (h == cardId || fuel.Count >= infN) continue;','if (h == cardId || fuel.Count >= infN || !CanUseAsInfusionFuel(h)) continue;')
edit(core+'BattleSession.cs','ConfirmInfusion(targetIndex);\n                return CommandResult.Yes();','return ConfirmInfusion(targetIndex);')
edit(core+'BattleSession.cs','            pendingTarget = null;\n            pendingHint = "";\n            ExecPlay(cardId, card, new List<string>(), target);','            if(!PrepareFoeFightSelection(cardId,card,ref target))return CommandResult.No("pending target");\n            var fuelForTarget=pendingFuelUid==cardId ? pendingFuel ?? new List<string>() : new List<string>();\n            if(fuelForTarget.Any(f=>!CanUseAsInfusionFuel(f)))return CommandResult.No("注能材料已失效");\n            pendingFuel=null;pendingFuelUid=null;\n            pendingTarget = null;\n            pendingHint = "";\n            ExecPlay(cardId, card, fuelForTarget, target);')
p=root/(core+'BattleSession.cs');s=p.read_text(encoding='utf-8');a=s.index('            var groupUids = new List<string>();',s.index('public CommandResult SelectInfusion'));z=s.index('            RequestRender();',a);s=s[:a]+'''            if(infusing.picked.Contains(uid))infusing.picked.Remove(uid);
            else if(!CanUseAsInfusionFuel(uid))return CommandResult.No("本牌无法用于注能");
            else if(infusing.picked.Count<infusing.need)infusing.picked.Add(uid);
'''+s[z:];p.write_text(s,encoding='utf-8')
edit(core+'BattleSession.cs','            infusing = null;\n            var alive = Alive();\n            BattleFoe target = targetIndex >= 0 && targetIndex < foes.Count ? foes[targetIndex] : (alive.Count > 0 ? alive[0] : null);\n            ExecPlay(uid, card, fuel, target);','''            if(!hand.Contains(uid)||fuel.Any(f=>f==uid||!CanUseAsInfusionFuel(f))||EffCostOf(card)>energy)return CommandResult.No("注能选择已失效");
            var alive = Alive();
            BattleFoe target = targetIndex >= 0 && targetIndex < foes.Count ? foes[targetIndex] : null;
            if(BattleRules.TargetSideFor(card)=="enemy" && (target==null||target.dead))
            {
                pendingTarget=new PendingTargetSnapshot {uid=uid,card=card};pendingFuel=fuel;pendingFuelUid=uid;infusing=null;_phase="targeting";RequestRender();return CommandResult.No("pending target");
            }
            if(BattleRules.TargetSideFor(card)==null)target=alive.FirstOrDefault();
            if(!PrepareFoeFightSelection(uid,card,ref target)){pendingFuel=fuel;pendingFuelUid=uid;infusing=null;return CommandResult.No("pending target");}
            infusing = null;pendingTarget=null;pendingHint="";
            ExecPlay(uid, card, fuel, target);''')
edit(core+'BattleSession.cs','            card=FindCard(uid)?.card ?? card;','            if(!ValidatePreparedFighters(uid,card))return;\n            card=FindCard(uid)?.card ?? card;')
edit(core+'BattleSession.cs','            BeginRuleCast(card, target, fuelUids);','            BeginRuleCast(card, target, fuelUids);\n            BindPreparedFighters(uid);')
edit(core+'BattleSession.cs','                CompleteRuleCast(card);','                RestoreRetainedHand(uid,card);\n                BeginDeferredTarget(uid,card,context);\n                CompleteRuleCast(card);')
edit(core+'BattleSession.cs','pendingTarget != null ? new PendingTargetSnapshot { uid = pendingTarget.uid, card = pendingTarget.card } : null','CopyPendingTarget()')
edit(core+'BattleSession.cs','public CommandResult CancelPendingTarget() { pendingTarget = null;','public CommandResult CancelPendingTarget() { pendingFuel=null;pendingFuelUid=null;preparedFighters=null;preparedFightersUid=null;deferredTargetAction=null;pendingTarget = null;')
edit(core+'BattleSession.cs','public void LockPendingTarget(PendingTargetSnapshot value) { pendingTarget = value;', 'public void LockPendingTarget(PendingTargetSnapshot value) { if(value!=null){if(pendingTarget?.uid!=value.uid){pendingFuel=null;pendingFuelUid=null;preparedFighters=null;preparedFightersUid=null;deferredTargetAction=null;} value.card=FindCard(value.uid)?.card ?? value.card;} pendingTarget = value;')
if root==live:
 edit('Sdt.UI/Screens/Battle/BattleEvents.cs','        CommandResult ChooseRuleOption(int index);','        CommandResult ChooseRuleOption(int index);\n        CommandResult SelectRuleTarget(int index, string battleToken, int selectionId);')
 edit('Sdt.Boot/BattleBridge.cs','        public CommandResult ChooseRuleOption(int index) => _s.ChooseRuleOption(index);','        public CommandResult ChooseRuleOption(int index) => _s.ChooseRuleOption(index);\n        public CommandResult SelectRuleTarget(int index,string battleToken,int selectionId) => _s.SelectRuleTarget(index,battleToken,selectionId);')
 edit('Sdt.UI/Screens/Battle/BattleScreen.cs','            if (cur.PendingTarget == null) return;\n            var api = BattleView.Api;', '            if (cur.PendingTarget == null) return;\n            if(cur.PendingTarget.Kind=="rulePick"){var p=cur.PendingTarget;var result=cmd.SelectRuleTarget(idx,p.BattleToken,p.SelectionId);if(!result.Ok)RunLog.Log(result.Reason,"warn");return;}\n            var api = BattleView.Api;')
 edit('Sdt.UI/Screens/Battle/BattleScreen.cs','                    if (s.Foes[i].Dead) continue;','                    if (s.Foes[i].Dead || s.PendingTarget?.Kind=="fighters" && s.PendingTarget.ExcludedTargetIndex==i) continue;')
 edit('Sdt.UI/Screens/Battle/BattlePresentation.cs',': s.PendingTarget != null ? "已拿起【"', ': s.PendingTarget?.Kind=="rulePick" ? "【"+s.PendingTarget.Card.name+"】下一段 · 点击敌人选择目标\\n"+s.PendingHint\n                : s.PendingTarget != null ? "已拿起【"')
 edit('Sdt.UI/Screens/Battle/HandPanel.cs','card.SetOff(!infusing && (s.Busy || s.over || cost > s.Energy || api.UnplayableReason(g.Card) != null));','card.SetOff(infusing ? g.Card.rules?.Get("battle")?.Value("fuelAllowed") is bool allowed && !allowed : s.Busy || s.over || cost > s.Energy || api.UnplayableReason(g.Card) != null);')
for name in ['BattleHandRetention.cs','BattleTargetSelections.cs']:
 shutil.copy2(base/name,root/core/name)
print(root)

