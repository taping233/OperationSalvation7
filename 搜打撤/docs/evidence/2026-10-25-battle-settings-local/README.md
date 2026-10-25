# 战斗设置改为局部窗口

2026-10-25，完成未提交。老板确认问题是5200音量旁白色设置图标触发整页黑屏刷新感。此前几轮只处理可见性、坐标与动效；本轮移除这个入口对整页切换流程的依赖。

修改 `game/src/battle/view/battle.secondary-overlay.js`、`battle.decision-shell.js`：战斗设置直接在现有ovBody添加局部dialog，开关均不调用UI.showOverlay、不广播整页模式、不替换战场、不触发角色帧画布隐藏/静态图切换。使用现有bindDialogSurface管理输入隔离、Tab、Esc和返回焦点；战斗离开、替换或窗口关闭时释放本窗口资源。打开时清理旧回合横幅，避免横幅盖住设置。其他战斗次级页沿原有通道。

## 当前窗口复核

Codex内置浏览器localhost:5200，当前默认窗口，未调整尺寸；标题开发遭遇战标注“不写入存档”。真实点击设置、返回、再次打开、Esc关闭；未修改设置值、重启战斗或写入用户存档。

- 开窗前后overlay全部DOM属性逐项一致，包括class、data-ui-enter、data-surface-phase、内联style；opacity保持1，现有战场数量保持1。
- 开窗只新增一个data-local-battle-settings局部dialog；全屏page-loading/page-visual-handoff数量0。
- unitFrames.hidden在开窗前后均为false，不再隐藏角色帧画布；旧回合横幅数量0。
- 点击返回和Esc关闭都移除局部dialog，焦点回到btnBattleOptions；实际可再次打开并关闭，无浏览器error/warn。
- 自有diff空白检查通过。未运行自动测试/build，未提交/推送，无新服务。

本窗口未复现此前整页黑屏的全部过程，因此不将旧症状根因写成已复现结论；本轮证据确认战斗设置已绕开整页切换，并核对新路径的开关与焦点恢复。未做多尺寸或敌方行动中组合回归。
