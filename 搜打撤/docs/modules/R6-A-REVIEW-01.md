# R6-a 根审第一次：返工

2026-09-21。正常文本/状态模块存在，真实M01测试已补，但不能据此验收UI接线。

## 已在首版交付前纠正

- 只有缺失故事键才视为未开始；显式空值/坏结构保留并拒绝。
- 事件实例绑定runId和节点，不接受任意字符串。
- Ink加载及构造/寻径/正文解析失败回退普通事件，结尾解析失败使用固定已选结果文字。
- Base提交失败页内显示重试，选择/结果页补背包返回钩子。
- 真正M01存储三局/两结局/同请求重放/异选择冲突，不能只用伪造receipt作通过依据。

## 首版仍未通过的真实缺陷

`tests/r6-story-flow.repro.test.js` 导入真实runEventDeck、执行UI.act动作并使用真实Base/M01/RunStorage，复现：

1. 旧run-old的结果页打开后，切到slot2/run-new/节点3,8，调用旧lastLampFinish实际consume一次。结果页没有绑定原slot/run/节点，选择提交前后的身份检查不足以保护后续结果动作。
2. 等待lastLampNarrative时从slot1/run-wait/0,1切到slot2/run-after-wait/2,7，Promise返回后仍注册旧lastLampChoice。异步正文返回没有验证页面归属。

同夹具Ink返回null的普通事件回退通过；未写故事，仅原事件正常消费。以上两个红灯已真实执行，不是只凭源码猜测。

## 修订包与停止点

根IAB暂停在localhost隔离QA01新局入口，35HP，初始攻击5张与两张自然选角职业卡，未推进故事；原localhost QA05路线局保留。

授权同Sol唯一runtime修复：结果页/finish/背包返回与叙事await都绑定原slot、稳定runId、eventInstance和坐标。旧回调不消费、不保存、不覆盖新页面。补真实Base写失败、Base成功run写失败可重试、换异节点仍同局限一段、Ink异常fallback测试。修完冻结runtime再恢复根IAB。

不扩展全局并发框架、不改经济，不开始R7。程序通过与最终文字审美继续单列。
