import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const planning = path.dirname(here);
const threadId = '01a0fc3c-b8ec-7d82-851d-26c02dc55f4e';
const outputDir = path.join(here, 'outputs', threadId);
const qaDir = path.join(here, 'qa');
const finalName = '搜打撤_总体改造计划与分表.xlsx';
const font = 'Arial';
const inputDigests = {};
const palette = { ink: '#243244', navy: '#263B56', blue: '#385B78', rule: '#B7C5D3', pale: '#F2F5F8', input: '#FFF3CB' };

async function readJson(relative) {
  const full = path.join(planning, relative);
  const bytes=await fs.readFile(full);
  inputDigests[relative] = crypto.createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
}
function columnName(index) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}
function plain(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(plain).filter(Boolean).join('\n');
  if (typeof value === 'object') return Object.entries(value).map(([k,v]) => `${k}：${plain(v)}`).join('\n');
  return String(value);
}
function required(value, context) {
  if (!value || !Array.isArray(value)) throw new Error(`${context}必须是数组；输入未就绪或schema不一致。`);
  return value;
}

function rowHeight(values, widths) {
  const maxLines = Math.max(...values.map((value, i) => {
    const available = Math.max(4, Math.floor((widths[i] - 24) / 15));
    return plain(value).split('\n').reduce((sum,line) => {
      const units = [...line].reduce((n,c) => n + (/[^\u0000-\u00ff]/.test(c) ? 1 : .52), 0);
      return sum + Math.max(1, Math.ceil(units / available));
    },0);
  }));
  const height = Math.max(42, Math.ceil(maxLines * 19 + 20));
  if (height > 540) throw new Error(`长文需增宽或按语义拆行，预计行高${height}px超过可读Excel单行上限。`);
  return height;
}

function splitLongText(value,width) {
  const text = plain(value);
  const available = Math.max(4,Math.floor((width - 24) / 15));
  const visualLines = [];
  const originalLines = text.split('\n');
  for (let lineIndex=0;lineIndex<originalLines.length;lineIndex++) {
    const line=originalLines[lineIndex];
    let current = '', units = 0;
    for (const c of line) {
      const next = /[^\u0000-\u00ff]/.test(c) ? 1 : .52;
      if (units + next > available && current) { visualLines.push({text:current,hardEnd:false}); current=''; units=0; }
      current += c; units += next;
    }
    visualLines.push({text:current,hardEnd:lineIndex < originalLines.length - 1});
  }
  const chunks = [];
  for (let start=0; start<visualLines.length; start+=24) chunks.push(visualLines.slice(start,start+24).map(v=>v.text+(v.hardEnd ? '\n':'')).join(''));
  if (chunks.join('') !== text) throw new Error('长文拆分改变原始文字。');
  return chunks;
}

function fitLongRows(spec) {
  spec.logicalRecords = spec.rows.length;
  const rows = [];
  for (const row of spec.rows) {
    let needsSplit = false;
    try { rowHeight(row,spec.widths); } catch { needsSplit=true; }
    if (!needsSplit) { rows.push(row); continue; }
    const chunks = row.map((cell,i)=>splitLongText(cell,spec.widths[i]));
    const count = Math.max(...chunks.map(v=>v.length));
    for (let page=0;page<count;page++) {
      const part = chunks.map(v=>v[page] || '');
      const [idIndex,nameIndex] = spec.identityIndices || [0,1];
      part[idIndex]=row[idIndex]; part[nameIndex]=page ? `${row[nameIndex]}（续${page+1}）` : row[nameIndex];
      if (spec.orderIndex !== undefined) part[spec.orderIndex]=row[spec.orderIndex];
      rows.push(part);
    }
  }
  spec.rows=rows;
  spec.continuationRows = rows.length - spec.logicalRecords;
  if (spec.continuationRows) spec.context += ' 长说明按同ID续行保留；负责人和状态只填主行。';
  return spec;
}

