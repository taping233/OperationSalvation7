# IS7原参考对照与空白节点重画

2026-10-13，Friday / Codex，聊天01a133b8。老板否定当前地图外观，要求翻出之前最新地图参考板对比，并按风格重画空白节点。状态：参考对照与空白节点重画接入完成；整体地图外观未获认可，真实对局冻结副本仍待主协调同步。沿用本聊天地图属地；根REGISTRY/PENDING由主协调接班聊天01a133c4维护。

## 找回的主参考

- [IS7主图与来源](../2026-10-11-WF-selection-map-implementation-1011/map-redesign/REFERENCES.md)：黑流树海玩家实机图，原图references/ark-is7-map.jpg；本轮已view_image实际查看。
- [IS7节点原图参考板](../2026-10-11-WF-selection-map-implementation-1011/is7-node-research/gallery.html)：22张260×260节点图、45×45空地、176×176定位标记。原字节与SHA在同目录assets.json，native-black-gallery.png是原RGBA在黑底上的观察截图；本轮已实际查看该截图、source/empty.webp及本作battle/event/fire旧手绘图源。
- 2026-10-12的通用UI参考板地图页仍使用IS3，其余事件/商店有IS6；不能当作最新地图主体的主参考。上一轮IS3/IS6的几何对照不等于IS7外观已复刻。

## 本轮对照判断

| IS7原图可见结构 | 当前本作差距 | 本轮动作 |
| --- | --- | --- |
| 内容节点是象征性主体与暗圆承托、局部色晕；空地极小、低对比 | 本作保留了六类手绘主体，但空白仍是等视觉尺寸的通用圆圈减号 | 重画克制灰白空壳主体，地图中用较小尺度；详情复用同源 |
| 小空地承接路线，不逐个抢标题 | 本作可走空白也出现四字标签，重复空白节点成为主要视觉单元 | 名称只在当前/选中空白显示，其他空白保留可选图形与原点击/tooltip |
| 路线是低亮有机灰带，局部选中环与定位指示分工 | 本作白/青线更像IS3，环境灰雾也比IS7重；不能仅凭取消板子称整体美术已合格 | 记录地图整体差距；本轮先执行老板明确要求的空白节点重画，不改拓扑、迷雾或节点效果 |

图像生成用内置image_gen；参考仅控制风格/尺度，不直接接入方舟资源。新图使用真实透明alpha，保持旧六类节点图源。生成提示、引用、来源和最终指纹同目录request/receipt保存；原始PNG大图留项目.tmp，不入git。

素材清单仅新增本图单条与count，handoff核对该清单无活跃编辑占用（既有未提交变更保留），不改其他条目。主协调仍负责根登记，本记录登记本轮新增属地game/assets/asset-manifest.json的自有8行条目。

## 已落地与检查

- 内置image_gen生成原创灰白空壳，512×512无损WebP：game/assets/scenes/map-nodes/blank-symbol-foreground-1013-v1.webp，82836B。alpha范围0..255，原PNG中央与四角均alpha0，缩放/编码保留原alpha；bounds阈值224只用于测量，没有去底或修改透明度。原PNG放.tmp/imagegen/map-blank-is7-1013/source.png，receipt记录SHA与获取方式。
- map-node-art.js新增blank图源并给详情保留empty-node-icon身份类；地图主体r18，其余旧六类仍r32；空白开放角线与当前短条同步缩小。renderer.js只显示当前/选中空白名称，并缩小空白端点留白；内容消耗/入城补给领取数量变化时失效道路缓存。拓扑、迷雾、next、visited与效果规则未改。
- 同前轮7文件定向测试96项通过；node --check两份源码与目标diff --check通过，原有CRLF提示保留。新增测试确认地图/详情同源和旧六类资产保留。
- 独立构造页复用5372的/@fs/现行源码，内置浏览器1920×1080，新图地图/详情均显示正常；详情naturalWidth>0、无新增scroll，error/warn为空。中段输入第一次CDP超时，核对页面和日志后重试成功；该错误不记为通过。构造数据与真实输入按钮范围分别标在对照板，未操作主协调游戏tabs或存档。
- 素材增量门全项目仍失败：400条范围外登记/指纹问题、623条未变历史警告。本轮新blank的图源条目/bytes/SHA/license与count核对均无问题，详见map-blank-is7-asset-check.json；没有批量修其他资产或修改债基线。

对照板：[map-is7-blank-comparison.html](map-is7-blank-comparison.html)。图像生成完整prompt/references/source：[request](map-blank-is7-request.json)，编码/alpha/bounds/SHA：[receipt](map-blank-is7-receipt.json)。截图为本聊天内置浏览器原始PNG，不加工参考图；本轮未build/安装/删除/提交/推送。

整体地图仍待整改的判断：本作目前更接近IS3式明亮路径图，IS7的低亮有机路线、暗承托与局部光层未落实；空白节点完工不能代表这三项已解决。未覆盖完整四层真实对局、冻结副本点击/读档、长期帧率；素材门范围外失败须由主协调沿现有工作树归属集成，不在本轮扩大修改。

后续老板明确“那你对着改吧”，本聊天已继续整体整改；上述段落是本次空白重画交付时的判断，后续现行实现与复核见[map-is7-overhaul.md](map-is7-overhaul.md)。

交付源码/截图指纹与对照板链接检查：[map-blank-is7-delivery.json](map-blank-is7-delivery.json)。本轮编辑完成未提交，自有地图源码与素材条目结束编辑；主协调登记保持其他在途任务。本聊天仅将自建tab保留为IS7对照板，不创建/停止任何服务。

对照板浏览器7张原图/素材/截图naturalWidth检查全部正常。打开对照板时一次手写编码URL误入本聊天tab的标题页fallback，未进行游戏输入，不作为验收证据；随后用已核对的中文原路径encodeURI打开正确对照板，主协调tabs未操作。
