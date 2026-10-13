# 地图与节点详情视觉复刻

2026-10-13，旧聊天受主任务 01a13311 委派。状态：按老板最新反馈恢复旧手绘图标已交付，待主代理同步5372实页；本聊天已结束编辑。唯一源码属地为 renderer/map-node-art/camera、expedition.view 和地图两份 CSS；不改拓扑、迷雾、next、节点结果或共用生命周期。

## 最新决定：仅恢复原手绘节点图标

老板明确“节点图标不好看，维持前那版”。本轮只改图标引用和绘制，不回退新地图框架或已修的路由、预览、连线、工具栏。

从保留的 .tmp/selection-map-observe-1011/game/src/core/map-node-art.js 精确复用六类1012-v5素材表、原bounds及drawMapNodeArt函数：fire、battle、shop、event、passage、supply-symbol-foreground-1012-v5.webp；boss/elite与入口/撤离点维持原别名。已读取六张原图元数据，均512×512 RGBA，未重绘或修改素材。

地图当前badge调用恢复旧手绘图，不以本轮被否定的平面glyph作加载占位。详情使用相同原WebP和bounds布局，保持彩色笔触；此前没有手绘素材的金币/木材/口粮/钥匙/物资格/祭坛恢复原生符号，空白节点沿用原战术符号，画布与详情同源。圆盘、光环、小人和旧地图布局未恢复。

本轮实际修改两份源码：game/src/core/map-node-art.js、game/src/run/expedition.view.js；renderer.js既有调用自动走恢复后的绘制管线，文件内容保持不变。主代理同步上述两份源码即可；原六张WebP已在项目素材目录。

定向5文件81项再次通过（12:38本地时段）；两份JS node --check及目标diff --check通过。遵守最新指示，本轮未打开/关闭浏览器tab，未启动/停止服务，未提交。恢复后的实页由主代理同步5372验证。下文复刻阶段截图里的新平面glyph已被否定，仅作过程证据，不能代表当前图标定稿。

| 恢复后的当前文件 | SHA256 |
| --- | --- |
| game/src/core/map-node-art.js | `35ec3afca67dd01625c2ec73d06bc72d2af5648c7f2081e3e810aaa846ebf49f` |
| game/src/run/expedition.view.js | `c55aa66788224232887a43e376f04e9dcda258dd2f9e3c4311e76ecfc2f2b1b9` |
| game/src/core/renderer.js | `f6582b4c0ebbe823d5f8f1cd6463bda432a19d2de5ac0defe0fed03fecb439d0` |

## 已直接查看的参考与几何映射

| 真图中的可见结构 | 本作落实位置 |
| --- | --- |
| IS3 地图 1280×720：顶栏约 60 px、底栏约 80 px，中区只呈现地点和路线 | 保持顶部生命/层名/资源，底部采用一行物品工具，取消角色小人与重复地点摘要 |
| 图标放在统一矩形承托里，短名称位于紧贴图标的窄条；当前青色、其他灰黑 | 节点改为固定屏幕尺寸的图标与标签整体，取消巨大圆盘、多重圈、发光颗粒和浮动人像 |
| 分支是细曲线和方向箭头，白/青主线，其他路线明显降对比 | 沿用主代理已修复的同一路径缓存高亮；从当前位置到合法相邻点画方向箭头，其他已知边降权，不赋予隐藏/非法边可达性 |
| IS6 选中图：地图保留左侧约七成，右侧依次为身份、说明、资料/风险、出发 | 唯一节点详情固定右侧，标题和说明只出现一次，进入动作置底；镜头为详情保留右侧空间，不创建路线列表 |
| 节点、路线比灰暗地景更亮；没有每个类型各一团彩色光源 | 保留冬境未来城资产，降低背景与外围光效对比，白色图标承担辨识，危险仅在详情中使用红色 |

