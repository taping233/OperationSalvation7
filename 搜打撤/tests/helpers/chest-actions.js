// Follow the visible reward continuation: fixed rewards exit directly; chest
// pickers return to the overview, where coins and final confirmation are separate.
export function continueChestRewards(actions, root = document) {
  if (root.querySelector('[data-act="chestContinue"]')) return actions.chestContinue();
  if (root.querySelector('.cqp-dialog') && !root.querySelector('.reward-final')) return actions.chestContinue?.();
  if (root.querySelector('[data-act="chestClosePicker"]')) actions.chestClosePicker();
  if (root.querySelector('[data-act="chestOverviewCoins"]')) actions.chestOverviewCoins();
  if (root.querySelector('[data-act="chestFinish"]')) return actions.chestFinish();
}

export function openChestPicker(actions, root = document) {
  if (!root.querySelector('.cqp-dialog') && root.querySelector('[data-act="chestNext"]')) actions.chestNext();
}

export function collectOverviewCoins(actions, root = document) {
  const picker = !!root.querySelector('.cqp-dialog');
  if (picker) actions.chestClosePicker();
  if (root.querySelector('[data-act="chestOverviewCoins"]')) actions.chestOverviewCoins();
  if (picker) openChestPicker(actions, root);
}
