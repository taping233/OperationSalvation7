// Active exploration receipts stay complete. Closed explorations retain their
// newest receipt for retry diagnostics; unrelated permanent request ids stay intact.
export function retainRunReceipts(requests, activeRunId = null, closedLimit = 8) {
  const permanent = [], active = [], closed = new Map();
  for (const [key, receipt] of Object.entries(requests || {})) {
    const runId = receipt?.result?.value?.runId;
    if (!runId) permanent.push([key, receipt]);
    else if (runId === activeRunId) active.push([key, receipt]);
    else {
      const previous = closed.get(runId);
      if (!previous || Number(receipt.result.revision) >= Number(previous[1].result.revision)) closed.set(runId, [key, receipt]);
    }
  }
  const retained = [...closed.values()].sort((a, b) => Number(b[1].result.revision) - Number(a[1].result.revision)).slice(0, closedLimit);
  return Object.fromEntries([...permanent, ...retained, ...active]);
}
