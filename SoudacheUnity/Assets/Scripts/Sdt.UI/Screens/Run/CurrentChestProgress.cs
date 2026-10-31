// Pure closePicker/next decisions from the current run/chests.js; grants remain in GameRuntime.
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.UI.Screens.Run
{
    internal static class CurrentChestProgress
    {
        internal static bool Resolved(ChestVisitReceipt box)=>box!=null
            &&Enumerable.Range(0,box.cardIds.Count).All(i=>box.taken.Contains(i)||box.lost.Contains(i))
            &&(box.coins<=0||box.coinsTaken);
        internal static int PendingIndex(IReadOnlyList<ChestVisitReceipt> boxes)
        {
            for(int i=0;i<boxes.Count;i++)if(!boxes[i].completed&&!Resolved(boxes[i]))return i;
            return -1;
        }
        internal static bool AutomaticSingle(NodeVisitReceipt node,ChestVisitReceipt box,int receivedIndex)
            =>receivedIndex>=0&&!node.battleWon&&node.chestQueue.Count==1&&box.kind=="small"
                &&box.cardIds.Count==1&&box.claimMode!="one"&&Resolved(box);
    }
}
