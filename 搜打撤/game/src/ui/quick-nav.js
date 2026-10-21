/* ============================================================
 * quick-nav.js —— 全页面快捷进入键（Alt+数字/字母）
 *
 * 每个页面注册 { key, id, name, enter, can }：can 不满足时拒绝并日志提示，
 * 绝不绕过既有状态守卫（战斗中不开基地/卡牌库等）。键位表由控制台
 * 「快捷键」页签（agent.console）读取展示，也可在此调整映射。
 * 输入焦点在文本框时自动让路（与 game.boot 的键位守卫同口径）。
 * ============================================================ */
import { cancelPendingPageEntries } from './page-entry-cancellation.js';
import { game, openSettings, openSuggestionInbox, openDataPageUi } from '../run/game.session.js';
import { openBaseHub } from '../hub/game.hub.js';
import { openCardLibrary, cancelPendingCardPageOpen } from '../hub/game.cardslib.js';

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

// why：守卫拦截时给「快捷键」页签展示的禁用原因文案（静态描述，与 can() 的实时判断一一对应）
const PAGES = [
  ...HUB_TABS.map(t => ({
    ...t,
    why: '战斗 / 研究所 / 跑局进行中不可返回基地',
    can: () => !busy() && !inRun(),
    enter: () => openBaseHub(t.tab),
  })),
  { key: '7', id: 'cardslib', name: '照相馆', why: '战斗 / 研究所进行中不可打开', can: () => !busy(), enter: () => openCardLibrary() },   // W1-07④：一物一名（标题钮同名为照相馆）
  { key: '8', id: 'inbox', name: '留言信箱', why: '战斗 / 研究所进行中不可打开', can: () => !busy(), enter: () => openSuggestionInbox() },
  { key: '9', id: 'data', name: '跑局数据', why: '战斗 / 研究所进行中不可打开', can: () => !busy(), enter: () => openDataPageUi() },   // W1-01：走带返回件的包装器
  { key: '0', id: 'settings', name: '设置', why: '战斗 / 研究所 / 跑局进行中不可打开', can: () => !busy() && !inRun(), enter: () => openSettings() },
];

function listPages() {
  return PAGES.map(p => ({ ...p, ok: !!p.can() }));
}

async function jump(id) {
  const page = PAGES.find(p => p.id === id);
  if (!page) return false;
  if (!page.can()) {
    UI()?.log(`[[icon:lock]] 快捷进入【${page.name}】在当前状态不可用（战斗/对局中受保护）`, 'warn');
    return false;
  }
  if (page.id !== 'cardslib') cancelPendingCardPageOpen();
  if (page.id !== 'cardslib' && !HUB_TABS.some(tab => tab.id === page.id)) cancelPendingPageEntries();
  try {
    return await page.enter() !== false;
  } catch (error) {
    UI()?.log(`[[icon:cross]] 快捷进入【${page.name}】失败：${String(error?.message || error)}`, 'warn');
    return false;
  }
}

function installQuickNav() {
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target instanceof Element ? e.target : null;
    const tag = target?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || (target instanceof HTMLElement && target.isContentEditable)) return;
    const page = PAGES.find(p => p.key === e.key);
    if (!page) return;
    e.preventDefault();
    jump(page.id);
  });
}

installQuickNav();

export { listPages, jump };
