# 单位元数据与同场设置纹理验证

基线为已发布82770803b2c15d67d505ed15273f9a2689cf0c72（Sites v24）。两个独立补丁逐字接入，前后SHA及原补丁SHA见[清单](applied-patches.json)；不修改读档从本场战斗起点重开的既有规则。

- 单位元数据17处setter只在实际DOM值不同时写入，空值保持原String转换，不使用跨渲染缓存。独立[12文件190项](unit-neighbor.log.txt)通过，旧源码[负控](unit-negative-control.log.txt)7项功能通过/2项计数预期失败。4敌人+玩家100次warm更新，全部DOM记录3900→1000，其中目标metadata2900→0；10次更新受守卫setter120→0。计数来自生产模块jsdom夹具，不是帧时/FPS。未改区域见[保留核对](unit-preservation-check.json)。
- 同场规则/设置面板隐藏并暂停当前角色帧层，停止ticker/轮询，返回同一就绪角色同步复画；真正离场、换场、丢弃容器或无关页面仍释放。独立[5文件87项](frame-targeted.log.txt)通过，旧实现[5项负控](frame-negative-control.log.txt)按预期失败。63纹理角色完整3次设置往返，mock load/unload各189→0；真实battle:end事件仍卸载63，余0。期间保留既有解码/GPU纹理是明确内存取舍，不代表浏览器内存减少、网络字节或画面闪烁已实机修复。
- 两源码的资产表达式经独立审查未变，只更新3处对应SHA。[守卫审阅](asset-consumer-review.json)与[41项测试](asset-guard-targeted.log.txt)证明动态消费者及独立帧选择器仍保守保留；原算法、286排除候选和预算不改。

[标准构建](build.log.txt)通过：1595文件、171876699字节，比827基线变化+2305字节；[摘要](build-summary.json)、[逐文件](build-output-manifest.json)及[静态资源闭环](runtime-asset-closure-final.json)保留。不能据此声称FPS或加载延迟收益。

源码与入库字节冻结后按正常选择器运行暂存门，再由普通hook核验精确index回执；不额外强制full。最终大回执单独保存，不在门后改文档补写通过。本批未部署/实页/远端CI核验；v24旧版证据不覆盖新补丁。独立夹具初始化和补丁头修正的早期失败日志在原独立目录保留，最终代码未靠放宽断言求绿。
