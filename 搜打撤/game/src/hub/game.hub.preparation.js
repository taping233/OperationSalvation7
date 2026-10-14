import { createPreparationCommands, getPreparation, previewDeployment } from './preparation.commands.js';
import { buildPreparationViewModel, mountPreparationView } from './preparation.view.js';
import { departureStackKey } from './base-departure.commands.js';

/**
 * 基地整备功能控制器。它只接收会话数据、页面宿主和导航能力；不读取 SDT、UI、document 或 window。
 * 页面离开时 dispose 会废弃尚未返回的 UI 更新，领域命令仍按其事务语义完成。
 */
function createHubPreparationFeature({ data, view, navigation, reportError, formatError, requestId }) {
  const commands = createPreparationCommands({
    readBase: data.readBase,
    readBaseReceipt: data.readBaseReceipt,
    commitBase: data.commitBase,
  });
  const buildModel = view.buildModel || buildPreparationViewModel;
  const mountView = view.mount || mountPreparationView;
  let controller = null;
  let root = null;
  let generation = 0;
  let activeSlot = null;

  const isCurrent = token => generation === token && root && root.isConnected !== false && data.slotId() === activeSlot;

  function dispose() {
    generation++;
    controller?.dispose();
    controller = null;
    root = null;
    activeSlot = null;
  }

  function makeModel(snapshot, preparation, error = '', busy = false) {
    return buildModel({
      baseSnapshot: snapshot,
      preparation,
      cardCatalog: data.cardCatalog(),
      characters: data.characters(),
      pets: data.pets(),
      catalogVersion: 'm06-v1',
      bagCapacity: data.bagCapacity(),
      busy,
      error,
    });
  }

  function open() {
    if (controller && isCurrent(generation)) return true;
    dispose();

    const slotId = data.slotId();
    const current = data.readBase(slotId);
    if (!current.ok) {
      reportError(formatError(current));
      return false;
    }

    const panelRoot = view.openPanel();
    if (!panelRoot) {
      reportError('无法打开出征准备页面，请返回基地后重试。');
      return false;
    }

    const token = ++generation;
    root = panelRoot;
    activeSlot = slotId;
    // A3-PREP-04（2026-10-03）：整备页 busy 态——异步 intent 执行期间以 busy:true 重绘
    // （视图 paint 据 current.busy 置 root[aria-busy]），命令 settle 后回 false，异常经
    // finally 同样复位，aria-busy 不卡 true。busy 翻转的推帧复用 lastSnapshot/lastError
    // （不重读 readBase、不重复 reportError，避免挤占命令层的读档配额），只翻 busy 态；
    // 数据刷新仍走 repaint。
    let busy = false;
    let lastError = '';
    let lastSnapshot = current.value;
    const repaint = (error = '') => {
      if (!isCurrent(token)) return null;
      const fresh = data.readBase(slotId);
      if (!fresh.ok) {
        if (isCurrent(token)) reportError(formatError(fresh));
        return fresh;
      }
      if (isCurrent(token)) {
        lastSnapshot = fresh.value;
        lastError = error;
        controller?.update(makeModel(fresh.value, getPreparation(fresh.value), error, busy));
      }
      return fresh;
    };
    const setBusy = value => {
      busy = value;
      if (isCurrent(token) && lastSnapshot) {
        controller?.update(makeModel(lastSnapshot, getPreparation(lastSnapshot), lastError, busy));
      }
    };

    controller = mountView(panelRoot, {
      model: makeModel(current.value, getPreparation(current.value)),
      onIntent: async ({ type, payload = {} }) => {
        if (!isCurrent(token)) return;
        const slot = slotId;
        const fresh = data.readBase(slot);
        if (!fresh.ok) { reportError(formatError(fresh)); return; }
        // A3-PREP-04：同步卫语句过后才进 busy；setBusy 在 try 内首行——update 在 busy:true 帧
        // 同步抛错也走 finally 复位；慢命令 await 期间视图持 busy:true，终态 repaint 后由 finally 复位。
        try {
          setBusy(true);
          const context = { slotId: slot, requestId: requestId(`prep-${type}`), expectedRevision: fresh.revision };
          const state = getPreparation(fresh.value);
          const preset = state.presets.find(item => item.id === payload.presetId);
          let result;

          if (type === 'goal-add' || type === 'goal-remove') {
            const tracked = type === 'goal-add' ? [...state.tracked, payload.targetId] : state.tracked.filter(id => id !== payload.targetId);
            result = await commands.setTrackedGoals(context, { targetIds: tracked.filter(Boolean) });
          } else if (type === 'preset-field' && preset) {
            result = await commands.savePreset(context, { ...preset, presetId: preset.id, [payload.field]: payload.value });
          } else if ((type === 'preset-pick-add' || type === 'preset-pick-remove') && preset) {
            const existing = preset.picks.filter(item => item.card.cardId !== payload.cardId);
            const picks = type === 'preset-pick-add' && payload.cardId
              ? existing.concat({ card: { cardId: payload.cardId }, count: payload.count })
              : existing;
            result = await commands.savePreset(context, { ...preset, presetId: preset.id, picks });
          } else if (type === 'preset-preview') {
            repaint();
            return;
          } else if (type === 'preset-apply' && preset) {
            const preview = previewDeployment({
              baseSnapshot: fresh.value,
              preset,
              cardCatalog: data.cardCatalog(),
              characters: data.characters(),
              pets: data.pets(),
              bagCapacity: data.bagCapacity(),
            });
            if (!preview.canStart) { repaint('库存或资格已变化，预设无法应用。'); return; }
            const picks = {};
            for (const item of preview.resolvedPicks.filter(item => item.status === 'ready' && item.appliedCount === item.requestedCount)) {
              const candidates = fresh.value.stash.filter(entry => entry.card?.id === item.card.cardId && (!item.card.variantKey || (entry.variantKey || entry.card.variantKey) === item.card.variantKey));
              if (candidates.length !== 1) { repaint('库存堆身份已变化，预设无法应用。'); return; }
              const stack = candidates[0];
              picks[departureStackKey(stack)] = item.appliedCount;
            }
            if (!isCurrent(token)) return;
            navigation.applyPicks(picks);
            dispose();
            navigation.openDeparture();
            return;
          } else if (type === 'preset-start' && preset) {
            result = await commands.startDeployment(context, { presetId: preset.id, mode: 'standard', expectedRunRevision: 0 });
          } else {
            return;
          }

          if (isCurrent(token)) repaint(result?.ok ? '' : (result?.message || '操作失败'));
        } finally {
          setBusy(false);
        }
      },
    });
    return true;
  }

  function returnToBase() {
    if (!controller || !isCurrent(generation)) return false;
    dispose();
    navigation.returnToBase();
    return true;
  }

  return Object.freeze({ open, dispose, returnToBase });
}

export { createHubPreparationFeature };
