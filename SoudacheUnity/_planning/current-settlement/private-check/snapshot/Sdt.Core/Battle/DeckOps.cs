// ported from src/battle.deck.js
// 牌库操作：洗牌（card 流）与弃牌堆洗回。uid 列表原地操作，对齐 refillDrawPile/shuffleCards。
using System;
using System.Collections.Generic;

namespace Sdt.Core.Battle
{
    public static class DeckOps
    {
        /// <summary>Fisher-Yates 洗牌，随机走 card 流（对齐 Random.random('card')）。</summary>
        public static List<string> ShuffleCards(List<string> cards, Rng rng)
        {
            for (int i = cards.Count - 1; i > 0; i--)
            {
                int j = (int)Math.Floor(rng.Random("card", "shuffle") * (i + 1));
                string t = cards[i]; cards[i] = cards[j]; cards[j] = t;
            }
            return cards;
        }

        /// <summary>牌库空且弃牌堆非空时，把弃牌堆洗回牌库，返回洗回张数；否则不动返回 0。</summary>
        public static int RefillDrawPile(List<string> deck, List<string> discardPile, Rng rng)
        {
            if (deck.Count > 0 || discardPile.Count == 0) return 0;
            int recycled = discardPile.Count;
            var recycledCards = ShuffleCards(discardPile, rng);
            deck.AddRange(recycledCards);
            discardPile.Clear();
            return recycled;
        }
    }
}
