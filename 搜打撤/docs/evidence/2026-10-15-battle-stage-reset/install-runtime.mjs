// One-time source migration, not an acceptance runner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const root = process.cwd();
const evidence = 'docs/evidence/2026-10-15-battle-stage-reset';
const archive = path.join(root,evidence,'runtime-before');
const planned = new Map();
const originals = new Map();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function read(file) {
  if (!originals.has(file)) originals.set(file,fs.readFileSync(path.join(root,file)));
  return originals.get(file).toString('utf8').replace(/\r\n/g,'\n');
}
function change(file, transform) { planned.set(file,transform(planned.get(file) ?? read(file))); }
function once(text, before, after) {
  if (text.split(before).length !== 2) throw new Error(`Migration anchor changed: ${before.slice(0,85)}`);
  return text.replace(before,after);
}

change('game/src/battle/view/battle.layers.js',text => {
  text=once(text,"slot.style.setProperty('--fs', L.scale);","slot.style.setProperty('--fs', L.scale);\n    slot.style.setProperty('--hand-index', String(L.index ?? 0));");
  text=once(text,"function onTargetKeydown(e) {","function onTargetKeydown(e) {\n    if (e.target.closest('.sts-hand-tools')) return;");
  text=once(text,"if (e.target.closest('.sts-equip')) return;","if (e.target.closest('.sts-equip, .sts-hand-tools')) return;");
  return once(text,'if (selfAnchor !== selfUnit) selfAnchor.replaceWith(selfUnit);',
    `if (selfAnchor !== selfUnit) selfAnchor.replaceWith(selfUnit);
    const careerTools = body.querySelector('.sts-hand-tools');
    if (careerTools && careerTools.parentElement !== selfUnit) selfUnit.appendChild(careerTools);`);
});

change('game/src/battle/view/battle.view.js',text => {
  text=once(text,"const arena = sceneryStage.querySelector('.sts-arena');",`const arena = sceneryStage.querySelector('.sts-arena');
  if (sceneryConfig.stageLayers) {
    sceneryWorld.style.cssText = 'left:0;top:0;width:100%;height:100%;';
    if (sceneryFront) sceneryFront.style.cssText = 'left:0;top:0;width:100%;height:100%;';
    return;
  }`);
  text=once(text,"for (const key of config.image ? ['static'] : ['far', 'mid', 'ground']) {",
    "for (const key of config.image ? ['static'] : ['far', 'mid', 'ground'].filter(name => config[name])) {");
  text=once(text,"sceneryFront.setAttribute('aria-hidden', 'true'); UI.el.overlay.appendChild(sceneryFront);",
    "sceneryFront.setAttribute('aria-hidden', 'true'); (config.stageLayers ? stage : UI.el.overlay).appendChild(sceneryFront);");
  text=once(text,'if (front) {\n      stage.addEventListener',
    'if (front && !config.stageLayers) {\n      stage.addEventListener');
  const draw='        <div class="sts-hud-l" aria-label="抽牌堆">${drawPileHTML}</div>\n';
  text=once(text,draw,'');
  text=once(text,'      <div class="sts-hud">\n        <div class="sts-energy-wrap">',
    '      <div class="sts-hud">\n        <div class="sts-resource-dock">\n'+draw+'        <div class="sts-energy-wrap">');
  text=once(text,'        <div class="sts-hand-tools" aria-label="职业技能与手牌分栏">',
    '        </div>\n        <div class="sts-hand-tools" aria-label="职业技能与手牌分栏">');
  const start=text.indexOf('${esc(slamSkillInfo.name)}<span class="battle-skill-cost">');
  const end=text.indexOf('</button>',start);
  if (start<0 || end<0) throw new Error('Skill content anchor changed');
  const content=`<span class="battle-skill-copy"><small>职业技能 · \${esc(player.myClass || '')}</small><b>\${esc(slamSkillInfo.name)}</b><span>\${esc(slamSkillInfo.aimDesc || (slamSkillInfo.heal ? '回复 ' + slamSkillInfo.heal + ' 生命' : '随机获得1张牌'))}</span></span><span class="battle-skill-cost">\${slamSkillInfo.cost}<small>能量</small></span><span class="battle-skill-status">\${slamSkillInfo.used ? '本回合已用' : slamPending ? '请选择目标' : '每回合一次 · 不消耗卡牌'}</span>`;
  return text.slice(0,start)+content+text.slice(end);
});

