# FB043 自然法杖下一回合费用：cd98745f 基线

## 结果

新远端 cd98745f03a6d8313a7138386b1499d8fe5ab4f6 仍存在提前零费问题：selection-flow 写入 turn + 1，card-cost 却以 >= 判断。先移入定向测试，在未修复的新基线上复现 2 失败 / 2 通过，见 [red-test.txt](red-test.txt)。随后仅将费用分支改为非空目标回合与当前回合严格相等，保留所有其他费用优先级。没有改 selection-flow、卡库、cards-sync 或存档结构。

旧快照及旧证据未动；本次独立初始化基线 fd9691aada60b926026f36578f50c69c4e8376e6 不是新远端提交。已核对根 AGENTS、局部 handoff、quality-gates 和 delta/handoff-manifest.json；费用源码及测试不在 remainingDirty，登记表只维护本任务行。rules.md 在新内容中仅追加一条自然法杖当前规则，未覆盖旧整文件。

## 当前验证

- [green-test.txt](green-test.txt)：12 文件 119 项通过，包括新测试、纯费用、实例查询、selection consumer/boundary、生命周期、快照、TT12、骷髅剑实例集成、contracts 与 architecture-boundaries 哨兵。
- 新测试覆盖当前/下一/过期回合、同模板不同 UID、原卡不移出不消耗、重复查询、同回合重复选牌、旧回调、离手/消耗候选、存档还原及战斗重置。既有变形测试覆盖沿原 UID 求费。无限符文最高优先级沿现有规则保留，补目标回合组合断言，未扩大玩法。
- [lint.txt](lint.txt)：定向 ESLint 与 diff check 通过。
- [syntax.txt](syntax.txt)：完整语法 488 源文件通过。
- [typecheck.txt](typecheck.txt)：8 套类型配置通过。
- [docs-check.txt](docs-check.txt)：文档检查未通过，16 项为快照缺失归档清单、历史证据或素材链接，不是本任务规则条目。未顺带改无关档案。
- jsdom 中既有 skull-sword 测试有 Canvas getContext 未实现警告，测试通过；没有将 jsdom 当作浏览器实页。

## 语义与交付边界

自然法杖记录依旧按实例 UID，不改变模板，选牌仍保留原牌，不新增“一次打出即删除”或额外保留规则；同回合重复选择写入同一目标回合。跨战斗重置仍经生命周期 resetCastOverrides 清除。生产变更只有 card-cost 的一个判断及注释。

未启动服务、未浏览器实页、未 build、未全量测试、未 commit/push。其他 worker 的装备域改动不属于本任务。自有文件指纹见 [changed-file-sha256.json](changed-file-sha256.json)。

## 待主线程统一实页验收

媒体尚待恢复，当前没有本任务实页证据。使用平台内置浏览器当前窗口，真实开战并使用自然法杖：
1. 所选有费实例当回合保留费用，实际打出扣原有能量。
2. 所选实例保留至下一玩家回合后显示并实际按 0 费打出，同模板另一实例保持原费。
3. 未打出的实例越过目标回合后恢复费用，额外回合按实际 turn。
4. 旧候选/重复选择、读档恢复及跨战斗重置后费用显示与实际支付一致，检查浏览器错误与战斗日志。

实页待验，不能把本记录标作完整玩家验收完成；等待主线程统一集成与验收。
