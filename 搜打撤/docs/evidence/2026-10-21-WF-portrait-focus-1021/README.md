# 静态立绘首帧交接与恢复子段诊断

基于正式 v35 game d10ecb45 / tree d4533977，保留 viewport 修复。attach 等待释放、renderer、纹理与 portrait fill 期间保留静态兜底；当前 owner 的同步 render 成功返回后一次性交接，再清除 presentation。同步返回不等于 GPU 已呈现；失败后的手动 tick 测试不证明自动恢复。未增加 Discover 纹理保留或删除获卡动画，实际 load/reload/unload 调用桩均63/63/63，无新增加载收益。

show/focus 两个固定子段在原 restore/outer 内嵌套，四段原定义不变，revision6；完整开启诊断恢复多6次时钟读取，未测开销，不声称零开销、独占 CPU 或性能收益。详细约束见 runtime-trace.md。

合并定向11文件201项通过；标准构建通过，812+1输入与1595产物核对，原预算未改。22资源表达式及6资源调用精确不变，仅更新资源审查现有两处 frames 指纹。原基线负控、owner/dirty/repeated-write 负控及存活的旧 MutationObserver 负控保留在独立作者证据中。

正常冻结 FULL、普通 hook、发布和正式浏览器待外部回执，不预报通过。正式浏览器须核对新 SHA，验证冷入场静态→GPU、Discover 获卡返回连续性及 Settings/Rules/离场；旧23秒截图间隔不是空白时长。主旧产物、用户master、旧候选未覆盖；MV及音效模型仍暂停。
