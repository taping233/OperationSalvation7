import { beforeEach, describe, expect, it } from 'vitest';
import { aggregate, provenanceDriver } from '../game/src/agent/agent.stats.js';
import { recordRun, resetRunCounters, setDriver, noteIntervention, listRuns, exportCSV } from '../game/src/agent/agent.recorder.js';
import { dataPanelHTML } from '../game/src/agent/agent.data.js';

beforeEach(() => {
  localStorage.clear();
  resetRunCounters();
  setDriver('human');
  window.SDT = { game: { turn: 4, layerIdx: 0 }, Cards: { sellPrice: () => 7 } };
});

describe('真实 recorder 接口生成的来源组合', () => {
  it('自动驱动结束还原 human 后，聚合与明细仍识别 Agent', () => {
    setDriver('greedy');
    setDriver('human');
    const run = recordRun('extract', { carriedCards: [{ card: { name: '测试牌' }, count: 2 }] });
    expect(run.driver).toBe('human');
    expect(run.provenance).toMatchObject({ driver: 'agent', agentDriver: 'greedy' });
    expect(aggregate(listRuns()).byDriver.agent).toMatchObject({ runs: 1, avgCarriedValue: 14 });
    expect(dataPanelHTML()).toContain('Agent·脚本·贪心');
    const [head, row] = exportCSV().split('\n').map(line => line.split(','));
    expect(row[head.indexOf('provenanceDriver')]).toBe(provenanceDriver(run));
    expect(row[head.indexOf('driver')]).toBe('human');
  });

  it('调试干预不会归入真人，并保留自动脚本识别', () => {
    setDriver('greedy');
    setDriver('human');
    noteIntervention('debug-command', '定向接口实验');
    const run = recordRun('death');
    expect(run.driver).toBe('human');
    expect(aggregate(listRuns()).byDriver.mixed.runs).toBe(1);
    expect(dataPanelHTML()).toContain('混合干预·脚本·贪心');
  });

  it('无人为干预的真人与无来源旧记录分开，未知值也不造事实', () => {
    const human = recordRun('clear');
    const legacy = { ...human, provenance: undefined, driver: 'greedy' };
    const invalid = { ...human, provenance: { driver: 'unrecognised' } };
    expect(aggregate([human, legacy, invalid]).byDriver).toMatchObject({ human: { runs: 1 }, unknown: { runs: 2 } });
    localStorage.setItem('sdt-run-records', JSON.stringify([legacy, invalid]));
    expect(dataPanelHTML()).toContain('未记录');
    expect(dataPanelHTML()).not.toContain('脚本·贪心');
  });
});
