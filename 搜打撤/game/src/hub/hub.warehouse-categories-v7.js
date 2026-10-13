const categories = [['', '全部', '▦'], ['battle', '战斗卡牌', '✦'], ['supplies', '消耗物品', '▣'], ['growth', '归档培养', '◈']];

export function warehouseCategoriesV7HTML(group = '') {
  return `<nav class="warehouse-categories-v7" aria-label="战利品用途">${categories.map(([id, name, icon]) => `<button type="button" class="${group === id ? 'on' : ''}" data-act="warehouseGroup" data-group="${id}" aria-pressed="${group === id}"><span aria-hidden="true">${icon}</span><b>${name}</b></button>`).join('')}</nav>`;
}
