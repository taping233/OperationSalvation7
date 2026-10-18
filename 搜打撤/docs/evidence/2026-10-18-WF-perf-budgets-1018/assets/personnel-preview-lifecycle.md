# 角色切换：过期图片不再启动额外解码

本次只在 `game/src/hub/hub.presentation.js` 的人物图片 `onload` 中，将已有的“图片仍连接且请求仍为最新”条件提前到 `decode()` 之前。正常显示的角色、皮肤、图片路径与保存逻辑均未修改；最新图片仍在解码成功或失败后揭示，无 decode API 时仍直接揭示。

触发路径：基地 → 配置 → 培养，在图片完成前连续点击不同人物头像；或发起切换后离开此页。此前只在解码完成后的 `reveal` 阶段检查请求令牌，已过期或已离页的大图仍会启动解码。现将同一条件用于解码前，保留原来的揭示阶段检查。

## 受控证据

使用实际 `personnelHTML` 与 `updatePersonnelV12`，在 jsdom 中控制 Image 的 load/decode 完成时机。修改前原字节保存在 [baseline/hub.presentation.js.txt](baseline/hub.presentation.js.txt)。[personnel-preview-audit.json](personnel-preview-audit.json) 与 [personnel-preview-audit.cjs.txt](personnel-preview-audit.cjs.txt) 记录独立 A/B 及实际修改函数匹配情况。

| 操作 | 修改前 decode | 修改后 decode | 显示结果 |
| --- | ---: | ---: | --- |
| 图片完成前快速切 4 人 | 4 | 1 | 均为最后选择 |
| 快速切 4 人后离页，再完成 load | 4 | 0 | 均不提交旧图片 |

两组均创建 4 个加载 Image；本次不取消已发下载，也不取消已经开始的解码。计数是受控的显式 decode 调用数，未测真实浏览器耗时、FPS、RSS 或显存。

## 验证与边界

定向 Vitest 两文件共 14 项通过（新生命周期 6 项、既有人物立绘 8 项），见 [personnel-tests.json](personnel-tests.json)。新测试覆盖最后选择、离页、最新图片等待解码、解码失败、无 decode API，以及旧请求已经进入解码后的安全提交。生产文件与新测试 ESLint 均通过。

这条生命周期检查在开发与生产模式均生效。没有改 Vite、CSS、资源路径、人物规则或性能预算，没有重建、实页或修改共享工作区在途事件文件。`runtime-asset-redundancy-review.mjs` 中该文件的 opaqueConsumers 指纹须由主会话同步至 `5c60ba882c596467a699bfc4adc27369ddabbf62c807a7e84c7216a1e9bebacc`，避免后续构建因指纹不符保守恢复已排除资源。

实页由主会话在内置浏览器当前窗口核验：基地 → 配置 → 培养，先连续切换多个角色，再停留最后一人确认图片与文字一致；重复后立即离开至仓库，确认没有旧角色回写；返回配置切换外观，确认最新外观正常揭示。若图片已命中缓存而没有待完成请求，应将该次观察标为普通切换验证，不能据此宣称测到过期解码减少。

本目录先前的 86 张旧宝箱帧发布方案未实施，仍以游玩收益为准。
