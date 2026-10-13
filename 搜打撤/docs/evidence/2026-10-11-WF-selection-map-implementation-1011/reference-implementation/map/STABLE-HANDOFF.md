# 稳定文件与未检测边界

2026-10-12。按老板最新“不用检测，我来”要求停止检查，仅完成已授权绘画、接入、来源记录。未运行游戏浏览器、测试、lint、语法或游戏验收、build。没有新服务、提交、推送、删除；最后记录的SHA只标识取得的原件/编码产物，不表示验收通过。

稳定源码：game/src/core/renderer.js（drawCurrentNodeFrame/drawIcons/drawNodeLabels/drawLinks、经root同轮确认的ensureBackdrop纯背景段与被替代的drawCover展示helper）；game/src/core/map-node-art.js（新绘画桥/人物标记/原生剪影）；game/src/run/expedition.view.js（去log重挂）；game/css/expedition-map.css（实际近黑CSS背景）；game/css/page-expedition-hud.css（保持删除的route/log不出现、底栏收淡）。不再编辑背包、index/boot/hud或全局缩放。

实际绘画覆盖：fire→热源芯；battle→安防碎片；boss共战斗主体并以已知首脑类型加红风险边/晕；shop→交易信物；event→记录碎片；door/entrance/emergencyExit/extraction→通行核心。helper亦保留elite/battleElite语义alias，但当前项目精英是遭遇结果kind，不把它冒称现有地图type，也不窥探随机结果。chest复用small-rig-640-v1/frame-00.webp作为中性物资点识别；该节点的箱档位进入后随机，不提前展示medium/large/class或掉落。

未绘画名单：coin、wood、rations、key、resource、altar为各自独立原生剪影；blank沿原空环，未知类型沿未知地点。没有把同一个菱形当全部物资类型，也没有把五张必要代表主体称方舟22节点整库完成。

稳定新运行素材位于game/assets/scenes/map-nodes/：rest-heat-cell-1011.webp、battle-security-shard-1011.webp、shop-exchange-token-1011.webp、event-record-fragments-1011.webp、passage-transit-core-1011.webp，按512px无损编码规格制作。原PNG保留本域source并精确ignore；来源SHA在source-receipt.json，完整输入/词在prompts.json与additional-prompts.json。

首两张绘画root实际看后允许待老板统一过目的接入，第三张交易信物本代理已看；event/passsage是在老板再次停止检测后收取并接入，未额外打开做视觉检查。所有新地图实现与最后两图尚未老板人审；不宣称测试、透明/格式或实页通过。绘画资产需主人实际查看，现行缓存/缩放/迷雾生命周期未作本轮验收声明。
