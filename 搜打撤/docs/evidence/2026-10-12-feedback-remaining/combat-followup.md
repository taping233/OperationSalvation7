# 战斗与搜刮留言补修

2026-10-12，子代理 combat 在共享工作区保留既有改动后定向补修；未启动服务、构建或提交。主代理统一执行当前窗口静音内置浏览器验收。

- 技能次数在实际扣费时登记；前摇中能量不足、目标失效或取消不占每回合一次次数。无目标技能在执行前重新核对能量。
- 治疗反馈保留传入的 `stk sticker-heal` 类名，继续使用贴纸尺寸和动画。原实现 `feedbackClass(warm)` 只返回 `heal`，丢掉贴纸类。
- 图标丢失根因：三张既有手写 SVG 的 XML 注释均含 CSS 变量名的双连字符（例如 `--fx-hit`），XML 禁止注释内部出现 `--`。三文件只删除注释中变量名前的双连字符；几何、颜色及尺寸完全不变，未新增外部素材。
- 搜刮 `reward-v14` 卡面清除 `14.93em` 最小高度，统一为当前共用卡面 `272/406` 比例；保留原卡宽、卡框与既有奖励布局。
- 复核主代理的自由拖牌直接跟随与停靠弹簧实现：自由拖动不再采用弹簧；真实指针跟手体验由主代理实机核验。

## 验证

`npm run test:target -- tests/bag-slam-button.test.js tests/battle-feedback-stickers.test.js tests/combat-feedback.test.js tests/battle-feedback-view.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`

6 个文件、53 项通过（22:03 补验）。覆盖前摇中能量不足取消、取消点选、无效目标、同回合禁止重复、次回合复位、新战斗复位、职业技能，以及贴纸 DOM 创建、资产路径、真实 SVG XML 解析与架构契约。新增 XML 断言在修前报告 `malformed comment`，修后通过。

定向 ESLint：`battle.bag.js`、`battle.feedback.js` 及本轮三个测试文件通过。自有目标 `git diff --check` 通过；共享文件统计包含先前改动，未据此声明全部归属。

## 实机待核范围

主代理内置实机首战确认击杀 `boom` 已进入 overlay，但始终未加载（naturalWidth 0）。定向 HTTP 查询 `http://localhost:5200/assets/battle/fx-sticker-boom.svg?v=0.60.0` 返回 200、`image/svg+xml`、原 SVG；原生 XML 解析明确报注释含双连字符，排除文件不存在/MIME错误。修后三个资产在同一服务均返回 200、正确 MIME，原生 XML 解析成功。不能以 HTTP/XML 验证代替最终浏览器图片解码及遮挡验收。

jsdom 确认我方受击 `hurt`、治疗 `heal`、敌人击杀 `boom` 贴纸都进入 overlay。敌人普通受伤的现行链生成数字，击杀生成 `boom` 贴纸。

## 资产精确观察值

以下按清单规则归一为 LF 后计算（修注释后的既有资产）：

| 相对 game/assets 路径 | bytes | SHA256 |
| --- | ---: | --- |
| battle/fx-sticker-boom.svg | 622 | eca66c857d088328ab69985fd060bd7efb925e54a60585ad60dabdcd76b6bcd0 |
| battle/fx-sticker-hurt.svg | 658 | 95bbd27bc13f4ce352c711bd46c12f556578576f36c149a5acd42f8abaf6c082 |
| battle/fx-sticker-heal.svg | 517 | 6d4e97b16b47846f3adfe56ef5b6243507903955053a5c245dd37e22599334b3 |

本轮未核验真实拖牌、能量与刺击按钮外观、浏览器贴纸可见性、搜刮卡框比例。主代理汇总实机证据后决定是否保留 `feedback-oct12.css` 的图标层级兜底。
