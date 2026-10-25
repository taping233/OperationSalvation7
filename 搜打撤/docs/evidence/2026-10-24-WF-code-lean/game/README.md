# 容器与动效重复逻辑精简

三文件净减 84 行、3,471 字节；统一换行后净减 3,387 字节。逐文件前后 SHA256 与计数见 changes.json。原源码备份仅保留于本地忽略目录 node_modules/.cache/code-lean-before/game/，不新增重复源码入库。

bag-container-pages.js 将锦囊和珍珠盒的分组、渲染、查看、存取、保存及返回流程合并。容量读取时机、容器归属、提示文案、声音、卡牌渲染器即时读取与过期回调守卫保持原行为。两份人物/成就动效改用现有 motionReduced 入口。

验证：三文件语法与 ESLint 通过；动效四文件 18 项通过。容器相关六文件 148 项中 146 项通过；另两项存量失败位于 bag-page-lifecycle-review.test.js 的安全格交换与结晶使用回执，使用 before 源码的独立 Vitest transform 配置精确复现相同断言与位置。原失败与基线复验分别保留于 container-tests.log、container-before-failures.log。

最终容量失败提示改用明确 code 分支，保持内容与流程，满足联合类型收窄。jsconfig.runtime.json 类型检查通过；修后最短容器/库存两文件 12 项通过，见 runtime-types.log、container-final-tests.log。

576 组容器配置逐项比较 before 与 after：包含两类容器、不同持有/已存张数、满包、零/单/多容器和自定义容量；逐步比较 HTML、库存 UID/标记、提示、声音、保存、查看及过期页面回调，结果一致。回执见 container-equivalence.json。该实验使用独立内存与 DOM，不写游戏存档。

未改 layeredMap.js：现有测试明确冻结旧函数文本与整个运行 AST；旧生成器、快照兼容与冻结门保持原样。未启动服务、构建、提交或推送；浏览器复核交主代理统一执行。
