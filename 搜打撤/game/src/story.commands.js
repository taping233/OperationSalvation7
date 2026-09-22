import { commitBase, readBase, readBaseReceipt } from './base.commands.js';
import { inspectLastLamp, prepareLastLampChoice } from './story.last-lamp.js';

function createStoryCommands(ports = {}) {
  const read = ports.readBase || readBase;
  const readReceipt = ports.readBaseReceipt || readBaseReceipt;
  const commit = ports.commitBase || commitBase;
  return Object.freeze({
    inspect(slotId, identity) {
      const current = read(slotId);
      if (!current.ok) return current;
      const inspected = inspectLastLamp(current.value, identity);
      return inspected.ok ? { ok: true, value: inspected.value, revision: current.revision } : inspected;
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
      const prepared = prepareLastLampChoice(current.value, input);
      if (!prepared.ok) return prepared;
      return commit(context, { ...prepared.value, beforeRevision: current.revision });
    },
  });
}

const storyCommands = createStoryCommands();
export { createStoryCommands, storyCommands };
