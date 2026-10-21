// @ts-check

/**
 * 战斗内卡牌数值上下文（2026-10-21 老板反馈#11「所有卡牌的数值要实际计算显示 在战斗中」）。
 *
 * 职责边界：
 *   - 战斗引擎装配时注册一个 provider，按需读取「当前实际加成」（基础属性 + 本场祝福）；
 *   - 未注册或战斗未激活时 readBattleValues() 返回 null，displayCardDescription 保持
 *     静态文案——地图背包、图鉴、文档生成（docs:compendium）与一切非战斗场景不受影响；
 *   - 只读，不缓存：每次渲染现取现算，加成变化后下一次渲染即反映新值。
 *
 * @typedef {{ active: boolean, atk: number, spellPower: number }} BattleValues
 * @type {(() => BattleValues | null) | null}
 */
let provider = null;

/**
 * 注册战斗数值提供器（引擎装配时调用；后注册者覆盖前者，符合单引擎运行口径）。
 * 返回上一个提供器，便于测试注册后原样恢复，不清掉引擎已注册的提供器。
 * @param {(() => BattleValues | null) | null} fn
 */
export function registerBattleValueProvider(fn) {
  const previous = provider;
  provider = typeof fn === 'function' ? fn : null;
  return previous;
}

/** 清除提供器（测试收尾/引擎卸载可选；battleActive=false 时 provider 自行返回 null）。
 * @param {(() => BattleValues | null) | null} [fn]
 */
export function clearBattleValueProvider(fn) {
  if (!fn || provider === fn) provider = null;
}

/** 读取当前战斗数值；非战斗场景返回 null（描述保持静态）。 @returns {BattleValues | null} */
export function readBattleValues() {
  if (!provider) return null;
  try {
    const values = provider();
    return values && values.active ? values : null;
  } catch {
    return null;   // 提供器异常不影响描述渲染
  }
}
