# 2026-10-02 机制完善（WF-process-refine）

老板指令：按三方向修改完善开发机制（省 token 模式：GLM-5.3-Flash 子代理做扫描与机械改写，判断归主会话）。方向与估时见会话对话；本目录落证据。

## 交付一：handoff 台账核对自动化（方向①）

`scripts/workflow-status.mjs` 新增 `registryStaleness(root, rows, changedPaths, options)` + `pendingAging(rows, options)`，接入 `handoff()`：

- **settled-row-remains**：状态已落库/释放/归档仍留活跃表 → 提示销账移行。
- **stale-claim**：编辑中/进行中但属地全部无未提交改动且最新 mtime 超 24h → 登记滞后疑点（属地 token 复用 impact-query 的 `extractRegistryTokens`，「不碰/零改动」排除声明不参与）。
- **⏰ 活账老化**：PENDING 活账按「提出」列算年龄，简报一行（最老三项+超 7 天计数）；跨年日期回退上一年。

实测（10-02 00:3x）：老化行正确浮出「超 7 天 4 项｜最老 5/6 13 天」与 PENDING 实况一致；当前活跃行无 stale 误报。测试：tests/workflow-handoff.test.js 新增 7 用例（两 describe），16/16 绿。

## 交付二：口径真源守卫（方向②守卫部分）

`scripts/index-validation.mjs` 新增 `RULE_AUTHORITIES` 八口径真源表 + 行级 `duplicated-rule` 检测：

- 八口径：内置浏览器边界/验收分级质量门/提交授权/删除回滚报批/登记销账/端口约定/冻结引擎/验收证据目录。
- 真源=根 AGENTS.md（总纲）+ 各细则文件（quality-gates/PARALLEL-REGISTRY 规则节）；signature 取「完整表述特有」短语，指针式引用天然不命中；历史段豁免；**review 级不阻断**（老板红线：机制不过严）。
- 首跑存量：31 处收敛候选（QUICKSTART 8/README.md 7/production 系 6/PLAYBOOK 3/……），即 Flash 清单回来后的改写工作面。真源归属一次修正：登记销账/端口约定的 home 需含根 AGENTS（总纲与 REGISTRY 规则节双真源）。
- 测试：tests/workflow-index.test.js 新增 2 用例，7/7 绿。

## 交付三：清账节奏规则（方向③）

docs/WORKFLOW-TOOLS.md 收官节 + 半句：「落库批次收官时过一遍 handoff 提示的最老五项活账，催拍板或销账，不积压（10-02 起）」。与 handoff 的 ⏰ 行配套。

## 进行中：Flash 扫描与机械改写（方向②收敛执行）

- Workflow `dwfrun-aaabe197`（规则文档重复口径扫描，subagent_model=GLM-5.3-Flash）完成：**154 条口径出现记录**（登记销账 42/验收分级 36/证据目录 18/内置浏览器 17/提交授权 16/删除回滚 12/端口 7/冻结 6），清单落 `scan-dup-rules.md`（30KB，含逐字摘录与 full/pointer 分类）。
- 主会话真源判断：**约 60% 命中为有语境的合法复述**（台账头规则层、派工重申、WORKFLOW-TOOLS 表格分工、上手页必需信息、守卫 signature 的合法锚点），收敛清单定为 12 处：docs/README.md 六处、QUICKSTART 五处（其中两行合一）、WORKFLOW-TOOLS 一处。
- Workflow `dwfrun-813d0386`（指针化收敛改写，Flash）完成 12/12：diff 逐处验收通过——锚点词保留、原行合法内容未被误删（如「当前直接指令优先，历史经验不扩大授权」）、同行我的活账老化半句未被覆盖。**注意**：该 workflow 内置守卫步骤因 script 相对路径按 cwd=代号柒根写、实际 cwd=搜打撤 而 MODULE_NOT_FOUND——改写本身不受影响，守卫由主会话本地补跑。

## 最终验证（10-02 00:5x）

- `tests/workflow-handoff.test.js` 16/16、`tests/workflow-index.test.js` 7/7、`tests/docs-consistency.test.js`+`workflow-index` 合跑 10/10、相关六文件套 97/97、ESLint 净。
- `node scripts/index-validation.mjs`：ok:true；duplicated-rule 存量 31→27（降幅 4 为整行删除/特征句移除；其余 12 处改写保留了「是什么」的锚点句+指针，signature 仍命中但已是带指针的合法简述——review 级提示属设计内噪音，人工已逐处验收）。
- `npm run handoff` 实跑：⏰ 活账老化行正确（超 7 天 4 项｜最老 5/6 13 天）；当前活跃行无 stale-claim 误报。

## 追加：无主物品表销账核对（10-02 复查后老板令「加吧」）

复查盘出机制盲区——无主表「已处置未销账」无检测（sound.js 案例靠人工盘出）。本轮补齐：

- `unownedResolution(rows, changedPaths)`：无主行现象描述工作树状态（已暂存/已修改/未跟踪/改动）但所指文件当前已不在未提交状态 → `unowned-stale` 提示划线销账；划线行/进程类无 token 行天然不命中。
- 源头修复：`extractRegistryTokens` 增纯数字斜杠串过滤（「PID 21272/22356」曾被误当路径 token，惠及 impact 属地匹配）。
- **上线即抓到首个真实命中**：`__try_route-overlay-fullclosure.json` 在登记后数十分钟内被疑似归属会话清理，检测正确提示「现象与事实不符」，核实后台账行更新为 3 个——这是该机制 designed-for 场景的第一次实战验证。
- 过程修掉两个边界：①token/git 路径前缀形态不一致（workingChanges 按 prefix 剥 搜打撤/，双向兼容三形态比对）②台账现象列反引号说明性提及会形成 token（登记规范：已消失文件名不加反引号）。
- 验证：handoff+impact+index 等九文件 **132/132**、ESLint 净、实跑疑点分布仅剩已知 review 级（overlapping 6=本会话两行结构重叠、unconfirmed-commit 1 既有）。
- 台账维护随复查完成：sound.js 行核实已随 8be424a 落库划线销账；`__try_*.json` 无主中间文件登记勿动（4→3 实况更新）。

## 未验项

- 全量未跑（纯流程域定向+契约+守卫绿；以 CI 为准口径）。
- stale-claim 的 24h 阈值与 unowned-stale 均未经历真实长周期验证（首个真实命中后回看误报率再调）。