来源：[IS3 实机原图](https://user-images.githubusercontent.com/78369668/192969562-bd46a40a-fd6c-4a1a-94b1-a4bd5af4ecd9.png)，在本聊天 Codex 内置浏览器直接看图；[IS6 选中详情](https://assets.st-note.com/img/1768583382-xLBzaZfwoU53QbspEknYtVPc.png?width=1200)，直接查看主任务的原图本地副本。静态图不证明动效。

基线已看 03-map-before.jpg 和 06-reward-restored.jpg；07-map-selected.jpg 实际是标题页加载失败，不能作为节点详情证据。本作二维可回溯地图保持；箭头只表达当前可走方向，不把全图改成方舟单向 DAG。

## 本轮动作与验证

已完成：

- 节点取消旧黑色大圆盘、多重光圈、随行人像和浮动箭头，白色类型剪影与紧贴窄标签组成一个识别单位。当前位置青、选中白、可走完整亮度、其他已知/已消耗地点降权；缩远时非候选点压缩为小图标，保留当前位置及选中标题，避免总览堆满大名牌。
- 路线底线、选中高亮和方向箭头使用同一个缓存的二次曲线路径。边两端按屏幕图标/标签边界裁剪，当前可走边才显示离开当前位置的方向，不改 next、拓扑、迷雾可见集合或回溯。
- 保留冬境未来城资产、背景缓存、按需重绘、换层溶解和减少动态效果处理；删去额外光柱/多色粒子，减弱 CSS 雪粒。未采集性能比较，不声明帧率提升。
- 工具带只显示背包/安全格/消耗口袋及真实数量，右侧定位/总览；取消地图人物、当前位置重复命名和每项附加解释。语义说明保留在无障碍名称中。
- 单一详情在右侧上部：同地图图标、状态与名称、真实短说明/限制/低生命风险、唯一主操作；关闭键位于角上。风险取实际生命且只在未消耗战斗点显示；门覆盖底层战斗类型时保持通道身份。没有生成假敌人数据、掉落或数值。
- 相同状态保留 DOM 与焦点；预览仍绑定当前位置，不写存档。自动取景为详情留右侧约三成，完整保留合法相邻点；手动镜头不自动重取景，坐标换算与原命中规则保持。
- 整理两份地图 CSS 的有效末段，清除 feedback-oct12.css 中旧 300px 模糊预览、flex:1 按钮和旧地图 chibi 规则，未增加 !important 覆盖。expedition-map.css 中三项旧定位重置沿用 winter.css 的既有约束。

## 实页反馈与迭代边界

主代理冻结副本首次图 08-map-replica-first.jpg 中，节点接近参考，但旧八列 grid 把背包挤到约50.7px，预览被旧规则压到218×170。已清除该冲突并使用本聊天独立构造页的真实 CSS 加载顺序检查。

主代理第二轮 13-map-second-pass.jpg、14-node-detail-second-pass.jpg 已反馈底栏不再叠字，侧栏顺序和参考相似；本聊天直接查看14图。其后最后补丁为短说明侧栏最小逻辑高度420→340、地图/详情图标同源，以及缩远时已知非候选节点的细节密度控制。**这几项需要主代理再次精确同步最终文件；14图不是这几项最后补丁的实页验收。**

本聊天仅操作自己新建的参考 tab 和独立构造 tab，未碰主代理游戏tab、游戏存档或音频；没有新服务，没有停止5372。两个自建tab均已关闭。

## 独立构造页证据

测试夹具 tests/fixtures/map-replica.html 经5372的 /@fs/ 读取当前源码与真实样式加载顺序，绕过主代理冻结runtime；明确为构造场景，不导入Game、不读写存档。测试顶部三个切换按钮和工具图标替代物仅存在于夹具，不能当作生产画面。使用项目1920×1080统一缩放，当前自然浏览器1280×720、zoom=0.666667，未设置viewport或追加多尺寸。

- 底栏实际列宽259.987/259.987/259.987/768.037/150/150逻辑px；三个物品按钮实际各173.325屏幕px，两个镜头按钮各100px，没有交叠。
- 最后侧栏为353.325×226.663屏幕px、x902.675/y102.138；×在右上角。侧栏白图标解码为96×96，同地图原生绘制源，不再把地图八角事件图标换成详情问号。
- 相邻商店“进入”可用；已知不相邻点显示受限理由且按钮禁用；关闭后预览消失；构造的低生命相邻遭遇战显示红色风险提示。
- 3张截图：map-replica-shop-fixture.png、map-replica-locked-fixture.png、map-replica-risk-fixture.png。截图记录最后侧栏/图标及交互状态，最后缩远密度补丁尚未在主对局总览中复核。
- 独立页控制台error/warn为空。截图不能证明完整四层、最终首脑、长期性能或真实保存/移动全链。

## 定向验证

最终执行：npm run test:target -- tests/expedition-view.test.js tests/map-node-state.test.js tests/camera-interaction.test.js tests/contracts.test.js tests/architecture-boundaries.test.js，5文件81项通过（12:22本地时段）。覆盖合法分支、不改变游戏状态、门/消耗身份、预览时效、低生命恢复刷新、详情取景和screen/world逆变换。

第一轮有1项旧图形断言要求空白节点必须circle；更新为检查空白图标的身份，不把样式形状当规则。随后相关测试均通过；没有忽略失败项。最后四份JS node --check 和目标git diff --check均通过，仅现有CRLF/LF提示。没有全量/build/安装/提交/推送/删除文件。

## 主任务同步清单与剩余

源码7份：game/src/core/renderer.js、map-node-art.js、camera.js；game/src/run/expedition.view.js；game/css/expedition-map.css、page-expedition-hud.css、feedback-oct12.css（仅地图旧规则）。

测试2份：tests/expedition-view.test.js、tests/camera-interaction.test.js；新增独立夹具tests/fixtures/map-replica.html。本记录为本聊天当前来源，其他主任务记录和REGISTRY/PENDING由主代理维护。

待主任务：同步以下最终指纹的文件再刷新自己冻结副本，复核最后侧栏高度/同源图标和高密度总览，以及四层、祭坛/门/最终区域。所有原玩法与其他域成果保留；本聊天现在无在飞操作和自建服务，释放本片编辑，由主代理接管。


## 此前复刻阶段文件指纹（图标恢复前，当前指纹见页首）

| 相对搜打撤路径 | SHA256 |
| --- | --- |
| game/src/core/renderer.js | `f6582b4c0ebbe823d5f8f1cd6463bda432a19d2de5ac0defe0fed03fecb439d0` |
| game/src/core/map-node-art.js | `ac8e1d631feccaccb6a8e1ae249d42298bcfc1d481c6005e2e64dd8f5ef918c2` |
| game/src/core/camera.js | `b76f8e16dc24ddb18ceb7e82e25a5fe032ce1e89f71371f0790ade407fbe7c7a` |
| game/src/run/expedition.view.js | `4b68cdfa484726054d39f392e45ddbd77f3c6938c0c0336faf621724fe5cfc8a` |
| game/css/expedition-map.css | `cd0a1edd15f9037f4bcd3aea564a9f0051e519fb8c00197e653ba7c66ba9d2a0` |
| game/css/page-expedition-hud.css | `ca557fa8c616f704339fcd04cee872faf98b870507b6c7ec3c62593249d0acf3` |
| game/css/feedback-oct12.css | `bfa5dbdfd403072c55e56cb23c827f7c9fc73205e13e92e7a653537b3d0b1013` |
| tests/expedition-view.test.js | `4fb087a00d1c9a27b3c6bd4b169c1e8b3c414dd770cae9649d65522e761f5bd0` |
| tests/camera-interaction.test.js | `7c35de406f495c87ee9a096c132ad7f99f28e36331001edec373e68fb022dfc6` |
| tests/fixtures/map-replica.html | `754b9aa8b51b8968ab3426d01a54bec8a3c4b2372dcbbee40982447d38310e62` |

截图获取方式为本聊天 Codex 内置浏览器 tab.screenshot 原图，未加工；均小于1MB：

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| map-replica-shop-fixture.png | 51737 | `c23a3286854c18044a31afe3eba83697b59a434e2ed74038bd302178220d7631` |
| map-replica-locked-fixture.png | 53074 | `9aee736e6e0d8b3c7baef4e21e4da6a9d7c73b9deb9f0fa8914dda04784648d5` |
| map-replica-risk-fixture.png | 51267 | `bf6268d3ce1e3c7c1ae8aacaf9f1459b1a6f7cb26eddfab451df7b8ecaac527e` |
