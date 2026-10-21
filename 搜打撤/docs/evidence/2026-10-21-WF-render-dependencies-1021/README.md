# 手牌判定复用与退役依赖集中验证

基线为候选0bf320704f01985314ef9c7661cd8479a5bd8090，已部署Sites v22并做有限启动/重载/标签往返/测试档05恢复复验；未可靠覆盖hidden分支，无FPS测量。本批仅整合两个独立冻结补丁，逐文件SHA见[接入清单](applied-patches.json)。

- 手牌规则原始投影仅在一次同步render的状态提示和牌组判定间复用；下一轮重建，输入与提交仍取实时状态。独立9张手牌/18次判定中lookup162→9、map/filter18→1；[操作计数](hand-measured-counts.json)与[2728次返回值比较零差异](hand-equivalence.json)均不是FPS/帧时测量。独立203项不同测试覆盖及负对照恢复结果见[首轮](hand-targeted.log.txt)、[恢复复测](hand-restored.log.txt)、[负控摘要](hand-negative-control.json)。
- 退役家具控制器不再由正常基地创建，错误文案移至无家具依赖模块；兼容入口no-op，不导航、不取消正常加载、不写档。原模块、旧存档/收据/未知字段保留，未包含先前取消的Home DOM优化。[定向270项](retired-targeted.log.txt)及[最终35项](retired-final-adjustments.log.txt)通过；[依赖图](retired-dependency-summary.json)不包含npm/CSS/资产，不能当作最终构建收益。独立稀疏副本曾漏扫symlink/缺两个桌面夹具引用，原失败日志在独立目录保留；换完整普通文件图后验证通过。

生产源码先冻结。首轮标准构建虽过预算，但手牌补丁改变全文件审查指纹而触发保守回退，重新带入旧图，因此不接受该构建为交付结果。独立复核确认587个资源字符串/模板与资产选择器未变，仅更新一个审查SHA；[审阅及负控](asset-consumer-review.json)与[39项守卫测试](asset-guard-targeted.log.txt)保留，未放宽算法或预算。

[最终标准构建](build-final.log.txt)通过：1595文件、171,874,323字节，比0bf构建少650,950字节；入口gzip368,128、初始JS417,830、CSS226,802字节。入口和初始JS分别增加1字节，未声称首屏下载提速。固定预算及比较见[摘要](build-summary.json)，逐文件见[输出清单](build-output-manifest.json)。[静态资源闭环](runtime-asset-closure-final.json)无缺失/被裁剪引用，286个排除仍生效；它不是浏览器网络验证。随后以同一冻结源码/index执行集中full及普通hook。最终冻结门大回执单独保存，不增改已冻结源码以追写通过声明。本批尚未部署、未做当前内置浏览器实页验收或新提交CI，代码/构建结果不代替这些覆盖。
