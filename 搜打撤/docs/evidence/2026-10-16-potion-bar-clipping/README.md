# 战斗道具栏左缘裁切

结论：旧居中布局的 `translateX(-50%)` 留在了新左锚布局上。已在 `battle-stage.css` 的道具条和说明框正本规则各补一处 `transform:none`，没有改动战斗逻辑、通用 `battle.css`、既有注能或职业工具栏规则。

## 现场与证据边界

- 现场截图：[62-battle-tools-single-after-discover.png](../2026-10-16-WF-cloud-play-eight-hours/screenshots/62-battle-tools-single-after-discover.png)，1188×761 窗口、1920×1080 逻辑布局；道具胶囊左侧被裁，恢复药水仍可见
- 原截图 SHA256：`7e114ffbaaf46686bc681de514da0a27de2b9b1493bf086f9636a0c41e6c42c2`
- 发现返回是本次观察到问题的流程位置；本审查没有把它定性为独有触发条件，也未证明初入战与返回时存在何种临时样式差异
- 本任务只读过现场截图，没有操作浏览器、服务或存档；未做全量构建、提交、推送
- 本轮测试证明静态样式级联与相关交互契约；实际几何及视觉修复仍由父会话在下一次真实获得药水后复验，不能据此称实机已通过

## 定位

1. `game/css/battle.css:104` 的 `.bt-potions` 为 `left:50%;transform:translateX(-50%)`
2. `game/css/battle-stage.css:174` 已改成 `left:62px`，此前没有重置 `transform`
3. 变换按道具栏自身宽度执行，最终逻辑左缘为 `62 - width/2`；宽度超过124逻辑px即可越过舞台左缘。截图的横向比例为1188/1920=0.61875，该机制与所见裁切方向及量级一致，但不是实测DOM几何
4. 同类遗漏也在说明框：`battle.css:131` 为 `left:50%;transform:translateX(-50%)`，而 `battle-stage.css:178` 已改为 `left:0`，说明框稳定显示时仍会向左偏移自身宽度的一半
5. `game/index.html` 先加载通用战斗样式，再加载正本 `battle-stage.css`；运行时末尾还装载 `motion-transitions.css`。说明框隐藏态的 `#overlay .bt-potion-tip[hidden]` 特异性低于舞台正本 reset，不会重新引入横向偏移；显示时原有入场动画仍由既有声明负责

## 改动与专测

- 源码仅两处 `transform:none`，见 [source-reset-delta.patch](source-reset-delta.patch)
- 新专测：`tests/battle-potion-bar-layout.test.js`
- 专测按 `index.html` 的全部实际样式链接顺序解析CSS，递归解析其 `@import`，并解析运行时 motion 样式表；匹配真实层级的道具栏和说明框，再以 important、特异性、源顺序决定稳态相关属性的胜者，不模拟动画时间轴或浏览器布局
- 覆盖道具栏正本覆盖旧居中变换、说明框左锚、隐藏说明框与末尾运行时规则的特异性、移除两处reset后旧问题必重现
- CSS嵌套先展开父选择器，避免把其他页面的 `&` 当成全局规则；若未来出现会匹配目标属性的条件规则或复杂特异性选择器，测试显式报错，不默默跳过

## 验证

- 修前专测：3失败、1通过，失败点正是旧 `translateX(-50%)` 或隐藏态 `translateY(4px)` 仍为级联胜者，见 [test-before.txt](test-before.txt)
- 修后定向：3文件26用例通过，见 [test-after.txt](test-after.txt)
  - `battle-potion-bar-layout.test.js`：4用例
  - `battle-infusion-action-layout.test.js`：12用例
  - `battle-tools-lifecycle.test.js`：10用例
- 新专测ESLint通过，见 [lint.txt](lint.txt)
- 现行文档守卫通过，见 [docs-check.json](docs-check.json)；该命令按自身边界跳过evidence，本报告相对链接另核文件存在
- 未运行完整质量门或build；共享工作树其他任务改动保持原样

## 实机复验清单（待父会话）

- 真实获得并持有药水后，读取 `.bt-potions` 的 computed transform、offsetWidth、边界矩形，应为无变换且舞台内左锚62逻辑px
- 初入战、发现返回、后续普通重渲染都保持完整道具胶囊；职业工具栏仍只有一组
- 真实悬停/按下药水后，说明框显示且左缘贴道具栏，无半宽左移
- 进入注能选择时道具栏整栏隐藏，取消后恢复；恢复药水仍可正常使用

源码编辑权已释放；实机未核项保留，不将本轮静态通过写成整场战斗或视觉全通过。
