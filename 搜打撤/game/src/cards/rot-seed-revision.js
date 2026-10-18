// 10-18 定版：保留附加中毒，死亡效果改为被标记目标的群体真实伤害。
export const ROT_SEED_DESCRIPTION = '对 1 名敌人附加 2 层中毒并标记。被标记的敌人死亡时，对所有敌人造成等同于其死亡时中毒层数的真实伤害。';

export function rotSeedDescription(card) {
  return card?.id === 'cc-rot-seed' && /死亡时.*中毒层数转移/.test(String(card.desc || ''))
    ? ROT_SEED_DESCRIPTION : card?.desc;
}

export function ensureRotSeedRevision(cards) {
  const all = cards.all();
  let dirty = false;
  const next = all.map(card => {
    const desc = rotSeedDescription(card);
    if (desc === card.desc) return card;
    dirty = true;
    return { ...card, desc, rules:{ ...card.rules, version:1,
      battle:{ ...card.rules?.battle, target:{ side:'enemy', area:false }, hosted:['rot-seed'] } } };
  });
  if (dirty) cards.saveAll(next);
}
