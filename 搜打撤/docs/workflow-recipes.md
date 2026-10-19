# 常用工作流的短入口

复用现有`workflow verify/evidence/task/ledger/ship`与[美术接入工具](art-workflow-tools.md)，不另造任务/提交系统。小修不因此新增task.json。三个入口均不安装依赖、不自动提交、不build；阶段完成标准、画风评价、证据覆盖和冲突由负责人判断。

## 收官汇总

```powershell
node tools/workflow-summary.mjs --input docs/evidence/<任务>/summary-input.json --out docs/evidence/<任务>/closeout --write
```

输入为`title`、具体文件列表`paths`、报告列表`reports: [{path, sha256?, coverage?}]`和明确的`unverified`列表；可声明`doneWhenConfirmed`，不能由测试exit0代替该判断。默认只输出JSON，`--write`写`summary.json`、`summary.md`及兼容现有`workflow task close --input`的待审输入。输出目录不覆盖已有文件。

工具辨认现有命令链退出码、workflow报告及内置浏览器取证记录，分别标记`passed/failed/observed/unverified/stale`。报告哈希或已列源码指纹变化时不复用；无源码指纹明确注明新采集的文件哈希仅为清单，不证明旧测试仍新鲜。浏览器captured只记observed，不等于玩法通过。原生workflow报告仍沿`workflow evidence`核验；本摘要不替代提交门。

生成的task-close输入把报告列为待负责人审阅，不能直接宣称passed。没有既有task的普通小修只使用摘要；有task时审阅checks、完成标准和未核项后沿现有task close/ledger close一次回填。工具本身不改台账、不释放占用、不授权提交。

## 生图请求与只读预检

```powershell
python tools/nai-workflow.py status --width 1344 --height 768
python tools/nai-workflow.py prepare --spec docs/evidence/<任务>/spec.json --out docs/evidence/<任务>/request.json
python tools/nai-workflow.py compare --before <原图路径> --after <重绘路径>
```

spec须明确`subjectIdentity`、`sceneAction`、`composition`、`lightMaterial`四段文字，以及`allowedChanges`、`preserve`非空列表。参考为`references: [{path, role}]`，role只能为identity/composition/style/edit-target；可指定width/height/seed/model/negative。不含凭据。prepare复用当前NAI画师/画法构建器和nai_gen payload，保存实际整数种子、模型、全部参数及参考路径/SHA256，拒绝覆盖原请求。默认1344×768；参考只作本地依据记录，不会上传。

status读取现有guard的冷却、节流、pending和大图配额，使用同一验证器，不创建状态/锁、不清冷却、不预扣额度，不发送网络请求。凭据只报来源是否存在，代理地址去掉用户名和密码；余额unknown、服务器unverified。readyToAttempt仅表示本地检查时可尝试，不能证明服务端恢复或替代发图时的guard。实际生图仍须沿授权调用nai_gen.generate_image。

compare只读统计同画布尺寸的像素变化，可用`--region x y width height`限定关注区域；尺寸不同明确不可直接比较，不隐式缩放。像素差异不证明人设、姿势或审美正确，不自动判定重绘失败。

## 当前内置浏览器操作配方

只在当前Codex CUA会话，传入已取得的当前本地游戏tab：

```javascript
var personnelRecipe = await import('file:///D:/素材/代号柒/搜打撤/tools/browser-personnel.mjs');
var result = await personnelRecipe.previewPersonnelSkin(tab, {
  root:'D:/素材/代号柒/搜打撤', directory:'docs/evidence/<任务>', name:'appearance-attempt1',
  slot:1, characterName:'常无欲', skinId:'drum-room', skinName:'余响·鼓房'
});
nodeRepl.write(result);
```

路径为进入城市→指定档位→配置→指定人物→外观→指定皮肤，每步从实时DOM确认并保存进度；已在目标预览则跳过导航。不同活动档位、缺失/歧义目标或断连会停止，保留已完成步骤。恢复连接后用新attempt名称重新调用，按当前状态续走，不盲目重放旧步骤。

默认只预览；仅在已有装备授权时显式传`apply:true`。不打开浏览器、不goto/reload、不修改视口、不覆盖/删除/重开存档。通过后调用既有取证助手一次保存当前窗口截图、图片状态和error日志。输入来源据实际动作声明；不验证刷新读档和自然战斗。游戏测试先按既有约定静音。
