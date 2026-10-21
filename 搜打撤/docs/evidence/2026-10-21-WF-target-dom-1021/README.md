# 战斗目标DOM写入守卫（2026-10-21）

已发布 `b5a59762b7a7942e52fcd2da28222ef06a300dcf` 为基线，仅修改 `battle.aim.js` 的实时DOM写入守卫和新增六项回归。三敌目标的20次稳定真实渲染中，目标属性写入及对应MutationObserver记录由180降到0；can-target切换API调用由60降到0。这两个指标分别记录，不能相加为DOM变更数，也不代表整场DOM、耗时、堆内存或FPS。

## 行为与审查

当前DOM属性/类名匹配时不重复调用setter；每次仍按当前战斗状态判断资格并生成标签。不缓存目标或名称，保留改名、死亡/恢复、自身身份变化、外部DOM修复、取消后重选和Enter确认。显式tabindex、null/undefined标签转换及无关属性保留均有测试。未修改目标规则、命令、预览、玩法或样式。

原补丁SHA256为 `f92ed6af769ead12c290ebdadd23e0e34ebabddbb32995ce83fd27ec1dab72a1`；精确双文件哈希见 `applied-patch.json`。已审查的动态资源消费者清单不包含aim模块，且本补丁不引入资源消费者，因此不更新任何资源指纹、排除项、质量门或预算。

## 证据

- 独立近邻17文件352项通过，无失败/跳过；原报告 `final-tests.json`，列表 `target-tests.txt`。
- 相同六测试旧源码负控4项预期优化失败、2项功能通过；候选6项通过。原日志、断言与计数见 `negative-control-summary.json` 及对应原始报告。这里只复用已核对源码/补丁哈希的证据，没有重复制造测试次数。
- 轻量overlay曾因目录枚举不遍历链接而缺ui-scale图节点，首次345/346的失败完整保留在 `initial-overlay-target-tests.json`。完整542模块替换源图无环/无架构违规/无失效守卫键见 `overlay-architecture.json`；它不替代正常冻结门。`independent-README.md` 与两份mjs为原overlay取证脚本快照，重放需在其中写明的原独立目录，不应直接在本证据目录执行。
- 标准 `npm run build` 仅运行一次，含原prebuild/postbuild；1595文件、171876990字节；entry gzip368124、initial JS gzip417826、CSS gzip226802字节，原预算全部通过。相对b5包体+237字节、entry/initial各-8字节；哈希变化引起压缩波动，不宣称下载优化。原日志、精确输出manifest及前批1595文件重建前核验见同目录。
- 静态产物闭环通过：当前HTML/CSS/JS字面量、构建清单、别名与宝箱路径无缺件/已排除项引用/排除警告；不覆盖任意动态JS或浏览器网络。
- 冻结前正常选择器门及普通hook在此快照之后执行，实际成败与精确index报告路径由外部 `performance-target-integration-b5-20261021/target-dom-release-manifest.json` 及本目录自动生成staged报告记录；此预冻结文档不预称门已通过。

## 边界

当前批无内置浏览器实页、帧时、远端CI或部署验证；生产build不是实页验收。未额外强制full，原选择器决定实际覆盖。无本批服务，不提交、上传、推送或部署；仅交冻结文件与本地结果供父任务继续处理。
