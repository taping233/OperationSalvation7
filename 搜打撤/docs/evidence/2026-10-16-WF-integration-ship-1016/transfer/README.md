# 无凭证 Git 元数据恢复辅助

`bootstrap_git.py` 仅用于最终远端提交归档已完整解压后的目录，不读取本机仓库或凭证，不做网络操作。主代理须先独立验证远端 commit/tree，并在项目目录外生成 `git-metadata.json`：

```json
{"commit":"<40位SHA1>","tree":"<40位SHA1>","raw_commit_base64":"<原始commit对象内容的base64>","entries":[{"path":"相对/路径","mode":"100644","type":"blob","object":"<blob SHA1>","size":123}]}
```

清单应为该 tree 的全部叶子项；`100644/100755/120000` 对应 `blob`，`160000` 对应 `commit`。gitlink 必须已有对应空目录；子模块对象与历史不在恢复范围。符号链接按目标字节核验；也支持归档把目标保存为普通文件。脚本支持 SHA-1 仓库，拒绝已有 `.git`、越界/重复/大小写冲突路径及不匹配字节。路径为便于跨平台同步拒绝反斜杠、冒号、尾随点或空格。

```sh
python /outside/project/bootstrap_git.py /path/to/extracted-project /outside/project/git-metadata.json
```

先校验全部本地 blob，再创建无模板全新 `.git`。普通文件批量导入，禁止 filters；精确模式写入 index；`write-tree`、原始 commit、HEAD 均比对外部清单。设置 `master` 与 shallow 边界，不配置 remote/token，也不复制原 `.git/config`。全局及系统 Git 配置在执行期间禁用。Linux 上为 `100755` 补足执行位，以符合 GitHub 归档模式。状态须完全干净才报告成功；若失败，新生成 `.git` 和所有用户文件均保留，不自动清理。

自验：`python selftest_bootstrap.py 'C:\Users\太平\AppData\Local\Temp'`，退出码 0。夹具覆盖普通文件、空格 Unicode 路径、可执行 mode、被 `.gitignore` 忽略但已跟踪文件、链接目标 blob、无子模块对象的 gitlink，以及缺失父对象的 shallow commit；全部重建后 clean、无 remote。另验证已有 `.git` 拒绝，危险路径/错误 blob 在创建 `.git` 前拒绝。

最终夹具 commit 为 `f5e12b455c76cd0e14a28c1281cf1094b3b96aef`，tree 为 `acfeaf4f96039aa819381557cdaa51041977fcac`；临时证据目录 `C:\Users\太平\AppData\Local\Temp\operation7-git-bootstrap-05uz9rhf` 保留。系统默认沙箱临时目录曾被 Git 拒绝写配置，指定获准临时根后正常通过。

自验初次导入产生本目录 `__pycache__`，作为中间文件保留排除，不纳入提交/传输；后续已禁用字节码写入。此 helper 未处理、打包、上传实际项目工作区，也未运行游戏全量测试或修改共享 index。
