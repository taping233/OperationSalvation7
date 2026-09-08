/* 手牌视图适配：只处理分组与布局，不读写战斗状态。 */

function groupHandCards(entries, infusing = null) {
  const groups = [];
  const push = (entry) => {
    const found = groups.find(group => group.card.name === entry.card.name && group.card.desc === entry.card.desc);
    if (found) found.uids.push(entry.uid);
    else groups.push({ card: entry.card, uids: [entry.uid], self: false });
  };
  if (infusing) {
    entries.forEach(entry => { if (entry.uid !== infusing.uid) push(entry); });
    const main = entries.find(entry => entry.uid === infusing.uid);
    if (main) groups.push({ card: main.card, uids: [main.uid], self: true });
  } else entries.forEach(push);
  return groups;
}

function splitHandRows(groups, maxPerRow = 8) {
  const rows = [];
  for (let i = 0; i < groups.length; i += maxPerRow) rows.push(groups.slice(i, i + maxPerRow));
  return rows;
}

function handCardLayout(index, count) {
  const offset = index - (count - 1) / 2;
  return {
    rotation: Number((offset * Math.min(5, 44 / Math.max(1, count))).toFixed(2)),
    marginLeft: index === 0 ? 0 : count > 9 ? -34 : count > 6 ? -14 : 0,
  };
}

export { groupHandCards, handCardLayout, splitHandRows };
