# 随从DOM顺序验证

基线为已发布a4cd6990f2d2a58824daebd6c4a3510132e06f93；Sites v23的真实战斗打牌验收只覆盖基线。本批仅接入updateAllies的实际完整children顺序比较与新11项回归，失配仍按原路径append全部目标，未改键、节点身份或玩法。原补丁与SHA见[清单](patch-manifest.json)。

- 独立[221项邻测](ally-final-neighbor.log.txt)及lint通过；原源码[负对照](ally-baseline-control-summary.json)7项功能断言通过、4项静态节点计数按预期失败。4个随从100次真实生产updateUnits调用，append400→0、child-list记录800→0；仅jsdom操作计数，无浏览器帧时/FPS结论。一次缺桌面夹具的独立失败原日志仍保留在独立目录，最终邻测已补齐只读输入。
- [资源审阅](asset-consumer-review.json)确认资产表达式未变，仅刷新该文件一条审查SHA；既有真实消费者改动/失去批准的负控继续生效。[集成50项](targeted.log.txt)通过，保护算法和预算未改。
- [标准构建](build.log.txt)通过，1595文件、171874394字节，比a4cd增加71字节。[摘要](build-summary.json)与[逐文件清单](build-output-manifest.json)记录原固定预算；[静态闭环](runtime-asset-closure-final.json)无缺失/被裁剪引用。没有包体下降声明。

生产与入库字节冻结后，原暂存门按选择器运行quick，普通hook核验真实暂存回执；按本批风险不额外强制full，quick不代表全项目通过。最终大回执单独保存，不在门后改入库文档补写通过。当前小批尚未部署、未验实页或对应远端CI。
