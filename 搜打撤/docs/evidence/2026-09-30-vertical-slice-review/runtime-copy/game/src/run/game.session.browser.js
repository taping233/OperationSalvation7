/* game.session.browser.js —— 会话启动所需的 DOM 适配器。
 * 只在启动装配时显式调用；模块导入本身不查询 DOM。 */
export function createGameCanvas(documentPort) {
  const canvas = documentPort.getElementById('game');
  // alpha:false——每帧都会整屏铺背景，不透明画布可让合成器跳过透明混合。
  // 不启用 desynchronized：本机混合显卡 A/B 中它会让交换链吞吐明显下降。
  const ctx = canvas.getContext('2d', { alpha: false });
  return { canvas, ctx };
}