function addSheet(workbook, spec, index) {
  const sheet = workbook.worksheets.add(spec.name);
  const lastCol = columnName(spec.headers.length - 1);
  const headerRow=spec.headerRow || 5;
  const firstRow=headerRow + 1;
  const end = spec.rows.length + headerRow;
  const body = sheet.getRange(`A1:${lastCol}${end}`);
  body.format.font = { name: font, size: 11, color: palette.ink };
  body.format.verticalAlignment = 'center';
  body.format.horizontalAlignment = 'left';
  sheet.showGridLines = false;
  sheet.tabColor = index < 2 ? palette.navy : spec.tabColor || palette.blue;
  sheet.getRange('A2').values = [[spec.title]];
  sheet.getRange('A2').format.font = { name: font, size: 16, bold: true, color: palette.navy };
  sheet.getRange(`A2:${lastCol}2`).format.rowHeightPx = 35;
  sheet.getRange(`A2:${lastCol}2`).format.borders = { bottom: { style: 'thin', color: palette.rule } };
  // The title is intentionally unmerged. The blank adjacent cells permit natural overflow.
  sheet.getRange('A3').values = [[spec.context]];
  sheet.getRange('A3').format.font = { name: font, size: 11, italic: true, color: '#64748B' };
  sheet.getRange(`A3:${lastCol}3`).format.rowHeightPx = 25;
  for (const [i,text] of (spec.quickFixBlock || []).entries()) {
    sheet.getRange(`B${i+5}`).values=[[text]];
    sheet.getRange(`B${i+5}`).format.font={name:font,size:i === 0 ? 13 : 11,bold:i === 0,color:i === 0 ? palette.navy:palette.ink};
    sheet.getRange(`B${i+5}`).format.wrapText=false;
    sheet.getRange(`A${i+5}:${lastCol}${i+5}`).format.rowHeightPx=28;
  }
  sheet.getRange(`A${headerRow}:${lastCol}${headerRow}`).values = [spec.headers];
  sheet.getRange(`A${headerRow}:${lastCol}${headerRow}`).format = {
    fill: palette.navy,
    font: { name: font, size: 11, bold: true, color: '#FFFFFF' },
    wrapText: true, horizontalAlignment: 'center', verticalAlignment: 'center', rowHeightPx: 44,
    borders: { insideVertical: { style: 'thin', color: '#FFFFFF' } }
  };
  if (spec.rows.length) {
    sheet.getRange(`A${firstRow}:${lastCol}${end}`).values = spec.rows;
    const data = sheet.getRange(`A${firstRow}:${lastCol}${end}`);
    data.format.wrapText = true;
    data.format.verticalAlignment = 'top';
    const table = sheet.tables.add(`A${headerRow}:${lastCol}${end}`, true, `PlanTable${index + 1}`);
    table.style = 'TableStyleLight9';
    table.showFilterButton = true;
    table.showTotals = false;
    spec.rows.forEach((row,i) => {
      sheet.getRange(`A${i + firstRow}:${lastCol}${i + firstRow}`).format.rowHeightPx = rowHeight(row, spec.widths);
    });
    for (const editable of spec.editable || []) {
      const address = `${columnName(editable.index)}${firstRow}:${columnName(editable.index)}${end}`;
      const input = sheet.getRange(address);
      input.format.fill = palette.input;
      if (editable.options) input.dataValidation = { rule: { type: 'list', values: editable.options } };
      if (editable.status) {
        input.conditionalFormats.add('containsText', { text: '阻塞', format: { fill: '#FCE7E7', font: { color: '#9C2525', bold: true } } });
        input.conditionalFormats.add('containsText', { text: '暂缓', format: { fill: '#ECEFF3', font: { color: '#64748B' } } });
      }
    }
  }
  spec.widths.forEach((width,i) => sheet.getRange(`${columnName(i)}1:${columnName(i)}${end}`).format.columnWidthPx = width);
  sheet.freezePanes.freezeRows(headerRow);
  sheet.freezePanes.freezeColumns(spec.freezeColumns || 2);
  return { sheet, end, lastCol, spec, headerRow };
}

