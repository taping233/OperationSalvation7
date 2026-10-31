# current-visual-6 基地审图修片

本片修复 photo agent 独立审图记录的五组问题及同因仓库网格边界。生产已冻结供另一审查者复验；私有编译通过不能证明实际效果一致。

依据为 `../current-effect-review/review6-base-photoagent.json` 中的新截图与当前模块/CSS。`freeze.json` 记录当前源 SHA、七个生产文件 SHA、复用箭头资源 SHA、稳定控件名和待原生检查条件。未新增位图或重复导入资产；新增 shader 直接翻译默认人物图的灰舞台正片叠底。

`check_compile.py` 只把 Hub partial family 与 Courtyard 放入本目录私有输出，引用已导入程序集；不启动 Unity、不修改共享编译产物。最终结果 0 警告、0 错误。初次编译发现当前 uGUI 的布局输入 API 增加最大值参数，已按本地包接口修正后通过。

未重做基地首页或整备空态。画面、shader 导入、鼠标键盘与持续交互需主会的新原生截图和真实输入证据。存档与标题成就生产尚未开始，继续沿独占属地实施。
