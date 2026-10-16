// 出征选择的共享 live binding。只持有暂存引用，不装载页面、样式或存档。
// 规范化、档位/代次检查与选角状态仍归 game.hub.depart.js 管理。
export let deployPick = null;

export function replaceDeployPick(value) {
  deployPick = value;
}
