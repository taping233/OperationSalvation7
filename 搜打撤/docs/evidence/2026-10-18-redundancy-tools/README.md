# 冗余与依赖工具实测（2026-10-18 UTC）

保留 jscpd 5.4.1（MIT），不把 dependency-cruiser 18.6.0 加入项目依赖。两者均已从官方 npm 实际安装并执行，安装使用 ignore-scripts/no-audit/no-fund；没有上传源码、下载模型或收费API。dependency-cruiser 安装在隔离 /tmp 目录，仅试用；项目 package/lock 从未加入它。

## 真正补上的能力

原 package.json 已有 jscpd:baseline，却没有声明 jscpd，当前环境也无本地/全局命令。现精确锁定 devDependency，补上可复现本地命令。新增 quality:clones 逐个扫描 battle/ui/hub/run，单worker，原始报告存 node_modules 缓存。删除 Knip 配置中旧 jscpd ignoreBinaries 豁免，现在由真实依赖提供命令。

最终定向报告（70 tokens/6行，weak模式，仅JavaScript，排除vendor/generated；此处为业务收拢前快照）：

| 域 | 文件数 | 克隆对 | 重复行 | 工具重复率 |
| --- | ---: | ---: | ---: | ---: |
| battle | 102 | 4 | 43 | 0.240% |
| ui | 73 | 1 | 7 | 0.085% |
| hub | 78 | 6 | 59 | 0.456% |
| run | 42 | 2 | 23 | 0.243% |

总计13组是候选，不能理解为13个缺陷。初始90tokens/8行试跑扫描了许可证，已通过限定JavaScript和排除vendor修正；保留的四份原始报告均已覆盖为最终配置结果。

## 可操作候选与保留例外

1. 优先：game/src/hub/game.bag.js:368–381 / 652–664、382–389 / 667–674，两条详情/zoom入口重复实现通行证合成。宜抽取合成命令，保留各入口closeZoom及bagAct生命周期，先做等价行为回归。已经将精确报告交给并行审查任务，本任务不修改业务。
2. 次优先：game/src/run/game.run.dev-loader.js:40–47 与 game.run.dev.js:100–107 复制来源快照字段。后续增加返回焦点/页面状态字段时容易只补一处；可提炼轻量捕获函数，但不能让dev-loader静态导入重型dev实现而破坏懒加载。
3. 需谨慎：battle.effect-feedback.js:147–155 与 battle.turn-feedback.js:52–60 都按token/eventId去重，但事件种类过滤发生位置不同。不是可以直接整段合并的证据，先定义事件消费语义。
4. 应保留：layeredMap.js 两个适配入口相似，但注释明确历史3/9重建冻结、新4/9独立入口；不能为了去重把旧局与新局绑到同一演化函数。
5. 谨慎保留：battle-settlement.commands.js 重复恢复/档位/版本检查位于收据读取与创建事务；跨await防陈旧归属边界不能为了行数缩减而挪走。

其余候选的完整位置见 clones-summary.json。未自动删代码、搬目录或修复全部候选。

## dependency-cruiser 真实试用

配置 dependency-trial.config.cjs，完整输出 dependencies-trial.json。巡检523模块、1349条依赖，未报模块环、未解析导入或生产→dev依赖；generated目录排除，npm依赖不深入，结果只覆盖此配置闭包。

4条宽泛core→view警告均有具体解释：
- enemy-phase→feedback：等反馈/等待节奏桥接。
- engine→feedback：装配导入。
- lifecycle→feedback：结束时清理反馈队列。
- resolution→attack-cues：纯符号cue映射，文件虽然在view目录，不操作DOM。

不能把目录名自动等同运行时架构违规。feedback文件头写“纯函数”，但实际有队列、AbortController及时间适配；这里以真实实现为准，判为既有演出协调桥接。现有 contracts 已对真实源码执行 assertAcyclic，architecture-boundaries 维护更细粒度纯模块边界。此次没找到足以值得再加一套常驻图工具的新问题，因此不保留其43包/约7.4MB依赖成本；隔离试用产物只作证据。

## 成本与验证

jscpd5使用官方平台二进制，本机新增2包，约45MB，仅devDependency。扫描和测试都是本地词法比较；没有启用semantic/embedding功能。没有加入CI阻断阈值，没有运行build或提交推送。

Node v22.23.3下：1项真实CLI正负样例测试通过（克隆检出、generated/vendor/LICENSE排除）；定向ESLint通过；contracts+architecture-boundaries 2文件41项通过；npm ls jscpd显示5.4.1；package/lock diff --check通过。游戏无本任务可见变更，不新增实页验收结论。

官方源：[jscpd](https://github.com/kucherenko/jscpd)、[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)、[依赖规则](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)。用法见 [现行说明](../../modules/redundancy-tooling.md)。

## 隔离试装清理

父任务明确批准移除本批新建的 `/tmp/dependency-cruiser-trial`。核对绝对路径、非符号链接、package.json仅含18.6.0及试用配置一致后，已于2026-10-18 UTC删除该目录并确认不存在。保留 dependency-cruiser-LICENSE.txt、dependency-trial.config.cjs、完整JSON报告及 reproduce-dependency-trial.txt；共享npm下载缓存未动，不视为已安装工具。项目依赖从未加入该工具。
