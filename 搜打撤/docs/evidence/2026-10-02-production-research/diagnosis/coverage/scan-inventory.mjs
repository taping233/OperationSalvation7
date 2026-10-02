import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { interfaceRows } from './interface-spec.mjs';
import { functionRows } from './function-spec.mjs';
import { CHARACTERS } from '../../../../../game/src/core/characters.js';
const root = process.cwd(), out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
// Windows URL pathname 解码一次，保留中文路径。只写本脚本所在coverage目录。
const outputDir = decodeURIComponent(out);
const require = createRequire(path.join(root, 'package.json'));
const { parse } = require('acorn'); // 复用仓库现有依赖；不安装。
const sourceRoot = path.join(root, 'game/src');
const walkFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walkFiles(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []).sort();
const sources = walkFiles(sourceRoot).map(file => ({ file: path.relative(root, file).replaceAll('\\','/'), text: fs.readFileSync(file, 'utf8') }));
const actions = [], overlays = [], listeners = [], uiTemplateActions = [], functions = [], failures = [], ruleRegistries = [], capabilityRegistries = [];
let actualCardTypes = [];
for (const src of sources) {
  let ast;
  try { ast = parse(src.text, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (e) { failures.push({ file: src.file, message: e.message }); continue; }
  const cut = n => src.text.slice(n.start, n.end);
  const at = n => ({ file: src.file, line: n.loc.start.line, endLine: n.loc.end.line });
  const visit = (n, parents = []) => {
    if (!n || typeof n !== 'object') return;
    const parent = parents.at(-1);
    const nameOf = (node, i) => node.id?.name || (parents[i - 1]?.type === 'VariableDeclarator' ? parents[i - 1].id?.name : null) || node.key?.name || node.key?.value || 'anonymous';
    const fn = parents.map((p, i) => /Function/.test(p.type || '') ? nameOf(p, i) : null).filter(Boolean).at(-1) || 'module';
    if (n.type === 'VariableDeclarator' && src.file.endsWith('effect-verbs.js') && ['VERBS','ELSEWHERE','DESIGNER_BLANKS'].includes(n.id?.name) && n.init?.type === 'ArrayExpression') {
      for (const entry of n.init.elements) {
        const values = Object.fromEntries((entry?.properties || []).map(p=>[p.key.name || p.key.value, p.value.type === 'Literal' && !p.value.regex ? p.value.value : cut(p.value)]));
        ruleRegistries.push({...at(entry),registry:n.id.name,...values});
      }
    }
    if (n.type === 'VariableDeclarator' && src.file.endsWith('card-rules.capability.js') && ['OPERATION_TARGETS','ACQUIRE_ACTIONS','SUPPORTED_HAND_OPS','SUPPORTED_ACQUIRE_FILTER_KEYS','BAG_SUPPORTED_OPS'].includes(n.id?.name)) capabilityRegistries.push({...at(n),name:n.id.name,definition:cut(n.init)});
    if (n.type === 'Property' && src.file.endsWith('cards.rules.js') && n.key?.name === 'TYPES' && n.value?.type === 'ArrayExpression') actualCardTypes = n.value.elements.map(e=>e.value);
    if (/Function/.test(n.type || '')) functions.push({ ...at(n), name: n.id?.name || (parent?.type === 'VariableDeclarator' ? parent.id?.name : null) || 'anonymous', exported: parents.some(p => p.type === 'ExportNamedDeclaration') });
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
      const method = n.callee.property.name || n.callee.property.value;
      const obj = cut(n.callee.object);
      if (method === 'act' && /(^|\.)UI$|^this$/.test(obj)) {
        const arg = n.arguments[0];
        const literal = arg?.type === 'Literal' && typeof arg.value === 'string';
        actions.push({ ...at(n), function: fn, action: literal ? arg.value : cut(arg), dynamic: !literal, removesHandler: n.arguments[1]?.name === 'undefined', handler: n.arguments[1] ? cut(n.arguments[1]) : '', receiver: obj });
      }
      if (['showOverlay','showScreen','showCardZoom','nodeShell'].includes(method)) overlays.push({ ...at(n), function: fn, method, receiver: obj, title: n.arguments[0] ? cut(n.arguments[0]).slice(0,350) : '' });
      if (method === 'addEventListener') listeners.push({ ...at(n), function: fn, receiver: obj, event: n.arguments[0] ? cut(n.arguments[0]) : '', handler: n.arguments[1] ? cut(n.arguments[1]) : '' });
    }
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && ['nodeShell','openPocketRestore','openBagSacrifice'].includes(n.callee.name)) overlays.push({ ...at(n), function: fn, method: n.callee.name, title: n.arguments[0] ? cut(n.arguments[0]).slice(0,350) : '' });
    if (n.type === 'TemplateElement' || (n.type === 'Literal' && typeof n.value === 'string')) {
      const value = n.type === 'TemplateElement' ? n.value.raw : n.value;
      for (const match of value.matchAll(/data-(act|action)=["']([^"']*)["']/g)) uiTemplateActions.push({ ...at(n), function: fn, kind: match[1], action: match[2], partialDynamic: !match[2] || match[2].includes('${') });
    }
    for (const [key, value] of Object.entries(n)) {
      if (['loc','start','end'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(c => { if (c?.type) visit(c, [...parents,n]); });
      else if (value?.type) visit(value, [...parents,n]);
    }
  };
  visit(ast);
}
const interfaces = interfaceRows.map(([id,name,parent,file,anchor,states,returns,persistence,status]) => {
  const full = 'game/src/' + file;
  const src = sources.find(s => s.file === full);
  const index = src?.text.indexOf(anchor) ?? -1;
  return { id,name,parent,entry: { file: full, line: index < 0 ? null : src.text.slice(0,index).split('\n').length, anchor }, states,returns,persistence,status, evidenceLevel: 'S', visualEvidence: '由art代理逐ID对账；此文件不冒充实页验收' };
});
const variants = [
  ...['CLASS-CHOICE','CLASS-POOL','HUB-CLASSES','HUB-COLLECTION'].flatMap(templateId => CHARACTERS.map(c => ({ id: `${templateId}-${c.id.toUpperCase()}`, templateId, name: `${c.name}·${c.rulesetId}`, value: c.rulesetId, sharedTemplate: true, note: templateId === 'CLASS-POOL' ? 'sel改变数据，10张上限均衡分页，完整池和详情；不是五套独立模板。' : '数据/立绘/规则变体；不是独立导航壳。', source: 'game/src/core/characters.js:3' }))),
  ...['deploy','stash','shop','upgrade','classes','ach'].map(tab => ({ id: `HUB-HELP-${tab.toUpperCase()}`,templateId:'HUB-HELP',name:tab,value:tab,sharedTemplate:true,source:'game/src/hub/game.hub.js:323',note:'六份独立说明内容与返回回调。' })),
  ...['standard','elite'].map(mode => ({id:`HUB-DEPLOY-${mode.toUpperCase()}`,templateId:'HUB-DEPLOY',name:mode,value:mode,sharedTemplate:true,source:'game/src/run/game.session.modes.js:9',note:'同地图倍率变体，不是额外地图。'})),
  ...['small','medium','big','class','bossReward','multiQueue','fullBag','emptyCatalog'].map(value => ({id:`CHEST-${value.toUpperCase()}`,templateId: value==='medium' ? 'CHEST-PICK' : 'CHEST-ALL',name:value,value,sharedTemplate:true,source:'game/src/run/chests.js:277',note:'箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。'})),
  ...[1,2,3,4].map(layer=>({id:`MAP-LAYER${layer}`,templateId:'MAP',name:`第${layer}层`,value:layer,sharedTemplate:true,source:'game/src/run/layeredMap.js',note:'不同地图内容/节点，非重复独立壳。'})),
  ...['backs','achievements','classes'].map(value=>({id:`HUB-ACH-VIEW-${value.toUpperCase()}`,templateId:({backs:'HUB-BACKS',achievements:'HUB-ACHIEVEMENTS',classes:'HUB-COLLECTION'})[value],name:value,value,sharedTemplate:true,source:'game/src/hub/game.hub.js:214',note:'三项在interface目录已各自单列。'})),
  ...['全部',...actualCardTypes].map(value=>({id:`STUDIO-TYPE-${value}`,templateId:'STUDIO',name:value,value,sharedTemplate:true,source:'game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25',note:'真实TYPES数组生成，共享筛选模板；不承诺每类有卡。'})),
  ...['crisis','flight','abyss'].map((value,i)=>({id:`LAB-ENDING-${i+1}`,templateId:'LAB-ENDING',name:value,value,sharedTemplate:true,source:'game/src/run/lab.ending.js:14',note:'三页独立文本与插画，暂缓研究所；非主图结局。'})),
];
const functionFamilies = functionRows.map(([id,intent,pattern,interfaceIds,prerequisite,result,risk,counterevidence,recommendation]) => ({id,intent,pattern,interfaceIds:interfaceIds.split(','),prerequisite,result,risk,counterevidence,recommendation,evidence:'S，引用当前实现与复用报告；风险未标已证即是待核假设'}));
const matchAction = a => {
  const key = a.dynamic ? (a.action.match(/^['"]([^'"]+)['"]/)?.[1] || a.action) : a.action;
  return functionFamilies.filter(f => new RegExp(f.pattern).test(key)).map(f=>f.id);
};
for (const a of actions) {
  a.functionFamilies = matchAction(a);
  a.reachability = a.function === 'showBagCardDetail' ? 'source-only历史保留函数' : a.file.includes('game.nest') ? 'deferred' : '静态注册；条件可达需实页核';
}
const ruleGroups = {
  R01:'damage aoeDamage aoeFixedByPrice damageRepeat damageReduce doubleDamageNext multiShot killReward structuredDamage repeatTimes extraCastTimes atkEqualToDamage hpThreshold hpHalfThreshold onKill',
  R02:'selfDamage heal armor maxHpUp stealth execute revive healEqualToDamage',
  R03:'curseAdd curseRandom curseCopyAll purify poisonBurst duration bleedDouble bleedTargetBonus vsFreezeBonus poisonLegacy curseImmune',
  R04:'draw drawUntil noDraw deckInsert handInsert handSelect discardOrConsumeHand graveScale keepInHand',
  R05:'attackMod costMod energyGain energyCapUp spellPowerUp fuelPriceScale selfCostZero prevCardBonus infuseBonusStructured infuseLeadBonus spellBonusDouble spellsInfused',
  R06:'discover discoverAndCast discoverCopy discoverInfuseFree potionDiscover getRandomCard getSpecificCard autoPlayHandType costSwapDiscover onAcquire',
  R07:'summonAlly extraTurn noDrawOrSkip tauntOthers stealAtk summonStatlessLimbs',
  R08:'nextSpellTwice blessingChoice castTimes combatStartPassive nextCastTimes consumeTrigger delayedGate',
  R09:'formSwitch mysteryEffect choiceBranch sealUnlock shaTransform imitate imitateInHand sealTransform',
  R10:'pocketUse container escape pouchCast pocketRestore',
  R11:'designerBlank unplayableSeal weaponCover',
};
for(const rule of ruleRegistries) rule.functionFamilies = Object.entries(ruleGroups).filter(([,ids])=>ids.split(' ').includes(rule.id)).map(([id])=>id);
// 非UI.act操作按接线文件分域，保留handler原文；事件级分类不冒充每个内部监听均为独立玩家功能。
const listenerDomain = file => file.includes('preparation.view') ? ['F25','F26'] : file.includes('home.scene') ? ['F66'] : file.includes('game.menu') ? ['F05','F07','F01'] : file.includes('game.cardslib.page') ? ['F29','F30'] : file.includes('cardslib.designer') ? ['F31'] : file.includes('sfx-audition') ? ['F65'] : file.includes('quick-nav') ? ['F63'] : file.includes('/battle/') ? ['F56','F57','F60','F61'] : file.includes('term-tips') ? ['F65'] : file.includes('game.boot') || file.includes('/core/input') ? ['F33','F65','F63'] : file.includes('/agent/') ? ['F63'] : file.includes('game.hub.depart') ? ['F27'] : file.includes('game.bag.drag') ? ['F54','F55'] : file.includes('game.run.altar') ? ['F28'] : file.includes('game.run.shop') ? ['F40','F41'] : file.includes('lab.ending') ? ['F64'] : file.includes('game.session.board') || file.includes('pocket-strip') ? ['F33'] : file.includes('/audio/sound') ? ['F07','F65'] : file.includes('/ui/ui.js') ? ['F30','F56','F65'] : file.includes('/ui/cinematics') ? ['F33'] : [];
for (const l of listeners) l.functionFamilies = listenerDomain(l.file);
const indexHtml = fs.readFileSync(path.join(root,'game/index.html'),'utf8');
const staticControls = [...indexHtml.matchAll(/<(button|input|textarea|select)\b[^>]*>/g)].map(m=>({tag:m[1],html:m[0],line:indexHtml.slice(0,m.index).split('\n').length,file:'game/index.html'}));
const inventory = { schemaVersion: 1, generatedAt: new Date().toISOString(), scope: '当前game/src全部JS静态注册、模板动作、DOM监听与显式界面目录；不是运行可达率或全卡组合覆盖率', sourceFiles: sources.map(s => ({file:s.file,lines:s.text.split('\n').length,sha256:crypto.createHash('sha256').update(s.text).digest('hex')})), interfaces, actions, dynamicActions: actions.filter(a => a.dynamic), overlayCalls: overlays, domListeners:listeners, templateActions:uiTemplateActions, functionEntrypoints:functions.filter(f => f.name !== 'anonymous'), parseFailures: failures, missingAnchors:interfaces.filter(i => !i.entry.line).map(i=>({id:i.id,entry:i.entry})), limitations:['AST解析避免把注释里的UI.act当注册；不会求值随机池/循环索引/条件分支。','data-act跨TemplateElement拼接不保证完整，因此partialDynamic显式保留。','直接监听器、HTML静态DOM入口需与game/index.html及boot输入规则人工对账。','完整静态列表不等于全部界面正常点击可达、故障分支或所有卡牌组合实测。'] };
Object.assign(inventory,{ variants,functionFamilies,staticControls,ruleRegistries,capabilityRegistries,unclassifiedRuleEntries:ruleRegistries.filter(r=>!r.functionFamilies.length),unclassifiedActions:actions.filter(a=>!a.functionFamilies.length),unclassifiedListeners:listeners.filter(a=>!a.functionFamilies.length),classificationNote:'UI.act逐注册对应玩家操作族；DOM监听只分域，由下表具体设置/输入项补足。低层动画/错误捕获/性能监听未分类不代表遗漏玩家按钮。' });
fs.writeFileSync(path.join(outputDir,'inventory.json'), JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({ interfaces:interfaces.length, variants:variants.length,families:functionFamilies.length,actionRegistrations:actions.length, dynamic:inventory.dynamicActions.length, overlayCalls:overlays.length, listeners:listeners.length, templates:uiTemplateActions.length, parseFailures:failures,missingAnchors:inventory.missingAnchors,unclassifiedActions:inventory.unclassifiedActions.map(a=>({file:a.file,line:a.line,action:a.action})) },null,2));
