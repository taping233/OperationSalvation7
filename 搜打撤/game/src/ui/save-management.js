export function bindSlotArchive({ UI, saveArchive, previewRunBackup, restoreRunBackup, refresh, onError }) {
  const page = UI.el.ovBody.querySelector('.slot-page');
  const current = () => page?.isConnected && UI.el.ovBody.querySelector('.slot-page') === page
    && !page.closest('[hidden], .closing, [data-ui-closing]');
  UI.act('exportSlotArchive', async data => {
    if (!current()) return false;
    try {
      const result = await saveArchive.exportSlot(+data.slot);
      if (!current()) return false;
      if (!result.ok) { onError(result.message || '导出未完成，原档已保留'); return false; }
      const url = URL.createObjectURL(new Blob([result.value.text], {type:'application/json'}));
      try {
        const link = document.createElement('a'); link.href = url; link.download = result.value.fileName;
        link.click();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      return true;
    } catch (error) {
      if (current()) onError(error instanceof Error ? error.message : '导出未完成，原档已保留');
      return false;
    }
  });
  UI.act('importSlotArchive', data => {
    if (!current()) return;
    const slot = +data.slot;
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file || !current()) return;
      try {
        const result = await saveArchive.previewImport(await file.text(), slot);
        if (!current()) return;
        if (!result.ok) { onError(result.message || '备份未通过完整预检，原档未改动'); return; }
        const preview = result.value;
        const savedAt = preview.savedAt ? new Date(preview.savedAt).toLocaleString('zh-CN') : '未记录';
        const ok = await UI.confirmAction({ title:`导入至档位 ${slot}？`, message:`来源档位：${preview.sourceSlot}\n上次保存：${savedAt}\n${preview.overwrites ? '目标已有档案，将被这份备份替换。' : '将把备份写入此档位。'}`, confirmLabel:'确认导入整档', onConfirm:async () => {
          if (!current()) return false;
          const imported = await saveArchive.importSlot(preview, {confirm:true});
          if (!imported.ok) throw new Error(imported.message || '导入失败，原档已保留');
          return true;
        } });
        if (ok && current()) refresh();
      } catch (error) { if (current()) onError(error instanceof Error ? error.message : '读取备份失败'); }
    }, {once:true});
    input.click();
  });
  UI.act('slotRecovery', async data => {
    if (!current()) return false;
    const slot = +data.slot, candidate = previewRunBackup(slot);
    if (!candidate.ok) { onError(candidate.message || '没有通过完整校验的上一备档。可先导出整档保全原始数据。'); return false; }
    const savedAt = candidate.value.savedAt ? new Date(candidate.value.savedAt).toLocaleString('zh-CN') : '未记录';
    const ok = await UI.confirmAction({ title:'恢复上一有效检查点？', message:`档位 ${slot}\n备档时间：${savedAt}\n恢复会回退到该检查点，之后的进度不会保留。当前原始档案会先保全。`, confirmLabel:'恢复此检查点', onConfirm:() => current() && restoreRunBackup(slot, candidate.value) });
    if (ok && current()) refresh();
    return ok;
  });
  UI.act('recoverSlotImport', async data => {
    if (!current()) return false;
    const slot = +data.slot;
    const ok = await UI.confirmAction({ title:'恢复中断导入前的原档？', message:`档位 ${slot}\n将按保留的导入恢复记录还原导入前原串。当前数据与恢复记录不符时会停止并保留现场。`, confirmLabel:'恢复导入前原档', onConfirm:() => current() && saveArchive.recoverImport(slot, {confirm:true}) });
    if (ok && current()) refresh();
    return ok;
  });
}
