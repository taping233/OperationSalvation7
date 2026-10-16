# 私有 GitHub 交付准备（只读）

本次只准备路线，不代表源码冻结、归属完成、质量门通过或已经发布。没有上传、创建分支/PR、提交、修改远端、读取/提取凭证、配置持久访问或运行测试/build。仅复用现有交付预检、读取文件/工具元数据、对 263 帧作 stat，并对 Wu 一件做有界本地字节桥接。

## 实时远端

2026-10-16 00:04 UTC 通过现有 GitHub 连接器只读确认：

- 仓库 `taping233/OperationSalvation7` 仍为 private，默认分支 master，push/admin 权限均 true
- master 为 `f0e84c5dc34afcbc1176b1519258d2c3010c62cb`
- 该提交 tree 为 `869f3477c070304d5e6a96cfba395c42ab143e80`
- 本地 HEAD 相同，暂存区为空；不把以上时点当作实际发布时仍有效的保证

复用 `../2026-10-16-cloud-delivery-preflight/` 和 `../2026-10-16-WF-cloud-sprite-lossless/`。父任务提及的 github-delivery-route 在给定项目路径及仓库根对应路径未找到，本次没有假装读取过它。当前源码和证据仍可能在变，不重用预检计数充当最终冻结清单。

## 推荐低风险路线（得到实际发布授权之后）

1. 等父任务确认所有修改归属和最终测试；冻结显式 allowlist、删除清单、文件模式、字节数、Git blob SHA、SHA256。复核活跃文件 mtime，按现行工作流完成最终门；排除已忽略的大候选图、缓存、未获归属的中间件。不要整目录盲目打包
2. 再只读核验仓库仍 private、master 仍为预期基线，核准新审查分支名不存在。若 master 前进，暂停处理新的基线，不覆盖它
3. 对二进制用 `create_blob(encoding="base64", content=完整真实base64字符串)`。每次响应 SHA 必须等于冻结清单的 Git blob SHA；记录成功对象，失败/超限时不更新任何 ref
4. 对 UTF-8 文本可优先用 `create_tree` 的 `tree_elements` 内联 `content` 批量创建，避免每个文本单独 create_blob。官方 API 支持此格式，连接器数组允许任意对象；本次没有实际写入证明连接器透传。先验证一个小文本批次，之后按可控 JSON 字节预算分批。每批 `base_tree_sha` 用上批返回 tree，第一批必须用已核准基线 tree
5. 同一树项使用 `sha` 或 `content` 二选一；二进制只引用已核验 blob SHA，不能将 base64 字符串内联当作二进制。保留文件原 mode；删除必须是显式批准路径且 `sha:null`，不能省略基线 tree
6. 所有 tree 路径相对仓库根，当前项目路径必须带 `搜打撤/` 前缀。不要误把 `game/...` 写到仓库根，也不要同时提供父 tree 项和冲突的嵌套项
7. 用只读 Git tree 查询核对全部允许路径、模式和 blob SHA、删除及未改目录继承，再创建一个以基线为 parent 的 commit。核验 commit/tree/parent。最后仅创建此前不存在的新审查分支指向该 commit，不修改 master、不打开 PR、不合并；后两项如需执行另按父任务授权
8. 如果采用“新分支先落基线，再移动”的实现，更新只能针对该新分支，用 `update_ref(expected_sha=已读分支头, force=false)`。lease 不匹配立即重读并停止盲重试。完成后只读确认审查分支准确 SHA、master 未变、仓库仍私有，再检查该准确提交的 CI 状态

## 已实证的字符串桥接

`create_blob` 的 content 是字符串，工具不接受本地文件路径或 Library ID 作为文件内容；不能从连接器取出凭证改走 shell push。

- 263 张重编码帧共 22,340,844B；stat 均匹配既有 receipt，最大 202,160B，每帧 base64 不超过 269,548 字符
- Wu 正式 WebP 1,011,996B，base64 1,349,328 字符
- room 正式依赖 WebP 607,272B，base64 809,696 字符
- 共 265 件运行二进制 23,960,112B，base64 31,947,144 字符；未把截图算进这个数量

