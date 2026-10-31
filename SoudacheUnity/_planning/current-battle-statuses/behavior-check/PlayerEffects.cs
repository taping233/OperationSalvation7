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
        public bool PlayerCurseImmune,CurseImmunityTemporary,HolyRune,SpellCost1,MeleeCost1,AllSpellsInfused,ExtraTurn;
        public int Turn=1,NextSpellTwice,DiscoverPlus,BleedAmp,DeathSave;
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
            if(state.DiscoverPlus>0)Add("discoverPlus","发现候选+"+state.DiscoverPlus,"question","本场","随机发现的候选数量增加，不增加可选择的张数。持续至本场战斗结束。");
            if(state.BleedAmp>0)Add("bleedAmp","流血加成翻倍","blood","本场","对流血敌人造成伤害时，流血附加伤害再增加一份，不是总伤害翻倍。持续至本场战斗结束。");
            if(state.DeathSave>0)Add("deathSave","抵挡致命伤害","shield",state.DeathSave+"次","受到致命伤害时抵挡该次伤害并获得本回合免疫伤害，每次触发消耗1次；剩余次数保留至本场战斗结束。");
            if(state.ExtraTurn)Add("extraTurn","额外回合","hourglass","待触发","结束当前回合后跳过敌方行动，立即进入自己的下一回合；触发后消失。");
            return effects.AsReadOnly();
        }
    }
}