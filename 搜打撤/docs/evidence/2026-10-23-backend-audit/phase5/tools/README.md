# 主会话静态核对

`entry-graph.json` 是扫描时点的 Acorn 字面量模块入口图；`data-shapes.json` 记录重复声明形状候选。它们用于定位，不能用“没有引用”直接断言一个人工工具或公开兼容接口可删除，也不能证明共享现场之后没有变化。

`sync-cards-from-live.mjs.before.txt` 保留本轮脚本原字节，`sync-integration.json` 记录前后 SHA256。同步工具没有执行；未调用 sourceCardLibrary、迁移、数据写入或 CLI。静态装配程序仅取出该脚本的纯文本剥壳函数用于生成待解析字符串，再用 Acorn/ESLint 检查组合源码的语法和自由名称，没有求值组合源码。

同步装配的本轮变化：

- 在历史表与定版数据之前装配 `hosted-rule-snapshot.js`，其两个纯构造供新的规则声明使用。
- 在迁移工厂之前装配 `card-snapshot.js`，显式保留其生产导入别名 `sameSnapshot`。这是第四轮新比较器的手动装配补漏。
- 从现有 `card-rarity.js` 加载 rarityOf/isHeroLine/isClassCard；从现有 `pierce-arrow-revision.js` 建立隔离修订桥，保留其模块私有 ID/旧规则常量。这些名称在本轮原文重建结果中已经缺失。

`sync-assembly-before-static.json` / `sync-assembly-static.json` 分别记录原/后组合文本的名称解析，9 处未解析引用降至 0。脚本源码保留 CRLF，本轮净增 6 行。`*.phase5.patch` 为六文件中已有文件相对本轮原文的补丁；新 helper 全文与原/后指纹见上级卡牌分报告。

本目录证据均为静态核对，没有执行测试、业务模块、构建或浏览器。`../receipt.json` 是六文件最终指纹、计数和边界的汇总。
