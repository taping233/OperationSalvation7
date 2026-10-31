// src/ui/reward-state.js. Pure presentation of the persisted taken/lost record.
using System;
using System.Collections.Generic;
using System.Linq;
namespace Sdt.UI.Screens.Run
{
    public static class CurrentRewardState
    {
        public static string CardState(ISet<int> taken,ISet<int> lost,int index)=>taken.Contains(index)?"received":lost.Contains(index)?"forfeited":"pending";
        public static string Status(string state,bool choice=false)=>state=="received"?(choice?"✓ 已选择 · ":"")+"已入背包":state=="forfeited"?"已永久放弃":"";
        public static string Summary(int taken,int lost,int cards,bool completed=false,bool choice=false,string rule="")
        {
            if(taken==0&&lost==0)return completed?"已结束":rule;
            var parts=new List<string>();if(taken>0)parts.Add("已领取 "+taken+" 张");if(lost>0)parts.Add(choice&&taken>0?"其余 "+lost+" 张已放弃":"已放弃 "+lost+" 张");
            int remaining=Math.Max(0,cards-taken-lost);if(!completed&&remaining>0)parts.Add("剩余 "+remaining+" 张待处理");return string.Join(" · ",parts);
        }
    }
}
