# 基地、背包域测试修复记录

本轮修正现役门面、异步保存和页面复用后的测试接线，并修复两项已证实的生产回归；未改玩法、未恢复退役帮助接口，未修改公共 card-capacity.js。共享工程未运行测试、构建或服务；定向验证仅在 `.tmp/hub-gate-repair-1101/project` 隔离副本执行。未暂存、提交或推送。

## 生产修复

- `game/src/core/bag-render-derivation.js`：复用已生成 bagStacks 统计资源格，避免 bagSlotUsage 再次遍历 ownedCards。沿用同名分组、stackCapOf 与资源类型规则；原单次库存遍历/容量/不改源数据断言保留。
- `game/src/hub/bag-container-pages.js`：重绘已复用原 root，原 Inspect 仅比 root 引用不能识别旧闭包，真实存入后重放旧 Inspect 会打开旧卡。每次 render 增 revision，旧 Inspect 必须版本一致；正常当前详情与容器存取保留。证据：hub-target-3.json 的珍珠盒、锦囊旧详情两条失败，最终复验见下。
- `game.run.scenes.js` 复原候选耗尽焦点发现已交 Run 属地处理：保存锁未释放时聚焦保留的 disabled fireDone 会失败。保留正确焦点断言，未把 body 视为成功。

## 测试分组

- 正式门面：复用 Run 提供的 `connectSdtFixture`，避免整体替换 window.SDT 脱离模块捕获的正式对象。覆盖背包、容器、安全格、整备、撤离、仓库与伙伴夹具。
- 容器：所有成功存入、容量拒绝和旧回调场景读取真实按钮 dataset（stackIndex/stackCount），保留 UID、来源、容量、保存次数和过期回调断言；fixture 外部改变盒子所在分区后重新从当前按钮进入。
- 仓库：补齐当前孵化前置数据 PETS/pets/coins；容量不足/身份不唯一的禁用入口验证禁用及可读原因，不将 disabled.click 当真实点击。恢复容量后重新进入并二次确认，原五张入库、失败可重试及变体不串堆断言保留。
- 指南与说明：退役的 local help/registerHelp 已由当前系统菜单生存指南和内嵌 details 替代。驱动真实菜单→指南→返回→继续入口，保留分区、分类、排序、浮点滚动、焦点、换局/换档/替换库存/新页来源守卫；文案取当前 beginner-guide.json。撤离内嵌说明往返不重建完成确认，陈旧档位/请求序号确认不得成交。
- 容量：普通可用格与资源可用格按当前真实投影断言。满包夹具提供实际占位库存，不仅伪造旧 usedSlots 返回值。奖励整叠按钮当前一次移动可见三张分堆，四张同名场景明确验证前三 UID 入安全格，第四张留包并被禁用。
- 展示与生命周期：仓库无直接出售已沿当前实现；背包安全格按钮验证纯文字“移入安全格 · 同名1张”；庭院验证当前 workspace/controls；伙伴保留同一交互 host 时复用绑定，换 host/关闭正确释放；整备容量原因从现役 departure.summary.js 读取。
- 复原：真实输入前等待共享 overlay 的初始聚焦帧。初始满包必须禁用并解释；渲染后容量变化则由当前可点按钮触发执行守卫，库存、次数、滚动、焦点不变。

## 验证

- 第一批：7 文件，66 passed / 2 failed；两项均为当前可见分堆与外部修改分区后旧库存索引的夹具问题，已修。
- 第二批：17 文件，305 passed / 13 failed；余项集中旧指南/旧动作、现役文案及两个真实生命周期回归。
- 第三批：5 文件，154 passed / 4 failed；两项容器回归、一项复原焦点回归；另一次测试替换误插块在本地已删除，未进入正式门。
- 最终定向复验：22 文件 / 353 测试全部通过，退出码 0；见 `hub-target-final.json` / `.log`。覆盖列表 `hub-target-paths.txt`，当时26个相关输入 hash见 `hub-target-inputs.json`。
- Run 随后把保存重试也统一接入焦点收尾；取其最终 scenes 版本后仅重跑 `pocket-restore-interface.test.js`：19 passed / 0 failed，退出码 0，见 `hub-pocket-final.json` / `.log` 与 `hub-pocket-inputs.json`。
- 本域最终修改清单（2生产源 + 22测试）见 `hub-repair-paths.txt`，SHA256/大小/mtime见 `hub-repair-manifest.json`。`git diff --check` 退出码 0。生产及测试冻结，完整项目质量门由 Root 执行。

## 验证边界

Vitest 合成交互验证不替代内置浏览器实际画面或键鼠验收。本轮没有新增浏览器/Unity画面证据。旧文档缺失类失败由 Root 将随行 docs 纳入同一正式隔离快照解决，未删除或放宽相关断言。
