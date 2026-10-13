# -*- coding: utf-8 -*-
import json, hashlib
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parent
root = folder.parents[4]
batch = root / 'docs/evidence/2026-10-11-WF-selection-map-implementation-1011'
plan = root / 'docs/evidence/2026-10-11-selection-map-plan'
items = [
 dict(label='RE01 星铁队伍选人实机',target='选人候选头像/当前人物/查看与确认',path=plan/'references/HSR-team-selection.png',sourceURL='https://interfaceingame.com/screenshots/honkai-star-rail-team-selection/',originalURL='https://interfaceingame.com/wp-content/uploads/honkai-star-rail/honkai-star-rail-team-selection.png',provenance='玩家实机截图库；版本和拍摄日期未标注，早期角色/等级画面；不是官方独立立绘或UI工程',observation='左侧三张头像卡共用固定框，白亮选中边框与角色右侧展示对应；底部Details与Add独立。本项目对应五人头像、换人时保外壳和查看/确认分工，不复制3D人物或星空风格。',newOrReused='reused',date='unknown'),
 dict(label='RE02 绝区零自定义作战计划原上传',target='整备候选卡/已选槽位/固定底部确认与代价',path=folder/'zzz-custom-preparation-original.png',sourceURL='https://www.hoyolab.com/article/30636268',originalURL='https://upload-os-bbs.hoyolab.com/upload/2024/07/05/370699319/df91f4130bed0f07c0ce84ea79c181d0_551250015581684224.png',provenance='HoYoLAB社区作者Miyabi\'s sword(uid370699319)实机教学原上传；2024-07-05；非官方作者、非独立UI源。公共post接口retcode0给出原尺寸URL，下载时去站点resize/quality参数。',observation='右侧两行候选卡完整保轮廓，左侧五个空选槽分离；单卡奖励数量贴卡底部，底部Battery Cost与Save Plan独立固定。本项目对应仓库候选/实际携带/容量与出发；敌人素材、体力及副本规则不移植。',newOrReused='new',date='2024-07-05'),
 dict(label='RE03 STS2 Neow开局实机',target='完整入城页主焦点/持续资源/奖励区域',path=batch/'entry-events/references/sts2-neow-pcgamer.jpg',sourceURL='https://www.pcgamer.com/games/roguelike/slay-the-spire-2-early-access-features/',originalURL='https://cdn.mos.cms.futurecdn.net/hEAn7QQ33igbBM6hbWPF3N.jpg',provenance='PC Gamer实机文章的Mega Crit版权截图；画面右上v0.98.2与2026-03-09；非官方独立UI图层',observation='角色大主体覆盖全屏中央，名字/短对白形成阅读焦点；顶部资源持续可见，三条奖励放下方暗色承托。本项目只对应入城完整页/已获职业卡/唯一继续，不移植Neow身份和三选一。',newOrReused='reused',date='2026-03-09'),
 dict(label='RE04 STS2 Ranwid事件实机',target='事件场景/叙事/动作与后果分层',path=batch/'entry-events/references/sts2-event-pcgamer.jpg',sourceURL='https://www.pcgamer.com/games/roguelike/slay-the-spire-2-early-access-features/',originalURL='https://cdn.mos.cms.futurecdn.net/zBUHmoDEx334RdStjSbShd.jpg',provenance='PC Gamer实机文章的Mega Crit版权截图；右上v0.98.0与2026-03-05；非独立事件角色透明源',observation='左侧老者与暗树，右侧完整标题/三段叙事和三条选择；黄色动作标题、白色后果同一承托，资源仍留顶部。本项目对应叙事滚动区/真实选项/局部明度承托；不是过场动效的帧或时长证据。',newOrReused='reused',date='2026-03-05'),
 dict(label='RE05 绝区零角色信息实机（低清对照）',target='选人身份/玩法属性/成长入口分层',path=folder/'zzz-agent-info.webp',sourceURL='https://www.icy-veins.com/zenless-zone-zero/agent-leveling',originalURL='https://static.icy-veins.com/images/zenless-zone-zero/beginner-guides/agents/agent-info.webp',provenance='Piyo实机指南图片；页面图像更新记录2024-10-04，正文更新2025-07-28；图片版本未标注。站点仅提供642宽资源，非高清源或官方独立立绘。',observation='角色在左，横向候选头像在上；右侧姓名/阵营主块、等级/属性和基本数值层级，底部Base Stats/Skills/Equipment三入口分工。适合角色玩法/成长信息拆分；642px只看构图，不作字形尺寸或材质细节依据。',newOrReused='new',date='2024-10-04 image-update log; screenshot exact date unknown'),
]
items[-1] = dict(label='RE05 方舟IS7 未涉足之树事件整页',target='事件三选项/左侧完整叙事/持续资源与底部收藏队伍',path=batch/'art-reference-collection/map-navigation/source/is7-selected-route-a.jpg',sourceURL='https://img2-tc.tapimg.com/moment/etag/FoSl1WbPlNMC4t77BV9Gdepq5bw3_20260720001135.jpg/_tap_ugc.jpg',originalURL='https://img2-tc.tapimg.com/moment/etag/FoSl1WbPlNMC4t77BV9Gdepq5bw3_20260720001135.jpg/_tap_ugc.jpg',provenance='根会话本轮取得的TapTap玩家IS7实机原提供图；图片URL日期2026-07-20，帖子修改7月19日，具体补丁未标；1080x485提供尺寸，非官方独立UI资产。跨域引用原文件，不复制。',observation='中央树场景，左下完整事件标题/叙事；右侧探索内部、探索源头、休息三选项，各用亮动作条和暗色后果区；顶部持续资源、底部收藏/零件/队伍。对应本项目事件动作/真实后果分区及导航层级；不能从静图推发生概率或动画。图内上方甜美的伤口是主题/路线标题，未涉足之树才是事件。',newOrReused='new-cross-domain-reference',date='2026-07-20 CDN date; patch unlabelled')
items[1].update(label='RE02 绝区零VR训练敌人编排实机', target='布局辅助：空槽/敌人候选/固定确认区', provenance='HoYoLAB社区作者uid370699319的VR Gameplay Introduction实机教学原上传；2024-07-05。画面为VR训练敌人编排/自定义计划，候选是Tyrfing、Alpeca、Hoplital等敌人，底部为Battery Cost与Save Plan；不是玩家出征携带或仓库。非官方独立UI源。', observation='仅借鉴左空槽、右敌人候选与底部固定确认的布局；不能作为本项目实际携带、容量或资源回执证据，不移植敌人编排/训练电量规则。')
items[-1]['sourcePage'] = 'https://www.taptap.cn/moment/828059228320039824'
items[-1]['sourcePageTitle'] = '小刻也能懂的黑流树海三结局前置及机制介绍'
assets=[]
for item in items:
    path=item.pop('path')
    with Image.open(path) as image:
        item.update(width=image.width,height=image.height,format=image.format)
    item.update(originalPath=str(path.relative_to(root)).replace('\\','/'),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),viewed='tools.view_image; 2026-10-11',acquisition='Original response bytes; reused files retained at their original local paths; no resize/crop/re-encode')
    assets.append(item)
