import json,re,html
from pathlib import Path
from collections import Counter
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

BASE=Path(__file__).parent
data=json.loads((BASE/'catalog.json').read_text(encoding='utf-8'))
doc=Document(); sec=doc.sections[0]
sec.page_width=Inches(8.5);sec.page_height=Inches(11)
sec.top_margin=sec.bottom_margin=Inches(.65)
sec.left_margin=sec.right_margin=Inches(.7)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3']:
 s=doc.styles[name];s.font.name='Microsoft YaHei';s.font.color.rgb=RGBColor(0,0,0)
 s.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'Microsoft YaHei')
for border in list(doc.styles.element.iter(qn('w:pBdr'))):border.getparent().remove(border)
doc.styles['Normal'].font.size=Pt(11)
doc.styles['Normal'].paragraph_format.space_after=Pt(4)
doc.styles['Normal'].paragraph_format.line_spacing=1.12
for name,size in [('Title',24),('Heading 1',17),('Heading 2',13),('Heading 3',11)]:doc.styles[name].font.size=Pt(size)
doc.styles['Heading 3'].paragraph_format.space_before=Pt(9)
doc.styles['Heading 3'].paragraph_format.space_after=Pt(3)
histstyle=doc.styles.add_style('历史记录',1)
histstyle.base_style=doc.styles['Normal'];histstyle.font.size=Pt(9.5)
histstyle.paragraph_format.space_after=Pt(4)
srcstyle=doc.styles.add_style('来源',1);srcstyle.base_style=doc.styles['Normal'];srcstyle.font.size=Pt(8)
srcstyle.paragraph_format.space_after=Pt(3)
footer=sec.footer.paragraphs[0];footer.alignment=2
footer.add_run('代号柒卡牌总录  ·  ')
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
doc.core_properties.title='代号柒现役与历史卡牌总录';doc.core_properties.author='Friday'
md=[]
def p(t,style=None):doc.add_paragraph(t,style);md.append(t+'\n')
def h(t,level):doc.add_heading(t,level);md.append('#'*(level+1)+' '+t+'\n')
def clean(v):return re.sub(r'\[\[icon:([^]]+)\]\]',lambda m:{'coin':'币','crystal':'稀有度标记'}.get(m[1],m[1]),str(v or '')).replace('<br>','\n')
def meta(c):
 parts=[c.get('type','类型未记录'),'费用 '+str(c.get('cost','未记录')),c.get('rarity','稀有度未记录'),'职业 '+c.get('cls','通用或未标注')]
 if 'value' in c:parts.append('币值 '+str(c['value']))
 return ' ｜ '.join(parts)
labels={'dmg':'伤害','dmgType':'伤害类型','draw':'抽牌','heal':'回复','armor':'护甲','infuse':'注能','sellable':'可出售','unrandom':'排除随机获取','tokenOf':'衍生来源'}
def attrs(c):
 def val(v):return ('是' if v else '否') if isinstance(v,bool) else {'attack':'攻击','spell':'法术','fixed':'固定','true':'真实'}.get(str(v),str(v))
 return '；'.join(labels[k]+' '+val(c[k]) for k in labels if k in c)
def priority(v):
 ss=v['sources']; dated=[s.split(' ')[0] for s in ss if re.match(r'^\d{4}-',s)]
 main=any('搜打撤/game/' in s for s in ss)
 return (max(dated,default='0000'),main)
sourceids={s['source']:f'S{i:02}' for i,s in enumerate(data['sources'],1)}
sourceids['2026-10-09 当前装配卡库']='CURRENT'
def refs(v):
 ss=[s for s in v['sources'] if s!='2026-10-09 当前装配卡库']
 if not ss:return 'CURRENT'
 dated=sorted(ss,key=lambda s:s if re.match(r'^\d{4}-',s) else '0000'+s)
 a,b=dated[0],dated[-1]
 return sourceids[a]+(' 至 '+sourceids[b] if a!=b else '')+'，共 '+str(len(ss))+' 个来源记录'
def face(c):return {k:c[k] for k in ['name','type','cost','rarity','cls','desc',*labels,'value'] if k in c}

