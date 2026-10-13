# 照相馆入口闪白移除

2026-10-11，Friday / Codex。老板明确令删掉入口残留的相机快门闪白。

仅移除 `home-polish.css` 中照相馆入口的白色闪光规则及 `hpShutter` 关键帧，保留原有背景收束和成就同款切幕。运行源码 `hpShutter` 零引用，相关 diff 检查通过；纯 CSS 小改未新增或运行 Vitest。

Codex 内置浏览器当前1523×956，真实点击主页照相馆按钮，95帧采样中闪光层透明度始终为0，动画名始终为none；切幕仍出现，最终加载层清理，照相馆正常显示，console error为空。原始摘要见 [shutter-browser.json](shutter-browser.json)，准备画面见 [shutter-opening.png](shutter-opening.png)。临时观察变量已移除。

完成未提交、编辑释放；复用5200，无自建服务、不build、不提交。
