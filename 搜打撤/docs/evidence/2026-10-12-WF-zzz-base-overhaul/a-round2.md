# A返工：当前窗口字号与庭院对比度

状态：A-R1/A-R2实现完成，待主会话同一1280×720窗口复核。未提交。

已用view_image查看首轮01-home、11-courtyard、13-courtyard-rain原生截图，保留场景、玻璃布局、七入口和原庭院景观。次文字过小及标题/选中项落在明亮窗景的症状成立。

## 缩放与字号合同

证据：game/src/ui/ui-scale.js的scaleForViewport返回min(width/1920,height/1080)，apply设置document.documentElement.style.zoom；round1/first-review-facts.json的screenScale=0.6666666666666666，与当前截图一致。本轮未控制浏览器，复用这组已冻结当前窗口计算证据。

只在#hubMain.pg.hub.base-camp.base-frame-v7根定义--base-type-label:19px、--base-type-body:22px、--base-type-title:30px。当前zoom下对应屏幕12.67px、14.67px、20px；这组值是本窗口源值起点，未改全局游戏字号或缩放。已直接同步B/C采用var(--base-type-label,19px)、var(--base-type-body,22px)；主要执行动作保持#e2c891暖金/深字#172a35，选择冷青#9edce7。

首页事务名称/次文案/模式/次入口采用合同；顶栏身份、资源提示和导航角标与当前房间标记不再以10–16px逻辑字号显示。导航标签22px、当前房间19px，保留104px导航高度，通过32px图标和底部27px预留区避开标记。不会改变目的地顺序或操作命令。

## 庭院局部承托

标题和副签增加内容自适应的深石墨半透明阅读面，标题显式白色，副签19px。两种景观常态使用同类深底，选中青底深字，同时保留边与下沿标记；景观编号19px、名称22px。右侧提示19px，操作与环境设置22px；配色与反馈19px。场景画布与鱼、水面、声音默认、动画生命周期无改动，未整页蒙雾。

## 精确改动与检查

- game/css/base-framework-v7.css
- game/css/base-home-v7.css
- game/css/base-courtyard-v3.css

3份CSS通过项目已有PostCSS parse，退出码0。没有JS/命令变化，所以未重复无变化的首轮JS测试。未build、全量、安装、起服务、控制浏览器、提交或删除文件。

本轮修改前字节保存在.gitignored .tmp/a-zzz-round2-baseline；a-round2-baseline.json记录SHA，a-round2-changes.json保留首轮→返工增量和新SHA。

## 待复核

由主会话在同一1280×720窗口检查事务次文案、导航名称/当前房间/角标、精英模式说明、有草稿 caption，以及庭院两景观标题/副签/选中对比、右侧设置展开文本。重点确认字号增加没有截字或覆盖邻接工具；最终computed与真实输入未由A检查，不将源值乘zoom计算当作视觉通过。

## 首页尾项

主会话同窗口截图round2/01-home.png证实字号与导航可读，但当前25格的“格”孤立换行。A再次view_image确认后仅把首页事务栏276px→308px（仍小于首轮前316px），19px标签及行结构保持。单份CSS PostCSS解析退出码0；最终SHA256：266b668c44875464655a59ed15aec9ca54c4c1242da185932ed2adc4a4bd7ac6。等待主会话仅重看首页。
