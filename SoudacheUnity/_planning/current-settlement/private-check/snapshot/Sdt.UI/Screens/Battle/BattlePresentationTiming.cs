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
        public static double DeathRelease(BattleActorCue beat,float pace,bool reduced)=>!reduced&&beat.Dead?Demo(180,pace):0;
    }
}
