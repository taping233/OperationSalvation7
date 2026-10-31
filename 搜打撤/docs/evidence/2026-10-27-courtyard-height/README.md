# 庭院入场水面高度修复

2026-10-27，Friday；完成未提交。

原因：基地框架的 `.hub-page { overflow:auto }` 允许横向入场的区域产生临时横向滚动条。真实点击基地→庭院，从首帧采样观察到水面 clientHeight 809→827，画布高度 684→699；hub-body 高度始终 995，hub-page 873→891。变换矩阵只含横向平移。

改动：庭院页面明确 height:100%、box-sizing:border-box、overflow:hidden；外框裁切入场溢出，内部工具栏继续 overflow:auto。只改庭院样式，保留已有横向入场。

验证：当前 Codex 内置浏览器 http://localhost:5200/，当前窗口，真实点击进入档位01→基地→庭院。修复后从挂载首帧连续采样100帧，水面827、画布699、页面891始终稳定，详见 after-trace.json。真实点击投喂反馈成功且吃食增至1；关闭/开启雨及展开/收起环境设置正常，展开时水面保持827，工具区可用。控制台 error/warn 为空。诊断使用内置浏览器能力，临时采样变量已清除。

定向测试：tests/hub-courtyard-v3.test.js、tests/courtyard-lifecycle-deep-audit.test.js，2文件18项通过，无跳过。git diff --check 通过。未运行全量、build或多尺寸；未提交推送，复用5200服务且未启停。

改造候选（仅建议，未实施）：精简空景观导航及旧rain/koi视图分支；缩小侧边控制占地；将临时吃食计数改为即时反馈或明确本次游玩；发现锦鲤若保留长期目标则需存档；记住环境偏好；逐步加入与基地人物有关的庭院互动及少量可展示装饰。

截图：after.png；142281 字节；SHA256 8FCC8B6F5BF416F4BF109361631C9AA4771694DADAE8A4DC1471EA765C29D976；由当次内置浏览器截图获取。文件小于1MB，可随证据入库。
