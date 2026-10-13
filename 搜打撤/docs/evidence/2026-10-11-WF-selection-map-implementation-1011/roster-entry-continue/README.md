# 人物 / 整备 / 冬季入城与事件续作

2026-10-11。源码与现代冬季入城候选已接入，可供根会话当前 IAB 窗口审阅；没有宣称老板美术通过。

## 本轮实际改动

- `game/src/hub/game.hub.depart.js`：已知携带摘要保留真实模式、初始卡名称数量、额外卡数、随行实际效果和安全格；格数集中在既有底部容量读数。删除隐藏的页头容量、摘要重复总数/格数、宠物重复名字、携带说明重复的职业卡揭晓文字，以及无消耗口袋时底部空洞步骤口号。卡牌详情、筛选、拖拽、初始牌保护、扣仓和保存原逻辑保持。
- `game/src/run/game.run.altar.js`：入城标题改为“入城补给”；短启程叙事保留。实际获得数量与已入包事实集中在职业卡组上方，去掉重复“同行”口号，卡面详情与唯一继续动作保持；没有修改抽取、守卫或存储。
- `game/src/ui/node-scene-view.js`：真实区域/层数和生命/金币/容量包入展示用 context，入城排为一条状态栏，事件保持纵向阅读。没有新增业务状态。
- `game/css/entry-events.css`：真实卡面设计字号 27→32，卡组成为大页主对象；标题、数量、资源与叙事明确分层，提示使用局部暗色承托。事件按钮明确标题/后果说明纵向排列；去掉旧皮肤钻石/箭头伪元素，避免与真实文字重叠。清除 cover-run 遗留的纸板斜切/阴影，并提高标题作用域以消除同权重加载顺序依赖。
- 运行图改为 `game/assets/scenes/entry/modern-winter-entry-1011-v2.webp`。没有改基地 CSS、全局缩放、商店批准图、人物原画、白塔坐姿或 city-cut。

## 图像来源与比较

NAI 按 `tools/nai_style.py` 的 build_asset_prompt/build_uc 生成 1344×768 文本构图，实际 seed1011462201、4.5full 默认参数、HTTP200。第一次守卫检查遇到原有共享429冷却；冷却结束后只有一笔实际远端请求。NAI没有输入图片 reference。原稿出现未要求人物及全图均匀网格纹，不能作为运行图。

内置第一轮实际输入：NAI原稿为编辑目标；潜行 `martial-tt7-stealth.webp`、珍珠盒 `equip-tt2-pearlbox.webp` 为画法参照，不能继承人物/盒子题材。修正为左侧现代模块门框、冷天光、远处高架与住宅轮廓、街缘/屋顶积雪和枯枝，主区域留给两张大职业卡。原人物与网格纹已去。第一轮地面略湿亮，第二轮只改为清扫后的哑光灰蓝铺装与少量大影块，保留其余构图。两轮没有生成文字、UI或人物。

最终原图1672×941；WebP quality95/method6，无resize/crop/repaint，233244B；SHA256 `7066dd7f26e4006ec8005f5b927f62c237439edcfe94cee694acd27890075331`。最终WebP已直接看图核对。PNG原图超过1MB，由 `source/.gitignore` 精确忽略；路径、SHA及获取方式保留在 nai-request / builtin-requests / runtime-receipt JSON，复现脚本保留。

## 验证与未覆盖

- `npx vitest run tests/departure-browse-state.test.js tests/departure-class-confirmation.test.js tests/e4-async-entry.test.js --reporter=dot`：3文件27项通过，覆盖宠物转换后的真实初始牌摘要、换人保外壳、取消与重复确认、整页入城与读档过场边界。
- 本轮三 JS 定向 ESLint 与定向 `git diff --check` 通过。
- 未启动服务、未操作浏览器、未build、未全量、未提交/推送/删除文件。根会话统一登记和当前 IAB 视觉反馈。
- 待实页：当前窗口入城卡面与长规则是否完整可读、继续按钮可达；一个/两个实际卡结果、长事件叙事和三条选项、禁用状态、卡牌详情返回不重复发奖；整理实际容量和宠物效果读数。测试结果不能替代视觉通过。

## 根会话过目入口

同步上述三个JS、entry-events.css和运行图到隔离快照。真实确认出征并看city-cut后的完整入城页；查看真实职业卡、唯一继续并回地图。事件从真实入口或明确标注开发者构造入口打开，记录背景/叙事/选项/底部动作与滚动区域。请回传入城页截图以及node-panel/node-main/entry-cards矩形；本代理没有伪造实页证据。

### 当前窗口整备卡面裁断修正

根自然1523×956窗口的03-preparation.png显示右侧选中卡面底部被滚动格裁断。实际ID为depBag；departure-cover.css没有加载，原page-deploy入口已注释。未加载该旧整文件，新增只有选中区作用域的game/css/departure-selected.css，由game.hub.depart.js静态import。三ID选择器限定选中格列宽/卡面160设计px、完整自然高度与数量行，宠物/说明不收缩，缩短两行外边距为选中格留足高度；格区独立滚动。没有调整全局scale或基地CSS。摘要同时去掉新增“随行效果：”层，只展示原宠物真实desc。departure-browse-state直接5项通过，ESLint/diff-check通过；当前窗口复看由根完成。

### 新图真实入城页居中与对比度修正

根05-preparation-fixed.png确认整备卡名和规则完整；06-entry-modern.png已显示本轮新现代冬季图。当前矩形证实node-main宽1408，但node-summary继承max-width760设计px、实际宽602.85，造成卡组落左侧；标题也遗留左对齐。专属pg.node-pg.event-scene.entry-scene精确作用域解除summary最大宽并居中，标题全宽居中、去旧左边标记；叙事增加短局部暗色承托提高亮天空上的可读性。真实region本身含“第1层 · 外围荒地”，展示壳仅去其已有数字层前缀，再由实际layer统一显示一次层数。仅在entry壳存在时隐藏重复bagBtnFloat，不影响地图或事件。保持现代图和32设计字号卡面，不改全局缩放。待根同步本域node-scene-view.js与entry-events.css当前窗口复看。

### 唯一事件选项后果去重

根13-event.png中“双焰走私”叙事与唯一选项说明均为“获得两张「火球」”。node-scene-view纯展示模板只在event、恰有一个evt-opt、其直属span文本与完整叙事textContent一致时移除该span；仅忽略首尾空白和末尾句号/问叹号，不提取数字或猜测后果。叙事、按钮动作标题、data-act/disabled和业务流程保持。多选项、不同说明与entry均保留。直接jsdom4情况核对通过，ESLint/diff-check通过；未重画事件背景或人物，未扩cinematics。
