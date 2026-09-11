import { createEffectPipeline, parsePoolNoun } from './effect-steps.js';

/**
 * 将卡牌自然语言拆成稳定的结算时点。这里只解析文本，不读写战斗状态。
 * @param {string} description
 */
function splitEffectClauses(description) {
  const out = { immediate: [], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] };
  String(description || '').split(/[。；;\n]/).forEach(source => {
    const text = source.trim();
    if (!text) return;
    let match;
    if ((match = text.match(/^被注能时[：:，,]?\s*(.+)$/))) {
      out.onInfused.push(match[1]);
      return;
    }
    if ((match = text.match(/^抽到(?:该牌|到该牌)?时(?:施放)?[:：]?\s*(.+)$/))) {
      out.onDraw.push(match[1]);
      return;
    }
    // 「抽到该牌时+动词」衍生牌触发（诛魔剑：抽到即结算，不占手牌）
    if ((match = text.match(/^抽到该牌时[:：]?\s*(.+)$/))) {
      out.onDraw.push(match[1]);
      return;
    }
    if ((match = text.match(/^(每回合开始时|每回合开始|下回合开始时|下回合开始|下个回合开始时|下个回合开始|回合开始时|回合开始)[：:，,]?\s*(.+)$/))) {
      out.turnStart.push({ text: match[2], each: /^每回合开始/.test(text) });
      return;
    }
    // 「限定技能：」句不随打出结算：装备穿戴后由角色信息区的技能按钮手动发动（2026-09-09 老板 #9）
    if ((match = text.match(/^限定技能[：:]\s*(.+)$/))) {
      out.skill.push(match[1]);
      return;
    }
    if (/^(本局对战内|本场对战|本场战斗)/.test(text)) {
      out.battle.push(text);
      return;
    }
    out.immediate.push(text);
  });
  return out;
}

/**
 * 创建文本效果执行器。所有状态变化都通过显式端口进入，解析层不再依赖战斗模块内部变量。
 * 结算本体在 effect-steps.js 的有序步骤表里（2026-09-11 架构批次 7 重写），本文件只做
 * 分句与装配——改动词/加效果去 effect-steps.js，别在这里加 if。
 * @param {object} deps
 */
function createEffectExecutor(deps) {
  return createEffectPipeline(deps);
}

// 「消耗该牌时」触发句提取（沉船宝盒/百炼青虹剑/矿工炸药/奥术残卷）：
// 由 battle.core 在两类消耗时点（注能牺牲 / 手选消耗）调用，剥离前缀后走常规结算
function consumeTriggerTexts(description) {
  const out = [];
  String(description || '').split(/[。；;\n]/).forEach(s => {
    const m = s.trim().match(/^消耗该牌时[：:，,]?\s*(.+)$/);
    if (m) out.push(m[1]);
  });
  return out;
}

export { createEffectExecutor, splitEffectClauses, parsePoolNoun, consumeTriggerTexts };
