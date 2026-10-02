const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const out=__dirname,d=JSON.parse(fs.readFileSync(path.join(out,'annotations.json'),'utf8')),inv=JSON.parse(fs.readFileSync(path.join(out,'../coverage/inventory.json'),'utf8'));
const all=[...d.records,...d.records.flatMap(r=>r.variantAnnotations||[])],errors=[];
for(const i of inv.interfaces)if(!d.records.some(r=>r.id===i.id))errors.push('missing interface '+i.id);
for(const i of inv.variants)if(!all.some(r=>r.id===i.id))errors.push('missing variant '+i.id);
for(const r of all){if(all.filter(x=>x.id===r.id).length!==1)errors.push('duplicate '+r.id);for(const k of ['visualFocus','composition','typography','controls','style','feedback','continuity'])if(!r[k])errors.push('empty axis '+r.id+'/'+k);if(!r.comparator)errors.push('missing comparison '+r.id);for(const e of r.evidence)if(!e.reviewed||!fs.existsSync(path.resolve(out,e.path)))errors.push('image '+r.id+'/'+e.path);if(!r.evidence.length&&r.issues.length)errors.push('source-only pixel issue '+r.id);}
const html=fs.readFileSync(path.join(out,'index.html'),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const tags=[...html.matchAll(/<article id="([^"]+)" data-group="([^"]+)" data-status="([^"]+)" data-search="([^"]*)"/g)];
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const cards=tags.map(m=>({id:m[1],dataset:{group:decode(m[2]),status:m[3],search:decode(m[4])},hidden:false})),fields={q:{value:'',addEventListener(){}},group:{value:'',addEventListener(){}},status:{value:'',addEventListener(){}},count:{textContent:''}},ctx={document:{getElementById:id=>fields[id],querySelectorAll:()=>cards}};
vm.runInNewContext(script,ctx);const tests=[];
function check(name,q,group,status,n){fields.q.value=q;fields.group.value=group;fields.status.value=status;vm.runInNewContext('filter()',ctx);const got=cards.filter(c=>!c.hidden).length;tests.push({name,expected:n,actual:got,pass:got===n});if(got!==n)errors.push('search '+name);}
check('initial','', '', '',d.records.length);check('source filter','', '', 'source',d.summary.basicSourceOnly);check('image filter','', '', 'image',d.summary.basicImageReviewed);check('variant search','CLASS-POOL-WU','','',1);
const report={verifiedAt:new Date().toISOString(),scope:'静态文件/JSON/ID/图片原位链接/HTML脚本与模拟DOM搜索验证；未操作浏览器，不是HTML真实渲染验收',summary:d.summary,errors,searchChecks:tests,files:['ANNOTATIONS.md','annotations.json','index.html'].map(f=>{const b=fs.readFileSync(path.join(out,f));return{path:f,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};})};
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(errors.length)process.exitCode=1;
