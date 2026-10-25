# 存档与时长修复

2026-10-23，本分片已修复 5 项：身份主键读取异常逸出（S1）、空档导入后旧资产复活（PERSIST-1）、战后时长重复累计（PERSIST-2）、非空整档替换后旧排队命令误操作新档、导入预检漏验人物皮肤子结构。保留同期已完成的源码精简与其他会话增量，没有提交或构建。

- 身份失败统一返回 `STORAGE_READ_FAILED`；恢复在采纳写基线及重放状态前退出，终局不误报已恢复。
- 空档替换当前基地时重建默认内存并使旧排队动作失效，随后保存不再写回旧币旧卡。
- 战后结算把已计入累计时长的 `elapsed` 与同局检查点原子写入，继续保存或重读不会再次累计这段时间；兼容省略时长的旧调用。
- 回归：`tests/project-bugfix-storage-1023.test.js` 新增 8 项，覆盖读取故障/写权/终局反馈、真实空档导入、真实战后继续保存与重读。
- 定向命令：`node node_modules/vitest/vitest.mjs run tests/project-bugfix-storage-1023.test.js tests/storage-review-remediation.test.js tests/battle-settlement-recovery.test.js tests/e5-session-recovery.test.js tests/terminal-persistence.test.js tests/game-session-slices.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot`，退出 0，6 文件 / 91 项通过。
- 续片：完整导入与导入恢复用显式 `replacement` 刷新基地，旧排队仓库动作失效；普通事务刷新保留原契约。皮肤预检拒绝数字或对象等不合法子结构，保留未知/退役皮肤的字符串 ID。
- 续片复现：导入排在旧复原命令之前时，原命令会消费新档索引 0 的卡并扣新钥匙；三种坏皮肤结构原本均通过预检。修复前 4 项按正确预期失败（退出 1）；追加合法旧皮肤兼容后，`tests/project-bugfix-archive-1023.test.js` 共 5 项通过。
- 续片命令：`node node_modules/vitest/vitest.mjs run tests/project-bugfix-archive-1023.test.js tests/project-bugfix-storage-1023.test.js tests/storage-review-remediation.test.js tests/save-slot-lock-interleaving.test.js tests/base-save-snapshot.test.js tests/base-write-lock.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot`，退出 0，6 文件 / 57 项通过。两批有重叠，未重复累计总数。源码与新增测试的语法、定向差异检查均退出 0。

范围：领域模块与真实存储测试；未执行全量、build 或浏览器实页。旧审查目录中的失败复现记录保留为修复前证据。
