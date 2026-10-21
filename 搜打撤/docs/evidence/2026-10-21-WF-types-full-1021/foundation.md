# foundation 首批阶段历史

本页保留首批阶段历史；最终结论以 [I02收尾](I02-foundation.md) 和 [独立集成](integration.md) 为准。`coverage-final.json` 保留当时535份实现的历史覆盖，最新537份覆盖见 `coverage-I02-final.json`。下文首轮过程证据不作为最终运行语义或覆盖结论。

本轮全域实现基线为 `checkJs:true / strict:false`。保留原10份配置及原strict选项，未把全域实现覆盖称为全域strict。

- 初次全域试跑2267条定位诊断：agent95、audio66、battle360、cards41、core108、home26、hub517、run624、ui342、experience4、根入口/QA84。原始日志 `.tmp/types-full/tsc.txt`、`diagnostics.json`；不入Git。
- 首轮冻结时 `game/src` 全部535份实现均纳入，无人为排除：包括3份自有generated JS和根QA/预览。真实编译注错探针为535/535；strict实现为49/535。原10配置在收尾源码上合计覆盖63/535，剩472份由新runtime基线补齐。`coverage-baseline.json`明确是收尾源码的原配置审计，不声称历史修改前源码快照。
- `coverage-final.json`逐文件区分有效实现检查、strict检查、仅依赖可达未检查，并记录各配置的接口fixture。探针复制源码、追加必定TS2322的独特赋值，只有该文件该行实际出错才计入；files/include/import可达均不能代替。
- runtime专用`moduleSuffixes:[".typecheck",""]`使SDT shim引用真实具名导出，原10配置继续解析原facade；原facade.js仍为显式根并由探针证实实际检查。Window/ImportMeta/构建变量/桌面桥声明集中于core/runtime-env.d.ts。
- core/cards/audio/agent/home及根四QA/预览已0诊断；最终单独runtime编译exit 0。最后一次总门原10配置全过；总门当时余passive包装及game.boot两条，之后相应属地主人已清除，父会话集成最终总门。
- 定向回归11文件149测试通过；新覆盖守卫3测试复跑通过，真实覆盖漏列、exclude、@ts-nocheck、新TS遗漏负例及接口可达/strict区分。首次守卫测试被Vitest静态URL改写阻断，改为node环境与路径解析后复跑成功。自有改动定向ESLint通过。
- 保持玩法与持久化格式：声明补实际replay/passive容器；布尔结果精确收窄；DOM/回调生命周期补类型。I-02已恢复原ease-out字符串与真实库默认处理，纯类型端口适配；非法Unicode identity escape改等价`\x75`显式写法，保留旧匹配语义。I-02已恢复R7隔离QA原始namespace赋值，使用启动期对象写口类型，不伪称完整生产门面。

未执行build、安装、提交、推送或浏览器验收；父会话统一集成和现行说明。现行说明需修复jsconfig.json中已失效迁移文档链接，并明确非strict全域基线、49份真实strict实现与fixture边界。旧framework-ports配置的5/+1差异来自上轮授权成果，本轮未降级旧配置。