const statuses = ['待实施', '先验证', '进行中', '待验证', '完成', '阻塞', '暂缓', '已修复·保持', '冻结·不排期'];
const initialSystemStatus = id => id === 'SYS-15' ? '已修复·保持' : id === 'SYS-19' ? '冻结·不排期' : ['SYS-04','SYS-05'].includes(id) ? '先验证' : '待实施';
const editable = count => [{ index: count - 2 }, { index: count - 1, options: statuses, status: true }];
const labeled = entries => entries.filter(([,v]) => plain(v)).map(([label,v]) => `${label}：${plain(v)}`).join('\n');
function filesText(values) {
  return (values || []).map(file => typeof file === 'string' ? file :
    `${file.path || file.file || ''}${file.line ? `:${file.line}` : ''}${file.anchor ? `\n定位：${file.anchor}` : ''}${file.exists === false ? '\n需新建' : ''}`).join('\n');
}
function referenceText(ref) {
  if (!ref) return '';
  if (Array.isArray(ref)) return ref.map(referenceText).join('\n');
  if (typeof ref === 'string') return ref;
  return labeled([['参考',ref.referenceId],['游戏',ref.game],['画面证据',ref.level],['可以借鉴',ref.canBorrow],['不能照搬',ref.cannotCopy],['动效证据',ref.motionLevel],['证据限制',ref.limit]]);
}
function problemsText(page) {
  return labeled([
    ['当前问题',(page.currentProblems || []).map(p => typeof p === 'string' ? p : labeled([['位置',p.location],['现象',p.symptom],['为什么影响使用',p.whyRough],['核查状态',p.status],['问题验收',p.acceptance]])).join('\n')],
    ['保留优点',page.strengths]
  ]);
}
function motionText(motion) {
  if (!motion || typeof motion !== 'object') return plain(motion);
  return labeled([['什么时候触发',motion.trigger],['过程中看到什么',motion.process],['结束后保持什么',motion.end],['中断或连续操作',motion.interrupt],['未验证范围',motion.evidenceLimit]]);
}
function evidenceText(basis) {
  if (!basis || typeof basis !== 'object') return plain(basis);
  if (Array.isArray(basis)) return basis.map(v=>typeof v === 'string' ? v : labeled([['证据',v.path],['来源',v.source],['已读',v.reviewed ? '是':'否']])).join('\n');
  return labeled([
    ['状态',basis.status],
    ['画面证据',(basis.images || []).map(v=>labeled([['路径',v.path],['来源',v.source],['已读',v.reviewed ? '是':'否']])).join('\n')],
    ['源码证据',basis.source ? labeled([['文件',`${basis.source.path || ''}${basis.source.line ? `:${basis.source.line}`:''}`],['入口',basis.source.anchor],['范围',basis.source.boundary]]) : ''],
    ['服务修复说明',basis.repairCorrection]
  ]);
}
function changesText(value) {
  if (!Array.isArray(value)) return plain(value);
  return value.map(change => {
    if (typeof change === 'string') return change;
    return labeled(Object.entries(change).map(([k,v]) => [{id:'条目',action:'动作',what:'改什么',why:'为什么',how:'怎么改',detail:'说明',location:'位置',reuse:'复用',acceptance:'验收',priority:'优先级'}[k] || k,v]));
  }).join('\n');
}

function orderSystems(systems) {
  const byId = new Map(systems.map(s=>[s.id,s]));
  const edges = new Map(systems.map(s=>[s.id,[...new Set(plain(s.dependencies).match(/SYS-\d+/g) || [])]]));
  for (const [id,deps] of edges) for (const dep of deps) if (!byId.has(dep)) throw new Error(`${id}硬前置引用未知工作包${dep}。`);
  const done = new Set(), ordered=[];
  while (ordered.length < systems.length) {
    const ready=systems.filter(s=>!done.has(s.id) && edges.get(s.id).every(d=>done.has(d))).sort((a,b)=>(a.phase || '').localeCompare(b.phase || '') || a.id.localeCompare(b.id));
    if (!ready.length) throw new Error(`工作包硬依赖有环，不能作为执行计划：${systems.filter(s=>!done.has(s.id)).map(s=>s.id).join(',')}`);
    const next=ready[0]; ordered.push(next); done.add(next.id);
  }
  return {ordered,edges};
}

