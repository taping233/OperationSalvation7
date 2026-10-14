# 云端集成边界与环境修复

首轮质量门：语法387文件、数据、8组类型与ESLint通过；全测360文件中350通过/10失败，3109通过/12失败/2跳过，另1套件获取失败。构建因前级失败未运行。未将定向通过伪报全量通过。

- 获取补齐：精简导出排除了 desktop-app/suggestions-store.cjs、docs/previews/m04 的4份HTML、r7a-encounters/index.html。从固定 db831272 GitHub blob 获取并校验SHA1，未修改既有断言，不作为产品改动。此前同样补取桌面启动/包元数据与真实历史截图。
- 主机注入的网络代理启动钩子会输出 UNDICI-EHPA 实验性提示，导致两个要求stderr为空的CLI测试失败。首次尝试全局 NODE_OPTIONS 抑制提示，触发隔离验收门的预载环境拒绝，第二轮358文件通过/2失败、18个门禁夹具失败；保留此失败记录。最终只在只读 CLI 隔离夹具的子进程参数添加 Node 官方 --disable-warning=UNDICI-EHPA，保留代理钩子与其余stderr，不改断言、不设置全局NODE_OPTIONS、不放宽真实隔离门。获取/CLI相关4文件17项定向通过。
- 神灯真实护甲修复与战斗续接回归相遇：旧测试曾依赖误赠的5护甲。按确证规则修正为选项1不赠甲、敌方一次3伤后HP47，并保持一次攻击断言。精确导出清单登记新续接函数，未改成宽松包含断言。
- 新输出资产别名脚本补入专属测试映射，不使用豁免。
- 工作流记忆夹具缺少自身.git标记，宿主/tmp有父级标记导致查找选错根；按独立仓库夹具修复，生产身份匹配不放宽。

第三轮完整质量门（未新增全局 NODE_OPTIONS）：语法、数据、8组类型、ESLint通过；360测试文件全部通过，3125测试通过、2既有跳过。Vite生产编译成功；后置预算失败：package158.00/112MiB、entry370.5/270KiB、initialJS415.9/310KiB、CSS215.8/136KiB。duplicates0.69MiB已通过，battle43.1KiB、narrative31.0KiB、startup6项通过。整体check:quality仍exit1，未提高阈值。完整日志由云端交付证据提供。


Vite扫描自动生成的 game/src/generated/art-manifest.js 不作为作者修复补丁传递，完整仓库构建会重新生成。当前云端扫描为910条，SHA256 7ce35512c9d60d097a649dc050f9e6cd422be46c6220159a4a704213579fa88f；相较快照新增421条，61项表面删除为Windows反斜杠路径规范成正斜杠，规范化后没有旧条目丢失。原路径对应文件均存在。thumb-manifest.js未改变。


最终第四轮：新增主页/庭院按需加载及5份独立CSS空白压缩后，语法、数据、8组类型、ESLint通过；362个测试文件全部通过，3141项通过，2项既有跳过。生产编译成功；package157.99/112MiB、entry361.8/270KiB、initialJS407.2/310KiB、CSS207.9/136KiB仍失败，duplicates0.69MiB、battle43.1KiB、narrative31.0KiB、startup6通过。整体exit1，阈值未改。文档检查598相对链接、findings空；git diff --check通过。

修复版普通空档01成功建立；按需加载庭院首次正在准备且控件禁用，返回基地再进入后正常展示，投喂反馈通过。没有强行声称离开动作必在异步解析前，时序故障由单元测试保证。
