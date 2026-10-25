# 2026-10-25 无预置存档便携 EXE

已交付 `desktop-app/dist/代号柒-v0.60.0-便携无存档-20261025.exe`，256192698 字节，Windows x64 单文件免安装。SHA256：`C5ECAED24545059CFE471ADDB2957F2D5511E6B6A67080AA2A1E8A2E8D06CC2A`；获取本机上述文件后按SHA256校验，二进制不进Git。详见 [交付回执](delivery.json)。

包内无玩家存档、留言或浏览器资料；使用独立目录 `%APPDATA%/codename7-clean-20261025-5558e960c4204960`，交付校验后仍不存在，首次打开为空档，游玩后可正常保存。旧版数据保留。便携指免安装，后续存档仍写入系统用户目录。

隔离副本位于根 `.tmp/portable-clean-1025/project/`。运行时来源为 `17317a7b82b04cc6c030343159017dae39c669e9`；游戏、脚本与桌面外壳无工作树差分。其他聊天正在维护tests、vite.config.js和质量门说明，因此副本使用HEAD版vite配置，保留全部在途改动。输入3248项，清单与来源摘要见 [snapshot.json](snapshot.json)；完整清单留在根 `.tmp/portable-clean-1025/inputs.json`，SHA见摘要。仅副本增加独立资料配置和产物名称，不修改共享外壳。

生产构建（剧情编译、数据校验、Vite、预算）通过，资源171.32 MiB、入口gzip404.2 KiB、首屏JS gzip453.7 KiB、战斗73.0 KiB、CSS201.4 KiB；未修改预算。复用已有Electron44.1.0、electron-builder26.15.3及本机缓存，无安装。构建日志留在根 `.tmp/portable-clean-1025/vite-build-final.log`、`builder-final.log`。

[生产资源检查](production-summary.json)通过：1736产物、468引用、4别名均无缺失，全部文件GET/HEAD与12项Range检查通过。[封装检查](asar.json)通过：1734项游戏资源字节一致，两个空占位文件由打包器省略，10项外壳/配置与副本一致，无用户数据混入。[便携启动器检查](portable-verification.json)通过：实际EXE两次Node模式独立解包，后启动退出后前实例全部资源保持完整，均正常退出。复制到交付路径后SHA256一致。

本轮未做原生游戏窗口、整局实玩或音频验收；沿用同一运行时的 [此前完整门与内置实页证据](../2026-10-25-full-submit/README.md)，不将Node模式检查当作游戏实玩。未创建服务，无需停止其他聊天进程。

老板授权推送后，本地此前9个完成提交已推送origin/master，回读为 `17317a7b82b04cc6c030343159017dae39c669e9`；[远端构建检查](https://github.com/taping233/OperationSalvation7/actions/runs/40209202933)已通过，[完整CI](https://github.com/taping233/OperationSalvation7/actions/runs/40209202840)状态以远端为准。EXE在本机交付目录，不作为Git对象上传。