# 首批基地 UI 实施与验证

状态：实现完成，等待父任务当前窗口逐页实机验收。没有浏览器实测通过结论，没有 build、提交或推送。

## 授权范围与变更

父任务于2026-10-15 UTC授权：上条建议中四份基地CSS、首局文案所在源码、`game.hub.runtime.js` 动态房间标题及相关测试；人物浅色背景／multiply规则暂不处理。不改战斗CSS、卡牌组件／规则、字体资产、index或Vite配置，不删除文件。

| 文件 | 本次精确修改 |
| --- | --- |
| `game/css/base-framework-v7.css` | 基地字号token从30／22／19调整为标题32／正文23／标签21逻辑px；按当前0.61875缩放约19.8／14.2／13.0显示px。公共阅读底alpha .76→.90、顶栏.42→.78、底栏.36→.78、内页标题阅读底.4→.90。没有改变全局等比缩放或面板尺寸 |
| `game/css/base-home-v7.css` | 首页事务与模式说明深底；首局标题用正文token、说明用标签token，去掉19／15px硬编码；空事务字也使用标签token。主行动按钮原有大小、位置与动作保留 |
| `game/css/base-personnel-v12.css` | 人物数据／伙伴阅读板使用公共深底；五人头像默认、选中和hover均用暗底，选中青边，修复浅hover白字风险；头像名与身份标签21px；招式页整块浅色背景改深阅读底，归档计数／说明改浅字。保留全部人物图URL与取景，未动 `feedback-oct12.css` 的浅底／multiply |
| `game/css/base-logistics-trade-v12.css` | 后勤说明增加独立稳定深底、边线和21px字号；仓库／商品选中从黄绿改青边＋暗青底；仓库普通卡位及交易模式导航加深。交易页内重复钱包隐藏；交易详情卡宽174→220逻辑px，图容器340→380以保留完整卡框，结算区尺寸及交易动作未改；价格辅助字号跟标签token |
| `game/src/hub/hub.home-v3.js` | 首局提示改为“正常入城探索，撤离带回资源卡；在后勤使用后，再去建设扩建。背包记得留空格。”，保留原首次目标条件与deploy动作 |
| `game/src/hub/game.hub.runtime.js` | 模块内增加七房间标题常量，顶栏按当前hubTab显示对应标题；没有拆新模块，不改返回路由／存档／交易逻辑 |
| `tests/hub-flow-regression.test.js` | 新增真实基地壳七房间循环测试：顶栏名称、底栏aria-current与名称对应；浏览不改基地资源。庭院画布mount替换为stub，测试明确不验证画布渲染 |
| `tests/fresh-run-onboarding-copy.test.js` | 补首局说明顺序断言：撤离带回→后勤使用→建设扩建；保留背包留格提醒 |

## 验证结果

- 定向 Vitest：8文件、85项通过。命令与原始输出见 [target-tests.log](target-tests.log)
  - `hub-flow-regression`、`fresh-run-onboarding-copy`、`hub-personnel-navigation`、`hub-personnel-actions`、`base-ui-sample`、`hub-trade-shop-v5`、`contracts`、`architecture-boundaries`
  - 直接运行 `npx vitest run ... --reporter=dot`，未触发npm test的剧情编译前置步骤或build
- 4个改动JS／测试文件定向 ESLint：退出0，见 [focused-lint.log](focused-lint.log)。仅npm环境变量警告，没有lint错误
- 4份改动CSS经现有PostCSS解析：全部通过；这是语法检查，不是最终计算样式／视觉验收
- 2个改动生产JS经 `node --check`：通过
- 自有8文件 `git diff --check`：通过
- 精确文件SHA与差异统计见 [source-snapshot.txt](source-snapshot.txt)

## 仍需实页确认

1. 当前1188窗口下首页目标是否可完整阅读；文字增大后事务板没有遮挡出征入口
2. 后勤说明、筛选和当前卡牌栏现在可读，增高说明未让卡牌滚动区域失效
3. 招式页暗底后所有筛选／计数／归档说明清晰，卡牌自身外观完全保留
4. 人物五头像hover／选中清晰，培养正文不再被床沿／桌面干扰；浅色原画框仍是下一切片待处理项
5. 交易详情卡完整不裁框，价格／余额／缺额／按钮保持可见；隐藏的是重复页内钱包，顶栏真实余额保留
6. 七房间动态顶栏与底栏一致，实际返回仍正确；收藏室、建设、庭院只继承公共token／阅读底，专属CSS未改
7. 07旧截图不作收藏室故障基线：父任务指出可能处于热更新过渡，应以新的稳定实页图为准

若实页发现文本换行、滚动或卡框问题，只在此批已授权范围内返修。视觉通过、真实性能、对比度采样和完整流程验证均由父任务另补，不能把85项逻辑测试当作这些结论。

## 架构守卫补验：运行壳行数

2026-10-15 UTC，近邻测试发现动态标题新增一行后 `game.hub.runtime.js` 的 `split('\n').length` 达430，触发现有 `<430` 守卫。仅移除文件末尾多余空白行，保留标准单换行结尾，行数430→429；标题映射、路由和所有行为不变。未改守卫、`game.hub.js`、depart或selection-state。

`hub-architecture` 与 `hub-flow-regression` 两文件18项复验通过，包含七房间动态标题与导航一致测试。原始输出见 [hub-architecture-recheck.log](hub-architecture-recheck.log)。自有runtime `git diff --check` 通过。
