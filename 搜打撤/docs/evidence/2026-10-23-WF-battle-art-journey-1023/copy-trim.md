# 同屏重复文案精简

日期：2026-10-23。范围：人事伙伴培养、人事外观、收藏室卡背详情。只移除同屏重复文案，保留规则、来源、解锁条件和操作状态。

- `game/src/hub/hub.personnel.js:81`：伙伴满级时不再渲染“伙伴已完成培养”；按钮保留“已达培养上限”，缺口粮及携带生效提示保持原条件。
- `game/src/hub/hub.personnel.js:110`：当前预览即装备外观时不渲染“当前使用”；按钮和外观选项仍标明“已装备”。预览其他外观时仍显示当前装备名称。
- `game/src/hub/hub.archive-v3.js:74`：眉题简化为“外观预览”；侧栏选项与操作按钮仍显示使用/解锁状态，用途、来源及解锁目标原样保留。

## 基线

修改前两文件无未提交 diff。原始字节备份位于 `C:\Users\太平\AppData\Local\Temp\copy-trim-1023-4p1sgd`，文件名与源码相同。

- hub.personnel.js SHA256：`44157a4c91715bdb8692e88e4a38d4731ae0388de7fcb23caeb2912f6deb3f6b`
- hub.archive-v3.js SHA256：`9c4385de843bc4d3dee5869fef0f1a145779098316612c13d10a78394cb0742d`

## 验证

两文件 `node --check` 通过，定向 `git diff --check` 通过。

已有测试集中执行：`hub-personnel-navigation`、`partner-interaction`、`hub-archive-v3`，3 文件 32 测试全部通过。未新增测试，未全量、build、提交。

实页由父会话集中检查，本记录不宣称已完成实页验证。
