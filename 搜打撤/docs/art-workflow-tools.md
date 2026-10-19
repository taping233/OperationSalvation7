# 单张皮肤接入与取证工具

使用现有Python/Pillow和Node，命令均在项目内，不安装依赖或全局命令。按具体目标限定handoff范围；皮肤目录入口为`game/src/core/art.js`的`SKIN_FULL_ART`，素材登记为`game/assets/asset-manifest.json`。不因增加皮肤自动改存档、默认图或战斗图。

## 导入皮肤

```powershell
python tools/skin-import.py --source <源图绝对路径> --character changwuyu --id drum-room-v2 --name "余响·鼓房" --evidence docs/evidence/<专属目录> --apply
```

`--apply`执行导入，省略时只预览。自动保留完整画布，编码RGB WebP，补皮肤配置、清单/count并记录源图与产物SHA256。结果为JSON，`status`为`preview`/`imported`/`failed`，失败退出1；不写git/index。默认质量94，可显式指定`--quality`。

同一请求可重跑或接续中断；已存在且内容一致的步骤跳过，不重新出图。证据目录内`skin-import-state.json`记录阶段，`skin-import.json`记录最终来源和处理结果；修改前文本备份留项目`.tmp/skin-import/`，不进git。ID/文件/登记冲突、请求变化、共享文件在本次写入前变化时停止，不覆盖他人内容。新增用途，不提供隐式替换或删除。

## 定向检查与退出码

```powershell
node scripts/asset-audit.cjs --scope selected --path game/assets/portraits/full/changwuyu-drum-room.webp --json
node tools/art-check.mjs --asset game/assets/portraits/full/changwuyu-drum-room.webp --test tests/m02-collection-commands.test.js --report docs/evidence/<专属目录>/checks.json
```

`--path`/`--asset`与`--test`可重复；结构化调用也可传`--paths-json`/`--tests-json`。目标检查返回`ok/errors/assets`，另列`global.ok/errorCount/historicalWarningCount/manifestIssues`。目标通过不能表示全局门通过。所选路径不存在或无有效路径时报错。

原`assets:audit --check`默认全局行为不变：`paths`只影响所选历史债的判定，不是全局过滤器。目标模式仍扫描全局一次用于摘要，省去重复扫描和输出全部无关错误，不宣称仅扫描单文件。`art-check.mjs`顺序执行目标检查及显式列出的Vitest文件，保留每步退出码、输出与用时；第一步失败不启动后续步骤，不build。单次报告是该范围证据，不替代提交门或CI。

## 当前内置浏览器取证

在CUA会话已通过真实输入到达目标页后，复用当前tab；不得用终端Playwright、外部浏览器或headless代替。先依据DOM确认实际控件角色；本次AX曾把带`aria-pressed`的按钮呈现为checkbox。

```javascript
var capture = await import('file:///D:/素材/代号柒/搜打撤/tools/browser-evidence.mjs');
var proof = await capture.captureBrowserEvidence(skinTab, {
  root: 'D:/素材/代号柒/搜打撤', directory: 'docs/evidence/<专属目录>',
  name: 'skin-preview', imageSelector: '.pv12-agent-image-stage img',
  inputKind: 'real-input', detail: '真实点击外观及皮肤预览；未验证刷新读档'
});
nodeRepl.write(proof);
```

助手先保存当前窗口PNG，再采集所选图片的加载/尺寸/fit与error日志，写JSON来源记录。不打开页面、不导航、不点击、不改变视口；`inputKind/detail`是调用方对实际覆盖的声明，工具不自动证明真实输入。`captured`仅表示取证完成；断连后保留已有截图并记`inconclusive`，不把缺失采集记通过；同名证据拒绝覆盖。

完成后一次回填任务结论与占用，输出保留修改、验证、未核项。现行状态归项目docs；平台记忆仅保存入口和陷阱。
