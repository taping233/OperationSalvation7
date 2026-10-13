# 仓库卡牌详情排版

2026-10-12，Friday / Codex，老板授权实机查看并重设计仓库放大界面。完成未提交。

## 改动

完整大卡与资料栏分离，避免共用卡面外边距挤占布局、资料栏遮挡边框。名称与品质、效果、持有与收藏操作按顺序分区；关闭键移入资料栏右上角。详情操作沿原处理器，未改变收藏或交易规则。嵌套后的关闭键/页脚取消独立正 z-index，稳定帧复核显示正常。

范围：game/src/ui/inventory-zoom.js、game/css/inventory-zoom.css、docs/development.md对应说明。原完成未提交代码保留；不改他人活跃 game.hub.pages.js、base-camp.css。

## 验证

- Codex 内置浏览器 localhost:5200，当前窗口1606×956，沿全局横屏缩放；复用PID36028，非本会话服务。
- 真实输入：进入档位01、后勤、点击治愈与充能射线；短说明/长说明、古朴/稀有完整显示，关闭按钮/Esc回原卡焦点。未执行收藏以保留存档库存。
- 关键稳定帧见 after-rare.png；早期 after-common.png 在叠层修正前保存，仅作为诊断，不作为最终操作区通过证据。
- 浏览器来源/节点/计算样式由 browser-snapshot.json 及 workflow browser import 回执记录；采集前日志error0。共享HMR曾使页面重回标题，重新进入目标采集，未覆盖多尺寸。
- JS语法、目标ESLint、PostCSS解析通过；相关48项测试47通过、1失败。
- 失败：base-ui-sample 的旧 stashUseMat 保留断言；用修改前原详情函数隔离复现同样失败，见 baseline-test.log / baseline-test-source.txt，未扩大范围修改业务断言。
- 未运行build、全量测试、性能采样；未提交。收藏写入、待复原/商店/人物卡池未实机覆盖。
