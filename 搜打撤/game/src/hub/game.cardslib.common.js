/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;

// 照相馆与其他全屏菜单共用的 Escape 状态。页面实现按需加载，
// 因此状态和菜单间的同步关闭路由必须留在轻量共享层。
export let cardPageOpen = false;
export function setCardPageOpen(value) { cardPageOpen = !!value; }
let closeLibraryPage = null;
let closeDesignerPage = null;
let cancelPendingPageEntry = null;
export function configureCardPageClosers({ closeLibrary, closeDesigner } = {}) {
  closeLibraryPage = closeLibrary || null;
  closeDesignerPage = closeDesigner || null;
}
export function configurePendingCardPageEntry(cancel) { cancelPendingPageEntry = cancel || null; }
// 关页方（页面模块）同步中止门面 entry 机件的派发口：page-loading 尾巴（帧闸+180ms 淡出）
// 不随页面 close 结算，尾窗内重开会吃 pageEntryPromise 早退（10-05 打包门实测修）。
// 放本层避免 page→facade 静态回边（facade 已动态加载 page，回引即循环依赖，contracts 契约红）。
export function cancelPendingCardPageEntry() { return cancelPendingPageEntry?.() ?? false; }
export function closeCardPageTop() {
  if (cancelPendingPageEntry?.()) return;
  if (document.getElementById('cdesStage')) closeDesignerPage?.();
  else if (document.getElementById('depMain')) { navigation.resetDeployPick(); navigation.renderHub(); }
  else if (document.getElementById('hubMain')) navigation.closeBase();
  else closeLibraryPage?.();
}

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
// navigation 本体仅本模块 closeCardPageTop 在调用时读取最新钩子（历史导出零外部引用，2026-10-02 审计 A 档摘除）。
const navigation = {
  closeBase: () => {},
  renderHub: () => {},
  resetDeployPick: () => {},
};

function configureCardNavigation(hooks) {
  Object.assign(navigation, hooks || {});
}

export { configureCardNavigation };