change('game/src/battle/view/battle.scenery.js',text => {
  const start=text.indexOf("const bridge = Object.freeze(");
  const end=text.indexOf('const street =',start);
  if (start<0 || end<0) throw new Error('Scene catalog anchor changed');
  return text.slice(0,start)+`const bridge = Object.freeze({ key:'winter-bridge',
  far:new URL('../../../assets/scenes/battle/stage-reset-1015/backdrop.webp',import.meta.url).href,
  ground:new URL('../../../assets/scenes/battle/stage-reset-1015/ground.webp',import.meta.url).href,
  foreground:new URL('../../../assets/scenes/battle/stage-reset-1015/foreground.webp',import.meta.url).href,
  aspect:16/9,footLine:.615,stageLayers:true });
`+text.slice(end);
});

change('game/index.html',text => once(text,
  '<link rel="stylesheet" href="css/card-layout-selected.css" />',
  '<link rel="stylesheet" href="css/card-layout-selected.css" />\n<link rel="stylesheet" href="css/battle-stage.css" />'));

// Remove competing stage presentation rules, retaining dialogs, the battle-entry
// curtain, frame/action effects and non-battle consumers of generic card classes.
const owned = /^(?:battle-stage|battle-stage-shade|battle-scene(?:-.*)?|has-painted-scenery|sts-(?:topbar|encounter(?:-.*)?|phase-dot|options(?:-.*)?|arena(?:-.*)?|hud(?:-.*)?|hand(?:-.*)?|energy(?:-.*)?|tactics(?:-.*)?|end-turn|unit|me|foes?|allies|ally|figure|nameplate|headrow|you|atkbadge|hp(?:-.*)?|stats|chips|equips?|intent|xp(?:-.*)?)|battle-energy-label|battle-skill(?:-.*)?|bt-slam-btn|bt-hand-page|bt-slot)$/;
const preserve = /\.(?:fx-[\w-]+|dead|dying|sts-(?:float[\w-]*|impact[\w-]*|hurtflash|turnbanner)|bt-(?:fly[\w-]*|thought-bubble|fpreview)|battle-entry[\w-]*)\b/;
const cssFiles = new Set([
  ...[...read('game/index.html').matchAll(/href="(css\/[^"]+\.css)"/g)].map(m=>'game/'+m[1]),
  'game/css/battle-hand-overhaul.css',
]);
const removals=[];
for (const file of cssFiles) {
  if (file.endsWith('/battle-stage.css')) continue;
  const source=read(file);
  const sheet=postcss.parse(source);
  const removed=[];
  sheet.walkRules(rule => {
    if (rule.parent?.type==='atrule' && /keyframes$/i.test(rule.parent.name)) return;
    const keep=rule.selectors.filter(selector=>{
      if (preserve.test(selector.replace(/:not\(\s*\.dead\s*\)/g,''))) return true;
      const classes=[...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>m[1]);
      const retire=classes.some(name=>owned.test(name)) || (classes.includes('card')&&classes.includes('battle')) || /\[data-act=["']btSlam["']\]/.test(selector);
      if (retire) removed.push(selector);
      return !retire;
    });
    if (!keep.length) rule.remove(); else if(keep.length!==rule.selectors.length)rule.selectors=keep;
  });
  if (removed.length) {
    planned.set(file,sheet.toString());
    removals.push({path:file,selectors:removed});
  }
}

// Keep the preview's resource budget in step with the production dock.
change('docs/previews/battle-stage-reset-20261015/style.css',text => {
  const sheet=postcss.parse(text);
  const replacements={
    '.pile':{left:'80px',bottom:'90px',width:'max-content','flex-direction':'row',gap:'5px'},
    '.pile-art':{width:'24px',height:'34px'},
    '.pile-art svg':{width:'18px',height:'26px'},
    '.pile>b':{position:'static',width:'auto',height:'auto',padding:'0',background:'none',color:'#e7d4ad','font-size':'18px','line-height':'1','box-shadow':'none'},
    '.pile>span:last-child':{'font-size':'12px'},
    '.energy-zone':{left:'210px',bottom:'90px',width:'auto',height:'44px','flex-direction':'row',gap:'7px'},
    '.energy-mark':{gap:'5px'},'.energy-mark>b':{'font-size':'36px'},
    '.energy-mark>span':{'font-size':'16px'},'.energy-mark svg':{width:'18px',height:'22px'},
    '.energy-zone>.eyebrow':{'font-size':'12px',margin:'0','letter-spacing':'.05em'},
  };
  sheet.walkRules(rule=>{
    const values=replacements[rule.selector];
    if (!values) return;
    for (const [prop,value] of Object.entries(values)) {
      let found=false;rule.walkDecls(prop,d=>{d.value=value;found=true;});
      if(!found)rule.append({prop,value});
    }
  });
  return sheet.toString();
});

const assetFiles=[];
for(const name of ['backdrop','ground','foreground']) {
  const from=path.join(root,evidence,'layers',name+'.webp');
  const rel=`scenes/battle/stage-reset-1015/${name}.webp`;
  const bytes=fs.readFileSync(from);
  assetFiles.push({target:'game/assets/'+rel,bytes,path:rel});
}
change('game/assets/asset-manifest.json',text=>{
  const manifest=JSON.parse(text);
  for(const asset of assetFiles) {
    if(manifest.assets.some(entry=>entry.path===asset.path))throw new Error('Runtime scene already registered');
    manifest.assets.push({path:asset.path,ext:'webp',license:'项目原创（NAI草稿＋内置imagegen重绘）',bytes:asset.bytes.length,sha256:hash(asset.bytes),source:evidence+'/repaint-assets.json'});
  }
  manifest.count=manifest.assets.length;
  return JSON.stringify(manifest,null,2)+'\n';
});

// Source contracts track the new layered scene shape; no tests are executed.
change('tests/battle-scenery.test.js',text=>once(text,
  'expect([bridge.far,bridge.mid,bridge.ground,bridge.foreground].every(Boolean)).toBe(true);',
  "expect([bridge.far,bridge.ground,bridge.foreground].every(Boolean)).toBe(true);\n  expect(bridge.stageLayers).toBe(true);\n  expect(bridge.ground).toContain('stage-reset-1015/ground.webp');"));

fs.mkdirSync(archive,{recursive:true});
const receipt=[];
for(const [file,next] of planned) {
  const before=originals.get(file);
  if(!fs.readFileSync(path.join(root,file)).equals(before))throw new Error('Concurrent edit: '+file);
  const saved=path.join(archive,file.replaceAll('/','__')+'.txt');
  if(fs.existsSync(saved))throw new Error('Install already started; do not overwrite snapshots');
  fs.writeFileSync(saved,before);
  fs.writeFileSync(path.join(root,file),next);
  receipt.push({path:file,beforeSha256:hash(before),afterSha256:hash(next),snapshot:path.relative(root,saved)});
}
for(const asset of assetFiles) {
  const target=path.join(root,asset.target);fs.mkdirSync(path.dirname(target),{recursive:true});
  if(fs.existsSync(target))throw new Error('Do not overwrite existing scene asset');
  fs.writeFileSync(target,asset.bytes);
  receipt.push({path:asset.target,sha256:hash(asset.bytes),bytes:asset.bytes.length});
}
fs.writeFileSync(path.join(root,evidence,'runtime-install-receipt.json'),JSON.stringify({status:'implemented-unverified',acceptance:'skipped by explicit user instruction',files:receipt,retiredStageSelectors:removals},null,2)+'\n');
console.log('Installed runtime interface, scene assets, compact resources and canonical stage rules; acceptance not run.');
