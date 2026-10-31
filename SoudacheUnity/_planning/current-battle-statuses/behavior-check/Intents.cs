using System;using Sdt.Core.Battle;namespace Sdt.UI.Screens.Battle {public static class CurrentBattleNameplate {
        public static string IntentText(FoeIntent intent,bool frozen,bool dead)
        {
            if(dead)return "";if(frozen)return "[[icon:status-freeze]]";if(intent==null)return "";
            return intent.Icon+(intent.HasDamage?" "+Math.Max(0,intent.Damage)+(intent.hits>1?"×"+intent.hits:""):"");
        }
        public static string IntentDescription(FoeIntent intent,bool frozen,bool dead)
        {
            if(dead)return "已退场";if(frozen)return "冰冻·无法行动";if(intent==null)return "";
            return intent.Label+(intent.HasDamage?" · "+Math.Max(0,intent.Damage)+(intent.hits>1?" ×"+intent.hits+"（共"+Math.Max(0,intent.Damage)*intent.hits+"）":""):"")+(intent.bleedBonus>0?" · 流血 "+intent.bleedBonus+" 层":"");
        }
}}