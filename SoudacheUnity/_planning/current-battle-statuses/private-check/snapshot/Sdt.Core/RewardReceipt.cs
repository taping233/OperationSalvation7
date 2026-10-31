using System;
using System.Collections.Generic;

namespace Sdt.Core
{
    [Serializable]
    public sealed class ChestVisitReceipt
    {
        public string kind;
        public string title;
        public List<string> cardIds = new List<string>();
        public int coins;
        public string claimMode;
        public int choiceCount;
        public bool eggHit;
        public HashSet<int> taken = new HashSet<int>();
        public bool coinsTaken, completed;
    }
}
