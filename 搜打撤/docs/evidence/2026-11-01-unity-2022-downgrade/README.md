# Unity 2022.3 降级验收

工程、实际编辑器和默认桌面包已切换到 `2022.3.62f3c1`。2690领域、8个实际Vite对照场景、1629原生及转场/结算/四层旅程通过；正常2560×1440播放器完成102图、271条记录，实际审查23张，GUID `4d33ec981819461295052942d67afeee`。数字与边界见[最终汇总](final-summary.json)，GitHub交付由[发布收据](publication/README.md)单独记录。

老板于2026-11-01明确授权工程和软件降级。源码、设置、依赖及导入元数据按[初始清单](source-baseline.json)和[资源清单](asset-import-baseline.json)逐字备份到 `D:/Unity/project-backups/20261101-soudache-before-2022`。旧Library、桌面包和Unity6安装保留；本工程及正式工具使用2022。第七轮改动在本批统一验收，持续对照目标仍暂停，本轮未继续扩展功能。

## 适配与修正

- UGUI2.6.0改目标内建1.0.0，移除目标不存在的accessibility/physicscore2d/tetgen/timelinefoundation，目标编辑器重解依赖锁；七个Newtonsoft领域引用改目标UPM目录3.2.2。
- 三个自定义布局共八处调用移除新版max参数，保留min/preferred/flexible/axis；三诊断文件六处GetEntityId改GetInstanceID。目标已有的对象查找/标准库接口保留。
- 后台与类型检查工具按工程版本推导实际系统安装目录，缺失报错，不回退Unity6。
- 第七轮检查的命名空间/私有收尾/卡牌夹具、基地首次打开及UI就绪前置修正。生产缺陷是保留发现页确认按钮初始禁用时漏绑动作，现先绑定再禁用，保留归属和350ms守卫。日志排除了曾怀疑的队列死锁，未改队列生产逻辑。

## 软件与证据

[安装器记录](software-install.json)保留官方包SHA、签名和退出0；安装器实际使用系统默认目录，原包装脚本因预期D盘路径退出2，已由[实际位置核验](software-location.json)纠正。版本为2022.3.62f3c1_1623fc0bbb97，目录 `C:/Program Files/Unity 2022.3.62f3c1/Editor`。桌面“代号柒 Unity 2022”可直接打开工程，[入口记录](editor-launcher.json)保留参数。现有国际版CLI不接受c1后缀，未伪造版本或跳过签名。

[领域](domain-validation.json)、[原生](native-validation.json)、[稳定构建](build-desktop-2/process.json)、[播放器](player-1/process.json)及[画面审查](visual-summary.json)分别记录。第一次构建成功但自动迁移关闭中的云服务字段，输入一致性未放行；[迁移说明](build-settings-migration.json)确认服务仍关闭，稳定第二次构建通过。原生复用仅允许此设置差异，最终构建/播放器使用新设置。

2053份meta均保留GUID，1492份变化属导入器规范化，见[导入审查](import-review.json)。原HEAD、暂存条目及25项保护路径/mtime保持，见[工作区保护](workspace-protection.json)。程序构造输入、离屏诊断和真实独立窗口分开记录；无OS硬件输入、多尺寸、整帧性能或全库零差异声明。

选中效果实际为金色矩形底衬。[独审一](visual-hub-independent.md)和[独审二](visual-battle-independent.md)记录成功重试后短暂保留旧失败通知、仓库统计对比偏低两项非阻断观察。白色敌人矩形属于无材质受控夹具，不作为自然敌人素材验收。[原始证据](artifacts.json)与[构建产物指纹](build-products.json)记录未上传内容；安装包/缓存/EXE/音频/字体及大于1MB文件不进Git。
