/* battle.slam-skill.js —— 背包技能五职业分化（2026-10-02 老板：背包砸击换成技能，按五职业分化）。
 * 纯数据/派生模块（零导入零副作用）：bag 结算、view 按钮、aim 拖拽伪卡、agent 策略四处共用一份口径。
 * 职业口径 = game.myClass 的 rulesetId（cards.consts CLASSES：侠客/战士/牧师/法师/降临者）；
 * 老板原令中的「刺客」按 core/characters.js LEGACY 映射对应侠客。未知职业兜底 = 战士口径。
 * 字段：kind 结算分支 / name 按钮与日志名 / icon 图标 / cost 费用 / dmg·heal 数值 /
 *       needsTarget 是否点选敌人 / hint 按钮 title 与点选提示 / aimDesc 拖拽伪卡描述。 */

const SLAM_SKILLS = {
  '侠客': { kind: 'fixed',    name: '刺击', icon: 'swords', cost: 1, dmg: 2, needsTarget: true,
            hint: '1 费 · 造成 2 点固定伤害 · 不消耗卡牌', aimDesc: '2 点固定伤害' },
  '战士': { kind: 'attack',   name: '猛击', icon: 'swords', cost: 2, needsTarget: true,
            hint: '2 费 · 攻击一次（等同打出一张初始攻击）· 不消耗卡牌', aimDesc: '攻击一次' },
  '法师': { kind: 'acquire',  name: '搜刮', icon: 'cards',  cost: 1, needsTarget: false,
            hint: '1 费 · 随机获得一张卡牌入手牌 · 不消耗卡牌', aimDesc: '' },
  '降临者': { kind: 'fireball', name: '火球', icon: 'fire', cost: 2, dmg: 4, needsTarget: true,
            hint: '2 费 · 施放一次火球（4 点法伤）· 不消耗卡牌', aimDesc: '4 点法术伤害' },
  '牧师': { kind: 'heal',     name: '圣疗', icon: 'heart',  cost: 1, heal: 3, needsTarget: false,
            hint: '1 费 · 回复 3 点生命；使用后切换为「惩戒」（3 点法伤）· 不消耗卡牌', aimDesc: '' },
};
// 牧师惩戒态：3 点法伤、点选敌人；使用后切回圣疗。
const SLAM_SKILL_PRIEST_FLIPPED = { kind: 'spell', name: '惩戒', icon: 'fire', cost: 1, dmg: 3, needsTarget: true,
  hint: '1 费 · 造成 3 点法术伤害；使用后切换为「圣疗」（回复 3 点生命）· 不消耗卡牌', aimDesc: '3 点法术伤害' };

function slamSkillFor(cls, flipped = false, mode = null) {
  if (cls === '法师') {
    const destination = mode === 'boss' ? '随机获得一张非道具卡洗入牌库'
      : mode === 'normal' ? '随机获得一张卡牌入手牌' : '随机获得一张卡牌：普通战入手，首脑战排除道具并洗入牌库';
    return { ...SLAM_SKILLS[cls], hint: `1 费 · ${destination} · 不消耗卡牌` };
  }
  if (cls === '牧师' && flipped) return SLAM_SKILL_PRIEST_FLIPPED;
  return SLAM_SKILLS[cls] || SLAM_SKILLS['战士'];
}

export { slamSkillFor, SLAM_SKILL_PRIEST_FLIPPED };
