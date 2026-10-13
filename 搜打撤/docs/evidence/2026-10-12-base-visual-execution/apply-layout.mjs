import fs from 'node:fs';
import postcss from 'postcss';

// Apply component rules in their existing source files, preserving other work.
const sheets = new Map();
function sheet(name) {
  const path = `game/css/${name}.css`;
  if (!sheets.has(path)) sheets.set(path, postcss.parse(fs.readFileSync(path, 'utf8'), { from:path }));
  return sheets.get(path);
}
function properties(rule, values) {
  for (const [prop, value] of Object.entries(values)) {
    const declarations = rule.nodes.filter(node => node.type === 'decl' && node.prop === prop);
    if (declarations.length) declarations.forEach(node => { node.value = value; });
    else rule.append({ prop, value });
  }
}
function set(name, suffix, values) {
  let count = 0;
  sheet(name).walkRules(rule => {
    if (rule.selector.endsWith(suffix)) { properties(rule, values); count++; }
  });
  if (!count) throw new Error(`Missing rule: ${name} ${suffix}`);
}
const scope = '#overlay#overlay #hubMain.pg.hub.base-camp.base-frame-v7.base-subpage';
function add(name, suffix, values) {
  const rule = postcss.rule({ selector:`${scope} ${suffix}` });
  properties(rule, values);
  sheet(name).append(rule);
}
const person = 'base-personnel-v12';
const ink = '#f0f4f3', muted = '#bccbd0', panel = 'rgba(20,29,35,.82)', line = '#d2e3e32e';
set('base-framework-v7', '.base-frame-v7', { '--base-v12-glass':'rgba(20,29,35,.76)', '--base-v12-line':line });
set(person, '.hub-page:has(> .personnel-v12)', { background:'transparent', '--camp-ink':ink, '--camp-muted':muted, '--camp-line':line, '--camp-accent':'#9edce7', '--camp-action':'#9edce7', '--camp-action-hover':'#bce8ee' });
set(person, '.personnel-v12', { background:'transparent', color:ink });
set(person, '.pv12-agent-workspace', { 'grid-template-columns':'minmax(360px,1fr) minmax(580px,1fr)', 'grid-template-rows':'92px minmax(0,1fr) 58px', gap:'16px 24px', padding:'16px 24px' });
set(person, '.pv12-agent-art', { background:panel, 'border-radius':'14px' });
set(person, '.pv12-agent-image-stage', { background:'transparent' });
set(person, '.pv12-agent-image-stage > img', { background:'transparent' });
set(person, '.pv12-agent-art figcaption', { padding:'12px 20px 16px', color:ink, background:'transparent' });
set(person, '.pv12-agent-art figcaption span', { color:muted, 'font-size':'20px' });
set(person, '.pv12-agent-strip', { height:'92px' });
set(person, '.pv12-agent-choice', { background:'#18272cb3', color:ink, 'border-width':'1px' });
set(person, '.pv12-agent-choice b', { 'font-size':'19px', 'line-height':'24px' });
set(person, '.pv12-agent-avatar', { width:'64px', height:'52px' });
set(person, '.pv12-agent-choice.on', { 'border-color':'#9edce7', background:'#9edce729' });
set(person, '.pv12-agent-data', { padding:'20px 24px', border:`1px solid ${line}`, 'border-radius':'14px', background:panel, 'box-shadow':'none' });
set(person, '.pv12-identity', { display:'flex', 'align-items':'baseline', gap:'16px', padding:'0 0 12px', background:'transparent', 'border-radius':'0', 'margin-bottom':'12px', 'border-bottom':`1px solid ${line}` });
set(person, '.pv12-identity h3', { 'font-size':'28px', margin:'0', color:ink });
set(person, '.pv12-identity small', { color:muted, 'font-size':'19px' });
set(person, '.pv12-identity > span', { 'font-size':'20px', 'margin-left':'auto' });
set(person, '.pv12-data-content', { color:ink, 'scrollbar-gutter':'auto' });
set(person, '.pv12-data-content h4', { 'font-size':'23px', margin:'8px 0', color:ink });
set(person, '.pv12-data-content p', { 'font-size':'22px', 'line-height':'1.5', margin:'6px 0 10px', color:ink });
set(person, '.pv12-data-content .hint', { 'font-size':'20px', color:muted });
set(person, '.pv12-sections', { background:panel, border:`1px solid ${line}`, 'border-radius':'12px' });
set(person, '.pv12-sections button', { 'font-size':'22px', 'font-weight':'700' });
set(person, '.personnel-v12 .person-level', { display:'inline-block', background:'transparent', padding:'0', 'border-radius':'0', 'margin-bottom':'8px' });
set(person, '.personnel-v12 .person-perk-value', { 'border-radius':'8px', padding:'8px 12px', background:'#9edce719' });
set(person, '.personnel-v12 .person-growth-progress', { 'border-top':`1px solid ${line}`, 'margin-top':'14px', 'padding-top':'8px' });
set(person, '.personnel-v12 .person-growth-actions', { position:'static', padding:'8px 0 0', background:'transparent' });
set(person, '.personnel-v12 .person-progress-track', { border:`1px solid ${line}`, background:'#080e14', height:'10px' });
set(person, '.personnel-v12 :is(.mini-btn,.base-command)', { 'min-height':'50px', border:`1px solid ${line}`, 'border-radius':'9px', padding:'8px 16px', color:ink, background:'#263840', 'font-size':'21px', 'font-weight':'700' });
set(person, '.personnel-v12 .base-command.base-command-primary', { color:'#14252b', background:'#9edce7', 'border-color':'transparent' });
set(person, '.personnel-v12 button:disabled', { opacity:'.66' });
set(person, '.personnel-v12 :is(input,select)', { 'font-size':'20px', color:ink, background:'#15232b', 'border-color':line });
set(person, '.personnel-v12 .person-skin-grid', { 'grid-template-columns':'repeat(2,minmax(0,1fr))', padding:'8px 0', 'max-height':'none', overflow:'visible', gap:'10px' });
set(person, '.personnel-v12 .person-skin', { background:'#15232b', color:ink, border:`1px solid ${line}`, padding:'6px' });
set(person, '.personnel-v12 .person-skin img', { height:'116px', background:'transparent' });
set(person, '.personnel-v12 .person-skin b', { 'font-size':'20px' });
set(person, '.personnel-v12 .person-skin small', { color:muted, 'font-size':'18px' });
set(person, '.pv12-page-head h2', { color:ink });
set(person, '.personnel-v12 .companion-toolbar', { background:'transparent', color:ink, 'font-size':'21px', padding:'10px 28px' });
set(person, '.personnel-v12 .partner-stage', { 'grid-template-columns':'minmax(340px,1fr) minmax(620px,1.15fr)', 'grid-template-rows':'minmax(0,1fr) 126px', gap:'16px 24px', padding:'0 28px 18px', background:'transparent' });
set(person, '.personnel-v12 .partner-display', { background:panel, color:ink, 'border-radius':'14px' });
set(person, '.personnel-v12 .partner-display > .companion-art', { width:'min(100%,470px)', height:'calc(100% - 100px)' });
set(person, '.personnel-v12 .partner-display h3', { color:ink });
set(person, '.personnel-v12 .partner-details', { padding:'18px 24px', border:`1px solid ${line}`, 'border-radius':'14px', background:panel, 'box-shadow':'none', gap:'10px' });
set(person, '.personnel-v12 .partner-details p', { 'font-size':'21px', margin:'0 0 6px', 'line-height':'1.45' });
set(person, '.personnel-v12 .partner-details h4', { 'font-size':'23px', margin:'10px 0 6px' });
set(person, '.personnel-v12 .warehouse-facts', { 'grid-template-columns':'1fr 1fr', gap:'16px' });
set(person, '.personnel-v12 .warehouse-facts > div', { background:'transparent', 'border-radius':'0', padding:'6px 0', 'font-size':'21px' });
set(person, '.personnel-v12 .companion-growth', { 'flex-direction':'row', gap:'24px', padding:'6px 0', background:'transparent', 'font-size':'21px' });
set(person, '.personnel-v12 .partner-stage .person-roster', { background:panel, padding:'8px' });
set(person, '.personnel-v12 .partner-stage .person-face', { 'min-height':'108px', padding:'4px', background:'transparent' });
set(person, '.personnel-v12 .partner-stage .person-face .companion-art', { height:'62px' });
set(person, '.personnel-v12 .partner-stage .person-face b', { 'font-size':'20px' });
set(person, '.personnel-v12 .partner-stage .person-face small', { 'font-size':'18px' });
set(person, '.personnel-v12 .companion-hatch-scene', { background:'transparent' });
set(person, '.personnel-v12 .companion-hatch-art', { background:panel, 'border-radius':'14px' });
add(person, '.partner-details .camp-costs', { 'font-size':'21px', margin:'8px 0' });
add(person, '.personnel-v12 .source-link', { display:'inline-flex', 'align-self':'flex-start', 'font-size':'20px', 'margin-top':'8px', color:'#9edce7' });
const logistics = 'base-logistics-trade-v12';
set(logistics, '& :is(.warehouse-v3.warehouse-v2,.trade-v5.trade-v12)', { '--camp-action':'#9edce7', '--camp-action-hover':'#bce8ee' });
set(logistics, '& .warehouse-categories-v7', { 'justify-content':'flex-start', margin:'0 0 4px', 'align-self':'flex-start' });
set(logistics, '& .warehouse-categories-v7 button', { 'font-size':'20px' });
set(logistics, '& .warehouse-categories-v7 button.on', { background:'#9edce7' });
set(logistics, '& .warehouse-toolbar', { margin:'0 0 12px', padding:'6px 0' });
set(logistics, '& .warehouse-toolbar :is(input,select)', { 'font-size':'21px', 'min-height':'46px', 'border-radius':'9px' });
set(logistics, '& .warehouse-toolbar input', { width:'280px' });
set(logistics, '& .warehouse-toolbar select', { width:'200px' });
set(logistics, '& [data-warehouse-count]', { 'font-size':'20px' });
set(logistics, '& .trade-v5-workspace', { 'grid-template-columns':'minmax(0,1fr) 480px' });
set(logistics, '& .trade-v5-list', { 'grid-template-columns':'repeat(auto-fill,minmax(220px,1fr))', gap:'16px' });
set(logistics, '& .trade-v5-desk', { padding:'22px', border:`1px solid ${line}`, 'border-radius':'14px', background:panel });
set(logistics, '& .trade-v5-desk-heading h3', { 'font-size':'30px' });
set(logistics, '& .trade-v5-desk-heading > span', { 'font-size':'20px' });
set(logistics, '& .trade-v5-description', { 'font-size':'22px', 'line-height':'1.55', color:ink });
set(logistics, '& .trade-v5-art', { height:'250px', 'min-height':'250px' });
set(logistics, '& .trade-v5-modes .base-link', { 'font-size':'21px' });
set(logistics, '& .trade-v5-modes .base-link.is-selected', { background:'#9edce7' });
set(logistics, '& .trade-v5-checkout button.base-command[data-act].base-command-primary', { background:'#9edce7' });
set(logistics, '& :is(.trade-v5-shortfall,.trade-v5-protection)', { 'font-size':'20px' });
add(logistics, '.trade-v12 .trade-v5-thumb .hs-card', { width:'210px', height:'298px' });
add(logistics, '.trade-v12 .trade-v5-art .hs-card', { width:'174px', height:'246px' });
add(logistics, '.trade-v12 .trade-v5-balance', { 'font-size':'22px', gap:'12px' });
add(logistics, '.trade-v12 .trade-v5-checkout .base-command', { 'font-size':'22px', 'min-height':'58px' });
const archive = 'base-archive-facilities-v12';
set(archive, '.archive-v12 .archive-status button', { 'font-size':'20px', padding:'10px 12px', 'white-space':'nowrap', 'word-break':'keep-all', flex:'1 0 auto', 'min-width':'118px' });
set(archive, '.archive-v12 .archive-status', { gap:'8px', 'justify-content':'flex-start' });
set(archive, '.archive-v12 .av3-medal-label b', { 'font-size':'23px' });
set(archive, '.archive-v12 .av3-medal-state', { 'font-size':'19px', padding:'6px 10px' });
set(archive, '.archive-v12 .story-entry', { background:'#17262de8', color:ink, padding:'16px', 'font-size':'22px' });
set(archive, '.facilities-v12 .facility-layout', { 'grid-template-columns':'230px minmax(0,.8fr) minmax(490px,1.2fr)' });
set(archive, '.facilities-v12 .facility-tile h3', { 'font-size':'22px' });
set(archive, '.facilities-v12 .facility-details', { gap:'22px', padding:'30px 36px' });
set(archive, '.facility-v12-caption p', { 'font-size':'22px', 'line-height':'1.55' });
set(archive, '.facility-v12-object', { 'min-height':'200px', flex:'none', height:'250px' });
set(archive, '.facilities-v12 .facility-benefit b', { 'font-size':'56px' });
add(archive, '.collection-empty .base-command', { flex:'none', 'align-self':'center', width:'auto', 'min-width':'220px', 'min-height':'58px', padding:'12px 24px', 'font-size':'22px' });
add(archive, '.archive-v12 .archive-status button :is(span,b)', { 'white-space':'nowrap', 'font-size':'inherit' });
add(archive, '.archive-v12 .archive-toolbar input', { 'font-size':'21px', padding:'10px 14px', width:'100%', 'box-sizing':'border-box' });
add(archive, '.archive-v12 .av3-medal-label small', { 'font-size':'20px' });
add(archive, '.archive-v12 .story-entry:disabled', { opacity:'1', color:muted, background:'#17262de8', cursor:'default' });
add(archive, '.archive-v12 .story-entry :is(b,small)', { color:'inherit', 'font-size':'20px' });
add(archive, '.av3-reward-inbox[data-empty="true"]', { display:'flex', 'flex-direction':'column', 'align-items':'center', 'justify-content':'center', gap:'24px', background:panel, border:`1px solid ${line}`, 'border-radius':'14px' });
add(archive, '.av3-reward-inbox[data-empty="true"] .av12-record-list', { order:'2', background:'transparent', border:'0', padding:'0', 'flex':'none' });
add(archive, '.av3-reward-inbox[data-empty="true"] .av12-record-list > header', { display:'none' });
add(archive, '.av3-reward-inbox[data-empty="true"] .av12-record-detail', { order:'1', background:'transparent', border:'0', padding:'0', 'backdrop-filter':'none' });
add(archive, '.av3-reward-inbox[data-empty="true"] .av3-inbox-empty', { padding:'0', 'text-align':'center' });
add(archive, '.av3-reward-inbox[data-empty="true"] .av3-reward-browse', { 'flex-direction':'row', gap:'24px', 'margin-top':'0', 'font-size':'22px' });
add(archive, '.facilities-v12 :is(.camp-costs,.hint,.base-link,.facility-v12-caption > span)', { 'font-size':'21px' });
add(archive, '.facilities-v12 .base-command', { 'font-size':'23px', 'min-height':'60px' });
// All lookups must succeed before any stylesheet is written.
for (const [path, ast] of sheets) fs.writeFileSync(path, ast.toString());
console.log(`Updated ${sheets.size} component stylesheets`);
