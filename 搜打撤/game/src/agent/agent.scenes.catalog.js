// ---------- 场景注册表 ----------
export const SCENE_CATALOG = Object.freeze({
  smoke:   { title: '冒烟一条龙', desc: '标题真实开局→走格→打完首战' },
  battle:  { title: '单场遭遇战', desc: '测试局直跳遭遇战并打完' },
  boss:    { title: 'BOSS 战', desc: '测试局直跳首脑（自动编组）并打完' },
  shop:    { title: '商店', desc: '测试局直跳商店并收口' },
  event:   { title: '事件', desc: '测试局直跳事件并走完分支' },
  fire:    { title: '火堆', desc: '测试局直跳火堆并完成' },
  altar:   { title: '祭坛', desc: '测试局直跳祭坛并完成仪式' },
  chest:   { title: '搜刮点', desc: '测试局直跳密封物资箱并开完' },
  extract: { title: '撤离结算链', desc: '开局 BFS 走到第三层紧急撤离点→献祭撤离→结算' },
  fullrun: { title: 'greedy 完整局', desc: 'strategic+turbo 打到撤离或死亡，断言自然收口', turbo: true },
});
