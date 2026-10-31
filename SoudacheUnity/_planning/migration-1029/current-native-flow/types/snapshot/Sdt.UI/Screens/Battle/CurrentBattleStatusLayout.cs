using System;
using System.Collections.Generic;
namespace Sdt.UI.Screens.Battle
{
    public readonly struct CurrentStatusPosition
    {public readonly float X,Y,Width;public CurrentStatusPosition(float x,float y,float width){X=x;Y=y;Width=width;}}
    public static class CurrentBattleStatusLayout
    {
        public static float ViewportHeight(bool compact)=>compact?28:59;
        public static List<CurrentStatusPosition> Arrange(IEnumerable<float> widths,float available,bool compact,out float contentHeight)
        {
            available=Math.Max(22,available);float x=0,y=1;var output=new List<CurrentStatusPosition>();
            foreach(float raw in widths){float width=Math.Min(available,Math.Max(1,raw));if(x>0&&x+width>available){x=0;y+=31;}output.Add(new CurrentStatusPosition(x,y,width));x+=width+7;}
            contentHeight=Math.Max(ViewportHeight(compact),y+27);return output;
        }
    }
}