Wu 整文件单次 stdout 的本地只读实验失败：期望 1,349,328 字符，但工具仅返回 1,048,606 字符（含截断提示），即使请求足够大的 max_output_tokens 仍截断。不能把返回字符串直接上传。

已改为原始字节按 393,216B（3 的倍数）分块，每片 base64 至多 524,288 字符；逐片检查精确长度和字符集，全部取得后在 functions 内拼成真正的完整字符串。Wu 的三片为 393,216 + 393,216 + 225,564B，拼接后 1,349,328 字符，完整解码所得 Git blob SHA 与独立本地计算严格相同：

`ef9054695ebea5f36f0dad7cfa31fc46c00114b3`

SHA256 为 `68fe23ed56b3b9fee7e3fbfef64546ddc260da282897b87703034446b00432de`。只读桥接成功，不等于 GitHub 工具已经接受 1.35MB 入参；该连接器请求体大小上限未公开/未实写验证。真实发布授权后宜先用 Wu 一件测试最大已知 payload；失败就停，不将同一文件拆成多 blob 后假装是原文件，也不改编码/降质来绕过限制。room 采用相同保守分块法可用两片。

## 大小与速率边界

- 当前可见工具无 push_files、批量 create_blob、文件路径直传或通用 Git push 接口。文本内联批 tree 是可减少调用量的正式 API 路线；不是二进制批上传
- GitHub 普通仓库阻止 >100MiB 文件；这不是连接器入参限制证明。Git blob 的 Create 文档只列 content/encoding，未明确承诺本工具任意请求体大小
- 官方 Get tree 的 recursive 返回上限为 100,000 项/7MB，这属于读取返回限制，不能拿它当作 Create tree 的写入上限。返回 truncated 时需逐子树有界读取，不能宣称完整核验
- GitHub 一般次级内容创建上限为 80 次/分钟、500 次/小时，可能有更低/未公开限制，且与网页和其他调用共用。官方建议串行、每次变更请求间至少间隔 1 秒。500 次/小时不是“每秒写一个就足够”的保证，应维护滚动预算并给其他操作留余量
- 265 件运行二进制逐 blob 已占至少 265 次写；若 76 张已审查截图全部纳入，至少 341 次，之后仍需文本树批次、commit/ref。不要对近千候选逐文本 create_blob；先计算完整预算再执行
- 收到 403/429 时遵守 retry-after / reset；未提供时至少等 1 分钟，按官方建议指数退避，持续失败要报具体状态。权限拒绝不走别的凭证/路线绕过。当前连接器未向本次 read 结果暴露速率响应头，不能声称掌握可用余额

## Library bundle 退路（仅方案，本次不生成/上传）

若连接器无法接受完整二进制 payload 或授权范围不允许远端写，父任务可先取得交付包授权，再从同一个冻结 allowlist 制作带 baseline/tree、删除清单、原 mode、Git blob SHA/SHA256、准确测试范围的交付归档。可包含 `git diff --binary` 的已跟踪路径补丁及单独的新文件归档；未跟踪文件不能仅靠 git diff 交付。不要为了制作“git bundle”额外产生未授权提交。

归档不得含凭证、缓存或未批准候选图，必须有大小和 SHA256 验证。小于约 50MiB 的一个新本地包可用 Library 的单文件路径上传流程；多文件或约 50MiB 以上须用当前 Library 的 prepared-upload helper，核验逐项成功与准确 Library 身份后由父线程原生附件交付。仅有本地路径或私有下载 URL 不算用户已收到，也不算 GitHub 分支已发布。父任务可随后在用户已授权的环境中按包说明应用到新审查分支；本次不创建环境、不配置凭证。

## 来源

- [GitHub repo](https://github.com/taping233/OperationSalvation7)
- [Create a blob](https://docs.github.com/en/rest/git/blobs#create-a-blob)
- [Create a tree](https://docs.github.com/en/rest/git/trees#create-a-tree)
- [REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [GitHub file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)

机器可读时点与 Wu 桥接证明见 summary.json。所有数据是本次准备时点证据，实际交付必须重新冻结。
