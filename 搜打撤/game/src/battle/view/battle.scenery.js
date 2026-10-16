// 场景选择与站脚线为纯配置；画面解码、观察器与清理仍由战斗视图持有。
const platform = Object.freeze({ key:'winter-platform-minimal',
  far:new URL('../../../assets/scenes/battle/platform-minimal-1016/far.webp',import.meta.url).href,
  ground:new URL('../../../assets/scenes/battle/platform-minimal-1016/ground.webp',import.meta.url).href,
  foreground:new URL('../../../assets/scenes/battle/platform-minimal-1016/foreground.webp',import.meta.url).href,
  aspect:1672/941,footLine:.68,stageLayers:true });

export function selectBattleScenery({layerIdx=0,isBoss=false}={}) {
  // 层号与首脑参数保留原接口；当前所有战场共用本轮新站台三层场景。
  void layerIdx; void isBoss;
  return platform;
}

// 只在本场首次挂载时捕获层号；面板返回、重绘或旧解码回调不读取实时地图层。
export function createBattleSceneryCapture() {
  let token=null, selected=null;
  return (snapshot, fallbackLayer=0) => {
    if (token !== snapshot.battleToken || !selected) {
      token=snapshot.battleToken;
      selected=selectBattleScenery({layerIdx:Number.isInteger(snapshot.opts?.layerIdx) ? snapshot.opts.layerIdx : fallbackLayer,isBoss:!!snapshot.opts?.isBoss});
    }
    return selected;
  };
}
