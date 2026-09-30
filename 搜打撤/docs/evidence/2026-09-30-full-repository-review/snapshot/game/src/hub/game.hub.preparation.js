import { createPreparationCommands, getPreparation, previewDeployment } from './preparation.commands.js';
import { buildPreparationViewModel, mountPreparationView } from './preparation.view.js';

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

  const isCurrent = token => generation === token && root?.isConnected !== false;

  function dispose() {
    generation++;
    controller?.dispose();
    controller = null;
    root = null;
  }

  function makeModel(snapshot, preparation, error = '') {
    return buildModel({
      baseSnapshot: snapshot,
      preparation,
      cardCatalog: data.cardCatalog(),
      characters: data.characters(),
      pets: data.pets(),
      catalogVersion: 'm06-v1',
      bagCapacity: data.bagCapacity(),
      error,
    });
  }

  function open() {
    if (controller && root?.isConnected !== false) return true;
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
    const repaint = (error = '') => {
      if (!isCurrent(token)) return null;
      const fresh = data.readBase(data.slotId());
      if (!fresh.ok) {
        if (isCurrent(token)) reportError(formatError(fresh));
        return fresh;
      }
      if (isCurrent(token)) controller?.update(makeModel(fresh.value, getPreparation(fresh.value), error));
      return fresh;
    };

    controller = mountView(panelRoot, {
      model: makeModel(current.value, getPreparation(current.value)),
      onIntent: async ({ type, payload = {} }) => {
        if (!isCurrent(token)) return;
        const slot = data.slotId();
        const fresh = data.readBase(slot);
        if (!fresh.ok) { reportError(formatError(fresh)); return; }
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
            const stack = fresh.value.stash.find(entry => entry.card?.id === item.card.cardId);
            if (stack) picks[stack.card.name] = item.appliedCount;
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
      },
    });
    return true;
  }

  function returnToBase() {
    if (!controller) return false;
    dispose();
    navigation.returnToBase();
    return true;
  }

  return Object.freeze({ open, dispose, returnToBase });
}

export { createHubPreparationFeature };