async function makeSpecifications(inputs) {
  const pageInput = inputs['pages/pages.json'];
  const systemInput = inputs['systems/systems.json'];
  const resourceInput = inputs['systems/resources.json'];
  const pages = required(pageInput.pages,'pages.pages');
  const variants = required(pageInput.variants,'pages.variants');
  const systems = required(systemInput.systems,'systems.systems');
  const resources = required(resourceInput.resources,'resources.resources');
  const {ordered:orderedSystems} = orderSystems(systems);
  const executionOrder = new Map(orderedSystems.filter(s=>!['SYS-15','SYS-19'].includes(s.id)).map((s,i)=>[s.id,i+1]));
  const phaseLabels = new Map((systemInput.phases || []).map(p=>[p.id, p.name || p.title || p.id]));
  const phaseText = phase => `${phase || ''}${phaseLabels.has(phase) ? ` ${phaseLabels.get(phase)}` : ''}`;
  const sourceNote = source => `输入：planning/${source}。黄色栏填写负责人和执行状态。`;
  const overallHeaders = ['执行顺序','工作包ID','工作包','阶段','优先级','为什么先做','具体怎么改','硬前置条件','预期收益','如何验收','改动位置','范围与风险','负责人','执行状态'];
  const overall = {
    name:'总体计划', title:'总体改造计划', context:'顺序按硬依赖排列；协同另列架构分表。已修复维护与冻结项不排实施顺序。黄色负责人和状态栏可编辑。',
    headers:overallHeaders, widths:[80,110,180,190,110,340,420,310,320,390,340,320,110,110], editable:editable(overallHeaders.length), identityIndices:[1,2], orderIndex:0, freezeColumns:3,headerRow:12,
    quickFixBlock:[
      '可先独立做的小修',
      '首脑日志：第五层与四层规则不一致。改为读取四层真源。位置 game/src/hub/game.bag.settle.js:308。验收：击破首脑后的日志与真实出口层一致。',
      'AMMO图解：两列都用初始攻击会误导牌的去向。左列换可入口袋的普通牌。位置 game/src/hub/game.bag.settle.js:127。验收：左右两列各自遵守实际消耗规则。',
      '供给页：口袋条遮住标题。修复口袋条与标题安全区。位置 game/css/pocket-strip.css、game/css/expedition-rewards.css。验收：CLASS-GRANT稳定帧标题和数量均完整。',
      'NOTES-CLEAR：清空是危险操作。风险视觉与现有默认取消焦点对齐。位置 game/src/hub/game.notes.js:184、game/css/overlays.css。验收：取消焦点清楚且不意外清空。',
      '这四项不用等待完整存档或回执架构工作包。它们属于对应工作包内的小片，不重复计工作量。'
    ],
    rows:orderedSystems.map(s=>[executionOrder.get(s.id) ?? null,s.id,s.domain,phaseText(s.phase),s.priority,plain(s.problem),plain(s.recommendation),plain(s.dependencies),plain(s.benefit || s.expectedBenefit || '输入未提供独立收益说明，需在实施前补清改善结果。'),plain(s.acceptance),filesText(s.files),labeled([['改动范围',s.scopeCost],['风险',s.risks]]),'',initialSystemStatus(s.id)])
  };
  const archHeaders = ['功能ID','功能领域','当前问题与证据','现在的结构','建议的新结构','接口与状态','实施步骤','保留什么','代码位置','依赖与风险','工具和资源','验收标准','实施阶段','负责人','执行状态'];
  const arch = {
    name:'架构功能',title:'架构与功能改造',context:sourceNote('systems/systems.json'),headers:archHeaders,widths:[110,180,370,360,440,400,420,310,360,320,260,390,210,110,110],editable:editable(archHeaders.length),
    rows:systems.map(s=>[s.id,s.domain,labeled([['问题',s.problem],['证据',s.evidence]]),plain(s.architectureBefore),plain(s.architectureAfter),plain(s.interfacesAndState),plain(s.steps),plain(s.keep),filesText(s.files),labeled([['硬前置',s.dependencies],['需要同步的部分',s.coordination],['风险',s.risks]]),labeled([['工具',s.tools],['资源ID',s.resourceIds],['功能入口ID',s.functionIds]]),plain(s.acceptance),labeled([['阶段',phaseText(s.phase)],['优先级',s.priority],['范围',s.scopeCost]]),'',initialSystemStatus(s.id)])
  };
  const gateHeaders = ['条目类型','ID','阶段或决策主题','默认实施方案','何时需要','通过条件或待明确问题','对应工作包','仍可继续的工作','负责人','执行状态'];
  const gates = {name:'阶段与决策',title:'阶段验收与待明确事项',context:sourceNote('systems/systems.json'),headers:gateHeaders,widths:[130,110,280,430,310,440,300,350,110,110],editable:editable(gateHeaders.length),
    rows:[
      ...(systemInput.phases || []).map(p=>['阶段',p.id,p.name,'',plain(p.prerequisites || p.dependencies),plain(p.exit),plain(p.systemIds),'','','']),
      ...(systemInput.decisions || []).map(d=>['待明确事项',d.id,d.topic,plain(d.defaultRecommendation),plain(d.whenNeeded),plain(d.question),plain(d.systemIds),plain(d.notBlocking),'',''])
    ]};
  const pageHeaders = ['页面ID','页面名称','证据与适用范围','当前问题与保留优点','具体怎么改','布局字体颜色材质','动效过程与边界','复用组件与状态','实现位置','独立游戏参考','资源与工具','验收标准','实施安排','负责人','执行状态'];
  const pageSpecs = [
    {name:'美术_入口基地', title:'入口与基地页面', kind:'entry'},
    {name:'美术_探索事件', title:'探索与事件页面', kind:'exploration'},
    {name:'美术_战斗结算', title:'战斗与结算页面', kind:'battle'},
    {name:'美术_工具研究所', title:'工具与研究所页面', kind:'tools'}
  ].map(s=>({...s, context:sourceNote('pages/pages.json')+' 图片只证明所见静态；动效/操作按单项证据。仅源码与渲染示例不等于实测。',headers:pageHeaders,widths:[130,190,270,420,430,410,390,360,370,370,300,390,280,110,110],editable:editable(pageHeaders.length),rows:[]}));
  const buckets = { entry:[], exploration:[], battle:[], tools:[] };
  for (const p of pages) {
    let category;
    if (p.dispatchGroup) category = {'入口基地':'entry','探索事件':'exploration','战斗结算':'battle','工具研究所':'tools'}[p.dispatchGroup];
    else if (p.id.startsWith('LAB-') || p.id.startsWith('DEV-') || /工具|研究所|开发/.test(p.group || '') || ['STUDIO','PHOTO-ZOOM','CARD-DESIGNER','CARDS-EXPORT','CARDS-IMPORT','SFX-AUDITION','NODE-NOTE','NOTES-EXPORT','NOTES-IMPORT','NOTES-CLEAR'].includes(p.id)) category='tools';
    else if (p.id.startsWith('BATTLE') || p.id.startsWith('BOSS-BATTLE') || p.id.startsWith('BOSS-DECK') || p.id.startsWith('EXTRACT-') || ['DEATH','ABANDON-DONE','TERMINAL-RETRY','AMMO-TUTORIAL'].includes(p.id) || /战斗|结算/.test(p.group || '')) category='battle';
    else if (p.id.startsWith('HUB-') || p.id.startsWith('STASH-') || p.id.startsWith('CLASS-') || p.id.startsWith('PREP') || ['TITLE','SLOTS','SLOT-RECOVERY','SETTINGS','GUIDE','TITLE-ACH','INBOX','SUGGESTION','DATA','EXIT-SCREEN','HUB-HELP','MATERIAL-CONFIRM','HOME-SCENE'].includes(p.id)) category='entry';
    else category='exploration';
    if (!category) throw new Error(`${p.id}的dispatchGroup无法映射：${p.dispatchGroup}`);
    buckets[category].push(p);
  }
  for (const s of pageSpecs) s.rows = buckets[s.kind].map(p=>[
    p.id,p.name,labeled([['原始分组',p.group],['证据等级',p.evidenceLevel],['亲查范围',evidenceText(p.evidenceBasis)],['仅源码',p.sourceOnly ? '是' : '否']]),problemsText(p),changesText(p.changes),
    labeled([['布局',p.layout],['字体',p.type],['颜色',p.color],['材质',p.material]]),motionText(p.motion),labeled([['共享组件',p.reuseComponent],['结构与状态',p.architecture]]),filesText(p.affectedFiles),referenceText(p.reference),
    labeled([['需要素材',p.assetsNeeded],['制作请求ID',p.resourceIds],['工具',p.tools]]),plain(p.acceptance),labeled([['阶段',phaseText(p.phase)],['优先级',p.priority],['前置条件',p.dependencies],['改动范围',p.scopeCost],['范围说明',p.costNote]]),'',p.phase === 'PH4' ? '冻结·不排期' : ''
  ]);
  const variantHeaders = ['变体ID','变体名称','所属页面ID','范围与证据','复用的模板','与基础页有什么不同','需要追加的改动','实现位置','独立游戏参考','素材制作与工具','验收标准','实施安排','负责人','执行状态'];
  const variantSpec = {name:'变体差异',title:'页面变体差异',context:sourceNote('pages/pages.json'),headers:variantHeaders,widths:[190,220,160,310,310,390,420,370,350,330,390,310,110,110],editable:editable(variantHeaders.length),
    rows:variants.map(v=>[v.id,v.name,v.parentId,labeled([['分组',v.group],['证据',v.evidenceLevel],['范围',evidenceText(v.evidenceBasis)],['仅源码',v.sourceOnly ? '是':'否']]),plain(v.sharedTemplate),labeled([['内容差异',v.contentDifference],['当前问题',v.currentProblems],['范围说明',v.sourceNote]]),changesText(v.changes),filesText(v.affectedFiles),referenceText(v.reference),labeled([['需要素材',v.assetsNeeded],['制作请求ID',v.resourceIds],['工具',v.tools]]),plain(v.acceptance),labeled([['阶段',phaseText(v.phase)],['优先级',v.priority],['前置',v.dependencies],['范围',v.scopeCost],['范围说明',v.costNote]]),'',v.phase === 'PH4' ? '冻结·不排期' : ''])};
  const resourceHeaders = ['资源ID','名称','类型','用在哪里与怎么用','适用限制','授权或许可证','本地入口','来源链接','对应功能','当前来源状态','负责人','执行状态'];
  const resourceSpec = {name:'资源与参考',title:'素材资源与参考选择',context:sourceNote('systems/resources.json'),headers:resourceHeaders,widths:[150,210,190,410,390,340,370,460,240,240,110,110],editable:editable(resourceHeaders.length),
    rows:[
      ...(resourceInput.uiRequestLinks || []).map(r=>[r.id,r.request,'制作请求',labeled([['请求',r.request],['性质',r.kind],['可查资源ID',r.resourceIds]]),'制作请求不等于已有可下载成品；查下方资源记录的许可与适用边界。','','planning/systems/resources.json','',plain(r.systemIds),'拟议制作请求','','']),
      ...resources.map(r=>[r.id,r.name,r.type,labeled([['用法',r.use],['对应制作请求',r.uiRequestIds]]),plain(r.limits),labeled([['许可证',r.license],['归属',r.ownership]]),plain(r.localEntry),plain(r.url),plain(r.systemIds),plain(r.status),'',''])
    ]};
  const toolHeaders = ['工具ID','工具名称','从哪里打开或运行','当前可用性证据','用来解决什么','使用限制','负责人','执行状态'];
  const toolsSpec = {name:'工程工具',title:'工程工具与当前可用性',context:sourceNote('systems/resources.json'),headers:toolHeaders,widths:[160,240,440,410,440,440,120,120],editable:editable(toolHeaders.length),
    rows:required(resourceInput.tools,'resources.tools').map(t=>[t.id,t.name,plain(t.entry),plain(t.availability),plain(t.use),plain(t.limits),'',''])};
  return [overall,gates,arch,...pageSpecs,variantSpec,resourceSpec,toolsSpec];
}

