import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const H = vi.hoisted(() => ({ game:{}, slot:1, save:() => true, begin:vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({ game:H.game, getActiveSlot:() => H.slot,
  saveGame:() => H.save(), MAP:{ rules:{} }, MODES:{}, bagCap:() => 16, usedSlots:() => 0,
  curLayer:() => null, enterLayer(){}, newUid:() => 'new', scaledEnemy:value => value }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub(){} }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx:{}, _set_cardPageOpen(){} }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({ FIRE_RESTORABLE:() => true, consumeCurrentCell(){}, enterNode(){},
  finishInstant(){}, grantEventCard(){}, nodeOpt(){}, nodeShell(){}, openFixedRewardsOnCell(){}, openPocketRestore(){}, openShop(){} }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage:{ readIdentity:() => ({ ok:true, value:{ runId:'run-one' } }) } }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun(){}, readSettlementReceipt(){}, recoverSlot(){} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands:() => ({ begin:() => H.begin() }),
  buildExtractionReceipt(){}, extractionPocketOutcome(){}, validatePendingExtraction(){} }));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let doExtract, UI;
beforeEach(async () => {
  vi.resetModules();
  for (const key of Object.keys(H.game)) delete H.game[key];
  Object.assign(H.game, { state:'modal', runActive:true, seed:1, layerIdx:3, trackPos:4,
    layerData:[{}], discoveredPairs:new Set(), pendingExtraction:null, extractionPending:false });
  H.slot = 1; H.save = vi.fn(() => true);
  H.begin.mockReset().mockResolvedValue({ ok:false, code:'TEST_BARRIER', message:'事务检查未通过' });
  document.body.innerHTML = '<div id="overlay"><main id="ovBody"><section>撤离点</section></main></div>';
  UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') }, _overlayRevision:0,
    log:vi.fn(), refresh:vi.fn(), act(){}, showOverlay:vi.fn((_title, html) => { UI._overlayRevision++; UI.el.ovBody.innerHTML = html; }) };
  window.SDT = { UI, Base:{}, Meta:{ addXpToProgress(){} }, Cards:{ cardHTML:() => '' }, Sound:{ sfx(){}, music(){} } };
  ({ doExtract } = await import('../game/src/run/game.run.altar.js'));
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

it.each([true, false])('initial extraction checkpoint=%s cannot affect a replacement run', async saved => {
  const gate = deferred(); H.save.mockReturnValue(gate.promise);
  const extracting = doExtract();
  H.slot = 2; H.game.seed = 2; H.game.discoveredPairs = new Set();
  UI.showOverlay('', '<section id="replacement">另一档对局</section>');
  const replacement = UI.el.ovBody.firstElementChild;
  gate.resolve(saved); expect(await extracting).toBe(false);
  expect(H.game.extractionPending).toBe(false);
  expect(H.game.pendingExtraction).toBeNull();
  expect(H.begin).not.toHaveBeenCalled();
  expect(UI.el.ovBody.firstElementChild).toBe(replacement);
});

it.each([true, false])('initial extraction checkpoint=%s cannot replace the same-run system menu', async saved => {
  const gate = deferred(); H.save.mockReturnValue(gate.promise);
  const extracting = doExtract();
  UI.showOverlay('', '<section id="replacement">系统菜单</section>');
  const replacement = UI.el.ovBody.firstElementChild;
  gate.resolve(saved); expect(await extracting).toBe(false);
  expect(H.begin).not.toHaveBeenCalled();
  expect(H.game.extractionPending).toBe(false);
  expect(UI.el.ovBody.firstElementChild).toBe(replacement);
});

it.each(['false', 'throw', 'reject'])('initial extraction checkpoint %s shows retry without starting a transaction', async failure => {
  H.save.mockImplementation(() => {
    if (failure === 'throw') throw new Error('temporary storage failure');
    if (failure === 'reject') return Promise.reject(new Error('temporary storage failure'));
    return false;
  });
  await expect(doExtract()).resolves.toBe(false);
  expect(H.begin).not.toHaveBeenCalled();
  expect(H.game.extractionPending).toBe(false);
  expect(UI.el.ovBody.textContent).toContain('撤离前的进度未保存');
  H.save.mockReturnValue(true);
  await doExtract();
  expect(H.begin).toHaveBeenCalledOnce();
});

it('repeated extraction while the initial checkpoint is pending does not start another save', async () => {
  const gate = deferred(); H.save.mockReturnValue(gate.promise);
  const extracting = doExtract();
  expect(await doExtract()).toBe(false);
  expect(H.save).toHaveBeenCalledOnce();
  gate.resolve(true); await extracting;
  expect(H.begin).toHaveBeenCalledOnce();
});
