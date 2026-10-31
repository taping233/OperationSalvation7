// Current battle.attack-cues.js + battle.vfx.js; read settled cues once, without rule or RNG mutations.
using System;
using System.Linq;
using System.Text.RegularExpressions;
using Sdt.Core.Battle;
using Sdt.Run;

namespace Sdt.UI.Screens.Battle
{
    public static class CurrentBattleSoundPolicy
    {
        static readonly (Regex Match,string Key)[] Materials = {
            (new Regex("雷|电|射线",RegexOptions.Compiled),"attackLightning"),
            (new Regex("火|焰|燃|烟火|余烬|灼",RegexOptions.Compiled),"attackFire"),
            (new Regex("冰|冻|霜|寒",RegexOptions.Compiled),"attackIce"),
            (new Regex("毒|腐化|腐蚀",RegexOptions.Compiled),"attackPoison"),
            (new Regex("弓|箭",RegexOptions.Compiled),"attackArrow"),
            (new Regex("精神|心灵|幻|梦",RegexOptions.Compiled),"attackPsychic"),
            (new Regex("穿刺|突刺|长枪|枪刺|刺击",RegexOptions.Compiled),"attackPierce"),
            (new Regex("拳|掌|锤|砸|钝|打击",RegexOptions.Compiled),"attackBlunt") };
        public static string HitKey(string type,string name,bool self)
        {
            if (self) return "hurt";
            foreach (var entry in Materials) if (entry.Match.IsMatch(name ?? "")) return entry.Key;
            return type == "spell" ? "attackPsychic" : "hit";
        }
        public static int Amount(BattleActorCue beat)
        {
            int amount=Math.Max(0,beat.HpBefore-beat.HpAfter);
            if (beat.Feedback != null) foreach (var feedback in beat.Feedback)
                if (!feedback.warm && !(feedback.cls??"").Contains("stk") && !(feedback.cls??"").Contains("block")
                    && int.TryParse(feedback.text,out int parsed)) amount=Math.Max(amount,Math.Abs(parsed));
            return amount;
        }
        public static void PlayHit(BattleActorCue beat)
        {
            int amount=Amount(beat);
            if (amount > 0)
            {
                string key=HitKey(beat.DamageType,beat.CardName,beat.IsSelf||beat.AllyIndex>=0);
                AudioService.I.PlaySfx(key,null,key=="hit" ? amount>=10 ? 1.18f : amount>=5 ? 1.08f : .96f : 1);
            }
            else if (beat.Feedback?.Any(f => (f.cls??"").Contains("block")
                && (beat.IsSelf || f.text=="未命中" || f.text=="免伤"))==true || beat.AllyIndex>=0)
                AudioService.I.PlaySfx("parry");
            if (beat.DefenseBefore?.Shield>0 && !(beat.DefenseAfter?.Shield>0)) AudioService.I.PlaySfx("shieldBreak");
        }
    }
}
