import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
});

let seq = 0;
function makeGame(cards) {
  const logs = [];
  return {
    ownedCards: cards.map(card => ({ uid: `late-${seq++}`, card: { ...card }, safe: false })),
    hp: 99, maxHp: 99, atk: 5, spellPower: 0, coins: 0, myClass: '降临者', state: 'idle', battleActive: false,
    logs, log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
}
const foe = (name) => ({ id: 'infantry', name, hp: 100, atk: 1 });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
async function settle(max = 200) {
  for (let i = 0; i < max; i++) {
    await tick();
    const s = BattleSession.getSnapshot();
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return BattleSession.getSnapshot();
}
const card = id => C.all().find(entry => entry.id === id);

describe('2026-09-20 晚间留言卡牌数据', () => {
  it('迷之匣和员工通行证B按定版入库，魔法锅炉退役', () => {
    expect(card('tt3eq-mistbox').rarity).toBe('史诗');
    expect(card('tt3eq-boiler')).toBeUndefined(); // 老板10-10删除魔法锅炉
    expect(card('tt-token-gold').desc).toContain('随机获取 1 张传说卡（不含棱彩卡）');
    const ability = C.all().find(entry => entry.type === '能力卡');
    expect(C.cardHTML(ability, 'sm')).toContain('data-term="ability"');
  });

  it('物资格、药水说明、能力提示与手牌翻页提醒均有界面守卫', () => {
    const events = readFileSync(resolve(process.cwd(), 'game/src/run/game.run.events.js'), 'utf8');
    const scenes = JSON.parse(readFileSync(resolve(process.cwd(), 'game/data/scenes.json'), 'utf8'));
    // 2026-09-22 battle.view 拆片：断言串（bt-hand-page 在 render 分派段）壳+六片拼接读
    const battleView = ['battle/view/battle.view.js', 'battle/view/battle.overlays.js', 'battle/view/battle.layers.js', 'battle/view/battle.vfx.js',
      'battle/view/battle.anim.view.js', 'battle/view/battle.aim.js', 'battle/view/battle.hover.js']
      .map((f) => readFileSync(resolve(process.cwd(), 'game/src', f), 'utf8')).join('\n');
    const battleCss = readFileSync(resolve(process.cwd(), 'game/css/battle.css'), 'utf8');
    expect(events).toContain('EVENT_SCENE_META[card.id]');
    expect(scenes.eventSceneMeta['tt6-airdrop']).toContain('scene-event-airdrop');
    expect(events).toContain("drawEventCards(card.name,'airdrop-potion',[potionPool]");
    expect(events).toContain('投骰前展示全部对应点数');
    expect(battleView).toContain('bt-hand-page has-more');
    expect(battleCss).toContain('@keyframes handPageReminder');
  });
});

describe('魔法锅炉退役', () => {
  it('完整播种后不再进入现役卡库', () => {
    expect(card('tt3eq-boiler')).toBeUndefined();
  });
});

describe('注能剩余链路', () => {
  it('多敌人时保留燃料并允许选择第二个目标', async () => {
    const game = makeGame([card('tt3sp-silverthorn'), card('tt3-holy-water')]);
    BattleSession.start(game, [foe('甲'), foe('乙')], { isBoss: false });
    await settle();
    const [laserUid, fuelUid] = game.ownedCards.map(entry => entry.uid);
    BattleSession.commands.playCard(laserUid, null);
    BattleSession.commands.selectInfusion(fuelUid);
    BattleSession.commands.confirmInfusion();
    expect(BattleSession.getSnapshot().pendingTarget).toBeTruthy();
    BattleSession.commands.playCard(laserUid, 1);
    const after = await settle();
    expect(after.foes[0].hp).toBe(100);
    expect(after.foes[1].hp).toBe(92);
    BattleSession.commands.flee();
  });

  it('纯注能牌不注能直打时不执行注能正文', async () => {
    const game = makeGame([card('tt7-meteorstrong')]);
    BattleSession.start(game, [foe('星陨靶子')], { isBoss: false });
    await settle();
    const uid = game.ownedCards[0].uid;
    BattleSession.commands.playDirect(uid);
    if (BattleSession.getSnapshot().pendingTarget) BattleSession.commands.playCard(uid, 0);
    const after = await settle();
    expect(after.foes[0].hp).toBe(100);
    expect(game.logs.some(line => line.includes('施放 3 次火球'))).toBe(false);
    BattleSession.commands.flee();
  });
});
