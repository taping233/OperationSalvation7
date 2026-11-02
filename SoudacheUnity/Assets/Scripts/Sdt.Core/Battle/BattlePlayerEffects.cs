// Read-only battle.player-effects.js projection. This file never registers or consumes a rule.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed class BattlePlayerEffect
    {
        public string Key { get; }
        public string Name { get; }
        public string Icon { get; }
        public string Duration { get; }
        public string Description { get; }
        public BattlePlayerEffect(string key,string name,string icon,string duration,string description)
        {Key=key;Name=name;Icon=icon;Duration=duration;Description=description;}
    }
    public sealed class BattlePlayerEffectState
    {
        public bool PlayerCurseImmune,CurseImmunityTemporary,HolyRune,SpellCost1,MeleeCost1,AllSpellsInfused,ExtraTurn,DiscoveryCastUnchosen;
        public int Turn=1,NextSpellTwice,BleedAmp,DeathSave;
    }
    public static class BattlePlayerEffects
    {
        public static IReadOnlyList<BattlePlayerEffect> Project(BattlePlayerEffectState state)
        {
            state=state??new BattlePlayerEffectState();var effects=new List<BattlePlayerEffect>();
            void Add(string key,string name,string icon,string duration,string description)=>effects.Add(new BattlePlayerEffect(key,name,icon,duration,description));
            int holyTurns=state.HolyRune?Math.Max(0,4-(state.Turn==0?1:state.Turn)):0;
            if(state.PlayerCurseImmune||holyTurns>0){
                string duration=state.PlayerCurseImmune&&!state.CurseImmunityTemporary?"本场":holyTurns>0?holyTurns+"回合":"本回合";
                Add("curseImmunity","免疫诅咒","shield",duration,"阻止对自身施加诅咒。"+(duration=="本场"?"持续至本场战斗结束。":holyTurns>0?"圣洁符文在前3回合有效。":"下回合开始时结束。")+"不等于免疫伤害。");
            }
            if(state.SpellCost1||state.MeleeCost1){string kind=state.SpellCost1&&state.MeleeCost1?"招式":state.SpellCost1?"法术":"武术";Add("moveCost",kind+"1费","sparkles","本场",kind+"按1费结算，持续至本场战斗结束；单牌限回合0费、无限符文等更高优先级费用规则仍适用，以手牌实际费用为准。");}
            if(state.NextSpellTwice>0)Add("nextSpell","法术额外施放","sparkles","下一张","下一张法术额外施放1次，触发后消失；不会为额外施放再次支付费用。");
            if(state.AllSpellsInfused)Add("infused","招式已注能","sparkles","本场","可注能与必须注能的武术、法术均视为已注能，无需材料；仍需支付正常费用，持续至本场战斗结束。");
            if(state.DiscoveryCastUnchosen)Add("discoveryCastUnchosen","发现连放","question","本场","每次确认发现的招式后，随机直接施放一张未选招式；没有未选招式或取消时不触发。后续每轮发现再次确认仍会触发，重复获得本状态不叠加。");
            if(state.BleedAmp>0)Add("bleedAmp","流血加成翻倍","blood","本场","对流血敌人造成伤害时，流血附加伤害再增加一份，不是总伤害翻倍。持续至本场战斗结束。");
            if(state.DeathSave>0)Add("deathSave","抵挡致命伤害","shield",state.DeathSave+"次","受到致命伤害时抵挡该次伤害并获得本回合免疫伤害，每次触发消耗1次；剩余次数保留至本场战斗结束。");
            if(state.ExtraTurn)Add("extraTurn","额外回合","hourglass","待触发","结束当前回合后跳过敌方行动，立即进入自己的下一回合；触发后消失。");
            return effects.AsReadOnly();
        }
    }
    public sealed partial class BattleSnapshot
    {
        public IReadOnlyList<BattlePlayerEffect> PlayerEffects { get; internal set; }=Array.Empty<BattlePlayerEffect>();
        public IReadOnlyList<BattlePlayerEffect> playerEffects=>PlayerEffects;
    }
    public sealed partial class BattleSession
    {
        private IReadOnlyList<BattlePlayerEffect> ProjectPlayerEffects()
        {
            // Rule jobs are the native equivalent of the source curseImmuneOff reset.
            bool temporaryImmunity=ruleJobs.Any(job=>job.operations.Any(op=>op.Text("op")=="removeRule"&&op.Text("rule")=="playerCurseImmune"));
            return BattlePlayerEffects.Project(new BattlePlayerEffectState{
                PlayerCurseImmune=persistentRules.Contains("playerCurseImmune"),CurseImmunityTemporary=temporaryImmunity,
                // Native spellCost1 is the existing moveCost1 flag: CostOf applies it to both move types.
                SpellCost1=spellCost1||persistentRules.Contains("spellCost1"),MeleeCost1=spellCost1||persistentRules.Contains("meleeCost1"),Turn=turn,
                NextSpellTwice=doubleNextSpell?1:0,AllSpellsInfused=persistentRules.Contains("allSpellsInfused"),
                DiscoveryCastUnchosen=persistentRules.Contains("discoveryCastUnchosen"),BleedAmp=persistentRules.Contains("bleedAmp")?1:0,DeathSave=deathSaves,ExtraTurn=extraTurn,
                // Optional nest rune state is absent from the native runtime; never fabricate an active rune.
                HolyRune=false,
            });
        }
    }
}
