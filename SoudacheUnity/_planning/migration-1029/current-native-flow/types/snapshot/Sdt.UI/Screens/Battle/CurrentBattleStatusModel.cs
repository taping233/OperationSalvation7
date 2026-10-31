// battle.status-chips.js + ui/status-icons.js. Values remain read-only projections of the combat snapshot.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Sdt.Core;
using Sdt.Core.Battle;
namespace Sdt.UI.Screens.Battle
{
    public sealed class CurrentBattleStatus
    {
        public string Key,Name,Icon,Amount,Unit,Description;public bool Curse;
        public string Label=>Name+(string.IsNullOrEmpty(Amount)?" · 生效中":" "+Amount+Unit);
    }
    public static class CurrentBattleStatusModel
    {
        public static List<CurrentBattleStatus> Project(IReadOnlyDictionary<string,int> status,IReadOnlyList<BattlePlayerEffect> effects=null)
        {
            var result=new List<CurrentBattleStatus>();status=status??new Dictionary<string,int>();
            foreach(var key in CombatResolver.Buffs){if(!status.TryGetValue(key,out int value)||value<=0||!CombatResolver.BuffMetaDict.TryGetValue(key,out var m))continue;result.Add(new CurrentBattleStatus{Key="buff:"+key,Name=m.name,Icon=IconName(m.icon),Amount=m.flag?"":value.ToString(),Unit=m.flag?"":m.timed?"回合":key=="dodge"?"次":"",Description=m.desc,Curse=false});}
            foreach(var key in CombatResolver.Curses){if(!status.TryGetValue(key,out int value)||value<=0||!CombatResolver.CurseMetaDict.TryGetValue(key,out var m))continue;result.Add(new CurrentBattleStatus{Key="curse:"+key,Name=m.name,Icon=IconName(m.icon),Amount=value.ToString(),Unit=m.stack?"层":"回合",Description=m.desc,Curse=true});}
            foreach(var effect in effects??Array.Empty<BattlePlayerEffect>())result.Add(new CurrentBattleStatus{Key="effect:"+effect.Key,Name=effect.Name,Icon=effect.Icon,Amount=effect.Duration,Unit="",Description=effect.Description,Curse=false});
            return result;
        }
        static string IconName(string icon){var match=Regex.Match(icon??"",@"\[\[icon:([^\]]+)\]\]");return match.Success?match.Groups[1].Value:"question";}
        public static List<CurrentBattleStatus> Legacy(IReadOnlyList<StatusChip> chips)
        {
            var result=new List<CurrentBattleStatus>();foreach(var chip in chips??Array.Empty<StatusChip>()){
                string key=chip.IsCurse?CombatResolver.Curses.FirstOrDefault(k=>CombatResolver.CurseMetaDict[k].name==chip.Name):CombatResolver.Buffs.FirstOrDefault(k=>CombatResolver.BuffMetaDict[k].name==chip.Name);
                var amount=Regex.Match(chip.Value??"",@"^\d+");if(key!=null){int value=amount.Success?int.Parse(amount.Value):1;result.AddRange(Project(new Dictionary<string,int>{{key,value}}));}
                else result.Add(new CurrentBattleStatus{Key="marker:"+chip.Icon+":"+chip.Name,Name=chip.Name,Icon=IconName(chip.Icon),Amount=amount.Value,Unit=amount.Success?(chip.Value??"").Substring(amount.Length):"",Description=chip.Desc,Curse=chip.IsCurse});
            }return result;
        }
    }
}
