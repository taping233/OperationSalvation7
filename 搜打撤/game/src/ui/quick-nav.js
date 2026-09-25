/* ============================================================
 * quick-nav.js —— 全页面快捷进入键（Alt+数字/字母）
 *
 * 每个页面注册 { key, id, name, enter, can }：can 不满足时拒绝并日志提示，
 * 绝不绕过既有状态守卫（战斗中不开基地/卡牌库等）。键位表由控制台
 * 「快捷键」页签（agent.console）读取展示，也可在此调整映射。
 * 输入焦点在文本框时自动让路（与 game.boot 的键位守卫同口径）。
 * ============================================================ */
import { game, openSettings, openSuggestionInbox } from '../run/game.session.js';
import { openBaseHub } from '../hub/game.hub.js';
import { openCardLibrary } from '../hub/game.cardslib.js';
import { openDataPage } from '../agent/agent.data.js';

const busy = () => game.battleActive || game.nestActive;
const inRun = () => game.runActive;
const UI = () => window.SDT?.UI;

const HUB_TABS = [
  { key: '1', id: 'hubDeploy', name: '基地·出发', tab: 'deploy' },
  { key: '2', id: 'hubStash', name: '基地·仓库', tab: 'stash' },
  { key: '3', id: 'hubShop', name: '基地·商店', tab: 'shop' },
  { key: '4', id: 'hubUpgrade', name: '基地·升级', tab: 'upgrade' },
  { key: '5', id: 'hubClasses', name: '基地·人物', tab: 'classes' },
  { key: '6', id: 'hubAch', name: '基地·成就收藏', tab: 'ach' },
];

const PAGES = [
  ...HUB_TABS.map(t => ({
    ...t,
    can: () => !busy() && !inRun(),
    enter: () => openBaseHub(t.tab),
  })),
  { key: '7', id: 'cardslib', name: '卡牌库·照相馆', can: () => !busy(), enter: () => openCardLibrary() },
  { key: '8', id: 'inbox', name: '留言信箱', can: () => !busy(), enter: () => openSuggestionInbox() },
  { key: '9', id: 'data', name: '跑局数据', can: () => !busy(), enter: () => openDataPage() },
  { key: '0', id: 'settings', name: '设置', can: () => !busy() && !inRun(), enter: () => openSettings() },
];

function listPages() {
  return PAGES.map(p => ({ ...p, ok: !!p.can() }));
}

function jump(id) {
  const page = PAGES.find(p => p.id === id);
  if (!page) return false;
  if (!page.can()) {
    UI()?.log(`[[icon:lock]] 快捷进入【${page.name}】在当前状态不可用（战斗/对局中受保护）`, 'warn');
    return false;
  }
  try {
    page.enter();
    return true;
  } catch (error) {
    UI()?.log(`[[icon:cross]] 快捷进入【${page.name}】失败：${String(error?.message || error)}`, 'warn');
    return false;
  }
}

function installQuickNav() {
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || e.target?.isContentEditable) return;
    const page = PAGES.find(p => p.key === e.key);
    if (!page) return;
    e.preventDefault();
    jump(page.id);
  });
}

installQuickNav();

export { listPages, jump, PAGES };
