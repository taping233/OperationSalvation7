// Optional view port. Headless battles retain synchronous settlement without a presenter.
let defeatPresenter = null;
export function registerDefeatPresenter(presenter) { defeatPresenter = presenter; }
export function presentBattleDefeat(player) { return defeatPresenter?.(player) || null; }
