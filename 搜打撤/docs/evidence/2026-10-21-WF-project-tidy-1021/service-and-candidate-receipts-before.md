# 整理前服务和候选登记原文

会话编号均为创建/交付来源，不是Git提交。以下旧PID只保留原登记时点。

| 会话/来源 | 属地（文件/端口/工作树） | 事项 | 登记时间 | 状态 |
|---|---|---|---|---|
| Friday / 公共控件预览保留 WF-public-controls-1021 | `.tmp/public-controls-1021/review/game`：5348/PID35120；旧preview/game：5347/PID18792，工作目录均为`D:/素材/代号柒/搜打撤`，本父会话创建，身份见自有service.json与review-service.json | 源码已释放；老板当前预览保留，旧预览不再同步或重载；未停止或认领其他服务 | 2026-10-21 | 已交付；服务保留供当前试玩 |
| Friday / 尖塔施放预览 WF-sts2-cast-ui-1021 | 隔离预览 `.tmp/sts2-cast-ui-1021/preview/game`，5346；启动身份见 `docs/evidence/2026-10-21-WF-sts2-cast-ui-1021/service.json`，同步清单见 `final-sync.json` 及 `followup-sync.json` | 实现及发现底栏、宝箱视觉、统一字号和切栏追加编辑已释放，预览保留供老板当前界面查看；沿用“不用验证，你做完就行”，未继续测试/检查/浏览器验收，无build/提交/推送 | 2026-10-21 | 已交付预览，保留本会话服务 |
| Friday / 主线启动 01a159f7 | Vite `D:/素材/代号柒/搜打撤`、5200、PID13008；本会话 `npm run web -- --skip-compile` 创建；`node_modules/.cache/web-up-5200.json` | 老板授权拉起主线；后台隐藏启动，入口及资源响应通过，沿用现有剧情产物；服务保留供试玩 | 2026-10-20 | 已交付 |
| Friday / 星月壁纸预览 01a15531 | Vite `D:/素材/代号柒/搜打撤`、5200、PID492，本会话`npm run web -- --skip-compile`创建，已核对node/Vite命令 | 源码编辑已释放；服务保留供老板查看新增第三张壁纸 | 2026-10-20 | 已交付 |
| Friday / 网页启动 01a15472 | Vite `D:/素材/代号柒/搜打撤`，5200，PID18456；`node_modules/.cache/web-up-5200.json` | 老板授权拉起网页版；后台隐藏启动，沿用剧情产物，入口及PNG/WebP响应有效，服务保留供试玩 | 2026-10-19 | 已交付 |
| Friday / 网页启动 WF-web-up-1019 | Vite `D:/素材/代号柒/搜打撤`，5200，PID26772；`node_modules/.cache/web-up-5200.json` | 老板授权拉起网页版；2026-10-19 18:45后台隐藏启动，入口与PNG/WebP响应有效；沿用现有剧情产物，服务保留供试玩 | 2026-10-19 | 已交付 |
| Friday / 隔离预览5319 WF-perf-budgets-1018 | 纯副本`.tmp/perf-budgets-1018/project`，启动工作目录`D:/素材/代号柒/搜打撤`，Vite5319/PID25100/exec70568 | 源码占用已释放；老板要求停止实玩后已停止浏览器操作，当前窗口仍引用5319，页面与服务现场保留。PID为本会话启动核验时点，未认领其他服务 | 2026-10-18 | 已交付 |
| Friday / 网页服务 01a14d8f | Vite D:/素材/代号柒/搜打撤、5200、PID48716、本会话创建；node_modules/.cache/web-up-5200.json | 按老板拉起网页版授权恢复，保留供试玩；桌面启动动画编辑已释放，见近期已释放 | 2026-10-18 | 已交付 |
| Friday / 星月芦苇原图画风重绘 01a15548 | 自有`docs/evidence/2026-10-20-xingyue-reeds-nai5/redraw-*`、根`.tmp/nai/xingyue-reeds-nai5-20261020/redraw.png` | 原图画风重绘，月饰移至观众右侧、修双手，单张内置候选 | 2026-10-20 | 待验收 |
| Friday / 无整套皮肤重置 01a14e7e | 无三皮肤`wu-casual-v14.webp`、`wu-spring-v15.webp`、`wu-beach.webp`，清单仅对应三条，自有`docs/evidence/2026-10-18-wu-skins-reset/`、根`.tmp/nai/wu-skins-reset-1018/` | NAI底稿+内置重绘，现行默认画风；保留三主题和默认立绘，素材备份后接入，不改其他属地 | 2026-10-18 | 待验收 |
