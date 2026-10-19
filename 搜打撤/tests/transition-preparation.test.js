import { expect, it, vi } from 'vitest';
import { prepareTransition } from '../game/src/ui/transition-preparation.js';
it('does not launch already obsolete preparation', async () => {
  const prepare=vi.fn(); await expect(prepareTransition(prepare,{isCurrent:()=>false})).resolves.toEqual({ok:false,cancelled:true});
  expect(prepare).not.toHaveBeenCalled();
});
it('catches rejected and thrown preparation as failure data, never readiness', async () => {
  const error=new Error('offline');
  await expect(prepareTransition(() => Promise.reject(error),{isCurrent:()=>true})).resolves.toEqual({ok:false,error});
  await expect(prepareTransition(() => {throw error;},{isCurrent:()=>true})).resolves.toEqual({ok:false,error});
});
it('cancellation releases the waiter even if a shared import continues, without unhandled late rejection', async () => {
  const controller=new AbortController(); let reject;
  const pending=prepareTransition(() => new Promise((_,fail)=>{reject=fail;}),{signal:controller.signal,isCurrent:()=>true});
  await Promise.resolve(); controller.abort(); await expect(pending).resolves.toEqual({ok:false,cancelled:true});
  reject(new Error('late')); await Promise.resolve();
});
