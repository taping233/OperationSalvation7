# coding: utf-8
from pathlib import Path
import hashlib,json,datetime
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
unity=ROOT/'SoudacheUnity'
source=ROOT/'搜打撤/game'
def entry(path):
 b=path.read_bytes();return {'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
matrix=json.loads((unity/'_planning/migration-1029/current-ui-version/version-matrix.json').read_text(encoding='utf-8-sig'))
inputs={}
for row in matrix['rows']:
 if row['id'] in ['03-base-shell','04-base-home','05-base-logistics','15-trade','16-archive','17-courtyard']:
  for group in ['js','css']:
   for file in row.get(group,[]):
    p=ROOT/file['path']
    if p.exists():inputs[str(p)]=p
for name in ['src/hub/hub.collection-v4.js','src/hub/hub.materials.js','src/hub/hub.visuals.js','src/hub/base-page-motion-v7.js','src/hub/base-motion-v4.js','src/ui/navigation-motion.js','src/ui/page-motion-profiles.js','src/ui/partner-interaction.js','src/ui/achievement-medals.js','src/ui/collection-view.js','src/ui/collection-view-art.js','src/ui/collection-workspace.js','src/ui/card-browser.js','css/collection-workspace.css','css/base-collection-v4.css']:
 p=source/name
 if p.exists():inputs[str(p)]=p
outputs=sorted((unity/'Assets/Scripts/Sdt.UI/Screens/Hub').glob('Hub*.cs'))+list((unity/'Assets/Scripts/Sdt.UI/Screens/Hub/Resources').glob('HubCurrentGlass.shader'))+[unity/'Assets/Scripts/Sdt.UI/Screens/Hub/CourtyardScreen.cs']
mappings=[
 {'view':'庭院','source':['hub.courtyard-v3.js','hub.courtyard-runtime.js','courtyard.rain-tableau.js','base-courtyard-v3.css'],'target':['CourtyardScreen.BuildCurrentRoom','CourtyardPointer','CourtyardRainTableau','CourtyardShoreGraphic'],'implemented':'同壳挂载；水面场景/发现与吃食进度/雨开关/投喂/环境设置弹出栏；雨势/声音/暂停/配色；独立原始sceneBackdrop雨层和静态岸叶；原Koi模型与Graphic未改，Pointer/Enter/Space输入及暂停投喂接齐；失焦和销毁停音/停止推进。'},
 {'view':'公共壳','source':['game.hub.runtime.js','hub.navigation-v7.js','hub.materials.js','base-framework-v7.css','base-glass-tokens.css'],'target':['HubScreen.Build','BuildNavigation','HubCurrentLayout','HubCurrentGlass'],'implemented':'84px顶栏/房间标题/返回/档位/资源胶囊与提示；104px七目的地底导航；背景cover、同底图模糊玻璃、静止公共壳、分区导航动效；视图滚动/焦点/跨档清理/旧控件版本守卫。'},
 {'view':'基地首页','source':['hub.home-v3.js','base-home-v7.css'],'target':['BuildDeploy'],'implemented':'事务左上，整备右侧420宽；人物/带牌/草稿继续；两难度、预设、条件待复原；旧mode-card/forecast/gate及旧PageIn接线已退役。'},
 {'view':'后勤','source':['hub.warehouse.js','hub.warehouse-categories-v7.js','collection-workspace.css','base-logistics-trade-v12.css'],'target':['BuildStash','HubCurrentInventory'],'implemented':'全部/战斗/消耗/培养分类、搜索/类型/品质、来源人物；大卡网格自滚动、待复原独立子页；材料单击使用、卡牌特写、保护、培养、出售确认、孵化/补给包。'},
 {'view':'人物与伙伴','source':['hub.personnel.js','partner-interaction.js','base-personnel-v12.css'],'target':['BuildClasses','BuildPets','HubPartnerPlay'],'implemented':'全身立绘左侧、5人头像条右上、培养详情/右下培养招式外观伙伴；招式4张单行分页；外观预览应用；伙伴展示/能力/携带/培养/底部伙伴切换，独立孵化、3次循环互动与短回复。'},
 {'view':'建设','source':['hub.facilities.js','base-archive-facilities-v12.css'],'target':['BuildUpgrade'],'implemented':'230宽设施目录、中央源SVG、右侧当前与扩建后容量/材料/确认；缺料反馈与交易所木材入口。'},
 {'view':'交易所','source':['hub.trade-shop-v5.js','base-logistics-trade-v12.css'],'target':['BuildTrade'],'implemented':'166宽买卖导航、分类与完整卡货架、480宽交易台；持有量/价格/余额/整堆金额、购入、出售与2.6秒确认；保护/容量/保存失败沿既有命令。'},
 {'view':'收藏室','source':['hub.archive-v3.js','hub.archive.js','hub.collection-v4.js','base-collection-v4.css','base-archive-facilities-v12.css'],'target':['BuildCollectionRoom','BuildOwnedGallery','HubCurrentArchiveViews'],'implemented':'六目录；永久Base.collection画廊及旧档记录、搜索类型、230宽详情/90x126缩略单行分页；奖励和里程碑双面板；成就状态计数/搜索/进度/排序与painted图集；卡背左上大图+左下货架+右详情；故事阅读。'}
]
report={'capturedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'HubScreen/HubModernPages/HubPets/current Hub partials; coordinator-authorized CourtyardScreen view mount and source rain layer; Koi model/graphic and Run data unchanged','authority':'current game.hub.runtime.js production import chain; Vite read-only','inputs':[entry(p) for p in sorted(inputs.values())],'outputs':[entry(p) for p in outputs],'mapping':mappings,'validation':json.loads((HERE/'source-diagnostics.json').read_text(encoding='utf-8-sig')),'nativeVerified':False,'excluded':['研究所第二地图及nestUnlocked入口：主会明确排除，不新增模拟字段/空入口。'],'coordination':['主会已扩展CourtyardScreen.cs属地；BuildCurrentRoom(page)同壳挂载完成，Open统一进入Hub courtyard目的地；出征草稿三个只读属性已由出征属地实现，当前只读类型诊断通过。'],'untested':['Unity导入/Shader编译/播放器编译','当前窗口原生截图和真实输入','注入存档失败时回滚与提示','永久收藏最后一张转化后的原生画廊回归','完整七房导航及庭院共享壳接缝','庭院当前雨层/控制弹出栏/声音与失焦销毁清理']}
(HERE/'source-map.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('source inputs:',len(report['inputs']),'outputs:',len(report['outputs']),'native: unverified')
