# 背包单次渲染派生复用

基线：e817a3aa2ad945c904b87bdaa99bb697a7f30d0c。原始种子26文件在修改前逐文件验证 Git blob SHA；测试输入补齐自固定 SHA 验证的 code-baseline。只在此独立副本修改，未动共享主副本、规则定义或动画代码。

## 实现

- 新增纯 helper game/src/core/bag-render-derivation.js。一次 ownedCards 遍历产出背包/安全格两区卡牌分组、UID首次索引、普通背包同名数量、两区张数、盒内张数及资源扩容。再由分组切堆；一次散装物资遍历产出占格、件数与估值。
- 旧 cardStacks(safe) 与快照共用 addToGroup/splitGroups，保持首张卡面、原 UID 顺序、同名多堆、装备1张/其他3张、stored排除、安全格独立计容。cardStacks 本身仍是实时查询。
- 排序同步用 Set；比较器用 Map 首次索引。保留已有重复 cardOrder 项及 Array.indexOf 的首次命中语义，移除过期名称并按两区首次出现顺序补名。
- 页面摘要、两区列表与复原道具用途提示共用 renderState。renderState 只在同步渲染调用栈中流转，不保存到 game、模块变量或动作闭包。详情打开、使用、移动、丢弃、复原及容器存取仍调用实时守卫。
- 实时 bagCap 继续调用 resourceContainerBonus；快照逐项调用同一规则域的 resourceContainerSlots，保留声明式 containerRuleOf 及历史适配，不硬编码珍珠盒容量。容量文案使用共享纯格式器。
- 保留 e817a3aa 的 closeBagZoom 同步关闭与 containerAccepts/containerRuleOf 容器动作逻辑。壳从766行降至760行。

## 可验证的性能边界

原 bag-render-snapshot 记录的主背包/安全格/消耗区5/4/4次ownedCards分堆遍历，现均为一次；渲染不再向实时cardStacks请求数据，也不再对ownedCards调用filter/reduce/findIndex。600张、200堆复原卡的用途提示测试锁定仍只遍历一次，未使用耗时阈值冒充稳定性能结果。

## 验证

- 8个业务定向文件共142测试通过：bag-render-derivation、bag-render-snapshot、bag-pane-retained、bag-help-return-continuity、bag-structured-use、bag-token-craft、bag-token-discover、bag-page-lifecycle-review。
- bag-architecture、card-rules-bag-boundary共6测试通过。新测试含100组混合库存与独立旧算法等价、声明式/历史/撤除容器规则、原地更新、重复UID/排序首项语义、实时复原守卫与大量卡牌扫描限制。
- 六个变更文件ESLint通过，四个源码node --check通过。补丁对只读code-baseline的git apply --check通过。
- 固定e817a3aa game/index.html补齐并核验后，bag-pouch-capacity 24/24、bag-structured-rule-migration 6/6通过；累计12文件178测试通过。日志保留夹具美术预取/无codec警告，无断言失败。
- 本轮只做合成DOM/定向验证，未运行完整构建、全套门禁或浏览器实页。完整集成按父任务统一门禁。

## 交付

- bag-render-derivation-e817a3aa.patch：仅6个约定源码/测试文件。
- bag-render-derivation-files.json：变更文件前Git SHA、后SHA256。
- bag-render-targeted.log：首轮业务定向结果（含当时缺index.html的历史阻塞记录）。
- bag-capacity-migration-test.log：index.html补齐后的两套真实启动测试30/30通过记录。
- bag-render-contract-test.log：架构/规则边界结果。
- bag-render-lint.log：定向ESLint（空文件表示成功无诊断）。
