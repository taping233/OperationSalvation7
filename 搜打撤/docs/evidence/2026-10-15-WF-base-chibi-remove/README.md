# 撤下基地旧小人动画

老板要求删除上回接入的动画。移除 `game/src/hub/hub.home-v3.js` 的旧小人导入/页面注入，以及 `game/src/hub/game.hub.runtime.js` 的挂载和释放代码；两文件核对与HEAD一致。白底v2试作页面、素材和制作记录保留，无物理文件删除。

`hub-flow-regression`、`contracts`、`architecture-boundaries`三套52项通过。Codex当前窗口内置浏览器复用5200，标题静音后真实进入档位01；基地小人节点数0、出征整备按钮可见，error列表为空。截图 `base-without-chibi.jpg`。只验证本次动画移除场景，无build/提交/新服务。
