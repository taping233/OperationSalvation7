# 5200掉线恢复

- 日期：2026-10-04；任务：WF-web-restore-2255；HEAD：425d03920e。
- 老板反馈：5200怎么挂了。排查时5200无监听，旧登记PID15108已不存在；旧日志末次活动22:50:56，无退出原因。进程退出机制未确定，不将旧CSS请求报错认定为进程退出原因。
- 恢复命令：`npm run web -- --port 5200 --skip-compile`；cwd：`D:\素材\代号柒\搜打撤`。
- 本聊天新建后台服务PID35628，实际命令为本目录Vite、127.0.0.1:5200、strictPort；独立后台、隐藏窗口，留老板使用。
- 启动自检：项目HTML、PNG图标、WebP立绘均有效；随后独立核验监听PID35628，HTTP `/`、`/src/main.js`、`/css/page-hub.css?direct`、`/css/page-deploy.css?direct`均200。
- 日志与启动元数据：`node_modules/.cache/web-up-5200.log`、`node_modules/.cache/web-up-5200.json`（本地运行文件）。
- 未核：内置浏览器实际画面、游戏交互、退出原因；无源码修改、未编译叙事、未跑测试、未build、未提交。
