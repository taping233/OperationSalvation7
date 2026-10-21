# 启动帧就绪门控

基线为已发布候选 eaa27f33c4ca3781118e7289707da3b22927ff2a（tree d1b4d54f654514e1409808e3581e827a2b95f1c0）。前批 Sites v21 已部署，并独立复验恢复测试档05、背包、单张卡图及词条路径；未推进战斗，也无FPS/CPU测量。这些结果不覆盖本次启动修复。

本批仅接入既有两文件补丁：主循环在DOM/UI及异步初始化完成前不排帧，保留dirty状态，就绪后显式请求首帧。可见性恢复、空闲巡检和正常绘制保留，不改变玩法、随机夹具或性能预算。该竞争相关原码在e817与d682相同；首次线上具体唤醒事件未捕获。

原d682的两个早期唤醒负对照均报undefined.hidden；独立修复的5项新回归和18邻测通过。见[原负控](negative-d682.log.txt)、[原邻测](independent-neighbors.log.txt)和[原补丁指纹](independent-receipt.json)。当前eaa整合后使用标准邻测、构建及正式冻结门另核验；最终index回执独立生成，skip不算通过。

本启动修复尚未部署、未做当前内置浏览器实页验收，不能称线上错误已经修复。

当前eaa整合后的[标准23邻测](targeted.log.txt)全部通过。标准[构建](build.log.txt)含prebuild/postbuild退出0：172525273字节，entry gzip 368127/368640、initial 417829/419840、CSS 228775/235520，预算均未变且通过；[产物清单](build-output-manifest.json)。最终full与正常hook以随后冻结收据为准。
