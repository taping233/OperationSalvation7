/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;

// 制作坊写入口（当前冻结为 false：开发者工具与日常浏览分离，卡牌增删改走数据文件）
export const CARD_DESIGNER_WRITES_ENABLED = false;

// 音效统一走 SDT.Sound（sound.js：程序化音效 + 生成式背景乐）；保留别名兼容旧调用
export const Sfx = {
  tick() { SDT.Sound.sfx('hover'); },
  ding() { SDT.Sound.sfx('ding'); },
};

// 卡面渲染（已迁至 SDT.Cards.cardHTML，卡牌库/商店/背包/战斗共用）
export const cardHTML = (c, cls, opts) => SDT.Cards.cardHTML(c, cls, opts);

// 页面跳转钩子：game.hub.js 启动时经 configureCardNavigation 注入；
// 导出 navigation 对象本体，调用方（closeCardPageTop）在调用时读取最新钩子。
const navigation = {
  closeBase: () => {},
  renderHub: () => {},
  resetDeployPick: () => {},
};

function configureCardNavigation(hooks) {
  Object.assign(navigation, hooks || {});
}

export { navigation, configureCardNavigation };
