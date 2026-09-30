/* game.session.modes.js —— 玩法模式规则（自 game.session.js 拆出，2026-09-25）。
 * 基地「出发」页选择的模式定义与数值缩放：敌人/金币/经验倍率、开局币、回燃修正。
 * 依赖内核（game/MAP），被背包经济、开局流程与读档归一化消费。 */
const SDT = window.SDT;
import { game, MAP } from './game.session.kernel.js';

const BASE_FIRE_HEAL = MAP.rules.fireHeal;
export const MODES = {
  standard: { id: 'standard', icon: '[[icon:map]]', name: '标准搜打撤',
    desc: '完整四层节点图：探索、搜刮与战斗，第四层经祭坛决战首脑后终局撤离。',
    enemyMul: 1, coinMul: 1, xpMul: 1, startCoins: 0, healMul: 1, ckpt: '规则无修正' },
  elite: { id: 'elite', icon: '[[icon:fire]]', name: '精英突袭',
    desc: '敌人与 BOSS 属性 ×1.5，战斗掉落金币 ×1.5，人物经验 +50%，高稀有度卡牌爆率 +20%。高风险高回报。',
    enemyMul: 1.5, coinMul: 1.5, xpMul: 1.5, startCoins: 0, healMul: 1, ckpt: '敌人 ×1.5 · 经验 +50% · 高稀有掉落 +20%' },
};
export const modeCfg = () => MODES[game.mode] || MODES.standard;
// 按当前模式缩放敌人属性（战斗格 / 事件战 / BOSS 通用）
export const scaledEnemy = (e) => {
  const m = modeCfg();
  if (!e || m.enemyMul === 1) return e;
  return { ...e, hp: Math.round(e.hp * m.enemyMul), atk: Math.round((e.atk || 2) * m.enemyMul) };
};
export const applyModeRules = () => {
  const m = modeCfg();
  MAP.rules.fireHeal = BASE_FIRE_HEAL * (m.healMul || 1);
  SDT.Meta.setXpMul(m.xpMul || 1);
};
