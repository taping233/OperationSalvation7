import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('R5-b developer-only route diagnosis',()=>{
  it('shows escaped read-only route identity without seed controls or regeneration',()=>{
    const source=readFileSync(resolve(process.cwd(),'game/src/run/game.run.dev.js'),'utf8');
    expect(source).toContain('data-route-debug');
    for(const field of ['game.mapSeed','game.routeVersion','plan.status','plan.fallbackReason']) expect(source).toContain(`esc(${field}`);
    expect(source).not.toMatch(/data-act="[^"]*(seed|route|regenerat)/i);
  });
});
