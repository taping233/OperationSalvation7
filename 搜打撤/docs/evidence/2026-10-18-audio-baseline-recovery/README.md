# 音频历史对照输入恢复

恢复测试引用但重建交接缺失的三个before catalog，来源为固定cd98745f官方GitHub原件。写入前核对Git blob，写入后核对SHA256；完整路径、大小、哈希与源链接见source-verification.json。没有从现行实现推造历史期望，没有修改测试、生产代码、package或资源守卫。未运行测试，待父任务与工具代理合并验证。

同轮只读审查hub.personnel：本批HEAD到工作区仅列表交互模块化；旧opaque指纹还覆盖更早的立绘入口简化（专用默认图改既有Art.skinUrl），该历史差分已向父任务披露，由父任务决定更新守卫。

## 人物页opaque完整来源复核结论

可安全将hub.personnel.js的opaque指纹更新为`f363ac2ad34b21fe99a1b650642deb2537e397c918175f58d5325ad4366bbe72`。核对的是旧守卫11b042对应实际旧文件到当前文件的完整差分，不只本轮HEAD增量。

历史变化确实包含资源选择简化：删除无默认专用cutout URL与裁切，改为`art.skinUrl(stats.cls, skin)`。当前人物来自`meta.classSummary()`后经`characterFor`过滤，选择只取该roster；skin来自预览或owned.selectedSkinId。即便skin未知，`Art.skinUrl`也只按静态`SKIN_FULL_ART`命中或回落`FIGURE_FULL_ART`，不会把传入skin拼成任意路径。无效角色返回空串。`art.js:232–249、324–329`把全部输出限制为5个默认立绘加4个皮肤文件；9个文件均存在且与195项排除候选交集为空。已移除默认特例亦不在排除候选中。`art.js`当前SHA与已审opaque指纹逐字相同。新列表模块只写DOM筛选/选中状态，没有资产URL构造。

逐项静态证据见`personnel-resource-review.json`。因此历史入口变化没有重新引入任何被排除资产，可以更新当前指纹；没有修改候选集合、守卫脚本或跳过测试。此检查是源码与路径集合核对，不宣称视觉实页通过。
