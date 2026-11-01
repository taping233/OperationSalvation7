# 照相馆只读导出契约

2026-11-01。结论：现役Vite真正提供卡牌、照片备注两种导出；制作、导入、删除均被冻结为空入口。Native本片只补两种只读payload和后续正式导出呈现，不复制空制作坊、Agent或旧网页档导入能力。Root已确认下述格式与纯服务接口；所有代码改完后由Root统一验证，本片不执行。

Vite参考HEAD为 `f966e859043b7ab3703839005029ef090a4677b5`，本次所读照相馆/备注/卡库存储文件与HEAD无工作树差异。关键来源SHA256：`game.cardslib.designer.js` 为 `924391c092d6ab5bf55e2b35f723516c78826f04390381756a83d5f7b71a785a`；`card-photo-notes.js` 为 `e5b584cc493c1beebc5918f6920c0434a8cd8711886c4cd4c1c8b22a71a2435d`。

## 实际活跃链

源路径均相对父项目 `搜打撤/game/`。

| 来源 | 已核实的消费者与行为 |
| --- | --- |
| `src/game.boot.js:25,92`；`src/hub/game.cardslib.js:43–47,163–164` | 正式照相馆轻门面按需加载page；debug.openCardDesigner仍经过同一门面，但实际工厂不再创建工作台。 |
| `src/hub/game.cardslib.page.js:157–161,759–767,828,899–913` | page装配createCardDesigner。默认libEditMode=false；devMode显示“导出工具”，打开后显示卡牌导出与备注导出。导出回调不使用libFiltered结果。 |
| `src/hub/game.cardslib.designer.js:9–32` | 唯一实际卡牌导出：捕获一次JSON，显示只读textarea、复制、下载及返回照相馆；原文件名sdt-cards.json，MIME application/json。 |
| `src/hub/game.cardslib.common.js:31`；page`:807,898,900`；designer`:35–39` | CARD_DESIGNER_WRITES_ENABLED=false；newCard/delCard/importCards为空函数。openCardDesigner及showCardsImportOverlay只回照相馆；closeDesigner只调closeLibPage。底层Cards仍有upsert/remove等数据API，不能据此称现役制作/导入/删除UI可用。 |
| `src/cards/card-photo-notes.js:14–80` | 备注导出的真正来源；与`src/hub/game.notes.js`中同名exportNotes无关。读取永久底稿、浏览器持久手写、当前会话pending，生成card-notes.json内容。 |
| `src/cards/cards.js:102–136` | Cards.all读取/缓存当前完整卡库，含已播入内置与自定义/覆盖。只校验规则并返回卡对象，没有导出字段清洗。page`:102,140–145`的馆藏模型另外排除tt-token-color，但导出直接使用Cards.all，连这条显示排除也不应用。 |

源UI有一处不必复制的状态残留：libEditMode是模块内会话变量，关闭页面不清零；关闭开发模式后，header中的exportNotes仍仅依libEditMode显示，而editorTools依devMode隐藏。Native应把两种导出放在同一个正式工具区，按当前开发模式与页面owner判断，不保留这一可见性不一致。

## 卡牌格式与范围

保持源envelope与版本：

```json
{
  "game": "sdt",
  "format": "cards",
  "version": 2,
  "cards": []
}
```

`cards`是打开导出时的完整当前`CardLibrary.All()`快照，不是当前筛选/排序、选中照片、收藏清单、携带牌、仓库或战斗实例。包含内置定义、自定义追加、同ID覆盖；同ID覆盖保留原位置，新ID追加。不能改取CardDatabase.All，也不能套用照相馆的tt-token-color排除或随机可获得过滤。

**源未剥离动态字段，Root确认Native也不剥字段。** Vite直接JSON.stringify当前Cards.all；JS对undefined/函数/不可枚举属性的天然省略不是显式动态字段清洗。Native按`SaveJson.Token(CardLibrary.All())`序列化已有CardDef字段，保留variantKey、runtimeCost、zeroCostUntilTurn、noInfuse、count等实际存在的值，也不递归删规则键。Native可空/默认字段与JS缺省字段的文本形式可能不同，不声称字节级相同或任意未知JS扩展字段都能保留；这是当前C#模型边界。

必须通过SaveJson已有RuleValueConverter生成普通规则树，不能直接用默认序列化把规则变为`{"Values":...}`。payload不得改动源CardDef、共享rules、当前卡库、档案或RNG；复制与导出文件应使用同一份已构造JSON。

## 备注格式与合并顺序

保持v1结构；Root明确采用简短Native说明，不搬运源_comment中的旧浏览器同步历史，也不为说明文本修改资源导入链：

```json
{
  "version": 1,
  "_comment": "Unity照片备注导出：合并底稿、已保存手写与本次会话未保存编辑；清空手写后回落到底稿。",
  "notes": {}
}
```

