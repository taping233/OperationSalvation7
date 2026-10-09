# 留言箱全部导出

老板要求留言箱可一次性全部导出。顶部新增「全部导出」，待处理和已完成留言一起下载为一个 JSON；单条导出保留。读取中、空库、损坏存储时禁用；导出失败可重试。

格式：`formatVersion: 1`、`exportedAt`、`total`、`records`；每条复用既有字段白名单并加 `done`，包含旧留言、版本、位置、正文、步骤、期望和实际，保留原存储顺序与重复时间记录。导出不修改或删除留言。保存提示与空态说明已同步。

验证：workflow verify（r7b-feedback / suggestions-store）2文件20项通过；两份源码 node --check 与3文件定向ESLint通过。覆盖混合完成状态、旧留言/重复ts、白名单、一次下载、空/坏库保护、失败重试和Blob URL回收；既有单条导出测试仍通过。

Codex内置浏览器 http://127.0.0.1:5200/，当前881×590窗口，真实标题入口及全部导出点击后显示「已导出13条」。临时CDP包装URL.createObjectURL保留原调用，观察第二次按钮点击实际生成1个Blob，total/records均13，localStorage原串不变；包装已恢复。浏览器console error 0。all-export.json是该实际Blob正文，export-check.json保存核对范围，inbox-exported.jpg为当前窗口截图，browser-input.json已经workflow browser import纳管。

未核：内置浏览器download事件15秒超时，无法确认其原生下载文件的磁盘落点；真实Blob正文已经核对。未测其他窗口尺寸、桌面EXE实页、全量或构建。本轮只改Vite源码，未提交/推送/发布。5200原无监听，本会话创建PID25504，身份确认后已停，端口无监听，临时浏览器页已关闭。
