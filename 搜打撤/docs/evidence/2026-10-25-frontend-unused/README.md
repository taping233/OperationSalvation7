# 前端无用代码清理

老板要求清理无用前端代码，并沿用不测试、直接实施。本批删除9份CSS内23段无现行引用的keyframes，以及scenes.css中被后定义覆盖的早期chestGlowPulse，共24段、53行、2639字节（仅统计keyframes，未含同步删去的过时注释）。精确清单见cleanup.json。

另从game.menu.pages.js的选档装配移除已不消费的pickLatestSlot参数；指南/成就所需的同名参数保留。entrySupplyIntroHTML、rewardCardStatus、collectCardTips仍有预览或测试引用，保留。没有删除文件。

本批收尾同时将上一轮首页退场样式限定在非减少动态偏好下，保留减少动态设置。此前已完成的首页普通入口180ms退场衔接沿 `../2026-10-25-home-button-departure/README.md`。

仅做源代码定位及引用核对，未测试、lint、实页验收或build，不宣称运行验证通过。保留Kimi活跃属地和其他已有增量；完成未提交、编辑释放，无新服务或提交推送。
