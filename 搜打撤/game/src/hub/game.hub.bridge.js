/* game.hub.bridge.js —— 基地壳与切片的中立桥（2026-09-22 六文件重构批3，解环）。
 * 两件共享物：①slots.renderHub 由壳 game.hub.js 启动时注册，切片（depart/pages）只经
 * slots 间接重绘、禁止 import 壳——contracts.test 拒循环依赖；②homeRequestId 请求序号
 * 发生器（原 game.hub.js 28-29 行逐字），壳与仓库页共用。先例=bag-return-hook.js 中立小模块。 */
export const slots = {};
let homeRequestSeq = 0;
export const homeRequestId = prefix => `m05-${prefix}-${Date.now().toString(36)}-${++homeRequestSeq}`;
