import { commitBase, readBase, readBaseReceipt } from '../hub/base.commands.js';
import { inspectLastLamp, prepareLastLampChoice } from './story.last-lamp.js';

function createStoryCommands(ports = {}) {
  const read = ports.readBase || readBase;
  const readReceipt = ports.readBaseReceipt || readBaseReceipt;
  const commit = ports.commitBase || commitBase;
  return Object.freeze({
    inspect(slotId, identity) {
      const current = read(slotId);
      if (!current.ok) return current;
      const inspected = inspectLastLamp((/** @type {Extract<ReturnType<typeof read>,{ok:true}>} */ (current)).value, identity);
      return inspected.ok ? { ok: true, value: (/** @type {Extract<ReturnType<typeof inspectLastLamp>,{ok:true}>} */ (inspected)).value, revision: current.revision } : inspected;
    },
    async record(context, input) {
      const identity = { command: 'story.recordLastLampChoice', payload: {
        storyId: 'last-lamp', segmentId: input?.segmentId, eventInstanceId: input?.eventInstanceId,
        runId: input?.runId, choiceId: input?.choiceId,
      } };
      const prior = readReceipt(context, identity);
      if (!prior.ok || prior.value) return prior;
      const current = read(context.slotId);
      if (!current.ok) return current;
      const prepared = prepareLastLampChoice((/** @type {Extract<ReturnType<typeof read>,{ok:true}>} */ (current)).value, input);
      if (!prepared.ok) return prepared;
      return commit(context, { ...(/** @type {Extract<ReturnType<typeof prepareLastLampChoice>,{ok:true}>} */ (prepared)).value, beforeRevision: current.revision });
    },
  });
}

const storyCommands = createStoryCommands();
export { createStoryCommands, storyCommands };
