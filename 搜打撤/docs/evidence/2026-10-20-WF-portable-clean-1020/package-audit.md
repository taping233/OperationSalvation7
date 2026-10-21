# 便携无存档包：产物完整性审核

结论：PASS。生产资源、封装壳及实际 EXE 解包字节完成核对；未修改主线源码，未启动桌面游戏 GUI、其他浏览器或 headless，未读取或清理用户存档。

- EXE SHA256：`0f1c6e07ef87d0b81ec1075deb329c9fecace9a6798a69432e806f6f319e6133`。
- 生产目录：1678 文件、229,973,088 字节；21 个 JS 模块，497 个静态资源/模块引用，19 个与冻结源字节相等的别名，缺失引用/非法别名/持久数据文件均为 0。
- 图片：1380 项全部可解码；1313 个栅格帧、67 个 SVG 经 Cairo 实际渲染；失败 0。SVG资源读取限定生产本地目录。
- 快照文件协议：全部 1678 文件 GET 字节 SHA256 与文件原件相同，HEAD 长度与空响应体符合预期；音频、字体和 WebP 共 12 个 Range 用例通过，协议错误 0。
- delivery 目录共 1753 文件，未发现存档、Local Storage、IndexedDB 或用户留言文件。asar 共 11 项，其中 10 项壳/图标/profile 文件逐字节与快照相同，package.json 的 name/version/main 相同（builder会处理包元数据）。
- 实际 EXE 解包后全部 1676 个游戏文件、229,973,086 字节逐文件 SHA256 与生产目录匹配；实际原始 app.asar 157150 字节，SHA256 `41598ec1b089b9ec2ebcd5329c9cc5f09fc5575d3b5fcabe2c10190d884d5520`，与 win-unpacked 的审核对象相同。
- 发布 profile 为 `codename7-clean-20261020-f043d15e57b3487c`，检查前后对应 APPDATA 目录均不存在。Node 探针不运行应用 main/preload，不创建用户 profile。

## 两文件差异

构建器省略 `assets/cards/.gitkeep`、`assets/portraits/enemies/.gitkeep` 两个目录占位文件。两者各只有一个 LF 字节，SHA256 均为 `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`。例外严格锁定这两个路径、字节数和 SHA；所有其他交付资源均要求存在且 SHA 一致，静态引用审核未引用这两项。

## 探针过程与证据边界

第一次探针未输出结果，stdout/stderr 为空，工具未保存 launcher 退出码，不能确诊首次原因，也未计为通过。第二次经主代理授权沿用 stock verifier 启动参数与临时目录协议，加入同步阶段日志；全部1676资源 SHA 已完成，最后使用 Electron 的 node:fs 读取原始 app.asar 时受到 ASAR 虚拟文件系统处理，报 ENOENT 并退出1。该堆栈和已完成的资源清单均保留。第三次经主代理授权仅用 original-fs 读取实际 ASAR 原始字节，复用第二次全资源 SHA 证据，退出0，最终匹配通过。EXE三次保持同一个 SHA，未改动交付文件。

静态引用检查覆盖可解析的 JS 字面量、模块导入和 HTML/CSS URL；该审核及 Node 字节探针不冒充游戏 GUI/玩家行为验收。现有双启动结果另见本目录 portable-verification.json；五个空档位实页及功能测试由主代理记录。

## 证据位置

大 JSON、工具、阶段与异常日志仅保留根 `.tmp/portable-clean-1020/audit/`；本目录 `package-audit.json` 记录全部审计文件相对路径、字节数和 SHA256。主要报告：production-manifest.json、asset-references.json、protocol.json、images.json、asar.json、second-game-hashes.json、second-error.json、actual-game-summary.json、third-actual.json、probe-summary.json。
