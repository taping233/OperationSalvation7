import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { baseHomeV3HTML } from '../game/src/hub/hub.home-v3.js';
import { beginnerGuideHTML } from '../game/src/ui/beginner-guide.js';
import guide from '../game/data/beginner-guide.json';

function home(mode = 'standard', ammoTaught = false) {
  return baseHomeV3HTML({ base: { data: { stash: [], pocket: [], ammoTaught }, bagCap: () => 16, stashCap: () => 25 },
    meta: { pendingColl: () => [], pendingAch: () => [] }, modes: { standard: { id: 'standard' }, elite: { id: 'elite', enemyMul: 1.5, coinMul: 1.5, xpMul: 1.5 } }, mode, prepared: false });
}
describe('新档最短目标与模式差异', () => {
  it('新档目标直达已有出征动作，已学会消耗规则后不再重复首次目标', () => {
    document.body.innerHTML = home(); const entry = document.querySelector('.base-home-first-objective');
    expect(entry.dataset.act).toBe('deploy'); expect(entry.textContent).toContain('首次目标');
    expect(entry.textContent).toContain('后勤使用'); expect(home('standard', true)).not.toContain('首次目标');
    const steps = entry.querySelector('small').textContent;
    expect(steps).toBe('撤离后，在后勤使用资源卡。');
    expect(document.querySelector('.base-home-preparation #btnDeploy')).not.toBeNull();
  });
  it('两模式均有就地说明，不把直入敌腹误写成跳过探索', () => {
    expect(home()).toContain('四层探索 · 基础难度');
    expect(home('elite')).toContain('四层探索');
    expect(home('elite')).toContain('敌人与首脑 ×1.5');
    expect(home('elite')).toContain('人物经验 ×1.5');
  });
  it('首脑章节按需展开防御准备，普通战斗页只教当前规则', () => {
    const battle = beginnerGuideHTML(guide.pages.findIndex(page => page.id === 'battle'));
    expect(battle).not.toContain('破甲');
    expect(battle).not.toContain('1/3');
    const html = beginnerGuideHTML(guide.pages.findIndex(page => page.id === 'extract'));
    expect(html).toContain('首脑战，先手动编组');
    expect(html).toContain('选择 15 张招式、装备或能力卡，再加入 5 张初始攻击');
    expect(html).toContain('开局抽 5 张，之后每回合抽 1 张，每回合 2 点基础能量');
    expect(html).toContain('手牌上限 8 张'); expect(html).toContain('首脑战不自动洗回');
    expect(battle).toContain('开局和每回合不自动抽牌');
    expect(html).not.toContain('48');
  });
  it('人物技能摘要复用无依赖纯数据源，不经技能模块加载战斗引擎', () => {
    const skill = readFileSync('game/src/battle/bag/battle.slam-skill.js', 'utf8');
    expect(skill).not.toMatch(/^import\s/m);
    expect(readFileSync('game/src/run/game.run.class-choice.page.js', 'utf8')).toContain('const skill = slamSkillFor(displaySel)');
  });
});
