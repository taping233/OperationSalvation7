# 现行存档页与标题成就

按当前 `menu-slots/menu-slot-view/slot-emblems` 和 `achievement-gallery/medals/motion` 及最终 CSS 转译。生产冻结供主会原生生成和独立审查；私有源语义编译、原始像素比较和结构检查不能代表实际效果一致。

存档页沿五档、真实四态、展开更多、最近对局、真实时间和血量/金币字段；一个 live SaveSystem 提供单档错误隔离。新建/覆盖/删除仍使用原有原子事务入口，显式确认、失败留页与防重复输入由界面承接。标题成就沿最近有效档位的基地快照，使用正式 MetaProgress 的 26 个定义、解锁谓词与已领取记录，保留原分类/筛选、列表/网格、详情连续浏览、光效和荣誉档案过场。

`source-receipt.json` 登记所有现行源/原始资源/输出 SHA、转换方法与大资源字节；PNG 复用 WebP→Pillow 和原 SVG→CairoSVG，没有生图。已有五幅首页壁纸、返回箭头及 painted 图集继续复用，其他四种图集与独立切幕归本域。单文件大于 1MB 的输出不进 git，只按 receipt 路径和 SHA 使用。未删除旧资源。

研究所第二图按 `MIGRATION.md:9` 排除，当前普通/精英四层档没有 `nestActive` 分支。源 `saveArchive` 没有注入时不显示备份/恢复入口；本版没有为旧 Web 存档建迁移层。设置段、Hub 档案和 Run 保存事务没有在此片修改。

`check-source.ps1` 使用项目本地 Roslyn 对当前源做只读语义编译，输出本片诊断；不 Emit、不启动 Unity、不写共享编译产物。`freeze.json` 记录生产 SHA、原始 RGBA 比较、稳定控件名和待原生场景。成就最终图须在进入后至少等待 1800ms；原模块的 850ms 图像揭幕后，实际共用 handoff 将退出时长提升到 680ms。
