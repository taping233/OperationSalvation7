# 开发管理工具自动化交付（2026-10-02）

老板要求仅检查/提升开发管理系统的项目适配与自动化，不涉及游戏本体开发。三路分别实现轻预检与验证纠错、状态/失败恢复、直接任务字段与引导；主会话集成 CLI。基线 HEAD `c6ee206840`，原68项未提交现场保留。

## 已落实

- 新 `workflow doctor --json`：只读聚合项目、Node/Git/npm、锁与关键依赖、命令入口/hooks、文档和台账；单项缺失/EPERM不掩盖其它检查。无报告、未核CI和完成未提交不是错误。显式报告只呈记录元数据，当前资格需 evidence 深入核验。
- 现有 task 支持 goal/paths/重复done-when/stage/check/unverified直接字段；免两份手写JSON与临时文件。旧 --input 兼容且互斥，原任务模型/负责人/SHA锁继续验证；close漏项不默认填通过，空数组须显式none。
- 修复 `verify --full` 被映射成quick的实际缺陷：runner明确完整门，预检和报告不允许降级。verify预览拒绝不存在测试、无效类型及越界路径，输出真实selection。
- evidence先按报告kind分流；失败冻结报告先轻预检，不计算整项目指纹或洪泛原报告。有效冻结报告才深核当前index/依赖/环境；普通报告仍是候选，不自动免验。
- staged结构化 validation/nextAction 明确 executed、passed、reusableReceipt；空index、skip、证据收尾失败不能假通过。
- ship区分ready/noop/blocked，提供原因码/阻断路径/计划外stage/receiptValidity；坏报告预览直接阻断，报告在预览后改变写前拒绝。apply失败返回已完成真实commit hash、当前组/HEAD、剩余index/路径与下一步，保留现场，不回滚、不自动重试。

## 项目实测与验收

- 真实只读doctor约0.86秒：10passed、0warning、0blocked、2info、2not-checked；无需测试/构建、整项目fingerprint或依赖全字节扫描。显式本批报告只读入约2ms并明确 currentEligibility:not-checked。
- 空index预览：skip且executed/passed/reusableReceipt均false；无改动范围ship返回noop/SHIP_NO_CHANGES/no-action；显式完整门预览mode=full、未执行检查。
- 最终管理工具集成：[报告](2026-10-02T05-28-22.182Z-3c03b071.json)、[日志](2026-10-02T05-28-22.182Z-3c03b071.log)，18文件246测试通过，31.91秒，检查期间代码、文档和相关环境指纹稳定。
- 完整门、提交成功/中途失败、证明及index突变只在自有临时stub/fixture仓库测试；未运行实际游戏测试套件。直接字段CLI从预览到关闭实测，错误归属、混用、漏项均拒绝。
- 触碰9个脚本/10个测试ESLint与diff格式检查通过；文档45文件341链接0发现。四页35,954B/36,864B，根4,842B；短字段例子替换长手工模板，没有增加规则仪式。

## 边界

本轮没有自动stage/commit/推送或新prepare状态机，没有安装、修改全局配置、启游戏服务、运行游戏全量/实页/build，真实index和游戏源码保持未改。`doctor`不是全量验收；receiptValidity是轻预检，提交门继续严格核验。最小任务仍免建task，doctor按疑问调用，不变成每轮强制巡检。

修改完成未提交，编辑占用收官释放；唯一状态和检查指针见 [task.json](task.json)。远端未fetch，现存origin/master对比本地超前49笔，最新CI覆盖未核。开工现场见 [baseline.json](baseline.json)。
