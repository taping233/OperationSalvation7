# 后台原生输入探针

- 入口：Sdt.Editor.BackgroundInputProbe.Run。仅主会话统一启动 Unity 后台执行；本子任务未启动 Unity，运行结果待补。
- SDT_UNITY_CHECK_OUTPUT 指向独立证据目录；探针自设 SDT_UNITY_TEST_DATA 为目录下随机隔离档。
- 单一1920×1080相机目标，正式EventSystem.RaycastAll首命中核对，再派发PointerEventData的down/up/click处理链。属于程序构造原生uGUI事件，不代表前台/系统真实输入。
- 路径：正式标题→选档→第五档新档基地→整备→基地→标题→已有第五档重开→整备返回→标题；末尾再次选档返回。每站核栈、活跃Panel与mask数量。
- 正式UIKit按钮：初始图标、动态文本+换行后逐个图标中心及按钮内部两点必须命中同一Button；目标Graphic接收射线、装饰Text/Image不接收；累计恰好两次事件点击。
- checks.json保留每次目标路径、坐标、前8个射线命中及实际事件接收者；result.json含通过状态、阶段、异常、数据目录。失败退出2，通过退出0。
- 当前仅完成源码静态核对；须主会话后台实跑后确认编译与运行结果。

## 追加原生问题诊断

- 完整Run现为22阶段；RunDiagnostics入口为Sdt.Editor.BackgroundInputProbe.RunDiagnostics，跳过基本菜单回归，直接运行下面三项，输出格式相同。
- 标题mAch/btnCardLib/mSettings：分别检查正式圆环、中英文label中心的RaycastAll首命中事件处理器是否为入口Button。
- 新Run隔离夹具仅留一张普通火球卡：空safe-slot中心首命中祖先须带Safe DropZone；从真实卡中心射线接收者派发down/drag，按当前射线逐祖先派发enter，再派发up，核safe实际变更且未弹DiscardConfirm。
- 单击BagCell同帧关闭背包，等待下一阶段（至少600ms）检查BagCardDetail是否重弹。若卡中心未命中BagCell，独立生命周期诊断仍派发正式BagCell处理器，并明确记录raycastReachedCard=false。
- 三类诊断失败以findings累计，尽量继续后续诊断；最终passed=false、退出2。夹具/引擎异常仍立即退出。未运行，不把源码推断记为实测结论。
