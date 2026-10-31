# Vite完成范围只读核对

结论：已列出393个可进入主会话隔离index验收的精确候选：代码及随行文档239项、独立文档154项，分别见`vite-code-paths.txt`、`vite-docs-paths.txt`，合并名单为`vite-safe-paths.txt`。每项SHA256、mtimeNs/UTC与字节数见`vite-safe-file-manifest.json`；归属、排除与桌面交付指纹在`vite-safe-candidates.json`。这里只做路径安全盘点，不表示全部旧源码已重新验收，也没有stage、commit、push、build或服务操作。

`workflow ship --json`原始预览为ready：代码321、文档/证据1104、active27、unknown41、excluded814；原index为空，HEAD为9336c1df，没有可复用验收receipt。默认ready只证明能分组，不能替代人工归属与验收。原始预览见`vite-raw-ship-preview.json`，不得在新增本轮证据后直接复用旧plan SHA执行。

## 最终候选与排除

- 原始1425候选减去92个WAV，再加人工确证的11个desktop-app完成文件，得到1344；按Root要求将951项Unity原生历史/运行证据移出自动打包，留主会话单独选择汇总，最终393。原始Unity GitHub快照的单份snapshot.json仅为来源说明保留。
- 两个现行完成未提交范围已确认：原创音效试听页/说明/指纹与10月28日菜单、整备、庭院、成就和CSS精简及对应测试。音效运行映射未接候选，代码效率最后一轮按老板要求尚未验收；当前Unity原生通过不覆盖这些Vite改动。
- `original-full-1027/`与`web-full-1027/`共92个WAV均排除。原创登记明确不进Git；默认ship只排除evidence媒体，意外把它们列入code，已由本次人工名单修正。保留来源、合成脚本副本与SHA记录。
- 默认814个排除、27个active/doing/planned路径保持排除；其中动作帧4个生产/测试路径仍占用，不纳入本轮。主线服务没有源码占用，不启停或认领其进程。
- 剩余30个unknown不推断完成：配置备份、临时ship计划与旧PV等均不入名单。PENDING研究所满盒换牌仍暂缓，但不整文件排除已经完成的保存修复：`game.nest.js`具体diff与flow-goals-round32/33完成记录一致，为检查点、一次性战后结算、原页恢复和内部对话框，无新增满盒换牌玩法；当前SHA与10月27日v0.8.0交付冻结输入完全一致，已纳入。其他待拍板没有因此恢复旧功能或历史兼容。
- 当前候选再次按磁盘检查，未留下超过1MB的evidence或受限音频/视频/字体/压缩包。大件仍留本机，按项目规则只存路径、指纹与获取方式。

## desktop-app是完成内容

`WF-startup-portable-1027`登记明确完成未提交、编辑释放和已交付，涵盖启动窗、原生解包启动器/构建工具/README及桌面启动测试；不是根据unknown状态猜测完成。10月27日v0.8.0冻结输入4551项中，九个当前桌面源码/锁文件SHA与输入逐字节一致；package.json与冻结副本唯一差异是README明确说明的副本专用`build.portable.artifactName`。还原这一字段后JSON完全一致。desktop README由登记和交付记录的正式链接确认归属。11项均列入精确名单，旧EXE、dist、Library或临时副本不入库，不修改旧EXE源码。

## 与上次Unity同步的关系

上次73c145f位于临时独立Git快照的`codex/unity-unverified-20261031`，不是父仓master中的提交；本机临时仓仍可读。其README标记未验收，并省略大媒体，快照记录还明确两份Hub源码复制期间发生变化。它不能替代当前验收或作为Vite已提交证据。父仓`.gitignore`明确忽略`/SoudacheUnity/`，普通Vite ship不会同步Unity源码；主会话应按本次正式同步方式单独处理Unity精确快照。

主会话可以用本名单冻结隔离index后执行正式门，不在共享Vite构建。本轮新审查记录由主会话随后单独纳入docs提交。若源码、登记或index变化，应重新生成最终计划与指纹。

代码组所需随行文档为根`AGENTS.md`、`搜打撤/README.md`及`docs/audio-system.md`、`docs/map-travel.md`、`docs/modules/secondary-ui-style.md`、`docs/roadmap.md`、`docs/rules.md`、`docs/save-format.md`，均已列入239项代码组。desktop-app/README单列文档组。

## 公共仓凭证形态扫描

对最终名单中351份可解码UTF-8文本扫描OpenAI/GitHub/Google/AWS/JWT、字面Bearer、私钥块、带凭证URL及具名密钥字面量；排除明确示例、占位符和低熵假key，没有发现真实凭证形态。`vite-secret-scan.json`只记录路径/规则形态结论，没有打印或保存凭证值、没有联网验证凭证有效性。二进制和已排除的unknown/native文件不在此扫描声明内。