extras=[]
for name,reason in [('zzz-agent-info.webp','642x361 low-resolution role-info composition only; primary catalog uses current IS7 event for new incremental evidence'),('zzz-equipment-selection.webp','642x361 low-resolution duplicate equipment layout; primary catalog uses HD custom-preparation instead'),('zzz-combat-plan-original.png','HD category screen inspected; less direct than custom-preparation for actual selected loadout')]:
    p=folder/name
    with Image.open(p) as im: w,h=im.size
    extras.append(dict(originalPath=str(p.relative_to(root)).replace('\\','/'),width=w,height=h,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),reasonNotPrimary=reason,viewed='tools.view_image; 2026-10-11'))
manifest=dict(date='2026-10-11',status='research-only; no game integration',assets=assets,notPrimary=extras,gaps=['No verified current-2026 ZZZ/HSR selection UI screenshot; older screenshots explicitly dated/unknown-version.', 'No official independently published editable UI panels, transparent character or event-background source obtained.', 'No continue/resume city-cut motion sequence or temporal sampling obtained; STS2 whole-page references only support static scene hierarchy.'])
(folder/'assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
ignored=['/'+p.name for p in folder.iterdir() if p.is_file() and p.stat().st_size>1_048_576]
(folder/'.gitignore').write_text('\n'.join(ignored)+'\n',encoding='utf-8')
print(json.dumps([dict(label=a['label'],width=a['width'],height=a['height'],bytes=a['bytes'],newOrReused=a['newOrReused']) for a in assets],ensure_ascii=False))
