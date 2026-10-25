# 无字入城与节点演出

已实现，完成未提交。老板认可破裂城市倒影，随后要求去掉多余文字、扩展几种演出，并明确“不用测试，做完即可”。最终增量按该要求未追加自动测试、实页验收或构建。

## 当前呈现

| 位置 | 画面与动作 | 短片时长，不含准备和淡出 |
| --- | --- | --- |
| 整备确认出发 | 大黑场，城市倒影从破裂玻璃中显露 | 2.6 秒 |
| 普通战斗 | 斜向裂面切开黑场 | 0.72 秒 |
| 首脑战前 | 石墨黑块面从远处缓慢压近 | 1.6 秒 |
| 撤离完成 | 暖灰白留白，两侧碎面向中央收拢 | 1.9 秒 |

四种画面均无可见标题、副文案、英文编号或解释文字。出发/撤离仅保留低对比箭头跳过按钮，可访问名称和屏幕阅读器状态保留；战前沿原点击跳过入口。减少动态效果沿原设置处理。

依据 `docs/production/design/STORY-PART-ONE.md`：当前剧情为冬日城市污染与军事封锁，多次进城不是时间重置；演出采用城市破片意象，不泄露污染源，不定义新的角色或首脑身份。初期雪原草稿未接入。

## 接入与素材

- `game/src/ui/departure-cinematic.js` 与 CSS：出发/撤离演出、跳过与有限图片等待。
- `game/src/ui/departure-transition.js`：出发仍先挂遮层，再运行原事务；跳过只缩短演出，地图就绪才释放输入；撤离只在回执已提交后挂呈现。
- `game/src/ui/silent-node-film.js` 与 CSS：战斗/首脑的无字片段，沿用现有转场生命周期与战斗准备。
- `game/src/run/game.run.scenes.js`：仅战前呈现与时长接入；`game.run.altar.js` 仅结算完成画面的装饰入口。
- 运行图位于 `game/assets/scenes/departure/`，共四张；入城 NAI5 起稿后内置重绘，其余三张由内置生图沿已认可画法制作。
- 具体来源、尺寸、字节与 SHA256 见 `art-source.json` 和 `variants-source.json`；NAI 请求见 `nai-request.json`，画面提示词摘要见 `prompt-set.md`。
- `game/dev/departure-cinematic-review.html` 提供四种重播与定格，也可走完整真实整备流程；页面先将 Storage 替换为私有内存，不读取或写入玩家真实存档。

## 过时测试整理

老板要求“不用测试，顺便把测试修一下，过时的测试、没用的测试都删掉”。本轮处理直接相关且已确认退役的部分：

- `tests/departure-stack-lifecycle-review.test.js` 移除三个依赖旧推荐预览/应用/撤销按钮的用例，保留整备说明、库存身份、保存失败及防重复扣仓用例。
- `tests/departure-render-performance.test.js` 移除两条同入口的过时断言，保留容量、筛选及节点复用断言。
- 上述文件及 `tests/departure-browse-state.test.js` 补齐现有 `enterDepartureStep` 测试替身。
- `tests/departure-handoff.test.js` 保留本轮添加的等待地图、跳过、防输入穿透、减少动态及异常归还焦点守卫。

未进行全库测试审查或批量删除测试文件。

## 已有反馈与最终边界

初版在老板停止测试之前，出发/拒绝开局/契约/架构四文件 74 项通过，定向 ESLint 与单图资产检查通过；真实内存页走通选档→基地→人物→整备→出发→地图。初版扩展库存检查曾因推荐按钮退役失败，相关旧用例已按后续指示删除。初版结果不覆盖最终去字、三种新增演出及后续测试文件整理。

初版当前窗口为 1618×956。`preparation-before.png`、`cinematic-playing.png`、`map-after.png` 是原始输入链证据；`cinematic-held-frame.png` 是去字前的定格构图，不能作为最终无字画面证明。图片仅本地保留，获取方式为本聊天 Codex 内置浏览器截图，哈希见 `local-captures.json`。

`browser-console.json` 包含初始首页已有 HUD 异常及音频池警告，不能宣称浏览器零报错。未测性能、最终版本实页与完整回归；未提交、推送或发布，复用 5200，未启动或停止服务。

资源消费者复审：新增四张均为显式 `new URL` 路径，不使用退役候选、不增加不透明目录拼接，现有排除清单与其消费者指纹未改。最终增量资产门未运行。
