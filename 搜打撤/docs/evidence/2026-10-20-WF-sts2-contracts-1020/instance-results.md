# 实例工厂与字段生命周期实施结果

2026-10-20，WF-sts2-contracts-1020 实例子任务。

## 修改

- 新增纯 `game/src/cards/card-instance.js`：`createCardInstance(template, uid)` 使用既有 JSON 深拷贝合同制造拥有牌，UID继续由原调用方分配；`refreshedCardFace(template, previous)` 计算刷新卡面，不修改来源。
- 新增 `card-instance-fields.js`：集中管理已核实的单局、单场、单次执行及展示字段；保留未知历史下划线扩展。
- `run/shop-commands.js`：购买构造实例牌改用工厂，原价格/容量/对象身份/UID复检及保存边界不变。
- `run/game.run.scenes.js`：事件/奖励授牌及旧无节点记录的复原分支改用工厂。
- `run/game.session.bag.js`：刷新改为相同字段合同；普通字段仍由现行同ID卡库定义覆盖，保留卡对象本身引用。内容相同时也拆开历史浅拷贝的嵌套共享；返回值仍只计内容变化，重复刷新内容与计数幂等。

现有三个入口文件的修改前字节保存在 `instance-baseline/`，其路径、大小、SHA256见 `instance-baseline.json`。其中 `shop-commands.js` 在本轮开始前就是既有未跟踪框架文件，本轮只添加工厂导入并替换实例构造，未将整份文件视为新实现。

## 验证

命令：`node node_modules/vitest/vitest.mjs run tests/sts2-card-instance.test.js tests/run-domain-commands.test.js tests/chest-acquired-gift-cloud.test.js --reporter=dot`

结果：退出码0，3文件39测试通过；22:54:19开始，Vitest 1.93秒。

专属测试覆盖真实连续购买、真实奖励授牌的两实例规则隔离，模板保持不变、UID和数量/扣款/保存次数、满包拒绝不分配UID；覆盖同ID现行自定义定义刷新、未知历史扩展与锦囊保留、临时字段失效、旧浅拷贝脱离共享、刷新幂等及孤儿自定义牌完全不动。

六个改动JS文件的语法和定向ESLint均退出码0；`node node_modules/typescript/bin/tsc -p jsconfig.framework-boundaries.json --pretty false` 退出码0，覆盖真实商店消费端及新模块。相关tracked diff检查通过。

## 兼容边界

- 复用 `core/shared.js` 的JSON卡数据克隆，没有新增随机抽样或UID生成器。
- 普通字段刷新、未知下划线字段保留、无模板牌不改，继续沿用原合同；已知临时字段清理是此次明确变化，清单和依据见 `instance-field-audit.md`。
- `_pouch` 与未知扩展被深拷贝；不递归删除其中历史数据。库内自定义定义仍可编辑。
- 本轮仅接入上述入口。其他拥有牌制造路径、当前节点复原的 `claimNodeRestore`、战斗内临时复制等不在本轮替换范围，不能据此宣称全库实例制造已统一。
- 没有修改 `game.session.js` 存档事务、schema、cards.data或cards-sync；未build、启服、提交，也未改共享流程台账或现行文档。
