# WF-feedback-inbox-polish：留言保存后自动退出 + 「留言信箱」改名

日期：2026-10-05。网页版留言第 3、4 条。任务分派为子智能体执行，主会话验收。

## 改动文件清单（仅本任务改动）

| 文件 | 改动 |
| --- | --- |
| `game/src/ui/game.menu.js` | 保存成功路径自动退出；「留言库」→「留言信箱」3 处用户可见文案 + 1 处页面记录名 |
| `game/src/ui/feedback.local.js` | 「留言库格式损坏」→「留言信箱格式损坏」2 处用户可见报错文案 |
| `tests/r7b-feedback.test.js` | 首条用例断言同步：由"停留提示含本浏览器"改为"保存成功自动退出" |

未触碰禁区文件：`game/src/ui/title-wallpaper.js`、`game/css/**`、`game/index.html`。

注意：`git diff` 中上述文件还含有**他人此前未提交**的改动（全部导出 `downloadFeedbackRecords`、`done` 字段等，属更早批次完成未提交的工作），本任务未触碰那些行；下述 diff 摘要只覆盖本任务改动。

## 每处改动的 diff 摘要

### 1. 保存成功后自动退出（game.menu.js `openSuggestionBox` 内 saveBtn.onclick）

改动前：保存成功后停留在留言表单，`sugWhere` 显示"已保存在本浏览器。请到留言库点击「全部导出」…"，需手动点「返回」。

改动后：

```js
if (layer._openToken !== token) return;
busy = false; saveBtn.disabled = false;
if (ok) {
  // 保存成功即自动退出留言界面、回原页面（close 的 token 守卫保证只退一次）；
  // 导出指引常驻表单下方静态提示，无需停留展示
  fields.forEach(el => { el.value = ''; });
  close();
  return;
}
document.getElementById('sugWhere').innerHTML = '写入失败，输入已保留，请重试。';
```

无死循环/重复退出风险论证：
- `close()` 复用既有取消路径，内部 `if (layer._openToken !== token) return` 守卫保证只执行一次 hideScreen 与状态恢复；
- 保存期间 `busy=true` 挡住重复点击，save 完成后 onclick 已返回，不会二次触发；
- 「取消后旧回调才 resolve」场景：外层 `layer._openToken !== token` 提前 return，行为与改动前一致（r7b 用例"延迟IPC保存时取消并重开"覆盖，仍绿）。
- 成功提示文案随之移除，导出指引由表单下方常驻静态提示承担（该静态提示在 index.html，本任务禁区，见遗留事项）。

### 2. 「留言库」→「留言信箱」（game.menu.js 3 处 + 页面记录名 1 处）

- `describeCurrentPage()`：`{ id: 'suginbox', name: '留言库' }` → `name: '留言信箱'`（写入留言记录 page.name 的用户可见页名）。
- 留言信箱页头：`<h2>[[icon:book]] 留言库</h2>` → `留言信箱`。
- 留言信箱读取失败兜底文案：`留言库读取失败，原数据已保留` → `留言信箱读取失败，原数据已保留`。
- 设置页第 5 节入口标题：`[[icon:book]] 留言库 <span class="set-en">SUGGESTION BOX</span>` → `留言信箱`（英文副标 SUGGESTION BOX 本就对应"信箱"，保留）。

### 3. feedback.local.js 2 处用户可见报错

`readLocalFeedback` 两处 `fail('INVALID_DATA', '留言库格式损坏，原数据已保留')` → `留言信箱格式损坏，原数据已保留`（该 message 会透传到留言信箱页展示）。

代码注释、变量名、存储键 `sdt-suggestions-v1`、测试用例描述均未改。

## 测试输出

命令：`PYTHONIOENCODING=utf-8 npx vitest run <rg -l "suggestion|留言" tests/ 所得 19 个文件> --reporter=dot`

```
 Test Files  19 passed (19)
      Tests  157 passed (157)
   Duration  22.10s
```

其中 r7b-feedback.test.js 首条用例更新为：保存成功断言 `#sugLayer` 已隐藏且 `game.state` 恢复 `'title'`（自动退出 + 回原页面）；失败路径（写入失败保留输入与弹层、坏存储保留原串、延迟 IPC 取消重开）断言不变、全部通过。

## 遗留事项（本任务边界外）

1. `game/index.html:291` 表单下方静态提示"保存后请到**留言库**点击「全部导出」…"仍用旧称。index.html 属禁区（并行代理在做标题页视觉），语义确指留言信箱页面，建议主线会话在该代理收官后同步改为「留言信箱」。
2. `game/css/base.css`、`winter.css`、`page-settings.css` 注释中另有"留言库"字样，纯注释、禁区文件，未改。
3. 设置页入口按钮文案为"查看历史留言"，不含"留言库"字样，无需改。
