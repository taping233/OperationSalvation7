// 门的候选说明与回合效果一起保留，避免分句后丢失第二扇门的祝福池。
export function withBlessingChoices(text, description) {
  if (!/随机(?:获取|获得|施加).*祝福/.test(text)) return text;
  const choices = String(description || '').match(/（[^）]*从这些中随机[^）]*）|祝福包括[^。]*(?:。|$)/);
  return choices && !text.includes(choices[0]) ? text + choices[0] : text;
}

/** 每个友方独立抽取；无攻血场面物件不承载角色祝福。 */
export function applyRandomBlessings({ text, player, playerDefense, allies = [], combat, random01, log, esc }) {
  const targets = [{ unit: player, defense: playerDefense, name: '你' }];
  if (/全体友方/.test(text)) {
    allies.filter(ally => ally && !ally.dead && !ally.statless && ally.status && ally.hp > 0)
      .forEach(unit => targets.push({ unit, defense: unit.defense ||= { shield: 0, armor: 0, guard: false }, name: unit.name }));
  }
  let applied = 0;
  for (const { unit, defense, name } of targets) {
    const candidates = [];
    const blessing = (key, label) => candidates.push({
      fresh: !((unit.status?.[key] || 0) > 0), name: label,
      run: () => combat.addBlessing(unit, key, 1),
    });
    if (/潜行/.test(text)) blessing('stealth', '潜行');
    if (/攻击力/.test(text)) blessing('atkUp', '攻击力 +1');
    if (/法伤/.test(text)) blessing('spellUp', '法伤 +1');
    if (/减伤/.test(text)) blessing('reduce', '减伤 1');
    if (/护甲/.test(text)) candidates.push({ fresh: !(defense.armor > 0), name: '护甲 5', run: () => { defense.armor = (defense.armor || 0) + 5; } });
    if (/净化/.test(text)) candidates.push({ fresh: combat.hasCurse(unit), name: '净化', run: () => combat.purify(unit) });
    if (!candidates.length) continue;
    const fresh = candidates.filter(candidate => candidate.fresh);
    const pool = fresh.length ? fresh : candidates;
    const pick = pool[Math.floor(random01() * pool.length)];
    pick.run();
    log(`[[icon:sparkles]] ${esc(name)}获得<b>祝福·${esc(pick.name)}</b>（随机祝福，优先未获得）`, 'ok');
    applied++;
  }
  return applied;
}
