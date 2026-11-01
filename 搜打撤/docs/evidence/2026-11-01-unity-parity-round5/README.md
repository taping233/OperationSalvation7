# Unity持续对照 · 第五轮

本轮集中修改、冻结后验收已通过：859项领域、262项新增及127项相关回归原生、FilmFlow和当前2560×1440正常Standalone流程。默认桌面包已更新，buildGUID为`3a68596b7ad04387a7ea36420d8ac12e`；812源码/元数据、3977构建输入保持不变，166产物共2,734,228,494字节有完整指纹。总收据见[final-summary.json](final-summary.json)。持续目标保持active。

以上轮GUID66a82ecd32f2426e98d4bf06b8ed3308、已推送a733c8a5为基线，开始时回核796项原字节0差异。源契约和修改说明见[导出契约](../../../../SoudacheUnity/_planning/parity-1101-round5/export-contract.md)、[UI实现](../../../../SoudacheUnity/_planning/parity-1101-round5/root-ui.md)、[任务](task.json)及[基线](source-baseline.json)。

- 照相馆开发模式新增整库卡牌和合并备注导出；空制作、导入、删除及Agent钩子不迁入。卡牌保留源schema v2；备注保留schema v1和完整有效notes，用简短Native说明替代浏览器操作历史。
- 备注只写Global备注键，消除无关Base/局内快照与整档保存，也不再用备注成功清除局内保存失败状态。失败暂存、同值重试、240字限制、清空回落底稿、跨档共享及嵌套事务语义保留。
- 搜索共同匹配与九类别计数从10遍目录合为1遍，每刷新只拆一次词，单卡描述按需最多展开一次；复用结果列表与计数数组。减动效稳定帧跳过12尘点的计算和设置，背景几何不变跳过覆盖布局。具体静态调用削减、真实检查及限制见[performance.json](performance.json)，未量化整帧耗时、分配或FPS收益。
- 导出只读预览限8000字符，复制和文件用完整快照；失败可重试，成功禁用重复写入。共用原有整档JSON控件；图库正式关闭立即恢复所属阶段，修复同帧关闭重开后的旧OnDestroy覆盖新页状态。

领域859项为导出29、Hub472、Run326及R2 Run32；最初新项目缺本地assets，Main未执行，离线恢复后通过。命令、日志SHA和82个Core/Run编译源未变证明见[domain-validation.json](domain-validation.json)。本轮没有把未重跑的旧271项计入新数字。

原生新增262项为保存29、动效16、搜索180、导出37，见[native-round5-3/result.json](native-round5-3/result.json)。相关R4回归127项包含照片25项，另跑FilmFlow的照片入口、返回及owner关闭；所有进程退出0、输入前后相同。首次搜索检查失败是新固定夹具套用了另一环境的中文排序；第二次补实际ID/cost/rarity/sort确认选项生效且生产Compare未变，仅修QA预期和正式类型/显示标签区分，保留严格断言、两个失败目录及全部冻结快照。未重跑的无关R3/R2/shared不计入389项。

正常Standalone当前2560×1440/DPI120、原CanvasScaler、零透明非激活宿主完成165条记录和66图；包含真实RaycastAll目标核验、完整卡牌/备注文件独立读取，以及整档导出→可编辑导入→预检确认→回选档。实际复核新增5图、普通图库1图、整档3图，见[visual-review.json](visual-review.json)。这些为程序构造原生输入；无系统键鼠、多尺寸或自然未辅助玩法证明。FilmFlow旧1920离屏目标只作组件/流程诊断，不作为另一个实际窗口尺寸验收。

完整本地产物见[product-manifest.json](product-manifest.json)，图片、大JSON与原始日志索引见[artifacts.json](artifacts.json)，超过1MB或受限媒体不进Git；构造profile不发布。EXE为Unity启动壳，哈希相同不能独立证明版本。原工作区、原index、四个Vite在途源及他人planning/bin保持归属；已授权源码同步沿`codex/unity-validated-20261101`，发布核对记录位于`publication/`。
