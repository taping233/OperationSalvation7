# WF-package-1002 · 10-02 深夜首批冻结运行（失败留证）

运行1（15:03 UTC）：增量素材检查 22 errors——隔离副本 index 字节(LF) vs 审计指纹工作树字节(CRLF) 漂移，根因与修复见 ../2026-10-03-WF-package-1002/README.md。
运行2（15:56 UTC）：修复后全量 Vitest 7 失败（钩子未入库+快照字节断言五测试），逐项处置后第 8 次通过。

两份报告 JSON 均 >1MB 不进 git，SHA256 见 ../2026-10-03-WF-package-1002/big-files-sha256.txt。
