using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Run;
namespace Sdt.UI.Screens.Menu
{
    // A visit reads each real slot once. No selection, migration or writes occur here.
    internal sealed class CurrentSlotSnapshot
    {
        public int Slot;public RunSaveData Run;public BaseData Base;public string Error;public bool Exists,Recent;
        public string State=>Error!=null?"error":Run!=null?"run":Base!=null?"base":"empty";
        public string Status=>Error!=null?"档案数据异常":Recent?"最近游玩 · 对局进行中":Run!=null?"对局进行中":Base!=null?"基地档案":"空档位";
        public string Cta=>Run!=null?"继续对局":Exists?"进入存档":"开新档";
        public List<string> Achievements=>Base==null?new List<string>():MetaProgress.Achievements.Where(a=>MetaProgress.IsUnlocked(a,Base)).Select(a=>a.name).ToList();
        public static List<CurrentSlotSnapshot> Read(SaveSystem saves)
        {
            var result=new List<CurrentSlotSnapshot>();for(int i=1;i<=SaveSystem.SlotCount;i++)
            {
                var value=new CurrentSlotSnapshot{Slot=i};result.Add(value);
                try{value.Run=saves.ReadSlot(i);value.Base=BaseData.Peek(saves,i);value.Exists=value.Run!=null||value.Base!=null||saves.HasRun(i)||BaseData.HasSlot(saves,i);if(saves.HasSlotReadError(i))value.Error=saves.ReadErrorForSlot(i)??"读取失败";}
                catch(Exception e){value.Error=e.Message;}
            }
            var latest=result.Where(s=>s.Error==null&&(s.Run!=null||s.Base!=null)).OrderByDescending(s=>s.Run?.savedAt??0).ThenBy(s=>s.Slot).FirstOrDefault();if(latest?.Run?.savedAt>0)latest.Recent=true;return result;
        }
        public static CurrentSlotSnapshot Latest(SaveSystem saves)=>Read(saves).Where(s=>s.Error==null&&(s.Run!=null||s.Base!=null)).OrderByDescending(s=>s.Run?.savedAt??0).ThenBy(s=>s.Slot).FirstOrDefault();
    }
}
