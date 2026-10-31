// Read-only event-option-state.js admission; commands retain payment and grant authority.
using System.Collections.Generic;
namespace Sdt.UI.Screens.Run
{
    public static class CurrentEventOptionState
    {
        public sealed class View{public string state="ready",note="",reason="",stateLabel;public bool disabled;}
        public static View Read(int hp,int coins,int healthCost,int coinCost,bool entry,bool? fits=null)
        {
            var view=new View();var notes=new List<string>();bool coinShort=false;
            if(healthCost>0){int remaining=hp-healthCost;view.state=remaining<=0?"lethal":"cost";notes.Add(remaining<=0?"会致死：当前 "+hp+" 生命，失去 "+healthCost+" 点生命":"失去 "+healthCost+" 点生命后剩余 "+remaining);}
            if(coinCost>0){if(coins<coinCost){if(view.state!="lethal")view.state="limited";coinShort=true;string shortage="金币不足：还差 "+(coinCost-coins)+" 币（当前 "+coins+"）";notes.Add(shortage);if(entry){view.disabled=true;view.reason=shortage;}}else notes.Add("支付 "+coinCost+" 币后剩余 "+(coins-coinCost));}
            if(fits.HasValue){if(!fits.Value&&view.state!="lethal")view.state="limited";notes.Add(fits.Value?"背包可容纳本次奖励":"当前背包装不下，选择后可整理背包");}
            view.stateLabel=view.disabled||view.state=="limited"&&coinShort?"金币不足":view.state=="lethal"?"致命风险":view.state=="cost"?"有代价":view.state=="limited"?"需整理":"可选择";
            view.note=string.Join("；",notes);return view;
        }
    }
}
