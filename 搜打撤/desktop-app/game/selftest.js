/* ============================================================
 * 搜打撤 —— 零依赖自测脚本（不进游戏页面，命令行直接跑）
 *
 * 运行方式（任一）：
 *   powershell -Command "$env:ELECTRON_RUN_AS_NODE=1; ..\..\desktop\electron\electron.exe selftest.js"
 *   或任何 node：node selftest.js
 *
 * 内容：
 *   1. combat.js 自测（四类伤害 + 诅咒状态引擎）
 *   2. cards.js 抽卡/注能词条回填抽查
 *   3. base.js 存档档位隔离 + 旧基地迁移 + 卡背解锁（模拟 localStorage）
 *   4. meta.js 成就领取解锁卡背
 *   5. battle.js / game.js 语法编译检查（不执行 DOM 逻辑）
 * ============================================================ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SHARED_SRC = fs.readFileSync(path.join(__dirname, 'src', 'shared.js'), 'utf8');
const GAME_PARTS = ['game.core.js', 'game.run.js', 'game.hub.js', 'game.bag.js', 'game.notes.js', 'game.cardslib.js', 'game.boot.js'];
const BATTLE_PARTS = ['battle.core.js', 'battle.view.js'];
const src = (p) => {
  if (p === 'game.js') return GAME_PARTS.map(f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n');
  if (p === 'battle.js') return BATTLE_PARTS.map(f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n');
  return fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
};
const sandbox = {
  console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  window: { SDT: { Icons: { img: () => '' } } },
};
sandbox.window.SDT = sandbox.window.SDT || { Icons: { img: () => '' } };
sandbox.SDT = sandbox.window.SDT;   // 浏览器里 window.SDT 即全局 SDT，沙箱里要显式注入
vm.createContext(sandbox);

let failed = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) { failed++; console.log(`✘ ${name}: 期望 ${want}，得到 ${got}`); }
  else console.log(`✔ ${name}`);
};

// 1+2: 执行 cards.js / combat.js 并跑自测
vm.runInContext(src('cards.js'), sandbox, { filename: 'cards.js' });
vm.runInContext(src('combat.js'), sandbox, { filename: 'combat.js' });
const SDT = sandbox.window.SDT;

const t = SDT.Combat.selfTest();
t.lines.forEach(l => console.log(l));
if (!t.pass) { failed++; console.log('combat.selfTest 失败：' + t.failed.join('; ')); }
else console.log(`combat.selfTest 全部通过（${t.total} 项）`);

// 抽卡/注能词条回填
const d = (desc) => SDT.Cards.deriveDraw({ desc });
const inf = (desc) => SDT.Cards.deriveInfuse({ desc });
const heal = (desc) => SDT.Cards.deriveHeal({ desc });
const armor = (desc) => SDT.Cards.deriveArmor({ desc });
check('deriveDraw 抽 2 张牌', d('摸底：抽 2 张牌。'), 2);
check('deriveDraw 优先已标注', SDT.Cards.deriveDraw({ draw: 3, desc: '抽 2 张牌' }), 3);
check('deriveDraw 无词条', d('造成 2 点伤害。'), 0);
check('deriveInfuse 注能(2)', inf('注能(2)：额外施放 1 段。'), 2);
check('deriveInfuse 注能（2）全角', inf('注能（1）：1′ 冰冻、流血、中毒。'), 1);
check('deriveInfuse 注能(小)=1', inf('注能(小)：改为 8′。'), 1);
check('deriveInfuse 无词条', inf('造成 3 点伤害，回复等量生命。'), 0);
check('deriveHeal 回复 6 点生命', heal('回复 6 点生命。'), 6);
check('deriveHeal +4 血', heal('+4 血。'), 4);
check('deriveHeal 优先结构化词条', SDT.Cards.deriveHeal({ heal: 9, desc: '回复 2 点生命。' }), 9);
check('deriveArmor 获得 5 点护甲', armor('获得 5 点护甲。'), 5);
check('deriveArmor +3 甲', armor('+3 甲。'), 3);
check('deriveArmor 优先结构化词条', SDT.Cards.deriveArmor({ armor: 8, desc: '获得 2 点护甲。' }), 8);
SDT.Icons.TYPE_ART = SDT.Cards.TYPE_ART; // 页面由 icons.js 提供；命令行沙箱补最小映射
check('卡面显示回复词条角标', SDT.Cards.cardHTML({ name: '疗愈', cost: 1, rarity: '初始', type: '法术', heal: 3 }).includes('回 3'), true);
check('卡面显示护甲词条角标', SDT.Cards.cardHTML({ name: '铁壁', cost: 1, rarity: '初始', type: '武术', armor: 4 }).includes('甲 4'), true);

// 战斗描述解析抽查（与 battle.js 内相同的正则语义）
const curse = (desc) => ({
  bleed: /附加\s*(\d+)\s*层?\s*流血/.test(desc) || /附加流血/.test(desc),
  poison: /附加\s*(?:(\d+)\s*层)?\s*中毒/.test(desc),
  freeze: !/免疫冰冻|对冰冻/.test(desc) && /附加冰冻|冰冻\s*所有|冰冻\s*\d+\s*名|冻结/.test(desc),
  silence: /沉默/.test(desc),
  abreak: /破甲/.test(desc),
  healban: /禁疗/.test(desc),
});
check('诅咒·毒箭=中毒', curse('攻⁺1，附加中毒。').poison, true);
check('诅咒·寒冰剑不误挂冰冻', curse('对冰冻角色伤害 +2。').freeze, false);
check('诅咒·冰心药水不误挂冰冻', curse('免疫冰冻，回复 3 点生命。').freeze, false);
check('诅咒·冰封千里挂冰冻', curse('冰冻所有敌人。').freeze, true);
check('诅咒·深渊诅咒=禁疗', curse("4′，附加禁疗；此时对方每有 1 种诅咒，抽 1 张牌。").healban, true);
check('诅咒·破甲重斩=破甲', curse('攻5，附加破甲；击杀则 +4 甲。').abreak, true);
check('诅咒·禁言术=沉默', curse('沉默 1 名角色 1 回合，抽 1 张牌。').silence, true);
check('诅咒·毒药=1层中毒', curse('附加 1 层中毒。').poison, true);
check('发现·寻宝', /发现\s*(?:(\d+)\s*张)?\s*(传说)?(?:卡牌|牌|卡)/.test("3′，发现 1 张牌。"), true);
check('发现·耀金令牌(传说)', /发现\s*(?:(\d+)\s*张)?\s*(传说)?(?:卡牌|牌|卡)/.exec('发现 1 张传说卡。')[2], '传说');
check('发现·阿波罗被动不误触发', /发现\s*(?:(\d+)\s*张)?\s*(传说)?(?:卡牌|牌|卡)/.test('发现或随机获取任何牌时，可直接施放。'), false);
check('随机获得·命运药水', (RandomGet => !!RandomGet)(/随机获取\s*(\d+)\s*张卡牌/.exec('混合：随机获取 2 张卡牌。')), true);

// 3+4: base.js 档位隔离 / 旧基地迁移 / 卡背 + meta.js 成就领卡背（模拟 localStorage）
const store = {};
const fakeLS = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const sb2 = { console, localStorage: fakeLS, window: { SDT: { Icons: { img: () => '' } } } };
sb2.SDT = sb2.window.SDT;
vm.createContext(sb2);
vm.runInContext(src('cards.js'), sb2, { filename: 'cards.js' });
vm.runInContext(src('base.js'), sb2, { filename: 'base.js' });
vm.runInContext(src('meta.js'), sb2, { filename: 'meta.js' });
const B2 = sb2.window.SDT.Base;
const M2 = sb2.window.SDT.Meta;

// —— 档位隔离 ——
B2.use(1); B2.data.wood = 9; B2.save();
check('slot1 木材落盘到独立键', JSON.parse(store['sdt-base-v2-slot1']).wood, 9);
B2.use(2);
check('slot2 基地独立（新档从零开始：木材 0）', B2.data.wood, 0);
check('旧档安全补齐累计游玩时间', B2.data.stats.playSeconds, 0);
B2.data.wood = 6; B2.save();
B2.use(1);
check('切回 slot1 数据不串档', B2.data.wood, 9);
check('peek(2) 只读不影响当前档', B2.peek(2).wood, 6);
check('hasSlot 检测已建档', B2.hasSlot(1), true);
B2.wipe(2);
check('wipe 清除档位2基地', B2.hasSlot(2), false);
check('wipe 不影响档位1', B2.hasSlot(1), true);

// —— 旧全局基地迁移 ——
store['sdt-base-v1'] = JSON.stringify({ wood: 12, rations: 3 });
store['sdt-save-v2-slot3'] = '{"turn":2}';
B2.migrateLegacy([3]);
check('旧全局基地迁入有对局存档的档位', JSON.parse(store['sdt-base-v2-slot3']).wood, 12);
check('迁移后旧键删除', store['sdt-base-v1'] === undefined, true);

// —— 卡背：默认解锁 / 成就领取解锁 / 装备 / 按档隔离 ——
check('默认卡背恒解锁', B2.isBackUnlocked('classic'), true);
check('猎手卡背初始未解锁', B2.isBackUnlocked('wolf'), false);
B2.data.stats.kills = 10;
check('领取「猎手」成就', M2.claim('kill10').ok, true);
check('成就解锁猎手卡背', B2.isBackUnlocked('wolf'), true);
check('重复领取被拒绝', M2.claim('kill10').ok, false);
check('装备猎手卡背', B2.setBack('wolf'), true);
check('backSel 生效', B2.backSel(), 'wolf');
check('当前卡背渲染 hb-wolf', sb2.window.SDT.Cards.cardBackHTML().includes('hb-wolf'), true);
check('指定卡背渲染 hb-altar', sb2.window.SDT.Cards.cardBackHTML('altar').includes('hb-altar'), true);
B2.use(2);
check('卡背解锁按档位隔离（slot2 无猎手）', B2.isBackUnlocked('wolf'), false);
check('slot2 backSel 回退默认', B2.backSel(), 'classic');
check('slot2 渲染回退默认卡背', sb2.window.SDT.Cards.cardBackHTML().includes('hb-classic'), true);
check('未解锁卡背不能装备', B2.setBack('boss'), false);

// —— 祝福/潜行描述解析抽查（与 battle.js v0.20 相同的正则语义） ——
const parseBlessing = (desc) => {
  const noCond = !/状态下/.test(desc);
  return {
    stealth: /潜行/.test(desc),
    stealthN: (desc.match(/潜行(?:状态)?\s*(\d+)\s*回合/) || [])[1] || null,
    atkUp: noCond && !!(desc.match(/攻击\s*\+\s*(\d+)/) || desc.match(/攻\s*\+\s*(\d+)/) ||
      desc.match(/\+\s*(\d+)\s*攻/) || desc.match(/获得\s*(\d+)\s*点?攻击力?/)),
    spellUp: noCond && !!(desc.match(/法伤\s*\+\s*(\d+)/) || desc.match(/法术伤害\s*\+\s*(\d+)/)),
    immune: /免疫伤害/.test(desc) || /无敌/.test(desc),
    immuneN: (desc.match(/(\d+)\s*回合内[^。]*无敌/) || desc.match(/无敌[^。]*?(\d+)\s*回合/) || [])[1] || null,
    reduce: /减伤/.test(desc),
    swordForm: /剑仙形态/.test(desc) || /每回合额外抽\s*\d+\s*张/.test(desc),
    natureForm: /自然形态/.test(desc) || /回合开始时[^。]*获得\s*\d+\s*点?能量/.test(desc),
    cosmosForm: /宇宙形态/.test(desc),
  };
};
check('祝福·潜匿=潜行1回合', (() => { const b = parseBlessing('进入潜行状态 1 回合。'); return b.stealth && b.stealthN === '1'; })(), true);
check('祝福·英雄卡潜行2回合', parseBlessing('潜入夺宝：净化陷阱，潜行 2 回合；破隐一连击开弹幕。').stealthN, '2');
check('祝福·追风剑=攻击力+1', parseBlessing('装备：攻击 +1。').atkUp, true);
check('祝福·长剑=攻击力+1', parseBlessing('+1 攻。').atkUp, true);
check('祝福·魔化药水=法伤+2', parseBlessing('本回合法术伤害 +2。').spellUp, true);
check('祝福·黑暗堡垒=免疫2回合', (() => { const b = parseBlessing('免疫 1 次致命伤害，并在 2 回合内处于无敌状态。'); return b.immune && b.immuneN === '2'; })(), true);
check('祝福·冰心药水不误挂免疫', parseBlessing('免疫冰冻，回复 3 点生命。').immune, false);
check('祝福·深解印记条件词条不误挂', (() => { const b = parseBlessing('诅咒状态下，攻 +2，法伤 +2。'); return !b.atkUp && !b.spellUp; })(), true);
check('祝福·剑仙附身=剑仙形态', parseBlessing('对决中，每回合额外抽 1 张。').swordForm, true);
check('祝福·宇宙形态关键词', parseBlessing('宇宙形态：本局对战内，所有卡牌变为 1 费。').cosmosForm, true);
check('祝福·伤害记号攻⁺n不算强化', parseBlessing('攻⁺1，抽 1 张牌。').atkUp, false);
check('祝福·破甲重斩的+4甲不算攻击', parseBlessing('攻5，附加破甲；击杀则 +4 甲。').atkUp, false);

// —— 词条时点体系抽查（与 battle.js v0.23 splitClauses 相同的正则语义） ——
const splitClauses = (desc) => {
  const out = { immediate: [], turnStart: [], battle: [], onInfused: [] };
  String(desc || '').split(/[。；;\n]/).forEach(s0 => {
    const s = s0.trim();
    if (!s) return;
    let m;
    if ((m = s.match(/^被注能时[：:，,]?\s*(.+)$/))) { out.onInfused.push(m[1]); return; }
    if ((m = s.match(/^(每回合开始时|下回合开始时?|下个回合开始时?|回合开始时)[：:，,]?\s*(.+)$/))) {
      out.turnStart.push({ text: m[2], each: /^每回合开始时/.test(s) });
      return;
    }
    if (/^(本局对战内|本场对战|本场战斗)/.test(s)) { out.battle.push(s); return; }
    out.immediate.push(s);
  });
  return out;
};
check('时点·回合开始时入延迟队列', (() => {
  const p = splitClauses('回合开始时，法伤 +1。'); return p.turnStart.length === 1 && p.turnStart[0].text === '法伤 +1';
})(), true);
check('时点·装备「每回合开始时」标记 repeat', (() => {
  const p = splitClauses('每回合开始时抽 1 张牌'); return p.turnStart.length === 1 && p.turnStart[0].each === true;
})(), true);
check('时点·普通句保持立即生效', (() => {
  const p = splitClauses('攻⁺1，附加流血。'); return p.immediate.length === 1 && !p.turnStart.length;
})(), true);
check('条件·被注能时剥出且不进立即段', (() => {
  const p = splitClauses('抽 1 张牌。被注能时：获得 2 点护甲。');
  return p.onInfused.length === 1 && p.onInfused[0] === '获得 2 点护甲' &&
    p.immediate.join('').indexOf('护甲') < 0 && p.immediate.join('').indexOf('抽 1 张牌') >= 0;
})(), true);
check('持续·本局对战内入持续段', (() => {
  const p = splitClauses('本场对战中，你的所有法术均为 1 费。');
  return p.battle.length === 1 && /所有法术[^。]*?1\s*费/.test(p.battle[0].replace(/^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*/, ''));
})(), true);
check('持续·「持续 N 回合」时长覆盖', (() => {
  const m = ('附加冰冻，持续 3 回合').match(/持续\s*(\d+)\s*回合/); return m && m[1] === '3';
})(), true);