内容严格按以下顺序：

1. 一次读取正式持久手写map，复制到临时map。
2. 对所有会话pending逐键覆盖；pending空字符串删除临时手写键，不能把底稿键删掉或用空串覆盖底稿。
3. 复制完整底稿，再用处理后的手写map覆盖。

因此“清空待保存的旧手写”有底稿时输出底稿，无底稿时不输出该键；未落盘的新文本也可导出。范围是全局全部备注，不依照片筛选/排序，不仅遍历当前卡库；持久或pending中的历史/自定义ID也保留，避免丢掉不在当前馆藏中的备注。数据型键名如toString/constructor/__proto__按普通字符串保留。

Vite的readSavedNotes读取失败会用空map继续展示/导出，可能遗漏不可读的手写；Native不把损坏读取伪称完整成功。沿唯一读取入口保留原解析异常，null结构或HasReadError明确拒绝，原档和pending保持不变。导出不尝试自动修复、保存或清空pending。

既存保存差异另作边界：Vite一次保存成功会合并全部pending并清空Map；Native PhotoDetailScreen当前逐ID重试并只移除成功的pending。导出服务接收全部pending快照，涵盖尚未成功的其它ID，不借导出顺便重构保存事务。

## Native缺口、接口与复用

当前照相馆没有这两种导出按钮/payload。HubCatalog只保留baseNotes，原`_planning/migration-1029/ui/sync_assets.py:50,244–245`不传入源version/_comment；本片按已确认的v1+Native说明处理，不改该生成器，也不碰有他人历史WIP的_dump.mjs。

纯服务新增`Assets/Scripts/Sdt.Run/PhotoStudioExport.cs`，不引用UI：

```csharp
public static string PhotoStudioExport.CardsJson();
public static string PhotoStudioExport.NotesJson(
    SaveSystem saves, IReadOnlyDictionary<string, string> pending);
```

Hub已提供`BaseData.ReadPhotoNotes(SaveSystem saves)`（internal static）与唯一PhotoNotesKey；读取、PhotoNote及TrySavePhotoNote共用，不另写存储key或读取分支。UI后续从PhotoDetailScreen交付pending复制快照；服务不能反射读取UI私有字段，也不能让Run反向引用UI。null参数是调用错误，读取损坏是明确失败，不用空map掩盖。

当前可直接沿用的工具：

- `CardLibrary.All()`的现行合并缓存和稳定覆盖顺序；`SaveJson.Token`的普通规则JSON转换；Newtonsoft JObject/JArray/Formatting.Indented。
- `CurrentSlotArchiveScreen.cs:24–54`已有只读多行文本、GUIUtility.systemCopyBuffer、当前owner守卫及UTF-8无BOM/CreateNew导出模式。复用其实现模式或已有公共元素，不调用档位备份业务来伪装卡牌导出。
- 文件可沿现有SaveSystem.Dir/exports目录、唯一文件名与页面内成功/失败回执；浏览器的下载/Blob生命周期由桌面文件行为替代。基础格式名仍为sdt-cards.json/card-notes.json，若为避免覆盖附加时间/短ID，应在UI说明回填备注数据时的目标名。

文件、剪贴板、只读对话框、入口开发模式与owner/返回焦点由Root持有。本服务不做I/O或Save写；后续打开导出时构造一次快照，复制/文件复用它，不按Update重算或逐张调用PhotoNote反复解析全map。返回保留当前照片筛选、选中与滚动，是比源重绘照相馆更省的明确改进；不增加新制作坊、导入/删除按钮、自动传送或Agent能力。

## 本片验证源边界

Root授权最小payload领域项目，复用`_planning/parity-1031/HubParityChecks.cs`的Unity资源/音频stubs，以独立StartupObject运行新Program，不启动其Hub测试Main，不另造测试框架。覆盖完整实库及自定义覆盖顺序、规则普通JSON与卡库未变、底稿/持久/pending优先级、空pending回落、未知ID保留、坏数据拒绝及档案/pending/底稿不变。有效payload在只读文件锁下也应构造成功，证明服务不偷偷保存。

服务与检查源已准备，入口为`_planning/parity-1101-round5/export-check/PhotoStudioExportChecks.csproj`，工作目录为SoudacheUnity；StartupObject明确选择PhotoStudioExportChecks，不执行复用文件中的Hub Main。成功路径预期29条断言：24个独立Check位置，加坏map循环重复2次、Reject内部Check额外调用3次。输出由入口运行时写到自身目录下唯一output时间戳目录，SDT_UNITY_TEST_DATA指向其中profile；本片没有调用该入口。

UI工具可达性、复制/文件一致性、实际写失败回执、过期owner、关闭失效、返回焦点与当前窗口布局由Root后续统一原生/播放器验证；payload检查不冒称覆盖这些呈现和输入。冻结版本见[export-freeze.json](export-freeze.json)。
