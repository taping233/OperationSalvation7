using System;

namespace Sdt.Core
{
    [Serializable]
    public sealed class ShopOfferReceipt
    {
        public string cardId, label;
        public int price;
        public bool sold, empty, mystery, free;
        public int? shaReplenish;
    }
}
