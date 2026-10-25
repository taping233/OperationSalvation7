# 六组前端残留清退

老板在只读检查结果后授权“删除吧”。本轮仅处理已报告的六组：基地隐藏导航标记与失效仓库查询、旧人物更新流程、无调用的背包详情函数、退役3D状态及说明行、失效子页/特写查询、无生成值的立绘适配规则。未扩大到稍后发现的摄影候选。

## 改动

- hub.presentation：删除永久隐藏导航标记的创建、定位和测量，删除不存在的仓库详情测高与阅读位置分支。伙伴阅读位置、人物区当前尺寸计算和公共卡牌浏览器刷新保留。
- 人物更新直接走updatePersonnelV12，删除旧person-hero取样、echo换图与几何动画分支及其专用尺寸辅助函数。独立开发预览仍使用的person-hero样式保留。
- 删除35行、2,905字节的无调用showBagCardDetail。当前inspectStack→openBagZoom及道具、储物、交换等操作保留。零依赖自检改为检查当前点击入口、三项参数和实际放大函数，不再要求旧函数名存在。
- 删除scene-battle-3d的无效读取及正向旧样式、sts-note；保留负向选择器优先级和GPU中断提示。
- 删除tabKey中的旧子页查询，现行子页变化由navigationState读取；清退特写点击排除列表中的card-tip-group，保留inventory-zoom-info。
- 删除人物data-portrait-fit=body规则；当前生成器固定输出canvas。

本批前端源码净减 **10,870 字节**（UTF-8、LF），测试与自检增减另计。完整范围、快照和SHA256见[changes.json](changes.json)，批准依据见[approved-audit.json](approved-audit.json)，CSS条目见[css-details.json](css-details.json)。未删除整文件。

## 验证

- 5份CSS通过Stylelint；编辑的JS、测试和资源登记通过ESLint。修改前完成语法解析，最终自有改动核对通过，定向diff检查通过。收官时发现game.bag.js已有另外两处同期改动：bagUseStatus补baseCap、锦囊图标改spell-pouch；仅记录和保留，不计入本批删除量。当前背包四个相关测试文件另跑131项通过、3项失败，见[bag-current-tests.json](bag-current-tests.json)。
- 初次定向15文件268项通过、2项失败，原结果见[target-tests.json](target-tests.json)。用最新背包四文件结果替换旧背包结果后，15文件合计266项通过、4项失败，见[final-test-rollup.json](final-test-rollup.json)，重复运行不重复累加。现行人物渲染、背包快照、卡牌特写、地图面板、页面导航、正常返回、契约与架构检查均包含在定向范围内。
- 三个人物场景从人工旧DOM迁到真实personnelHTML生成器：加载成功后换图，失败时保留已解码图，快速切换时忽略迟到的旧图片。没有删除这些场景或增加空断言。
- 两项失败在变更前同样存在：安全格交换用Vitest变换仅加载原始背包快照，在相同用例、同一行得到相同失败，见[bag-before-tests.json](bag-before-tests.json)；档位文字自检的扫描清单和谓词在本批前后得到相同false，而本轮背包入口谓词前后均true。核对见[baseline-failures.json](baseline-failures.json)。未回写或回滚共享源码，未把失败记作通过。
- 同期背包改动后新增结晶回执和堆快照过滤两项失败。保留这两处同期改动、只恢复旧详情函数的对照运行同为131项通过、3项失败，失败名称与错误首行逐项相同，见[bag-before-with-concurrent-tests.json](bag-before-with-concurrent-tests.json)。证明最新背包三项失败不由删除旧详情函数引入；未修改其他会话容量、图标或测试代码来消除红灯。
- 最新背包回归后又出现珍珠盒图标gem→pearl-box的同期改动，已核对并保留，未重复测试这项图标变化；其当前SHA256单独记录为observedCurrentSha256。本批删除量仍按清理自身快照统计，不吸收其他会话改动。
- 资源构造表达式集合相同；仅更新两个变更前已匹配的消费者指纹，其他原有差异保持。资源排除/保留结果前后相同，7份冻结候选原字节一致，见[resource-review.json](resource-review.json)。资源登记另有WF-backend-audit-phase6-1023活跃占用，在两项更新后才核对到；已停止进一步改写，并在台账标明两个字段，不覆盖该会话其他内容。
- 按老板要求未开实页，未build、提交或推送。定向结果不代表全项目通过。