// —— 位置词条与虚化判定抽查（与 battle.js v0.24 相同的正则语义） ——
check('位置·洗入N张随机卡牌', (pureShuffle => !!pureShuffle)('洗入 5 张随机卡牌'.match(/洗入\s*(\d+)\s*张随机卡牌/)), true);
check('位置·将x洗入牌库（数量+名字）', (() => {
  const m = '将 2 张大宝箱置入牌库'.match(/将\s*(?:(\d+)\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库/);
  return m && m[1] === '2' && m[2] === '大宝箱';
})(), true);
check('位置·流光斩复制放入牌库（剥复制）', (() => {
  const m = '将流光斩复制放入牌库'.match(/将\s*(?:(\d+)\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库/);
  return m && m[2] === '流光斩';
})(), true);
check('位置·普通抽牌句不误判洗入', !/洗入|置入牌库|放入牌库|牌库底|牌库上限/.test('抽 2 张牌。'), true);
check('位置·牌库类词条在普通战斗被虚化', /洗入|置入牌库|放入牌库|牌库底|牌库上限/.test('+10 甲，洗入 5 张随机卡牌。'), true);
check('位置·将x置入手牌', (() => {
  const m = '将青龙偃月斩置入手牌'.match(/将\s*(?:(\d+)\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?置入手牌/);
  return m && m[2] === '青龙偃月斩';
})(), true);
check('位置·置入牌库不误判置入手牌', !/置入手牌/.test('将 2 张大宝箱置入牌库'), true);

// —— BOSS 墓地状态机：弃牌堆可回收，墓地保持隔离 ——
// battle.js 的 refillDrawPile 故意只接收牌库/弃牌堆；墓地没有进入该状态转移的入口。
vm.runInContext(src('battle.js'), sandbox, { filename: 'battle.js' });
const deckProbe = [], discardProbe = ['弃1', '弃2'], graveProbe = ['墓1'];
check('BOSS·牌库空时仅回收弃牌堆', SDT.Battle._test.refillDrawPile(deckProbe, discardProbe), 2);
check('BOSS·弃牌堆已清空', discardProbe.length, 0);
check('BOSS·墓地不参与洗回', graveProbe.join(','), '墓1');
check('BOSS·牌库非空时不提前洗弃牌', SDT.Battle._test.refillDrawPile(deckProbe, ['弃3']), 0);

// game.js 依赖完整 DOM，命令行自测验证其关键状态机接线与语法；交互视觉由实际页面冒烟覆盖。
const gameSource = src('game.js');
const mapSource = src('mapData.js');
check('关卡·三环风险梯度已声明', /risk:\s*'低'/.test(mapSource) && /risk:\s*'中'/.test(mapSource) && /risk:\s*'高'/.test(mapSource), true);
check('关卡·内层精英概率保持 25%', /chance:\s*0\.25/.test(mapSource), true);
check('遭遇·策略预告元数据', /strategy:\s*'试探/.test(mapSource) && /strategy:\s*'压迫/.test(mapSource), true);
check('场景·10 张事件 sceneId 覆盖', ['timeskip','demondeal','bandits','mystery','goldmine','goldhammer','relief','airdrop','chestdraw','systemsupply'].every(k => new RegExp(`event-${k}`).test(gameSource)), true);
check('场景·标准节点与拾取契约', /scene-battle-bg/.test(gameSource) && /scene-extract-bg/.test(gameSource) && /scene-pickup-key/.test(gameSource), true);
check('场景·落脚进入全屏房间链', /UI\.beginRoom\(\)/.test(gameSource) && /_roomActive/.test(src('ui.js')), true);
check('音频·指定 MP3 作为循环 BGM', /bgm-black-stream-sea\.mp3/.test(src('sound.js')) && /bgm\.loop\s*=\s*true/.test(src('sound.js')), true);
check('战斗·意图轮转与 DOM 接线', /function intentFor/.test(src('battle.js')) && /foe\.intent = intentFor\(foe, turn\)/.test(src('battle.js')) && /bt-intent/.test(src('battle.js')), true);
check('战斗·拖牌 Pointer Events 接线保留', /pointerdown/.test(src('battle.js')) && /data-aim/.test(src('battle.js')) && /drag-over/.test(src('battle.js')), true);
check('BOSS·三类独立意图模式', /general.*军威强化/.test(src('battle.js')) && /orc_boss.*双击/.test(src('battle.js')) && /element_boss.*元素庇幕/.test(src('battle.js')), true);
check('敌人·全部图鉴具备行为钩子', ['infantry','archer','bandit','cavalry','orc_jav','orc_axe','wolf_rider','fire_el','water_el','grass_el','dragon'].every(k => new RegExp(`${k}[^\n]*behavior:`).test(mapSource)), true);
check('事件·二选一与三选一分支', /tt6-goldmine[\s\S]*?收下 3 币/.test(gameSource) && /tt6-airdrop[\s\S]*?应急处理/.test(gameSource) && /tt6-chestdraw[\s\S]*?中宝箱/.test(gameSource), true);
check('兼容·未知事件仍走旧效果', /return null;/.test(gameSource) && /applyEventEffect\(card\)/.test(gameSource), true);
check('BOSS·战斗/整理阶段锁住背包入口', /if \(game\.battleActive \|\| game\.bossCleanupPending\)/.test(gameSource), true);
check('BOSS·胜利进入整理背包状态', /showBossPackCleanup\(consumedUids \|\| \[\], settle\)/.test(gameSource), true);
check('BOSS·未选卡牌在确认时从 ownedCards 删除', /game\.ownedCards = game\.ownedCards\.filter\(o => !discardedUids\.has\(o\.uid\)\)/.test(gameSource), true);
check('档位概览仅展示游玩时间与已解锁成就', /<b>游玩时间<\/b>/.test(gameSource) && /<b>已解锁成就<\/b>/.test(gameSource), true);
check('背包入口支持再次点击关闭', /if \(!refreshOnly && backpackOpen/.test(gameSource), true);
check('背包缩略卡点击进入详情', /data-act="inspectStack"/.test(gameSource) && /function showBagCardDetail/.test(gameSource), true);
check('道具使用入口只在详情页生成', !/data-act="useStack"/.test(gameSource) && /data-act="useDetailCard"/.test(gameSource), true);
check('拖出背包弹出丢弃确认', /if \(!t\) \{ showDiscardConfirm\(d\.name, d\.fromSafe\)/.test(gameSource), true);

// 5: battle.js / game.js / ui.js 语法编译（不执行）
['battle.js', 'game.js', 'ui.js', 'chests.js'].forEach(f => {
  try { new vm.Script(src(f), { filename: f }); console.log(`✔ ${f} 语法 OK`); }
  catch (e) { failed++; console.log(`✘ ${f} 语法错误：${e.message}`); }
});

console.log(failed ? `\n共 ${failed} 项失败` : '\n全部通过 ✅');
process.exit(failed ? 1 : 0);
