// Current extraction-rewards-view / settlement-report entry points. Persistent pages own their actual commands.
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class ExtractStashScreen:Panel
    {
        static ExtractStashScreen Current;CurrentExtractionPage _page;ExtractResult _result;
        public override bool CanCloseWithEscape=>false;
        public sealed class StashStack {public CardDef card;public int count;}
        public static void Open(List<StashStack> left){var result=GameRuntime.I.CurrentExtraction;if(result!=null)Present(result);}
        public static void Present(ExtractResult result)
        {
            if(result==null)return;if(result.Done){if(Current!=null)UiStack.Close(Current);if(!(UiStack.Top is ExtractDoneScreen))ExtractDoneScreen.Open(result);return;}
            if(Current==null){while(UiStack.Count>0)UiStack.Pop();Current=ScreenMount.Show<ExtractStashScreen>("ExtractStash");Current._result=result;Current.Build();}
            else{Current._result=result;Current._page.Refresh(result);}
        }
        public override void Build(){if(_page!=null)return;_page=UIKit.GetOrAdd<CurrentExtractionPage>(this);_page.Initialize(transform);_page.Refresh(_result??GameRuntime.I.CurrentExtraction);}
        internal override void OnClose(){if(Current==this)Current=null;}
    }
    public sealed class ExtractDoneScreen:Panel
    {
        ExtractResult _result;public override bool CanCloseWithEscape=>false;
        public static void Open(){var result=GameRuntime.I.FinishExtract();if(result!=null&&!(UiStack.Top is ExtractDoneScreen))Open(result);}
        public static void Open(ExtractResult result){var screen=ScreenMount.Show<ExtractDoneScreen>("ExtractDone");screen._result=result;screen.Build();}
        public override void Build()=>UIKit.GetOrAdd<CurrentSettlementReport>(this).BuildExtraction(this,_result);
    }
    public sealed class DeathScreen:Panel
    {
        DeathResult _result;public override bool CanCloseWithEscape=>false;
        public static void Open(int savedCount,string savedNames,long lostValue)
        {var screen=ScreenMount.Show<DeathScreen>("Death");screen._result=GameRuntime.I.CurrentDeath??new DeathResult{SavedN=savedCount,LostValue=lostValue};screen.Build();}
        public override void Build()=>UIKit.GetOrAdd<CurrentSettlementReport>(this).BuildDeath(this,_result);
    }
}