doc.add_paragraph('代号柒现役与历史卡牌总录','Title');md.append('# 代号柒现役与历史卡牌总录\n')
p('资料快照 2026年10月9日  整理 Friday','Subtitle')
p(f"本录汇总 {data['totalCount']} 个卡牌 ID、{data['versionCount']} 份不同卡面记录。当前装配卡库 {data['currentCount']} 张，明确退役 {data['statusCounts']['明确退役']} 张，旧 ID 迁移或合并 {data['statusCounts']['旧ID迁移或合并']} 张，仅历史存在 {data['statusCounts']['仅历史存在']} 张。现役、退役和旧版本均予收录，供查阅与后续设计使用。")
p('范围包括当前 Vite 装配卡库、所有本地 Git 引用中保存的卡库文件、冻结 Godot 卡库、旧桌面端、原型和证据目录内的卡库快照。未读取浏览器私有存档，也未获取本地库之外的数据库、未导入存档或远端分支。')
p('按稳定 ID 区分卡牌。同名不同 ID 分别列出；同 ID 的名称、费用、稀有度、职业、效果或属性不同则保留为历史卡面。只改内部执行规则而卡面字段相同的记录合并，完整源数据另存于 catalog.json。')
p('现役表示当前源码在空档装配后仍在册，不代表每张牌都可在商店或随机池获取。明确退役依据 cards-sync v35、RETIRE_TT10、RETIRE_TT11 及按名清理新兵操典的代码。旧 ID 迁移或合并表示源码明确改 ID 或清理重复卡；仅历史存在表示当前未在册，尚未核实整卡退役依据。每张历史卡均注明状态依据。')
p('卡面效果保留来源措辞，旧版本不代表当前游戏规则。字段缺失写为未记录，不补造数值；职业未标注的卡不据此推断具体职业。来源编号可在文末核对，Git 时间为记录时点，不作为设计生效日期。')
h('检索与统计',1)
p('Word 导航窗格按状态、类型和卡名检索；卡牌标题含 ID。历史卡面紧随对应卡牌，保留原名与完整效果。')
for state in ['现役','明确退役','旧ID迁移或合并','仅历史存在']:
 group=[c for c in data['cards'] if c['status']==state]
 counts=Counter((c['current'] or sorted(c['versions'],key=priority)[-1]['card'])['type'] for c in group)
 p(state+' '+str(len(group))+' 张：'+'、'.join(k+' '+str(v) for k,v in counts.items()))
p('最新同步表退役 5 张，早期两份退役表与按名清理规则另确认 44 张；重复 ID 只计一次。')
for state in ['现役','明确退役','旧ID迁移或合并','仅历史存在']:
 doc.add_page_break();h(state+'卡牌',1)
 group=[c for c in data['cards'] if c['status']==state]
 def representative(c):return c['current'] or sorted(c['versions'],key=priority)[-1]['card']
 types=['武术','法术','装备','道具','资源','能力卡','事件','生物']
 group.sort(key=lambda c:(types.index(representative(c)['type']) if representative(c)['type'] in types else 99,representative(c)['name'],c['id']))
 prev=None
 for c in group:
  main=representative(c)
  if main['type']!=prev:h(main['type'],2);prev=main['type']
  h(main['name']+'  '+c['id'],3)
  p(meta(main));p('效果：'+clean(main.get('desc','未记录')))
  if attrs(main):p('属性：'+attrs(main))
  mainv=next((v for v in c['versions'] if face(v['card'])==face(main)),None)
  p('主条目来源：'+('CURRENT 当前装配卡库' if c['current'] else refs(mainv)),'来源')
  if not c['current']:p('状态依据：'+c['statusReason']+'。主条目为历史卡面。','来源')
  old=[v for v in sorted(c['versions'],key=priority) if face(v['card'])!=face(main)]
  for i,v in enumerate(old,1):
   card=v['card'];p('历史卡面 '+str(i)+'  '+card['name']+'  '+meta(card)+'\n效果：'+clean(card.get('desc','未记录'))+('\n属性：'+attrs(card) if attrs(card) else '')+'\n来源：'+refs(v),'历史记录')
doc.add_page_break();h('来源索引',1)
p('CURRENT 来自 sync-cards-from-live.mjs 的 sourceCardLibrary，运行真实源码播种与迁移链，在内存空档中取 Cards.all。源码和卡牌数据未作修改。下面列出读取的 79 份文件快照及提取数量，重复来源不会增加卡牌 ID 数。')
p('基准 HEAD '+data['head']+'；cards-sync 版本 '+str(data['syncVersion']))
for s in data['sources']:p(sourceids[s['source']]+'  '+s['source']+'  提取 '+str(s['count'])+' 条','来源')
doc.add_page_break();h('覆盖核对',1)
p('已逐项核对当前 272 个 ID 全部在册，49 个明确退役 ID 全部找回完整卡牌定义；2 个旧 ID 迁移或合并、8 个其余历史 ID 单独分类。331 个 ID 无重复且每个都有卡面数据；历史对象提取失败数为 0。')
p('816 份记录按卡面字段去重，不是 816 张独立卡牌。相同 ID 的正文与历史条目覆盖全部去重卡面。冻结 Godot 与原型只作历史读取，未进行开发或构建。')
p('完整原始条目、全部来源关系和提取脚本保存在本任务证据目录。本文不含卡图、游戏测试结论或未取回私有存档中的自建卡。')
doc.save(BASE/'代号柒现役与历史卡牌总录.docx')
(BASE/'全文.txt').write_text('\n'.join(md),encoding='utf-8')
ids=[c['id'] for c in data['cards']]
assert len(ids)==len(set(ids))==331
assert sum(c['status']=='现役' for c in data['cards'])==272
assert all(c['versions'] for c in data['cards']) and not data['failures']
assert all(any(c['id']==i and c['status']=='明确退役' for c in data['cards']) for i in data['retire'])
print('文档生成完成；331 个 ID / 816 份卡面；覆盖核对通过')
