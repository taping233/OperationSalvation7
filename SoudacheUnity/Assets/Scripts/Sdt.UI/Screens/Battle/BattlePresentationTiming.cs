// Pure counterparts of battle.playback.js + battle.feedback.js + battle.attack-profiles.js.
using System;
using Sdt.Core.Battle;
namespace Sdt.UI.Screens.Battle
{
    public static class BattlePresentationTiming
    {
        public static double Demo(double ms,float pace)=>Math.Max(80,Math.Round(ms/pace,MidpointRounding.AwayFromZero));
        public static double Windup(BattleActorCue beat,double? contact,float pace,bool reduced)
            =>reduced?0:contact==null?Demo(beat.WindupMs,pace):contact>0?contact.Value:beat.ReplayAttacker?Demo(beat.WindupMs,pace):0;
        public static double Anticipation(bool frameSynced,float pace,bool reduced)=>reduced||frameSynced?0:Demo(85,pace);
        public static double Stop(BattleActorCue beat,bool reduced)=>reduced?0:beat.Dead?120:beat.Profile=="heavy"||beat.HpBefore-beat.HpAfter>=10&&beat.Profile!="combo"?100:0;
        // The actual death atlas in PresentFloats lasts 780ms, or 280ms in reduced motion.
        public static double DeathRelease(BattleActorCue beat,float pace,bool reduced)=>beat.Dead?(reduced?280:Demo(780,pace)):0;
        public static double AutomaticCardLead(float pace,bool reduced)=>Math.Max(reduced?180:240,Math.Round((reduced?260:360)/pace));
        public static double AutomaticCardTail(float pace)=>Demo(90,pace);
        public static double ResultHold(bool actualDeath,bool reduced)=>actualDeath&&!reduced?300:200;
        public const double ResultFrameLimit=5000;
    }
}
