// Follow the visible reward continuation: fixed rewards exit directly; chest
// pickers return to the overview, where coins and final confirmation are separate.
export async function continueChestRewards(actions, root = document) {
  if (root.querySelector('[data-act="chestContinue"]')) return actions.chestContinue();
  if (root.querySelector('.cqp-dialog') && !root.querySelector('.reward-final')) return actions.chestContinue?.();
  if (root.querySelector('[data-act="chestClosePicker"]')) await actions.chestClosePicker();
  if (root.querySelector('[data-act="chestOverviewCoins"]')) await actions.chestOverviewCoins();
  if (root.querySelector('[data-act="chestFinish"]')) return actions.chestFinish();
}

export async function openChestPicker(actions, root = document) {
  if (!root.querySelector('.cqp-dialog') && root.querySelector('[data-act="chestNext"]')) await actions.chestNext();
}

export async function collectOverviewCoins(actions, root = document) {
  const picker = !!root.querySelector('.cqp-dialog');
  if (picker) await actions.chestClosePicker();
  if (root.querySelector('[data-act="chestOverviewCoins"]')) await actions.chestOverviewCoins();
  if (picker) await openChestPicker(actions, root);
}
