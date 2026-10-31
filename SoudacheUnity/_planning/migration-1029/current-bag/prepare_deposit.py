from pathlib import Path
here=Path(__file__).resolve().parent
root=here.parents[2]
source=root/'Assets/Scripts/Sdt.Run/BaseData.cs'
text=source.read_text(encoding='utf-8-sig')
before='''        /// <summary>base.js depositCards(cards, toPocket)：同名堆叠；「初始攻击」不入仓库。</summary>
        public void DepositCards(IEnumerable<StashStack> cards, bool toPocket = false)
        {
            var list = toPocket ? pocket : stash;
            foreach (var c in cards ?? Enumerable.Empty<StashStack>())
            {
                if (!toPocket && IsSha(c.card)) continue;
                var stack = list.FirstOrDefault(x => x.card.name == c.card.name);
                if (stack != null) stack.count += c.count > 0 ? c.count : 1;
                else list.Add(new StashStack { card = c.card, count = c.count > 0 ? c.count : 1 });
            }
            Save();
        }'''
after='''        /// <summary>base.js appendCards：按 ID 与 variant 入库；职业卡不进基地消耗区，初始牌直接消散。</summary>
        public void DepositCards(IEnumerable<StashStack> cards, bool toPocket = false)
        {
            if (!GameRuntime.I.TryPersistMutation(() =>
            {
                RequireCurrentBase();
                var list = toPocket ? pocket : stash;
                foreach (var incoming in cards ?? Enumerable.Empty<StashStack>())
                {
                    if (incoming?.card == null || IsSha(incoming.card) || (toPocket && incoming.card.rarity == "职业")) continue;
                    // stored-card-identity.js ignores display names whenever either snapshot has an ID.
                    string Identity(StashStack item) => GameRuntime.DepartureStackKey(new StashStack {
                        card = item.card, variantKey = string.IsNullOrEmpty(item.variantKey) ? item.card?.variantKey : item.variantKey
                    });
                    string key = Identity(incoming);
                    var existing = list.FirstOrDefault(item => item.card != null && Identity(item) == key);
                    if (existing != null) existing.count += incoming.count > 0 ? incoming.count : 1;
                    else list.Add(new StashStack { card = incoming.card.Clone(), count = incoming.count > 0 ? incoming.count : 1,
                        stackKey = incoming.stackKey, variantKey = incoming.variantKey });
                }
                Save();
            }, out var reason)) throw new System.IO.IOException(reason);
        }'''
assert before in text,'DepositCards changed; coordinate before editing.'
output=here/'draft-run/BaseData.cs';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(text.replace(before,after,1),encoding='utf-8')
