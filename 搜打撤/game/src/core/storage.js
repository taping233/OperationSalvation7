/* ============================================================
 * storage.js —— UI 偏好键的安全存储封装（存储收口批 2026-09-25）
 *
 * 全仓 localStorage 直读/直写的最小封装层：隐私模式/配额满时裸调
 * localStorage 会抛异常。语义与 game.menu.js 设置页就地版
 * （迭代评审 09-20 G-P2）逐字一致，audio/input/notes/battle.pace
 * 各域所有者亦采用同款就地 try/catch 模式。
 * 只服务 UI 偏好键（sdt-log-collapsed / sdt-hintbar / sdt-banner /
 * sdt-reduce-shake）；对局与基地存档走 hub 域封装，留言库走
 * ui/feedback.local.js 专用封装，卡牌库走 cards/cards.js 封装。
 * ============================================================ */
const storeGet = (key, fallback = null) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const storeSet = (key, val) => { try { localStorage.setItem(key, val); return true; } catch { return false; } };

export { storeGet, storeSet };
