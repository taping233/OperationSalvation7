/* 背包来源页返回钩子（迭代评审 09-20 C-P1）：
 * 从事件页/物资格页/商店等覆盖页上打开背包再关闭后，恢复原页面——此前事件/物资格页
 * 没有登记恢复路径，closeBackpack 兜底回 idle 会吞掉整格结算。
 * 独立成中立小模块：game.run.scenes / game.run.flow 与 game.bag 都要读写钩子，
 * 三方直接互相导入会成环；boot 原有 setBagReturnHook 引用经 game.bag 再导出不受影响。 */

let hook = null;

export function setBagReturnHook(fn) { hook = typeof fn === 'function' ? fn : null; }

// 取走钩子（消费后自动清空，防陈旧钩子在无关关闭路径上误触发）
export function takeBagReturnHook() { const h = hook; hook = null; return h; }
