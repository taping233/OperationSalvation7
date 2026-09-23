import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { RunStorage } from '../game/src/hub/game.storage.js';
import { createStoryCommands } from '../game/src/home/story.commands.js';
import { storyCommands } from '../game/src/home/story.commands.js';
import { inspectLastLamp, makeLastLampEventInstanceId, prepareLastLampChoice, validateLastLampState } from '../game/src/home/story.last-lamp.js';
import { lastLampNarrative } from '../game/src/home/narrative.js';

const base = () => ({ coins: 7, story: { flags: { existing: true }, outcomes: { otherStory: { kept: true } } } });
const input = (runId, segmentId, choiceId = 'continue', node = '1,2') => ({
  runId, segmentId, choiceId, eventInstanceId: `r6:last-lamp:v1:${runId}:${node}`,
});

describe('R6-a 最后一盏引路灯', () => {
  beforeEach(() => localStorage.clear());

  it.each(['open_beacon', 'shaded_marker'])('真实 M01 存储以三 run 完成 %s，重载幂等且异选冲突', async ending => {
    const Base = window.SDT.Base;
    Base.use(1); Base.save();
    let finalContext;
    for (const [runId, segmentId, choiceId] of [['real:a', 1, 'continue'], ['real:b', 2, 'continue'], ['real:c', 3, ending]]) {
      const eventInstanceId = makeLastLampEventInstanceId(runId, segmentId, 4);
      const inspected = storyCommands.inspect(1, { runId, eventInstanceId });
      expect(inspected).toMatchObject({ ok: true, value: { kind: 'available', segmentId } });
      finalContext = { slotId: 1, requestId: `real-${segmentId}`, expectedRevision: inspected.revision };
      expect(await storyCommands.record(finalContext, { runId, eventInstanceId, segmentId, choiceId })).toMatchObject({ ok: true });
    }
    const same = input('real:c', 3, ending, '3,4');
    expect(await storyCommands.record(finalContext, same)).toMatchObject({ ok: true });
    expect(await storyCommands.record(finalContext, { ...same, choiceId: ending === 'open_beacon' ? 'shaded_marker' : 'open_beacon' }))
      .toMatchObject({ ok: false, code: 'REQUEST_ID_CONFLICT' });
  });

  it.each(['open_beacon', 'shaded_marker'])('三次不同探索完成 %s，保留其它 story 且生成不同纪念', ending => {
    let snapshot = base();
    for (const [runId, segmentId, choiceId] of [['run-a', 1, 'continue'], ['run-b', 2, 'continue'], ['run-c', 3, ending]]) {
      const prepared = prepareLastLampChoice(snapshot, input(runId, segmentId, choiceId));
      expect(prepared.ok).toBe(true);
      snapshot = prepared.value.afterState;
    }
    const checked = validateLastLampState(snapshot.story);
    expect(checked.ok).toBe(true);
    expect(checked.value).toMatchObject({ stage: 3, ending });
    expect(checked.value.segments[3].mementoId).toBe(ending === 'open_beacon' ? 'last_lamp_open_beacon' : 'last_lamp_shaded_marker');
    expect(snapshot.story.outcomes.otherStory).toEqual({ kept: true });
    expect(snapshot.story.flags.existing).toBe(true);
    expect(snapshot.coins).toBe(7);
  });

  it('Base 中的稳定 runId 权威限制同局一段，换事件实例也不能推进', () => {
    const first = prepareLastLampChoice(base(), input('same-run', 1));
    expect(first.ok).toBe(true);
    expect(inspectLastLamp(first.value.afterState, input('same-run', 1, 'continue', '9,9')).value.kind).toBe('already-read-this-run');
    expect(prepareLastLampChoice(first.value.afterState, input('same-run', 2, 'continue', '9,9'))).toMatchObject({ ok: false, code: 'STORY_NOT_AVAILABLE' });
    expect(inspectLastLamp(first.value.afterState, { runId: 'same-run', eventInstanceId: input('same-run', 1).eventInstanceId }).value.kind).toBe('recover');
  });

  it('强 schema 拒绝 stage/segments/runs/ending 不一致且不改坏状态', () => {
    const broken = base();
    broken.story.outcomes['last-lamp'] = { version: 1, stage: 2, ending: 'open_beacon', segments: {}, runs: {} };
    const before = JSON.stringify(broken);
    expect(validateLastLampState(broken.story)).toMatchObject({ ok: false, code: 'INVALID_STORY_STATE' });
    expect(prepareLastLampChoice(broken, input('run-x', 1))).toMatchObject({ ok: false, code: 'INVALID_STORY_STATE' });
    expect(JSON.stringify(broken)).toBe(before);
  });

  it.each([null, undefined, 'broken'])('已有 last-lamp 键为 %s 时拒绝，不能当作新故事', value => {
    const broken = base();
    broken.story.outcomes['last-lamp'] = value;
    expect(validateLastLampState(broken.story)).toMatchObject({ ok: false, code: 'INVALID_STORY_STATE' });
  });

  it('事件实例绑定 runId 与非负整数节点，runId 含冒号仍无歧义', () => {
    const runId = 'slot:run:7';
    const eventInstanceId = makeLastLampEventInstanceId(runId, 2, 9);
    expect(inspectLastLamp(base(), { runId, eventInstanceId })).toMatchObject({ ok: true, value: { kind: 'available' } });
    for (const invalid of ['abc', 'r6:last-lamp:v1:other:2,9', `r6:last-lamp:v1:${runId}:-1,9`, `r6:last-lamp:v1:${runId}:2.5,9`]) {
      expect(inspectLastLamp(base(), { runId, eventInstanceId: invalid })).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
    }
  });

  it('命令先读 receipt：完成请求直接重放，不再读取/校验当前状态', async () => {
    const receipt = { ok: true, value: { requestId: 'done', output: { choiceId: 'open_beacon' } }, revision: 4 };
    const readBase = vi.fn(() => { throw new Error('receipt 命中后不应读取'); });
    const command = createStoryCommands({ readBase, readBaseReceipt: vi.fn(() => receipt), commitBase: vi.fn() });
    await expect(command.record({ slotId: 1, requestId: 'done', expectedRevision: 0 }, input('run-c', 3, 'open_beacon'))).resolves.toEqual(receipt);
    expect(readBase).not.toHaveBeenCalled();
  });

  it('同 requestId 改选择的冲突原样返回，不提交', async () => {
    const conflict = { ok: false, code: 'REQUEST_ID_CONFLICT', message: '冲突' };
    const commitBase = vi.fn();
    const command = createStoryCommands({ readBase: vi.fn(), readBaseReceipt: vi.fn(() => conflict), commitBase });
    await expect(command.record({ slotId: 1, requestId: 'same', expectedRevision: 0 }, input('run-c', 3, 'shaded_marker'))).resolves.toEqual(conflict);
    expect(commitBase).not.toHaveBeenCalled();
  });

  it('真实 run identity 窄口验证档位、版本、身份并在 pending journal 时拒绝', () => {
    expect(RunStorage.readIdentity(0)).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
    localStorage.setItem(RunStorage.key(1), JSON.stringify({ version: 2, _r2: { runId: 'run-real', revision: 3 } }));
    expect(RunStorage.readIdentity(1)).toEqual({ ok: true, value: { runId: 'run-real', revision: 3 } });
    localStorage.setItem('sdt-tx-v1-slot1', '{}');
    expect(RunStorage.readIdentity(1)).toMatchObject({ ok: false, code: 'RECOVERY_REQUIRED' });
    localStorage.removeItem('sdt-tx-v1-slot1');
    localStorage.setItem(RunStorage.key(1), JSON.stringify({ version: 99, _r2: { runId: 'run-real', revision: 3 } }));
    expect(RunStorage.readIdentity(1)).toMatchObject({ ok: false, code: 'INVALID_STATE' });
    localStorage.setItem(RunStorage.key(1), JSON.stringify({ version: 2 }));
    expect(RunStorage.readIdentity(1)).toMatchObject({ ok: false, code: 'INVALID_STATE' });
  });

  it('正式 Ink 三段可加载，最终选项明确展示互斥后果', async () => {
    expect((await lastLampNarrative(1)).choices.map(choice => choice.effect)).toEqual(['continue']);
    expect((await lastLampNarrative(2)).choices.map(choice => choice.effect)).toEqual(['continue']);
    const final = await lastLampNarrative(3);
    expect(final.choices.map(choice => choice.effect)).toEqual(['open_beacon', 'shaded_marker']);
    expect(final.choices[0].detail).toMatch(/远处可循光.*通路会暴露/);
    expect(final.choices[1].detail).toMatch(/近路保持隐蔽.*远处找不到/);
  });

  it('事件接线先提交 Base，再消费节点；保存失败路径撤销 visited 并保留重试页', () => {
    const source = fs.readFileSync('game/src/run/game.run.flow.js', 'utf8');
    expect(source).toMatch(/await storyCommands\.record[\s\S]*renderLastLampResult\(record, resultText, binding\)/);
    expect(source).toMatch(/UI\.act\('lastLampFinish'[\s\S]*consumeCurrentCell\(\);/);
    expect(source).toContain("if (!wasVisited && game.visited) delete game.visited[key]");
    expect(source).toContain("if (!narrative || !narrative.choices?.length) return false");
    const submit = source.indexOf('await storyCommands.record');
    expect(source.lastIndexOf('currentLastLampPage(binding)', submit)).toBeGreaterThan(-1);
    expect(source.indexOf('currentLastLampPage(binding)', submit)).toBeGreaterThan(submit);
    expect(source).toContain('setBagReturnHook(() => { if (currentLastLampPage(binding).ok) tryLastLampEvent(); })');
    expect(source).toContain('showChoiceError(result.message');
    expect(source.match(/asset: 'story-last-lamp'/g)).toHaveLength(4);
  });
});
