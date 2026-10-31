# 现行文字与生存指南迁移

已按现行源码补齐明确可达的展示缺口，生产冻结，等待 Root 原生/实际播放器复核。没有把此前的650用例或旧页面矩阵作为正确性结论；本轮重新执行源码导出和比较。

## 查明与修改

- `menu-guide.js -> beginner-guide.js -> data/beginner-guide.json` 现行是六章完整图文指南；Unity原来仍显示旧九行“快速参考”，还写着“开始远征”。现已移入原6章完整数据、原图、标注点、章节导航、前后章、展开说明、操作提示、原图双向滚动与Esc返回同章。指南数据原字节复制，6张WebP无损解码为原尺寸RGBA PNG，来源/输出SHA见 `guide-assets-receipt.json`。沿公共uGUI、字体、返回按钮与素材加载入口，不重设计美术。
- 指南保留章内滚动位置、原图阅读状态隔离；章节内容单区更新，90ms退出、180ms三组进入和35ms错峰来自region-transition/motion-presets。新输入取消旧切换，当前章点击取消待切换，不排队。
- 原始卡库和共享formatter数据本身没有本次证实的版本漂移：重新启动现行Cards ensure链，291卡×12展示字段与生成CardDatabase逐项相同，fresh描述修订/术语数据与Unity资源JSON相同。但仓库/背包/结算/选人预览/战斗道具和装备说明多处绕过formatter直接显示旧简写 `desc`。这些真实消费者已统一接CurrentCardPresentation，战斗使用即时Snapshot和UID的描述上下文；原卡定义/规则未改。
- 照相馆Dossier和照片背签把源四类伤害标题全部降成“伤害”。新增共享DamageCaption，并接回“攻击伤害 / 法术伤害 / 固定伤害 / 真实伤害”；负伤害值显示条件也按源仅限attack。
- 设置三档QUALITY_HELP恢复源用户文案。Root已补绘制cadence后，帧率说明恢复源“地图按所选上限绘制；战斗角色 ≤60 帧，庭院 ≤30 帧。”，删除“原生窗口”实现细节。新cadence仍待Root原生验证。
- 另经Root授权修复CardLibrary.All的真实合并差异：旧实现把customs直接拼在静态库前，编辑内置卡后显示292张、同id两张，且重排抽取池。按源cards.js upsert语义，同id在原索引替换，新id追加。原库/自定义条目的规则字段、存储内容和写接口未改。

## 本轮检查

- `node export-copy.mjs` fresh Vite SSR源导出291定义/650上下文。
- `python check_catalog.py`：291×12字段差异0、描述数据资源与fresh源相同，结果 `catalog-comparison.json`。
- `dotnet build PresentationChecks.csproj` 后直接执行DLL：650真实源预期对当前共享formatter，差异0；该结果证明formatter范围，消费者实际呈现另需原生。
- `python check_compile.py`：本片私有输出，最终当前依赖0错误、10警告，新增指南没有警告；中间一次13警告中的三条为其他片电影JSON反射字段，后续已由该片处理。
- `node source-custom-merge.mjs` fresh源实际upsert：291→编辑仍291、同id1、新id追加到292。私有Core真API测试7项通过：默认顺序、编辑不增馆藏且唯一id、原索引新描述、池顺序、新id追加、序列化provider文件重读后同样、无重复。`custom-catalog-result.txt`保留修前292/重复2的复现，`custom-catalog-result-after.txt`为修后。该文件roundtrip覆盖CustomsLoader/Saver合约，不宣称操作了Unity用户真实档案。
- 所有生产/源SHA在 `production-freeze.json`。本片不启动Unity/CUA、不写共享编译/台账，不改变Root正在演示的播放器，不提交。

## 原生复核入口

`GuideScreen`现仅接 `CurrentBeginnerGuide`。可读属性：`PageCount=6`、`CurrentPage`、`ImageReading`。实际控件名：`guidePage-0`至`guidePage-5`、`guidePrev`、`guideNext`、`guideMore`、`guideImageOpen`、`guideImageClose`、`guideBack`。原图使用正式新资源，原图尺寸来自纹理，不缩小源图。需要真实显示确认文字不重叠、长文可滚动、图像清晰、快速换章与Esc回原章。

Root拥有CardFace并补默认live battle context；本片没有写该文件。PhotoInlineLinks像素密度命中修复归清晰度代理，本片没有写该文件。