async function main() {
  const inputPaths = ['pages/pages.json', 'systems/systems.json', 'systems/resources.json'];
  const inputs = {};
  for (const source of inputPaths) inputs[source] = await readJson(source);
  const specs = (await makeSpecifications(inputs)).map(fitLongRows);
  const pages = inputs['pages/pages.json'].pages;
  const variants = inputs['pages/pages.json'].variants;
  const systems = inputs['systems/systems.json'].systems;
  const inventoryPath = path.resolve(planning,'../diagnosis/coverage/inventory.json');
  const inventory = JSON.parse((await fs.readFile(inventoryPath,'utf8')).replace(/^\uFEFF/,''));
  const pageIds = pages.map(p=>p.id);
  const missingPages = inventory.interfaces.map(p=>p.id).filter(id=>!pageIds.includes(id));
  if (missingPages.length) throw new Error(`逐页输入遗漏当前inventory：${missingPages.join(',')}`);
  if (new Set(pageIds).size !== pageIds.length) throw new Error('逐页输入存在重复ID。');
  if (new Set(variants.map(v=>v.id)).size !== variants.length) throw new Error('变体输入存在重复ID。');
  for (const row of [...pages,...variants,...systems]) if (!['PH0','PH1','PH2','PH3','PH4'].includes(row.phase)) throw new Error(`${row.id}的阶段${row.phase}未统一到PH0-PH4。`);
  if (specs.length < 8 || specs.length > 12) throw new Error(`页签数${specs.length}不在约定8–12范围。`);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(qaDir, { recursive: true });
  const workbook = Workbook.create();
  const built = specs.map((spec,i) => addSheet(workbook,spec,i));
  workbook.recalculate();
  const verification = { generatedAt: new Date().toISOString(), inputPaths, inputHashes: {}, coverage: { pageRecords: pages.length, variantRecords: variants.length, systemRecords:systems.length, inventoryRecords: inventory.interfaces.length, missingPages, duplicatePageIds:false }, sheets: [], formulaErrors: null, finalPath: path.join(outputDir,finalName) };
  verification.inputHashes = {...inputDigests};
  const rerenderArg=process.argv.find(a=>a.startsWith('--rerender='));
  const rerender=rerenderArg ? new Set(rerenderArg.slice(11).split(',')) : null;
  for (const { spec,lastCol,end,headerRow } of built) {
    const inspect = await workbook.inspect({ kind: 'table', range: `${spec.name}!A${headerRow}:${lastCol}${Math.min(end,headerRow+2)}`, include: 'values,formulas', tableMaxRows: 3, tableMaxCols: spec.headers.length, tableMaxCellChars: 180, maxChars: 5500 });
    await fs.writeFile(path.join(qaDir,`${spec.name}-inspect.ndjson`),inspect.ndjson);
    const previewPath = path.join(qaDir,`${spec.name}.png`);
    if (!rerender || rerender.has(spec.name)) {
      const preview = await workbook.render({ sheetName: spec.name, range: `A1:${lastCol}${Math.min(end,headerRow+2)}`, scale: 1, format: 'png' });
      await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
    }
    verification.sheets.push({ name: spec.name, headerRow, records: spec.logicalRecords, physicalRows:spec.rows.length, continuationRows:spec.continuationRows, range: `A${headerRow}:${lastCol}${end}`, previewPath, minRowHeightPx: Math.min(...spec.rows.map(r=>rowHeight(r,spec.widths))), maxRowHeightPx: Math.max(...spec.rows.map(r=>rowHeight(r,spec.widths))) });
  }
  verification.formulaErrors = (await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, maxChars: 1500 })).ndjson;
  for (const source of inputPaths) if (crypto.createHash('sha256').update(await fs.readFile(path.join(planning,source))).digest('hex') !== inputDigests[source]) throw new Error(`输入在生成中变化：${source}，不导出过时工作簿。`);
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(verification.finalPath);
  verification.bytes = (await fs.stat(verification.finalPath)).size;
  verification.sha256 = crypto.createHash('sha256').update(await fs.readFile(verification.finalPath)).digest('hex');
  await fs.writeFile(path.join(here,'verification.json'),JSON.stringify(verification,null,2));
  console.log(JSON.stringify({ sheets: verification.sheets.map(s=>({name:s.name,records:s.records})), bytes: verification.bytes, sha256: verification.sha256, output:verification.finalPath },null,2));
}
await main();
