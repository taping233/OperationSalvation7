  function rebuildNotes() {
    // 兼容旧版楼层键名（F1 → B1）
    const data = SDT.Notes.all();
    Object.keys(data).forEach(k => {
      if (k.startsWith('F1|')) { data['B1|' + k.slice(3)] = data[k]; delete data[k]; }
    });
    // 旧格子坐标键 "x,y" 一次性迁移为结点键 "li,idx"（结点地图改造后坐标语义变化）
    if (!localStorage.getItem('sdt-notes-node-migrated')) {
      Object.keys(data).forEach(k => {
        const bar = k.indexOf('|');
        const coord = k.slice(bar + 1), comma = coord.indexOf(',');
        if (comma < 0) return;
        const gx = +coord.slice(0, comma), gy = +coord.slice(comma + 1);
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) return;
        const loc = legacyGridToNode(gx, gy);
        if (loc) data[k.slice(0, bar + 1) + loc.li + ',' + loc.idx] = data[k];
        delete data[k];   // 匹配成功则换键；匹配失败的悬空旧键随迁移一并清理
      });
      localStorage.setItem('sdt-notes-node-migrated', '1');
    }
    if (Object.keys(data).length) localStorage.setItem('sdt-cell-notes-v1', JSON.stringify(data));
    game.noteMap = new Map(Object.entries(data));
  }

  // 旧 8×8 网格坐标 → 结点 (li, idx)（备注迁移 / 旧版导入 JSON 兼容用）
  function legacyGridToNode(gx, gy) {
    for (let li = 0; li < game.layerData.length; li++) {
      const logical = game.layerData[li].logical;
      const idx = logical.findIndex(lc => lc.grid.some(c => c.x === gx && c.y === gy));
      if (idx >= 0) return { li, idx };
    }
    return null;
  }

  function openCellEditor(li, idx) {
    const isCenter = li === -1;
    const ld = isCenter ? null : game.layerData[li];
    const lc = isCenter ? null : ld.logical[idx];
    const node = game.nodes.find(n => n.li === li && n.idx === idx);
    const note = SDT.Notes.get(MAP.boardId, li, idx);
    const info = [];
    if (!isCenter) {
      const door = (ld.doors || []).find(d => d.at === idx);
      const altarE = (ld.altarEntrances || []).find(a => a.at === idx);
      const eIdx = (ld.entrances || []).indexOf(idx);
      info.push(`${ld.name} · 轨道编号 <b>${idx}</b>`);
      if (eIdx >= 0) info.push(`[[icon:door]] 出生入口：${ld.entranceNames[eIdx]}`);
      if (door) info.push(`[[icon:door]] 环间门${door.exit ? '（撤离出口）' : ''} ⇄ ${MAP.layers[door.toLayer].name}`);
      if (altarE) info.push('[[icon:crystal]] 祭坛入口');
      info.push(`事件配置：${lc.def ? TYPE_NAME[lc.def.type] + (lc.def.n ? ` +${lc.def.n}币` : '') : '无'}`);
    } else {
      info.push(`中央区：${node ? node.def.name : '祭坛'}`);
    }
    game.state = 'modal';
    UI.showOverlay('[[icon:pen]] 编辑结点备注', `
      <p class="ov-stats">结点 ${isCenter ? `中央区 · #${idx}` : `环${li + 1} · #${idx}`}</p>
      <p class="ov-note" style="text-align:left">${info.join('<br>')}</p>
      <textarea id="ovNote" class="ov-textarea"
        placeholder="给这个结点写说明……">${esc(note)}</textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="saveNote">保存备注</button>
        <button class="ov-btn" data-act="clearNote">清空</button>
        <button class="ov-btn" data-act="closeNote">取消</button>
      </div>`);
    UI.act('saveNote', () => {
      const ta = document.getElementById('ovNote');
      SDT.Notes.set(MAP.boardId, li, idx, ta ? ta.value : '');
      rebuildNotes();
      UI.hideOverlay(); game.state = 'idle';
      UI.log('已保存结点备注', 'ok');
    });
    UI.act('clearNote', () => {
      SDT.Notes.set(MAP.boardId, li, idx, '');
      rebuildNotes();
      UI.hideOverlay(); game.state = 'idle';
      UI.log('已清空结点备注', 'dim');
    });
    UI.act('closeNote', () => { UI.hideOverlay(); game.state = 'idle'; });
  }

  function exportNotes() {
    const rows = Object.entries(SDT.Notes.all()).map(([key, text]) => {
      const [bid, coord] = key.split('|');
      const comma = coord.indexOf(',');
      if (comma < 0) return null;
      const li = +coord.slice(0, comma), idx = +coord.slice(comma + 1);
      const ld = li >= 0 ? game.layerData[li] : null;
      const p = li >= 0 ? (game.nodePos[li] && game.nodePos[li][idx]) : (game.centerPos && game.centerPos[idx]);
      if (!p) return null;
      return {
        board: bid, layer: ld ? ld.id : 'CENTER',
        ringIndex: li >= 0 ? idx : null, li, idx, x: p.x, y: p.y, note: text,
      };
    }).filter(Boolean).sort((a, b) => (a.layer || '').localeCompare(b.layer || '') ||
      ((a.ringIndex ?? 999) - (b.ringIndex ?? 999)));
    return JSON.stringify({ game: 'sdt', format: 'cell-notes', version: 3, cells: rows }, null, 2);
  }

  function showExportOverlay() {
    if (game.state !== 'idle') return;
    const json = exportNotes();
    game.state = 'modal';
    UI.showOverlay('[[icon:upload]] 导出格子备注', `
      <p class="ov-note">把下面的 JSON 发给开发者/AI，即可按备注更新格子事件。</p>
      <textarea id="ovExport" class="ov-textarea" readonly>${esc(json)}</textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="copyNotes">复制到剪贴板</button>
        <button class="ov-btn" data-act="downloadNotes">下载文件</button>
        <button class="ov-btn" data-act="closeTools">关闭</button>
      </div>`);
    UI.act('copyNotes', async () => {
      try { await navigator.clipboard.writeText(json); UI.log('备注 JSON 已复制到剪贴板', 'ok'); }
      catch (e) { UI.log('复制失败，请在文本框里手动全选复制', 'warn'); }
    });
    UI.act('downloadNotes', () => {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sdt-cell-notes.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    UI.act('closeTools', () => { UI.hideOverlay(); game.state = 'idle'; });
  }

  function showImportOverlay() {
    if (game.state !== 'idle') return;
    game.state = 'modal';
    UI.showOverlay('[[icon:download]] 导入格子备注', `
      <p class="ov-note">粘贴之前导出的 JSON（会合并覆盖同格子的备注）。</p>
      <textarea id="ovImport" class="ov-textarea" placeholder='{"game":"sdt","cells":[…]}'></textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="doImport">导入</button>
        <button class="ov-btn" data-act="closeTools">取消</button>
      </div>`);
    UI.act('doImport', () => {
      const ta = document.getElementById('ovImport');
      try {
        const parsed = JSON.parse(ta.value);
        const cells = Array.isArray(parsed) ? parsed : parsed.cells;
        if (Array.isArray(cells)) {
          for (const c of cells) {
            // v3：li/idx 结点坐标；v2：x/y 旧格子坐标（自动映射到结点）
            if (Number.isFinite(c.li) && Number.isFinite(c.idx)) {
              SDT.Notes.set(MAP.boardId, c.li, c.idx, c.note || '');
            } else {
              const loc = legacyGridToNode(c.x, c.y);
              if (loc) SDT.Notes.set(MAP.boardId, loc.li, loc.idx, c.note || '');
            }
          }
        } else {
          for (const [k, v] of Object.entries(parsed)) {
            const [bid, coord] = k.split('|');
            const comma = coord.indexOf(',');
            const a = +coord.slice(0, comma), b = +coord.slice(comma + 1);
            SDT.Notes.set(bid, a, b, String(v));
          }
        }
        rebuildNotes();
        UI.hideOverlay(); game.state = 'idle';
        UI.log('结点备注导入完成', 'ok');
      } catch (err) { UI.log('导入失败：JSON 格式不对（' + err.message + '）', 'warn'); }
    });
    UI.act('closeTools', () => { UI.hideOverlay(); game.state = 'idle'; });
  }

  function showClearOverlay() {
    if (game.state !== 'idle') return;
    game.state = 'modal';
    UI.showOverlay('[[icon:broom]] 清空全部备注', `
      <p class="ov-stats">确定删除所有格子备注？此操作不可恢复。</p>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="doClear">确认清空</button>
        <button class="ov-btn" data-act="closeTools">取消</button>
      </div>`);
    UI.act('doClear', () => {
      SDT.Notes.clearAll();
      rebuildNotes();
      UI.hideOverlay(); game.state = 'idle';
      UI.log('已清空全部格子备注', 'warn');
    });
    UI.act('closeTools', () => { UI.hideOverlay(); game.state = 'idle'; });
  }

  const TYPE_NAME = {
    coin: '硬币', wood: '木材', battle: '战斗', event: '随机事件', shop: '商店',
    fire: '火堆', chest: '宝箱', rations: '口粮', key: '钥匙',
    emergencyExit: '紧急撤离点', door: '环间门', altar: '祭坛', boss: 'BOSS', entrance: '出生入口',
  };
  game.TYPE_NAME = TYPE_NAME;

  // ---------- 开发者模式 ----------
  function initDevMode() {
    game.devMode = localStorage.getItem('sdt-dev') === '1';
    UI.el.tglDev.checked = game.devMode;
    UI.el.devTools.hidden = !game.devMode;
    game.nextDice = parseInt(localStorage.getItem('sdt-dev-dice') || '0', 10) || 0;
    UI.el.devDice.value = String(game.nextDice);
  }

  function bindDevMode() {
    UI.el.tglDev.addEventListener('change', (e) => {
      game.devMode = e.target.checked;
      localStorage.setItem('sdt-dev', game.devMode ? '1' : '0');
      UI.el.devTools.hidden = !game.devMode;
      UI.log(game.devMode ? '[[icon:tools]] 开发者模式已开启' : '开发者模式已关闭', 'sys');
    });
    UI.el.devDice.addEventListener('change', (e) => {
      game.nextDice = +e.target.value;
      localStorage.setItem('sdt-dev-dice', String(game.nextDice));
      UI.log(game.nextDice > 0 ? `[[icon:tools]] 骰子已固定为 ${game.nextDice} 点` : '骰子恢复随机', 'sys');
    });
    UI.el.btnCardDesigner.addEventListener('click', () => openCardDesigner(null));
    UI.el.btnCardLib.addEventListener('click', openCardLibrary);
    UI.el.btnDevRes.addEventListener('click', () => {
      const B = SDT.Base;
      B.data.wood += 2; B.data.rations += 2; B.save();
      UI.log('[[icon:tools]] 基地资源 +2 木材 +2 口粮（测试用）', 'sys');
    });
    UI.el.btnCombatTest.addEventListener('click', () => {
      const r = SDT.Combat.selfTest();
      r.lines.forEach(l => game.log(l, 'sys'));
      if (!r.pass) console.error('[Combat] 自测失败：', r.failed);
      game.log(r.pass ? '[[icon:check]] 四类伤害体系自测全部通过（' + r.total + ' 项）'
                      : '[[icon:cross]] 自测存在失败用例，详见浏览器控制台（F12）', r.pass ? 'sys' : 'warn');
    });
  }

