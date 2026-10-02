/* ============================================================
 * agent.protocol.js —— Agent 动作协议（契约 + 校验，纯模块）
 *
 * 动作 JSON 三型：
 *   { type:'ui',     name:'evtChoice', params:{ i:'0' } }   // 弹层按钮（data-act 面）
 *   { type:'move',   li:1, idx:4 }                          // 地图移动到相邻节点
 *   { type:'battle', name:'playCard', args:[uid, 0] }       // 战斗命令（SDT.Battle.commands）
 *   { type:'sys',    name:'startGame' }                     // 链路控制（标题起步等）
 *
 * 本文件只做形状校验与标识生成，不触碰运行时（可被 Node 无头批量直接 import）。
 * ============================================================ */

const UI_NAME_RE = /^[A-Za-z][\w:-]*$/;
// openBackpack：野外开背包（09-26 断链修复）——bagBtnFloat 无 data-act 且在 ovBody 外，
// surface 扫不到；showBackpack 只经 game.debug 暴露。协议补此入口后「背包满→开包→丢卡」成环
const SYS_COMMANDS = new Set(['startGame', 'reenter', 'noop', 'discardCard', 'openBackpack']);
// 战斗命令白名单：只放行决策相关命令；dev/refreshView 等调试口不进协议
const BATTLE_COMMANDS = new Set([
  'playCard', 'playDirect', 'endTurn', 'flee', 'surrender',
  'pickChoice', 'pickDiscover', 'pickHandSelect', 'skipHandSelect',
  'selectDeckCard', 'confirmDeck', 'cancelDeck',
  'beginInfusion', 'selectInfusion', 'confirmInfusion', 'cancelInfusion',
  'useItem', 'usePotion', 'useEquipSkill',
  // 砸击三件套：bagSlam（背包技能挂起触发，按职业 1-2 费——2026-10-02 老板五职业分化）
  // + resolveSlam/resolveDart（挂起态选目标
  // 出口）——引擎 commands 与动作面都有推送，白名单曾全漏（09-26 实测 334 次
  // BATTLE_COMMAND_UNKNOWN 拒绝，砸击/血毒双镖整条链路走不通，策略卡死到熔断）
  'bagSlam', 'resolveSlam', 'resolveDart',
  'cancelPendingTarget', 'cancelInteraction',
  'openBag', 'closeBag', 'openGrave', 'closeGrave', 'openDeckView', 'closeDeckView',
]);

// 动作 → 稳定标识（observe 输出 / LLM 引用 / 校验回查共用）
function actionId(action) {
  if (!action || typeof action !== 'object') return '';
  switch (action.type) {
    case 'ui': return `ui:${action.name}`;
    case 'move': return `move:${action.li},${action.idx}`;
    case 'battle': return `battle:${action.name}`;
    case 'sys': return `sys:${action.name}`;
    default: return '';
  }
}

const isParamsObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(v => v == null || ['string', 'number', 'boolean'].includes(typeof v));
};

// 形状校验：返回 { ok:true, action } 或 { ok:false, code, message }
function normalizeAction(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, code: 'ACTION_NOT_OBJECT', message: '动作必须是 JSON 对象' };
  }
  const { type } = input;
  switch (type) {
    case 'ui': {
      const name = String(input.name || '');
      if (!UI_NAME_RE.test(name)) return { ok: false, code: 'UI_NAME_INVALID', message: `非法 UI 动作名：${name}` };
      const params = input.params == null ? {} : input.params;
      if (!isParamsObject(params)) return { ok: false, code: 'UI_PARAMS_INVALID', message: 'params 只允许标量键值' };
      return { ok: true, action: { type: 'ui', name, params: { ...params } } };
    }
    case 'move': {
      const li = Number(input.li), idx = Number(input.idx);
      if (!Number.isInteger(li) || !Number.isInteger(idx) || li < 0 || idx < 0) {
        return { ok: false, code: 'MOVE_INVALID', message: 'move 需要非负整数 li/idx' };
      }
      return { ok: true, action: { type: 'move', li, idx } };
    }
    case 'battle': {
      const name = String(input.name || '');
      if (!BATTLE_COMMANDS.has(name)) return { ok: false, code: 'BATTLE_COMMAND_UNKNOWN', message: `不在白名单的战斗命令：${name}` };
      const args = input.args == null ? [] : input.args;
      if (!Array.isArray(args) || args.length > 4 || args.some(v => v != null && !['string', 'number', 'boolean'].includes(typeof v))) {
        return { ok: false, code: 'BATTLE_ARGS_INVALID', message: 'args 只允许最多 4 个标量' };
      }
      return { ok: true, action: { type: 'battle', name, args: [...args] } };
    }
    case 'sys': {
      const name = String(input.name || '');
      if (!SYS_COMMANDS.has(name)) return { ok: false, code: 'SYS_COMMAND_UNKNOWN', message: `未知链路命令：${name}` };
      const args = input.args == null ? [] : input.args;
      if (!Array.isArray(args) || args.length > 4 || args.some(v => v != null && !['string', 'number', 'boolean'].includes(typeof v))) {
        return { ok: false, code: 'SYS_ARGS_INVALID', message: 'sys.args 只允许最多 4 个标量' };
      }
      return { ok: true, action: { type: 'sys', name, args: [...args] } };
    }
    default:
      return { ok: false, code: 'ACTION_TYPE_UNKNOWN', message: `未知动作类型：${String(type)}` };
  }
}

export { actionId, normalizeAction };
