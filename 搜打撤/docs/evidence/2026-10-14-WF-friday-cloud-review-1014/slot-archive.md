# 存档迁移安全与归档原件修复

## 实现

- 版本转换后必须为非负有限整数，阻止负极大值/负无穷迁移死循环与小数跳过迁移。基地历史 abc→v0 和数字字符串兼容不变；过新合法整数仍拒读为 tooNew，坏档原串保留并备份。
- 恢复两份归档原件的精确源字节，未改清单哈希；仅对该 originals 子树设置 -text 和 CR 行尾识别，避免 Git 归一破坏历史证据。AGENTS.md 为混合行尾，不采用全文件推测转换。
- POSIX pre-commit 文件改为可执行，避免 Linux 静默忽略真实质量门。

## 验证

- Node 22.23.3：hub-versioned-slot-reader 与 docs-consistency 共 28 项通过。新增 10 项版本安全/兼容回归；此前隔离超时探针确认负极大值/负无穷卡死、小数跳级。
- 原件 SHA256：AGENTS.md 64de3328036ec86faca20cbc7eeb9ac63d120dc6dc9de44c9467f20db8fb0ed1；MAKER-HANDBOOK.md 39d23cbc584ee93b039fb0caf7cecf0cd93b50eb875e63bb900e227e47935006。
- 在仓库根目录对两份原件比较 git hash-object 的原始/按路径过滤结果，Git 入库字节完全相同。
- git diff --check 通过；未放宽全仓空白规则。全量质量门与最终提交由汇总验收记录说明。

## 获取边界

精简快照排除了 desktop-app 和历史截图，初次 contracts/docs 测试因此出现 ENOENT/目录缺失。已从固定 db831272 提交补取 main.js、package.json 和一张真实历史截图，Git blob SHA1 校验通过；这些不是产品改动，也未用假占位数据改变断言。其余排除文件仍未获取。
