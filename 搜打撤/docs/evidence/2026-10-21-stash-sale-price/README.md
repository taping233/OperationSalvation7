# 仓库售价统一

老板确认：仓库古朴每张2币、稀有3币、史诗4币、传说5币。
交易所列表、单张与整堆报价、确认报价校验及基地实际结算共用 `stash-sale-price.js`。
局内估值与商店计价不变；未列档位沿用原估值，材料及收藏保护规则不变。

验证：5文件117项通过（base-mutation、hub-trade-shop-v5、trade-stack-identity-audit、contracts、architecture-boundaries）；5份变动JS的ESLint通过。
11组类型检查通过（550/550份实现覆盖、strict 50/550）；docs:check与目标diff检查通过。

Codex内置浏览器访问 `http://localhost:5200/`，保持当前窗口；真实点击档位01、交易所。因该档仓库为空，使用CDP仅在DOM构造四档各3张库存，复用真实交易所渲染器与当前卡库；列表分别显示2/3/4/5币，古朴单张2币、整堆6币。截图 `warehouse-prices.png`；控制台error为空。这覆盖构造报价外观，实际售出与保存后读档由上述测试覆盖。临时DOM已刷新恢复并关闭临时标签，无新服务。

完成未提交；不build、不提交、不推送。
