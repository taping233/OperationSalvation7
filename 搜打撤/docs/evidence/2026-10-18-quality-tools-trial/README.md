# 质量工具定向试用（2026-10-18）

结论：保留 fast-check、StrykerJS、Knip、axe-core，按批次显式运行。本次没有改游戏业务文件，没有全量测试、build、真实浏览器或对比度验收，没有自动修复/删除、提交或推送。

## 版本、许可证与安装边界

- fast-check 4.10.2，MIT：[官方](https://github.com/dubzzz/fast-check)。
- Knip 6.42.0，ISC：[官方](https://github.com/webpro-nl/knip)。实装版本取自本次官方npm元数据，比初次网页发布页的6.41.0更新。
- @stryker-mutator/core 与 @stryker-mutator/vitest-runner 均10.0.0，Apache-2.0：[官方](https://github.com/stryker-mutator/stryker-js)。
- axe-core 4.14.0，MPL-2.0：[官方](https://github.com/dequelabs/axe-core)。
- postcss 8.5.28，MIT：[官方](https://github.com/postcss/postcss)。原已作为传递依赖存在；30处测试直接import却未在项目声明，本批提升为显式devDependency，未升级其版本。

均来自 https://registry.npmjs.org，精确锁版本，安装使用 --ignore-scripts --no-audit --no-fund；没有运行安装生命周期脚本、付费模型或上传源码。Node22.23.3、Vitest3.2.7。原package/lock保存在snapshot/，既有锁定包无删除、无版本变化；新增196个lock条目，首次实际安装155个包/17秒。工具直接目录约20MB，不含传递依赖，不能作为总新增体积。

首个npm元数据查询因默认缓存/home/agent/.npm不存在失败，改到可写/tmp缓存后成功。没有网络拒绝绕行。后续显式postcss安装9秒，既有包版本仍未变。

## 结果与价值

### fast-check：保留

quality:property 2文件7测试通过（4新属性、3既有例子），4条属性各500样本、seed 20261018；该次约477ms。验证手牌支付成员/排除/已选/真实卡约束、普通类型精确匹配、通配键和初始攻击名称边界，并检查输入未变。证据property.log。

### StrykerJS：保留，限核心模块按批次执行

仅battle.hand-selection.js，单进程，45个变异，44 killed、1 survived，0 timeout、0 no coverage、0 errors；分数97.78，13秒。7个测试实际执行，未跳过、未修改业务规则、未放松断言。原始结构报告mutation.json。

存活项将card.name缺省回退空字符串改成“Stryker was here!”；两者都不匹配锚定的杀/初始攻击正则，按该声明输入域属于语义等价，不为了100分忽略该项。

第一次临时沙箱设在node_modules下，被Vitest默认排除，0测试退出失败（stryker-first-attempt.log）。随后把沙箱改到已忽略的.tmp路径，实际7测试和45变异完成。未以禁用测试选择或静默skip解决。忽略不相关资源目录仅减小沙箱复制成本，mutate始终一个纯模块。

Stryker验证断言能否发现变异；不能发现规格本身误解，不能保证识别实现和测试共用的错误假设。

### Knip：保留，report-only

2026-10-18 18:31 UTC首次采样：36个未声明引用（30 postcss、6 electron），3个历史证据导入缺失。将postcss显式声明后，18:32 UTC再次采样剩6 electron、3 unresolved；Knip退出1正确表示仍有发现，不声称检查全绿。证据knip.json / knip-final.json。

Electron来自desktop-app、旧性能与烘图工具，当前Vite范围不安装。游戏源JS全部保守列为入口，以免副作用/动态注册产生误删建议；本轮展示的是依赖声明与导入可达性价值，并未证明整个游戏无死代码。

三个缺失目标（采样时点，之后可能由其他任务恢复；需按最新工作区重新核对）：
- tests/sound-f4ngy-draw.test.js:7 → docs/evidence/2026-10-17-f4ngy-draw/before/sound.samples.catalog.js
- tests/sound-real-foley.test.js:7 → docs/evidence/2026-10-17-real-foley-batch/before/sound.samples.catalog.js
- tests/sound-safe-slot-foley.test.js:7 → docs/evidence/2026-10-18-safe-slot-foley/before/game/src/audio/sound.samples.catalog.js

已交叉通知历史证据恢复任务，本工具任务没有恢复或删除这些文件。

### axe-core：保留为静态DOM补充

对照夹具能发现无名button。真实静态game/index.html检查9规则：0确认违规、1 incomplete。#mCredits的aria-controls指向homeCredits，需要运行时页面核对，静态结果不能确认目标是否存在/可用。完整节点和规则保留axe-dom.json。

限定为JSDOM、无应用执行、无外部资源加载。未检查实页对比度、布局、Pixi/canvas、键盘整条流程或审美/趣味；不使用Playwright/headless替代内置浏览器。exit0不等于incomplete已经处理。

## 复用入口与检查

命令与边界见 [tests/tools/README](../../../tests/tools/README.md)。4条入口没有加入每次pretest或全量check:quality，按批次集中运行。ESLint定向检查属性测试通过，两份mjs语法检查通过，git diff --check通过。业务模块SHA256：43a1f14c4c193365a58e21694b7bd8b31de45a6c1f778abc30aaca8479aadc37。

全量集成、远端CI、实页、颜色对比度均未覆盖。现有Vitest/ESLint/类型/jscpd保持原状。

收官后将日常Stryker/axe输出改为node_modules/.cache/quality-tools/；本目录mutation.json与axe-dom.json是本次保存的历史样本，后续命令不覆盖。该路径变更仅影响报告落点，不改变测试范围或判定。

18:34 UTC收官复核：其他任务已按固定历史blob恢复三个音频before文件，重新Knip后unresolved降为0，仅6处非本轮Vite范围electron未声明引用保留（knip-after-recovery.json）；此前knip-final.json保留作采样历史，不代表最新缺失。

既有根knip.json在最终核对时识别为已有配置，已恢复原字节；本轮保守入口另存tests/tools/knip.report.json，由quality:unused显式指定。原配置未被替换，已保存到snapshot/用于核对。

## axe人工项只读复核（18:36 UTC）

#mCredits → homeCredits 没有发现命名或静态目标缺失：game/index.html:215按钮正确引用同文件:239真实dialog，dialog的aria-labelledby指向:241的homeCreditsTitle。该节点原本就在HTML中，不是动态创建占位。title-credits.js:8-28查找这些节点，点击调用showModal，返回表单或cancel经动画调用close；未发现删除或替换homeCredits的代码。

axe4.14.0源码axe.js:31888-31896对带aria-haspopup的aria-controls设置controlsWithinPopup人工检查标记，:31947起有needsReview即返回undefined。因此这项incomplete不能归因于引用目标真的不存在，也不能简单归因于dialog关闭；它是该规则对popup关系的保守处理。没有为清零报告修改aria-controls或业务代码，也未把人工项当已发现缺陷。

当前平台内置浏览器没有本项目运行页，未启动替代浏览器。真实弹窗打开/关闭、焦点返回与运行时可达性仍未核验；在统一实页验收时检查。本次只读源码与规则已足以排除“静态ID拼错/目标未声明”的候选，不声称完整交互通过。
