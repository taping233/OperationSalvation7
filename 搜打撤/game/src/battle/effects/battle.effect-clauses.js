/**
 * 将卡牌自然语言拆成稳定的结算时点。这里只解析文本，不读写战斗状态。
 * @param {string} description
 */
export function splitEffectClauses(description) {
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
    // 「主动技能：」句不随打出结算：装备穿戴后由角色信息区的技能按钮手动发动（2026-09-09 老板 #9）
    // 2026-09-16 留言措辞改「主动技能」，兼容旧档快照的「限定技能」
    if ((match = text.match(/^(?:主动技能|限定技能)[：:]\s*(.+)$/))) {
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

