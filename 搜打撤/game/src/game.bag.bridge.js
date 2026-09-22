/* game.bag.bridge.js —— 背包壳与切片的中立桥（2026-09-22 六文件重构批4，解环）。
 * bagSlots：壳 game.bag.js 启动时注册本体函数（showBackpack/closeBackpack/排序三件套/pocketAdd），
 * drag/settle 切片只经 bagSlots 间接调用、禁止 import 壳（contracts 拒环）；drag 侧把 bindBagDrag
 * 反向注册回本对象（壳 showBackpack 渲染后经桥挂拖拽）。先例=game.hub.bridge.js（批3）与 bag-return-hook.js。 */
export const bagSlots = {};
